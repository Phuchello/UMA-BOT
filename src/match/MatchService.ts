import { MatchRepository, type MatchRecord, type MatchState } from './MatchRepository.js';
import type { MatchRoomGateway } from './MatchRoomGateway.js';
import { TournamentRepository } from '../tournament/TournamentRepository.js';
import { TournamentService } from '../tournament/TournamentService.js';

export class MatchError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}

export interface RoomCreationSummary {
  created: number; alreadyExisting: number; skippedWaiting: number;
  skippedMissingReferee: number; skippedInvalid: number; failures: number;
}

export function parseVietnamTime(input: string, now: number): number {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(input);
  if (!match) throw new MatchError('INVALID_TIME', 'Dùng định dạng YYYY-MM-DD HH:mm (giờ Việt Nam).');
  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const [year, month, day, hour, minute] = [yearText, monthText, dayText, hourText, minuteText].map(Number);
  const epoch = Date.UTC(year, month - 1, day, hour - 7, minute);
  const local = new Date(epoch + 7 * 60 * 60 * 1000);
  if (year < 2020 || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 ||
      local.getUTCFullYear() !== year || local.getUTCMonth() + 1 !== month ||
      local.getUTCDate() !== day || local.getUTCHours() !== hour || local.getUTCMinutes() !== minute) {
    throw new MatchError('INVALID_TIME', 'Ngày hoặc giờ không tồn tại trong lịch.');
  }
  if (epoch <= now) throw new MatchError('PAST_TIME', 'Lịch thi đấu phải ở tương lai.');
  return epoch;
}

function safeSlug(name: string): string {
  return name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'team';
}

export class MatchService {
  private readonly cardUpdates = new Map<string, Promise<void>>();

  constructor(
    private readonly repo: MatchRepository,
    private readonly tournaments: TournamentRepository,
    private readonly bracketService: TournamentService,
    private readonly gateway: MatchRoomGateway,
    private readonly now: () => number = () => Date.now()
  ) {}

  public startTournament(tournamentId: string, staffId: string, staff: boolean): Record<MatchState, number> {
    this.requireStaff(staff);
    return this.repo.transaction(() => {
      if (this.repo.tournamentStatus(tournamentId) !== 'bracket_ready') {
        throw new MatchError('INVALID_PHASE', 'Chỉ có thể bắt đầu giải khi nhánh đấu đã sẵn sàng.');
      }
      const restored = this.bracketService.restoreBracket(tournamentId);
      if (!restored || restored.matches.length === 0 ||
          !this.repo.list(tournamentId).some(m => m.status === 'READY' && m.team1 && m.team2)) {
        throw new MatchError('NO_PLAYABLE_MATCH', 'Nhánh đấu không có trận hiện có đủ hai đội.');
      }
      if (!this.tournaments.transition(tournamentId, 'bracket_ready', 'in_progress')) {
        throw new MatchError('CONFLICT', 'Trạng thái giải vừa thay đổi.');
      }
      return this.repo.counts(tournamentId);
    });
  }

  public list(tournamentId: string): MatchRecord[] { return this.repo.list(tournamentId); }
  public counts(tournamentId: string): Record<MatchState, number> { return this.repo.counts(tournamentId); }

  public bySelector(tournamentId: string, round: number, number: number): MatchRecord {
    if (!Number.isInteger(round) || round < 1 || !Number.isInteger(number) || number < 1) {
      throw new MatchError('INVALID_SELECTOR', 'Vòng và trận phải là số nguyên dương.');
    }
    const match = this.repo.bySelector(tournamentId, round, number);
    if (!match) throw new MatchError('MATCH_NOT_FOUND', `Không tìm thấy trận R${round}-M${number}.`);
    return match;
  }

