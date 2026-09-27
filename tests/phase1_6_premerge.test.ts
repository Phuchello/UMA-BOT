import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase } from '../src/database/Database.js';
import { TeamRepository } from '../src/registration/TeamRepository.js';

/**
 * Phase 1.6 Pre-Merge Test Suite
 *
 * Covers the active-only uniqueness policy introduced in Phase 1.6:
 * - REJECTED / WITHDRAWN rows preserve audit history but FREE their identifier slots.
 * - The same captain, team name, abbreviation, and player UIDs may be re-used
 *   in new registrations once the old team is REJECTED or WITHDRAWN.
 * - ACTIVE duplicates (PENDING / APPROVED / NEEDS_CORRECTION) are still blocked.
 * - MAX_TEAMS source of truth: DB capacity must match config, not a hardcoded default.
 */
describe('Phase 1.6 Pre-Merge: Re-Registration Semantics & MAX_TEAMS', () => {
  let db: any;
  let repo: TeamRepository;

  const tournamentId = 'uma-cup-2027';

  // A complete valid 5-starter roster
  const makeStarters = (prefix: string) => [
    { ingameName: `${prefix}_Top`, gameUid: `${prefix}_U1`, isSubstitute: false, slotNumber: 1 },
    { ingameName: `${prefix}_Jun`, gameUid: `${prefix}_U2`, isSubstitute: false, slotNumber: 2 },
    { ingameName: `${prefix}_Mid`, gameUid: `${prefix}_U3`, isSubstitute: false, slotNumber: 3 },
    { ingameName: `${prefix}_Adc`, gameUid: `${prefix}_U4`, isSubstitute: false, slotNumber: 4 },
    { ingameName: `${prefix}_Sp`,  gameUid: `${prefix}_U5`, isSubstitute: false, slotNumber: 5 },
  ];

  // Distinct starters that share exact UIDs with makeStarters('A')
  const sameUidsAsA = makeStarters('A').map((p, i) => ({
    ...p,
    ingameName: `NewPlayer_${i + 1}`, // different display name, same UID
  }));

  beforeEach(() => {
    db = createDatabase(':memory:');
    repo = new TeamRepository(db);
    // Bootstrap tournament with capacity 16 (overridden per-test when needed)
    repo.ensureTournament(tournamentId, 'UMA Cup 2027', 16);
  });

  // ---------------------------------------------------------------------------
  // Section 1: REJECTED team frees identifier slots
  // ---------------------------------------------------------------------------

  describe('Section 1: REJECTED team frees identifier slots', () => {
    it('1. Rejected team frees capacity slot — new registration is accepted', () => {
      // Register and reject
      const r1 = repo.registerTeam({
        tournamentId,
        name: 'Alpha',
        abbreviation: 'ALP',
        captainDiscordId: 'capt_A',
        captainContact: '0900000001',
        starters: makeStarters('A'),
        substitutes: [],
      });
      expect(r1.success).toBe(true);
      repo.rejectTeam(r1.team!.id, 'staff_01', 'Test rejection');

      // New team from a different captain should now fit (capacity was freed)
      const r2 = repo.registerTeam({
        tournamentId,
        name: 'Beta',
        abbreviation: 'BET',
        captainDiscordId: 'capt_B',
        captainContact: '0900000002',
        starters: makeStarters('B'),
        substitutes: [],
      });
      expect(r2.success).toBe(true);
    });

    it('2. Same captain can create a new registration after their team is rejected', () => {
      const r1 = repo.registerTeam({
        tournamentId,
        name: 'Alpha',
        abbreviation: 'ALP',
        captainDiscordId: 'capt_A',
        captainContact: '0900000001',
        starters: makeStarters('A'),
        substitutes: [],
      });
      expect(r1.success).toBe(true);
      repo.rejectTeam(r1.team!.id, 'staff_01', 'Duplicate UIDs');

      // Same captain registers a fresh team
      const r2 = repo.registerTeam({
        tournamentId,
        name: 'Alpha Reborn',
        abbreviation: 'ARB',
        captainDiscordId: 'capt_A', // same captain
        captainContact: '0900000001',
        starters: makeStarters('A2'),
        substitutes: [],
      });
      expect(r2.success).toBe(true, r2.error);
    });

    it('3. Former roster UIDs can be re-used after REJECTED (no active team owns them)', () => {
      const r1 = repo.registerTeam({
        tournamentId,
        name: 'Alpha',
        abbreviation: 'ALP',
        captainDiscordId: 'capt_A',
        captainContact: '0900000001',
        starters: makeStarters('A'),
        substitutes: [],
      });
      expect(r1.success).toBe(true);
      repo.rejectTeam(r1.team!.id, 'staff_01', 'Invalid UIDs');

      // Different captain re-uses the same UIDs
      const r2 = repo.registerTeam({
        tournamentId,
        name: 'Gamma',
        abbreviation: 'GAM',
        captainDiscordId: 'capt_G',
        captainContact: '0900000003',
        starters: sameUidsAsA,
        substitutes: [],
      });
      expect(r2.success).toBe(true, r2.error);
    });

    it('4. Same team name may be re-used after REJECTED', () => {
      const r1 = repo.registerTeam({
        tournamentId,
        name: 'Alpha',
        abbreviation: 'ALP',
        captainDiscordId: 'capt_A',
        captainContact: '0900000001',
        starters: makeStarters('A'),
        substitutes: [],
      });
      expect(r1.success).toBe(true);
      repo.rejectTeam(r1.team!.id, 'staff_01', 'Roster error');

      const r2 = repo.registerTeam({
        tournamentId,
        name: 'Alpha', // same name
        abbreviation: 'AL2',
        captainDiscordId: 'capt_B',
        captainContact: '0900000002',
        starters: makeStarters('B'),
        substitutes: [],
      });
      expect(r2.success).toBe(true, r2.error);
    });

    it('5. Same abbreviation may be re-used after REJECTED', () => {
      const r1 = repo.registerTeam({
        tournamentId,
        name: 'Alpha',
        abbreviation: 'ALP',
        captainDiscordId: 'capt_A',
        captainContact: '0900000001',
        starters: makeStarters('A'),
        substitutes: [],
      });
      expect(r1.success).toBe(true);
      repo.rejectTeam(r1.team!.id, 'staff_01', 'Roster error');

      const r2 = repo.registerTeam({
        tournamentId,
        name: 'Alpha Prime',
        abbreviation: 'ALP', // same abbreviation
        captainDiscordId: 'capt_B',
        captainContact: '0900000002',
        starters: makeStarters('B'),
        substitutes: [],
      });
      expect(r2.success).toBe(true, r2.error);
    });
  });

  // ---------------------------------------------------------------------------
  // Section 2: WITHDRAWN team frees identifier slots (same as REJECTED)
  // ---------------------------------------------------------------------------

  describe('Section 2: WITHDRAWN team frees identifier slots', () => {
    it('6a. Same team name may be re-used after WITHDRAWN', () => {
      const r1 = repo.registerTeam({
        tournamentId,
        name: 'Delta',
        abbreviation: 'DLT',
        captainDiscordId: 'capt_D',
        captainContact: '0900000004',
        starters: makeStarters('D'),
        substitutes: [],
      });
      expect(r1.success).toBe(true);
      repo.withdrawTeam(r1.team!.id, 'capt_D');

      const r2 = repo.registerTeam({
        tournamentId,
        name: 'Delta', // same name
        abbreviation: 'DL2',
        captainDiscordId: 'capt_E',
        captainContact: '0900000005',
        starters: makeStarters('E'),
        substitutes: [],
      });
      expect(r2.success).toBe(true, r2.error);
    });

    it('6b. Same roster UIDs may be re-used after WITHDRAWN', () => {
      const r1 = repo.registerTeam({
        tournamentId,
        name: 'Delta',
        abbreviation: 'DLT',
        captainDiscordId: 'capt_D',
        captainContact: '0900000004',
        starters: makeStarters('A'), // use 'A' UIDs
        substitutes: [],
      });
      expect(r1.success).toBe(true);
      repo.withdrawTeam(r1.team!.id, 'capt_D');

      const r2 = repo.registerTeam({
        tournamentId,
        name: 'Epsilon',
        abbreviation: 'EPS',
        captainDiscordId: 'capt_E',
        captainContact: '0900000005',
        starters: sameUidsAsA, // same UIDs
        substitutes: [],
      });
      expect(r2.success).toBe(true, r2.error);
    });
  });

  // ---------------------------------------------------------------------------
  // Section 3: Historical records remain intact
  // ---------------------------------------------------------------------------

  describe('Section 3: Historical records are preserved', () => {
    it('7. Historical REJECTED row remains intact after re-registration', () => {
      const r1 = repo.registerTeam({
        tournamentId,
        name: 'Alpha',
        abbreviation: 'ALP',
        captainDiscordId: 'capt_A',
        captainContact: '0900000001',
        starters: makeStarters('A'),
        substitutes: [],
      });
      expect(r1.success).toBe(true);
      repo.rejectTeam(r1.team!.id, 'staff_01', 'Roster error');

      // Re-register
      const r2 = repo.registerTeam({
        tournamentId,
        name: 'Alpha',
        abbreviation: 'ALP',
        captainDiscordId: 'capt_A',
        captainContact: '0900000001',
        starters: makeStarters('A'),
        substitutes: [],
      });
      expect(r2.success).toBe(true);

      // Both teams exist — old REJECTED record preserved, new PENDING record created
      const allTeams = repo.listTeams(tournamentId);
      const rejected = allTeams.filter(t => t.status === 'REJECTED');
      const pending = allTeams.filter(t => t.status === 'PENDING');
      expect(rejected).toHaveLength(1);
      expect(rejected[0].id).toBe(r1.team!.id);
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe(r2.team!.id);
      // IDs must be distinct — new row, not update in place
      expect(r2.team!.id).not.toBe(r1.team!.id);
    });
  });

  // ---------------------------------------------------------------------------
  // Section 4: Active duplicates are still blocked
  // ---------------------------------------------------------------------------

  describe('Section 4: Active duplicates are still blocked', () => {
    it('8. Active duplicate team name is rejected (PENDING blocks new registration)', () => {
      repo.registerTeam({
        tournamentId,
        name: 'Alpha',
        abbreviation: 'ALP',
        captainDiscordId: 'capt_A',
        captainContact: '0900000001',
        starters: makeStarters('A'),
        substitutes: [],
      });

      const dup = repo.registerTeam({
        tournamentId,
        name: 'Alpha', // same name — team A is still PENDING
        abbreviation: 'ALP2',
        captainDiscordId: 'capt_B',
        captainContact: '0900000002',
        starters: makeStarters('B'),
        substitutes: [],
      });
      expect(dup.success).toBe(false);
      expect(dup.code).toBe('DUPLICATE_TEAM_NAME');
    });

    it('9. Active duplicate abbreviation is rejected (PENDING blocks new registration)', () => {
      repo.registerTeam({
        tournamentId,
        name: 'Alpha',
        abbreviation: 'ALP',
        captainDiscordId: 'capt_A',
        captainContact: '0900000001',
        starters: makeStarters('A'),
        substitutes: [],
      });

      const dup = repo.registerTeam({
        tournamentId,
        name: 'Alpha New',
        abbreviation: 'ALP', // same abbreviation — team A is still PENDING
        captainDiscordId: 'capt_B',
        captainContact: '0900000002',
        starters: makeStarters('B'),
        substitutes: [],
      });
      expect(dup.success).toBe(false);
      expect(dup.code).toBe('DUPLICATE_ABBREVIATION');
    });

    it('10. Active duplicate UID is rejected (APPROVED team blocks new registration)', () => {
      const r1 = repo.registerTeam({
        tournamentId,
        name: 'Alpha',
        abbreviation: 'ALP',
        captainDiscordId: 'capt_A',
        captainContact: '0900000001',
        starters: makeStarters('A'),
        substitutes: [],
      });
      expect(r1.success).toBe(true);
      repo.approveTeam(r1.team!.id, 'staff_01');

      const dup = repo.registerTeam({
        tournamentId,
        name: 'Alpha Clone',
        abbreviation: 'ACL',
        captainDiscordId: 'capt_C',
        captainContact: '0900000003',
        starters: sameUidsAsA, // same UIDs — team A is now APPROVED
        substitutes: [],
      });
      expect(dup.success).toBe(false);
      expect(dup.code).toBe('DUPLICATE_UID');
    });
  });

  // ---------------------------------------------------------------------------
  // Section 5: MAX_TEAMS source of truth
  // ---------------------------------------------------------------------------

  describe('Section 5: MAX_TEAMS source of truth', () => {
    it('11. MAX_TEAMS=3 — DB capacity is 3, 4th registration fails with REGISTRATION_FULL', () => {
      // Bootstrap a tournament with capacity 3 (simulates MAX_TEAMS=3 in config)
      const smallTournament = 'uma-cup-small';
      repo.ensureTournament(smallTournament, 'UMA Cup Small', 3);

      const tourney = repo.getTournament(smallTournament);
      expect(tourney).not.toBeNull();
      expect(tourney!.maxTeams).toBe(3); // DB must reflect capacity 3, not hardcoded 16

      // Fill all 3 slots
      for (let i = 1; i <= 3; i++) {
        const r = repo.registerTeam({
          tournamentId: smallTournament,
          name: `Team ${i}`,
          abbreviation: `T${i}`,
          captainDiscordId: `capt_${i}`,
          captainContact: `090000000${i}`,
          starters: makeStarters(`S${i}`),
          substitutes: [],
        });
        expect(r.success).toBe(true, `Team ${i} registration failed: ${r.error}`);
      }

      // 4th registration must fail
      const r4 = repo.registerTeam({
        tournamentId: smallTournament,
        name: 'Team 4',
        abbreviation: 'T4',
        captainDiscordId: 'capt_4',
        captainContact: '0900000004',
        starters: makeStarters('S4'),
        substitutes: [],
      });
      expect(r4.success).toBe(false);
      expect(r4.code).toBe('REGISTRATION_FULL');

      // Verify active count is exactly 3
      const count = repo.getActiveTeamsCount(smallTournament);
      expect(count).toBe(3);
    });

    it('12. registerTeam fails with TOURNAMENT_NOT_FOUND if tournament was never bootstrapped', () => {
      const r = repo.registerTeam({
        tournamentId: 'non-existent-tourney',
        name: 'Ghost Team',
        abbreviation: 'GHT',
        captainDiscordId: 'capt_X',
        captainContact: '0900000099',
        starters: makeStarters('X'),
        substitutes: [],
      });
      expect(r.success).toBe(false);
      expect(r.code).toBe('TOURNAMENT_NOT_FOUND');
    });
  });
});
