# PROJECT STATE — UMA TOURNAMENT BOT

## Current Phase
Phase 0 Complete (Passed Gate: USE_WITH_ADAPTER) / Phase 1 In Progress

## Phase 0 Result
- **Classification:** `USE_WITH_ADAPTER`
- **Candidate Engine:** `tournament-organizer@4.1.1`
- **Dependency License Audit:** Direct dependency `tournament-pairings@2.0.1` is GPL-3.0-or-later. Full report in `docs/DEPENDENCY_LICENSE_REPORT.md`.
- **Spike Findings:** 15 teams Single Elimination bracket accurately generates 16 slots, 1 BYE routed to Seed #1 (UMA Alpha in R2M1), 14 played matches across 4 rounds.
- **Rollback & Persistence:** Verified via `clearResult` and `getValues()` / `loadTournament()`.
- **Adapter Implemented:** `TournamentEngine` interface and `TournamentOrganizerAdapter` fully tested (8/8 tests passing).

## Completed
- Canonical empty GitHub repo `Phuchello/UMA-BOT` bootstrapped with foundational files on `main`.
- Development branch `feat/phase0-phase1` created and tracked on remote.
- Secret safety (.gitignore, .env.example) strictly maintained.
- Node.js native `node:sqlite` selected due to Windows native compiler limitations with better-sqlite3 on Node 24.
- Phase 0 isolated spike and comprehensive Vitest test suite.
- `docs/ENGINE_SPIKE_REPORT.md` and `docs/DEPENDENCY_LICENSE_REPORT.md` generated.
- `TournamentEngine` abstraction and `TournamentOrganizerAdapter` implemented and verified.

## In Progress
- Phase 1: Application Scaffold, Database Schema (Tournament, Team, Player), Registration & BTC Approval workflows.

## Known Risks
- GPL-3.0-or-later in `tournament-pairings` necessitates maintaining strict adapter isolation via `TournamentEngine` to preserve licensing flexibility.
- Modal interactions on Discord mobile must be intuitive for collecting 5 player UIDs + substitutes.

## Last Safe Checkpoint
Phase 0 Engine Validation & Adapter complete (Commit `test: validate tournament engine for 15-team bracket`).

## Exact Next Action
Implement Phase 1 normalized database schema, domain models, Discord bot client, and registration panel.

## Branch
feat/phase0-phase1

## Last Commit
test: validate tournament engine for 15-team bracket
