import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createDatabase, initializeSchema } from '../src/database/Database.js';
import { TeamRepository } from '../src/registration/TeamRepository.js';
import { TournamentRepository } from '../src/tournament/TournamentRepository.js';
import { TournamentService } from '../src/tournament/TournamentService.js';
import { MatchRepository, type MatchRecord } from '../src/match/MatchRepository.js';
import { MatchService, MatchError, parseVietnamTime } from '../src/match/MatchService.js';
import type { MatchRoomGateway } from '../src/match/MatchRoomGateway.js';
import { MatchUI } from '../src/bot/ui/MatchUI.js';
import { MatchHandler } from '../src/bot/handlers/MatchHandler.js';
import { umaCommand } from '../src/bot/commands/umaCommand.js';

const tid = 'phase2b-test';
const clock = Date.UTC(2026, 9, 1, 0, 0);
type Db = ReturnType<typeof createDatabase>;

class FakeGateway implements MatchRoomGateway {
  created: string[] = [];
  added: [string, string][] = [];
  sent: MatchRecord[] = [];
  edited: MatchRecord[] = [];
  deleted: string[] = [];
  failAdd = false;
  failEdit = false;
  async createPrivateThread(_parent: string, name: string) {
    const id = `thread-${this.created.length + 1}`;
    this.created.push(name);
    return id;
  }
  async addMember(thread: string, user: string) {
    if (this.failAdd) throw new Error('Discord add failure');
    this.added.push([thread, user]);
  }
  async sendStarterMessage(_thread: string, match: MatchRecord) { this.sent.push(match); return `message-${this.sent.length}`; }
  async editStarterMessage(_thread: string, _message: string, match: MatchRecord) {
    if (this.failEdit) throw new Error('Discord edit failure');
    this.edited.push(match);
  }
  async fetchThread(thread: string) { return !this.deleted.includes(thread); }
  async deleteThread(thread: string) { this.deleted.push(thread); }
}

function makeTeam(teams: TeamRepository, index: number) {
  const registered = teams.registerTeam({ tournamentId: tid, name: `UMA Team ${index}`, abbreviation: `T${index}`,
    captainDiscordId: `captain-${index}`, captainContact: 'PRIVATE-CONTACT',
    starters: Array.from({ length: 5 }, (_, player) => ({ ingameName: `P${index}-${player}`,
      gameUid: `uid-${index}-${player}`, isSubstitute: false, slotNumber: player + 1 })), substitutes: [] });
  expect(registered.success).toBe(true);
  expect(teams.approveTeam(registered.team!.id, 'staff').success).toBe(true);
  return registered.team!;
}

function makeHarness(db: Db, gateway = new FakeGateway()) {
  const teams = new TeamRepository(db);
  teams.ensureTournament(tid, 'UMA Cup Match Test', 16);
  const tournaments = new TournamentRepository(db);
  const bracket = new TournamentService(tournaments);
  const matches = new MatchRepository(db);
  const service = new MatchService(matches, tournaments, bracket, gateway, () => clock);
  return { teams, tournaments, bracket, matches, service, gateway };
}

function drawField(harness: ReturnType<typeof makeHarness>, count = 4) {
  const teams = Array.from({ length: count }, (_, i) => makeTeam(harness.teams, i + 1));
  harness.bracket.openCheckin(tid);
  teams.forEach(team => harness.bracket.checkIn(tid, team.id, team.captainDiscordId));
  harness.bracket.draw(tid, 'staff');
  return teams;
}

