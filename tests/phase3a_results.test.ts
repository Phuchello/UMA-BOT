import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createDatabase } from '../src/database/Database.js';
import { TeamRepository } from '../src/registration/TeamRepository.js';
import { TournamentRepository } from '../src/tournament/TournamentRepository.js';
import { TournamentService } from '../src/tournament/TournamentService.js';
import { TournamentOrganizerAdapter } from '../src/tournament/TournamentOrganizerAdapter.js';
import { MatchRepository, type MatchRecord } from '../src/match/MatchRepository.js';
import { MatchService } from '../src/match/MatchService.js';
import type { MatchRoomGateway } from '../src/match/MatchRoomGateway.js';
import { ResultRepository, type ResultSubmission } from '../src/result/ResultRepository.js';
import { ResultService, validBo3 } from '../src/result/ResultService.js';
import type { EvidenceGateway, EvidenceInput, ArchivedEvidence } from '../src/result/EvidenceGateway.js';
import { ResultUI } from '../src/bot/ui/ResultUI.js';
import { MatchUI } from '../src/bot/ui/MatchUI.js';
import { umaCommand } from '../src/bot/commands/umaCommand.js';
import { DiscordEvidenceGateway } from '../src/bot/DiscordEvidenceGateway.js';
import { ChannelType } from 'discord.js';
import { getConfig } from '../src/config/env.js';

const tid = 'phase3a-test';
const now = Date.UTC(2026, 9, 1);
const image: EvidenceInput = { url: 'https://cdn.discordapp.com/attachments/example.png', filename: 'score.png', contentType: 'image/png', size: 123 };
type Db = ReturnType<typeof createDatabase>;

class FakeRooms implements MatchRoomGateway {
  created: string[] = [];
  async createPrivateThread(_parent: string, name: string) { this.created.push(name); return `thread-${this.created.length}`; }
  async addMember(_thread: string, _user: string) {}
  async sendStarterMessage(_thread: string, _match: MatchRecord) { return 'starter'; }
  async editStarterMessage(_thread: string, _message: string, _match: MatchRecord) {}
  async fetchThread(_thread: string) { return true; }
  async deleteThread(_thread: string) {}
}
class FakeEvidence implements EvidenceGateway {
  archived: string[] = []; deleted: string[] = []; edited: string[] = []; starters: string[] = [];
  failArchive = false; failEdit = false; failDelete = false;
  async archiveEvidence(_match: MatchRecord, submission: ResultSubmission, input: EvidenceInput): Promise<ArchivedEvidence> {
    if (this.failArchive) throw new Error('Discord upload failed');
    const messageId = `evidence-${this.archived.length + 1}`;
    this.archived.push(messageId);
    return { messageId, attachmentId: `attachment-${this.archived.length}`, filename: input.filename,
      contentType: input.contentType!, size: input.size };
  }
  async editEvidenceCard(_match: MatchRecord, submission: ResultSubmission) {
    if (this.failEdit) throw new Error('Discord card edit failed');
    this.edited.push(submission.status);
  }
  async editMatchStarter(match: MatchRecord) {
    if (this.failEdit) throw new Error('Discord starter edit failed');
    this.starters.push(match.status);
  }
  async deleteEvidenceMessage(_thread: string, messageId: string) {
    if (this.failDelete) throw new Error('Discord delete failed');
    this.deleted.push(messageId);
  }
}
function harness(db: Db, evidence = new FakeEvidence(), rooms = new FakeRooms()) {
  const teams = new TeamRepository(db); teams.ensureTournament(tid, 'UMA Result Test', 16);
  const tournamentRepo = new TournamentRepository(db);
  const tournaments = new TournamentService(tournamentRepo);
  const matchRepo = new MatchRepository(db);
  const matches = new MatchService(matchRepo, tournamentRepo, tournaments, rooms, () => now);
  const resultRepo = new ResultRepository(db);
  const results = new ResultService(resultRepo, matchRepo, evidence, undefined, () => now);
  return { teams, tournamentRepo, tournaments, matchRepo, matches, resultRepo, results, evidence, rooms };
}
type Harness = ReturnType<typeof harness>;
function draw(h: Harness, count: number) {
  for (let n = 1; n <= count; n++) {
    const registered = h.teams.registerTeam({ tournamentId: tid, name: `UMA Team ${n}`, abbreviation: `T${n}`,
      captainDiscordId: `captain-${n}`, captainContact: 'PRIVATE-CONTACT',
      starters: Array.from({ length: 5 }, (_, i) => ({ ingameName: `P${n}-${i}`, gameUid: `uid-${n}-${i}`,
        isSubstitute: false, slotNumber: i + 1 })), substitutes: [] });
    expect(registered.success).toBe(true);
    expect(h.teams.approveTeam(registered.team!.id, 'staff').success).toBe(true);
  }
  h.tournaments.openCheckin(tid);
  const approved = h.tournamentRepo.summary(tid);
  expect(approved?.approved).toBe(count);
  const rows = h.teams.listTeams(tid);
  for (const team of rows) h.tournaments.checkIn(tid, team.id, team.captainDiscordId);
  h.tournaments.draw(tid, 'staff');
  h.matches.startTournament(tid, 'staff', true);
}
async function live(h: Harness, round: number, number: number) {
  await h.matches.assignReferee(tid, round, number, 'referee', 'staff', true);
  await h.matches.createRooms(tid, 'hub', 'staff', true);
  const match = await h.matches.schedule(tid, round, number, '2026-10-05 19:30', 'staff', true);
  await h.matches.confirmReady(tid, match.id, match.room!.threadId, match.team1!.captainId);
  await h.matches.confirmReady(tid, match.id, match.room!.threadId, match.team2!.captainId);
  return h.matches.startMatch(tid, match.id, match.room!.threadId, 'referee', false);
}
async function submit(h: Harness, match: MatchRecord, actor = match.team1!.captainId, my = 2, opponent = 0) {
  return h.results.submit(tid, match.room!.threadId, actor, my, opponent, image);
}
async function approve(h: Harness, match: MatchRecord, score1 = 2, score2 = 0) {
  const submission = await h.results.submit(tid, match.room!.threadId, match.team1!.captainId, score1, score2, image);
  return h.results.approve(tid, match.room!.threadId, submission.id, 'referee', false);
}

