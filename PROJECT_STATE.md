# PROJECT STATE — UMA TOURNAMENT BOT

## Current Phase
Phase 3A IMPLEMENTED / Awaiting Automated Review & Discord E2E

## Phase 3A checkpoint
- **Branch:** `feat/phase3a-results-advancement`
- **Base:** `74820a3a691aca3184bfe671b91c9bd5475faf3b` (116/116 tests, 11 suites; main CI `36303976002` success)
- **Result states:** `PENDING → CONFIRMED → APPROVED`, `PENDING → DISPUTED → APPROVED`, or open → `REJECTED`; match `LIVE → COMPLETED`; tournament `in_progress → completed`.
- **Evidence:** Discord attachment images are reuploaded into the private match room; archived message and attachment metadata survive restart. Source URLs are not persisted.
- **BO3:** Only 2–0, 2–1, 0–2 and 1–2 are accepted, mapped from captain-relative input to engine team order.
- **Authority and engine:** Only assigned referee/staff approval restores the application-owned engine, reports the result and atomically persists canonical result, engine state and one bracket-version increment.
- **Progression:** Real three-team BYE and four-team semifinal tests preserve downstream application/engine match IDs and advance winners into `WAITING → READY`.
- **Champion:** Final engine completion persists the champion, runner-up and final match in `tournament_outcomes` and closes the tournament.
- **Automated tests:** 149/149 across 12 suites locally (116 previous + 33 Phase 3A); typecheck and build pass. Draft PR CI pending.
- **Discord validation:** No Phase 3A live Discord connection yet. Production guild remains untouched.

