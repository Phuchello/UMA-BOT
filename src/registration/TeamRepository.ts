import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import type { ParsedPlayerInput } from './RegistrationParser.js';

export type TeamStatus = 'DRAFT' | 'PENDING' | 'NEEDS_CORRECTION' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
export type TournamentStatus = 'registration_open' | 'checkin_open' | 'bracket_ready' | 'in_progress' | 'completed';

export const ACTIVE_CAPACITY_STATUSES: TeamStatus[] = ['PENDING', 'APPROVED', 'NEEDS_CORRECTION'];

export interface PlayerEntity {
  id: string;
  teamId: string;
  tournamentId: string;
  discordId: string | null;
  ingameName: string;
  gameUid: string;
  isSubstitute: boolean;
  slotNumber: number;
  createdAt: number;
}

export interface TeamEntity {
  id: string;
  tournamentId: string;
  name: string;
  abbreviation: string;
  captainDiscordId: string;
  captainContact: string;
  status: TeamStatus;
  rejectionReason: string | null;
  btcReviewMessageId: string | null;
  createdAt: number;
  updatedAt: number;
  players?: PlayerEntity[];
}

export interface RegisterTeamInput {
  tournamentId: string;
  name: string;
  abbreviation: string;
  captainDiscordId: string;
  captainContact: string;
  starters: ParsedPlayerInput[];
  substitutes: ParsedPlayerInput[];
}

export interface ResubmitTeamInput {
  teamId: string;
  tournamentId: string;
  captainDiscordId: string;
  name: string;
  abbreviation: string;
  captainContact: string;
  starters: ParsedPlayerInput[];
  substitutes: ParsedPlayerInput[];
}

export class TeamRepository {
  constructor(private db: DatabaseSync) {}

  /** Create a tournament if absent. Existing name and capacity are never synchronized from config. */
  public ensureTournament(id: string, name: string, maxTeams: number = 16): void {
    const existing = this.db.prepare('SELECT id FROM tournaments WHERE id = ?').get(id);
    if (!existing) {
      this.db.prepare(`
        INSERT INTO tournaments (id, name, game, status, max_teams, created_at)
        VALUES (?, ?, 'Liên Quân Mobile', 'registration_open', ?, ?)
      `).run(id, name, maxTeams, Date.now());
    }
  }

