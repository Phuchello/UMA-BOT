import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase } from '../src/database/Database.js';
import { TeamRepository } from '../src/registration/TeamRepository.js';
import { RegistrationParser } from '../src/registration/RegistrationParser.js';
import fs from 'node:fs';
import path from 'node:path';

describe('Phase 1: Team Registration & BTC Approval Workflow', () => {
  let db: any;
  let repo: TeamRepository;
  const tourneyId = 'guild_uma_test';

  const valid5StartersRaw = `
    UMA_Top | 100000001
    UMA_Jungle | 100000002
    UMA_Mid | 100000003
    UMA_Adc | 100000004
    UMA_Support | 100000005
  `;

  beforeEach(() => {
    db = createDatabase(':memory:');
    repo = new TeamRepository(db);
    repo.ensureTournament(tourneyId, 'UMA Championship');
  });

  afterEach(() => {
    db.exec('PRAGMA optimize;');
  });

  describe('Registration Parser Tests', () => {
    it('accepts valid 5-player registration with supported delimiters', () => {
      const parsed = RegistrationParser.parseRoster(valid5StartersRaw);
      expect(parsed.success).toBe(true);
      expect(parsed.starters.length).toBe(5);
      expect(parsed.starters[0].ingameName).toBe('UMA_Top');
      expect(parsed.starters[0].gameUid).toBe('100000001');
      expect(parsed.starters[0].isSubstitute).toBe(false);
      expect(parsed.starters[0].slotNumber).toBe(1);
    });

    it('rejects 4-player registration', () => {
      const raw4 = `
        Player1 | 111111
        Player2 | 222222
        Player3 | 333333
        Player4 | 444444
      `;
      const parsed = RegistrationParser.parseRoster(raw4);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('phải có đúng 5 thành viên');
    });

    it('rejects 6-player registration in starters field', () => {
      const raw6 = `
        P1 | 111
        P2 | 222
        P3 | 333
        P4 | 444
        P5 | 555
        P6 | 666
      `;
      const parsed = RegistrationParser.parseRoster(raw6);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('phải có đúng 5 thành viên');
    });

    it('accepts optional substitutes within limits (up to 2)', () => {
      const rawSubs = `
        Sub1 | 900000001
        Sub2 | 900000002
      `;
      const parsed = RegistrationParser.parseRoster(valid5StartersRaw, rawSubs, 2);
      expect(parsed.success).toBe(true);
      expect(parsed.starters.length).toBe(5);
      expect(parsed.substitutes.length).toBe(2);
      expect(parsed.substitutes[0].isSubstitute).toBe(true);
    });

    it('rejects excessive substitutes beyond configured max', () => {
      const raw3Subs = `
        Sub1 | 901
        Sub2 | 902
        Sub3 | 903
      `;
      const parsed = RegistrationParser.parseRoster(valid5StartersRaw, raw33SubsRaw(raw3Subs), 2);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('Số lượng dự bị tối đa là 2');
    });

    function raw33SubsRaw(text: string) {
      return text;
    }

    it('rejects malformed lines without delimiter or missing UID', () => {
      const malformed = `
        UMA_P1 | 10001
        UMA_P2_WITHOUT_UID
        UMA_P3 | 10003
        UMA_P4 | 10004
        UMA_P5 | 10005
      `;
      const parsed = RegistrationParser.parseRoster(malformed);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('không đúng định dạng');
    });

    it('rejects duplicate UIDs within the same team submission', () => {
      const dupUidSubmission = `
        UMA_P1 | 10001
        UMA_P2 | 10002
        UMA_P3 | 10001
        UMA_P4 | 10004
        UMA_P5 | 10005
      `;
      const parsed = RegistrationParser.parseRoster(dupUidSubmission);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('trùng lặp trong nội bộ đội hình');
    });
  });

  describe('Team Repository Invariants & Registration', () => {
    it('successfully registers a team with 5 starters and 1 sub in PENDING state', () => {
      const parsed = RegistrationParser.parseRoster(valid5StartersRaw, 'Sub1 | 999999999');
      expect(parsed.success).toBe(true);

      const result = repo.registerTeam({
        tournamentId: tourneyId,
        name: 'UMA Phoenix',
        abbreviation: 'PNX',
        captainDiscordId: 'capt_001',
        captainContact: '0912345678',
        starters: parsed.starters,
        substitutes: parsed.substitutes
      });

      expect(result.success).toBe(true);
      expect(result.team).toBeTruthy();
      expect(result.team!.name).toBe('UMA Phoenix');
      expect(result.team!.abbreviation).toBe('PNX');
      expect(result.team!.status).toBe('PENDING');
      expect(result.team!.players?.length).toBe(6);

      const starters = result.team!.players!.filter(p => !p.isSubstitute);
      const subs = result.team!.players!.filter(p => p.isSubstitute);
      expect(starters.length).toBe(5);
      expect(subs.length).toBe(1);
    });

    it('rejects duplicate team name inside the same tournament (case-insensitive)', () => {
      const parsed = RegistrationParser.parseRoster(valid5StartersRaw);
      repo.registerTeam({
        tournamentId: tourneyId,
        name: 'UMA Phoenix',
        abbreviation: 'PNX',
        captainDiscordId: 'capt_001',
        captainContact: '0912345678',
        starters: parsed.starters,
        substitutes: []
      });

      const parsed2 = RegistrationParser.parseRoster(`
        P1 | 200001
        P2 | 200002
        P3 | 200003
        P4 | 200004
        P5 | 200005
      `);

      const dupResult = repo.registerTeam({
        tournamentId: tourneyId,
        name: 'uma phoenix', // same name, lowercase
        abbreviation: 'PNX2',
        captainDiscordId: 'capt_002',
        captainContact: '0987654321',
        starters: parsed2.starters,
        substitutes: []
      });

      expect(dupResult.success).toBe(false);
      expect(dupResult.error).toContain('đã được sử dụng bởi một đội đang hoạt động trong giải đấu này');
    });

    it('rejects duplicate team abbreviation inside the same tournament', () => {
      const parsed1 = RegistrationParser.parseRoster(valid5StartersRaw);
      repo.registerTeam({
        tournamentId: tourneyId,
        name: 'UMA Phoenix',
        abbreviation: 'PNX',
        captainDiscordId: 'capt_001',
        captainContact: '0912345678',
        starters: parsed1.starters,
        substitutes: []
      });

      const parsed2 = RegistrationParser.parseRoster(`
        P1 | 200001
        P2 | 200002
        P3 | 200003
        P4 | 200004
        P5 | 200005
      `);

      const dupAbbrResult = repo.registerTeam({
        tournamentId: tourneyId,
        name: 'Phoenix Knights',
        abbreviation: 'pnx', // same tag
        captainDiscordId: 'capt_002',
        captainContact: '0987654321',
        starters: parsed2.starters,
        substitutes: []
      });

      expect(dupAbbrResult.success).toBe(false);
      expect(dupAbbrResult.error).toContain('Tên viết tắt (TAG)');
    });

    it('rejects captain attempting to register multiple active teams', () => {
      const parsed1 = RegistrationParser.parseRoster(valid5StartersRaw);
      repo.registerTeam({
        tournamentId: tourneyId,
        name: 'Team Alpha',
        abbreviation: 'TAL',
        captainDiscordId: 'capt_001',
        captainContact: '0912345678',
        starters: parsed1.starters,
        substitutes: []
      });

      const parsed2 = RegistrationParser.parseRoster(`
        P1 | 200001
        P2 | 200002
        P3 | 200003
        P4 | 200004
        P5 | 200005
      `);

      const secondAttempt = repo.registerTeam({
        tournamentId: tourneyId,
        name: 'Team Beta',
        abbreviation: 'TBE',
        captainDiscordId: 'capt_001', // same captain
        captainContact: '0912345678',
        starters: parsed2.starters,
        substitutes: []
      });

      expect(secondAttempt.success).toBe(false);
      expect(secondAttempt.error).toContain('Bạn đã là đội trưởng của đội');
    });

    it('rejects duplicate Game UID across different teams in the tournament', () => {
      const parsed1 = RegistrationParser.parseRoster(valid5StartersRaw);
      repo.registerTeam({
        tournamentId: tourneyId,
        name: 'Team Alpha',
        abbreviation: 'TAL',
        captainDiscordId: 'capt_001',
        captainContact: '0912345678',
        starters: parsed1.starters,
        substitutes: []
      });

      // Team 2 tries to register with player 1's UID (100000001)
      const parsed2 = RegistrationParser.parseRoster(`
        ClonedPlayer | 100000001
        P2 | 200002
        P3 | 200003
        P4 | 200004
        P5 | 200005
      `);

      const dupUidResult = repo.registerTeam({
        tournamentId: tourneyId,
        name: 'Team Beta',
        abbreviation: 'TBE',
        captainDiscordId: 'capt_002',
        captainContact: '0987654321',
        starters: parsed2.starters,
        substitutes: []
      });

      expect(dupUidResult.success).toBe(false);
      expect(dupUidResult.error).toContain('đã được đăng ký bởi đội "Team Alpha"');
    });
  });

  describe('BTC Approval & Rejection Workflow', () => {
    let teamId: string;

    beforeEach(() => {
      const parsed = RegistrationParser.parseRoster(valid5StartersRaw);
      const reg = repo.registerTeam({
        tournamentId: tourneyId,
        name: 'UMA Phoenix',
        abbreviation: 'PNX',
        captainDiscordId: 'capt_001',
        captainContact: '0912345678',
        starters: parsed.starters,
        substitutes: []
      });
      teamId = reg.team!.id;
    });

    it('approves PENDING team and records audit log', () => {
      const approval = repo.approveTeam(teamId, 'staff_admin_1');
      expect(approval.success).toBe(true);
      expect(approval.team?.status).toBe('APPROVED');

      const approvedTeam = repo.getTeam(teamId);
      expect(approvedTeam?.status).toBe('APPROVED');

      // Check audit log
      const logs = db.prepare('SELECT * FROM audit_logs WHERE team_id = ?').all(teamId) as any[];
      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe('APPROVE');
      expect(logs[0].staff_discord_id).toBe('staff_admin_1');
      expect(logs[0].previous_status).toBe('PENDING');
      expect(logs[0].new_status).toBe('APPROVED');
    });

    it('rejects PENDING team with custom reason', () => {
      const rejection = repo.rejectTeam(teamId, 'staff_admin_1', 'Không đủ điều kiện rank');
      expect(rejection.success).toBe(true);
      expect(rejection.team?.status).toBe('REJECTED');
      expect(rejection.team?.rejectionReason).toBe('Không đủ điều kiện rank');

      const rejectedTeam = repo.getTeam(teamId);
      expect(rejectedTeam?.status).toBe('REJECTED');
      expect(rejectedTeam?.rejectionReason).toBe('Không đủ điều kiện rank');

      const logs = db.prepare('SELECT * FROM audit_logs WHERE team_id = ?').all(teamId) as any[];
      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe('REJECT');
      expect(logs[0].reason).toBe('Không đủ điều kiện rank');
    });

    it('requests correction and changes status to NEEDS_CORRECTION', () => {
      const correction = repo.requestCorrection(teamId, 'staff_admin_2', 'UID số 3 sai chính tả');
      expect(correction.success).toBe(true);
      expect(correction.team?.status).toBe('NEEDS_CORRECTION');
      expect(correction.team?.rejectionReason).toBe('UID số 3 sai chính tả');
    });

    it('enforces idempotency: second approval on already approved team is safely rejected', () => {
      // First approval
      const first = repo.approveTeam(teamId, 'staff_admin_1');
      expect(first.success).toBe(true);

      // Second approval attempt (e.g. repeated click or concurrent staff)
      const second = repo.approveTeam(teamId, 'staff_admin_2');
      expect(second.success).toBe(false);
      expect(second.code).toBe('ALREADY_PROCESSED');
      expect(second.error).toContain('Đơn này đã được xử lý');

      // Verify still only 1 audit log
      const logs = db.prepare('SELECT * FROM audit_logs WHERE team_id = ?').all(teamId) as any[];
      expect(logs.length).toBe(1);
    });

    it('prevents rejecting an already approved team', () => {
      repo.approveTeam(teamId, 'staff_1');
      const rejectAttempt = repo.rejectTeam(teamId, 'staff_2', 'Trễ hạn');
      expect(rejectAttempt.success).toBe(false);
      expect(rejectAttempt.code).toBe('ALREADY_PROCESSED');
    });

    it('prevents approving an already rejected team', () => {
      repo.rejectTeam(teamId, 'staff_1', 'Gian lận');
      const approveAttempt = repo.approveTeam(teamId, 'staff_2');
      expect(approveAttempt.success).toBe(false);
      expect(approveAttempt.code).toBe('ALREADY_PROCESSED');
    });
  });

  describe('Persistence across Database Restarts', () => {
    const testDbFile = path.join(process.cwd(), 'data', 'test_restart.sqlite');

    afterEach(() => {
      if (fs.existsSync(testDbFile)) {
        try { fs.unlinkSync(testDbFile); } catch {}
      }
    });

    it('persists tournaments, teams, players and audit logs across file reloads', () => {
      // 1. Initial write
      const diskDb1 = createDatabase(testDbFile);
      const repo1 = new TeamRepository(diskDb1);
      repo1.ensureTournament('uma_disk_tourney', 'Disk Cup');

      const parsed = RegistrationParser.parseRoster(valid5StartersRaw, 'SubA | 888888');
      const reg = repo1.registerTeam({
        tournamentId: 'uma_disk_tourney',
        name: 'Persistent Team',
        abbreviation: 'PER',
        captainDiscordId: 'capt_disk',
        captainContact: '0909090909',
        starters: parsed.starters,
        substitutes: parsed.substitutes
      });
      const teamId = reg.team!.id;
      repo1.approveTeam(teamId, 'staff_disk');
      diskDb1.close();

      // 2. Reopen database from disk file
      const diskDb2 = createDatabase(testDbFile);
      const repo2 = new TeamRepository(diskDb2);

      const reloadedTeam = repo2.getTeam(teamId);
      expect(reloadedTeam).toBeTruthy();
      expect(reloadedTeam?.name).toBe('Persistent Team');
      expect(reloadedTeam?.status).toBe('APPROVED');
      expect(reloadedTeam?.players?.length).toBe(6);

      const approvedList = repo2.listTeams('uma_disk_tourney', 'APPROVED');
      expect(approvedList.length).toBe(1);
      expect(approvedList[0].id).toBe(teamId);

      diskDb2.close();
    });
  });
});
