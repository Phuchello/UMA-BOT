import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase } from '../src/database/Database.js';
import { TeamRepository } from '../src/registration/TeamRepository.js';
import { RegistrationParser } from '../src/registration/RegistrationParser.js';
import { RegistrationUI } from '../src/bot/ui/RegistrationUI.js';

describe('Phase 1.5 Hardening: Tournament Identity, Correction Lifecycle & Capacity', () => {
  let db: any;
  let repo: TeamRepository;

  const tournament2027 = 'uma-cup-2027';
  const tournament2028 = 'uma-cup-2028';

  const defaultStarters = [
    { ingameName: 'Top', gameUid: 'UID_1001', isSubstitute: false, slotNumber: 1 },
    { ingameName: 'Jungle', gameUid: 'UID_1002', isSubstitute: false, slotNumber: 2 },
    { ingameName: 'Mid', gameUid: 'UID_1003', isSubstitute: false, slotNumber: 3 },
    { ingameName: 'Adc', gameUid: 'UID_1004', isSubstitute: false, slotNumber: 4 },
    { ingameName: 'Sp', gameUid: 'UID_1005', isSubstitute: false, slotNumber: 5 }
  ];

  beforeEach(() => {
    db = createDatabase(':memory:');
    repo = new TeamRepository(db);
    repo.ensureTournament(tournament2027, 'UMA Cup 2027', 16);
    repo.ensureTournament(tournament2028, 'UMA Cup 2028', 16);
  });

  describe('Fix 1: Tournament Identity Separation from Guild ID', () => {
    it('1. Same Discord guild supports two different tournaments without collision', () => {
      const reg2027 = repo.registerTeam({
        tournamentId: tournament2027,
        name: 'UMA Phoenix',
        abbreviation: 'PNX',
        captainDiscordId: 'capt_001',
        captainContact: '0912345678',
        starters: defaultStarters,
        substitutes: []
      });

      const reg2028 = repo.registerTeam({
        tournamentId: tournament2028,
        name: 'UMA Phoenix 2028',
        abbreviation: 'PNX28',
        captainDiscordId: 'capt_002',
        captainContact: '0987654321',
        starters: defaultStarters.map(p => ({ ...p, gameUid: `${p.gameUid}_28` })),
        substitutes: []
      });

      expect(reg2027.success).toBe(true);
      expect(reg2028.success).toBe(true);
      expect(repo.listTeams(tournament2027).length).toBe(1);
      expect(repo.listTeams(tournament2028).length).toBe(1);
    });

    it('2. UID duplicated in different YEARS/tournaments is allowed', () => {
      repo.registerTeam({
        tournamentId: tournament2027,
        name: 'Team 2027',
        abbreviation: 'T27',
        captainDiscordId: 'capt_001',
        captainContact: '0912345678',
        starters: defaultStarters,
        substitutes: []
      });

      // Same UIDs playing in next year's tournament
      const nextYearReg = repo.registerTeam({
        tournamentId: tournament2028,
        name: 'Team 2028',
        abbreviation: 'T28',
        captainDiscordId: 'capt_002',
        captainContact: '0987654321',
        starters: defaultStarters,
        substitutes: []
      });

      expect(nextYearReg.success).toBe(true);
      expect(nextYearReg.team).toBeTruthy();
    });

    it('3. UID duplicated in same tournament is rejected', () => {
      repo.registerTeam({
        tournamentId: tournament2027,
        name: 'Team Alpha',
        abbreviation: 'TAL',
        captainDiscordId: 'capt_001',
        captainContact: '0912345678',
        starters: defaultStarters,
        substitutes: []
      });

      const duplicateUidReg = repo.registerTeam({
        tournamentId: tournament2027,
        name: 'Team Beta',
        abbreviation: 'TBE',
        captainDiscordId: 'capt_002',
        captainContact: '0987654321',
        starters: [
          { ingameName: 'ClonedTop', gameUid: 'UID_1001', isSubstitute: false, slotNumber: 1 },
          { ingameName: 'P2', gameUid: 'UID_9992', isSubstitute: false, slotNumber: 2 },
          { ingameName: 'P3', gameUid: 'UID_9993', isSubstitute: false, slotNumber: 3 },
          { ingameName: 'P4', gameUid: 'UID_9994', isSubstitute: false, slotNumber: 4 },
          { ingameName: 'P5', gameUid: 'UID_9995', isSubstitute: false, slotNumber: 5 }
        ],
        substitutes: []
      });

      expect(duplicateUidReg.success).toBe(false);
      expect(duplicateUidReg.code).toBe('DUPLICATE_UID');
      expect(duplicateUidReg.error).toContain('đã được đăng ký bởi đội "Team Alpha"');
    });

    it('4. Team name duplicated in different tournaments is allowed', () => {
      const t1 = repo.registerTeam({
        tournamentId: tournament2027,
        name: 'UMA Phoenix',
        abbreviation: 'PNX',
        captainDiscordId: 'capt_001',
        captainContact: '0912345678',
        starters: defaultStarters,
        substitutes: []
      });

      const t2 = repo.registerTeam({
        tournamentId: tournament2028,
        name: 'UMA Phoenix', // Exact same name in different tournament
        abbreviation: 'PNX',
        captainDiscordId: 'capt_002',
        captainContact: '0987654321',
        starters: defaultStarters.map(p => ({ ...p, gameUid: `${p.gameUid}_next` })),
        substitutes: []
      });

      expect(t1.success).toBe(true);
      expect(t2.success).toBe(true);
    });

    it('5. Team name duplicated in same tournament is rejected', () => {
      repo.registerTeam({
        tournamentId: tournament2027,
        name: 'UMA Phoenix',
        abbreviation: 'PNX',
        captainDiscordId: 'capt_001',
        captainContact: '0912345678',
        starters: defaultStarters,
        substitutes: []
      });

      const dupName = repo.registerTeam({
        tournamentId: tournament2027,
        name: 'uma phoenix', // same name, case-insensitive
        abbreviation: 'PNX2',
        captainDiscordId: 'capt_002',
        captainContact: '0987654321',
        starters: defaultStarters.map(p => ({ ...p, gameUid: `${p.gameUid}_diff` })),
        substitutes: []
      });

      expect(dupName.success).toBe(false);
      expect(dupName.code).toBe('DUPLICATE_TEAM_NAME');
      expect(dupName.error).toContain('đã được sử dụng trong giải đấu này');
    });

    it('6. Captain may participate in different tournament years', () => {
      const captYear1 = repo.registerTeam({
        tournamentId: tournament2027,
        name: 'Team 2027',
        abbreviation: 'T27',
        captainDiscordId: 'capt_persistent',
        captainContact: '0912345678',
        starters: defaultStarters,
        substitutes: []
      });

      const captYear2 = repo.registerTeam({
        tournamentId: tournament2028,
        name: 'Team 2028',
        abbreviation: 'T28',
        captainDiscordId: 'capt_persistent', // Same captain next year
        captainContact: '0912345678',
        starters: defaultStarters.map(p => ({ ...p, gameUid: `${p.gameUid}_y2` })),
        substitutes: []
      });

      expect(captYear1.success).toBe(true);
      expect(captYear2.success).toBe(true);
    });
  });

  describe('Fix 2: Complete Registration Correction Workflow', () => {
    let teamId: string;
    const captainId = 'capt_corr_01';

    beforeEach(() => {
      const reg = repo.registerTeam({
        tournamentId: tournament2027,
        name: 'UMA Titans',
        abbreviation: 'TTN',
        captainDiscordId: captainId,
        captainContact: '0911223344',
        starters: defaultStarters,
        substitutes: []
      });
      teamId = reg.team!.id;
    });

    it('7. Correction request moves PENDING → NEEDS_CORRECTION with reason', () => {
      const correction = repo.requestCorrection(teamId, 'staff_btc_01', 'Sai thông tin UID tuyển thủ số 3');
      expect(correction.success).toBe(true);
      expect(correction.team?.status).toBe('NEEDS_CORRECTION');
      expect(correction.team?.rejectionReason).toBe('Sai thông tin UID tuyển thủ số 3');

      // Verify audit log
      const logs = db.prepare('SELECT * FROM audit_logs WHERE team_id = ?').all(teamId) as any[];
      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe('REQUEST_CORRECTION');
      expect(logs[0].previous_status).toBe('PENDING');
      expect(logs[0].new_status).toBe('NEEDS_CORRECTION');
      expect(logs[0].reason).toBe('Sai thông tin UID tuyển thủ số 3');
    });

    it('8 & 9 & 10 & 11. Captain edits same team, team ID remains unchanged, old player rows replaced, status becomes PENDING', () => {
      repo.requestCorrection(teamId, 'staff_btc_01', 'Cần sửa UID số 3');

      const correctedStarters = [
        { ingameName: 'Top', gameUid: 'UID_1001', isSubstitute: false, slotNumber: 1 },
        { ingameName: 'Jungle', gameUid: 'UID_1002', isSubstitute: false, slotNumber: 2 },
        { ingameName: 'Mid_Corrected', gameUid: 'UID_1003_FIXED', isSubstitute: false, slotNumber: 3 },
        { ingameName: 'Adc', gameUid: 'UID_1004', isSubstitute: false, slotNumber: 4 },
        { ingameName: 'Sp', gameUid: 'UID_1005', isSubstitute: false, slotNumber: 5 }
      ];

      const resubmitResult = repo.resubmitCorrectedTeam({
        teamId,
        tournamentId: tournament2027,
        captainDiscordId: captainId,
        name: 'UMA Titans Renamed',
        abbreviation: 'TTN2',
        captainContact: '0999888777',
        starters: correctedStarters,
        substitutes: [{ ingameName: 'NewSub', gameUid: 'SUB_01', isSubstitute: true, slotNumber: 1 }]
      });

      expect(resubmitResult.success).toBe(true);
      expect(resubmitResult.team?.id).toBe(teamId); // Same team ID preserved
      expect(resubmitResult.team?.status).toBe('PENDING'); // Returned to PENDING
      expect(resubmitResult.team?.name).toBe('UMA Titans Renamed');
      expect(resubmitResult.team?.rejectionReason).toBeNull(); // Rejection reason cleared

      // Verify old player rows were replaced
      const players = resubmitResult.team?.players || [];
      expect(players.length).toBe(6);
      expect(players.find(p => p.slotNumber === 3 && !p.isSubstitute)?.gameUid).toBe('UID_1003_FIXED');
      expect(players.find(p => p.gameUid === 'UID_1003')).toBeUndefined(); // Old UID gone

      // Verify audit trail recorded resubmission
      const logs = db.prepare('SELECT * FROM audit_logs WHERE team_id = ? ORDER BY timestamp ASC').all(teamId) as any[];
      expect(logs.length).toBe(2);
      expect(logs[1].action).toBe('RESUBMIT_CORRECTION');
      expect(logs[1].previous_status).toBe('NEEDS_CORRECTION');
      expect(logs[1].new_status).toBe('PENDING');
    });

    it('12. Invalid correction update rolls back with zero partial updates', () => {
      repo.requestCorrection(teamId, 'staff_btc_01', 'Sửa UID');

      // Attempt to resubmit with invalid roster (only 4 players)
      const invalidStarters = defaultStarters.slice(0, 4);
      const failedResubmit = repo.resubmitCorrectedTeam({
        teamId,
        tournamentId: tournament2027,
        captainDiscordId: captainId,
        name: 'Corrupted Team',
        abbreviation: 'CRP',
        captainContact: '0000',
        starters: invalidStarters,
        substitutes: []
      });

      expect(failedResubmit.success).toBe(false);
      expect(failedResubmit.code).toBe('INVALID_ROSTER_SIZE');

      // Verify team state was rolled back and unaffected
      const teamAfter = repo.getTeam(teamId)!;
      expect(teamAfter.name).toBe('UMA Titans'); // Not renamed
      expect(teamAfter.status).toBe('NEEDS_CORRECTION'); // Still NEEDS_CORRECTION
      expect(teamAfter.players?.length).toBe(5); // Original 5 players intact
    });

    it('16. Unauthorized user cannot edit another team\'s registration', () => {
      repo.requestCorrection(teamId, 'staff_btc_01', 'Sửa UID');

      const unauthorizedResubmit = repo.resubmitCorrectedTeam({
        teamId,
        tournamentId: tournament2027,
        captainDiscordId: 'stranger_user_99', // Not the captain!
        name: 'Hacked Team',
        abbreviation: 'HCK',
        captainContact: '0900000000',
        starters: defaultStarters,
        substitutes: []
      });

      expect(unauthorizedResubmit.success).toBe(false);
      expect(unauthorizedResubmit.code).toBe('UNAUTHORIZED');
      expect(unauthorizedResubmit.error).toContain('Bạn không có quyền chỉnh sửa đội này');
    });

    it('17. Stale correction button fails safely when team is not in NEEDS_CORRECTION state', () => {
      // Team is currently PENDING (not NEEDS_CORRECTION)
      const prematureResubmit = repo.resubmitCorrectedTeam({
        teamId,
        tournamentId: tournament2027,
        captainDiscordId: captainId,
        name: 'UMA Titans',
        abbreviation: 'TTN',
        captainContact: '0911223344',
        starters: defaultStarters,
        substitutes: []
      });

      expect(prematureResubmit.success).toBe(false);
      expect(prematureResubmit.code).toBe('INVALID_STATUS');
      expect(prematureResubmit.error).toContain('Đơn này hiện không ở trạng thái yêu cầu chỉnh sửa');
    });

    it('18. Repeated resubmit interaction is idempotent (second attempt fails safely)', () => {
      repo.requestCorrection(teamId, 'staff_btc_01', 'Sửa UID');

      const firstAttempt = repo.resubmitCorrectedTeam({
        teamId,
        tournamentId: tournament2027,
        captainDiscordId: captainId,
        name: 'UMA Titans',
        abbreviation: 'TTN',
        captainContact: '0911223344',
        starters: defaultStarters,
        substitutes: []
      });
      expect(firstAttempt.success).toBe(true);

      // Second immediate click / network retry
      const secondAttempt = repo.resubmitCorrectedTeam({
        teamId,
        tournamentId: tournament2027,
        captainDiscordId: captainId,
        name: 'UMA Titans',
        abbreviation: 'TTN',
        captainContact: '0911223344',
        starters: defaultStarters,
        substitutes: []
      });

      expect(secondAttempt.success).toBe(false);
      expect(secondAttempt.code).toBe('INVALID_STATUS'); // Team is now PENDING
    });
  });

  describe('Fix 3 & 4: Capacity Enforcement & Concurrency Semantics', () => {
    const miniTourney = 'mini-tourney-cap';

    beforeEach(() => {
      // 2-team capacity tournament
      repo.ensureTournament(miniTourney, 'Mini Cup', 2);
    });

    it('13. Registration full at maxTeams rejects new registrations with REGISTRATION_FULL', () => {
      // Team 1
      const t1 = repo.registerTeam({
        tournamentId: miniTourney,
        name: 'Team 1',
        abbreviation: 'T1',
        captainDiscordId: 'c1',
        captainContact: '01',
        starters: defaultStarters.map(p => ({ ...p, gameUid: `c1_${p.gameUid}` })),
        substitutes: []
      });
      expect(t1.success).toBe(true);

      // Team 2
      const t2 = repo.registerTeam({
        tournamentId: miniTourney,
        name: 'Team 2',
        abbreviation: 'T2',
        captainDiscordId: 'c2',
        captainContact: '02',
        starters: defaultStarters.map(p => ({ ...p, gameUid: `c2_${p.gameUid}` })),
        substitutes: []
      });
      expect(t2.success).toBe(true);

      // Team 3 (Should be rejected)
      const t3 = repo.registerTeam({
        tournamentId: miniTourney,
        name: 'Team 3',
        abbreviation: 'T3',
        captainDiscordId: 'c3',
        captainContact: '03',
        starters: defaultStarters.map(p => ({ ...p, gameUid: `c3_${p.gameUid}` })),
        substitutes: []
      });

      expect(t3.success).toBe(false);
      expect(t3.code).toBe('REGISTRATION_FULL');
      expect(t3.error).toBe('Giải đấu đã đủ số lượng đội đăng ký.');
    });

    it('14. Capacity slot becomes available after eligible withdrawal/rejection', () => {
      const t1 = repo.registerTeam({
        tournamentId: miniTourney,
        name: 'Team 1',
        abbreviation: 'T1',
        captainDiscordId: 'c1',
        captainContact: '01',
        starters: defaultStarters.map(p => ({ ...p, gameUid: `c1_${p.gameUid}` })),
        substitutes: []
      });

      const t2 = repo.registerTeam({
        tournamentId: miniTourney,
        name: 'Team 2',
        abbreviation: 'T2',
        captainDiscordId: 'c2',
        captainContact: '02',
        starters: defaultStarters.map(p => ({ ...p, gameUid: `c2_${p.gameUid}` })),
        substitutes: []
      });

      // Capacity reached (2/2)
      expect(repo.getActiveTeamsCount(miniTourney)).toBe(2);

      // Team 2 withdraws
      const withdraw = repo.withdrawTeam(t2.team!.id, 'c2');
      expect(withdraw.success).toBe(true);
      expect(repo.getActiveTeamsCount(miniTourney)).toBe(1);

      // Now Team 3 can register into the freed slot!
      const t3 = repo.registerTeam({
        tournamentId: miniTourney,
        name: 'Team 3',
        abbreviation: 'T3',
        captainDiscordId: 'c3',
        captainContact: '03',
        starters: defaultStarters.map(p => ({ ...p, gameUid: `c3_${p.gameUid}` })),
        substitutes: []
      });

      expect(t3.success).toBe(true);
      expect(t3.team?.name).toBe('Team 3');
      expect(repo.getActiveTeamsCount(miniTourney)).toBe(2);
    });

    it('15. Race/concurrency condition on final slot: when 1 slot remains, only ONE can win the slot', () => {
      // 1 slot filled, 1 remaining
      repo.registerTeam({
        tournamentId: miniTourney,
        name: 'Team 1',
        abbreviation: 'T1',
        captainDiscordId: 'c1',
        captainContact: '01',
        starters: defaultStarters.map(p => ({ ...p, gameUid: `c1_${p.gameUid}` })),
        substitutes: []
      });

      // Two candidate teams competing for the 2nd (final) slot
      const inputA = {
        tournamentId: miniTourney,
        name: 'Competitor A',
        abbreviation: 'CPA',
        captainDiscordId: 'capt_A',
        captainContact: '0901',
        starters: defaultStarters.map(p => ({ ...p, gameUid: `cA_${p.gameUid}` })),
        substitutes: []
      };

      const inputB = {
        tournamentId: miniTourney,
        name: 'Competitor B',
        abbreviation: 'CPB',
        captainDiscordId: 'capt_B',
        captainContact: '0902',
        starters: defaultStarters.map(p => ({ ...p, gameUid: `cB_${p.gameUid}` })),
        substitutes: []
      };

      // In node:sqlite with synchronous execution, each call executes within an isolated
      // BEGIN IMMEDIATE TRANSACTION. The first transaction to acquire the write lock succeeds.
      const resultA = repo.registerTeam(inputA);
      const resultB = repo.registerTeam(inputB);

      expect(resultA.success).toBe(true);
      expect(resultB.success).toBe(false);
      expect(resultB.code).toBe('REGISTRATION_FULL');
      expect(resultB.error).toBe('Giải đấu đã đủ số lượng đội đăng ký.');

      // Verify exactly 2 active teams exist
      expect(repo.getActiveTeamsCount(miniTourney)).toBe(2);
    });
  });

  describe('Fix 7: Live Guide Accuracy Audit', () => {
    it('19. Guide embed describes verified Phase 1 workflow and does not claim Phase 2 features are active', () => {
      const guideEmbed = RegistrationUI.createGuideEmbed();
      const desc = guideEmbed.data.description || '';

      // Verified Phase 1 workflow is present
      expect(desc).toContain('Đăng ký');
      expect(desc).toContain('BTC Kiểm tra');
      expect(desc).toContain('Phê duyệt');
      expect(desc).toContain('Yêu cầu sửa');
      expect(desc).toContain('Từ chối');

      // Unimplemented Phase 2 features must NOT be described as active/operational
      expect(desc).not.toContain('Hệ thống tự động tạo phòng');
      expect(desc).not.toContain('gửi ảnh chụp KDA để trọng tài kiểm tra');

      // Must explicitly note future availability
      expect(desc).toContain('giai đoạn tiếp theo (Phase 2)');
    });
  });
});
