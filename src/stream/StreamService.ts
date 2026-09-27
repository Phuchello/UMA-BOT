import { MatchRepository, type MatchRecord } from '../match/MatchRepository.js';
import { StreamRepository } from './StreamRepository.js';

export class StreamError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}
const allowedHosts = new Set(['youtube.com','www.youtube.com','youtu.be','twitch.tv','www.twitch.tv',
  'facebook.com','www.facebook.com','fb.watch','tiktok.com','www.tiktok.com']);
export function validateStreamUrl(input: string): string {
  if (input.length > 2048 || input.trim() !== input || /[\x00-\x20\x7f]/.test(input))
    throw new StreamError('INVALID_URL', 'Liên kết không hợp lệ hoặc vượt quá 2048 ký tự.');
  let url: URL;
  try { url = new URL(input); } catch { throw new StreamError('INVALID_URL', 'Liên kết livestream không hợp lệ.'); }
  if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname) || url.username || url.password ||
      (url.port && url.port !== '443'))
    throw new StreamError('INVALID_URL', 'Chỉ nhận liên kết HTTPS công khai từ YouTube, Twitch, Facebook hoặc TikTok.');
  if (url.href.length > 2048) throw new StreamError('INVALID_URL', 'Liên kết vượt quá 2048 ký tự sau chuẩn hóa.');
  return url.href;
}
export class StreamService {
  constructor(private readonly repo: StreamRepository, private readonly matches: MatchRepository,
    private readonly now: () => number = () => Date.now()) {}
  private match(tournamentId: string, round: number, number: number): MatchRecord {
    if (!Number.isInteger(round) || round < 1 || !Number.isInteger(number) || number < 1)
      throw new StreamError('INVALID_SELECTOR', 'Vòng và trận phải là số nguyên dương.');
    const match = this.matches.bySelector(tournamentId, round, number);
    if (!match) throw new StreamError('MATCH_NOT_FOUND', 'Không tìm thấy trận.');
    return match;
  }
  private editable(tournamentId: string, round: number, number: number, staff: boolean): MatchRecord {
    if (!staff) throw new StreamError('NOT_STAFF', 'Chỉ Ban Tổ Chức được thay đổi livestream và caster.');
    const match = this.match(tournamentId, round, number);
    if (!match.team1 || !match.team2 || !['READY','ROOM_OPEN','SCHEDULED','READY_TO_START','LIVE','COMPLETED'].includes(match.status))
      throw new StreamError('WAITING_MATCH', 'Trận chưa xác định đủ hai đội.');
    return match;
  }
  set(tournamentId: string, round: number, number: number, input: string, title: string | null,
    actor: string, staff: boolean) {
    const url = validateStreamUrl(input);
    const cleanTitle = title?.trim() || null;
    if (cleanTitle && (cleanTitle.length > 100 || /[\x00-\x1f\x7f]/.test(cleanTitle)))
      throw new StreamError('INVALID_TITLE', 'Tiêu đề phải có tối đa 100 ký tự và không chứa xuống dòng.');
    return this.repo.transaction(() => {
      const match = this.editable(tournamentId, round, number, staff);
      this.repo.set(tournamentId, match.id, url, cleanTitle, actor, this.now());
      return this.repo.stream(match.id)!;
    });
  }
  clear(tournamentId: string, round: number, number: number, staff: boolean): boolean {
    return this.repo.transaction(() => this.repo.clear(this.editable(tournamentId, round, number, staff).id));
  }
  addCaster(tournamentId: string, round: number, number: number, caster: string, actor: string, staff: boolean): boolean {
    return this.repo.transaction(() => {
      const match = this.editable(tournamentId, round, number, staff);
      if (!/^\d{17,20}$/.test(caster)) throw new StreamError('INVALID_CASTER', 'Discord user ID không hợp lệ.');
      return this.repo.addCaster(tournamentId, match.id, caster, actor, this.now());
    });
  }
  removeCaster(tournamentId: string, round: number, number: number, caster: string, staff: boolean): boolean {
    return this.repo.transaction(() => this.repo.removeCaster(this.editable(tournamentId, round, number, staff).id, caster));
  }
  view(tournamentId: string, round: number, number: number) {
    const match = this.match(tournamentId, round, number);
    return { match, stream: this.repo.stream(match.id), casters: this.repo.casters(match.id) };
  }
  forMatch(matchId: string) { return { stream: this.repo.stream(matchId), casters: this.repo.casters(matchId) }; }
  validatePersistedState(tournamentId: string): void {
    this.repo.validate(tournamentId);
    for (const match of this.matches.list(tournamentId)) {
      const { stream, casters } = this.forMatch(match.id);
      if ((stream || casters.length) && (!match.team1 || !match.team2 ||
          !['READY','ROOM_OPEN','SCHEDULED','READY_TO_START','LIVE','COMPLETED'].includes(match.status)))
        throw new StreamError('CORRUPT_STREAM', 'Thông tin livestream thuộc trận chưa xác định đội.');
      if (stream) {
        validateStreamUrl(stream.url);
        if (stream.title && (stream.title.length > 100 || /[\x00-\x1f\x7f]/.test(stream.title)))
          throw new StreamError('CORRUPT_STREAM', 'Tiêu đề livestream đã lưu không hợp lệ.');
      }
    }
  }
}