## Phase 2B checkpoint
- **Branch:** `feat/phase2b-match-lifecycle` (Merged into `main` via PR #8)
- **Base:** `4abc080c70fc40bbcd7074a30312c9132cd09d33` (95/95 tests, 10 suites)
- **Main Commit Tested:** `fadf1337c6749f6427802650e3ba7c93d0896518` (CI Run `36301923673`: `success`)
- **Tournament transition:** Staff `/uma start` changes `bracket_ready → in_progress` once, using the persisted Phase 2A bracket.
- **Match states:** `WAITING → READY → ROOM_OPEN → SCHEDULED → READY_TO_START → LIVE` with forward-only SQLite guards.
- **MATCH_HUB config:** Explicit validated snowflake outside tests; test-only synthetic default. Private rooms are scoped to the configured guild.
- **Rooms and referees:** Per-match referee user assignments and one persisted private thread/message identity per playable match. Future rounds and BYEs receive no rooms.
- **Schedule and readiness:** Strict `YYYY-MM-DD HH:mm` in `Asia/Ho_Chi_Minh`, stored as epoch milliseconds; both captains confirm before a referee or staff starts LIVE.
- **Restart:** Automated reopen preserves match, engine, room and message IDs, referee assignment, schedule, readiness and LIVE state without creating another room.
- **Automated tests:** 116/116 tests across 11 suites (Typecheck PASS, Build PASS, CI PASS).
- **Discord validation:** Completed on dedicated Test Guild (`1435984347814432801`) with verdict `PASS_WITH_LIMITATIONS`. Production UMA Discord remains untouched.

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

## PR #1–#9
- PR #1 MERGED into `main` with merge commit `30a21aa`.
- PR #2 MERGED into `main` with merge commit `2fe7c3c` (explicit Discord resource IDs).
- PR #3 MERGED into `main` with merge commit `2a81dc6` (historical smoke-test findings).
- PR #4 MERGED into `main` with merge commit `5e47f49` (fixed modal placeholder constraint and Windows direct entry).
- PR #5 MERGED into `main` with merge commit `219ba94` (Phase 1 E2E retest report).
- PR #6 MERGED into `main` with merge commit `67d6a71` (Phase 2A check-in, draw, and bracket).
- PR #7 MERGED into `main` with merge commit `4abc080` (Phase 2A Discord E2E report).
- PR #8 MERGED into `main` with merge commit `fadf133` (Phase 2B match rooms and lifecycle).
- PR #9 MERGED into `main` with merge commit `74820a3` (Phase 2B Discord E2E report).

## Discord E2E Validation (Phase 2B)
- **Status:** PASS_WITH_LIMITATIONS
- **Report:** `docs/PHASE2B_DISCORD_E2E_REPORT.md`
- **Main Commit Tested:** `fadf1337c6749f6427802650e3ba7c93d0896518` (CI Run `36301923673`: `success`)
- **Automated Baseline:** 116 / 116 tests passing across 11 suites (Typecheck PASS, Build PASS)
- **Verified Lifecycle Stages:**
  - Phase A: Guild slash command deployment (all 14 `/uma` subcommands registered) — PASS
  - Phase B: Windows native entry point (`node dist/index.js`) — PASS
  - Phase C: Pre-start match view (`/uma matches` shows `R1-M1 READY`, `/uma status` shows `bracket_ready`) — PASS
  - Phase D: Start tournament (`/uma start` transitions `bracket_ready` → `in_progress`, rejection on retry) — PASS
  - Phase E: Referee assignment (`/uma match-referee` sets referee, idempotent retry) — PASS
  - Phase F: Private match room creation (`/uma rooms-create` creates PrivateThread, starter card posted, buttons disabled) — PASS
  - Phase G: Room idempotency (re-run `rooms-create` returns `created = 0, existing = 1`, zero duplicate rooms/messages) — PASS
  - Phase H: Referee retry post-room (`/uma match-referee` retry leaves single DB row, refreshes gateway) — PASS
  - Phase I: Match scheduling (`/uma match-schedule` sets future time, ready button enabled, start button disabled) — PASS
  - Phase J: Match rescheduling (second future time accepted, schedule row updated, starter card reflects change) — PASS
  - Phase K: Real Discord Captain A readiness (clicked `✅ Sẵn sàng`, card updated, repeated click idempotent) — PASS
  - Phase L: Captain B readiness (domain fallback confirmed Captain B, state `READY_TO_START`, start button enabled) — PASS
  - Phase M: Start match (clicked `▶️ Bắt đầu trận`, state `LIVE`, all buttons removed, `match_starts` recorded) — PASS
  - Phase N: Hard Phase 3 boundary (zero scoring/screenshot/advancement controls, engine hash untouched) — PASS
  - Phase O: Public match UX (`/uma matches` shows LIVE timestamp, `/uma status` shows `LIVE: 1`, zero leaked private data) — PASS
  - Phase P: Capture pre-restart state (all 13 fields and engine hash recorded) — PASS
  - Phase Q: Real cold process restart (clean process exit and restart via `node dist/index.js`) — PASS
  - Phase R: Post-restart exact persistence (all 13 fields exact 100% match, no rooms recreated) — PASS
  - Phase S: Private thread integrity (verified thread is PrivateThread under MATCH_HUB, starter message intact, 1 active thread) — PASS
  - Phase T: Production integrity (UMA production guild `1435278955941986540` strictly untouched) — PASS
- **Limitations:**
  1. `AUTHORIZATION_SEPARATION_NOT_MANUALLY_VALIDATED`: Single Discord test account (`𝑷𝒉𝒖𝒄 𝑽𝒐 💙`, Server Owner / Administrator) simultaneously acted as Captain A, Staff administrator, and assigned Referee. Automated authorization separation is comprehensively verified in test suites.
  2. `SECOND_CAPTAIN_READY_NOT_MANUALLY_VALIDATED`: Captain B was assigned to the bot member identity (`1553604832516898826`); readiness was confirmed via canonical domain fallback (`MatchService.confirmReady`) rather than physical Discord UI button interaction.

## Last Safe Checkpoint
Main commit `74820a3` has successful CI run `36303976002`; Phase 2B Discord E2E is `PASS_WITH_LIMITATIONS`.

## Exact Next Action
Review the Phase 3A Draft PR and CI. After merge, run a separate Phase 3A Discord E2E. Do not start Phase 3B.

## Branch
`feat/phase3a-results-advancement`
