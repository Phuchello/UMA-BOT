# PROJECT STATE — UMA TOURNAMENT BOT

## Current Phase
Phase 1.5 Complete (Hardening & CI Verification) / Ready for Human Review of PR #1

## Phase 0 Result
- **Classification:** `USE_WITH_ADAPTER`
- **Candidate Engine:** `tournament-organizer@4.1.1`
- **Dependency License Audit:** Direct dependency `tournament-pairings@2.0.1` is GPL-3.0-or-later. Full report in `docs/DEPENDENCY_LICENSE_REPORT.md`.
- **Spike Findings:** 15 teams Single Elimination bracket accurately generates 16 slots, 1 BYE routed to Seed #1 (UMA Alpha in R2M1), 14 played matches across 4 rounds.
- **Rollback & Persistence:** Verified via `clearResult` and `getValues()` / `loadTournament()`.
- **Adapter Implemented:** `TournamentEngine` interface and `TournamentOrganizerAdapter` fully tested (8/8 tests passing).

## Phase 1 & 1.5 Result
- **Status:** Complete (43/43 tests passing across 4 suites, 100% pass rate)
- **Database Engine:** Node.js native `node:sqlite` (`DatabaseSync` with WAL mode & foreign keys enabled). Synchronous, zero-C++ compiler dependency.
- **Schema:** Relational schema with tables `tournaments`, `teams`, `players`, `audit_logs` and unique constraints on `(tournament_id, name)`, `(tournament_id, abbreviation)`, and `(tournament_id, game_uid)`. Non-unique index on `(tournament_id, captain_discord_id)`.
- **Tournament Identity Separation:** Decoupled `ACTIVE_TOURNAMENT_ID` from Discord `DISCORD_GUILD_ID`, allowing multiple annual tournaments in one server.
- **Registration Domain:** Validates exactly 5 starters, up to 2 optional substitutes, format `Ingame | UID`, and internal/external duplicate UIDs.
- **Capacity Enforcement:** Atomic transactional enforcement against `max_teams` inside SQLite transactions.
- **Correction Workflow:** Complete lifecycle (`PENDING` -> `NEEDS_CORRECTION` -> `/uma my-team` edit -> `PENDING`) with atomic player row replacement.
- **BTC Review Queue:** Staff review card in `🎛️・ban-tổ-chức` supporting Duyệt (Approve), Yêu cầu sửa (Correction), and Từ chối (Reject with modal reason).
- **Discord Bot Layer:** Slash commands (`/uma panel`, `/uma teams`, `/uma my-team`, `/uma status`), mobile-friendly 5 Action Row registration and edit modals, and team list embeds.
- **CI Setup:** GitHub Actions workflow configured in `.github/workflows/ci.yml`.

## Completed Commits
1. `6be5dac` - `chore: initialize UMA Tournament Bot workspace` (main)
2. `91cdd05` - `test: validate tournament engine for 15-team bracket` (feat/phase0-phase1)
3. `b41cd3f` - `feat: add team registration domain and btc approval workflow` (feat/phase0-phase1)
4. `cb02958` - `fix: separate tournament identity from discord guild` (feat/phase0-phase1)
5. `a3aea09` - `feat: complete registration correction workflow` (feat/phase0-phase1)
6. `3c8eea0` - `fix: enforce tournament capacity atomically` (feat/phase0-phase1)
7. `33d8c99` - `ci: add phase1 verification workflow` (feat/phase0-phase1)
8. `docs: align phase1 claims with implementation` (feat/phase0-phase1)

## Remaining Issues / Risks
- Third-party dependency `tournament-pairings` is GPL-3.0-or-later. It is architecturally decoupled behind `TournamentEngine` to allow future engine replacement if a permissive license is required.

## CI Status
Configured in `.github/workflows/ci.yml` (runs typecheck, vitest, and build on Node 22).

## Last Safe Checkpoint
Phase 1.5 hardening complete; all 43 automated tests passing; zero build/typecheck errors.

## Exact Next Action
Wait for maintainer review of Draft PR #1 before proceeding to Phase 2.

## Branch
`feat/phase0-phase1`