describe('Phase 2B match lifecycle from the real Phase 2A adapter', () => {
  let db: Db;
  let h: ReturnType<typeof makeHarness>;
  beforeEach(() => { db = createDatabase(':memory:'); h = makeHarness(db); });
  afterEach(() => db.close());

  it('starts once from a real four-team bracket with two READY matches and one WAITING final', () => {
    drawField(h);
    const seeds = h.tournaments.seeds(tid);
    const engineIds = h.tournaments.matches(tid).map(match => match.engineMatchId);
    expect(h.service.list(tid).map(match => match.status)).toEqual(['READY', 'READY', 'WAITING']);
    expect(() => h.service.startTournament(tid, 'staff', false)).toThrowError(MatchError);
    const counts = h.service.startTournament(tid, 'staff', true);
    expect(counts.READY).toBe(2);
    expect(counts.WAITING).toBe(1);
    expect(h.matches.tournamentStatus(tid)).toBe('in_progress');
    expect(() => h.service.startTournament(tid, 'staff', true)).toThrowError(MatchError);
    expect(h.tournaments.seeds(tid)).toEqual(seeds);
    expect(h.tournaments.matches(tid).map(match => match.engineMatchId)).toEqual(engineIds);
  });

  it('rejects skipped or backward match-state updates at the database boundary', () => {
    drawField(h);
    const match = h.service.bySelector(tid, 1, 1);
    expect(() => db.prepare("UPDATE tournament_matches SET status = 'LIVE' WHERE id = ?").run(match.id)).toThrow();
    h.service.startTournament(tid, 'staff', true);
    expect(h.service.bySelector(tid, 1, 1).status).toBe('READY');
  });

  it('scopes referee assignment, is idempotent, and excludes WAITING and LIVE', async () => {
    drawField(h); h.service.startTournament(tid, 'staff', true);
    await expect(h.service.assignReferee(tid, 1, 1, 'referee', 'outsider', false)).rejects.toThrow(MatchError);
    expect(await h.service.assignReferee(tid, 1, 1, 'referee', 'staff', true)).toBe(true);
    expect(await h.service.assignReferee(tid, 1, 1, 'referee', 'staff', true)).toBe(false);
    await expect(h.service.assignReferee(tid, 2, 1, 'referee', 'staff', true)).rejects.toThrow(MatchError);
    await expect(h.service.assignReferee('other-tournament', 1, 1, 'referee', 'staff', true)).rejects.toThrow(MatchError);
    expect(h.service.bySelector(tid, 1, 1).refereeIds).toEqual(['referee']);
  });

  it('creates only READY private rooms with two captains and assigned referee, once', async () => {
    const teams = drawField(h); h.service.startTournament(tid, 'staff', true);
    expect((await h.service.createRooms(tid, 'hub', 'staff', true)).skippedMissingReferee).toBe(2);
    for (const number of [1, 2]) await h.service.assignReferee(tid, 1, number, `ref-${number}`, 'staff', true);
    const summary = await h.service.createRooms(tid, 'hub', 'staff', true);
    expect(summary).toMatchObject({ created: 2, skippedWaiting: 1, failures: 0 });
    expect(h.gateway.created).toHaveLength(2);
    expect(h.gateway.created[0]).toMatch(/^r1-m1-/);
    expect(h.gateway.added).toHaveLength(6);
    for (const team of teams) expect(h.gateway.added.map(item => item[1])).toContain(team.captainDiscordId);
    expect(h.gateway.added.map(item => item[1])).toEqual(expect.arrayContaining(['ref-1', 'ref-2']));
    expect(h.service.bySelector(tid, 1, 1).room).toMatchObject({ parentChannelId: 'hub', starterMessageId: 'message-1' });
    expect(h.service.bySelector(tid, 1, 1).status).toBe('ROOM_OPEN');
    expect((await h.service.createRooms(tid, 'hub', 'staff', true))).toMatchObject({ created: 0, alreadyExisting: 2 });
    expect(h.gateway.created).toHaveLength(2);
    expect(h.service.bySelector(tid, 2, 1).room).toBeNull();
  });

  it('admits a referee assigned after room creation and can repair failed admission on retry', async () => {
    drawField(h); h.service.startTournament(tid, 'staff', true);
    await h.service.assignReferee(tid, 1, 1, 'first-referee', 'staff', true);
    await h.service.createRooms(tid, 'hub', 'staff', true);
    const room = h.service.bySelector(tid, 1, 1).room!;
    h.gateway.failAdd = true;
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(h.service.assignReferee(tid, 1, 1, 'second-referee', 'staff', true)).rejects.toMatchObject({ code: 'REFEREE_ADMISSION_FAILED' });
    } finally { log.mockRestore(); }
    expect(h.service.bySelector(tid, 1, 1).refereeIds).toContain('second-referee');
    h.gateway.failAdd = false;
    expect(await h.service.assignReferee(tid, 1, 1, 'second-referee', 'staff', true)).toBe(false);
    expect(h.gateway.added).toContainEqual([room.threadId, 'second-referee']);
    expect(h.gateway.edited.at(-1)?.refereeIds).toContain('second-referee');
    expect(h.gateway.created).toHaveLength(1);
  });

  it('cleans up a new room if referee assignments change while Discord creates it', async () => {
    drawField(h); h.service.startTournament(tid, 'staff', true);
    await h.service.assignReferee(tid, 1, 1, 'first-referee', 'staff', true);
    const send = h.gateway.sendStarterMessage.bind(h.gateway);
    let injected = false;
    h.gateway.sendStarterMessage = async (thread, match) => {
      if (!injected) {
        injected = true;
        await h.service.assignReferee(tid, 1, 1, 'second-referee', 'staff', true);
      }
      return send(thread, match);
    };
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    let first: Awaited<ReturnType<MatchService['createRooms']>>;
    try { first = await h.service.createRooms(tid, 'hub', 'staff', true); }
    finally { log.mockRestore(); }
    expect(first.failures).toBe(1);
    expect(h.gateway.deleted).toContain('thread-1');
    expect(h.service.bySelector(tid, 1, 1).room).toBeNull();
    expect((await h.service.createRooms(tid, 'hub', 'staff', true)).created).toBe(1);
    expect(h.gateway.added).toContainEqual(['thread-2', 'second-referee']);
  });

  it('never creates a room for the BYE path', async () => {
    drawField(h, 3); h.service.startTournament(tid, 'staff', true);
    expect(h.tournaments.byes(tid)).toHaveLength(1);
    await h.service.assignReferee(tid, 1, 1, 'referee', 'staff', true);
    const result = await h.service.createRooms(tid, 'hub', 'staff', true);
    expect(result.created).toBe(1);
    expect(h.gateway.created).toHaveLength(1);
    expect(h.service.bySelector(tid, 2, 1).status).toBe('WAITING');
  });

  it('compensates gateway and DB failures without a false persisted room', async () => {
    drawField(h); h.service.startTournament(tid, 'staff', true);
    await h.service.assignReferee(tid, 1, 1, 'referee', 'staff', true);
    h.gateway.failAdd = true;
    const apiFailure = await h.service.createRooms(tid, 'hub', 'staff', true);
    expect(apiFailure.failures).toBe(1);
    expect(h.gateway.deleted).toEqual(['thread-1']);
    expect(h.service.bySelector(tid, 1, 1).room).toBeNull();
    h.gateway.failAdd = false;
    db.exec(`CREATE TRIGGER fail_room BEFORE INSERT ON match_rooms BEGIN SELECT RAISE(ABORT, 'DB failure'); END;`);
    const dbFailure = await h.service.createRooms(tid, 'hub', 'staff', true);
    expect(dbFailure.failures).toBe(1);
    expect(h.gateway.deleted).toContain('thread-2');
    expect(h.service.bySelector(tid, 1, 1).status).toBe('READY');
    expect(h.matches.bySelector(tid, 1, 1)?.room).toBeNull();
  });

  it('parses strict Vietnamese time, validates calendar dates and requires future time', () => {
    expect(parseVietnamTime('2026-10-05 19:30', clock)).toBe(Date.UTC(2026, 9, 5, 12, 30));
    for (const input of ['05/10/26', '2026-02-30 19:30', '2026-13-01 12:00', '2026-10-05 24:00', '2026-10-05 19:60']) {
      expect(() => parseVietnamTime(input, clock)).toThrowError(MatchError);
    }
    expect(() => parseVietnamTime('2026-09-30 19:30', clock)).toThrowError(MatchError);
  });

  it('schedules, reschedules in place and clears an earlier one-team confirmation', async () => {
    drawField(h); h.service.startTournament(tid, 'staff', true);
    await h.service.assignReferee(tid, 1, 1, 'referee', 'staff', true);
    await h.service.createRooms(tid, 'hub', 'staff', true);
    const first = await h.service.schedule(tid, 1, 1, '2026-10-05 19:30', 'staff', true);
    expect(first.status).toBe('SCHEDULED');
    expect(first.scheduledAt).toBe(Date.UTC(2026, 9, 5, 12, 30));
    await h.service.confirmReady(tid, first.id, first.room!.threadId, first.team1!.captainId);
    expect(h.service.bySelector(tid, 1, 1).readyTeamIds).toHaveLength(1);
    const changed = await h.service.schedule(tid, 1, 1, '2026-10-06 20:00', 'staff', true);
    expect(changed.status).toBe('SCHEDULED');
    expect(changed.readyTeamIds).toHaveLength(0);
    expect(h.gateway.edited.at(-1)?.scheduledAt).toBe(changed.scheduledAt);
  });

  it('reports a card edit failure while retaining the committed schedule for recovery', async () => {
    drawField(h); h.service.startTournament(tid, 'staff', true);
    await h.service.assignReferee(tid, 1, 1, 'referee', 'staff', true);
    await h.service.createRooms(tid, 'hub', 'staff', true);
    h.gateway.failEdit = true;
    await expect(h.service.schedule(tid, 1, 1, '2026-10-05 19:30', 'staff', true))
      .rejects.toMatchObject({ code: 'CARD_UPDATE_FAILED' });
    expect(h.service.bySelector(tid, 1, 1).status).toBe('SCHEDULED');
    expect(h.service.bySelector(tid, 1, 1).scheduledAt).toBe(Date.UTC(2026, 9, 5, 12, 30));
  });

  it('requires each captain separately and permits only assigned referee or staff to go LIVE', async () => {
    drawField(h); h.service.startTournament(tid, 'staff', true);
    await h.service.assignReferee(tid, 1, 1, 'referee', 'staff', true);
    await h.service.createRooms(tid, 'hub', 'staff', true);
    const match = await h.service.schedule(tid, 1, 1, '2026-10-05 19:30', 'staff', true);
    const thread = match.room!.threadId;
    await expect(h.service.confirmReady(tid, match.id, thread, 'stranger')).rejects.toThrow(MatchError);
    await expect(h.service.confirmReady(tid, match.id, thread, 'referee')).rejects.toThrow(MatchError);
    const first = await h.service.confirmReady(tid, match.id, thread, match.team1!.captainId);
    expect(first.match.status).toBe('SCHEDULED');
    expect(first.repeated).toBe(false);
    expect((await h.service.confirmReady(tid, match.id, thread, match.team1!.captainId)).repeated).toBe(true);
    await expect(h.service.startMatch(tid, match.id, thread, 'referee', false)).rejects.toThrow(MatchError);
    const second = await h.service.confirmReady(tid, match.id, thread, match.team2!.captainId);
    expect(second.match.status).toBe('READY_TO_START');
    await expect(h.service.startMatch(tid, match.id, thread, 'stranger', false)).rejects.toThrow(MatchError);
    await expect(h.service.startMatch(tid, match.id, 'wrong-thread', 'referee', false)).rejects.toThrow(MatchError);
    const live = await h.service.startMatch(tid, match.id, thread, 'referee', false);
    expect(live.status).toBe('LIVE');
    expect(live.startedAt).toBe(clock);
    expect(live.startedBy).toBe('referee');
    await expect(h.service.startMatch(tid, match.id, thread, 'referee', false)).rejects.toThrow(MatchError);
    expect(MatchUI.starterButtons(live)).toEqual([]);
    expect(MatchUI.starterEmbed(live).toJSON().footer?.text).toContain('Phase 3');
  });

  it('allows staff to start a ready match without a referee identity', async () => {
    drawField(h); h.service.startTournament(tid, 'staff', true);
    await h.service.assignReferee(tid, 1, 1, 'referee', 'staff', true);
    await h.service.createRooms(tid, 'hub', 'staff', true);
    const match = await h.service.schedule(tid, 1, 1, '2026-10-05 19:30', 'staff', true);
    await h.service.confirmReady(tid, match.id, match.room!.threadId, match.team1!.captainId);
    await h.service.confirmReady(tid, match.id, match.room!.threadId, match.team2!.captainId);
    expect((await h.service.startMatch(tid, match.id, match.room!.threadId, 'staff', true)).startedBy).toBe('staff');
  });

  it('keeps future-round matches waiting until an internal participant sync', () => {
    const teams = drawField(h); h.service.startTournament(tid, 'staff', true);
    const final = h.service.bySelector(tid, 2, 1);
    expect(final.status).toBe('WAITING');
    expect(() => h.service.syncParticipants(tid, final.id, teams[0].id, teams[0].id)).toThrowError(MatchError);
    const synced = h.service.syncParticipants(tid, final.id, teams[0].id, teams[1].id);
    expect(synced.status).toBe('READY');
    expect(synced.team1?.id).toBe(teams[0].id);
    expect(synced.team2?.id).toBe(teams[1].id);
  });

  it('detects impossible persisted match states on restart validation', async () => {
    drawField(h); h.service.startTournament(tid, 'staff', true);
    await h.service.assignReferee(tid, 1, 1, 'referee', 'staff', true);
    await h.service.createRooms(tid, 'hub', 'staff', true);
    const match = h.service.bySelector(tid, 1, 1);
    db.prepare('DELETE FROM match_rooms WHERE match_id = ?').run(match.id);
    expect(() => h.service.validatePersistedState(tid)).toThrowError(MatchError);
  });

  it('serializes new commands, room card, buttons and public embeds within limits', async () => {
    drawField(h, 16); h.service.startTournament(tid, 'staff', true);
    const names = (umaCommand.toJSON().options ?? []).map(option => option.name);
    expect(names).toEqual(expect.arrayContaining(['start', 'match-referee', 'rooms-create', 'match-schedule', 'matches']));
    const match = h.service.bySelector(tid, 1, 1);
    expect(MatchUI.starterEmbed(match).toJSON().title).toContain('R1-M1');
    expect(MatchUI.starterButtons(match)[0].toJSON().components).toHaveLength(2);
    const embeds = MatchUI.publicMatchEmbeds(h.service.list(tid));
    expect(embeds.length).toBeLessThanOrEqual(10);
    for (const embed of embeds) expect(embed.toJSON().description!.length).toBeLessThanOrEqual(4096);
    const publicText = embeds.map(embed => embed.toJSON().description).join('\n');
    expect(publicText).not.toContain('PRIVATE-CONTACT');
    expect(publicText).not.toContain('uid-');
    expect(publicText).not.toContain('thread-');
    expect(MatchUI.statusCounts(h.service.counts(tid))).toContain('LIVE');
  });

  it('denies non-staff at the command handler for start and room creation', async () => {
    const handler = new MatchHandler(h.service);
    for (const sub of ['start', 'match-referee', 'rooms-create', 'match-schedule']) {
      const reply = vi.fn();
      await handler.handleSlashCommand({ options: { getSubcommand: () => sub,
        getInteger: () => 1, getUser: () => ({ id: 'referee' }) }, user: { id: 'outsider' },
        inGuild: () => true, member: { permissions: { has: () => false }, roles: { cache: new Map() } },
        reply, deferred: false } as any);
      expect(reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Ban Tổ Chức') }));
    }
  });
});

