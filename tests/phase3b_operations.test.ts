import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createDatabase } from '../src/database/Database.js';
import { TeamRepository } from '../src/registration/TeamRepository.js';
import { TournamentRepository } from '../src/tournament/TournamentRepository.js';
import { TournamentService } from '../src/tournament/TournamentService.js';
import { MatchRepository, type MatchRecord } from '../src/match/MatchRepository.js';
import { MatchService } from '../src/match/MatchService.js';
import type { MatchRoomGateway } from '../src/match/MatchRoomGateway.js';
import { ResultRepository, type ResultSubmission } from '../src/result/ResultRepository.js';
import { ResultService } from '../src/result/ResultService.js';
import type { EvidenceGateway, EvidenceInput, ArchivedEvidence } from '../src/result/EvidenceGateway.js';
import { StreamRepository } from '../src/stream/StreamRepository.js';
import { StreamService, validateStreamUrl } from '../src/stream/StreamService.js';
import { PublicationRepository } from '../src/publication/PublicationRepository.js';
import { PublicationService } from '../src/publication/PublicationService.js';
import type { PublicAnnouncementGateway, PublicCard } from '../src/publication/PublicAnnouncementGateway.js';
import { ProductionReadinessService } from '../src/operations/ProductionReadinessService.js';
import { createSqliteBackup } from '../src/operations/backup.js';
import { installGracefulShutdown } from '../src/operations/shutdown.js';
import { parseConfig } from '../src/config/env.js';
import { umaCommand, umaCasterCommand } from '../src/bot/commands/umaCommand.js';
import { DiscordResourceProbe } from '../src/bot/DiscordResourceProbe.js';
import { DiscordPublicAnnouncementGateway } from '../src/bot/DiscordPublicAnnouncementGateway.js';
import { ResultUI } from '../src/bot/ui/ResultUI.js';
import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { DatabaseSync } from 'node:sqlite';

