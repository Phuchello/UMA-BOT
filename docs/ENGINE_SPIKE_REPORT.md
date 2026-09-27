# ENGINE SPIKE REPORT — UMA TOURNAMENT BOT

## 1. Overview & Objective

This report details the technical spike and validation of candidate tournament engines for the **UMA Tournament Bot**, specifically evaluating `tournament-organizer` version `4.1.1` for a **15-team Single Elimination** tournament format with exactly 5 starters per team.

---

## 2. Tested Topology (15 Teams Single Elimination)

### 2.1. Expected vs Actual Bracket Mathematics

| Metric | Theoretical Expectation | `tournament-organizer` Actual Behavior | Verification |
| :--- | :--- | :--- | :---: |
| **Team Count** | 15 teams | 15 teams | PASS |
| **Bracket Size** | 16 slots ($2^4$) | 16 slots ($2^4$) | PASS |
| **BYE Count** | 1 BYE | 1 BYE assigned to Seed #1 (UMA Alpha) | PASS |
| **Total Matches** | 14 matches | 14 matches (7 R1 + 4 R2 + 2 R3 + 1 R4) | PASS |
| **Rounds** | 4 rounds | 4 rounds (R1, QF, SF, Final) | PASS |

### 2.2. Seeding & Matchup Distribution

When seeded deterministically with seeds 1 to 15:
- **Seed #1 (`UMA Alpha`):** Automatically granted the BYE and advanced directly to **Round 2 Match #1**, awaiting the winner of Round 1 Match #1.
- **Round 1 Matchups (7 matches):**
  - Match #1: Seed 8 (`UMA Hydra`) vs Seed 9 (`UMA Nova`)
  - Match #2: Seed 4 (`UMA Delta`) vs Seed 13 (`UMA Titan`)
  - Match #3: Seed 5 (`UMA Echo`) vs Seed 12 (`UMA Sigma`)
  - Match #4: Seed 2 (`UMA Bravo`) vs Seed 15 (`UMA Wolves`)
  - Match #5: Seed 7 (`UMA Gamma`) vs Seed 10 (`UMA Phoenix`)
  - Match #6: Seed 3 (`UMA Charlie`) vs Seed 14 (`UMA Vortex`)
  - Match #7: Seed 6 (`UMA Foxtrot`) vs Seed 11 (`UMA Raven`)

---

## 3. Engine Test Matrix Results

### 3.1. Progression
- Winners reported via `enterResult(matchId, p1Wins, p2Wins)` automatically advance to their predetermined downstream match slots in Round 2, Round 3, and Round 4.
- Active state transitions cleanly from `stage-one` to complete when the final match is scored.

### 3.2. Result Rollback & Correction
- `clearResult(matchId)` resets the match status (`hasEnded: false`, `active: true`, scores reset to 0-0).
- Crucially, it reverses the player's advancement in the downstream bracket, setting the downstream slot back to `null`.
- Vitest suite verifies that dependent downstream matches are correctly vacated upon rollback.

### 3.3. State Persistence & Restoration
- `tourney.getValues()` exports a clean serializable JSON object containing all tournament configuration, players, matches, and results.
- `manager.loadTournament(exported)` successfully reconstructs the exact tournament state across runtime instances with 100% data fidelity, allowing continued match reporting.

---

## 4. Architectural Gate Verdict

### Classification: `USE_WITH_ADAPTER`

**Rationale:**
1. **Algorithmic Accuracy:** The library handles elimination trees, power-of-two slot expansion, and BYE routing cleanly without requiring a homemade bracket implementation.
2. **License Isolation:** Because `tournament-pairings` is licensed under `GPL-3.0-or-later`, the library must never be imported directly into the application domain.
3. **Domain Decoupling:** `TournamentOrganizerAdapter` implements the application's clean `TournamentEngine` interface, mapping internal player structures to UMA `EngineMatch` and `EngineBracket` types with fast O(1) team name lookups.

All Phase 0 tests pass cleanly in automated test runs (`8 passed`).
