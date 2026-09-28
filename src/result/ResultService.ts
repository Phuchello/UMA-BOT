import { errorCategory } from '../operations/logging.js';
import crypto from 'node:crypto';
import type { TournamentEngine } from '../tournament/TournamentEngine.js';
import { TournamentOrganizerAdapter } from '../tournament/TournamentOrganizerAdapter.js';
import { MatchRepository, type MatchRecord } from '../match/MatchRepository.js';
import { ResultRepository, type ResultSubmission, type CanonicalResult } from './ResultRepository.js';
import type { EvidenceGateway, EvidenceInput } from './EvidenceGateway.js';

export class ResultError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}
export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;
const imageTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);

export function validBo3(team1: number, team2: number): boolean {
  return Number.isInteger(team1) && Number.isInteger(team2) && team1 >= 0 && team2 >= 0 &&
    ((team1 === 2 && team2 <= 1) || (team2 === 2 && team1 <= 1));
}
function reasonText(reason: string): string {
  const value = reason.trim();
  if (value.length < 3 || value.length > 500) throw new ResultError('INVALID_REASON', 'Lý do phải có từ 3 đến 500 ký tự.');
  return value;
}

export class ResultService {
  private readonly cardUpdates = new Map<string, Promise<void>>();
  private readonly correctionsInFlight = new Set<string>();
  constructor(
    private readonly repo: ResultRepository,
    private readonly matches: MatchRepository,
    private readonly gateway: EvidenceGateway,
    private readonly engineFactory: () => TournamentEngine = () => new TournamentOrganizerAdapter(),
    private readonly now: () => number = () => Date.now()
  ) {}

  public matchInRoom(tournamentId: string, threadId: string): MatchRecord {
    const match = this.matches.list(tournamentId).find(item => item.room?.threadId === threadId);
    if (!match) throw new ResultError('WRONG_ROOM', 'Lệnh này chỉ dùng trong phòng trận đã lưu.');
    return match;
  }

  public async submit(tournamentId: string, threadId: string, actor: string,
    myScore: number, opponentScore: number, input: EvidenceInput): Promise<ResultSubmission> {
    if (!validBo3(myScore, opponentScore)) throw new ResultError('INVALID_SCORE', 'BO3 chỉ nhận 2–0, 2–1, 0–2 hoặc 1–2.');
    if (!input.contentType || !imageTypes.has(input.contentType) || !Number.isInteger(input.size) ||
        input.size <= 0 || input.size > MAX_EVIDENCE_BYTES) {
      throw new ResultError('INVALID_EVIDENCE', 'Chỉ nhận ảnh PNG, JPEG hoặc WebP tối đa 10 MiB.');
    }
    const preflight = () => {
      if (this.repo.tournamentStatus(tournamentId) !== 'in_progress') throw new ResultError('INVALID_PHASE', 'Giải đấu chưa ở giai đoạn thi đấu.');
      const match = this.matchInRoom(tournamentId, threadId);
      if (match.status !== 'LIVE' || !match.team1 || !match.team2 || this.repo.canonical(match.id)) {
        throw new ResultError('INVALID_MATCH', 'Trận chưa LIVE hoặc đã có kết quả chính thức.');
      }
      const ownTeam = [match.team1, match.team2].find(team => team.captainId === actor);
      if (!ownTeam) throw new ResultError('NOT_CAPTAIN', 'Chỉ đội trưởng đang thi đấu được báo kết quả.');
      if (this.repo.open(match.id)) throw new ResultError('OPEN_SUBMISSION', 'Trận đã có báo cáo đang chờ xử lý.');
      return { match, ownTeam };
    };
    const { match, ownTeam } = preflight();
    const submission: ResultSubmission = {
      id: `submission_${crypto.randomUUID()}`, tournamentId, matchId: match.id, reporterId: actor,
      reporterTeamId: ownTeam.id, team1Score: ownTeam.id === match.team1!.id ? myScore : opponentScore,
      team2Score: ownTeam.id === match.team2!.id ? myScore : opponentScore,
      status: 'PENDING', submittedAt: this.now(), evidenceMessageId: null, disputeReason: null, rejectionReason: null
    };
    const archived = await this.gateway.archiveEvidence(match, submission, input);
    try {
      this.repo.transaction(() => {
        preflight();
        this.repo.insertSubmission(submission, archived, this.now());
        this.repo.audit(match, submission.id, actor, 'SUBMIT_RESULT', null, 'PENDING', this.now());
      });
    } catch (error) {
      try { await this.gateway.deleteEvidenceMessage(threadId, archived.messageId); }
      catch (cleanupError) {
        console.error(`Orphan result evidence message ${archived.messageId} for match ${match.id}; cleanup failed`, errorCategory(cleanupError));
      }
      throw error;
    }
    return this.repo.submission(submission.id)!;
  }