  public getTournament(id: string): { id: string; name: string; maxTeams: number; status: TournamentStatus } | null {
    const row = this.db.prepare('SELECT * FROM tournaments WHERE id = ?').get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      maxTeams: row.max_teams,
      status: row.status as TournamentStatus
    };
  }

  public getActiveTeamsCount(tournamentId: string): number {
    const row = this.db.prepare(`
      SELECT COUNT(*) as count FROM teams 
      WHERE tournament_id = ? AND status IN ('PENDING', 'APPROVED', 'NEEDS_CORRECTION')
    `).get(tournamentId) as any;
    return row ? Number(row.count) : 0;
  }

  /**
   * Atomic, capacity-enforcing and race-condition protected team registration.
   */
  public registerTeam(input: RegisterTeamInput): { success: boolean; code?: string; team?: TeamEntity; error?: string } {
    // Tournament must already exist (created during bootstrap via ensureTournament).
    // registerTeam() does NOT create the tournament to avoid mismatched capacity defaults.
    const tournament = this.getTournament(input.tournamentId);
    if (!tournament) {
      return {
        success: false,
        code: 'TOURNAMENT_NOT_FOUND',
        error: `Giải đấu "${input.tournamentId}" chưa được khởi tạo. Vui lòng liên hệ Ban Tổ Chức.`
      };
    }

    // Invariant 1: Exactly 5 starters
    if (input.starters.length !== 5) {
      return {
        success: false,
        code: 'INVALID_ROSTER_SIZE',
        error: `Đội phải có đúng 5 thành viên chính thức (hiện có ${input.starters.length}).`
      };
    }

    if (input.substitutes.length > 2) {
      return {
        success: false,
        code: 'EXCEEDED_SUBSTITUTES',
        error: `Đội hình dự bị tối đa 2 thành viên (hiện có ${input.substitutes.length}).`
      };
    }

    // Begin immediate transaction to guarantee transactional isolation
    this.db.exec('BEGIN IMMEDIATE TRANSACTION;');
    try {
      // Invariant 2: Capacity check
      const tourneyRow = this.db.prepare('SELECT max_teams, status FROM tournaments WHERE id = ?').get(input.tournamentId) as any;
      if (!tourneyRow) {
        this.db.exec('ROLLBACK;');
        return {
          success: false,
          code: 'TOURNAMENT_NOT_FOUND',
          error: `Giải đấu "${input.tournamentId}" chưa được khởi tạo. Vui lòng liên hệ Ban Tổ Chức.`
        };
      }
      if (tourneyRow.status !== 'registration_open') {
        this.db.exec('ROLLBACK;');
        return { success: false, code: 'REGISTRATION_CLOSED', error: 'Đăng ký đã khóa. Không thể nộp đơn mới.' };
      }
      const maxTeams = Number(tourneyRow.max_teams);

      const activeCountRow = this.db.prepare(`
        SELECT COUNT(*) as count FROM teams 
        WHERE tournament_id = ? AND status IN ('PENDING', 'APPROVED', 'NEEDS_CORRECTION')
      `).get(input.tournamentId) as any;
      const activeCount = activeCountRow ? Number(activeCountRow.count) : 0;

      if (activeCount >= maxTeams) {
        this.db.exec('ROLLBACK;');
        return {
          success: false,
          code: 'REGISTRATION_FULL',
          error: 'Giải đấu đã đủ số lượng đội đăng ký.'
        };
      }

      // Invariant 3: Check active captain (Domain invariant: rejected/withdrawn captains may register again)
      const activeCaptain = this.db.prepare(`
        SELECT id, name FROM teams 
        WHERE tournament_id = ? AND captain_discord_id = ? AND status IN ('PENDING', 'APPROVED', 'NEEDS_CORRECTION')
      `).get(input.tournamentId, input.captainDiscordId) as any;

      if (activeCaptain) {
        this.db.exec('ROLLBACK;');
        return {
          success: false,
          code: 'CAPTAIN_ALREADY_ACTIVE',
          error: `Bạn đã là đội trưởng của đội "${activeCaptain.name}". Mỗi đội trưởng chỉ được quản lý 1 đội đang hoạt động trong giải đấu này.`
        };
      }

      // Invariant 4: Team name unique among ACTIVE teams (case-insensitive).
      // REJECTED / WITHDRAWN rows do not occupy uniqueness slots.
      const existingName = this.db.prepare(`
        SELECT id FROM teams 
        WHERE tournament_id = ? AND LOWER(name) = LOWER(?) 
          AND status IN ('PENDING', 'APPROVED', 'NEEDS_CORRECTION')
      `).get(input.tournamentId, input.name.trim());

      if (existingName) {
        this.db.exec('ROLLBACK;');
        return {
          success: false,
          code: 'DUPLICATE_TEAM_NAME',
          error: `Tên đội "${input.name}" đã được sử dụng bởi một đội đang hoạt động trong giải đấu này.`
        };
      }

      // Invariant 5: Abbreviation unique among ACTIVE teams (case-insensitive).
      const existingAbbr = this.db.prepare(`
        SELECT id FROM teams 
        WHERE tournament_id = ? AND LOWER(abbreviation) = LOWER(?) 
          AND status IN ('PENDING', 'APPROVED', 'NEEDS_CORRECTION')
      `).get(input.tournamentId, input.abbreviation.trim());

      if (existingAbbr) {
        this.db.exec('ROLLBACK;');
        return {
          success: false,
          code: 'DUPLICATE_ABBREVIATION',
          error: `Tên viết tắt (TAG) "${input.abbreviation}" đã được sử dụng bởi một đội đang hoạt động trong giải đấu.`
        };
      }


      // Invariant 6: Duplicate UID across active teams in the same tournament
      const allCandidateUids = [...input.starters, ...input.substitutes].map(p => p.gameUid);
      for (const uid of allCandidateUids) {
        const existingPlayer = this.db.prepare(`
          SELECT p.game_uid, p.ingame_name, t.name as team_name 
          FROM players p
          JOIN teams t ON p.team_id = t.id
          WHERE p.tournament_id = ? AND p.game_uid = ? AND t.status IN ('PENDING', 'APPROVED', 'NEEDS_CORRECTION')
        `).get(input.tournamentId, uid) as any;

        if (existingPlayer) {
          this.db.exec('ROLLBACK;');
          return {
            success: false,
            code: 'DUPLICATE_UID',
            error: `UID "${uid}" (${existingPlayer.ingame_name}) đã được đăng ký bởi đội "${existingPlayer.team_name}".`
          };
        }
      }

      // Insert Team
      const teamId = `team_${crypto.randomUUID()}`;
      const now = Date.now();

      this.db.prepare(`
        INSERT INTO teams (
          id, tournament_id, name, abbreviation, captain_discord_id, 
          captain_contact, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)
      `).run(
        teamId,
        input.tournamentId,
        input.name.trim(),
        input.abbreviation.trim().toUpperCase(),
        input.captainDiscordId,
        input.captainContact.trim(),
        now,
        now
      );

      // Insert Players
      const insertPlayer = this.db.prepare(`
        INSERT INTO players (
          id, team_id, tournament_id, discord_id, ingame_name, 
          game_uid, is_substitute, slot_number, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const starter of input.starters) {
        insertPlayer.run(
          `p_${crypto.randomUUID()}`,
          teamId,
          input.tournamentId,
          null,
          starter.ingameName,
          starter.gameUid,
          0,
          starter.slotNumber,
          now
        );
      }

      for (const sub of input.substitutes) {
        insertPlayer.run(
          `p_${crypto.randomUUID()}`,
          teamId,
          input.tournamentId,
          null,
          sub.ingameName,
          sub.gameUid,
          1,
          sub.slotNumber,
          now
        );
      }

      this.db.exec('COMMIT;');
      const team = this.getTeam(teamId)!;
      return { success: true, team };
    } catch (err: any) {
      try { this.db.exec('ROLLBACK;'); } catch {}
      return { success: false, code: 'DB_ERROR', error: `Lỗi cơ sở dữ liệu: ${err.message}` };
    }
  }

  /**
   * Transactional resubmission for teams in NEEDS_CORRECTION state.
   */
  public resubmitCorrectedTeam(input: ResubmitTeamInput): { success: boolean; code?: string; team?: TeamEntity; error?: string } {
    if (input.starters.length !== 5) {
      return {
        success: false,
        code: 'INVALID_ROSTER_SIZE',
        error: `Đội phải có đúng 5 thành viên chính thức (hiện có ${input.starters.length}).`
      };
    }

    if (input.substitutes.length > 2) {
      return {
        success: false,
        code: 'EXCEEDED_SUBSTITUTES',
        error: `Đội hình dự bị tối đa 2 thành viên (hiện có ${input.substitutes.length}).`
      };
    }

    this.db.exec('BEGIN IMMEDIATE TRANSACTION;');
    try {
      const tournament = this.getTournament(input.tournamentId);
      if (!tournament || tournament.status !== 'registration_open') {
        this.db.exec('ROLLBACK;');
        return { success: false, code: 'REGISTRATION_CLOSED', error: 'Đăng ký đã khóa. Không thể nộp lại đơn chỉnh sửa.' };
      }
      const existingTeam = this.db.prepare('SELECT * FROM teams WHERE id = ?').get(input.teamId) as any;
      if (!existingTeam) {
        this.db.exec('ROLLBACK;');
        return { success: false, code: 'NOT_FOUND', error: 'Đội không tồn tại trong hệ thống.' };
      }

      if (existingTeam.tournament_id !== input.tournamentId) {
        this.db.exec('ROLLBACK;');
        return { success: false, code: 'INVALID_TOURNAMENT', error: 'Đội không thuộc giải đấu này.' };
      }

      if (existingTeam.captain_discord_id !== input.captainDiscordId) {
        this.db.exec('ROLLBACK;');
        return { success: false, code: 'UNAUTHORIZED', error: 'Bạn không có quyền chỉnh sửa đội này.' };
      }

      if (existingTeam.status !== 'NEEDS_CORRECTION') {
        this.db.exec('ROLLBACK;');
        return {
          success: false,
          code: 'INVALID_STATUS',
          error: `Đơn này hiện không ở trạng thái yêu cầu chỉnh sửa (Trạng thái hiện tại: ${existingTeam.status}).`
        };
      }

      // Check name uniqueness among ACTIVE teams (excluding self)
      const nameConflict = this.db.prepare(`
        SELECT id FROM teams 
        WHERE tournament_id = ? AND LOWER(name) = LOWER(?) AND id != ?
          AND status IN ('PENDING', 'APPROVED', 'NEEDS_CORRECTION')
      `).get(input.tournamentId, input.name.trim(), input.teamId);

      if (nameConflict) {
        this.db.exec('ROLLBACK;');
        return {
          success: false,
          code: 'DUPLICATE_TEAM_NAME',
          error: `Tên đội "${input.name}" đã được sử dụng bởi đội khác đang hoạt động trong giải đấu.`
        };
      }

      // Check abbr uniqueness among ACTIVE teams (excluding self)
      const abbrConflict = this.db.prepare(`
        SELECT id FROM teams 
        WHERE tournament_id = ? AND LOWER(abbreviation) = LOWER(?) AND id != ?
          AND status IN ('PENDING', 'APPROVED', 'NEEDS_CORRECTION')
      `).get(input.tournamentId, input.abbreviation.trim(), input.teamId);

      if (abbrConflict) {
        this.db.exec('ROLLBACK;');
        return {
          success: false,
          code: 'DUPLICATE_ABBREVIATION',
          error: `Tên viết tắt (TAG) "${input.abbreviation}" đã được sử dụng bởi đội khác.`
        };
      }

      // Check UID uniqueness across active teams (excluding self)
      const allCandidateUids = [...input.starters, ...input.substitutes].map(p => p.gameUid);
      for (const uid of allCandidateUids) {
        const existingPlayer = this.db.prepare(`
          SELECT p.game_uid, p.ingame_name, t.name as team_name 
          FROM players p
          JOIN teams t ON p.team_id = t.id
          WHERE p.tournament_id = ? AND p.game_uid = ? AND t.id != ? AND t.status IN ('PENDING', 'APPROVED', 'NEEDS_CORRECTION')
        `).get(input.tournamentId, uid, input.teamId) as any;

        if (existingPlayer) {
          this.db.exec('ROLLBACK;');
          return {
            success: false,
            code: 'DUPLICATE_UID',
            error: `UID "${uid}" (${existingPlayer.ingame_name}) đã được đăng ký bởi đội "${existingPlayer.team_name}".`
          };
        }
      }

      // Atomically replace player rows
      this.db.prepare('DELETE FROM players WHERE team_id = ?').run(input.teamId);

      const now = Date.now();
      const insertPlayer = this.db.prepare(`
        INSERT INTO players (
          id, team_id, tournament_id, discord_id, ingame_name, 
          game_uid, is_substitute, slot_number, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const starter of input.starters) {
        insertPlayer.run(
          `p_${crypto.randomUUID()}`,
          input.teamId,
          input.tournamentId,
          null,
          starter.ingameName,
          starter.gameUid,
          0,
          starter.slotNumber,
          now
        );
      }

      for (const sub of input.substitutes) {
        insertPlayer.run(
          `p_${crypto.randomUUID()}`,
          input.teamId,
          input.tournamentId,
          null,
          sub.ingameName,
          sub.gameUid,
          1,
          sub.slotNumber,
          now
        );
      }

      // Update team row back to PENDING and clear rejection_reason
      const updateResult = this.db.prepare(`
        UPDATE teams 
        SET name = ?, abbreviation = ?, captain_contact = ?, status = 'PENDING', rejection_reason = NULL, updated_at = ?
        WHERE id = ? AND status = 'NEEDS_CORRECTION'
      `).run(
        input.name.trim(),
        input.abbreviation.trim().toUpperCase(),
        input.captainContact.trim(),
        now,
        input.teamId
      );

      if (updateResult.changes === 0) {
        this.db.exec('ROLLBACK;');
        return {
          success: false,
          code: 'CONCURRENCY_CONFLICT',
          error: 'Đơn này vừa được cập nhật bởi tiến trình khác.'
        };
      }

      // Write Audit Log
      this.db.prepare(`
        INSERT INTO audit_logs (
          id, tournament_id, team_id, staff_discord_id, action, 
          previous_status, new_status, reason, timestamp
        ) VALUES (?, ?, ?, ?, 'RESUBMIT_CORRECTION', 'NEEDS_CORRECTION', 'PENDING', NULL, ?)
      `).run(`log_${crypto.randomUUID()}`, input.tournamentId, input.teamId, input.captainDiscordId, now);

      this.db.exec('COMMIT;');
      const updatedTeam = this.getTeam(input.teamId)!;
      return { success: true, team: updatedTeam };
    } catch (err: any) {
      try { this.db.exec('ROLLBACK;'); } catch {}
      return { success: false, code: 'DB_ERROR', error: `Lỗi cơ sở dữ liệu: ${err.message}` };
    }
  }

  public getTeam(teamId: string): TeamEntity | null {
    const row = this.db.prepare('SELECT * FROM teams WHERE id = ?').get(teamId) as any;
    if (!row) return null;

    const playerRows = this.db.prepare(`
      SELECT * FROM players WHERE team_id = ? ORDER BY is_substitute ASC, slot_number ASC
    `).all(teamId) as any[];

    const players: PlayerEntity[] = playerRows.map(p => ({
      id: p.id,
      teamId: p.team_id,
      tournamentId: p.tournament_id,
      discordId: p.discord_id,
      ingameName: p.ingame_name,
      gameUid: p.game_uid,
      isSubstitute: Boolean(p.is_substitute),
      slotNumber: p.slot_number,
      createdAt: p.created_at
    }));

    return {
      id: row.id,
      tournamentId: row.tournament_id,
      name: row.name,
      abbreviation: row.abbreviation,
      captainDiscordId: row.captain_discord_id,
      captainContact: row.captain_contact,
      status: row.status as TeamStatus,
      rejectionReason: row.rejection_reason,
      btcReviewMessageId: row.btc_review_message_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      players
    };
  }

  public getCaptainActiveTeam(tournamentId: string, captainDiscordId: string): TeamEntity | null {
    const row = this.db.prepare(`
      SELECT id FROM teams 
      WHERE tournament_id = ? AND captain_discord_id = ? AND status IN ('PENDING', 'APPROVED', 'NEEDS_CORRECTION')
      ORDER BY updated_at DESC LIMIT 1
    `).get(tournamentId, captainDiscordId) as any;

    if (!row) return null;
    return this.getTeam(row.id);
  }

  public listTeams(tournamentId: string, status?: TeamStatus): TeamEntity[] {
    let sql = 'SELECT * FROM teams WHERE tournament_id = ?';
    const params: any[] = [tournamentId];
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY created_at ASC';

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(r => this.getTeam(r.id)!);
  }

  public setBtcReviewMessageId(teamId: string, messageId: string): void {
    this.db.prepare('UPDATE teams SET btc_review_message_id = ? WHERE id = ?').run(messageId, teamId);
  }

  /**
   * Idempotent & Concurrency-Safe Approval
   */
  public approveTeam(
    teamId: string,
    staffDiscordId: string
  ): { success: boolean; code?: string; team?: TeamEntity; error?: string } {
    const team = this.getTeam(teamId);
    if (!team) {
      return { success: false, code: 'NOT_FOUND', error: 'Đội không tồn tại trong hệ thống.' };
    }

    if (team.status !== 'PENDING') {
      return {
        success: false,
        code: 'ALREADY_PROCESSED',
        team,
        error: `Đơn này đã được xử lý (Trạng thái hiện tại: ${team.status}).`
      };
    }

    const startersCount = (team.players || []).filter(p => !p.isSubstitute).length;
    if (startersCount !== 5) {
      return {
        success: false,
        code: 'INVALID_ROSTER',
        error: `Không thể duyệt đội vì chỉ có ${startersCount}/5 tuyển thủ chính thức.`
      };
    }

    const now = Date.now();
    const updateResult = this.db.prepare(`
      UPDATE teams 
      SET status = 'APPROVED', updated_at = ? 
      WHERE id = ? AND status = 'PENDING'
    `).run(now, teamId);

    if (updateResult.changes === 0) {
      const currentTeam = this.getTeam(teamId);
      return {
        success: false,
        code: 'ALREADY_PROCESSED',
        team: currentTeam ?? undefined,
        error: 'Đơn này vừa được xử lý bởi thành viên BTC khác.'
      };
    }

    this.db.prepare(`
      INSERT INTO audit_logs (
        id, tournament_id, team_id, staff_discord_id, action, 
        previous_status, new_status, reason, timestamp
      ) VALUES (?, ?, ?, ?, 'APPROVE', 'PENDING', 'APPROVED', NULL, ?)
    `).run(`log_${crypto.randomUUID()}`, team.tournamentId, teamId, staffDiscordId, now);

    return { success: true, team: this.getTeam(teamId)! };
  }

  /**
   * Idempotent & Concurrency-Safe Rejection
   */
  public rejectTeam(
    teamId: string,
    staffDiscordId: string,
    reason: string
  ): { success: boolean; code?: string; team?: TeamEntity; error?: string } {
    const team = this.getTeam(teamId);
    if (!team) {
      return { success: false, code: 'NOT_FOUND', error: 'Đội không tồn tại trong hệ thống.' };
    }

    if (team.status !== 'PENDING') {
      return {
        success: false,
        code: 'ALREADY_PROCESSED',
        team,
        error: `Đơn này đã được xử lý (Trạng thái hiện tại: ${team.status}).`
      };
    }

    const now = Date.now();
    const updateResult = this.db.prepare(`
      UPDATE teams 
      SET status = 'REJECTED', rejection_reason = ?, updated_at = ? 
      WHERE id = ? AND status = 'PENDING'
    `).run(reason.trim(), now, teamId);

    if (updateResult.changes === 0) {
      return {
        success: false,
        code: 'ALREADY_PROCESSED',
        team: this.getTeam(teamId) ?? undefined,
        error: 'Đơn này vừa được xử lý bởi thành viên BTC khác.'
      };
    }

    this.db.prepare(`
      INSERT INTO audit_logs (
        id, tournament_id, team_id, staff_discord_id, action, 
        previous_status, new_status, reason, timestamp
      ) VALUES (?, ?, ?, ?, 'REJECT', 'PENDING', 'REJECTED', ?, ?)
    `).run(`log_${crypto.randomUUID()}`, team.tournamentId, teamId, staffDiscordId, reason.trim(), now);

    return { success: true, team: this.getTeam(teamId)! };
  }

  /**
   * Idempotent & Concurrency-Safe Correction Request (PENDING -> NEEDS_CORRECTION)
   */
  public requestCorrection(
    teamId: string,
    staffDiscordId: string,
    reason: string
  ): { success: boolean; code?: string; team?: TeamEntity; error?: string } {
    const team = this.getTeam(teamId);
    if (!team) {
      return { success: false, code: 'NOT_FOUND', error: 'Đội không tồn tại trong hệ thống.' };
    }

    if (team.status !== 'PENDING') {
      return {
        success: false,
        code: 'ALREADY_PROCESSED',
        team,
        error: `Đơn này đã được xử lý (Trạng thái hiện tại: ${team.status}).`
      };
    }

    const now = Date.now();
    const updateResult = this.db.prepare(`
      UPDATE teams 
      SET status = 'NEEDS_CORRECTION', rejection_reason = ?, updated_at = ? 
      WHERE id = ? AND status = 'PENDING'
    `).run(reason.trim(), now, teamId);

    if (updateResult.changes === 0) {
      return {
        success: false,
        code: 'ALREADY_PROCESSED',
        team: this.getTeam(teamId) ?? undefined,
        error: 'Đơn này vừa được xử lý bởi thành viên BTC khác.'
      };
    }

    this.db.prepare(`
      INSERT INTO audit_logs (
        id, tournament_id, team_id, staff_discord_id, action, 
        previous_status, new_status, reason, timestamp
      ) VALUES (?, ?, ?, ?, 'REQUEST_CORRECTION', 'PENDING', 'NEEDS_CORRECTION', ?, ?)
    `).run(`log_${crypto.randomUUID()}`, team.tournamentId, teamId, staffDiscordId, reason.trim(), now);

    return { success: true, team: this.getTeam(teamId)! };
  }

  /**
   * Team withdrawal (frees capacity slot).
   */
  public withdrawTeam(
    teamId: string,
    actorDiscordId: string,
    reason: string = 'Đội trưởng tự nguyện rút lui'
  ): { success: boolean; code?: string; team?: TeamEntity; error?: string } {
    const team = this.getTeam(teamId);
    if (!team) {
      return { success: false, code: 'NOT_FOUND', error: 'Đội không tồn tại trong hệ thống.' };
    }

    if (this.getTournament(team.tournamentId)?.status !== 'registration_open') {
      return { success: false, code: 'REGISTRATION_CLOSED', error: 'Đăng ký đã khóa. Không thể thay đổi đội hình tham gia.' };
    }

    if (!['PENDING', 'NEEDS_CORRECTION', 'APPROVED'].includes(team.status)) {
      return {
        success: false,
        code: 'INVALID_STATUS',
        error: `Không thể rút đơn khi đội đang ở trạng thái ${team.status}.`
      };
    }

    const now = Date.now();
    const prevStatus = team.status;
    const updateResult = this.db.prepare(`
      UPDATE teams 
      SET status = 'WITHDRAWN', rejection_reason = ?, updated_at = ? 
      WHERE id = ? AND status IN ('PENDING', 'NEEDS_CORRECTION', 'APPROVED')
        AND EXISTS (SELECT 1 FROM tournaments WHERE id = teams.tournament_id AND status = 'registration_open')
    `).run(reason.trim(), now, teamId);

    if (updateResult.changes === 0) {
      return {
        success: false,
        code: 'CONCURRENCY_CONFLICT',
        error: 'Đơn này vừa được cập nhật bởi tiến trình khác.'
      };
    }

    this.db.prepare(`
      INSERT INTO audit_logs (
        id, tournament_id, team_id, staff_discord_id, action, 
        previous_status, new_status, reason, timestamp
      ) VALUES (?, ?, ?, ?, 'WITHDRAW', ?, 'WITHDRAWN', ?, ?)
    `).run(`log_${crypto.randomUUID()}`, team.tournamentId, teamId, actorDiscordId, prevStatus, reason.trim(), now);

    return { success: true, team: this.getTeam(teamId)! };
  }
}
