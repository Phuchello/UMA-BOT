import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

export type MatchState = 'WAITING' | 'READY' | 'ROOM_OPEN' | 'SCHEDULED' | 'READY_TO_START' | 'LIVE' | 'COMPLETED';
export interface MatchTeam { id: string; name: string; abbreviation: string; captainId: string }
export interface MatchRoom { threadId: string; parentChannelId: string; starterMessageId: string }
export interface MatchRecord {
  id: string; tournamentId: string; engineMatchId: string; round: number; number: number;
  status: MatchState; team1: MatchTeam | null; team2: MatchTeam | null;
  room: MatchRoom | null; scheduledAt: number | null; readyTeamIds: string[];
  refereeIds: string[]; startedAt: number | null; startedBy: string | null;
  result: { team1Score: number; team2Score: number; winnerTeamId: string; approvedBy: string } | null;
}

export class MatchRepository {
  constructor(private readonly db: DatabaseSync) {}

  public transaction<T>(action: () => T): T {
    this.db.exec('BEGIN IMMEDIATE TRANSACTION;');
    try {
      const result = action();
      this.db.exec('COMMIT;');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  public tournamentStatus(id: string): string | null {
    const row = this.db.prepare('SELECT status FROM tournaments WHERE id = ?').get(id) as any;
    return row?.status ?? null;
  }

  public list(tournamentId: string): MatchRecord[] {
    const rows = this.db.prepare('SELECT id FROM tournament_matches WHERE tournament_id = ? ORDER BY round_number, match_number')
      .all(tournamentId) as any[];
    return rows.map(row => this.byId(tournamentId, row.id)!);
  }

  public bySelector(tournamentId: string, round: number, number: number): MatchRecord | null {
    const row = this.db.prepare('SELECT id FROM tournament_matches WHERE tournament_id = ? AND round_number = ? AND match_number = ?')
      .get(tournamentId, round, number) as any;
    return row ? this.byId(tournamentId, row.id) : null;
  }

  public byId(tournamentId: string, matchId: string): MatchRecord | null {
    const row = this.db.prepare(`SELECT m.*, a.name AS a_name, a.abbreviation AS a_abbr, a.captain_discord_id AS a_captain,
        b.name AS b_name, b.abbreviation AS b_abbr, b.captain_discord_id AS b_captain,
        r.discord_thread_id, r.parent_channel_id, r.starter_message_id,
        s.scheduled_at, st.started_at, st.started_by_discord_id,
        result.team1_score, result.team2_score, result.winner_team_id, result.approved_by_discord_id
      FROM tournament_matches m
      LEFT JOIN teams a ON a.id = m.team1_id AND a.tournament_id = m.tournament_id
      LEFT JOIN teams b ON b.id = m.team2_id AND b.tournament_id = m.tournament_id
      LEFT JOIN match_rooms r ON r.match_id = m.id
      LEFT JOIN match_schedules s ON s.match_id = m.id
      LEFT JOIN match_starts st ON st.match_id = m.id
      LEFT JOIN match_results result ON result.match_id = m.id
      WHERE m.tournament_id = ? AND m.id = ?`).get(tournamentId, matchId) as any;
    if (!row) return null;
    const refs = this.db.prepare('SELECT referee_discord_id FROM match_referee_assignments WHERE match_id = ? ORDER BY referee_discord_id')
      .all(matchId) as any[];
    const ready = this.db.prepare('SELECT team_id FROM match_ready_confirmations WHERE match_id = ? ORDER BY team_id')
      .all(matchId) as any[];
    const team = (prefix: 'a' | 'b', id: string | null): MatchTeam | null => id ? {
      id, name: row[`${prefix}_name`], abbreviation: row[`${prefix}_abbr`], captainId: row[`${prefix}_captain`]
    } : null;
    return {
      id: row.id, tournamentId: row.tournament_id, engineMatchId: row.engine_match_id,
      round: Number(row.round_number), number: Number(row.match_number), status: row.status as MatchState,
      team1: team('a', row.team1_id), team2: team('b', row.team2_id),
      room: row.discord_thread_id ? { threadId: row.discord_thread_id, parentChannelId: row.parent_channel_id,
        starterMessageId: row.starter_message_id } : null,
      scheduledAt: row.scheduled_at === null ? null : Number(row.scheduled_at),
      readyTeamIds: ready.map(item => item.team_id), refereeIds: refs.map(item => item.referee_discord_id),
      startedAt: row.started_at === null ? null : Number(row.started_at), startedBy: row.started_by_discord_id,
      result: row.winner_team_id ? { team1Score: Number(row.team1_score), team2Score: Number(row.team2_score),
        winnerTeamId: row.winner_team_id, approvedBy: row.approved_by_discord_id } : null
    };
  }

  public transition(match: MatchRecord, to: MatchState, now: number): void {
    const result = this.db.prepare('UPDATE tournament_matches SET status = ?, updated_at = ? WHERE id = ? AND tournament_id = ? AND status = ?')
      .run(to, now, match.id, match.tournamentId, match.status);
    if (result.changes !== 1) throw new Error('Match state changed concurrently.');
  }

  public updateParticipants(match: MatchRecord, team1Id: string, team2Id: string, now: number): void {
    const result = this.db.prepare(`UPDATE tournament_matches SET team1_id = ?, team2_id = ?, status = 'READY', updated_at = ?
      WHERE id = ? AND tournament_id = ? AND status = 'WAITING' AND (team1_id IS NULL OR team2_id IS NULL)`)
      .run(team1Id, team2Id, now, match.id, match.tournamentId);
    if (result.changes !== 1) throw new Error('Match participants changed concurrently.');
  }

  public teamInDraw(tournamentId: string, teamId: string): boolean {
    return !!this.db.prepare('SELECT 1 FROM tournament_seeds WHERE tournament_id = ? AND team_id = ?').get(tournamentId, teamId);
  }

  public assignReferee(match: MatchRecord, refereeId: string, staffId: string, now: number): boolean {
    return this.db.prepare(`INSERT OR IGNORE INTO match_referee_assignments
      (tournament_id, match_id, referee_discord_id, assigned_by_discord_id, assigned_at) VALUES (?, ?, ?, ?, ?)`)
      .run(match.tournamentId, match.id, refereeId, staffId, now).changes === 1;
  }

  public insertRoom(match: MatchRecord, room: MatchRoom, staffId: string, now: number): void {
    this.db.prepare(`INSERT INTO match_rooms
      (tournament_id, match_id, discord_thread_id, parent_channel_id, starter_message_id, created_by_discord_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(match.tournamentId, match.id, room.threadId, room.parentChannelId, room.starterMessageId, staffId, now);
  }

  public setSchedule(match: MatchRecord, scheduledAt: number, staffId: string, now: number): void {
    this.db.prepare(`INSERT INTO match_schedules (tournament_id, match_id, scheduled_at, scheduled_by_discord_id, updated_at)
      VALUES (?, ?, ?, ?, ?) ON CONFLICT(match_id) DO UPDATE SET
      scheduled_at = excluded.scheduled_at, scheduled_by_discord_id = excluded.scheduled_by_discord_id,
      updated_at = excluded.updated_at`)
      .run(match.tournamentId, match.id, scheduledAt, staffId, now);
  }

  public confirmReady(match: MatchRecord, teamId: string, captainId: string, now: number): boolean {
    return this.db.prepare(`INSERT OR IGNORE INTO match_ready_confirmations
      (tournament_id, match_id, team_id, captain_discord_id, confirmed_at) VALUES (?, ?, ?, ?, ?)`)
      .run(match.tournamentId, match.id, teamId, captainId, now).changes === 1;
  }

  public clearReady(matchId: string): void {
    this.db.prepare('DELETE FROM match_ready_confirmations WHERE match_id = ?').run(matchId);
  }

  public insertStart(match: MatchRecord, actorId: string, now: number): void {
    this.db.prepare('INSERT INTO match_starts (tournament_id, match_id, started_at, started_by_discord_id) VALUES (?, ?, ?, ?)')
      .run(match.tournamentId, match.id, now, actorId);
  }

  public audit(match: MatchRecord, actor: string, action: string, previous: MatchState, next: MatchState, details: string | null, now: number): void {
    this.db.prepare(`INSERT INTO match_audit_logs
      (id, tournament_id, match_id, actor_discord_id, action, previous_status, new_status, details, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(`matchlog_${crypto.randomUUID()}`, match.tournamentId, match.id, actor, action, previous, next, details, now);
  }

  public counts(tournamentId: string): Record<MatchState, number> {
    const counts: Record<MatchState, number> = { WAITING: 0, READY: 0, ROOM_OPEN: 0,
      SCHEDULED: 0, READY_TO_START: 0, LIVE: 0, COMPLETED: 0 };
    const rows = this.db.prepare('SELECT status, COUNT(*) AS n FROM tournament_matches WHERE tournament_id = ? GROUP BY status')
      .all(tournamentId) as any[];
    for (const row of rows) {
      if (!(row.status in counts)) throw new Error(`Unknown match state: ${row.status}`);
      counts[row.status as MatchState] = Number(row.n);
    }
    return counts;
  }
}