describe('Phase 3A scores, evidence and authority', () => {
  it.each([[2,0],[2,1],[0,2],[1,2]])('accepts BO3 %i–%i', (a, b) => expect(validBo3(a, b)).toBe(true));
  it.each([[0,0],[1,0],[1,1],[2,2],[3,0],[-1,2],[1.5,2]])('rejects invalid BO3 %i–%i', (a, b) => expect(validBo3(a, b)).toBe(false));

  it('keeps submission and opponent confirmation non-authoritative until referee approval', async () => {
    const db = createDatabase(':memory:');
    const engineReport = vi.spyOn(TournamentOrganizerAdapter.prototype, 'reportResult');
    try {
      const h = harness(db); draw(h, 2); const match = await live(h, 1, 1);
      const baseline = h.resultRepo.bracket(tid)!;
      const submission = await submit(h, match, match.team2!.captainId, 0, 2);
      expect([submission.team1Score, submission.team2Score]).toEqual([2, 0]);
      expect(submission.evidenceMessageId).toBe('evidence-1');
      expect(h.resultRepo.open(match.id)?.status).toBe('PENDING');
      await expect(submit(h, match)).rejects.toMatchObject({ code: 'OPEN_SUBMISSION' });
      await expect(h.results.confirm(tid, match.room!.threadId, submission.id, match.team2!.captainId))
        .rejects.toMatchObject({ code: 'NOT_OPPONENT' });
      await h.results.confirm(tid, match.room!.threadId, submission.id, match.team1!.captainId);
      expect((await h.results.confirm(tid, match.room!.threadId, submission.id, match.team1!.captainId)).status).toBe('CONFIRMED');
      expect(() => db.prepare("UPDATE match_result_submissions SET status = 'PENDING' WHERE id = ?")
        .run(submission.id)).toThrow();
      expect(h.resultRepo.bracket(tid)).toEqual(baseline);
      expect(h.resultRepo.canonical(match.id)).toBeNull();
      expect(engineReport).not.toHaveBeenCalled();
      await expect(h.results.approve(tid, match.room!.threadId, submission.id, 'stranger', false))
        .rejects.toMatchObject({ code: 'NOT_REFEREE' });
      const canonical = await h.results.approve(tid, match.room!.threadId, submission.id, 'referee', false);
      expect(engineReport).toHaveBeenCalledTimes(1);
      expect(canonical.winnerTeamId).toBe(match.team1!.id);
      expect(h.resultRepo.bracket(tid)!.version).toBe(baseline.version + 1);
      expect(h.matches.bySelector(tid, 1, 1).status).toBe('COMPLETED');
      expect(h.resultRepo.tournamentStatus(tid)).toBe('completed');
      expect(h.resultRepo.outcome(tid)?.championTeamId).toBe(match.team1!.id);
      await expect(h.results.approve(tid, match.room!.threadId, submission.id, 'referee', false))
        .rejects.toMatchObject({ code: 'INVALID_PHASE' });
      h.results.validatePersistedState(tid);
      expect(h.evidence.archived).toHaveLength(1);
    } finally { engineReport.mockRestore(); db.close(); }
  });

  it('rejects invalid submissions, unrelated users, wrong room and bad evidence', async () => {
    const db = createDatabase(':memory:');
    try {
      const h = harness(db); draw(h, 2); const match = await live(h, 1, 1);
      await expect(h.results.submit(tid, match.room!.threadId, 'stranger', 2, 0, image)).rejects.toMatchObject({ code: 'NOT_CAPTAIN' });
      await expect(h.results.submit(tid, 'wrong-thread', match.team1!.captainId, 2, 0, image)).rejects.toMatchObject({ code: 'WRONG_ROOM' });
      await expect(h.results.submit(tid, match.room!.threadId, match.team1!.captainId, 1, 0, image)).rejects.toMatchObject({ code: 'INVALID_SCORE' });
      for (const bad of [{ ...image, contentType: 'application/pdf' }, { ...image, size: 11 * 1024 * 1024 }]) {
        await expect(h.results.submit(tid, match.room!.threadId, match.team1!.captainId, 2, 0, bad))
          .rejects.toMatchObject({ code: 'INVALID_EVIDENCE' });
      }
      expect(h.evidence.archived).toHaveLength(0);
    } finally { db.close(); }
  });

  it('persists dispute, requires adjudication, permits rejection and resubmission', async () => {
    const db = createDatabase(':memory:');
    try {
      const h = harness(db); draw(h, 2); const match = await live(h, 1, 1);
      const baseline = h.resultRepo.bracket(tid)!;
      const first = await submit(h, match);
      await expect(h.results.dispute(tid, match.room!.threadId, first.id, match.team1!.captainId, 'wrong score'))
        .rejects.toMatchObject({ code: 'NOT_OPPONENT' });
      await expect(h.results.dispute(tid, match.room!.threadId, first.id, match.team2!.captainId, ' '))
        .rejects.toMatchObject({ code: 'INVALID_REASON' });
      expect((await h.results.dispute(tid, match.room!.threadId, first.id, match.team2!.captainId, 'wrong score')).disputeReason).toBe('wrong score');
      await expect(h.results.approve(tid, match.room!.threadId, first.id, 'referee', false))
        .rejects.toMatchObject({ code: 'INVALID_STATE' });
      expect(h.resultRepo.bracket(tid)).toEqual(baseline);
      await expect(h.results.reject(tid, match.room!.threadId, first.id, 'stranger', false, 'retry please'))
        .rejects.toMatchObject({ code: 'NOT_REFEREE' });
      await h.results.reject(tid, match.room!.threadId, first.id, 'staff', true, 'retry please');
      expect(h.resultRepo.submission(first.id)?.rejectionReason).toBe('retry please');
      expect(h.matches.bySelector(tid, 1, 1).status).toBe('LIVE');
      expect(h.resultRepo.bracket(tid)).toEqual(baseline);
      const second = await submit(h, match, match.team2!.captainId, 1, 2);
      expect(second.id).not.toBe(first.id);
      await h.results.dispute(tid, match.room!.threadId, second.id, match.team1!.captainId, 'screenshot unclear');
      const result = await h.results.resolve(tid, match.room!.threadId, 'referee', false, 0, 2, 'verified replay');
      expect([result.team1Score, result.team2Score]).toEqual([0, 2]);
      expect(result.resolutionReason).toBe('verified replay');
      expect(h.resultRepo.submission(second.id)?.status).toBe('APPROVED');
      expect(h.evidence.edited.slice(-2)).toEqual(['REJECTED', 'APPROVED']);
    } finally { db.close(); }
  });

  it('reconciles a three-team BYE final without changing final IDs', async () => {
    const db = createDatabase(':memory:');
    try {
      const h = harness(db); draw(h, 3);
      expect(h.tournamentRepo.byes(tid)).toHaveLength(1);
      const before = h.matches.bySelector(tid, 2, 1);
      expect(before.status).toBe('WAITING');
      const known = before.team1?.id ?? before.team2?.id;
      const opening = await live(h, 1, 1);
      const canonical = await approve(h, opening);
      const after = h.matches.bySelector(tid, 2, 1);
      expect([after.id, after.engineMatchId]).toEqual([before.id, before.engineMatchId]);
      expect(after.status).toBe('READY');
      expect([after.team1?.id, after.team2?.id]).toContain(known);
      expect([after.team1?.id, after.team2?.id]).toContain(canonical.winnerTeamId);
      expect(h.tournamentRepo.byes(tid)).toHaveLength(1);
    } finally { db.close(); }
  });

  it('advances two four-team semifinals while preserving the final application identity', async () => {
    const db = createDatabase(':memory:');
    try {
      const h = harness(db); draw(h, 4);
      const final = h.matches.bySelector(tid, 2, 1);
      const first = await live(h, 1, 1);
      await approve(h, first);
      const partial = h.matches.bySelector(tid, 2, 1);
      expect(partial.status).toBe('WAITING');
      expect([partial.team1, partial.team2].filter(Boolean)).toHaveLength(1);
      const second = await live(h, 1, 2);
      await approve(h, second);
      const ready = h.matches.bySelector(tid, 2, 1);
      expect(ready.status).toBe('READY');
      expect([ready.id, ready.engineMatchId]).toEqual([final.id, final.engineMatchId]);
      expect(ready.team1?.id).toBeTruthy(); expect(ready.team2?.id).toBeTruthy();
      expect(h.resultRepo.bracket(tid)?.version).toBe(3);
      const championship = await live(h, 2, 1);
      await approve(h, championship);
      expect(h.resultRepo.tournamentStatus(tid)).toBe('completed');
      expect(h.resultRepo.outcome(tid)?.finalMatchId).toBe(final.id);
      expect(h.resultRepo.bracket(tid)?.version).toBe(4);
      h.results.validatePersistedState(tid);
    } finally { db.close(); }
  });

  it('compensates evidence on persistence failure and never creates a false submission', async () => {
    const db = createDatabase(':memory:');
    try {
      const h = harness(db); draw(h, 2); const match = await live(h, 1, 1);
      db.exec("CREATE TRIGGER fail_submission BEFORE INSERT ON match_result_submissions BEGIN SELECT RAISE(ABORT, 'injected'); END;");
      await expect(submit(h, match)).rejects.toThrow();
      expect(h.evidence.deleted).toEqual(['evidence-1']);
      expect(h.resultRepo.open(match.id)).toBeNull();
      h.evidence.failArchive = true;
      await expect(submit(h, match)).rejects.toThrow('Discord upload failed');
      expect(h.evidence.archived).toHaveLength(1);
    } finally { db.close(); }
  });

  it('rolls back engine, version, match and downstream state when canonical insert fails', async () => {
    const db = createDatabase(':memory:');
    try {
      const h = harness(db); draw(h, 4); const match = await live(h, 1, 1); const submission = await submit(h, match);
      const bracket = h.resultRepo.bracket(tid)!; const final = h.matches.bySelector(tid, 2, 1);
      db.exec("CREATE TRIGGER fail_result BEFORE INSERT ON match_results BEGIN SELECT RAISE(ABORT, 'injected'); END;");
      await expect(h.results.approve(tid, match.room!.threadId, submission.id, 'referee', false)).rejects.toThrow();
      expect(h.resultRepo.bracket(tid)).toEqual(bracket);
      expect(h.matches.bySelector(tid, 1, 1).status).toBe('LIVE');
      expect(h.matches.bySelector(tid, 2, 1)).toEqual(final);
      expect(h.resultRepo.canonical(match.id)).toBeNull();
    } finally { db.close(); }
  });

  it('rolls back a final approval if outcome persistence fails after bracket update', async () => {
    const db = createDatabase(':memory:');
    try {
      const h = harness(db); draw(h, 2); const match = await live(h, 1, 1); const submission = await submit(h, match);
      const bracket = h.resultRepo.bracket(tid)!;
      db.exec("CREATE TRIGGER fail_outcome BEFORE INSERT ON tournament_outcomes BEGIN SELECT RAISE(ABORT, 'injected'); END;");
      await expect(h.results.approve(tid, match.room!.threadId, submission.id, 'referee', false)).rejects.toThrow();
      expect(h.resultRepo.bracket(tid)).toEqual(bracket);
      expect(h.matches.bySelector(tid, 1, 1).status).toBe('LIVE');
      expect(h.resultRepo.canonical(match.id)).toBeNull();
      expect(h.resultRepo.submission(submission.id)?.status).toBe('PENDING');
      expect(h.resultRepo.outcome(tid)).toBeNull();
      expect(h.resultRepo.tournamentStatus(tid)).toBe('in_progress');
    } finally { db.close(); }
  });

  it('keeps approved state on card failure and repairs it with staff refresh', async () => {
    const db = createDatabase(':memory:');
    try {
      const h = harness(db); draw(h, 2); const match = await live(h, 1, 1); const submission = await submit(h, match);
      h.evidence.failEdit = true;
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        await expect(h.results.approve(tid, match.room!.threadId, submission.id, 'referee', false))
          .rejects.toMatchObject({ code: 'CARD_REFRESH_FAILED' });
      } finally { log.mockRestore(); }
      expect(h.resultRepo.canonical(match.id)).not.toBeNull();
      expect(h.resultRepo.bracket(tid)?.version).toBe(2);
      h.evidence.failEdit = false;
      await h.results.refresh(tid, match.room!.threadId, 'staff', true);
      expect(h.evidence.edited.at(-1)).toBe('APPROVED');
      expect(h.evidence.starters.at(-1)).toBe('COMPLETED');
    } finally { db.close(); }
  });

  it('reopens completed tournament and preserves canonical results without advancement replay', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uma-phase3a-'));
    const file = path.join(dir, 'test.sqlite'); let db = createDatabase(file);
    try {
      let h = harness(db); draw(h, 2); const match = await live(h, 1, 1); await approve(h, match);
      const bracket = h.resultRepo.bracket(tid)!; const canonical = h.resultRepo.canonical(match.id)!;
      db.close(); db = createDatabase(file); h = harness(db);
      h.matches.validatePersistedState(tid); h.results.validatePersistedState(tid);
      expect(h.resultRepo.bracket(tid)).toEqual(bracket);
      expect(h.resultRepo.canonical(match.id)).toEqual(canonical);
      expect(h.resultRepo.outcome(tid)?.championTeamId).toBe(canonical.winnerTeamId);
      expect(h.evidence.archived).toHaveLength(0);
    } finally { db.close(); fs.rmSync(dir, { recursive: true, force: true }); }
  });

  it('finishes a real three-team BYE final with the engine winner as champion', async () => {
    const db = createDatabase(':memory:');
    try {
      const h = harness(db); draw(h, 3);
      const first = await live(h, 1, 1); await approve(h, first);
      const final = await live(h, 2, 1); const result = await approve(h, final, 0, 2);
      expect(result.winnerTeamId).toBe(final.team2!.id);
      expect(h.resultRepo.outcome(tid)).toMatchObject({ championTeamId: final.team2!.id,
        runnerUpTeamId: final.team1!.id, finalMatchId: final.id });
      expect(h.tournamentRepo.byes(tid)).toHaveLength(1);
      h.results.validatePersistedState(tid);
    } finally { db.close(); }
  });

  it('reopens pending and disputed submissions with archived evidence and unchanged engine state', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uma-phase3a-open-'));
    const file = path.join(dir, 'test.sqlite'); let db = createDatabase(file);
    try {
      let h = harness(db); draw(h, 2); const match = await live(h, 1, 1); const baseline = h.resultRepo.bracket(tid)!;
      const submission = await submit(h, match);
      db.close(); db = createDatabase(file); h = harness(db);
      expect(h.resultRepo.submission(submission.id)?.status).toBe('PENDING');
      expect(h.resultRepo.submission(submission.id)?.evidenceMessageId).toBe('evidence-1');
      h.results.validatePersistedState(tid);
      await h.results.dispute(tid, match.room!.threadId, submission.id, match.team2!.captainId, 'different score');
      db.close(); db = createDatabase(file); h = harness(db);
      expect(h.resultRepo.submission(submission.id)?.status).toBe('DISPUTED');
      expect(h.resultRepo.submission(submission.id)?.disputeReason).toBe('different score');
      expect(h.resultRepo.bracket(tid)).toEqual(baseline);
      expect(h.evidence.archived).toHaveLength(0);
      h.results.validatePersistedState(tid);
    } finally { db.close(); fs.rmSync(dir, { recursive: true, force: true }); }
  });

  it('reopens after the first four-team semifinal without replaying advancement', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uma-phase3a-semi-'));
    const file = path.join(dir, 'test.sqlite'); let db = createDatabase(file);
    try {
      let h = harness(db); draw(h, 4); const match = await live(h, 1, 1); await approve(h, match);
      const final = h.matches.bySelector(tid, 2, 1); const bracket = h.resultRepo.bracket(tid)!;
      const gateway = h.evidence; const rooms = h.rooms;
      db.close(); db = createDatabase(file); h = harness(db, gateway, rooms);
      expect(h.matches.bySelector(tid, 2, 1)).toEqual(final);
      expect(h.resultRepo.bracket(tid)).toEqual(bracket);
      h.results.validatePersistedState(tid);
      const other = await live(h, 1, 2); await approve(h, other);
      expect(h.matches.bySelector(tid, 2, 1).status).toBe('READY');
      expect(h.resultRepo.bracket(tid)?.version).toBe(bracket.version + 1);
    } finally { db.close(); fs.rmSync(dir, { recursive: true, force: true }); }
  });

  it('logs failed evidence cleanup as recoverable without creating a submission', async () => {
    const db = createDatabase(':memory:');
    try {
      const h = harness(db); draw(h, 2); const match = await live(h, 1, 1);
      db.exec("CREATE TRIGGER fail_submission_cleanup BEFORE INSERT ON match_result_submissions BEGIN SELECT RAISE(ABORT, 'injected'); END;");
      h.evidence.failDelete = true;
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        await expect(submit(h, match)).rejects.toThrow();
        expect(log).toHaveBeenCalledWith(expect.stringContaining('Orphan result evidence message'), expect.anything());
      }
      finally { log.mockRestore(); }
      expect(h.resultRepo.open(match.id)).toBeNull();
    } finally { db.close(); }
  });

  it('fails startup validation on an approved submission without canonical result', async () => {
    const db = createDatabase(':memory:');
    try {
      const h = harness(db); draw(h, 2); const match = await live(h, 1, 1); const submission = await submit(h, match);
      db.prepare("UPDATE match_result_submissions SET status = 'APPROVED' WHERE id = ?").run(submission.id);
      expect(() => h.results.validatePersistedState(tid)).toThrow();
    } finally { db.close(); }
  });

  it('allows one of two simultaneous captain submissions and compensates the losing upload', async () => {
    const db = createDatabase(':memory:');
    try {
      const h = harness(db); draw(h, 2); const match = await live(h, 1, 1);
      const attempts = await Promise.allSettled([
        submit(h, match, match.team1!.captainId), submit(h, match, match.team2!.captainId)
      ]);
      expect(attempts.filter(item => item.status === 'fulfilled')).toHaveLength(1);
      expect(attempts.filter(item => item.status === 'rejected')).toHaveLength(1);
      expect(h.evidence.archived).toHaveLength(2);
      expect(h.evidence.deleted).toHaveLength(1);
      expect(h.resultRepo.open(match.id)).not.toBeNull();
      expect(h.resultRepo.bracket(tid)?.version).toBe(1);
    } finally { db.close(); }
  });

  it('serializes double approval and leaves one canonical result and one version increment', async () => {
    const db = createDatabase(':memory:');
    try {
      const h = harness(db); draw(h, 2); const match = await live(h, 1, 1); const submission = await submit(h, match);
      const attempts = await Promise.allSettled([
        h.results.approve(tid, match.room!.threadId, submission.id, 'referee', false),
        h.results.approve(tid, match.room!.threadId, submission.id, 'staff', true)
      ]);
      expect(attempts.filter(item => item.status === 'fulfilled')).toHaveLength(1);
      expect(h.resultRepo.bracket(tid)?.version).toBe(2);
      expect(h.resultRepo.allCanonical(tid)).toHaveLength(1);
      expect(h.resultRepo.outcome(tid)).not.toBeNull();
    } finally { db.close(); }
  });

  it('serializes card edits so a slow confirmation cannot overwrite approved display', async () => {
    const db = createDatabase(':memory:');
    try {
      const h = harness(db); draw(h, 2); const match = await live(h, 1, 1); const submission = await submit(h, match);
      let release!: () => void;
      const hold = new Promise<void>(resolve => { release = resolve; });
      const original = h.evidence.editEvidenceCard.bind(h.evidence);
      let first = true;
      h.evidence.editEvidenceCard = async (currentMatch, currentSubmission) => {
        if (first) { first = false; await hold; }
        await original(currentMatch, currentSubmission);
      };
      const confirming = h.results.confirm(tid, match.room!.threadId, submission.id, match.team2!.captainId);
      const approving = h.results.approve(tid, match.room!.threadId, submission.id, 'referee', false);
      release();
      await Promise.all([confirming, approving]);
      expect(h.evidence.edited.at(-1)).toBe('APPROVED');
      expect(h.evidence.starters.at(-1)).toBe('COMPLETED');
    } finally { db.close(); }
  });

  it('fails startup validation when a submission loses its archived evidence metadata', async () => {
    const db = createDatabase(':memory:');
    try {
      const h = harness(db); draw(h, 2); const match = await live(h, 1, 1); const submission = await submit(h, match);
      db.prepare('DELETE FROM result_evidence WHERE submission_id = ?').run(submission.id);
      expect(() => h.results.validatePersistedState(tid)).toThrow();
    } finally { db.close(); }
  });

  it('rejects external URLs and forged image bytes before Discord message creation', async () => {
    const db = createDatabase(':memory:');
    try {
      const h = harness(db); draw(h, 2); const match = await live(h, 1, 1);
      const draft: ResultSubmission = { id: 'draft', tournamentId: tid, matchId: match.id,
        reporterId: match.team1!.captainId, reporterTeamId: match.team1!.id, team1Score: 2, team2Score: 0,
        status: 'PENDING', submittedAt: now, evidenceMessageId: null, disputeReason: null, rejectionReason: null };
      const gateway = new DiscordEvidenceGateway({} as any);
      await expect(gateway.archiveEvidence(match, draft, { ...image, url: 'https://evil.example/screenshot.png' })).rejects.toThrow('Discord attachment CDN');
      const fetchMock = vi.fn().mockResolvedValue(new Response(new Uint8Array(123).fill(65)));
      vi.stubGlobal('fetch', fetchMock);
      try {
        await expect(gateway.archiveEvidence(match, draft, image)).rejects.toThrow('Evidence bytes');
        expect(fetchMock).toHaveBeenCalledTimes(1);
      } finally { vi.unstubAllGlobals(); }
    } finally { db.close(); }
  });

  it('reuploads image bytes and retains the archived attachment when editing its card', async () => {
    const db = createDatabase(':memory:');
    try {
      const h = harness(db); draw(h, 2); const match = await live(h, 1, 1);
      const draft: ResultSubmission = { id: 'draft', tournamentId: tid, matchId: match.id,
        reporterId: match.team1!.captainId, reporterTeamId: match.team1!.id, team1Score: 2, team2Score: 0,
        status: 'PENDING', submittedAt: now, evidenceMessageId: 'archived-message', disputeReason: null, rejectionReason: null };
      const archivedAttachment = { id: 'archived-attachment', name: 'score.png', size: 8 };
      const edit = vi.fn();
      const message = { id: 'archived-message', attachments: new Map([['archived-attachment', archivedAttachment]]), edit };
      const send = vi.fn().mockResolvedValue({ ...message, attachments: { first: () => archivedAttachment } });
      const thread = { type: ChannelType.PrivateThread, guildId: getConfig().DISCORD_GUILD_ID, isThread: () => true,
        send, messages: { fetch: vi.fn().mockResolvedValue(message) } };
      const gateway = new DiscordEvidenceGateway({ channels: { fetch: vi.fn().mockResolvedValue(thread) } } as any);
      const png = Uint8Array.from([137,80,78,71,13,10,26,10]);
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(png)));
      try {
        const archived = await gateway.archiveEvidence(match, draft, { ...image, size: png.length });
        expect(archived.messageId).toBe('archived-message');
        expect(archived.attachmentId).toBe('archived-attachment');
        expect(send).toHaveBeenCalledWith(expect.objectContaining({ files: expect.arrayContaining([expect.anything()]) }));
        await gateway.editEvidenceCard(match, draft);
        expect(edit).toHaveBeenCalledWith(expect.objectContaining({ attachments: [archivedAttachment] }));
      } finally { vi.unstubAllGlobals(); }
    } finally { db.close(); }
  });

  it('serializes result commands, cards, modals and public output within Discord limits', async () => {
    const db = createDatabase(':memory:');
    try {
      const h = harness(db); draw(h, 4); const match = await live(h, 1, 1); const submission = await submit(h, match);
      const names = (umaCommand.toJSON().options ?? []).map(option => option.name);
      expect(names).toEqual(expect.arrayContaining(['report-result', 'result-resolve', 'result-refresh', 'results']));
      expect(ResultUI.evidenceEmbed(match, submission).toJSON().title).toContain('R1-M1');
      expect(ResultUI.evidenceButtons(submission)[0].toJSON().components).toHaveLength(4);
      expect(ResultUI.reasonModal('dispute', submission.id).toJSON().title).toBeTruthy();
      expect(ResultUI.reasonModal('reject', submission.id).toJSON().title).toBeTruthy();
      expect(ResultUI.publicResults(h.matches.list(tid)).length).toBeLessThanOrEqual(10);
      expect(MatchUI.starterEmbed(match).toJSON().footer?.text).toContain('/uma report-result');
      const publicText = ResultUI.publicResults(h.matches.list(tid)).map(embed => embed.toJSON().description).join('\n');
      expect(publicText).not.toContain('PRIVATE-CONTACT');
      expect(publicText).not.toContain('evidence-');
      expect(publicText).not.toContain('uid-');
    } finally { db.close(); }
  });
});