  public async assignReferee(tournamentId: string, round: number, number: number, refereeId: string, actor: string, staff: boolean): Promise<boolean> {
    this.requireStaff(staff);
    const result = this.repo.transaction(() => {
      this.requireProgress(tournamentId);
      const match = this.bySelector(tournamentId, round, number);
      if (match.status === 'WAITING' || match.status === 'LIVE' || match.status === 'COMPLETED') {
        throw new MatchError('INVALID_STATE', 'Chỉ gán trọng tài cho trận đã xác định đội và chưa bắt đầu.');
      }
      const inserted = this.repo.assignReferee(match, refereeId, actor, this.now());
      if (inserted) this.repo.audit(match, actor, 'ASSIGN_REFEREE', match.status, match.status, null, this.now());
      return { inserted, matchId: match.id };
    });
    const match = this.repo.byId(tournamentId, result.matchId)!;
    if (match.room) {
      try { await this.gateway.addMember(match.room.threadId, refereeId); }
      catch (error) {
        console.error(`Referee ${refereeId} assigned to match ${match.id} but private-thread admission failed:`, error);
        throw new MatchError('REFEREE_ADMISSION_FAILED', 'Đã lưu trọng tài nhưng chưa thêm được vào phòng. BTC hãy thử gán lại để hoàn tất.');
      }
      await this.refreshCard(match);
    }
    return result.inserted;
  }

  public async createRooms(tournamentId: string, parentChannelId: string, actor: string, staff: boolean): Promise<RoomCreationSummary> {
    this.requireStaff(staff);
    this.requireProgress(tournamentId);
    const summary: RoomCreationSummary = { created: 0, alreadyExisting: 0, skippedWaiting: 0,
      skippedMissingReferee: 0, skippedInvalid: 0, failures: 0 };
    for (const match of this.repo.list(tournamentId)) {
      if (match.status === 'WAITING') { summary.skippedWaiting++; continue; }
      if (match.status !== 'READY') { summary.alreadyExisting++; continue; }
      if (!match.team1?.captainId || !match.team2?.captainId) { summary.skippedInvalid++; continue; }
      if (!match.refereeIds.length) { summary.skippedMissingReferee++; continue; }
      let threadId: string | null = null;
      try {
        const name = `r${match.round}-m${match.number}-${safeSlug(match.team1.name)}-vs-${safeSlug(match.team2.name)}`.slice(0, 100);
        threadId = await this.gateway.createPrivateThread(parentChannelId, name);
        for (const id of new Set([match.team1.captainId, match.team2.captainId, ...match.refereeIds])) {
          await this.gateway.addMember(threadId, id);
        }
        const starterId = await this.gateway.sendStarterMessage(threadId, { ...match, status: 'ROOM_OPEN' });
        this.repo.transaction(() => {
          this.requireProgress(tournamentId);
          const fresh = this.repo.byId(tournamentId, match.id);
          if (!fresh || fresh.status !== 'READY' || fresh.room ||
              fresh.team1?.id !== match.team1!.id || fresh.team2?.id !== match.team2!.id ||
              fresh.refereeIds.join(',') !== match.refereeIds.join(',')) {
            throw new MatchError('CONFLICT', 'Đội hoặc trọng tài của trận vừa đổi; BTC hãy thử tạo phòng lại.');
          }
          this.repo.insertRoom(fresh, { threadId: threadId!, parentChannelId, starterMessageId: starterId }, actor, this.now());
          this.repo.transition(fresh, 'ROOM_OPEN', this.now());
          this.repo.audit(fresh, actor, 'CREATE_ROOM', 'READY', 'ROOM_OPEN', null, this.now());
        });
        summary.created++;
      } catch (error) {
        summary.failures++;
        if (threadId) {
          try { await this.gateway.deleteThread(threadId); }
          catch (cleanupError) {
            console.error(`Recoverable orphan match thread ${threadId} for match ${match.id}: cleanup failed`, cleanupError);
          }
        }
        console.error(`Failed to create match room for R${match.round}-M${match.number}:`, error);
      }
    }
    return summary;
  }

  public async schedule(tournamentId: string, round: number, number: number, input: string, actor: string, staff: boolean): Promise<MatchRecord> {
    this.requireStaff(staff);
    const when = parseVietnamTime(input, this.now());
    const updated = this.repo.transaction(() => {
      this.requireProgress(tournamentId);
      const match = this.bySelector(tournamentId, round, number);
      if (!match.room || !['ROOM_OPEN', 'SCHEDULED'].includes(match.status)) {
        throw new MatchError('INVALID_STATE', 'Trận cần có phòng và chưa đến giai đoạn sẵn sàng hoặc LIVE.');
      }
      const reschedule = match.status === 'SCHEDULED';
      this.repo.setSchedule(match, when, actor, this.now());
      if (reschedule && match.scheduledAt !== when) this.repo.clearReady(match.id);
      if (!reschedule) this.repo.transition(match, 'SCHEDULED', this.now());
      this.repo.audit(match, actor, reschedule ? 'RESCHEDULE' : 'SCHEDULE', match.status, 'SCHEDULED', null, this.now());
      return this.repo.byId(tournamentId, match.id)!;
    });
    await this.refreshCard(updated);
    return updated;
  }

