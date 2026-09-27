import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import type { EngineBracket } from './TournamentEngine.js';
import type { TournamentStatus } from '../registration/TeamRepository.js';

export interface EligibleTeam { id: string; name: string; abbreviation: string; captainDiscordId: string }
export interface SeedRow { teamId: string; name: string; seed: number }
export interface MatchRow {
  id: string; engineMatchId: string; round: number; matchNumber: number;
  team1Id: string | null; team2Id: string | null; isBye: boolean; status: string;
}
export interface ByeRow { teamId: string; advanceToEngineMatchId: string; round: number }
export interface TournamentSummary {
  status: TournamentStatus; approved: number; pending: number; needsCorrection: number; rejected: number;
  checkedIn: number; bracketReady: boolean;
}

export class TournamentRepository {
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

  public tournament(id: string): { id: string; name: string; status: TournamentStatus } | null {
    const row = this.db.prepare('SELECT id, name, status FROM tournaments WHERE id = ?').get(id) as any;
    return row ? { id: row.id, name: row.name, status: row.status as TournamentStatus } : null;
  }

  public summary(id: string): TournamentSummary | null {
    const tournament = this.tournament(id);
    if (!tournament) return null;
    const rows = this.db.prepare('SELECT status, COUNT(*) AS count FROM teams WHERE tournament_id = ? GROUP BY status').all(id) as any[];
    const count = (status: string) => Number(rows.find(row => row.status === status)?.count ?? 0);
    const checkins = this.db.prepare('SELECT COUNT(*) AS count FROM team_checkins WHERE tournament_id = ?').get(id) as any;
    return {
      status: tournament.status,
      approved: count('APPROVED'), pending: count('PENDING'),
      needsCorrection: count('NEEDS_CORRECTION'), rejected: count('REJECTED'), checkedIn: Number(checkins.count),
      bracketReady: this.bracketState(id) !== null
    };
  }

  public transition(id: string, from: TournamentStatus, to: TournamentStatus): boolean {
    return this.db.prepare('UPDATE tournaments SET status = ? WHERE id = ? AND status = ?').run(to, id, from).changes === 1;
  }

  public team(id: string): { id: string; tournamentId: string; name: string; status: string; captainDiscordId: string } | null {
    const row = this.db.prepare('SELECT id, tournament_id, name, status, captain_discord_id FROM teams WHERE id = ?').get(id) as any;
    return row ? { id: row.id, tournamentId: row.tournament_id, name: row.name, status: row.status, captainDiscordId: row.captain_discord_id } : null;
  }

  public checkedIn(id: string, teamId: string): boolean {
    return !!this.db.prepare('SELECT 1 FROM team_checkins WHERE tournament_id = ? AND team_id = ?').get(id, teamId);
  }

  public insertCheckin(id: string, teamId: string, actor: string): void {
    this.db.prepare('INSERT INTO team_checkins (tournament_id, team_id, checked_in_by_discord_id, checked_in_at) VALUES (?, ?, ?, ?)')
      .run(id, teamId, actor, Date.now());
  }

  public approvedCheckinNames(id: string): { checkedIn: string[]; missing: string[] } {
    const rows = this.db.prepare(`SELECT t.name, c.team_id AS checked
      FROM teams t LEFT JOIN team_checkins c ON c.tournament_id = t.tournament_id AND c.team_id = t.id
      WHERE t.tournament_id = ? AND t.status = 'APPROVED' ORDER BY t.name`).all(id) as any[];
    return {
      checkedIn: rows.filter(row => row.checked).map(row => row.name),
      missing: rows.filter(row => !row.checked).map(row => row.name)
    };
  }

  public eligible(id: string): EligibleTeam[] {
    const rows = this.db.prepare(`SELECT t.id, t.name, t.abbreviation, t.captain_discord_id
      FROM teams t INNER JOIN team_checkins c ON c.team_id = t.id AND c.tournament_id = t.tournament_id
      WHERE t.tournament_id = ? AND t.status = 'APPROVED' ORDER BY t.id`).all(id) as any[];
    return rows.map(row => ({ id: row.id, name: row.name, abbreviation: row.abbreviation, captainDiscordId: row.captain_discord_id }));
  }

  public saveDraw(id: string, staffId: string, seeds: SeedRow[], bracket: EngineBracket, serialized: string, byes: ByeRow[]): void {
    const now = Date.now();
    const insertSeed = this.db.prepare('INSERT INTO tournament_seeds (tournament_id, team_id, seed, drawn_at, drawn_by_discord_id) VALUES (?, ?, ?, ?, ?)');
    for (const seed of seeds) insertSeed.run(id, seed.teamId, seed.seed, now, staffId);
    this.db.prepare('INSERT INTO tournament_brackets (tournament_id, engine_state, generated_at, generated_by_discord_id) VALUES (?, ?, ?, ?)')
      .run(id, serialized, now, staffId);
    const insertMatch = this.db.prepare(`INSERT INTO tournament_matches
      (id, tournament_id, engine_match_id, round_number, match_number, team1_id, team2_id, is_bye, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SCHEDULED', ?, ?)`);
    for (const match of bracket.matches) {
      insertMatch.run(`match_${crypto.randomUUID()}`, id, match.id, match.round, match.matchNumber,
        match.team1.id, match.team2.id, Number(match.isBye), now, now);
    }
    const insertBye = this.db.prepare('INSERT INTO tournament_byes (tournament_id, team_id, advance_to_engine_match_id, round_number) VALUES (?, ?, ?, ?)');
    for (const bye of byes) insertBye.run(id, bye.teamId, bye.advanceToEngineMatchId, bye.round);
  }

  public bracketState(id: string): string | null {
    const row = this.db.prepare('SELECT engine_state FROM tournament_brackets WHERE tournament_id = ?').get(id) as any;
    return row?.engine_state ?? null;
  }

  public seeds(id: string): SeedRow[] {
    const rows = this.db.prepare(`SELECT s.team_id, t.name, s.seed FROM tournament_seeds s
      JOIN teams t ON t.id = s.team_id WHERE s.tournament_id = ? ORDER BY s.seed`).all(id) as any[];
    return rows.map(row => ({ teamId: row.team_id, name: row.name, seed: Number(row.seed) }));
  }

  public matches(id: string): MatchRow[] {
    const rows = this.db.prepare('SELECT * FROM tournament_matches WHERE tournament_id = ? ORDER BY round_number, match_number').all(id) as any[];
    return rows.map(row => ({ id: row.id, engineMatchId: row.engine_match_id, round: Number(row.round_number),
      matchNumber: Number(row.match_number), team1Id: row.team1_id, team2Id: row.team2_id,
      isBye: Boolean(row.is_bye), status: row.status }));
  }

  public byes(id: string): ByeRow[] {
    const rows = this.db.prepare('SELECT * FROM tournament_byes WHERE tournament_id = ? ORDER BY team_id').all(id) as any[];
    return rows.map(row => ({ teamId: row.team_id, advanceToEngineMatchId: row.advance_to_engine_match_id, round: Number(row.round_number) }));
  }
}
