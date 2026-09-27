# PROJECT STATE — UMA TOURNAMENT BOT

## Current Phase
Phase 2A E2E VALIDATED WITH LIMITATIONS / Awaiting Phase 2B Planning

## Phase 2A checkpoint
- **Implementation branch:** `feat/phase2a-checkin-bracket` (Merged into `main` via PR #6)
- **Base:** `219ba946b6174301fb08924f0b98cbf34abf2539` (Phase 1 baseline: 78/78 tests, 9 suites)
- **Main Commit Tested:** `67d6a7101cd7feb9d23a6625b0d625603d1ef7ee` (CI Run `36294131097`: `success`)
- **State machine:** `registration_open` → `checkin_open` → `bracket_ready`; `in_progress` is reserved for Phase 2B. Additive database triggers enforce forward-only changes.
- **Check-in:** Captain of approved team only; independent, idempotent row in `team_checkins`.
- **Random seeds:** Cryptographic shuffle, unique persisted seed 1..N for approved + checked-in teams only; no redraw.
- **Bracket:** Generated through `TournamentEngine` and `TournamentOrganizerAdapter`; serialized engine state, application match IDs and BYE paths persisted atomically.
- **15-team verification:** 16 slots, one BYE path, 14 playable match objects, four rounds.
- **Restart persistence:** Reopen test confirms the same seed mapping, engine match IDs, application match IDs, rounds and BYE path.
- **Automated tests:** 95/95 tests across 10 suites (Typecheck PASS, Build PASS, CI PASS).
- **Discord validation:** Completed on dedicated Test Guild (`1435984347814432801`) with verdict `PASS_WITH_LIMITATIONS`. Production UMA Discord remains untouched.

## PR #1–#6
- PR #1 MERGED into `main` with merge commit `30a21aa`.
- PR #2 MERGED into `main` with merge commit `2fe7c3c` (explicit Discord resource IDs).
- PR #3 MERGED into `main` with merge commit `2a81dc6` (historical smoke-test findings).
- PR #4 MERGED into `main` with merge commit `5e47f49` (fixed modal placeholder constraint and Windows direct entry).
- PR #5 MERGED into `main` with merge commit `219ba94` (Phase 1 E2E retest report).
- PR #6 MERGED into `main` with merge commit `67d6a71` (Phase 2A check-in, draw, and bracket).

## Discord E2E Validation (Phase 2A)
- **Status:** PASS_WITH_LIMITATIONS
- **Report:** `docs/PHASE2A_DISCORD_E2E_REPORT.md`
- **Main Commit Tested:** `67d6a7101cd7feb9d23a6625b0d625603d1ef7ee` (CI Run `36294131097`: `success`)
- **Automated Baseline:** 95 / 95 tests passing across 10 suites (Typecheck PASS, Build PASS)
- **Verified Lifecycle Stages:**
  - Phase A: Test-guild slash command deployment (all 9 `/uma` subcommands) — PASS
  - Phase B: Windows native entry point (`node dist/index.js`) — PASS
  - Phase C: `/uma panel` display & embed counts (3/3 active, 3 approved, register button enabled) — PASS
  - Phase D: Staff `/uma checkin-open` transition (`registration_open` → `checkin_open`) — PASS
  - Phase E: Registration lock regression (panel disabled, stale click rejected, domain probe rejected) — PASS
  - Phase F: Captain check-in (`/uma check-in` success & repeated idempotency) — PASS
  - Phase G: Complete test field check-in (`/uma checkins` shows 3/3, `/uma status` shows `checkin_open`) — PASS
  - Phase H: Staff random draw (`/uma draw` generates 3 teams, 2 rounds, 1 BYE; persisted state captured) — PASS
  - Phase I & J: Public `/uma bracket` presentation & privacy invariants (no leaked UIDs or contacts) — PASS
  - Phase K: Idempotency & lifecycle boundary checks (post-draw check-in, redraw, and checkin-open all rejected) — PASS
  - Phase L & M: Real process cold restart & persistence verification (bracket restored without redraw, 100% DB hash match) — PASS
  - Phase N: Safety & production integrity (UMA production guild `1435278955941986540` untouched) — PASS
- **Limitations:**
  1. `AUTHORIZATION_SEPARATION_NOT_MANUALLY_VALIDATED`: Single Discord test account (`𝑷𝒉𝒖𝒄 𝑽𝒐 💙`, Server Owner / Administrator) acted as both captain and BTC staff. Automated authorization separation is comprehensively verified in test suites.
  2. `MULTI_CAPTAIN_DISCORD_CHECKIN_NOT_MANUALLY_VALIDATED`: Only Team A captain was checked in directly via the Discord client; Teams B and C were checked in via canonical domain fallback (`TournamentService.checkIn`) due to having only one physical Discord account for testing.

## Last Safe Checkpoint
Main commit `67d6a71` has successful CI run `36294131097`; Phase 2A Discord E2E is `PASS_WITH_LIMITATIONS`.

## Exact Next Action
Open Draft PR with Phase 2A Discord E2E report. Await human review and Phase 2B planning. Do not start Phase 2B yet.

## Branch
`docs/phase2a-e2e-retest`