  public async confirmReady(tournamentId: string, matchId: string, threadId: string, actor: string): Promise<{ match: MatchRecord; repeated: boolean }> {
    const result = this.repo.transaction(() => {
      this.requireProgress(tournamentId);
      const match = this.repo.byId(tournamentId, matchId);
      if (!match || !match.room || match.room.threadId !== threadId) throw new MatchError('MATCH_NOT_FOUND', 'Nút không thuộc phòng trận này.');
      const team = [match.team1, match.team2].find(item => item?.captainId === actor);
      if (!team) throw new MatchError('NOT_CAPTAIN', 'Chỉ đội trưởng của một trong hai đội được xác nhận sẵn sàng.');
      if (!['SCHEDULED', 'READY_TO_START'].includes(match.status)) throw new MatchError('INVALID_STATE', 'Trận chưa lên lịch hoặc đã bắt đầu.');
      if (match.readyTeamIds.includes(team.id)) return { match, repeated: true };
      if (match.status !== 'SCHEDULED') throw new MatchError('INVALID_STATE', 'Trạng thái xác nhận không nhất quán.');
      this.repo.confirmReady(match, team.id, actor, this.now());
      const fresh = this.repo.byId(tournamentId, match.id)!;
      if (fresh.readyTeamIds.length === 2) this.repo.transition(fresh, 'READY_TO_START', this.now());
      this.repo.audit(match, actor, 'CAPTAIN_READY', match.status,
        fresh.readyTeamIds.length === 2 ? 'READY_TO_START' : 'SCHEDULED', null, this.now());
      return { match: this.repo.byId(tournamentId, match.id)!, repeated: false };
    });
    if (!result.repeated) await this.refreshCard(result.match);
    return result;
  }

  public async startMatch(tournamentId: string, matchId: string, threadId: string, actor: string, staff: boolean): Promise<MatchRecord> {
    const updated = this.repo.transaction(() => {
      this.requireProgress(tournamentId);
      const match = this.repo.byId(tournamentId, matchId);
      if (!match || !match.room || match.room.threadId !== threadId) throw new MatchError('MATCH_NOT_FOUND', 'Nút không thuộc phòng trận này.');
      if (!staff && !match.refereeIds.includes(actor)) throw new MatchError('NOT_REFEREE', 'Chỉ trọng tài được gán hoặc BTC được bắt đầu trận.');
      if (match.status !== 'READY_TO_START' || !match.team1 || !match.team2 ||
          !match.readyTeamIds.includes(match.team1.id) || !match.readyTeamIds.includes(match.team2.id)) {
        throw new MatchError('INVALID_STATE', 'Cả hai đội phải sẵn sàng trước khi bắt đầu trận.');
      }
      this.repo.insertStart(match, actor, this.now());
      this.repo.transition(match, 'LIVE', this.now());
      this.repo.audit(match, actor, 'START_MATCH', 'READY_TO_START', 'LIVE', null, this.now());
      return this.repo.byId(tournamentId, match.id)!;
    });
    await this.refreshCard(updated);
    return updated;
  }

  /** Internal hook for Phase 3 after its engine advancement has produced two participants. */
  public syncParticipants(tournamentId: string, matchId: string, team1Id: string, team2Id: string): MatchRecord {
    return this.repo.transaction(() => {
      this.requireProgress(tournamentId);
      const match = this.repo.byId(tournamentId, matchId);
      if (!match || match.status !== 'WAITING') throw new MatchError('INVALID_STATE', 'Chỉ trận đang chờ mới nhận đội.');
      if (!team1Id || !team2Id || team1Id === team2Id ||
          !this.repo.teamInDraw(tournamentId, team1Id) || !this.repo.teamInDraw(tournamentId, team2Id) ||
          (match.team1 && match.team1.id !== team1Id) || (match.team2 && match.team2.id !== team2Id)) {
        throw new MatchError('INVALID_PARTICIPANTS', 'Hai đội phải thuộc nhánh đấu và không thay đổi đội đã xác định.');
      }
      this.repo.updateParticipants(match, team1Id, team2Id, this.now());
      return this.repo.byId(tournamentId, matchId)!;
    });
  }

