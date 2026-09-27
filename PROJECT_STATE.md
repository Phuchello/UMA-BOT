# PROJECT STATE — UMA TOURNAMENT BOT

## Current Phase
Phase 2B IMPLEMENTED / Awaiting Automated Review & Discord E2E

## Phase 2B checkpoint
- **Branch:** `feat/phase2b-match-lifecycle`
- **Base:** `4abc080c70fc40bbcd7074a30312c9132cd09d33` (95/95 tests, 10 suites)
- **Tournament transition:** Staff `/uma start` changes `bracket_ready → in_progress` once, using the persisted Phase 2A bracket.
- **Match states:** `WAITING → READY → ROOM_OPEN → SCHEDULED → READY_TO_START → LIVE` with forward-only SQLite guards.
- **MATCH_HUB config:** Explicit validated snowflake outside tests; test-only synthetic default. Private rooms are scoped to the configured guild.
- **Rooms and referees:** Per-match referee user assignments and one persisted private thread/message identity per playable match. Future rounds and BYEs receive no rooms.
- **Schedule and readiness:** Strict `YYYY-MM-DD HH:mm` in `Asia/Ho_Chi_Minh`, stored as epoch milliseconds; both captains confirm before a referee or staff starts LIVE.
- **Restart:** Automated reopen preserves match, engine, room and message IDs, referee assignment, schedule, readiness and LIVE state without creating another room.
- **Automated tests:** 116/116 tests across 11 suites locally (95 previous + 21 Phase 2B/config); typecheck and build pass. CI pending Draft PR.
- **Discord validation:** No Phase 2B live connection yet. Production UMA Discord remains untouched.

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

## PR #1–#7
- PR #1 MERGED into `main` with merge commit `30a21aa`.
- PR #2 MERGED into `main` with merge commit `2fe7c3c` (explicit Discord resource IDs).
- PR #3 MERGED into `main` with merge commit `2a81dc6` (historical smoke-test findings).
- PR #4 MERGED into `main` with merge commit `5e47f49` (fixed modal placeholder constraint and Windows direct entry).
- PR #5 MERGED into `main` with merge commit `219ba94` (Phase 1 E2E retest report).
- PR #6 MERGED into `main` with merge commit `67d6a71` (Phase 2A check-in, draw, and bracket).
- PR #7 MERGED into `main` with merge commit `4abc080` (Phase 2A Discord E2E report).

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
Main commit `4abc080` has successful CI run `36295522256`; Phase 2A Discord E2E is `PASS_WITH_LIMITATIONS`.

## Exact Next Action
Review the Phase 2B Draft PR and CI. After merge, perform a separate Phase 2B Discord E2E test. Do not start Phase 3.

## Branch
`feat/phase2b-match-lifecycle`
