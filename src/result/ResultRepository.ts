import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import type { MatchRecord } from '../match/MatchRepository.js';
import type { EngineMatch } from '../tournament/TournamentEngine.js';
import type { ArchivedEvidence } from './EvidenceGateway.js';

export type SubmissionState = 'PENDING' | 'CONFIRMED' | 'DISPUTED' | 'APPROVED' | 'REJECTED';
export interface ResultSubmission {
  id: string; tournamentId: string; matchId: string; reporterId: string; reporterTeamId: string;
  team1Score: number; team2Score: number; status: SubmissionState; submittedAt: number;
  evidenceMessageId: string | null; disputeReason: string | null; rejectionReason: string | null;
}
export interface CanonicalResult {
  matchId: string; tournamentId: string; submissionId: string; team1Score: number; team2Score: number;
  winnerTeamId: string; loserTeamId: string; approvedBy: string; approvedAt: number; resolutionReason: string | null; revision: number;
}
export interface CorrectionRecord {
  id: string; tournamentId: string; matchId: string; number: number;
  oldTeam1Score: number; oldTeam2Score: number; oldWinnerTeamId: string; oldLoserTeamId: string;
  newTeam1Score: number; newTeam2Score: number; newWinnerTeamId: string; newLoserTeamId: string;
  actorId: string; reason: string; correctedAt: number; versionBefore: number; versionAfter: number;
}
export interface TournamentOutcome { championTeamId: string; runnerUpTeamId: string; finalMatchId: string }