const tid = 'phase3b-test';
const now = Date.UTC(2026, 9, 1);
const image: EvidenceInput = { url: 'https://cdn.discordapp.com/attachments/example.png', filename: 'score.png', contentType: 'image/png', size: 123 };
type Db = ReturnType<typeof createDatabase>;
class Rooms implements MatchRoomGateway {
  count = 0;
  async createPrivateThread() { return `thread-${++this.count}`; }
  async addMember() {}
  async sendStarterMessage() { return 'starter'; }
  async editStarterMessage() {}
  async fetchThread() { return true; }
  async deleteThread() {}
}
class Evidence implements EvidenceGateway {
  count = 0;
  async archiveEvidence(_match: MatchRecord, _submission: ResultSubmission, input: EvidenceInput): Promise<ArchivedEvidence> {
    const index = ++this.count;
    return { messageId: `evidence-${index}`, attachmentId: `attachment-${index}`, filename: input.filename,
      contentType: input.contentType!, size: input.size };
  }
  async editEvidenceCard() {}
  async editMatchStarter() {}
  async deleteEvidenceMessage() {}
}
class Announcements implements PublicAnnouncementGateway {
  messages = new Map<string, PublicCard>(); created = 0; edits = 0; deleted: string[] = [];
  failSend = false; failEdit = false;
  async publishResult(_channel: string, card: PublicCard) {
    if (this.failSend) throw new Error('send failed');
    const id = `public-${++this.created}`; this.messages.set(id, card); return id;
  }
  async editResult(_channel: string, id: string, card: PublicCard) {
    if (this.failEdit) throw new Error('edit failed');
    if (!this.messages.has(id)) throw new Error('missing');
    this.edits++; this.messages.set(id, card);
  }
  async publishChampion(channel: string, card: PublicCard) { return this.publishResult(channel, card); }
  async editChampion(channel: string, id: string, card: PublicCard) { return this.editResult(channel, id, card); }
  async messageExists(_channel: string, id: string) { return this.messages.has(id); }
  async deleteMessage(_channel: string, id: string) { this.deleted.push(id); this.messages.delete(id); }
}
function harness(db: Db) {
  const teams = new TeamRepository(db); teams.ensureTournament(tid, 'UMA Result Test', 16);
  const tournamentRepo = new TournamentRepository(db); const tournaments = new TournamentService(tournamentRepo);
  const matchRepo = new MatchRepository(db); const matches = new MatchService(matchRepo, tournamentRepo, tournaments, new Rooms(), () => now);
  const resultRepo = new ResultRepository(db); const results = new ResultService(resultRepo, matchRepo, new Evidence(), undefined, () => now);
  const streamRepo = new StreamRepository(db); const streams = new StreamService(streamRepo, matchRepo, () => now);
  const pubRepo = new PublicationRepository(db); const gateway = new Announcements();
  const publication = new PublicationService(pubRepo, matchRepo, resultRepo, streamRepo, gateway, 'results-channel', () => now);
  return { teams, tournamentRepo, tournaments, matchRepo, matches, resultRepo, results, streamRepo, streams, pubRepo, gateway, publication };
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
  for (const team of h.teams.listTeams(tid)) h.tournaments.checkIn(tid, team.id, team.captainDiscordId);
  h.tournaments.draw(tid, 'staff'); h.matches.startTournament(tid, 'staff', true);
}
async function live(h: Harness, round: number, number: number) {
  await h.matches.assignReferee(tid, round, number, 'referee', 'staff', true);
  await h.matches.createRooms(tid, 'hub', 'staff', true);
  const match = await h.matches.schedule(tid, round, number, '2026-10-05 19:30', 'staff', true);
  await h.matches.confirmReady(tid, match.id, match.room!.threadId, match.team1!.captainId);
  await h.matches.confirmReady(tid, match.id, match.room!.threadId, match.team2!.captainId);
  return h.matches.startMatch(tid, match.id, match.room!.threadId, 'referee', false);
}
async function approve(h: Harness, match: MatchRecord) {
  const submission = await h.results.submit(tid, match.room!.threadId, match.team1!.captainId, 2, 0, image);
  return h.results.approve(tid, match.room!.threadId, submission.id, 'referee', false);
}
const correct = (h: Harness, round: number, number: number) => h.results.correct(tid, round, number, 1, 2,
  'Official scoreboard correction', true, 'staff', true);