  public async confirm(tournamentId: string, threadId: string, submissionId: string, actor: string): Promise<ResultSubmission> {
    const updated = this.repo.transaction(() => {
      const { match, submission } = this.openInRoom(tournamentId, threadId, submissionId);
      this.requireOpponent(match, submission, actor);
      if (submission.status === 'CONFIRMED') return submission;
      if (submission.status !== 'PENDING') throw new ResultError('INVALID_STATE', 'Báo cáo không còn chờ xác nhận.');
      this.repo.transition(submission, 'CONFIRMED', this.now());
      this.repo.audit(match, submission.id, actor, 'CONFIRM_RESULT', 'PENDING', 'CONFIRMED', this.now());
      return this.repo.submission(submission.id)!;
    });
    await this.refreshCards(tournamentId, updated.matchId);
    return updated;
  }

  public async dispute(tournamentId: string, threadId: string, submissionId: string, actor: string, reason: string): Promise<ResultSubmission> {
    const text = reasonText(reason);
    const updated = this.repo.transaction(() => {
      const { match, submission } = this.openInRoom(tournamentId, threadId, submissionId);
      const teamId = this.requireOpponent(match, submission, actor);
      if (submission.status !== 'PENDING') throw new ResultError('INVALID_STATE', 'Chỉ báo cáo đang chờ mới được khiếu nại.');
      this.repo.insertDispute(submission, actor, teamId, text, this.now());
      this.repo.transition(submission, 'DISPUTED', this.now());
      this.repo.audit(match, submission.id, actor, 'DISPUTE_RESULT', 'PENDING', 'DISPUTED', this.now());
      return this.repo.submission(submission.id)!;
    });
    await this.refreshCards(tournamentId, updated.matchId);
    return updated;
  }

  public async reject(tournamentId: string, threadId: string, submissionId: string, actor: string,
    staff: boolean, reason: string): Promise<ResultSubmission> {
    const text = reasonText(reason);
    const updated = this.repo.transaction(() => {
      const { match, submission } = this.openInRoom(tournamentId, threadId, submissionId);
      this.requireReferee(match, actor, staff);
      this.repo.transition(submission, 'REJECTED', this.now(), text);
      this.repo.audit(match, submission.id, actor, 'REJECT_RESULT', submission.status, 'REJECTED', this.now());
      return this.repo.submission(submission.id)!;
    });
    await this.refreshCards(tournamentId, updated.matchId);
    return updated;
  }

  public async approve(tournamentId: string, threadId: string, submissionId: string, actor: string, staff: boolean): Promise<CanonicalResult> {
    return this.adjudicate(tournamentId, threadId, submissionId, actor, staff, null);
  }

