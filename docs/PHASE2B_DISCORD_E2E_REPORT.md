# PHASE 2B DISCORD E2E VALIDATION REPORT

**Date/Time:** 2026-09-27T14:30:00+07:00  
**Main Commit Tested:** `fadf1337c6749f6427802650e3ba7c93d0896518`  
**Main CI Run:** Run ID `36301923673` (Conclusion: `success`)  
**Automated Baseline:** 116 / 116 tests passing across 11 test suites (Typecheck PASS, Build PASS)  
**Branch:** `docs/phase2b-e2e-retest`  
**Final Verdict:** **`PASS_WITH_LIMITATIONS`**

---

## 1. Safety & Production Guild Exclusion Confirmation

| Check | Expected | Actual | Status |
| :--- | :--- | :--- | :--- |
| **Production Guild Exclusion** | ID `1435278955941986540` strictly excluded | Zero network calls or interactions to production guild | **CONFIRMED SAFE** |
| **Test Guild Verification** | Dedicated Test Guild | ID `1435984347814432801` ("test") | **CONFIRMED TEST GUILD** |
| **Test Bot Application** | Dedicated Test Bot | ID `1553604832516898826` ("UMA Smoke Test Bot") | **CONFIRMED TEST BOT** |
| **Match Hub Channel** | Belong to test guild | `1553664980086161518` (`#🧪・phase2b-match-hub`) | **CONFIRMED TEST HUB** |
| **Tournament Identity** | `uma-phase2b-e2e-2026` | `uma-phase2b-e2e-2026` (`max_teams = 2`) | **ISOLATED TOURNAMENT** |
| **Fresh Database Path** | `data/phase2b-e2e.sqlite` | Initialized fresh from schema, no dirty state | **CONFIRMED FRESH DB** |
| **Staff Channel** | Belong to test guild | `1435984350243061794` (`#🎓・staff-chat`) | **CONFIRMED TEST CHANNEL** |
| **Commands Channel** | Belong to test guild | `1435984350020898892` (`#🤖・commands`) | **CONFIRMED TEST CHANNEL** |
| **Staff Roles** | Belong to test guild | `1435984348192051265, 1435984348192051264` | **CONFIRMED TEST ROLES** |

---

## 2. Controlled Identity & Fixture Strategy

### Controlled Discord Identities
- **Captain A:** `994820818993418240` (Real human test account: `𝑷𝒉𝒖𝒄 𝑽𝒐 💙`, Server Owner / Administrator).
- **Captain B:** `1553604832516898826` (The UMA Smoke Test Bot app user, confirmed through a disposable private-thread membership probe to participate cleanly in the Discord thread gateway without error).
- **Referee:** `994820818993418240` (Server Owner / Administrator, noting limitation `AUTHORIZATION_SEPARATION_NOT_MANUALLY_VALIDATED`).

### Canonical Fixture
The fixture was generated entirely through canonical domain repositories and services (`TeamRepository`, `TournamentRepository`, `TournamentService`) rather than raw SQL mutations:
1. `ensureTournament('uma-phase2b-e2e-2026', 'UMA Phase 2B E2E 2026', 2)`
2. `registerTeam(Team A)` & `registerTeam(Team B)` with 5 synthetic starters and fake UIDs (`P2B_ALPHA_001..005`, `P2B_BRAVO_001..005`).
3. `approveTeam(Team A)` & `approveTeam(Team B)`.
4. `openCheckin(...)`.
5. `checkIn(Team A)` & `checkIn(Team B)`.
6. `draw(...)` producing single-elimination bracket with 0 BYEs.

| Entity | ID | Name / Details |
| :--- | :--- | :--- |
| **Team A** | `team_a4244070-0d7c-443f-8935-2aeeaa631dbe` | `UMA Alpha Match Test` [ALP], Captain: `994820818993418240` (Seed 2) |
| **Team B** | `team_a109d81d-b0f3-4734-ad21-d19f0f534f51` | `UMA Bravo Match Test` [BRV], Captain: `1553604832516898826` (Seed 1) |
| **Application Match ID** | `match_6bf9cd85-96ee-4954-b828-0dc756123cf3` | Round 1, Match 1 (Bravo vs Alpha) |
| **Engine Match ID** | `63f71e20-20e9-41b1-91f8-9e22bddf563e` | Canonical adapter UUID |
| **Bracket Engine Hash** | `679482623069dd5dad0ef340013234e3199a3b0736b73076b72ad186cbe42c16` | SHA-256 of serialized engine state |