describe('Phase 3B guarded correction with real tournament adapter', () => {
  it('corrects a two-team final, preserves evidence and changes the champion once', async () => {
    const db = createDatabase(':memory:'); try {
      const h = harness(db); draw(h, 2); const match = await live(h, 1, 1); await approve(h, match);
      const before = h.resultRepo.bracket(tid)!; const evidenceId = h.resultRepo.submissions(match.id)[0].evidenceMessageId;
      await expect(h.results.correct(tid, 1, 1, 1, 2, 'long enough', false, 'staff', true)).rejects.toMatchObject({ code: 'CONFIRM_REQUIRED' });
      await expect(h.results.correct(tid, 1, 1, 1, 2, 'long enough', true, 'referee', false)).rejects.toMatchObject({ code: 'NOT_STAFF' });
      await expect(h.results.correct(tid, 1, 1, 1, 2, 'short', true, 'staff', true)).rejects.toMatchObject({ code: 'INVALID_REASON' });
      await expect(h.results.correct(tid, 1, 1, 2, 2, 'Official correction', true, 'staff', true)).rejects.toMatchObject({ code: 'INVALID_SCORE' });
      const updated = await correct(h, 1, 1);
      expect([updated.team1Score,updated.team2Score,updated.revision]).toEqual([1,2,2]);
      expect(h.resultRepo.bracket(tid)!.version).toBe(before.version + 1);
      expect(h.resultRepo.outcome(tid)?.championTeamId).toBe(match.team2!.id);
      expect(h.resultRepo.outcome(tid)?.runnerUpTeamId).toBe(match.team1!.id);
      expect(h.resultRepo.tournamentStatus(tid)).toBe('completed');
      expect(h.matches.bySelector(tid,1,1).status).toBe('COMPLETED');
      expect(h.resultRepo.correctionHistory(match.id)).toHaveLength(1);
      expect(h.resultRepo.submissions(match.id)[0].evidenceMessageId).toBe(evidenceId);
      expect(ResultUI.evidenceEmbed(h.matches.bySelector(tid,1,1), h.resultRepo.submissions(match.id)[0]).toJSON().fields?.some(field => field.name === 'Hiệu chỉnh')).toBe(true);
      await expect(correct(h,1,1)).rejects.toMatchObject({ code: 'NO_CHANGE' });
      h.results.validatePersistedState(tid);
    } finally { db.close(); }
  });
  it('serializes concurrent corrections and keeps one history row', async () => {
    const db = createDatabase(':memory:'); try {
      const h = harness(db); draw(h,2); const match = await live(h,1,1); await approve(h,match);
      const version = h.resultRepo.bracket(tid)!.version;
      const outcomes = await Promise.allSettled([correct(h,1,1),correct(h,1,1)]);
      expect(outcomes.filter(item => item.status === 'fulfilled')).toHaveLength(1);
      expect(outcomes.filter(item => item.status === 'rejected')).toHaveLength(1);
      expect(h.resultRepo.bracket(tid)!.version).toBe(version+1);
      expect(h.resultRepo.correctionHistory(match.id)).toHaveLength(1);
      expect(() => db.prepare('UPDATE match_result_corrections SET reason=? WHERE match_id=?')
        .run('rewrite',match.id)).toThrow();
    } finally { db.close(); }
  });
  it('rejects a noncompleted match and a completed match without canonical result', async () => {
    const db = createDatabase(':memory:'); try {
      const h = harness(db); draw(h,2);
      await expect(correct(h,1,1)).rejects.toMatchObject({ code: 'INVALID_MATCH' });
      const match = await live(h,1,1);
      db.prepare("UPDATE tournament_matches SET status='COMPLETED' WHERE id=?").run(match.id);
      await expect(correct(h,1,1)).rejects.toMatchObject({ code: 'MISSING_CANONICAL' });
    } finally { db.close(); }
  });
  it.each([3,4])('corrects a %i-team semifinal without replacing final identity or BYE', async count => {
    const db = createDatabase(':memory:'); try {
      const h = harness(db); draw(h,count);
      const first = await live(h,1,1); await approve(h,first);
      if (count === 4) { const second = await live(h,1,2); await approve(h,second); }
      const finalBefore = h.matches.bySelector(tid,2,1); const byesBefore = h.tournamentRepo.byes(tid);
      const other = [finalBefore.team1?.id,finalBefore.team2?.id].find(id => id && id !== first.team1!.id);
      const version = h.resultRepo.bracket(tid)!.version;
      await correct(h,1,1);
      const finalAfter = h.matches.bySelector(tid,2,1);
      expect([finalAfter.id,finalAfter.engineMatchId]).toEqual([finalBefore.id,finalBefore.engineMatchId]);
      expect(finalAfter.status).toBe('READY');
      expect([finalAfter.team1?.id,finalAfter.team2?.id]).toContain(first.team2!.id);
      expect([finalAfter.team1?.id,finalAfter.team2?.id]).not.toContain(first.team1!.id);
      if (other && other !== first.team1!.id) expect([finalAfter.team1?.id,finalAfter.team2?.id]).toContain(other);
      expect(h.tournamentRepo.byes(tid)).toEqual(byesBefore);
      expect(h.resultRepo.bracket(tid)!.version).toBe(version+1);
      h.results.validatePersistedState(tid);
    } finally { db.close(); }
  });
  it('permits a later second correction after an unrelated result advances bracket version', async () => {
    const db = createDatabase(':memory:'); try {
      const h = harness(db); draw(h,4);
      const first = await live(h,1,1); await approve(h,first);
      await correct(h,1,1);
      const second = await live(h,1,2); await approve(h,second);
      const updated = await h.results.correct(tid,1,1,2,0,'Second official correction',true,'staff',true);
      expect(updated.revision).toBe(3);
      expect(h.resultRepo.correctionHistory(first.id).map(row => row.number)).toEqual([1,2]);
      expect(h.matches.bySelector(tid,2,1).status).toBe('READY');
      h.results.validatePersistedState(tid);
    } finally { db.close(); }
  });
  it.each(['referee','room','schedule','ready','start','submission','canonical','state'])
    ('locks correction when downstream has %s and leaves canonical state unchanged', async lock => {
      const db = createDatabase(':memory:'); try {
        const h = harness(db); draw(h,4);
        await approve(h,await live(h,1,1)); await approve(h,await live(h,1,2));
        const final = h.matches.bySelector(tid,2,1);
        if (lock === 'referee') db.prepare(`INSERT INTO match_referee_assignments VALUES (?,?,?,?,?)`).run(tid,final.id,'ref','staff',now);
        if (lock === 'room') db.prepare(`INSERT INTO match_rooms VALUES (?,?,?,?,?,?,?)`).run(tid,final.id,'thread-final','hub','starter','staff',now);
        if (lock === 'schedule') db.prepare(`INSERT INTO match_schedules VALUES (?,?,?,?,?)`).run(tid,final.id,now+1000,'staff',now);
        if (lock === 'ready') db.prepare(`INSERT INTO match_ready_confirmations VALUES (?,?,?,?,?)`).run(tid,final.id,final.team1!.id,final.team1!.captainId,now);
        if (lock === 'start') db.prepare(`INSERT INTO match_starts VALUES (?,?,?,?)`).run(tid,final.id,now,'staff');
        if (lock === 'state') db.prepare(`UPDATE tournament_matches SET status='ROOM_OPEN' WHERE id=?`).run(final.id);
        if (lock === 'submission') db.prepare(`INSERT INTO match_result_submissions
          (id,tournament_id,match_id,submitted_by_discord_id,submitting_team_id,team1_score,team2_score,status,submitted_at,updated_at)
          VALUES (?,?,?,?,?,?,?,'PENDING',?,?)`).run('extra',tid,final.id,'captain',final.team1!.id,2,0,now,now);
        if (lock === 'canonical') {
          db.prepare(`INSERT INTO match_result_submissions
            (id,tournament_id,match_id,submitted_by_discord_id,submitting_team_id,team1_score,team2_score,status,submitted_at,updated_at)
            VALUES (?,?,?,?,?,?,?,'APPROVED',?,?)`).run('extra',tid,final.id,'captain',final.team1!.id,2,0,now,now);
          db.prepare(`INSERT INTO match_results (match_id,tournament_id,approved_submission_id,team1_score,team2_score,winner_team_id,loser_team_id,approved_by_discord_id,approved_at)
            VALUES (?,?,?,?,?,?,?,?,?)`).run(final.id,tid,'extra',2,0,final.team1!.id,final.team2!.id,'staff',now);
        }
        const downstreamBefore = h.matches.bySelector(tid,2,1);
        const bracket = h.resultRepo.bracket(tid)!; const old = h.resultRepo.canonical(h.matches.bySelector(tid,1,1).id);
        await expect(correct(h,1,1)).rejects.toMatchObject({ code: 'CORRECTION_LOCKED' });
        expect(h.resultRepo.bracket(tid)).toEqual(bracket);
        expect(h.resultRepo.canonical(h.matches.bySelector(tid,1,1).id)).toEqual(old);
        expect(h.resultRepo.correctionHistory(h.matches.bySelector(tid,1,1).id)).toHaveLength(0);
        expect(h.matches.bySelector(tid,2,1)).toEqual(downstreamBefore);
      } finally { db.close(); }
    });
  it.each(['READY_TO_START','LIVE','COMPLETED'])('locks a semifinal when the final is %s', async state => {
    const db = createDatabase(':memory:'); try {
      const h = harness(db); draw(h,4);
      await approve(h,await live(h,1,1)); await approve(h,await live(h,1,2));
      const final = h.matches.bySelector(tid,2,1);
      await h.matches.assignReferee(tid,2,1,'referee','staff',true);
      await h.matches.createRooms(tid,'hub','staff',true);
      const scheduled = await h.matches.schedule(tid,2,1,'2026-10-05 19:30','staff',true);
      await h.matches.confirmReady(tid,final.id,scheduled.room!.threadId,scheduled.team1!.captainId);
      await h.matches.confirmReady(tid,final.id,scheduled.room!.threadId,scheduled.team2!.captainId);
      if (state !== 'READY_TO_START') {
        const started = await h.matches.startMatch(tid,final.id,scheduled.room!.threadId,'referee',false);
        if (state === 'COMPLETED') await approve(h,started);
      }
      const bracket = h.resultRepo.bracket(tid)!;
      await expect(correct(h,1,1)).rejects.toMatchObject({ code: 'CORRECTION_LOCKED' });
      expect(h.resultRepo.bracket(tid)).toEqual(bracket);
      expect(h.matches.bySelector(tid,2,1).status).toBe(state);
    } finally { db.close(); }
  });
  it('rolls back a downstream participant change if correction history insertion fails', async () => {
    const db = createDatabase(':memory:'); try {
      const h = harness(db); draw(h,4);
      const first = await live(h,1,1); await approve(h,first);
      await approve(h,await live(h,1,2));
      const downstream = h.matches.bySelector(tid,2,1);
      const bracket = h.resultRepo.bracket(tid)!;
      db.exec(`CREATE TRIGGER fail_history BEFORE INSERT ON match_result_corrections BEGIN SELECT RAISE(ABORT,'injected'); END;`);
      await expect(correct(h,1,1)).rejects.toThrow();
      expect(h.matches.bySelector(tid,2,1)).toEqual(downstream);
      expect(h.resultRepo.bracket(tid)).toEqual(bracket);
      expect(h.resultRepo.correctionHistory(first.id)).toHaveLength(0);
    } finally { db.close(); }
  });
  it.each(['history','canonical','bracket','outcome'])('rolls back all correction writes on %s failure', async target => {
    const db = createDatabase(':memory:'); try {
      const h = harness(db); draw(h,2); const match = await live(h,1,1); await approve(h,match);
      const table = { history:'match_result_corrections', canonical:'match_results', bracket:'tournament_brackets', outcome:'tournament_outcomes' }[target];
      const action = target === 'history' ? 'INSERT' : 'UPDATE';
      db.exec(`CREATE TRIGGER fail_${target} BEFORE ${action} ON ${table} BEGIN SELECT RAISE(ABORT,'injected'); END;`);
      const bracket = h.resultRepo.bracket(tid)!; const old = h.resultRepo.canonical(match.id);
      await expect(correct(h,1,1)).rejects.toThrow();
      expect(h.resultRepo.bracket(tid)).toEqual(bracket); expect(h.resultRepo.canonical(match.id)).toEqual(old);
      expect(h.resultRepo.correctionHistory(match.id)).toHaveLength(0);
    } finally { db.close(); }
  });
});