  public async resolve(tournamentId: string, threadId: string, actor: string, staff: boolean,
    team1Score: number, team2Score: number, reason: string): Promise<CanonicalResult> {
    if (!validBo3(team1Score, team2Score)) throw new ResultError('INVALID_SCORE', 'BO3 chỉ nhận 2–0, 2–1, 0–2 hoặc 1–2.');
    const text = reasonText(reason);
    const match = this.matchInRoom(tournamentId, threadId);
    const submission = this.repo.open(match.id);
    if (!submission) throw new ResultError('NO_SUBMISSION', 'Không có báo cáo tranh chấp đang mở.');
    return this.adjudicate(tournamentId, threadId, submission.id, actor, staff, { team1Score, team2Score, reason: text });
  }

  private async adjudicate(tournamentId: string, threadId: string, submissionId: string, actor: string, staff: boolean,
    override: { team1Score: number; team2Score: number; reason: string } | null): Promise<CanonicalResult> {
    const result = this.repo.transaction(() => {
      const { match, submission } = this.openInRoom(tournamentId, threadId, submissionId);
      this.requireReferee(match, actor, staff);
      if (override ? submission.status !== 'DISPUTED' : !['PENDING', 'CONFIRMED'].includes(submission.status)) {
        throw new ResultError('INVALID_STATE', 'Báo cáo cần được xử lý theo đúng trạng thái.');
      }
      const score1 = override?.team1Score ?? submission.team1Score;
      const score2 = override?.team2Score ?? submission.team2Score;
      if (!validBo3(score1, score2)) throw new ResultError('INVALID_SCORE', 'Điểm BO3 không hợp lệ.');
      const saved = this.repo.bracket(tournamentId);
      if (!saved) throw new ResultError('CORRUPT_BRACKET', 'Không có nhánh đấu đã lưu.');
      const engine = this.engineFactory();
      engine.restore(saved.state);
      const before = engine.getMatch(match.engineMatchId);
      if (!before || before.hasEnded || before.team1.id !== match.team1?.id || before.team2.id !== match.team2?.id) {
        throw new ResultError('ENGINE_MISMATCH', 'Đội trong engine không khớp trận đã lưu.');
      }
      const { bracket } = engine.reportResult(match.engineMatchId, score1, score2);
      const ended = bracket.matches.find(item => item.id === match.engineMatchId);
      const expectedWinner = score1 > score2 ? match.team1!.id : match.team2!.id;
      const expectedLoser = score1 > score2 ? match.team2!.id : match.team1!.id;
      if (!ended?.hasEnded || ended.winnerId !== expectedWinner || ended.loserId !== expectedLoser ||
          ended.team1.score !== score1 || ended.team2.score !== score2) {
        throw new ResultError('ENGINE_MISMATCH', 'Engine trả về kết quả khác báo cáo được duyệt.');
      }
      for (const appMatch of this.matches.list(tournamentId)) {
        const engineMatch = bracket.matches.find(item => item.id === appMatch.engineMatchId);
        if (!engineMatch) throw new ResultError('ENGINE_MISMATCH', 'Thiếu trận engine tương ứng.');
        if (appMatch.status === 'WAITING') {
          if ((appMatch.team1 && appMatch.team1.id !== engineMatch.team1.id) ||
              (appMatch.team2 && appMatch.team2.id !== engineMatch.team2.id)) {
            throw new ResultError('ENGINE_MISMATCH', 'Đội đã xác định ở vòng sau bị thay đổi.');
          }
          if (engineMatch.team1.id !== (appMatch.team1?.id ?? null) || engineMatch.team2.id !== (appMatch.team2?.id ?? null)) {
            this.repo.updateWaiting(appMatch, engineMatch, this.now());
          }
        } else if (engineMatch.team1.id !== (appMatch.team1?.id ?? null) || engineMatch.team2.id !== (appMatch.team2?.id ?? null)) {
          throw new ResultError('ENGINE_MISMATCH', 'Nhánh đấu engine và trận ứng dụng không khớp.');
        }
      }
      this.repo.insertCanonical(match, submission, score1, score2, expectedWinner, expectedLoser, actor, override?.reason ?? null, this.now());
      this.repo.transition(submission, 'APPROVED', this.now());
      this.repo.completeMatch(match, this.now());
      this.repo.saveBracket(tournamentId, saved.version, engine.serialize());
      this.repo.audit(match, submission.id, actor, override ? 'RESOLVE_DISPUTE' : 'APPROVE_RESULT', submission.status, 'APPROVED', this.now());
      this.repo.audit(match, submission.id, actor, 'ENGINE_ADVANCE', 'LIVE', 'COMPLETED', this.now());
      if (bracket.status === 'completed') {
        const final = [...bracket.matches].sort((a, b) => b.round - a.round)[0];
        const appFinal = this.matches.list(tournamentId).find(item => item.engineMatchId === final.id);
        if (!appFinal || final.id !== match.engineMatchId || final.winnerId !== expectedWinner || final.loserId !== expectedLoser) {
          throw new ResultError('ENGINE_MISMATCH', 'Kết thúc giải không khớp trận chung kết.');
        }
        this.repo.insertOutcome(tournamentId, expectedWinner, expectedLoser, appFinal.id, actor, this.now());
        this.repo.audit(match, submission.id, actor, 'TOURNAMENT_COMPLETE', 'in_progress', 'completed', this.now());
      }
      return this.repo.canonical(match.id)!;
    });
    await this.refreshCards(tournamentId, result.matchId);
    return result;
  }

