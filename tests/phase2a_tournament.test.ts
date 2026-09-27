import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createDatabase, initializeSchema } from '../src/database/Database.js';
import { TeamRepository } from '../src/registration/TeamRepository.js';
import { TournamentRepository } from '../src/tournament/TournamentRepository.js';
import { TournamentService, TournamentError } from '../src/tournament/TournamentService.js';
import { TournamentOrganizerAdapter } from '../src/tournament/TournamentOrganizerAdapter.js';
import { TournamentUI } from '../src/bot/ui/TournamentUI.js';
import { RegistrationUI } from '../src/bot/ui/RegistrationUI.js';
import { umaCommand } from '../src/bot/commands/umaCommand.js';
import { TournamentHandler } from '../src/bot/handlers/TournamentHandler.js';

const tournamentId = 'phase2a-test';
type Db = ReturnType<typeof createDatabase>;

function register(teams: TeamRepository, index: number) {
  const result = teams.registerTeam({
    tournamentId, name: `UMA Team ${index}`, abbreviation: `T${index}`,
    captainDiscordId: `captain-${index}`, captainContact: 'private-test-contact',
    starters: Array.from({ length: 5 }, (_, player) => ({
      ingameName: `Player ${index}-${player}`, gameUid: `uid-${index}-${player}`,
      isSubstitute: false, slotNumber: player + 1
    })), substitutes: []
  });
  expect(result.success).toBe(true);
  return result.team!;
}

function approve(teams: TeamRepository, index: number) {
  const team = register(teams, index);
  expect(teams.approveTeam(team.id, 'staff').success).toBe(true);
  return team;
}

function setup(db: Db) {
  const teams = new TeamRepository(db);
  teams.ensureTournament(tournamentId, 'UMA Cup Test', 16);
  const repo = new TournamentRepository(db);
  const service = new TournamentService(repo);
  return { teams, repo, service };
}

function readyField(service: TournamentService, teams: TeamRepository, count: number) {
  const entries = Array.from({ length: count }, (_, i) => approve(teams, i + 1));
  service.openCheckin(tournamentId);
  entries.forEach(team => service.checkIn(tournamentId, team.id, team.captainDiscordId));
  return entries;
}

