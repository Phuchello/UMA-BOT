import { describe, it, expect } from 'vitest';
import { TournamentOrganizerAdapter } from '../src/tournament/TournamentOrganizerAdapter.js';
import type { EngineTeam } from '../src/tournament/TournamentEngine.js';

describe('Phase 0C: TournamentOrganizerAdapter Implementation', () => {
  const teams15: EngineTeam[] = [
    { id: 't1', name: 'UMA Alpha', seed: 1 },
    { id: 't2', name: 'UMA Bravo', seed: 2 },
    { id: 't3', name: 'UMA Charlie', seed: 3 },
    { id: 't4', name: 'UMA Delta', seed: 4 },
    { id: 't5', name: 'UMA Echo', seed: 5 },
    { id: 't6', name: 'UMA Foxtrot', seed: 6 },
    { id: 't7', name: 'UMA Gamma', seed: 7 },
    { id: 't8', name: 'UMA Hydra', seed: 8 },
    { id: 't9', name: 'UMA Nova', seed: 9 },
    { id: 't10', name: 'UMA Phoenix', seed: 10 },
    { id: 't11', name: 'UMA Raven', seed: 11 },
    { id: 't12', name: 'UMA Sigma', seed: 12 },
    { id: 't13', name: 'UMA Titan', seed: 13 },
    { id: 't14', name: 'UMA Vortex', seed: 14 },
    { id: 't15', name: 'UMA Wolves', seed: 15 }
  ];

  it('initializes and generates 15-team bracket with correct BYE assignment', () => {
    const adapter = new TournamentOrganizerAdapter();
    adapter.createTournament('uma-cup-15', 'UMA Cup 15 Teams', { bestOf: 3 });
    adapter.registerTeams(teams15);

    const bracket = adapter.startTournament();

    expect(bracket.tournamentId).toBe('uma-cup-15');
    expect(bracket.name).toBe('UMA Cup 15 Teams');
    expect(bracket.status).toBe('in_progress');
    expect(bracket.totalRounds).toBe(4);
    expect(bracket.matches.length).toBe(14);

    // Round 1 has 7 matches
    const r1Matches = adapter.getMatches(1);
    expect(r1Matches.length).toBe(7);

    // Round 2 has 4 matches, and Match 1 already has UMA Alpha (Seed 1) waiting
    const r2Matches = adapter.getMatches(2);
    expect(r2Matches.length).toBe(4);
    expect(r2Matches[0].team1.id).toBe('t1');
    expect(r2Matches[0].team1.name).toBe('UMA Alpha');
    expect(r2Matches[0].team2.id).toBeNull();
  });

  it('reports match results and advances winners through rounds', () => {
    const adapter = new TournamentOrganizerAdapter();
    adapter.createTournament('uma-cup-sim', 'UMA Cup Sim', { bestOf: 3 });
    adapter.registerTeams(teams15);
    adapter.startTournament();

    // Round 1
    const r1Matches = adapter.getMatches(1);
    for (const m of r1Matches) {
      const res = adapter.reportResult(m.id, 2, 0);
      expect(res.bracket).toBeTruthy();
    }

    // After Round 1, all 4 Round 2 Quarterfinal matches must have both teams populated
    const r2Matches = adapter.getMatches(2);
    for (const m of r2Matches) {
      expect(m.team1.id).not.toBeNull();
      expect(m.team2.id).not.toBeNull();
      expect(m.team1.name).not.toBeNull();
      expect(m.team2.name).not.toBeNull();
      adapter.reportResult(m.id, 2, 1);
    }

    // Semifinals (Round 3)
    const r3Matches = adapter.getMatches(3);
    expect(r3Matches.length).toBe(2);
    for (const m of r3Matches) {
      expect(m.team1.id).not.toBeNull();
      expect(m.team2.id).not.toBeNull();
      adapter.reportResult(m.id, 2, 0);
    }

    // Grand Final (Round 4)
    const r4Matches = adapter.getMatches(4);
    expect(r4Matches.length).toBe(1);
    const finalMatch = r4Matches[0];
    expect(finalMatch.team1.id).toBe('t1'); // UMA Alpha reached final
    const finalResult = adapter.reportResult(finalMatch.id, 2, 1);

    expect(finalResult.bracket.status).toBe('completed');
    const endedFinal = adapter.getMatch(finalMatch.id);
    expect(endedFinal?.winnerId).toBe('t1');
  });

  it('resets match results and rolls back bracket advancement', () => {
    const adapter = new TournamentOrganizerAdapter();
    adapter.createTournament('uma-cup-rollback', 'UMA Rollback', { bestOf: 3 });
    adapter.registerTeams(teams15.slice(0, 4));
    adapter.startTournament();

    const r1m1 = adapter.getMatches(1)[0];
    const r2m1 = adapter.getMatches(2)[0];

    // Report result
    adapter.reportResult(r1m1.id, 2, 0);
    const updatedR2 = adapter.getMatch(r2m1.id);
    expect(updatedR2?.team1.id).toBe(r1m1.team1.id);

    // Reset result
    adapter.resetResult(r1m1.id);
    const resetR1 = adapter.getMatch(r1m1.id);
    expect(resetR1?.hasEnded).toBe(false);
    expect(resetR1?.team1.score).toBe(0);
    expect(resetR1?.team2.score).toBe(0);

    const rolledBackR2 = adapter.getMatch(r2m1.id);
    expect(rolledBackR2?.team1.id).toBeNull();
  });

  it('serializes state and restores it completely across instances', () => {
    const adapter1 = new TournamentOrganizerAdapter();
    adapter1.createTournament('uma-persist-1', 'UMA Persist', { bestOf: 3 });
    adapter1.registerTeams(teams15);
    adapter1.startTournament();

    const r1m1 = adapter1.getMatches(1)[0];
    adapter1.reportResult(r1m1.id, 2, 1);

    const json = adapter1.serialize();

    // Restore into fresh adapter instance
    const adapter2 = new TournamentOrganizerAdapter();
    adapter2.restore(json);

    const bracket2 = adapter2.getBracket();
    expect(bracket2.tournamentId).toBe('uma-persist-1');
    expect(bracket2.matches.length).toBe(14);

    const restoredR1m1 = adapter2.getMatch(r1m1.id);
    expect(restoredR1m1?.hasEnded).toBe(true);
    expect(restoredR1m1?.team1.score).toBe(2);
    expect(restoredR1m1?.team2.score).toBe(1);
    expect(restoredR1m1?.team1.name).toBe(r1m1.team1.name);

    // Can continue entering results in restored instance
    const r1m2 = adapter2.getMatches(1)[1];
    adapter2.reportResult(r1m2.id, 2, 0);
    expect(adapter2.getMatch(r1m2.id)?.hasEnded).toBe(true);
  });
});