  public async correct(tournamentId: string, round: number, number: number, score1: number, score2: number,
    reason: string, confirm: boolean, actor: string, staff: boolean): Promise<CanonicalResult> {
    if (!staff) throw new ResultError('NOT_STAFF', 'Chỉ Ban Tổ Chức được hiệu chỉnh kết quả.');
    if (confirm !== true) throw new ResultError('CONFIRM_REQUIRED', 'Cần xác nhận hiệu chỉnh kết quả.');
    const text = reason.trim();
    if (text.length < 10 || text.length > 500) throw new ResultError('INVALID_REASON', 'Lý do hiệu chỉnh phải có từ 10 đến 500 ký tự.');
    if (!validBo3(score1, score2)) throw new ResultError('INVALID_SCORE', 'BO3 chỉ nhận 2–0, 2–1, 0–2 hoặc 1–2.');
    if (!Number.isInteger(round) || round < 1 || !Number.isInteger(number) || number < 1)
      throw new ResultError('INVALID_SELECTOR', 'Vòng và trận phải là số nguyên dương.');
    const key = `${tournamentId}:${round}:${number}`;
    if (this.correctionsInFlight.has(key)) throw new ResultError('CONFLICT', 'Trận đang được hiệu chỉnh. Hãy thử lại sau.');
    this.correctionsInFlight.add(key);
    try {
      const result = this.repo.transaction(() => {
        const match = this.matches.bySelector(tournamentId, round, number);
        if (!match || match.status !== 'COMPLETED' || !match.team1 || !match.team2)
          throw new ResultError('INVALID_MATCH', 'Chỉ có thể hiệu chỉnh trận đã hoàn tất có hai đội.');
        const old = this.repo.canonical(match.id);
        if (!old) throw new ResultError('MISSING_CANONICAL', 'Trận thiếu kết quả chính thức.');
        if (old.team1Score === score1 && old.team2Score === score2) throw new ResultError('NO_CHANGE', 'Tỷ số mới trùng kết quả hiện tại.');
        const saved = this.repo.bracket(tournamentId);
        if (!saved) throw new ResultError('CORRUPT_BRACKET', 'Không có nhánh đấu đã lưu.');
        if (!this.repo.correctionHistoryValid(tournamentId))
          throw new ResultError('CORRUPT_HISTORY', 'Lịch sử hiệu chỉnh không nhất quán.');
        const engine = this.engineFactory(); engine.restore(saved.state);
        const before = engine.getBracket();
        const target = before.matches.find(item => item.id === match.engineMatchId);
        if (!target?.hasEnded || target.team1.id !== match.team1.id || target.team2.id !== match.team2.id ||
            target.team1.score !== old.team1Score || target.team2.score !== old.team2Score ||
            target.winnerId !== old.winnerTeamId || target.loserId !== old.loserTeamId)
          throw new ResultError('ENGINE_MISMATCH', 'Engine không khớp kết quả chính thức.');
        const outcome = this.repo.outcome(tournamentId);
        const isFinal = before.matches.every(item => item.round <= match.round);
        if (isFinal && (this.repo.tournamentStatus(tournamentId) !== 'completed' || outcome?.finalMatchId !== match.id))
          throw new ResultError('ENGINE_MISMATCH', 'Chung kết và trạng thái giải không nhất quán.');
        let reset;
        try { reset = engine.resetResult(match.engineMatchId).bracket; }
        catch { throw new ResultError('CORRECTION_LOCKED', 'Nhánh sau đã vận hành; không thể hiệu chỉnh trận này.'); }
        const affected = new Set<string>();
        for (const oldMatch of before.matches) {
          if (oldMatch.id === target.id) continue;
          const cleared = reset.matches.find(item => item.id === oldMatch.id);
          if (!cleared) throw new ResultError('ENGINE_MISMATCH', 'Thiếu trận sau khi reset trong bộ nhớ.');
          if (oldMatch.team1.id !== cleared.team1.id || oldMatch.team2.id !== cleared.team2.id ||
              oldMatch.hasEnded !== cleared.hasEnded || oldMatch.winnerId !== cleared.winnerId ||
              oldMatch.loserId !== cleared.loserId || oldMatch.isActive !== cleared.isActive ||
              oldMatch.team1.score !== cleared.team1.score || oldMatch.team2.score !== cleared.team2.score)
            affected.add(oldMatch.id);
        }
        const appMatches = this.matches.list(tournamentId);
        for (const appMatch of appMatches) {
          const original = before.matches.find(item => item.id === appMatch.engineMatchId);
          if (!original || original.team1.id !== (appMatch.team1?.id ?? null) ||
              original.team2.id !== (appMatch.team2?.id ?? null) ||
              original.hasEnded !== (appMatch.status === 'COMPLETED'))
            throw new ResultError('ENGINE_MISMATCH', 'Nhánh đấu và trận ứng dụng không khớp trước hiệu chỉnh.');
        }
        for (const engineId of affected) {
          const downstream = appMatches.find(item => item.engineMatchId === engineId);
          if (!downstream) throw new ResultError('ENGINE_MISMATCH', 'Thiếu trận ứng dụng sau khi reset.');
          if (!['WAITING', 'READY'].includes(downstream.status) || downstream.room ||
              downstream.scheduledAt !== null || downstream.readyTeamIds.length || downstream.refereeIds.length ||
              downstream.startedAt !== null || downstream.result || this.repo.canonical(downstream.id) ||
              this.repo.submissions(downstream.id).length)
            throw new ResultError('CORRECTION_LOCKED', 'Trận sau đã có hoạt động; không thể hiệu chỉnh.');
        }
        const corrected = engine.reportResult(match.engineMatchId, score1, score2).bracket;
        const ended = corrected.matches.find(item => item.id === target.id);
        const winner = score1 > score2 ? match.team1.id : match.team2.id;
        const loser = score1 > score2 ? match.team2.id : match.team1.id;
        if (!ended?.hasEnded || ended.winnerId !== winner || ended.loserId !== loser ||
            ended.team1.score !== score1 || ended.team2.score !== score2)
          throw new ResultError('ENGINE_MISMATCH', 'Engine trả về kết quả hiệu chỉnh không nhất quán.');
        for (const appMatch of appMatches) {
          if (appMatch.id === match.id) continue;
          const engineMatch = corrected.matches.find(item => item.id === appMatch.engineMatchId);
          if (!engineMatch) throw new ResultError('ENGINE_MISMATCH', 'Thiếu trận sau hiệu chỉnh.');
          const different = engineMatch.team1.id !== (appMatch.team1?.id ?? null) ||
            engineMatch.team2.id !== (appMatch.team2?.id ?? null);
          if (different) {
            if (!affected.has(appMatch.engineMatchId)) throw new ResultError('ENGINE_MISMATCH', 'Trận không phụ thuộc bị đổi đội.');
            this.repo.updatePassive(appMatch, engineMatch, this.now());
          }
        }
        this.repo.insertCorrection(old, score1, score2, winner, loser, actor, text, saved.version, this.now());
        this.repo.updateCanonical(old, score1, score2, winner, loser);
        this.repo.saveBracket(tournamentId, saved.version, engine.serialize());
        if (isFinal) this.repo.updateOutcome(tournamentId, match.id, winner, loser);
        this.repo.audit(match, old.submissionId, actor, 'CORRECT_RESULT', String(old.revision), String(old.revision + 1), this.now());
        return this.repo.canonical(match.id)!;
      });
      await this.refreshCards(tournamentId, result.matchId);
      return result;
    } finally { this.correctionsInFlight.delete(key); }
  }

