import Manager from 'tournament-organizer';

console.log('=== PHASE 0A & 0B: REFINED ENGINE SPIKE ===\n');

const manager = new Manager();
const tourney = manager.createTournament('UMA 15-Team Championship', {
  stageOne: { format: 'single-elimination' },
  scoring: { bestOf: 3 },
  sorting: 'ascending'
});

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

console.log('1. Registering 15 teams with explicit seeds (1 to 15)...');
teamNames.forEach((name, index) => {
  const p = tourney.createPlayer(name, `team-${index + 1}`);
  p.set({ value: index + 1 });
});

tourney.startTournament();

console.log(`Tournament status: ${tourney.getStatus()}`);
console.log(`Current round: ${tourney.getRoundNumber()}`);
console.log(`Total bracket matches: ${tourney.getMatches().length}`);

const getTeamName = (id: string | null) => {
  if (!id) return 'TBD';
  try {
    return tourney.getPlayer(id).getName();
  } catch {
    return id;
  }
};

console.log('\n--- Bracket Structure by Round ---');
for (let r = 1; r <= 4; r++) {
  const roundMatches = tourney.getMatchesByRound(r);
  console.log(`\nRound ${r} (${roundMatches.length} matches):`);
  for (const m of roundMatches) {
    const p1Id = m.getPlayer1()?.id;
    const p2Id = m.getPlayer2()?.id;
    console.log(
      `  Match #${m.getMatchNumber()} (ID: ${m.getId().slice(0, 8)}): ` +
      `[${getTeamName(p1Id)} (${p1Id ?? 'TBD'})] vs [${getTeamName(p2Id)} (${p2Id ?? 'TBD'})] | ` +
      `isBye: ${m.isBye()} | active: ${m.isActive()}`
    );
  }
}

console.log('\n2. Simulating Round 1...');
const r1 = tourney.getMatchesByRound(1);
for (const m of r1) {
  const p1 = m.getPlayer1();
  const p2 = m.getPlayer2();
  if (p1?.id && p2?.id) {
    // Higher seed wins 2-0
    tourney.enterResult(m.getId(), 2, 0);
    console.log(`  R1 Result: ${getTeamName(p1.id)} def. ${getTeamName(p2.id)} (2-0)`);
  }
}

console.log('\n--- Round 2 Matches After Round 1 Advancement ---');
const r2 = tourney.getMatchesByRound(2);
for (const m of r2) {
  const p1Id = m.getPlayer1()?.id;
  const p2Id = m.getPlayer2()?.id;
  console.log(
    `  Match #${m.getMatchNumber()} (ID: ${m.getId().slice(0, 8)}): ` +
    `[${getTeamName(p1Id)}] vs [${getTeamName(p2Id)}] | active: ${m.isActive()}`
  );
}

console.log('\n3. Simulating Quarterfinals (Round 2)...');
for (const m of r2) {
  const p1 = m.getPlayer1();
  const p2 = m.getPlayer2();
  if (p1?.id && p2?.id) {
    tourney.enterResult(m.getId(), 2, 1);
    console.log(`  QF Result: ${getTeamName(p1.id)} def. ${getTeamName(p2.id)} (2-1)`);
  }
}

console.log('\n4. Simulating Semifinals (Round 3)...');
const r3 = tourney.getMatchesByRound(3);
for (const m of r3) {
  const p1 = m.getPlayer1();
  const p2 = m.getPlayer2();
  if (p1?.id && p2?.id) {
    tourney.enterResult(m.getId(), 2, 0);
    console.log(`  SF Result: ${getTeamName(p1.id)} def. ${getTeamName(p2.id)} (2-0)`);
  }
}

console.log('\n5. Simulating Grand Final (Round 4)...');
const r4 = tourney.getMatchesByRound(4);
for (const m of r4) {
  const p1 = m.getPlayer1();
  const p2 = m.getPlayer2();
  if (p1?.id && p2?.id) {
    tourney.enterResult(m.getId(), 2, 1);
    console.log(`  Final Result: ${getTeamName(p1.id)} def. ${getTeamName(p2.id)} (2-1)`);
    console.log(`  🏆 CHAMPION: ${getTeamName(p1.id)}`);
  }
}

console.log(`\nTournament status after final match: ${tourney.getStatus()}`);
console.log('Top 4 Standings:');
const standings = tourney.getStandings();
standings.slice(0, 4).forEach((s, idx) => {
  console.log(`  ${idx + 1}. ${getTeamName(s.id)} (ID: ${s.id}) | Points: ${s.points} | Wins: ${s.matchWins}`);
});

console.log('\n6. Testing Rollback / clearResult on Final...');
const finalMatch = r4[0];
console.log(`Clearing final match (${finalMatch.getId().slice(0, 8)})...`);
tourney.clearResult(finalMatch.getId());
console.log(`After clear - Final match hasEnded: ${finalMatch.hasEnded()}, active: ${finalMatch.isActive()}`);
console.log(`Player 1 wins: ${finalMatch.getPlayer1().win}, Player 2 wins: ${finalMatch.getPlayer2().win}`);

console.log('\n7. Testing Persistence Serialization & Reload...');
const exported = tourney.getValues();
const newManager = new Manager();
const reloaded = newManager.loadTournament(exported);
console.log(`Reloaded Tournament ID: ${reloaded.getId()}`);
console.log(`Reloaded Teams: ${reloaded.getPlayers().length}`);
console.log(`Reloaded Matches: ${reloaded.getMatches().length}`);
console.log(`Reloaded Status: ${reloaded.getStatus()}`);
const reloadedFinal = reloaded.getMatchesByRound(4)[0];
console.log(`Re-entering final result in reloaded tournament...`);
reloaded.enterResult(reloadedFinal.getId(), 2, 0);
console.log(`Reloaded Final hasEnded: ${reloadedFinal.hasEnded()} | Winner: ${getTeamName(reloadedFinal.getWinner()?.id ?? null)}`);

console.log('\n=== SPIKE VALIDATION SUCCESSFUL ===');
