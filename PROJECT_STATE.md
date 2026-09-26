# PROJECT STATE — UMA TOURNAMENT BOT

## Current Phase
Phase 0 & Phase 1 Complete / Phase 2 Planned (Ready for Human Review & PR)

## Phase 0 Result
- **Classification:** `USE_WITH_ADAPTER`
- **Candidate Engine:** `tournament-organizer@4.1.1`
- **Dependency License Audit:** Direct dependency `tournament-pairings@2.0.1` is GPL-3.0-or-later. Full report in `docs/DEPENDENCY_LICENSE_REPORT.md`.
- **Spike Findings:** 15 teams Single Elimination bracket accurately generates 16 slots, 1 BYE routed to Seed #1 (UMA Alpha in R2M1), 14 played matches across 4 rounds.
- **Rollback & Persistence:** Verified via `clearResult` and `getValues()` / `loadTournament()`.
- **Adapter Implemented:** `TournamentEngine` interface and `TournamentOrganizerAdapter` fully tested (8/8 tests passing).

## Phase 1 Result
- **Status:** Complete (19/19 tests passing, 27/27 total across suites)
- **Database Engine:** Node.js native `node:sqlite` (`DatabaseSync` with WAL mode & foreign keys enabled). Synchronous, zero-C++ compiler dependency.
- **Schema:** Relational schema with tables `tournaments`, `teams`, `players`, `audit_logs` and unique constraints on `(tournament_id, name)`, `(tournament_id, abbreviation)`, `(tournament_id, captain_id)`, and `(tournament_id, game_uid)`.
- **Registration Domain:** Validates exactly 5 starters, up to 2 optional substitutes, format `Ingame | UID`, and internal/external duplicate UIDs.
- **BTC Review Queue:** Staff review card in `🎛️・ban-tổ-chức` supporting Duyệt (Approve), Yêu cầu sửa (Correction), and Từ chối (Reject with modal reason).
- **Concurrency & Idempotency:** State transition lock via atomic transactions, preventing double reviews or conflicting BTC decisions.
- **Discord Bot Layer:** Slash commands (`/uma panel`, `/uma teams`, `/uma status`), mobile-friendly 5 Action Row registration modal, and team list embeds.
- **Documentation:** `docs/ARCHITECTURE.md` and `docs/PHASE1_TEST_REPORT.md` created.

## Completed Commits & Milestones
1. `6be5dac` - `chore: initialize UMA Tournament Bot workspace` (main)
2. `91cdd05` - `test: validate tournament engine for 15-team bracket` (feat/phase0-phase1)
3. Checkpoint pending: `feat: add team registration domain and btc approval workflow` (feat/phase0-phase1)

## In Progress
- Human review of Phase 0 & Phase 1 Draft PR on GitHub.

## Deferred to Phase 2+
- Discord-native check-in command/workflow.
- Live bracket visualizer & match announcements.
- Match private thread generation with referee permissions.
- Screenshot scoring & result verification modal.

## Known Risks & Mitigations
- **GPL Dependency:** `tournament-pairings` is isolated behind `TournamentEngine` interface, ensuring application domain code remains decoupled.
- **Discord Modal Constraints:** Mobile modal 5 Action Row limit satisfied by consolidating player input into multi-line starter & substitute fields.

## Last Safe Checkpoint
Phase 1 implementation complete; all 27 automated tests passing; zero build/typecheck errors.

## Branch
`feat/phase0-phase1`
