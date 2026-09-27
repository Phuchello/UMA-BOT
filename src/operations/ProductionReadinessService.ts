import { DatabaseSync } from 'node:sqlite';
import type { EnvConfig } from '../config/env.js';
import { TournamentRepository } from '../tournament/TournamentRepository.js';
import { TournamentService } from '../tournament/TournamentService.js';
import { MatchService } from '../match/MatchService.js';
import { ResultService } from '../result/ResultService.js';
import { PublicationService } from '../publication/PublicationService.js';
import { StreamService } from '../stream/StreamService.js';

export type CheckLevel = 'PASS' | 'WARN' | 'FAIL';
export interface ReadinessCheck { level: CheckLevel; label: string; detail: string }
export interface ResourceProbe { check(config: EnvConfig): Promise<ReadinessCheck[]> }
export class ProductionReadinessService {
  constructor(private readonly db: DatabaseSync, private readonly config: EnvConfig,
    private readonly tournamentRepo: TournamentRepository, private readonly tournaments: TournamentService,
    private readonly matches: MatchService, private readonly results: ResultService,
    private readonly publication: PublicationService, private readonly streams: StreamService,
    private readonly resources: ResourceProbe) {}
  async run(staff: boolean): Promise<ReadinessCheck[]> {
    if (!staff) throw new Error('Chỉ Ban Tổ Chức được chạy /uma doctor.');
    const checks: ReadinessCheck[] = [];
    const check = (label: string, action: () => void) => {
      try { action(); checks.push({ level: 'PASS', label, detail: 'Hợp lệ' }); }
      catch { checks.push({ level: 'FAIL', label, detail: 'Không nhất quán; cần BTC kiểm tra.' }); }
    };
    const id = this.config.ACTIVE_TOURNAMENT_ID;
    const tournament = this.tournamentRepo.tournament(id);
    checks.push(tournament && ['registration_open','checkin_open','bracket_ready','in_progress','completed'].includes(tournament.status)
      ? { level: 'PASS', label: 'Giải đấu', detail: tournament.status }
      : { level: 'FAIL', label: 'Giải đấu', detail: 'Thiếu giải đấu hoặc trạng thái không hợp lệ.' });
    check('SQLite quick_check', () => {
      const rows = this.db.prepare('PRAGMA quick_check').all() as { quick_check: string }[];
      if (rows.length !== 1 || rows[0].quick_check !== 'ok') throw new Error('quick_check');
    });
    if (tournament) {
      check('Khôi phục nhánh đấu', () => {
        const restored = this.tournaments.restoreBracket(id);
        if (['bracket_ready','in_progress','completed'].includes(tournament.status) && !restored) throw new Error('missing bracket');
      });
      check('Trạng thái trận', () => this.matches.validatePersistedState(id));
      check('Kết quả và lịch sử', () => this.results.validatePersistedState(id));
      check('Xuất bản', () => this.publication.validatePersistedState(id));
      check('Livestream và caster', () => this.streams.validatePersistedState(id));
    }
    try { checks.push(...await this.resources.check(this.config)); }
    catch { checks.push({ level: 'FAIL', label: 'Discord resources', detail: 'Không xác minh được tài nguyên đã cấu hình.' }); }
    return checks;
  }
  static format(checks: ReadinessCheck[]): string {
    const lines = checks.map(item => `${item.level === 'PASS' ? '✅' : item.level === 'WARN' ? '⚠️' : '❌'} ${item.level} ${item.label}: ${item.detail}`);
    return (`🩺 UMA CUP — KIỂM TRA SẴN SÀNG\n${lines.join('\n')}`).slice(0, 1900);
  }
}