---

## 3. Phase A–T Lifecycle Validation Results

| Phase | Description | Observed Result | Verdict |
| :--- | :--- | :--- | :--- |
| **Phase A** | Guild Command Deployment | `/uma` registered with all 14 subcommands: `panel`, `teams`, `my-team`, `status`, `checkin-open`, `check-in`, `checkins`, `draw`, `bracket`, `start`, `match-referee`, `rooms-create`, `match-schedule`, `matches`. | **PASS** |
| **Phase B** | Real Windows Startup | Launched via `node dist/index.js`. Startup logged `Restored 1 bracket matches without redraw.` Connected as `UMA Smoke Test Bot#7415`. No rooms/messages created automatically. | **PASS** |
| **Phase C** | Pre-Start Match View | `/uma matches` showed `R1-M1 — UMA Bravo Match Test vs UMA Alpha Match Test` (`Sẵn sàng mở phòng`). `/uma status` showed `Giai đoạn: Đã bốc thăm nhánh đấu`, `READY = 1`. | **PASS** |
| **Phase D** | Start Tournament | Staff executed `/uma start`. Tournament transitioned `bracket_ready` → `in_progress`. Response reported 1 READY match, 0 WAITING. Repeated `/uma start` rejected with `⚠️ Chỉ có thể bắt đầu giải khi nhánh đấu đã sẵn sàng.` DB IDs and hash unchanged. | **PASS** |
| **Phase E** | Referee Assignment | Staff executed `/uma match-referee round:1 match:1 referee:@𝑷𝒉𝒖𝒄 𝑽𝒐 💙`. Assigned referee `994820818993418240`. `match_referee_assignments` recorded exactly 1 row. Re-running returned idempotent `ℹ️ Trọng tài đã được gán cho R1-M1 trước đó.` | **PASS** |
| **Phase F** | Private Match Room Creation | Executed `/uma rooms-create`. Result: `Phòng mới: 1 • Đã có: 0`. Exactly one PrivateThread `r1-m1-uma-bravo-match-test-vs-uma-alpha-match-test` created under `#🧪・phase2b-match-hub`. Starter card posted with buttons `[✅ Sẵn sàng]` (disabled) and `[▶️ Bắt đầu trận]` (disabled). Thread ID: `1553666996053213304`, Message ID: `1553667001900073021`. State: `ROOM_OPEN`. | **PASS** |
| **Phase G** | Room Idempotency | Re-executed `/uma rooms-create`. Result: `Phòng mới: 0 • Đã có: 1`. Zero duplicate threads or starter messages. Thread ID and Starter Message ID in DB strictly unchanged. | **PASS** |
| **Phase H** | Referee Retry Post-Room | Re-executed `/uma match-referee round:1 match:1 referee:@𝑷𝒉𝒖𝒄 𝑽𝒐 💙`. Returned `Trọng tài đã được gán cho R1-M1 trước đó.` `match_referee_assignments` count = 1, `match_rooms` count = 1. | **PASS** |
| **Phase I** | Match Schedule | Executed `/uma match-schedule round:1 match:1 time:2026-09-27 16:20`. State transitioned `ROOM_OPEN` → `SCHEDULED`. Discord reply showed formatted timestamps `<t:...:F>` and `<t:...:R>`. Starter card updated. Ready button became enabled; Start button remained disabled. `SCHEDULED_AT_1 = 1790500800000`. | **PASS** |
| **Phase J** | Match Reschedule | Executed `/uma match-schedule round:1 match:1 time:2026-09-27 17:22`. State remained `SCHEDULED`. `SCHEDULED_AT_2 = 1790504520000` (`!= SCHEDULED_AT_1`). Starter card updated schedule text. Exactly 1 schedule row in DB. | **PASS** |
| **Phase K** | Captain A Ready (Discord UI) | Captain A (`𝑷𝒉𝒖𝒄 𝑽𝒐 💙`) clicked `✅ Sẵn sàng` in match thread. Ephemeral confirmation received: `✅ Đội của bạn đã xác nhận sẵn sàng.` Starter card updated: Team Alpha = `Sẵn sàng`, Team Bravo = `Chưa xác nhận`. Repeated click returned idempotent `ℹ️ Đội của bạn đã xác nhận sẵn sàng trước đó.` Exactly 1 confirmation row in `match_ready_confirmations`. | **PASS** |
| **Phase L** | Captain B Ready | Executed canonical domain fallback (`MatchService.confirmReady`) for Captain B (`1553604832516898826`). State transitioned `SCHEDULED` → `READY_TO_START`. Restarted bot. Re-ran `/uma match-referee` to trigger gateway card refresh. Starter card updated to `Hai đội đã sẵn sàng`. Ready button disabled; `[▶️ Bắt đầu trận]` button became ENABLED. | **PASS** (with limitation) |
| **Phase M** | Start Match | Clicked `▶️ Bắt đầu trận` in match thread. State transitioned `READY_TO_START` → `LIVE`. Ephemeral confirmation: `Trận đấu đã bắt đầu. Báo kết quả sẽ được mở ở Phase 3.` Starter card updated: `🔴 TRẬN ĐẤU ĐANG DIỄN RA`. All buttons removed (0 buttons). `match_starts` recorded 1 row: `started_at = 1790493953335`, `started_by = 994820818993418240`. | **PASS** |
| **Phase N** | Phase 3 Hard Boundary | Inspected LIVE room: zero controls for scores, winner selection, screenshots, or result reporting. Footer states `Báo kết quả sẽ được mở ở Phase 3.` Engine hash `679482623069dd5dad0ef340013234e3199a3b0736b73076b72ad186cbe42c16` strictly unchanged. | **PASS** |
| **Phase O** | Public Match UX | `/uma matches` in `#🤖・commands` displayed `R1-M1 — UMA Bravo Match Test vs UMA Alpha Match Test` `🔴 TRẬN ĐẤU ĐANG DIỄN RA • lúc 17:22...`. `/uma status` displayed `Giai đoạn: Đang thi đấu`, `LIVE: 1`, other operational states 0. Privacy preserved: no private thread link, no player UIDs, phone numbers, contacts, or DB UUIDs. | **PASS** |
| **Phase P** | Capture Pre-Restart State | Captured all 13 operational fields and hashes from `data/phase2b-e2e.sqlite`. | **PASS** |
| **Phase Q** | Cold Process Restart | Bot daemon gracefully killed. Restarted from cold boot via `node dist/index.js`. Startup logged `Restored 1 bracket matches without redraw.` Connected as `UMA Smoke Test Bot#7415`. No rooms recreated, no duplicate messages sent. | **PASS** |
| **Phase R** | Post-Restart Exact Persistence | Captured post-restart state from DB. All 13 fields matched pre-restart state with 100% exact equality. Re-executed `/uma rooms-create`: returned `Phòng mới: 0 • Đã có: 1`. Re-executed `/uma matches` and `/uma status`: `LIVE` state remained visible and accurate. | **PASS** |
| **Phase S** | Private Thread Integrity | Discord API verified thread `1553666996053213304` is a `PrivateThread` under parent `1553664980086161518`. Starter message `1553667001900073021` exists and is intact. Exactly 1 active thread exists in the match hub. | **PASS** |
| **Phase T** | Production Guild Integrity | Verified UMA Production Guild `1435278955941986540` was 100% untouched. Zero calls, zero messages, zero commands deployed, zero configuration modified. | **PASS** |