describe('Phase 2B migration and restart', () => {
  it('normalizes legacy Phase 2A SCHEDULED rows once without changing identity', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uma-phase2b-migrate-'));
    const file = path.join(dir, 'legacy.sqlite');
    let db = createDatabase(file);
    try {
      const h = makeHarness(db);
      drawField(h);
      const before = h.tournaments.matches(tid);
      db.exec("DROP TRIGGER trg_match_status_forward; DELETE FROM schema_migrations WHERE name = 'phase2b_match_status_v1'; UPDATE tournament_matches SET status = 'SCHEDULED';");
      db.close();
      db = createDatabase(file);
      const after = new MatchRepository(db).list(tid);
      expect(after.map(m => m.status)).toEqual(['READY', 'READY', 'WAITING']);
      expect(after.map(m => [m.id, m.engineMatchId, m.round, m.number]))
        .toEqual(before.map(m => [m.id, m.engineMatchId, m.round, m.matchNumber]));
      initializeSchema(db);
      expect(new MatchRepository(db).list(tid).map(m => m.status)).toEqual(['READY', 'READY', 'WAITING']);
    } finally { db.close(); fs.rmSync(dir, { recursive: true, force: true }); }
  });

  it('does not normalize a real scheduled match when migration marker is absent', async () => {
    const db = createDatabase(':memory:');
    try {
      const h = makeHarness(db);
      drawField(h); h.service.startTournament(tid, 'staff', true);
      await h.service.assignReferee(tid, 1, 1, 'referee', 'staff', true);
      await h.service.createRooms(tid, 'hub', 'staff', true);
      await h.service.schedule(tid, 1, 1, '2026-10-05 19:30', 'staff', true);
      db.prepare("DELETE FROM schema_migrations WHERE name = 'phase2b_match_status_v1'").run();
      initializeSchema(db);
      expect(h.service.bySelector(tid, 1, 1).status).toBe('SCHEDULED');
      expect(h.service.bySelector(tid, 1, 1).scheduledAt).not.toBeNull();
    } finally { db.close(); }
  });

  it('reopens with stable rooms, referee, schedule, readiness, LIVE state and no recreation', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uma-phase2b-restart-'));
    const file = path.join(dir, 'tournament.sqlite');
    let db = createDatabase(file);
    try {
      const h = makeHarness(db);
      drawField(h); h.service.startTournament(tid, 'staff', true);
      await h.service.assignReferee(tid, 1, 1, 'referee', 'staff', true);
      await h.service.assignReferee(tid, 1, 2, 'referee', 'staff', true);
      await h.service.createRooms(tid, 'hub', 'staff', true);
      const scheduled = await h.service.schedule(tid, 1, 1, '2026-10-05 19:30', 'staff', true);
      await h.service.confirmReady(tid, scheduled.id, scheduled.room!.threadId, scheduled.team1!.captainId);
      await h.service.confirmReady(tid, scheduled.id, scheduled.room!.threadId, scheduled.team2!.captainId);
      const before = await h.service.startMatch(tid, scheduled.id, scheduled.room!.threadId, 'referee', false);
      const bracketIds = h.tournaments.matches(tid).map(m => [m.id, m.engineMatchId]);
      db.close();
      db = createDatabase(file);
      const freshGateway = new FakeGateway();
      const restored = makeHarness(db, freshGateway);
      restored.service.validatePersistedState(tid);
      expect(restored.matches.tournamentStatus(tid)).toBe('in_progress');
      expect(restored.service.bySelector(tid, 1, 1)).toEqual(before);
      expect(restored.tournaments.matches(tid).map(m => [m.id, m.engineMatchId])).toEqual(bracketIds);
      expect((await restored.service.createRooms(tid, 'hub', 'staff', true)).created).toBe(0);
      expect(freshGateway.created).toHaveLength(0);
      expect(freshGateway.sent).toHaveLength(0);
    } finally { db.close(); fs.rmSync(dir, { recursive: true, force: true }); }
  });
});