  public validatePersistedState(tournamentId: string): void {
    const phase = this.repo.tournamentStatus(tournamentId);
    for (const match of this.repo.list(tournamentId)) {
      const label = `R${match.round}-M${match.number}`;
      if (!['WAITING', 'READY', 'ROOM_OPEN', 'SCHEDULED', 'READY_TO_START', 'LIVE', 'COMPLETED'].includes(match.status)) {
        throw new MatchError('CORRUPT_MATCH', `Trạng thái trận ${label} không hợp lệ.`);
      }
      const both = !!match.team1 && !!match.team2;
      const room = !!match.room;
      const schedule = match.scheduledAt !== null;
      const ready = match.readyTeamIds.length === 2 &&
        !!match.team1 && !!match.team2 && match.readyTeamIds.includes(match.team1.id) && match.readyTeamIds.includes(match.team2.id);
      const strayReady = match.readyTeamIds.some(id => id !== match.team1?.id && id !== match.team2?.id);
      if (strayReady ||
          (['WAITING', 'READY', 'ROOM_OPEN'].includes(match.status) && (match.readyTeamIds.length > 0 || match.startedAt !== null)) ||
          (match.status === 'WAITING' && (both || room || schedule)) ||
          (match.status === 'READY' && (!both || room || schedule)) ||
          (match.status === 'ROOM_OPEN' && (!both || !room || schedule)) ||
          (match.status === 'SCHEDULED' && (!both || !room || !schedule || match.startedAt !== null)) ||
          (match.status === 'READY_TO_START' && (!both || !room || !schedule || !ready || match.startedAt !== null)) ||
          (match.status === 'LIVE' && (!both || !room || !schedule || !ready || match.startedAt === null || !match.startedBy))) {
        throw new MatchError('CORRUPT_MATCH', `Dữ liệu trận ${label} không nhất quán (${match.status}).`);
      }
      if ((match.status === 'COMPLETED') !== !!match.result ||
          (match.status === 'COMPLETED' && (!both || !room || !schedule || !ready || match.startedAt === null || !match.startedBy ||
            ![match.team1!.id, match.team2!.id].includes(match.result!.winnerTeamId)))) {
        throw new MatchError('CORRUPT_MATCH', `Dữ liệu trận ${label} không nhất quán (${match.status}).`);
      }
      if (!['in_progress', 'completed'].includes(phase ?? '') && !['WAITING', 'READY'].includes(match.status)) {
        throw new MatchError('CORRUPT_PHASE', `Trận ${label} đã vận hành trước khi giải bắt đầu.`);
      }
    }
  }

  private async refreshCard(match: MatchRecord): Promise<void> {
    if (!match.room) return;
    const previous = this.cardUpdates.get(match.id) ?? Promise.resolve();
    const update = previous.catch(() => {}).then(async () => {
      const latest = this.repo.byId(match.tournamentId, match.id) ?? match;
      await this.gateway.editStarterMessage(match.room!.threadId, match.room!.starterMessageId, latest);
    });
    this.cardUpdates.set(match.id, update);
    try { await update; }
    catch (error) {
      console.error(`Match ${match.id} persisted but starter card refresh failed:`, error);
      throw new MatchError('CARD_UPDATE_FAILED', 'Thao tác đã lưu nhưng chưa cập nhật được thẻ phòng trận. BTC cần kiểm tra phòng.');
    } finally {
      if (this.cardUpdates.get(match.id) === update) this.cardUpdates.delete(match.id);
    }
  }

  private requireProgress(tournamentId: string): void {
    if (this.repo.tournamentStatus(tournamentId) !== 'in_progress') {
      throw new MatchError('INVALID_PHASE', 'Giải đấu chưa ở giai đoạn thi đấu.');
    }
  }

  private requireStaff(staff: boolean): void {
    if (!staff) throw new MatchError('NOT_STAFF', 'Chỉ Ban Tổ Chức được thực hiện thao tác này.');
  }
}