describe('Phase 2A state, check-in and draw', () => {
  let db: Db;
  let teams: TeamRepository;
  let repo: TournamentRepository;
  let service: TournamentService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    ({ teams, repo, service } = setup(db));
  });
  afterEach(() => db.close());

  it('opens check-in only after every active registration has a final decision', () => {
    approve(teams, 1); approve(teams, 2);
    const pending = register(teams, 3);
    expect(() => service.openCheckin(tournamentId)).toThrowError(TournamentError);
    expect(service.summary(tournamentId).status).toBe('registration_open');
    expect(teams.requestCorrection(pending.id, 'staff', 'Please correct').success).toBe(true);
    expect(() => service.openCheckin(tournamentId)).toThrowError(TournamentError);
    expect(teams.rejectTeam(pending.id, 'staff', 'reason').success).toBe(false);
    expect(teams.resubmitCorrectedTeam({ teamId: pending.id, tournamentId, captainDiscordId: pending.captainDiscordId,
      name: pending.name, abbreviation: pending.abbreviation, captainContact: pending.captainContact,
      starters: pending.players!.map(p => ({ ingameName: p.ingameName, gameUid: p.gameUid, isSubstitute: false, slotNumber: p.slotNumber })), substitutes: [] }).success).toBe(true);
    expect(teams.rejectTeam(pending.id, 'staff', 'final decision').success).toBe(true);
    expect(service.openCheckin(tournamentId).status).toBe('checkin_open');
    expect(() => service.openCheckin(tournamentId)).toThrowError(TournamentError);
  });

  it('requires at least two approved teams before lock', () => {
    approve(teams, 1);
    expect(() => service.openCheckin(tournamentId)).toThrowError(TournamentError);
  });

  it('enforces valid status values and forward-only transitions in SQLite', () => {
    expect(() => db.prepare("UPDATE tournaments SET status = 'bracket_ready' WHERE id = ?").run(tournamentId)).toThrow();
    expect(() => db.prepare("UPDATE tournaments SET status = 'completed' WHERE id = ?").run(tournamentId)).toThrow();
    approve(teams, 1); approve(teams, 2);
    service.openCheckin(tournamentId);
    expect(() => db.prepare("UPDATE tournaments SET status = 'registration_open' WHERE id = ?").run(tournamentId)).toThrow();
    expect(() => db.prepare("UPDATE tournaments SET status = 'in_progress' WHERE id = ?").run(tournamentId)).toThrow();
  });

  it('blocks registration and stale correction resubmission at domain level after lock', () => {
    approve(teams, 1); approve(teams, 2);
    service.openCheckin(tournamentId);
    const registration = teams.registerTeam({ tournamentId, name: 'New Team', abbreviation: 'NEW',
      captainDiscordId: 'new-captain', captainContact: 'private',
      starters: Array.from({ length: 5 }, (_, i) => ({ ingameName: `P${i}`, gameUid: `new-${i}`, isSubstitute: false, slotNumber: i + 1 })), substitutes: [] });
    expect(registration.code).toBe('REGISTRATION_CLOSED');
    const team = teams.listTeams(tournamentId, 'APPROVED')[0];
    db.prepare("UPDATE teams SET status = 'NEEDS_CORRECTION' WHERE id = ?").run(team.id);
    const edit = teams.resubmitCorrectedTeam({ teamId: team.id, tournamentId,
      captainDiscordId: team.captainDiscordId, name: team.name, abbreviation: team.abbreviation,
      captainContact: team.captainContact, starters: team.players!.map(p => ({ ingameName: p.ingameName,
        gameUid: p.gameUid, isSubstitute: false, slotNumber: p.slotNumber })), substitutes: [] });
    expect(edit.code).toBe('REGISTRATION_CLOSED');
  });

  it('permits only the approved captain and makes repeated check-in idempotent', () => {
    const first = approve(teams, 1); approve(teams, 2);
    const rejected = register(teams, 3);
    expect(teams.rejectTeam(rejected.id, 'staff', 'ineligible').success).toBe(true);
    service.openCheckin(tournamentId);
    expect(() => service.checkIn(tournamentId, first.id, 'stranger')).toThrowError(TournamentError);
    expect(() => service.checkIn(tournamentId, rejected.id, rejected.captainDiscordId)).toThrowError(TournamentError);
    expect(service.checkIn(tournamentId, first.id, first.captainDiscordId).repeated).toBe(false);
    expect(service.checkIn(tournamentId, first.id, first.captainDiscordId).repeated).toBe(true);
    expect(service.summary(tournamentId).checkedIn).toBe(1);
    expect(db.prepare('SELECT COUNT(*) AS n FROM team_checkins').get()).toMatchObject({ n: 1 });
  });

  it('rejects check-in before opening and across tournaments', () => {
    const team = approve(teams, 1); approve(teams, 2);
    expect(() => service.checkIn(tournamentId, team.id, team.captainDiscordId)).toThrowError(TournamentError);
    service.openCheckin(tournamentId);
    teams.ensureTournament('other-tournament', 'Other', 16);
    expect(() => service.checkIn('other-tournament', team.id, team.captainDiscordId)).toThrowError(TournamentError);
    expect(repo.checkedIn(tournamentId, team.id)).toBe(false);
  });

  it('requires two eligible check-ins and excludes approved teams without check-in', () => {
    const first = approve(teams, 1); const second = approve(teams, 2); approve(teams, 3);
    service.openCheckin(tournamentId);
    service.checkIn(tournamentId, first.id, first.captainDiscordId);
    expect(() => service.draw(tournamentId, 'staff')).toThrowError(TournamentError);
    service.checkIn(tournamentId, second.id, second.captainDiscordId);
    const draw = service.draw(tournamentId, 'staff');
    expect(draw.seeds.map(seed => seed.teamId).sort()).toEqual([first.id, second.id].sort());
    expect(draw.eligibleCount).toBe(2);
    expect(() => service.checkIn(tournamentId, first.id, first.captainDiscordId)).toThrowError(TournamentError);
  });

  it('never redraws a persisted bracket', () => {
    readyField(service, teams, 10);
    const first = service.draw(tournamentId, 'staff');
    expect(() => service.draw(tournamentId, 'staff')).toThrowError(TournamentError);
    expect(service.restoreBracket(tournamentId)?.seeds).toEqual(first.seeds);
    expect(service.restoreBracket(tournamentId)?.matches).toEqual(first.matches);
  });

  it('rolls back seeds, bracket and status if a match insert fails midway', () => {
    readyField(service, teams, 4);
    db.exec(`CREATE TRIGGER fail_second_match BEFORE INSERT ON tournament_matches
      WHEN NEW.match_number = 2 BEGIN SELECT RAISE(ABORT, 'simulated failure'); END;`);
    expect(() => service.draw(tournamentId, 'staff')).toThrow();
    expect(service.summary(tournamentId).status).toBe('checkin_open');
    expect(repo.seeds(tournamentId)).toHaveLength(0);
    expect(repo.bracketState(tournamentId)).toBeNull();
    expect(repo.matches(tournamentId)).toHaveLength(0);
  });

  it.each([2, 10, 15, 16])('uses the real adapter for a %i-team bracket', count => {
    readyField(service, teams, count);
    const draw = service.draw(tournamentId, 'staff');
    expect(draw.seeds).toHaveLength(count);
    expect(draw.seeds.map(seed => seed.seed)).toEqual(Array.from({ length: count }, (_, i) => i + 1));
    expect(new Set(draw.seeds.map(seed => seed.teamId)).size).toBe(count);
    expect(draw.bracket.matches).toHaveLength(count - 1);
    expect(draw.matches).toHaveLength(count - 1);
    expect(draw.byes).toHaveLength(2 ** Math.ceil(Math.log2(count)) - count);
    expect(service.summary(tournamentId).status).toBe('bracket_ready');
    expect(service.summary(tournamentId).bracketReady).toBe(true);
    if (count === 15) {
      expect(draw.bracket.totalRounds).toBe(4);
      expect(draw.bracket.matches.filter(m => m.round === 1)).toHaveLength(7);
      expect(draw.byes).toHaveLength(1);
      expect(draw.matches.every(match => !match.isBye)).toBe(true);
      const publicText = TournamentUI.bracketEmbeds(draw).map(embed => embed.toJSON().description).join('\n');
      expect(publicText).toContain('BYE 1');
      expect(publicText).not.toContain('private-test-contact');
      expect(publicText).not.toContain('uid-');
    }
  });

  it('serializes every new command, bracket embed and phase-aware registration panel', () => {
    const names = (umaCommand.toJSON().options ?? []).map(option => option.name);
    expect(names).toEqual(expect.arrayContaining(['checkin-open', 'check-in', 'checkins', 'draw', 'bracket']));
    readyField(service, teams, 16);
    const draw = service.draw(tournamentId, 'staff');
    const embeds = TournamentUI.bracketEmbeds(draw);
    expect(embeds.length).toBeLessThanOrEqual(10);
    for (const embed of [...embeds, TournamentUI.drawEmbed(draw), TournamentUI.checkinsEmbed(service.summary(tournamentId), [], [])]) {
      const json = embed.toJSON();
      expect(json.description!.length).toBeLessThanOrEqual(4096);
      expect(json.title!.length).toBeLessThanOrEqual(256);
    }
    expect(RegistrationUI.createRegistrationPanelEmbed(16, 16, 0, 16, 'bracket_ready').toJSON().description).toContain('ĐÃ BỐC THĂM');
    expect(RegistrationUI.createRegistrationPanelButtons('checkin_open').toJSON().components[0].disabled).toBe(true);
    expect(RegistrationUI.createMyTeamButtons(teams.listTeams(tournamentId)[0], 'checkin_open')).toBeNull();
  });

  it('denies non-staff check-in opening and draw before changing tournament state', async () => {
    const handler = new TournamentHandler(service, teams);
    for (const subcommand of ['checkin-open', 'draw']) {
      const reply = vi.fn();
      await handler.handleSlashCommand({
        options: { getSubcommand: () => subcommand },
        inGuild: () => true,
        member: { permissions: { has: () => false }, roles: { cache: new Map() } },
        reply
      } as any);
      expect(reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Chỉ Ban Tổ Chức') }));
    }
    expect(service.summary(tournamentId).status).toBe('registration_open');
  });
});