describe('Phase 3B publication and stream', () => {
  it('publishes once, recovers deletion, edits corrected result and champion without duplicates', async () => {
    const db = createDatabase(':memory:'); try {
      const h = harness(db); draw(h,2); const match = await live(h,1,1); await approve(h,match);
      expect(await h.publication.sync(tid,true)).toEqual({created:2,updated:0,unchanged:0,failed:0});
      const resultId = h.pubRepo.result(match.id)!.messageId; const championId = h.pubRepo.champion(tid)!.messageId;
      expect(await h.publication.sync(tid,true)).toEqual({created:0,updated:0,unchanged:2,failed:0});
      expect(JSON.stringify([...h.gateway.messages.values()])).not.toMatch(/PRIVATE-CONTACT|uid-|evidence-|captain-/);
      await correct(h,1,1);
      expect(await h.publication.sync(tid,true)).toEqual({created:0,updated:2,unchanged:0,failed:0});
      expect(h.pubRepo.result(match.id)!.messageId).toBe(resultId);
      expect(h.pubRepo.champion(tid)!.messageId).toBe(championId);
      h.gateway.messages.delete(resultId);
      expect(await h.publication.sync(tid,true)).toEqual({created:1,updated:0,unchanged:1,failed:0});
      expect(h.pubRepo.result(match.id)!.messageId).not.toBe(resultId);
      expect(await h.publication.sync(tid,true)).toEqual({created:0,updated:0,unchanged:2,failed:0});
    } finally { db.close(); }
  });
  it('publishes multiple results once and refreshes a VOD link without changing canonical revision', async () => {
    const db = createDatabase(':memory:'); try {
      const h = harness(db); draw(h,4);
      const first = await live(h,1,1); await approve(h,first);
      const second = await live(h,1,2); await approve(h,second);
      expect(await h.publication.sync(tid,true)).toEqual({created:2,updated:0,unchanged:0,failed:0});
      expect(await h.publication.sync(tid,true)).toEqual({created:0,updated:0,unchanged:2,failed:0});
      const revision = h.pubRepo.result(first.id)!.revision;
      h.streams.set(tid,1,1,'https://youtu.be/abc','Replay','staff',true);
      expect(await h.publication.sync(tid,true)).toEqual({created:0,updated:1,unchanged:1,failed:0});
      expect(h.pubRepo.result(first.id)!.revision).toBe(revision);
      expect(JSON.stringify(h.gateway.messages.get(h.pubRepo.result(first.id)!.messageId))).toContain('Xem lại trận');
    } finally { db.close(); }
  });
  it('retains stale revision after failed edit and compensates DB failure after send', async () => {
    const db = createDatabase(':memory:'); try {
      const h = harness(db); draw(h,2); const match = await live(h,1,1); await approve(h,match);
      h.gateway.failSend = true;
      expect((await h.publication.sync(tid,true)).failed).toBe(2);
      expect(h.pubRepo.result(match.id)).toBeNull();
      h.gateway.failSend = false; await h.publication.sync(tid,true); await correct(h,1,1);
      h.gateway.failEdit = true;
      expect((await h.publication.sync(tid,true)).failed).toBe(2);
      expect(h.pubRepo.result(match.id)!.revision).toBe(1);
      h.gateway.failEdit = false;
      expect((await h.publication.sync(tid,true)).updated).toBe(2);
      h.gateway.messages.delete(h.pubRepo.result(match.id)!.messageId);
      db.exec(`CREATE TRIGGER fail_public BEFORE UPDATE ON public_result_messages BEGIN SELECT RAISE(ABORT,'injected'); END;`);
      expect((await h.publication.sync(tid,true)).failed).toBe(1);
      expect(h.gateway.deleted).toHaveLength(1);
    } finally { db.close(); }
  });
  it.each(['https://youtube.com/watch?v=1','https://youtu.be/abc','https://twitch.tv/channel','https://facebook.com/watch/abc','https://fb.watch/a','https://tiktok.com/@caster/video/1'])
    ('accepts allowed HTTPS platform %s', url => expect(validateStreamUrl(url)).toContain('https://'));
  it.each(['http://youtube.com','https://localhost/x','https://192.168.1.1/x','https://u:p@youtube.com/x','javascript:alert(1)','data:text/plain,a','not-a-url','https://youtube.com.'+'x'.repeat(2100)])
    ('rejects unsafe URL %s', url => expect(() => validateStreamUrl(url)).toThrow());
  it('keeps a long allowed URL out of embed field limits', async () => {
    const db = createDatabase(':memory:'); try {
      const h = harness(db); draw(h,2); const match = await live(h,1,1); await approve(h,match);
      const longUrl = `https://youtube.com/${'a'.repeat(1900)}`;
      h.streams.set(tid,1,1,longUrl,null,'staff',true);
      await h.publication.sync(tid,true);
      const card = h.gateway.messages.get(h.pubRepo.result(match.id)!.messageId)!;
      expect(card.url).toBe(longUrl);
      expect(card.fields.every(field => field.value.length <= 1024)).toBe(true);
    } finally { db.close(); }
  });
  it('sets, clears and keeps casters idempotently; rejects waiting/nonstaff', () => {
    const db = createDatabase(':memory:'); try {
      const h = harness(db); draw(h,3);
      expect(() => h.streams.set(tid,2,1,'https://youtube.com/watch?v=1',null,'staff',true)).toThrow();
      expect(() => h.streams.set(tid,1,1,'https://youtube.com/watch?v=1',null,'x',false)).toThrow();
      const saved = h.streams.set(tid,1,1,'https://youtube.com/watch?v=1','UMA live','staff',true);
      expect(saved.title).toBe('UMA live');
      expect(h.streams.addCaster(tid,1,1,'100000000000000001','staff',true)).toBe(true);
      expect(h.streams.addCaster(tid,1,1,'100000000000000001','staff',true)).toBe(false);
      expect(h.streams.clear(tid,1,1,true)).toBe(true);
      expect(h.streams.view(tid,1,1).casters).toHaveLength(1);
      expect(h.streams.removeCaster(tid,1,1,'100000000000000001',true)).toBe(true);
      h.streams.validatePersistedState(tid);
    } finally { db.close(); }
  });
});

