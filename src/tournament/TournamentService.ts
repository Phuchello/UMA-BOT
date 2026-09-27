import crypto from 'node:crypto';
import type { EngineBracket, TournamentEngine } from './TournamentEngine.js';
import { TournamentOrganizerAdapter } from './TournamentOrganizerAdapter.js';
import { TournamentRepository, type ByeRow, type MatchRow, type SeedRow, type TournamentSummary } from './TournamentRepository.js';

export class TournamentError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}

export interface BracketView { bracket: EngineBracket; seeds: SeedRow[]; matches: MatchRow[]; byes: ByeRow[] }
export interface DrawResult extends BracketView { eligibleCount: number }

export class TournamentService {
  constructor(
    private readonly repo: TournamentRepository,
    private readonly engineFactory: () => TournamentEngine = () => new TournamentOrganizerAdapter()
  ) {}

  public summary(tournamentId: string): TournamentSummary {
    const summary = this.repo.summary(tournamentId);
    if (!summary) throw new TournamentError('TOURNAMENT_NOT_FOUND', 'Giải đấu chưa được khởi tạo.');
    return summary;
  }

  public openCheckin(tournamentId: string): TournamentSummary {
    return this.repo.transaction(() => {
      const summary = this.summary(tournamentId);
      if (summary.status !== 'registration_open') {
        throw new TournamentError('INVALID_PHASE', 'Giai đoạn check-in đã mở hoặc giải đấu đã tiến sang giai đoạn tiếp theo.');
      }
      if (summary.pending || summary.needsCorrection) {
        throw new TournamentError('UNRESOLVED_REGISTRATIONS', 'Cần xử lý hết đơn chờ duyệt và đơn yêu cầu chỉnh sửa trước khi khóa đăng ký.');
      }
      if (summary.approved < 2) {
        throw new TournamentError('TOO_FEW_APPROVED', 'Cần ít nhất 2 đội đã duyệt để mở check-in.');
      }
      if (!this.repo.transition(tournamentId, 'registration_open', 'checkin_open')) {
        throw new TournamentError('CONFLICT', 'Trạng thái giải đấu vừa thay đổi.');
      }
      return this.summary(tournamentId);
    });
  }

  public checkIn(tournamentId: string, teamId: string, actorDiscordId: string): { teamName: string; repeated: boolean } {
    return this.repo.transaction(() => {
      if (this.summary(tournamentId).status !== 'checkin_open') {
        throw new TournamentError('INVALID_PHASE', 'Check-in chưa mở hoặc đã khóa sau khi bốc thăm.');
      }
      const team = this.repo.team(teamId);
      if (!team || team.tournamentId !== tournamentId) {
        throw new TournamentError('NO_TEAM', 'Bạn chưa có đội trong giải đấu hiện tại.');
      }
      if (team.captainDiscordId !== actorDiscordId) {
        throw new TournamentError('NOT_CAPTAIN', 'Chỉ đội trưởng của đội này được check-in.');
      }
      if (team.status !== 'APPROVED') {
        throw new TournamentError('NOT_APPROVED', 'Đội chưa được duyệt nên không thể check-in.');
      }
      if (this.repo.checkedIn(tournamentId, teamId)) return { teamName: team.name, repeated: true };
      this.repo.insertCheckin(tournamentId, teamId, actorDiscordId);
      return { teamName: team.name, repeated: false };
    });
  }

  public checkinView(tournamentId: string): TournamentSummary & { checkedInNames: string[]; missingNames: string[] } {
    const summary = this.summary(tournamentId);
    const names = this.repo.approvedCheckinNames(tournamentId);
    return { ...summary, checkedInNames: names.checkedIn, missingNames: names.missing };
  }

