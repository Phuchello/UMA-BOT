# PROJECT STATE — UMA TOURNAMENT BOT

## Current Phase
Phase 1.6.1 Complete / Awaiting Human Merge Decision

## Phase 0 Result
- **Classification:** `USE_WITH_ADAPTER`
- **Candidate Engine:** `tournament-organizer@4.1.1`
- **Dependency License Audit:** Direct dependency `tournament-pairings@2.0.1` is GPL-3.0-or-later. Full report in `docs/DEPENDENCY_LICENSE_REPORT.md`.
- **Spike Findings:** 15 teams Single Elimination bracket accurately generates 16 slots, 1 BYE routed to Seed #1 (UMA Alpha in R2M1), 14 played matches across 4 rounds.
- **Rollback & Persistence:** Verified via `clearResult` and `getValues()` / `loadTournament()`.
- **Adapter Implemented:** `TournamentEngine` interface and `TournamentOrganizerAdapter` fully tested (8/8 tests passing).

## Phase 1, 1.5, 1.6 & 1.6.1 Result
- **Status:** Complete (58/58 tests passing across 6 suites, 100% pass rate)
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

## Completed Commits (feat/phase0-phase1)
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

## Remaining Issues / Risks
- Third-party dependency `tournament-pairings` is GPL-3.0-or-later. It is architecturally decoupled behind `TournamentEngine` to allow future engine replacement if a permissive license is required.
- Local dev databases created before Phase 1.6 must be deleted (old UNIQUE indexes are incompatible with new schema intent).

## CI Status
GREEN. GitHub Actions run `36287888779` for Phase 1.6 commit `3107dc6` completed with conclusion `success`. For Phase 1.6.1 commit `206cc3c`, push run `36288284611` and PR run `36288286859` both completed with conclusion `success`. Workflow in `.github/workflows/ci.yml` runs typecheck, vitest, and build on Node 22.

## Last Safe Checkpoint
Phase 1.6.1 runtime capacity patch pushed as `206cc3c`; all 58 automated tests passing; zero build/typecheck errors; push and PR CI green. PR #1 remains Draft with human review and Ready for Review unchecked.

## Exact Next Action
Human review of Draft PR #1. If accepted, the maintainer marks it Ready for Review and merges manually. Then begin Phase 2 from updated `main`.

## Branch
`feat/phase0-phase1`