export class ResultRepository {
  constructor(private readonly db: DatabaseSync) {}
  transaction<T>(action: () => T): T {
    this.db.exec('BEGIN IMMEDIATE TRANSACTION;');
    try { const value = action(); this.db.exec('COMMIT;'); return value; }
    catch (error) { this.db.exec('ROLLBACK;'); throw error; }
  }
  tournamentStatus(id: string): string | null {
    const row = this.db.prepare('SELECT status FROM tournaments WHERE id = ?').get(id) as any;
    return row?.status ?? null;
  }
  bracket(id: string): { state: string; version: number } | null {
    const row = this.db.prepare('SELECT engine_state, version FROM tournament_brackets WHERE tournament_id = ?').get(id) as any;
    return row ? { state: row.engine_state, version: Number(row.version) } : null;
  }
  saveBracket(id: string, previousVersion: number, state: string): void {
    const changed = this.db.prepare('UPDATE tournament_brackets SET engine_state = ?, version = version + 1 WHERE tournament_id = ? AND version = ?')
      .run(state, id, previousVersion).changes;
    if (changed !== 1) throw new Error('Bracket version changed concurrently.');
  }
  submission(id: string): ResultSubmission | null {
    const row = this.db.prepare(`SELECT s.*, e.discord_message_id, d.reason AS dispute_reason
      FROM match_result_submissions s LEFT JOIN result_evidence e ON e.submission_id = s.id
      LEFT JOIN match_result_disputes d ON d.submission_id = s.id WHERE s.id = ?`).get(id) as any;
    return row ? this.mapSubmission(row) : null;
  }
  submissions(matchId: string): ResultSubmission[] {
    const rows = this.db.prepare('SELECT id FROM match_result_submissions WHERE match_id = ? ORDER BY submitted_at, rowid')
      .all(matchId) as any[];
    return rows.map(row => this.submission(row.id)!);
  }
  open(matchId: string): ResultSubmission | null {
    const row = this.db.prepare(`SELECT s.*, e.discord_message_id, d.reason AS dispute_reason
      FROM match_result_submissions s LEFT JOIN result_evidence e ON e.submission_id = s.id
      LEFT JOIN match_result_disputes d ON d.submission_id = s.id
      WHERE s.match_id = ? AND s.status IN ('PENDING','CONFIRMED','DISPUTED') LIMIT 1`).get(matchId) as any;
    return row ? this.mapSubmission(row) : null;
  }
  private mapSubmission(row: any): ResultSubmission {
    return { id: row.id, tournamentId: row.tournament_id, matchId: row.match_id,
      reporterId: row.submitted_by_discord_id, reporterTeamId: row.submitting_team_id,
      team1Score: Number(row.team1_score), team2Score: Number(row.team2_score),
      status: row.status, submittedAt: Number(row.submitted_at),
      evidenceMessageId: row.discord_message_id ?? null, disputeReason: row.dispute_reason ?? null,
      rejectionReason: row.rejection_reason ?? null };
  }
  canonical(matchId: string): CanonicalResult | null {
    const row = this.db.prepare('SELECT * FROM match_results WHERE match_id = ?').get(matchId) as any;
    return row ? { matchId: row.match_id, tournamentId: row.tournament_id,
      submissionId: row.approved_submission_id, team1Score: Number(row.team1_score), team2Score: Number(row.team2_score),
      winnerTeamId: row.winner_team_id, loserTeamId: row.loser_team_id,
      approvedBy: row.approved_by_discord_id, approvedAt: Number(row.approved_at), resolutionReason: row.resolution_reason, revision: Number(row.revision) } : null;
  }
  allCanonical(tournamentId: string): CanonicalResult[] {
    const rows = this.db.prepare('SELECT r.match_id FROM match_results r JOIN tournament_matches m ON m.id = r.match_id WHERE r.tournament_id = ? ORDER BY m.round_number, m.match_number').all(tournamentId) as any[];
    return rows.map(row => this.canonical(row.match_id)!);
  }
  orphanApprovedCount(tournamentId: string): number {
    const row = this.db.prepare(`SELECT COUNT(*) AS n FROM match_result_submissions s
      LEFT JOIN match_results r ON r.approved_submission_id = s.id
      WHERE s.tournament_id = ? AND s.status = 'APPROVED' AND r.match_id IS NULL`).get(tournamentId) as any;
    return Number(row.n);
  }
  missingEvidenceCount(tournamentId: string): number {
    const row = this.db.prepare(`SELECT COUNT(*) AS n FROM match_result_submissions s
      LEFT JOIN result_evidence e ON e.submission_id = s.id
      WHERE s.tournament_id = ? AND (e.submission_id IS NULL OR e.discord_message_id != s.card_message_id)`)
      .get(tournamentId) as any;
    return Number(row.n);
  }
  insertSubmission(submission: ResultSubmission, evidence: ArchivedEvidence, now: number): void {
    this.db.prepare(`INSERT INTO match_result_submissions
      (id,tournament_id,match_id,submitted_by_discord_id,submitting_team_id,team1_score,team2_score,status,card_message_id,submitted_at,updated_at)
      VALUES (?,?,?,?,?,?,?,'PENDING',?,?,?)`)
      .run(submission.id, submission.tournamentId, submission.matchId, submission.reporterId, submission.reporterTeamId,
        submission.team1Score, submission.team2Score, evidence.messageId, now, now);
    this.db.prepare(`INSERT INTO result_evidence
      (submission_id,discord_message_id,discord_attachment_id,filename,content_type,size_bytes,archived_at)
      VALUES (?,?,?,?,?,?,?)`)
      .run(submission.id, evidence.messageId, evidence.attachmentId, evidence.filename, evidence.contentType, evidence.size, now);
  }
  transition(submission: ResultSubmission, to: SubmissionState, now: number, reason: string | null = null): void {
    const changed = this.db.prepare('UPDATE match_result_submissions SET status = ?, updated_at = ?, rejection_reason = ? WHERE id = ? AND status = ?')
      .run(to, now, reason, submission.id, submission.status).changes;
    if (changed !== 1) throw new Error('Result submission changed concurrently.');
  }
  insertDispute(submission: ResultSubmission, actor: string, teamId: string, reason: string, now: number): void {
    this.db.prepare('INSERT INTO match_result_disputes (submission_id,raised_by_discord_id,team_id,reason,created_at) VALUES (?,?,?,?,?)')
      .run(submission.id, actor, teamId, reason, now);
  }
  insertCanonical(match: MatchRecord, submission: ResultSubmission, score1: number, score2: number,
    winner: string, loser: string, actor: string, reason: string | null, now: number): void {
    this.db.prepare(`INSERT INTO match_results
      (match_id,tournament_id,approved_submission_id,team1_score,team2_score,winner_team_id,loser_team_id,approved_by_discord_id,approved_at,resolution_reason)
      VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(match.id, match.tournamentId, submission.id, score1, score2, winner, loser, actor, now, reason);
  }
  correctionHistory(matchId: string): CorrectionRecord[] {
    const rows = this.db.prepare('SELECT * FROM match_result_corrections WHERE match_id = ? ORDER BY correction_number').all(matchId) as any[];
    return rows.map(row => ({ id: row.id, tournamentId: row.tournament_id, matchId: row.match_id,
      number: Number(row.correction_number), oldTeam1Score: Number(row.old_team1_score),
      oldTeam2Score: Number(row.old_team2_score), oldWinnerTeamId: row.old_winner_team_id,
      oldLoserTeamId: row.old_loser_team_id, newTeam1Score: Number(row.new_team1_score),
      newTeam2Score: Number(row.new_team2_score), newWinnerTeamId: row.new_winner_team_id,
      newLoserTeamId: row.new_loser_team_id, actorId: row.corrected_by_discord_id,
      reason: row.reason, correctedAt: Number(row.corrected_at),
      versionBefore: Number(row.bracket_version_before), versionAfter: Number(row.bracket_version_after) }));
  }
  insertCorrection(old: CanonicalResult, score1: number, score2: number, winner: string, loser: string,
    actor: string, reason: string, versionBefore: number, now: number): void {
    this.db.prepare(`INSERT INTO match_result_corrections
      (id,tournament_id,match_id,correction_number,old_team1_score,old_team2_score,old_winner_team_id,old_loser_team_id,
       new_team1_score,new_team2_score,new_winner_team_id,new_loser_team_id,corrected_by_discord_id,reason,corrected_at,
       bracket_version_before,bracket_version_after) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(`correction_${crypto.randomUUID()}`, old.tournamentId, old.matchId, old.revision,
        old.team1Score, old.team2Score, old.winnerTeamId, old.loserTeamId,
        score1, score2, winner, loser, actor, reason, now, versionBefore, versionBefore + 1);
  }
  updateCanonical(old: CanonicalResult, score1: number, score2: number, winner: string, loser: string): void {
    const changed = this.db.prepare(`UPDATE match_results SET team1_score = ?, team2_score = ?, winner_team_id = ?,
      loser_team_id = ?, revision = revision + 1 WHERE match_id = ? AND revision = ?`)
      .run(score1, score2, winner, loser, old.matchId, old.revision).changes;
    if (changed !== 1) throw new Error('Canonical result changed concurrently.');
  }
  updateOutcome(tournamentId: string, finalMatchId: string, winner: string, loser: string): void {
    const changed = this.db.prepare(`UPDATE tournament_outcomes SET champion_team_id = ?, runner_up_team_id = ?
      WHERE tournament_id = ? AND final_match_id = ?`)
      .run(winner, loser, tournamentId, finalMatchId).changes;
    if (changed !== 1) throw new Error('Tournament outcome changed concurrently.');
  }
  updatePassive(match: MatchRecord, engine: EngineMatch, now: number): void {
    const status = engine.team1.id && engine.team2.id ? 'READY' : 'WAITING';
    const changed = this.db.prepare(`UPDATE tournament_matches SET team1_id = ?, team2_id = ?, status = ?, updated_at = ?
      WHERE tournament_id = ? AND id = ? AND status IN ('WAITING','READY')`)
      .run(engine.team1.id, engine.team2.id, status, now, match.tournamentId, match.id).changes;
    if (changed !== 1) throw new Error('Passive match changed concurrently.');
  }
  correctionHistoryValid(tournamentId: string): boolean {
    const orphan = this.db.prepare(`SELECT COUNT(*) AS n FROM match_result_corrections c
      LEFT JOIN match_results r ON r.match_id=c.match_id AND r.tournament_id=c.tournament_id
      WHERE c.tournament_id=? AND r.match_id IS NULL`).get(tournamentId) as any;
    if (orphan.n) return false;
    for (const result of this.allCanonical(tournamentId)) {
      const history = this.correctionHistory(result.matchId);
      if (result.revision !== history.length + 1) return false;
      for (let i = 0; i < history.length; i++) {
        const current = history[i];
        if (current.number !== i + 1 || current.versionAfter !== current.versionBefore + 1 ||
            (i > 0 && (current.oldTeam1Score !== history[i - 1].newTeam1Score ||
              current.oldTeam2Score !== history[i - 1].newTeam2Score ||
              current.oldWinnerTeamId !== history[i - 1].newWinnerTeamId ||
              current.oldLoserTeamId !== history[i - 1].newLoserTeamId ||
              current.versionBefore < history[i - 1].versionAfter))) return false;
      }
      if (history.length && (history.at(-1)!.newTeam1Score !== result.team1Score ||
          history.at(-1)!.newTeam2Score !== result.team2Score ||
          history.at(-1)!.newWinnerTeamId !== result.winnerTeamId ||
          history.at(-1)!.newLoserTeamId !== result.loserTeamId)) return false;
    }
    return true;
  }
  updateWaiting(match: MatchRecord, engine: EngineMatch, now: number): void {
    this.db.prepare(`UPDATE tournament_matches SET team1_id = ?, team2_id = ?,
      status = CASE WHEN ? IS NOT NULL AND ? IS NOT NULL THEN 'READY' ELSE 'WAITING' END,
      updated_at = ? WHERE tournament_id = ? AND id = ? AND status = 'WAITING'`)
      .run(engine.team1.id, engine.team2.id, engine.team1.id, engine.team2.id, now, match.tournamentId, match.id);
  }
  completeMatch(match: MatchRecord, now: number): void {
    const changed = this.db.prepare("UPDATE tournament_matches SET status = 'COMPLETED', updated_at = ? WHERE id = ? AND tournament_id = ? AND status = 'LIVE'")
      .run(now, match.id, match.tournamentId).changes;
    if (changed !== 1) throw new Error('Match changed before completion.');
  }
  insertOutcome(tournamentId: string, champion: string, runnerUp: string, finalMatchId: string, actor: string, now: number): void {
    this.db.prepare(`INSERT INTO tournament_outcomes
      (tournament_id,champion_team_id,runner_up_team_id,final_match_id,completed_at,completed_by_discord_id)
      VALUES (?,?,?,?,?,?)`).run(tournamentId, champion, runnerUp, finalMatchId, now, actor);
    const changed = this.db.prepare("UPDATE tournaments SET status = 'completed' WHERE id = ? AND status = 'in_progress'")
      .run(tournamentId).changes;
    if (changed !== 1) throw new Error('Tournament changed before completion.');
  }
  outcome(tournamentId: string): TournamentOutcome | null {
    const row = this.db.prepare('SELECT * FROM tournament_outcomes WHERE tournament_id = ?').get(tournamentId) as any;
    return row ? { championTeamId: row.champion_team_id, runnerUpTeamId: row.runner_up_team_id, finalMatchId: row.final_match_id } : null;
  }
  audit(match: MatchRecord, submissionId: string | null, actor: string, action: string,
    previous: string | null, next: string | null, now: number): void {
    this.db.prepare(`INSERT INTO result_audit_logs
      (id,tournament_id,match_id,submission_id,actor_discord_id,action,previous_status,new_status,details,timestamp)
      VALUES (?,?,?,?,?,?,?,?,NULL,?)`)
      .run(`resultlog_${crypto.randomUUID()}`, match.tournamentId, match.id, submissionId, actor, action, previous, next, now);
  }
}