  public draw(tournamentId: string, staffDiscordId: string): DrawResult {
    return this.repo.transaction(() => {
      const tournament = this.repo.tournament(tournamentId);
      if (!tournament) throw new TournamentError('TOURNAMENT_NOT_FOUND', 'Giải đấu chưa được khởi tạo.');
      if (tournament.status !== 'checkin_open' || this.repo.bracketState(tournamentId)) {
        throw new TournamentError('DRAW_CLOSED', 'Nhánh đấu đã được bốc thăm hoặc giải đấu không ở giai đoạn check-in. Không thể bốc thăm lại.');
      }
      const eligible = this.repo.eligible(tournamentId);
      if (eligible.length < 2) throw new TournamentError('TOO_FEW_CHECKINS', 'Cần ít nhất 2 đội đã duyệt và check-in để bốc thăm.');

      // Fisher–Yates with rejection-sampled cryptographic integers. The persisted
      // mapping, rather than an RNG seed, is the auditable source of truth.
      for (let i = eligible.length - 1; i > 0; i--) {
        const j = crypto.randomInt(i + 1);
        [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
      }
      const seeds: SeedRow[] = eligible.map((team, index) => ({ teamId: team.id, name: team.name, seed: index + 1 }));
      const engine = this.engineFactory();
      engine.createTournament(tournamentId, tournament.name, { format: 'single-elimination', bestOf: 3 });
      engine.registerTeams(seeds.map(seed => ({ id: seed.teamId, name: seed.name, seed: seed.seed })));
      const bracket = engine.startTournament();
      if (bracket.tournamentId !== tournamentId || bracket.matches.length !== eligible.length - 1) {
        throw new TournamentError('INVALID_BRACKET', 'Engine trả về nhánh đấu không hợp lệ.');
      }
      const serialized = engine.serialize();
      const byes = this.deriveByes(bracket, seeds);
      this.repo.saveDraw(tournamentId, staffDiscordId, seeds, bracket, serialized, byes);
      if (!this.repo.transition(tournamentId, 'checkin_open', 'bracket_ready')) {
        throw new TournamentError('CONFLICT', 'Trạng thái giải đấu vừa thay đổi.');
      }
      const saved = this.restoreBracket(tournamentId);
      if (!saved) throw new TournamentError('PERSISTENCE_FAILURE', 'Không thể khôi phục nhánh đấu vừa lưu.');
      return { ...saved, eligibleCount: eligible.length };
    });
  }

  /** Restore from persisted state every time; startup calls this as a validation gate. */
  public restoreBracket(tournamentId: string): BracketView | null {
    const serialized = this.repo.bracketState(tournamentId);
    if (!serialized) return null;
    const engine = this.engineFactory();
    engine.restore(serialized);
    const bracket = engine.getBracket();
    const seeds = this.repo.seeds(tournamentId);
    const matches = this.repo.matches(tournamentId);
    const byes = this.repo.byes(tournamentId);
    const expectedByes = 2 ** Math.ceil(Math.log2(seeds.length)) - seeds.length;
    if (bracket.tournamentId !== tournamentId || bracket.matches.length !== matches.length ||
        bracket.matches.some(match => !matches.some(saved => saved.engineMatchId === match.id)) ||
        seeds.length < 2 || seeds.some((seed, index) => seed.seed !== index + 1) ||
        byes.length !== expectedByes || byes.some(bye =>
          !seeds.some(seed => seed.teamId === bye.teamId) ||
          !matches.some(match => match.engineMatchId === bye.advanceToEngineMatchId))) {
      throw new TournamentError('CORRUPT_BRACKET', 'Dữ liệu nhánh đấu đã lưu không nhất quán.');
    }
    return { bracket, seeds, matches, byes };
  }

  private deriveByes(bracket: EngineBracket, seeds: SeedRow[]): ByeRow[] {
    if (bracket.totalRounds === 1) return [];
    const roundOneParticipants = new Set(bracket.matches.filter(match => match.round === 1)
      .flatMap(match => [match.team1.id, match.team2.id].filter((id): id is string => id !== null)));
    const byes = seeds.filter(seed => !roundOneParticipants.has(seed.teamId)).map(seed => {
      const destination = bracket.matches.find(match => match.round === 2 &&
        (match.team1.id === seed.teamId || match.team2.id === seed.teamId));
      if (!destination) throw new TournamentError('INVALID_BYE', 'Không tìm thấy đường đi BYE trong nhánh đấu.');
      return { teamId: seed.teamId, advanceToEngineMatchId: destination.id, round: 1 };
    });
    const slots = 2 ** Math.ceil(Math.log2(seeds.length));
    if (byes.length !== slots - seeds.length) throw new TournamentError('INVALID_BYE', 'Số đường đi BYE không khớp nhánh đấu.');
    return byes;
  }
}