---

## 4. Pre/Post Cold Restart Exact State Comparison

| Field | Pre-Restart Value | Post-Restart Value | Comparison |
| :--- | :--- | :--- | :--- |
| `TOURNAMENT_STATUS` | `in_progress` | `in_progress` | **EXACT MATCH** |
| `MATCH_STATUS` | `LIVE` | `LIVE` | **EXACT MATCH** |
| `APP_MATCH_ID` | `match_6bf9cd85-96ee-4954-b828-0dc756123cf3` | `match_6bf9cd85-96ee-4954-b828-0dc756123cf3` | **EXACT MATCH** |
| `ENGINE_MATCH_ID` | `63f71e20-20e9-41b1-91f8-9e22bddf563e` | `63f71e20-20e9-41b1-91f8-9e22bddf563e` | **EXACT MATCH** |
| `THREAD_ID` | `1553666996053213304` | `1553666996053213304` | **EXACT MATCH** |
| `STARTER_MESSAGE_ID` | `1553667001900073021` | `1553667001900073021` | **EXACT MATCH** |
| `REFEREE_ASSIGNMENTS` | `[{ match_id: '...', referee_id: '994820818993418240' }]` | `[{ match_id: '...', referee_id: '994820818993418240' }]` | **EXACT MATCH** |
| `SCHEDULED_AT` | `1790504520000` | `1790504520000` | **EXACT MATCH** |
| `READY_CONFIRMATIONS` | 2 records (`team_a4244...` & `team_a109...`) | 2 records (`team_a4244...` & `team_a109...`) | **EXACT MATCH** |
| `STARTED_AT` | `1790493953335` | `1790493953335` | **EXACT MATCH** |
| `STARTED_BY` | `994820818993418240` | `994820818993418240` | **EXACT MATCH** |
| `BRACKET_ENGINE_STATE_HASH` | `679482623069dd5dad0ef340013234e3199a3b0736b73076b72ad186cbe42c16` | `679482623069dd5dad0ef340013234e3199a3b0736b73076b72ad186cbe42c16` | **EXACT MATCH** |
| `MATCH_ROOM_ROW_COUNT` | `1` | `1` | **EXACT MATCH** |