  public history(tournamentId: string, round: number, number: number, staff: boolean) {
    if (!staff) throw new ResultError('NOT_STAFF', 'Chỉ Ban Tổ Chức được xem lịch sử hiệu chỉnh.');
    const match = this.matches.bySelector(tournamentId, round, number);
    if (!match) throw new ResultError('MATCH_NOT_FOUND', 'Không tìm thấy trận.');
    const canonical = this.repo.canonical(match.id);
    if (!canonical) throw new ResultError('MISSING_CANONICAL', 'Trận chưa có kết quả chính thức.');
    return { match, canonical, corrections: this.repo.correctionHistory(match.id) };
  }

  public async refresh(tournamentId: string, threadId: string, actor: string, staff: boolean): Promise<void> {
    const match = this.matchInRoom(tournamentId, threadId);
    this.requireReferee(match, actor, staff);
    await this.refreshCards(tournamentId, match.id);
  }

  public results(tournamentId: string): CanonicalResult[] { return this.repo.allCanonical(tournamentId); }
  public outcome(tournamentId: string) { return this.repo.outcome(tournamentId); }

  public validatePersistedState(tournamentId: string): void {
    const bracket = this.repo.bracket(tournamentId);
    const matches = this.matches.list(tournamentId);
    const outcomes = this.repo.outcome(tournamentId);
    const phase = this.repo.tournamentStatus(tournamentId);
    if (!bracket) {
      if (outcomes || matches.length) throw new ResultError('CORRUPT_RESULT', 'Thiếu engine state của giải.');
      return;
    }
    const engine = this.engineFactory(); engine.restore(bracket.state);
    const engineBracket = engine.getBracket();
    if (this.repo.orphanApprovedCount(tournamentId) || this.repo.missingEvidenceCount(tournamentId) ||
        !this.repo.correctionHistoryValid(tournamentId)) {
      throw new ResultError('CORRUPT_RESULT', 'Báo cáo thiếu kết quả chính thức hoặc bằng chứng đã lưu.');
    }
    for (const match of matches) {
      const canonical = this.repo.canonical(match.id);
      const open = this.repo.open(match.id);
      const engineMatch = engine.getMatch(match.engineMatchId);
      if (!engineMatch || engineMatch.team1.id !== (match.team1?.id ?? null) ||
          engineMatch.team2.id !== (match.team2?.id ?? null) ||
          (!!canonical !== (match.status === 'COMPLETED')) ||
          (canonical && (!engineMatch.hasEnded || !validBo3(canonical.team1Score, canonical.team2Score) ||
            engineMatch.team1.score !== canonical.team1Score || engineMatch.team2.score !== canonical.team2Score ||
            engineMatch.winnerId !== canonical.winnerTeamId || engineMatch.loserId !== canonical.loserTeamId ||
            canonical.winnerTeamId === canonical.loserTeamId ||
            ![match.team1?.id, match.team2?.id].includes(canonical.winnerTeamId) || open ||
            this.repo.submission(canonical.submissionId)?.status !== 'APPROVED')) ||
          (match.status !== 'COMPLETED' && engineMatch.hasEnded)) {
        throw new ResultError('CORRUPT_RESULT', `Dữ liệu kết quả R${match.round}-M${match.number} không nhất quán.`);
      }
    }
    const engineFinal = [...engineBracket.matches].sort((a, b) => b.round - a.round)[0];
    const appFinal = matches.find(item => item.engineMatchId === engineFinal?.id);
    if ((phase === 'completed') !== !!outcomes || (phase === 'completed') !== (engineBracket.status === 'completed') ||
        (outcomes && (!appFinal || appFinal.id !== outcomes.finalMatchId || appFinal.status !== 'COMPLETED' ||
          engineFinal.winnerId !== outcomes.championTeamId || engineFinal.loserId !== outcomes.runnerUpTeamId))) {
      throw new ResultError('CORRUPT_RESULT', 'Kết thúc giải và nhà vô địch không nhất quán.');
    }
  }