describe('Phase 2A restart persistence and additive migration', () => {
  it('reopens a Phase 1 SQLite file with stable seeds, match IDs, rounds and BYEs', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uma-phase2a-'));
    const file = path.join(dir, 'tournament.sqlite');
    let db = createDatabase(file);
    try {
      const { teams, service } = setup(db);
      readyField(service, teams, 15);
      const original = service.draw(tournamentId, 'staff');
      db.close();
      db = createDatabase(file);
      const restored = new TournamentService(new TournamentRepository(db)).restoreBracket(tournamentId)!;
      expect(restored.seeds).toEqual(original.seeds);
      expect(restored.matches).toEqual(original.matches);
      expect(restored.byes).toEqual(original.byes);
      expect(restored.bracket.matches.map(match => [match.id, match.round, match.matchNumber]))
        .toEqual(original.bracket.matches.map(match => [match.id, match.round, match.matchNumber]));
      expect(restored.bracket.matches).toHaveLength(14);
      expect(restored.byes).toHaveLength(1);
      expect(() => new TournamentService(new TournamentRepository(db)).draw(tournamentId, 'staff')).toThrowError(TournamentError);
    } finally {
      db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('adds Phase 2 tables without changing existing Phase 1 rows', () => {
    const db = new DatabaseSync(':memory:');
    try {
      db.exec(`PRAGMA foreign_keys = ON;
        CREATE TABLE tournaments (id TEXT PRIMARY KEY, name TEXT NOT NULL, game TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'registration_open', max_teams INTEGER NOT NULL, created_at INTEGER NOT NULL);
        CREATE TABLE teams (id TEXT PRIMARY KEY, tournament_id TEXT NOT NULL REFERENCES tournaments(id),
          name TEXT NOT NULL, abbreviation TEXT NOT NULL, captain_discord_id TEXT NOT NULL,
          captain_contact TEXT NOT NULL, status TEXT NOT NULL, rejection_reason TEXT,
          btc_review_message_id TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
        INSERT INTO tournaments VALUES ('legacy', 'Legacy cup', 'Liên Quân Mobile', 'registration_open', 16, 1);
        INSERT INTO teams VALUES ('legacy-team', 'legacy', 'Legacy Team', 'LEG', 'captain', 'private', 'APPROVED', NULL, NULL, 1, 1);`);
      initializeSchema(db);
      expect((db.prepare("SELECT name FROM teams WHERE id = 'legacy-team'").get() as any).name).toBe('Legacy Team');
      expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'team_checkins'").get()).toBeTruthy();
      initializeSchema(db);
      expect(db.prepare("SELECT COUNT(*) AS count FROM teams WHERE tournament_id = 'legacy'").get()).toMatchObject({ count: 1 });
    } finally { db.close(); }
  });
});
