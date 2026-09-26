import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import type { ParsedPlayerInput } from './RegistrationParser.js';

export type TeamStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';

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

export class TeamRepository {
  constructor(private db: DatabaseSync) {}

  public ensureTournament(id: string, name: string, maxTeams: number = 16): void {
    const existing = this.db.prepare('SELECT id FROM tournaments WHERE id = ?').get(id);
    if (!existing) {
      this.db.prepare(`
        INSERT INTO tournaments (id, name, game, status, max_teams, created_at)
        VALUES (?, ?, 'Liên Quân Mobile', 'registration_open', ?, ?)
      `).run(id, name, maxTeams, Date.now());
    }
  }

  public registerTeam(input: RegisterTeamInput): { success: boolean; team?: TeamEntity; error?: string } {
    this.ensureTournament(input.tournamentId, 'UMA Cup');

    // Invariant 1: Exactly 5 starters
    if (input.starters.length !== 5) {
      return {
        success: false,
        error: `Đội phải có đúng 5 thành viên chính thức (hiện có ${input.starters.length}).`
      };
    }

    // Invariant 2: Check active captain
    const activeCaptain = this.db.prepare(`
      SELECT id, name FROM teams 
      WHERE tournament_id = ? AND captain_discord_id = ? AND status IN ('PENDING', 'APPROVED')
    `).get(input.tournamentId, input.captainDiscordId) as any;

    if (activeCaptain) {
      return {
        success: false,
        error: `Bạn đã là đội trưởng của đội "${activeCaptain.name}". Mỗi đội trưởng chỉ được quản lý 1 đội đang hoạt động.`
      };
    }

    // Invariant 3: Team name unique inside tournament
    const existingName = this.db.prepare(`
      SELECT id FROM teams WHERE tournament_id = ? AND LOWER(name) = LOWER(?)
    `).get(input.tournamentId, input.name);

    if (existingName) {
      return {
        success: false,
        error: `Tên đội "${input.name}" đã được sử dụng trong giải đấu này.`
      };
    }

    // Invariant 4: Abbreviation unique inside tournament
    const existingAbbr = this.db.prepare(`
      SELECT id FROM teams WHERE tournament_id = ? AND LOWER(abbreviation) = LOWER(?)
    `).get(input.tournamentId, input.abbreviation);

    if (existingAbbr) {
      return {
        success: false,
        error: `Tên viết tắt (TAG) "${input.abbreviation}" đã được sử dụng trong giải đấu.`
      };
    }

    // Invariant 5: Duplicate UID inside tournament across all registered/approved players
    const allCandidateUids = [...input.starters, ...input.substitutes].map(p => p.gameUid);
    for (const uid of allCandidateUids) {
      const existingPlayer = this.db.prepare(`
        SELECT p.game_uid, p.ingame_name, t.name as team_name 
        FROM players p
        JOIN teams t ON p.team_id = t.id
        WHERE p.tournament_id = ? AND p.game_uid = ? AND t.status IN ('PENDING', 'APPROVED')
      `).get(input.tournamentId, uid) as any;

      if (existingPlayer) {
        return {
          success: false,
          error: `UID "${uid}" (${existingPlayer.ingame_name}) đã được đăng ký bởi đội "${existingPlayer.team_name}".`
        };
      }
    }

    // Atomic Insertion
    const teamId = `team_${crypto.randomUUID()}`;
    const now = Date.now();

    this.db.exec('BEGIN TRANSACTION;');
    try {
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
      this.db.exec('ROLLBACK;');
      return { success: false, error: `Lỗi cơ sở dữ liệu: ${err.message}` };
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

    // Invariant: Must have exactly 5 starters
    const startersCount = (team.players || []).filter(p => !p.isSubstitute).length;
    if (startersCount !== 5) {
      return {
        success: false,
        code: 'INVALID_ROSTER',
        error: `Không thể duyệt đội vì chỉ có ${startersCount}/5 tuyển thủ chính thức.`
      };
    }

    const now = Date.now();
    // Atomic update with race condition lock
    const updateResult = this.db.prepare(`
      UPDATE teams 
      SET status = 'APPROVED', updated_at = ? 
      WHERE id = ? AND status = 'PENDING'
    `).run(now, teamId);

    if (updateResult.changes === 0) {
      // Another concurrent staff member already processed this!
      const currentTeam = this.getTeam(teamId);
      return {
        success: false,
        code: 'ALREADY_PROCESSED',
        team: currentTeam ?? undefined,
        error: 'Đơn này vừa được xử lý bởi thành viên BTC khác.'
      };
    }

    // Log audit
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
   * Idempotent & Concurrency-Safe Correction Request
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
      SET status = 'DRAFT', rejection_reason = ?, updated_at = ? 
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
      ) VALUES (?, ?, ?, ?, 'REQUEST_CORRECTION', 'PENDING', 'DRAFT', ?, ?)
    `).run(`log_${crypto.randomUUID()}`, team.tournamentId, teamId, staffDiscordId, reason.trim(), now);

    return { success: true, team: this.getTeam(teamId)! };
  }
}
