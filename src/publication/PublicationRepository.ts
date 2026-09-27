import { DatabaseSync } from 'node:sqlite';

export interface PublishedMessage { tournamentId: string; matchId?: string; channelId: string;
  messageId: string; revision: number; contentHash: string }
export class PublicationRepository {
  constructor(private readonly db: DatabaseSync) {}
  transaction<T>(action: () => T): T {
    this.db.exec('BEGIN IMMEDIATE TRANSACTION;');
    try { const value = action(); this.db.exec('COMMIT;'); return value; }
    catch (error) { this.db.exec('ROLLBACK;'); throw error; }
  }
  result(matchId: string): PublishedMessage | null {
    const row = this.db.prepare('SELECT * FROM public_result_messages WHERE match_id = ?').get(matchId) as any;
    return row ? { tournamentId: row.tournament_id, matchId: row.match_id, channelId: row.channel_id,
      messageId: row.discord_message_id, revision: Number(row.published_revision), contentHash: row.content_hash } : null;
  }
  champion(tournamentId: string): PublishedMessage | null {
    const row = this.db.prepare('SELECT * FROM public_champion_messages WHERE tournament_id = ?').get(tournamentId) as any;
    return row ? { tournamentId: row.tournament_id, channelId: row.channel_id,
      messageId: row.discord_message_id, revision: Number(row.published_revision), contentHash: row.content_hash } : null;
  }
  saveResult(tournamentId: string, matchId: string, channelId: string, messageId: string,
    revision: number, contentHash: string, expected: PublishedMessage | null, now: number): void {
    if (expected) {
      const changed = this.db.prepare(`UPDATE public_result_messages SET discord_message_id=?,published_revision=?,
        content_hash=?,updated_at=? WHERE match_id=? AND discord_message_id=? AND published_revision=?`)
        .run(messageId,revision,contentHash,now,matchId,expected.messageId,expected.revision).changes;
      if (changed !== 1) throw new Error('Publication identity changed concurrently.');
    } else {
      this.db.prepare(`INSERT INTO public_result_messages
        (tournament_id,match_id,channel_id,discord_message_id,published_revision,content_hash,published_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?)`).run(tournamentId,matchId,channelId,messageId,revision,contentHash,now,now);
    }
  }
  saveChampion(tournamentId: string, channelId: string, messageId: string,
    revision: number, contentHash: string, expected: PublishedMessage | null, now: number): void {
    if (expected) {
      const changed = this.db.prepare(`UPDATE public_champion_messages SET discord_message_id=?,published_revision=?,
        content_hash=?,updated_at=? WHERE tournament_id=? AND discord_message_id=? AND published_revision=?`)
        .run(messageId,revision,contentHash,now,tournamentId,expected.messageId,expected.revision).changes;
      if (changed !== 1) throw new Error('Champion identity changed concurrently.');
    } else {
      this.db.prepare(`INSERT INTO public_champion_messages
        (tournament_id,channel_id,discord_message_id,published_revision,content_hash,published_at,updated_at)
        VALUES (?,?,?,?,?,?,?)`).run(tournamentId,channelId,messageId,revision,contentHash,now,now);
    }
  }
  validate(tournamentId: string, expectedChannelId: string): void {
    const invalidResults = this.db.prepare(`SELECT COUNT(*) AS n FROM public_result_messages p
      LEFT JOIN match_results r ON r.match_id=p.match_id AND r.tournament_id=p.tournament_id
      WHERE p.tournament_id=? AND (r.match_id IS NULL OR p.published_revision>r.revision OR p.channel_id<>?)`).get(tournamentId, expectedChannelId) as any;
    const invalidChampion = this.db.prepare(`SELECT COUNT(*) AS n FROM public_champion_messages p
      LEFT JOIN tournament_outcomes o ON o.tournament_id=p.tournament_id
      LEFT JOIN match_results r ON r.match_id=o.final_match_id
      WHERE p.tournament_id=? AND (o.tournament_id IS NULL OR r.match_id IS NULL OR p.published_revision>r.revision OR p.channel_id<>?)`).get(tournamentId, expectedChannelId) as any;
    if (invalidResults.n || invalidChampion.n) throw new Error('Publication metadata is inconsistent.');
  }
}