---

## 5. Discovered Limitations

1. **`AUTHORIZATION_SEPARATION_NOT_MANUALLY_VALIDATED`**:  
   Only one physical test Discord user account was available (`𝑷𝒉𝒖𝒄 𝑽𝒐 💙`, Server Owner / Administrator), which simultaneously served as Captain A, Staff administrator, and assigned Referee. Automated authorization separation (e.g., non-referee/non-staff attempting to start, non-captain attempting to ready, non-staff attempting to schedule or assign referees) is comprehensively verified in automated test suites (`tests/phase2b_match_lifecycle.test.ts`).

2. **`SECOND_CAPTAIN_READY_NOT_MANUALLY_VALIDATED`**:  
   Because Captain B was assigned to the bot member identity (`1553604832516898826`), its readiness confirmation was invoked via the canonical domain fallback method (`MatchService.confirmReady`) rather than physical Discord UI button interaction. Real Discord UI button readiness was fully validated for Captain A, and the resulting multi-captain `READY_TO_START` card refresh and button enablement were verified directly in the Discord client.

---

## 6. Newly Discovered Defects

**NONE.** All Phase 2B components (tournament start, referee assignment, private match room creation, idempotency guards, scheduling, rescheduling, readiness confirmation, match start to LIVE, post-restart persistence, and public views) operated as specified with zero errors or data corruptions.

---

## 7. Cleanup & Evidence State

- Bot daemon stopped gracefully.
- Test evidence database `data/phase2b-e2e.sqlite` preserved locally for developer inspection.
- Environment files `.env.phase2b-e2e` and `.env` remain gitignored and uncommitted.
- The real Discord private match thread `1553666996053213304` in `#🧪・phase2b-match-hub` is preserved for human review.
- All 116 automated tests across 11 test suites pass cleanly.

---

## 8. Final Verdict

**`PASS_WITH_LIMITATIONS`**

*The complete Phase 2B Discord lifecycle (bracket_ready → in_progress → referee assignment → private match room creation → schedule → reschedule → captain readiness → READY_TO_START → LIVE → cold restart persistence) is fully operational and verified end-to-end against the Discord gateway.*
