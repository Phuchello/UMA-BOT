# PROJECT STATE — UMA TOURNAMENT BOT

## Current Phase
Phase 1 COMPLETE / Awaiting Discord E2E Smoke Test

## PR #1
MERGED into `main` with merge commit `30a21aa` (merge commit strategy). No Discord deployment or smoke test has been performed.

## Phase 0 Result
- **Classification:** `USE_WITH_ADAPTER`
- **Candidate Engine:** `tournament-organizer@4.1.1`
- **Dependency License Audit:** Direct dependency `tournament-pairings@2.0.1` is GPL-3.0-or-later. Full report in `docs/DEPENDENCY_LICENSE_REPORT.md`.
- **Spike Findings:** 15 teams Single Elimination bracket accurately generates 16 slots, 1 BYE routed to Seed #1 (UMA Alpha in R2M1), 14 played matches across 4 rounds.
- **Rollback & Persistence:** Verified via `clearResult` and `getValues()` / `loadTournament()`.
- **Adapter Implemented:** `TournamentEngine` interface and `TournamentOrganizerAdapter` fully tested (8/8 tests passing).

## Phase 1, 1.5, 1.6 & 1.6.1 Result
- **Status:** Complete (58/58 tests passing across 6 suites, 100% pass rate)
- **Technical gate:** Registration domain, BTC review, correction lifecycle, persisted tournament capacity, and validated engine adapter are complete. Typecheck and build pass on merged `main`.
- **Database Engine:** Node.js native `node:sqlite` (`DatabaseSync` with WAL mode & foreign keys enabled). Synchronous, zero-C++ compiler dependency.
- **Schema (Phase 1.6):** Non-unique indexes only. Active-only uniqueness (PENDING/APPROVED/NEEDS_CORRECTION) enforced transactionally inside `BEGIN IMMEDIATE TRANSACTION`. REJECTED/WITHDRAWN rows free their identifier slots.
- **Tournament Identity Separation:** Decoupled `ACTIVE_TOURNAMENT_ID` from Discord `DISCORD_GUILD_ID`.
- **MAX_TEAMS Source of Truth:** `config.MAX_TEAMS` is bootstrap input only. `ensureTournament(id, name, maxTeams)` creates a tournament if absent; it preserves the database name and capacity if present. Once created, `tournaments.max_teams` drives runtime panel, status, button guard, and transactional registration capacity. `registerTeam()` requires a pre-existing tournament (returns `TOURNAMENT_NOT_FOUND` otherwise). No startup sync changes a live tournament. Capacity changes require a future explicit Staff operation.
- **Registration Panel UX:** Full breakdown (active / approved / pending / remaining) instead of approved-only count.
- **Correction Workflow:** Complete lifecycle (`PENDING` → `NEEDS_CORRECTION` → `/uma my-team` edit → `PENDING`) with atomic player row replacement.
- **BTC Review Queue:** Staff review card with Duyệt / Yêu cầu sửa / Từ chối actions.
- **Discord Bot Layer:** `/uma panel`, `/uma teams`, `/uma my-team`, `/uma status` + mobile-friendly 5 Action Row modals.
- **CI Setup:** GitHub Actions workflow in `.github/workflows/ci.yml`.
- **Single-Instance Assumption:** Documented in `docs/ARCHITECTURE.md` Section 6.

## Completed Commits (feat/phase0-phase1 → main)
1. `6be5dac` — `chore: initialize UMA Tournament Bot workspace` (main)
2. `91cdd05` — `test: validate tournament engine for 15-team bracket`
3. `b41cd3f` — `feat: add team registration domain and btc approval workflow`
4. `cb02958` — `fix: separate tournament identity from discord guild`
5. `a3aea09` — `feat: complete registration correction workflow`
6. `3c8eea0` — `fix: enforce tournament capacity atomically`
7. `33d8c99` — `ci: add phase1 verification workflow`
8. `454272f` — `docs: align phase1 claims with implementation`
9. `3107dc6` — `fix: active-only uniqueness, max-teams bootstrap, panel ux, phase 1.6 tests`
10. `206cc3c` — `fix: use persisted tournament capacity as runtime source of truth`
11. `3626a16` — `docs: finalize phase1 checkpoint metadata`
12. `30a21aa` — merge PR #1 into `main`

## Remaining Issues / Risks
- Third-party dependency `tournament-pairings` is GPL-3.0-or-later. It is architecturally decoupled behind `TournamentEngine` to allow future engine replacement if a permissive license is required.
- Local dev databases created before Phase 1.6 must be deleted (old UNIQUE indexes are incompatible with new schema intent).

## CI Status
GREEN. GitHub Actions main-branch run `36289338024` for merge commit `30a21aa` completed with conclusion `success`. On merged `main`, `npm ci`, typecheck, all 58 tests across 6 suites, and build also passed locally. Workflow in `.github/workflows/ci.yml` runs typecheck, vitest, and build on Node 22.

## Last Safe Checkpoint
PR #1 merged into `main` as `30a21aa`. Phase 1 technical verification is green locally and in GitHub Actions. Discord E2E smoke test remains unexecuted; plan is in `docs/PHASE1_DISCORD_SMOKE_TEST_PLAN.md`.

## Exact Next Action
Run the controlled Phase 1 Discord smoke test only after separate human approval. Do not start Phase 2 or deploy to the production UMA Discord server.

## Branch
`main`