describe('Phase 3B production hardening', () => {
  it('migrates an existing Phase 3A result table to revision 1', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(),'uma-migration-'));
    const file = path.join(dir,'legacy.sqlite');
    const legacy = new DatabaseSync(file);
    legacy.exec(`CREATE TABLE match_results (
      match_id TEXT PRIMARY KEY, tournament_id TEXT NOT NULL, approved_submission_id TEXT NOT NULL UNIQUE,
      team1_score INTEGER NOT NULL, team2_score INTEGER NOT NULL, winner_team_id TEXT NOT NULL,
      loser_team_id TEXT NOT NULL, approved_by_discord_id TEXT NOT NULL, approved_at INTEGER NOT NULL,
      resolution_reason TEXT);`);
    legacy.prepare(`INSERT INTO match_results VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run('legacy-match','legacy-tournament','legacy-submission',2,0,'alpha','bravo','referee',now,null);
    legacy.close();
    try {
      const migrated = createDatabase(file);
      try { expect((migrated.prepare('PRAGMA table_info(match_results)').all() as any[])
        .some(column => column.name === 'revision')).toBe(true);
        expect(migrated.prepare('SELECT revision FROM match_results WHERE match_id=?').get('legacy-match')).toMatchObject({revision:1}); }
      finally { migrated.close(); }
    } finally { fs.rmSync(dir,{recursive:true,force:true}); }
  });
  it('validates Discord channels, cross-guild resources and missing permissions with fake clients', async () => {
    const config = parseConfig({ NODE_ENV: 'test', ACTIVE_TOURNAMENT_ID: tid });
    let badGuild = false; let denied = false; let missing = false;
    const fake = { user: {id:'bot'}, guilds: { fetch: async () => ({ id: config.DISCORD_GUILD_ID,
      roles: { fetch: async () => ({ id:'staff' }) }, members: { fetchMe: async () => ({ permissions: { has: () => false } }) } }) },
      channels: { fetch: async (id: string) => missing && id === config.RESULTS_CHANNEL_ID ? null : ({
        id, type: ChannelType.GuildText, guildId: badGuild && id === config.RESULTS_CHANNEL_ID ? 'wrong' : config.DISCORD_GUILD_ID,
        permissionsFor: () => ({has: (bit: bigint) => !denied || bit !== PermissionFlagsBits.EmbedLinks})
      }) } } as any;
    const probe = new DiscordResourceProbe(fake);
    expect((await probe.check(config)).every(check => check.level === 'PASS')).toBe(true);
    badGuild = true;
    expect((await probe.check(config)).some(check => check.level === 'FAIL')).toBe(true);
    badGuild = false; missing = true;
    expect((await probe.check(config)).some(check => check.label === 'RESULTS_CHANNEL_ID' && check.level === 'FAIL')).toBe(true);
    missing = false; denied = true;
    expect((await probe.check(config)).some(check => check.detail.includes('thiếu quyền'))).toBe(true);
    const gateway = new DiscordPublicAnnouncementGateway(fake);
    await expect(gateway.publishResult(config.RESULTS_CHANNEL_ID,{title:'x',description:'x',fields:[],footer:'x',color:1})).rejects.toThrow();
  });
  it('doctor reports database and fake resource failures without exposing secrets', async () => {
    const db = createDatabase(':memory:'); try {
      const h = harness(db); draw(h,2);
      const config = parseConfig({ NODE_ENV: 'test', ACTIVE_TOURNAMENT_ID: tid });
      const doctor = new ProductionReadinessService(db,config,h.tournamentRepo,h.tournaments,h.matches,h.results,h.publication,h.streams,
        { check: async () => [{level:'PASS',label:'Guild',detail:'OK'}] });
      const checks = await doctor.run(true);
      expect(checks.every(item => item.level === 'PASS')).toBe(true);
      expect(ProductionReadinessService.format(checks)).not.toContain(config.DISCORD_TOKEN);
      const failing = new ProductionReadinessService(db,config,h.tournamentRepo,h.tournaments,h.matches,h.results,h.publication,h.streams,
        { check: async () => [{level:'FAIL',label:'RESULTS_CHANNEL_ID',detail:'Sai guild'}] });
      expect((await failing.run(true)).some(item => item.level === 'FAIL')).toBe(true);
      await expect(failing.run(false)).rejects.toThrow();
    } finally { db.close(); }
  });
  it('creates a reopenable independent SQLite backup and refuses overwrite', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(),'uma-backup-'));
    const source = path.join(dir,'source.sqlite'); const destination = path.join(dir,'backup.sqlite');
    const db = createDatabase(source); const h = harness(db); draw(h,2);
    const match = await live(h,1,1); await approve(h,match); db.close();
    try {
      expect(createSqliteBackup(source,destination)).toBe(path.resolve(destination));
      expect(() => createSqliteBackup(source,destination)).toThrow('already exists');
      const backup = createDatabase(destination);
      try { expect(backup.prepare('SELECT COUNT(*) AS n FROM tournament_matches').get()).toMatchObject({ n: 1 });
        expect(backup.prepare('SELECT COUNT(*) AS n FROM match_results').get()).toMatchObject({ n: 1 });
        expect(backup.prepare('SELECT COUNT(*) AS n FROM tournament_outcomes').get()).toMatchObject({ n: 1 }); }
      finally { backup.close(); }
    } finally { fs.rmSync(dir,{recursive:true,force:true}); }
  });
  it('destroys client, closes DB and exits once on repeated shutdown signals', async () => {
    const listeners = new Map<string,() => void>(); let destroys=0,closes=0,exits=0;
    const host = { once: (name: 'SIGINT'|'SIGTERM', fn: () => void) => { listeners.set(name,fn); },
      off: (name: 'SIGINT'|'SIGTERM') => { listeners.delete(name); }, exit: () => { exits++; } };
    const control = installGracefulShutdown({destroy: async () => {destroys++;},removeAllListeners: () => {}},
      {close: () => {closes++;}} as any, host);
    const sig = listeners.get('SIGINT')!; sig(); sig();
    await control.stop();
    expect([destroys,closes,exits]).toEqual([1,1,1]);
  });
  it('keeps command registration within Discord option limits', () => {
    expect(umaCommand.toJSON().options).toHaveLength(25);
    expect(umaCasterCommand.toJSON().options).toHaveLength(2);
  });
});