  private openInRoom(tournamentId: string, threadId: string, submissionId: string) {
    if (this.repo.tournamentStatus(tournamentId) !== 'in_progress') throw new ResultError('INVALID_PHASE', 'Giải đấu chưa ở giai đoạn thi đấu.');
    const match = this.matchInRoom(tournamentId, threadId);
    const submission = this.repo.submission(submissionId);
    if (match.status !== 'LIVE' || !submission || submission.matchId !== match.id ||
        submission.tournamentId !== tournamentId || this.repo.canonical(match.id) ||
        !['PENDING', 'CONFIRMED', 'DISPUTED'].includes(submission.status)) {
      throw new ResultError('INVALID_STATE', 'Báo cáo không còn mở cho trận này.');
    }
    return { match, submission };
  }
  private requireOpponent(match: MatchRecord, submission: ResultSubmission, actor: string): string {
    const opponent = [match.team1, match.team2].find(team => team && team.id !== submission.reporterTeamId);
    if (!opponent || opponent.captainId !== actor || actor === submission.reporterId) {
      throw new ResultError('NOT_OPPONENT', 'Chỉ đội trưởng đối thủ được xác nhận hoặc khiếu nại.');
    }
    return opponent.id;
  }
  private requireReferee(match: MatchRecord, actor: string, staff: boolean): void {
    if (!staff && !match.refereeIds.includes(actor)) throw new ResultError('NOT_REFEREE', 'Chỉ trọng tài trận này hoặc BTC được xử lý.');
  }
  private async refreshCards(tournamentId: string, matchId: string): Promise<void> {
    const previous = this.cardUpdates.get(matchId) ?? Promise.resolve();
    const update = previous.catch(() => {}).then(async () => {
      const match = this.matches.byId(tournamentId, matchId)!;
      for (const submission of this.repo.submissions(matchId)) {
        if (submission.evidenceMessageId) await this.gateway.editEvidenceCard(match, submission);
      }
      await this.gateway.editMatchStarter(match);
    });
    this.cardUpdates.set(matchId, update);
    try {
      await update;
    } catch (error) {
      console.error(`Result state saved for ${matchId}, Discord card refresh failed:`, errorCategory(error));
      throw new ResultError('CARD_REFRESH_FAILED', 'Đã lưu kết quả nhưng chưa cập nhật được thẻ Discord. Dùng /uma result-refresh.');
    } finally {
      if (this.cardUpdates.get(matchId) === update) this.cardUpdates.delete(matchId);
    }
  }
}
