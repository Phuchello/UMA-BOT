import { describe, it, expect } from 'vitest';
import Manager from 'tournament-organizer';

describe('Phase 0: Tournament Engine Validation (tournament-organizer)', () => {
  const teamNames = [
    'UMA Alpha',    // Seed 1
    'UMA Bravo',    // Seed 2
    'UMA Charlie',  // Seed 3
    'UMA Delta',    // Seed 4
    'UMA Echo',     // Seed 5
    'UMA Foxtrot',  // Seed 6
    'UMA Gamma',    // Seed 7
    'UMA Hydra',    // Seed 8
    'UMA Nova',     // Seed 9
    'UMA Phoenix',  // Seed 10
    'UMA Raven',    // Seed 11
    'UMA Sigma',    // Seed 12
    'UMA Titan',    // Seed 13
    'UMA Vortex',   // Seed 14
    'UMA Wolves'    // Seed 15
  ];

  it('validates 15-team Single Elimination topology (16 slots, 1 BYE, 14 matches)', () => {
    const manager = new Manager();
    const tourney = manager.createTournament('UMA 15-Team Cup', {
      stageOne: { format: 'single-elimination' },
      scoring: { bestOf: 3 },
      sorting: 'ascending'
    });

    teamNames.forEach((name, index) => {
      const p = tourney.createPlayer(name, `team-${index + 1}`);
      p.set({ value: index + 1 });
    });

    tourney.startTournament();

    expect(tourney.getStatus()).toBe('stage-one');
    expect(tourney.getRoundNumber()).toBe(1);

    const matches = tourney.getMatches();
    // 15 teams -> 14 total matches across 4 rounds (7 + 4 + 2 + 1)
    expect(matches.length).toBe(14);

    const r1 = tourney.getMatchesByRound(1);
    const r2 = tourney.getMatchesByRound(2);
    const r3 = tourney.getMatchesByRound(3);
    const r4 = tourney.getMatchesByRound(4);

    expect(r1.length).toBe(7);
    expect(r2.length).toBe(4);
    expect(r3.length).toBe(2);
    expect(r4.length).toBe(1);

    // Seed 1 (UMA Alpha) receives the BYE and is seeded directly into Round 2 Match 1
    const r2m1 = r2[0];
    expect(r2m1.getPlayer1().id).toBe('team-1');
    expect(r2m1.getPlayer2().id).toBeNull(); // Awaiting winner of R1 match
  });

  it('progresses winners from Round 1 through Quarterfinals, Semifinals, and Final', () => {
    const manager = new Manager();
    const tourney = manager.createTournament('UMA 15-Team Cup', {
      stageOne: { format: 'single-elimination' },
      scoring: { bestOf: 3 },
      sorting: 'ascending'
    });

    teamNames.forEach((name, index) => {
      const p = tourney.createPlayer(name, `team-${index + 1}`);
      p.set({ value: index + 1 });
    });

    tourney.startTournament();

    // Round 1 (7 matches)
    for (const m of tourney.getMatchesByRound(1)) {
      expect(m.getPlayer1().id).not.toBeNull();
      expect(m.getPlayer2().id).not.toBeNull();
      tourney.enterResult(m.getId(), 2, 0);
      expect(m.hasEnded()).toBe(true);
      expect(m.getWinner()?.id).toBe(m.getPlayer1().id);
    }

    // Round 2 Quarterfinals (4 matches) - all slots should now be filled
    for (const m of tourney.getMatchesByRound(2)) {
      expect(m.getPlayer1().id).not.toBeNull();
      expect(m.getPlayer2().id).not.toBeNull();
      expect(m.isActive()).toBe(true);
      tourney.enterResult(m.getId(), 2, 1);
      expect(m.hasEnded()).toBe(true);
    }

    // Round 3 Semifinals (2 matches)
    for (const m of tourney.getMatchesByRound(3)) {
      expect(m.getPlayer1().id).not.toBeNull();
      expect(m.getPlayer2().id).not.toBeNull();
      tourney.enterResult(m.getId(), 2, 0);
      expect(m.hasEnded()).toBe(true);
    }

    // Round 4 Grand Final (1 match)
    const finalMatch = tourney.getMatchesByRound(4)[0];
    expect(finalMatch.getPlayer1().id).not.toBeNull();
    expect(finalMatch.getPlayer2().id).not.toBeNull();

    // Player 1 wins final
    tourney.enterResult(finalMatch.getId(), 2, 1);
    expect(finalMatch.hasEnded()).toBe(true);
    expect(finalMatch.getWinner()?.id).toBe(finalMatch.getPlayer1().id);
  });

  it('supports result rollback and bracket reversal with clearResult', () => {
    const manager = new Manager();
    const tourney = manager.createTournament('UMA Rollback Test', {
      stageOne: { format: 'single-elimination' },
      scoring: { bestOf: 3 }
    });

    teamNames.slice(0, 4).forEach((name, index) => {
      tourney.createPlayer(name, `team-${index + 1}`);
    });

    tourney.startTournament();

    const r1m1 = tourney.getMatchesByRound(1)[0];
    const r2m1 = tourney.getMatchesByRound(2)[0];

    // Enter result for match 1
    const p1Id = r1m1.getPlayer1().id;
    tourney.enterResult(r1m1.getId(), 2, 0);
    expect(r1m1.hasEnded()).toBe(true);
    expect(r2m1.getPlayer1().id).toBe(p1Id); // Advanced to next round

    // Clear result
    tourney.clearResult(r1m1.getId());
    expect(r1m1.hasEnded()).toBe(false);
    expect(r1m1.isActive()).toBe(true);
    expect(r1m1.getPlayer1().win).toBe(0);
    expect(r1m1.getPlayer2().win).toBe(0);

    // Winner should be removed from next round
    expect(r2m1.getPlayer1().id).toBeNull();
  });

  it('supports full state serialization and restoration', () => {
    const manager = new Manager();
    const tourney = manager.createTournament('UMA Persist Test', {
      stageOne: { format: 'single-elimination' },
      scoring: { bestOf: 3 },
      sorting: 'ascending'
    });

    teamNames.forEach((name, index) => {
      const p = tourney.createPlayer(name, `team-${index + 1}`);
      p.set({ value: index + 1 });
    });

    tourney.startTournament();

    // Play one match in R1
    const firstMatch = tourney.getMatchesByRound(1)[0];
    tourney.enterResult(firstMatch.getId(), 2, 1);

    // Serialize
    const state = tourney.getValues();
    const serializedJson = JSON.stringify(state);
    expect(serializedJson).toBeTruthy();

    // Restore in a fresh manager instance
    const newManager = new Manager();
    const loadedTourney = newManager.loadTournament(JSON.parse(serializedJson));

    expect(loadedTourney.getId()).toBe(tourney.getId());
    expect(loadedTourney.getPlayers().length).toBe(15);
    expect(loadedTourney.getMatches().length).toBe(14);

    const reloadedFirstMatch = loadedTourney.getMatch(firstMatch.getId());
    expect(reloadedFirstMatch.hasEnded()).toBe(true);
    expect(reloadedFirstMatch.getPlayer1().win).toBe(2);
    expect(reloadedFirstMatch.getPlayer2().win).toBe(1);

    // Can continue entering results on reloaded tournament
    const secondMatch = loadedTourney.getMatchesByRound(1)[1];
    loadedTourney.enterResult(secondMatch.getId(), 2, 0);
    expect(secondMatch.hasEnded()).toBe(true);
  });
});
