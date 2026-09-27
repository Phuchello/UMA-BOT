import { DatabaseSync } from 'node:sqlite';

export interface StreamRecord { matchId: string; tournamentId: string; url: string; title: string | null; setBy: string; updatedAt: number }
export interface CasterRecord { matchId: string; tournamentId: string; casterId: string; assignedBy: string; assignedAt: number }

export class StreamRepository {
  constructor(private readonly db: DatabaseSync) {}
  transaction<T>(action: () => T): T {
    this.db.exec('BEGIN IMMEDIATE TRANSACTION;');
    try { const value = action(); this.db.exec('COMMIT;'); return value; }
    catch (error) { this.db.exec('ROLLBACK;'); throw error; }
  }
  stream(matchId: string): StreamRecord | null {
    const row = this.db.prepare('SELECT * FROM match_streams WHERE match_id = ?').get(matchId) as any;
    return row ? { matchId: row.match_id, tournamentId: row.tournament_id, url: row.url,
      title: row.title, setBy: row.set_by_discord_id, updatedAt: Number(row.updated_at) } : null;
  }
  casters(matchId: string): CasterRecord[] {
    const rows = this.db.prepare('SELECT * FROM match_casters WHERE match_id = ? ORDER BY assigned_at, caster_discord_id').all(matchId) as any[];
    return rows.map(row => ({ matchId: row.match_id, tournamentId: row.tournament_id,
      casterId: row.caster_discord_id, assignedBy: row.assigned_by_discord_id,
      assignedAt: Number(row.assigned_at) }));
  }
  set(tournamentId: string, matchId: string, url: string, title: string | null, actor: string, now: number): void {
    this.db.prepare(`INSERT INTO match_streams (tournament_id,match_id,url,title,set_by_discord_id,updated_at)
      VALUES (?,?,?,?,?,?) ON CONFLICT(match_id) DO UPDATE SET url=excluded.url, title=excluded.title,
      set_by_discord_id=excluded.set_by_discord_id,updated_at=excluded.updated_at`)
      .run(tournamentId, matchId, url, title, actor, now);
  }
  clear(matchId: string): boolean {
    return this.db.prepare('DELETE FROM match_streams WHERE match_id = ?').run(matchId).changes === 1;
  }
  addCaster(tournamentId: string, matchId: string, caster: string, actor: string, now: number): boolean {
    return this.db.prepare(`INSERT OR IGNORE INTO match_casters
      (tournament_id,match_id,caster_discord_id,assigned_by_discord_id,assigned_at) VALUES (?,?,?,?,?)`)
      .run(tournamentId, matchId, caster, actor, now).changes === 1;
  }
  removeCaster(matchId: string, caster: string): boolean {
    return this.db.prepare('DELETE FROM match_casters WHERE match_id = ? AND caster_discord_id = ?').run(matchId, caster).changes === 1;
  }
  validate(tournamentId: string): void {
    const orphanStreams = this.db.prepare(`SELECT COUNT(*) AS n FROM match_streams s LEFT JOIN tournament_matches m
      ON m.id=s.match_id AND m.tournament_id=s.tournament_id WHERE s.tournament_id=? AND m.id IS NULL`).get(tournamentId) as any;
    const orphanCasters = this.db.prepare(`SELECT COUNT(*) AS n FROM match_casters c LEFT JOIN tournament_matches m
      ON m.id=c.match_id AND m.tournament_id=c.tournament_id WHERE c.tournament_id=? AND m.id IS NULL`).get(tournamentId) as any;
    if (orphanStreams.n || orphanCasters.n) throw new Error('Stream/caster metadata points to a missing match.');
  }
}
