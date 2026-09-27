import crypto from 'node:crypto';
import { MatchRepository, type MatchRecord } from '../match/MatchRepository.js';
import { ResultRepository, type CanonicalResult } from '../result/ResultRepository.js';
import { StreamRepository } from '../stream/StreamRepository.js';
import { PublicationRepository, type PublishedMessage } from './PublicationRepository.js';
import type { PublicAnnouncementGateway, PublicCard } from './PublicAnnouncementGateway.js';

export class PublicationError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}
export interface PublicationSummary { created: number; updated: number; unchanged: number; failed: number }
const safe = (value: string, limit = 100): string => value.slice(0, limit).replace(/[\r\n\t]/g, ' ')
  .replace(/@/g, '@\u200b').replace(/[`*_~|]/g, '\\$&');
const digest = (card: PublicCard) => crypto.createHash('sha256').update(JSON.stringify(card)).digest('hex');

export class PublicationService {
  private running = false;
  constructor(private readonly repo: PublicationRepository, private readonly matches: MatchRepository,
    private readonly results: ResultRepository, private readonly streams: StreamRepository,
    private readonly gateway: PublicAnnouncementGateway, private readonly channelId: string,
    private readonly now: () => number = () => Date.now()) {}

  public async sync(tournamentId: string, staff: boolean): Promise<PublicationSummary> {
    if (!staff) throw new PublicationError('NOT_STAFF', 'Chỉ Ban Tổ Chức được đăng kết quả chính thức.');
    if (this.running) throw new PublicationError('CONFLICT', 'Đồng bộ kết quả đang chạy.');
    this.running = true;
    const summary: PublicationSummary = { created: 0, updated: 0, unchanged: 0, failed: 0 };
    try {
      for (const canonical of this.results.allCanonical(tournamentId)) {
        try {
          const match = this.matches.byId(tournamentId, canonical.matchId);
          if (!match || !match.team1 || !match.team2 || match.status !== 'COMPLETED')
            throw new PublicationError('CORRUPT_RESULT', 'Trận có kết quả không hợp lệ.');
          const card = this.resultCard(match, canonical, this.streams.stream(match.id)?.url ?? null);
          const state = await this.publishOne('result', tournamentId, match.id, canonical.revision, card,
            this.repo.result(match.id));
          summary[state]++;
        } catch (error) {
          summary.failed++;
          console.error(`Publication failed for match ${canonical.matchId}: ${error instanceof Error ? error.name : 'unknown error'}`);
        }
      }
      if (this.results.tournamentStatus(tournamentId) === 'completed') {
        try {
          const outcome = this.results.outcome(tournamentId);
          if (!outcome) throw new PublicationError('CORRUPT_OUTCOME', 'Giải đã hoàn tất nhưng thiếu nhà vô địch.');
          const final = this.matches.byId(tournamentId, outcome.finalMatchId);
          const canonical = this.results.canonical(outcome.finalMatchId);
          if (!final?.team1 || !final.team2 || !canonical || canonical.winnerTeamId !== outcome.championTeamId ||
              canonical.loserTeamId !== outcome.runnerUpTeamId)
            throw new PublicationError('CORRUPT_OUTCOME', 'Chung kết và nhà vô địch không khớp.');
          const card = this.championCard(final, canonical);
          const state = await this.publishOne('champion', tournamentId, null, canonical.revision, card,
            this.repo.champion(tournamentId));
          summary[state]++;
        } catch (error) {
          summary.failed++;
          console.error(`Champion publication failed for ${tournamentId}: ${error instanceof Error ? error.name : 'unknown error'}`);
        }
      }
      return summary;
    } finally { this.running = false; }
  }

  public validatePersistedState(tournamentId: string): void { this.repo.validate(tournamentId, this.channelId); }

  private resultCard(match: MatchRecord, result: CanonicalResult, streamUrl: string | null): PublicCard {
    const winner = result.winnerTeamId === match.team1!.id ? match.team1!.name : match.team2!.name;
    const fields = [{ name: '🏅 Chiến thắng', value: safe(winner) },
      { name: 'Xác nhận', value: '✅ Đã được trọng tài/BTC xác nhận' }];
    if (streamUrl) fields.push({ name: '📺 Xem lại trận', value: 'Nhấn tiêu đề để mở livestream/VOD.' });
    return { title: '🏆 UMA CUP — KẾT QUẢ CHÍNH THỨC',
      description: `Vòng ${match.round} • Trận ${match.number}\n\n${safe(match.team1!.name)} **${result.team1Score} — ${result.team2Score}** ${safe(match.team2!.name)}`,
      fields, footer: `UMA CUP • Kết quả chính thức${result.revision > 1 ? ` • Hiệu chỉnh #${result.revision - 1}` : ''}`,
      color: 0x22C55E, url: streamUrl ?? undefined };
  }
  private championCard(final: MatchRecord, result: CanonicalResult): PublicCard {
    const champion = result.winnerTeamId === final.team1!.id ? final.team1!.name : final.team2!.name;
    const runner = result.loserTeamId === final.team1!.id ? final.team1!.name : final.team2!.name;
    return { title: '🏆 UMA CUP — NHÀ VÔ ĐỊCH',
      description: `🥇 ${safe(champion)}\n🥈 ${safe(runner)}\n\nChung kết: ${safe(final.team1!.name)} ${result.team1Score}–${result.team2Score} ${safe(final.team2!.name)}\n\n🎉 Chúc mừng nhà vô địch UMA CUP!`,
      fields: [], footer: 'UMA CUP • Lễ trao giải', color: 0xF59E0B };
  }
  private async publishOne(kind: 'result' | 'champion', tournamentId: string, matchId: string | null,
    revision: number, card: PublicCard, existing: PublishedMessage | null): Promise<'created' | 'updated' | 'unchanged'> {
    const hash = digest(card);
    if (existing && existing.channelId !== this.channelId)
      throw new PublicationError('CHANNEL_CHANGED', 'Kênh kết quả đã thay đổi; cần kiểm tra bản ghi xuất bản.');
    const exists = existing ? await this.gateway.messageExists(this.channelId, existing.messageId) : false;
    if (existing && exists && existing.revision === revision && existing.contentHash === hash) return 'unchanged';
    if (existing && exists) {
      if (kind === 'result') await this.gateway.editResult(this.channelId, existing.messageId, card);
      else await this.gateway.editChampion(this.channelId, existing.messageId, card);
      this.repo.transaction(() => this.persist(kind, tournamentId, matchId, existing.messageId, revision, hash, existing));
      return 'updated';
    }
    const messageId = kind === 'result'
      ? await this.gateway.publishResult(this.channelId, card)
      : await this.gateway.publishChampion(this.channelId, card);
    try {
      this.repo.transaction(() => this.persist(kind, tournamentId, matchId, messageId, revision, hash, existing));
    } catch (error) {
      try { await this.gateway.deleteMessage(this.channelId, messageId); }
      catch { console.error(`Orphan public message ${messageId}: compensation failed.`); }
      throw error;
    }
    return 'created';
  }
  private persist(kind: 'result' | 'champion', tournamentId: string, matchId: string | null,
    messageId: string, revision: number, hash: string, existing: PublishedMessage | null): void {
    const current = kind === 'result' ? this.results.canonical(matchId!) :
      this.results.canonical(this.results.outcome(tournamentId)?.finalMatchId ?? '');
    if (!current || current.revision !== revision) throw new PublicationError('STALE_VIEW', 'Kết quả đã thay đổi trong lúc xuất bản.');
    if (kind === 'result') this.repo.saveResult(tournamentId, matchId!, this.channelId, messageId, revision, hash, existing, this.now());
    else this.repo.saveChampion(tournamentId, this.channelId, messageId, revision, hash, existing, this.now());
  }
}
