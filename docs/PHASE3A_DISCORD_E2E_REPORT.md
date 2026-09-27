# PHASE 3A DISCORD E2E VALIDATION REPORT

**Date/Time:** 2026-09-27T16:45:00+07:00  
**Main Commit Tested:** `9c9157d26a9fa9a82fdc1a31ee2240adf01d3036`  
**Main CI Run:** Run ID `36306261239` (Conclusion: `success`)  
**Automated Baseline:** 149 / 149 tests passing across 12 test suites (Typecheck PASS, Build PASS)  
**Branch:** `docs/phase3a-e2e-retest`  
**Final Verdict:** **`PASS_WITH_LIMITATIONS`**

---

## 1. Safety & Production Guild Exclusion Confirmation

| Check | Expected | Actual | Status |
| :--- | :--- | :--- | :--- |
| **Production Guild Exclusion** | ID `1435278955941986540` strictly excluded | Zero network calls or interactions to production guild | **CONFIRMED SAFE** |
| **Test Guild Verification** | Dedicated Test Guild | ID `1435984347814432801` ("test") | **CONFIRMED TEST GUILD** |
| **Test Bot Application** | Dedicated Test Bot | ID `1553604832516898826` ("UMA Smoke Test Bot") | **CONFIRMED TEST BOT** |
| **Match Hub Channel** | Belong to test guild | `1553664980086161518` (`#🧪・phase2b-match-hub`) | **CONFIRMED TEST HUB** |
| **Results Channel** | Belong to test guild | `1435984350020898891` (`#🏆・kết-quả-giải-đấu`) | **CONFIRMED TEST CHANNEL** |
| **Commands Channel** | Belong to test guild | `1435984350020898892` (`#🤖・commands`) | **CONFIRMED TEST CHANNEL** |
| **Staff Channel** | Belong to test guild | `1435984350243061794` (`#🎓・staff-chat`) | **CONFIRMED TEST CHANNEL** |
| **Staff Roles** | Belong to test guild | `1435984348192051265, 1435984348192051264` | **CONFIRMED TEST ROLES** |
| **Scenario A Tournament** | `uma-phase3a-normal-2026` | `uma-phase3a-normal-2026` (`max_teams = 2`) | **ISOLATED TOURNAMENT A** |
| **Scenario A Database** | `data/phase3a-normal-e2e.sqlite` | Initialized fresh from schema, no dirty state | **CONFIRMED FRESH DB A** |
| **Scenario B Tournament** | `uma-phase3a-dispute-2026` | `uma-phase3a-dispute-2026` (`max_teams = 2`) | **ISOLATED TOURNAMENT B** |
| **Scenario B Database** | `data/phase3a-dispute-e2e.sqlite` | Initialized fresh from schema, no dirty state | **CONFIRMED FRESH DB B** |

---

## 2. Controlled Identity Strategy & Synthetic Evidence Artifacts

### Controlled Discord Identities
- **Captain A / Staff / Referee:** `994820818993418240` (Real human test account: `𝑷𝒉𝒖𝒄 𝑽𝒐 💙`, Server Owner / Administrator).
- **Captain B:** `1553604832516898826` (The UMA Smoke Test Bot app user, participating as opponent captain).

### Synthetic PNG Evidence Artifacts
Three dedicated synthetic test screenshot artifacts were generated via `System.Drawing`, binary verified against PNG magic bytes (`89 50 4e 47 0d 0a 1a 0a`), and uploaded via Discord slash command attachments:
- `data/e2e-phase3a-normal.png` (3,276 bytes)
- `data/e2e-phase3a-dispute.png` (2,835 bytes)
- `data/e2e-phase3a-resubmit.png` (3,216 bytes)

---

## 3. Scenario A: Normal Result Approval Lifecycle

### Scenario A Entities
- **Tournament:** `uma-phase3a-normal-2026` (`UMA Phase 3A Normal E2E 2026`, capacity: 2)
- **Team A:** `team_fb95f155-3089-4153-99eb-5243791bd55c` (`UMA Alpha Result Test` [ALP], Captain: `994820818993418240`, Seed 1)
- **Team B:** `team_4d79aec8-6bda-4c2b-9896-bd74801ee2d1` (`UMA Bravo Result Test` [BRV], Captain: `1553604832516898826`, Seed 2)
- **Application Match ID:** `match_81e6f436-715c-42fd-85b9-7c91822e63bf`
- **Engine Match ID:** `93b7df9e-c81c-435e-8c22-5c8261113699`
- **Thread ID:** `1553687507579699285` (`r1-m1-uma-alpha-result-test-vs-uma-bravo-result-test`)
- **Starter Message ID:** `1553687513519095899`
- **Bracket Version Before:** `1`
- **Engine Hash Before:** `0f95d6dac0cbe16014a222e90e7f2b0f000719a9447a54bb39de0e8758a8e385`

### Scenario A Execution Log & Observed Results

| Step | Action | Observed Result | Verdict |
| :--- | :--- | :--- | :--- |
| **A1** | Guild Command Deployment | Verified `/uma` registered with all 18 subcommands: `panel`, `teams`, `my-team`, `status`, `checkin-open`, `check-in`, `checkins`, `draw`, `bracket`, `start`, `match-referee`, `rooms-create`, `match-schedule`, `matches`, `report-result`, `result-resolve`, `result-refresh`, `results`. | **PASS** |
| **A2** | Canonical Two-Team Fixture & Start | Built fixture via canonical domain methods. Match scheduled for `2026-09-27 20:00`. Both captains confirmed ready. Launched bot daemon. Referee clicked `▶️ Bắt đầu trận` in match thread. State transitioned `READY_TO_START` → `LIVE` (`started_at = 1790498664164`). Starter card updated to `🔴 TRẬN ĐẤU ĐANG DIỄN RA`. | **PASS** |
| **A3** | Real Captain Result Report | Captain A executed `/uma report-result my-score:2 opponent-score:1 evidence:data/e2e-phase3a-normal.png` in match thread. Bot archived image into private thread. Ephemeral confirmation: `📸 Đã lưu ảnh và báo cáo. Chờ đối thủ và trọng tài xử lý.` Evidence card posted (`EVIDENCE_MSG = 1553690461061910639`, `ATTACHMENT_ID = 1553690461141475358`, `SUBMISSION_ID = submission_29568ab6-cee7-4c00-9aa2-ea55ffefe77e`, `size = 3276` bytes). Status: `PENDING`. 4 action buttons rendered. | **PASS** |
| **A4** | Pre-Approval Invariants | Database verified: `submissions = 1`, `evidence = 1`, `match_results = 0`. Match remained `LIVE`. Bracket version remained `1`. Engine hash `0f95d6da...` strictly untouched. | **PASS** |
| **A5** | Duplicate & Self-Confirm Protection | Re-running `/uma report-result` while open submission exists was rejected with `⚠️ Trận đã có báo cáo đang chờ xử lý.` Captain A clicked `✅ Đồng ý` on own report: rejected with `⚠️ Chỉ đội trưởng đối thủ được xác nhận hoặc khiếu nại.` DB counts strictly unchanged. | **PASS** |
| **A6** | Opponent Confirmation | Executed canonical domain fallback (`ResultService.confirm`) for Captain B (`1553604832516898826`). State transitioned `PENDING` → `CONFIRMED`. Ran `/uma result-refresh` in thread: evidence card updated to `Trạng thái: ✅ Đối thủ đã đồng ý, chờ trọng tài`. Confirm and Dispute buttons disabled; Approve and Reject buttons enabled. Version `1` and hash untouched. | **PASS** (with limitation) |
| **A7** | Real Referee Approval | Referee clicked `✅ Duyệt kết quả` on evidence card. Ephemeral confirmation: `✅ Kết quả đã được duyệt và nhánh đấu đã cập nhật.` Submission transitioned to `APPROVED`. Match transitioned to `COMPLETED`. Canonical `match_results` inserted (2–1 Alpha wins, `approved_by = 994820818993418240`, `approved_at = 1790499613608`). Tournament transitioned to `completed`. Champion recorded in `tournament_outcomes` (`champion = UMA Alpha Result Test`, `runner_up = UMA Bravo Result Test`). | **PASS** |
| **A8** | Card Refresh & Hash Mutation | Evidence card updated to `✅ KẾT QUẢ ĐÃ ĐƯỢC DUYỆT`, all action buttons removed (0 buttons), attachment image preserved. Starter card updated to `State: ✅ TRẬN ĐẤU HOÀN TẤT`, `Kết quả chính thức: 2–1 • Thắng: UMA Alpha Result Test`. Bracket version incremented `1 → 2`. Engine hash mutated to `5530996d28f3d0978528052d520d40225707a168448a6b8a6cd735ccc48d9e4d`. | **PASS** |
| **A9** | Public Views & Privacy | In `#🤖・commands`: `/uma results` showed `R1-M1 — UMA Alpha Result Test 2–1 UMA Bravo Result Test ✅ Đã xác nhận`. `/uma matches` showed `✅ TRẬN ĐẤU HOÀN TẤT`. `/uma status` showed `Giai đoạn: Đã kết thúc`, `COMPLETED: 1`, `Vô địch: UMA Alpha Result Test`. Zero private thread links, contact strings, player UIDs, or internal UUIDs exposed. | **PASS** |
| **A10** | Post-Approval Immutability | Attempted `/uma report-result` in completed room: rejected with `⚠️ Giải đấu chưa ở giai đoạn thi đấu.` Zero duplicate submissions. | **PASS** |
| **A11** | Result Refresh Idempotency | Ran `/uma result-refresh` in completed room: returned success. All DB rows, version `2`, and engine hash remained 100% identical with zero mutations. | **PASS** |
| **A12** | Cold Restart Persistence | Bot daemon gracefully stopped and cold restarted via `node dist/index.js`. All 15+ operational database fields, version `2`, engine hash, outcomes, and public views matched pre-restart state with 100% exact equality. | **PASS** |

---

## 4. Scenario B: Dispute / Rejection / Resubmission / Resolution Lifecycle

### Scenario B Entities
- **Tournament:** `uma-phase3a-dispute-2026` (`UMA Phase 3A Dispute E2E 2026`, capacity: 2)
- **Team A:** `team_f839d4d0-e438-43c8-9b2e-78bae5c1af58` (`UMA Crimson Result Test` [CRM], Captain: `994820818993418240`, Seed 1)
- **Team B:** `team_da903d88-5e1b-4663-a102-e417c07ff436` (`UMA Azure Result Test` [AZR], Captain: `1553604832516898826`, Seed 2)
- **Application Match ID:** `match_95c1f00d-4cc6-4095-babb-8a201c170e22`
- **Engine Match ID:** `57b3e910-4fae-4aea-abe6-be8d6d79ae7b`
- **Thread ID:** `1553697146258071702` (`r1-m1-uma-crimson-result-test-vs-uma-azure-result-test`)
- **Starter Message ID:** `1553697152096669840`
- **Bracket Version Before:** `1`
- **Engine Hash Before:** `cf8df0d83bfacf2cd298bf3146678f1d3b9ef6df0fd5c2da6e303cb7fc183be4`

### Scenario B Execution Log & Observed Results

| Step | Action | Observed Result | Verdict |
| :--- | :--- | :--- | :--- |
| **B1** | Second Live Match Fixture | Configured fresh database `data/phase3a-dispute-e2e.sqlite`. Built canonical fixture. Both captains confirmed ready. Launched bot daemon. Clicked `▶️ Bắt đầu trận` in Discord thread: state transitioned `READY_TO_START` → `LIVE` (`started_at = 1790500956629`). Starter card updated to `🔴 TRẬN ĐẤU ĐANG DIỄN RA`. | **PASS** |
| **B2** | First Report (B1) | Captain A executed `/uma report-result my-score:2 opponent-score:0 evidence:data/e2e-phase3a-dispute.png`. Submission B1 created (`submission_b3c0773a-ce61-4756-843a-a36dadd7120b`, `msg = 1553698696674283611`, `attachment = 1553698696779010161`, `size = 2835` bytes, `status = PENDING`). Evidence card posted with 4 buttons. | **PASS** |
| **B3** | Opponent Dispute (B1) | Executed canonical domain fallback (`ResultService.dispute`) for Captain B with reason `"Tỷ số chưa khớp ảnh trận đấu"`. Transitioned `PENDING → DISPUTED`. Ran `/uma result-refresh` in thread: evidence card updated to `⚠️ KẾT QUẢ ĐANG TRANH CHẤP`. Confirm, Dispute, and Approve buttons disabled. Version `1` and hash untouched. | **PASS** (with limitation) |
| **B4** | Real Referee Rejection (Discord Modal) | Referee clicked `❌ Yêu cầu báo lại` on evidence card B1. Native Discord modal `Yêu cầu báo lại` opened. Filled reason `"Ảnh chưa đủ rõ, vui lòng báo lại kết quả."` and submitted. Ephemeral confirmation: `❌ Đã yêu cầu báo lại. Trận vẫn LIVE.` Submission B1 transitioned to `REJECTED` (`rejection_reason` saved). Evidence card B1 updated to `❌ Yêu cầu báo lại` (0 buttons, image preserved). Match remained `LIVE`. Version `1` and hash untouched. | **PASS** |
| **B5** | Real Resubmission (B2) | Captain A executed `/uma report-result my-score:2 opponent-score:1 evidence:data/e2e-phase3a-resubmit.png`. Submission B2 created (`submission_c4d2e46b-22bd-42fd-b96b-a0d95f5704cd`, `msg = 1553700344272265258`, `attachment = 1553700344385765496`, `size = 3216` bytes, `status = PENDING`). DB now stores exactly 2 historical submissions (B1 `REJECTED`, B2 `PENDING`). Evidence card B2 posted with 4 buttons. | **PASS** |
| **B6** | Second Dispute (B2) | Executed canonical domain fallback (`ResultService.dispute`) for Captain B with reason `"Vẫn chưa đồng ý tỷ số ván 2"`. Submission B2 transitioned to `DISPUTED`. Second dispute row inserted. DB stores 2 dispute rows. | **PASS** (with limitation) |
| **B7** | Blocked Normal Approval | Clicked `✅ Duyệt kết quả` on disputed submission B2: backend rejected with `⚠️ Báo cáo cần được xử lý theo đúng trạng thái.` Ran `/uma result-refresh`: evidence card B2 updated to `⚠️ KẾT QUẢ ĐANG TRANH CHẤP` with `✅ Duyệt kết quả` disabled in Discord UI. Double-layer protection verified. | **PASS** |
| **B8** | Real Referee Resolution | Referee executed `/uma result-resolve team1-score:2 team2-score:1 reason:"Đã đối chiếu ảnh và xác nhận tỷ số chính thức."` in thread. Ephemeral confirmation: `✅ Đã xử lý tranh chấp và cập nhật nhánh đấu.` Submission B2 transitioned to `APPROVED`. Canonical `match_results` created with `resolution_reason`. Match transitioned to `COMPLETED`. Tournament completed. Champion persisted (`champion = UMA Crimson Result Test`, `runner_up = UMA Azure Result Test`). Bracket version incremented `1 → 2`. Engine hash mutated to `bdaea981aaca23eca1f2e17bb104480ca6cded528242ab573c1c34d2264b2f9d`. Starter card updated to `✅ TRẬN ĐẤU HOÀN TẤT` (2–1 Crimson). | **PASS** |
| **B9** | Historical Evidence Integrity | Verified both submission records B1 (`REJECTED`) and B2 (`APPROVED`), their distinct message IDs, attachment IDs, sizes (`2,835` vs `3,216` bytes), dispute reasons, and rejection reasons remain intact in DB and Discord thread. | **PASS** |
| **B10** | Card States Post-Resolution | Card B1 remains intact as `❌ Yêu cầu báo lại` with image preserved and 0 buttons. Card B2 remains intact as `✅ KẾT QUẢ ĐÃ ĐƯỢC DUYỆT` with image preserved and 0 buttons. Starter card reflects official 2–1 score. | **PASS** |
| **B11** | Cold Restart Persistence | Bot daemon gracefully stopped and cold restarted via `node dist/index.js`. All 16+ database fields, version `2`, engine hash, outcomes, and public views matched pre-restart state with 100% exact equality. Re-executed `/uma results` and `/uma status` in `#🤖・commands`: accurate public views with zero leaked data. | **PASS** |

---

## 5. Pre/Post Cold Restart Exact State Comparisons

### Scenario A Exact Comparison Table

| Field | Pre-Restart Value | Post-Restart Value | Comparison |
| :--- | :--- | :--- | :--- |
| `TOURNAMENT_ID` | `uma-phase3a-normal-2026` | `uma-phase3a-normal-2026` | **EXACT MATCH** |
| `TOURNAMENT_STATUS` | `completed` | `completed` | **EXACT MATCH** |
| `MATCH_STATUS` | `COMPLETED` | `COMPLETED` | **EXACT MATCH** |
| `APP_MATCH_ID` | `match_81e6f436-715c-42fd-85b9-7c91822e63bf` | `match_81e6f436-715c-42fd-85b9-7c91822e63bf` | **EXACT MATCH** |
| `ENGINE_MATCH_ID` | `93b7df9e-c81c-435e-8c22-5c8261113699` | `93b7df9e-c81c-435e-8c22-5c8261113699` | **EXACT MATCH** |
| `THREAD_ID` | `1553687507579699285` | `1553687507579699285` | **EXACT MATCH** |
| `STARTER_MESSAGE_ID` | `1553687513519095899` | `1553687513519095899` | **EXACT MATCH** |
| `SUBMISSION_COUNT` | `1` | `1` | **EXACT MATCH** |
| `SUBMISSION_ID` | `submission_29568ab6-cee7-4c00-9aa2-ea55ffefe77e` | `submission_29568ab6-cee7-4c00-9aa2-ea55ffefe77e` | **EXACT MATCH** |
| `SUBMISSION_STATUS` | `APPROVED` | `APPROVED` | **EXACT MATCH** |
| `EVIDENCE_MSG_ID` | `1553690461061910639` | `1553690461061910639` | **EXACT MATCH** |
| `ATTACHMENT_ID` | `1553690461141475358` | `1553690461141475358` | **EXACT MATCH** |
| `CANONICAL_RESULTS` | `1` row (`team1 = 2`, `team2 = 1`, `winner = Alpha`) | `1` row (`team1 = 2`, `team2 = 1`, `winner = Alpha`) | **EXACT MATCH** |
| `CHAMPION_TEAM_ID` | `team_fb95f155-3089-4153-99eb-5243791bd55c` | `team_fb95f155-3089-4153-99eb-5243791bd55c` | **EXACT MATCH** |
| `RUNNER_UP_TEAM_ID` | `team_4d79aec8-6bda-4c2b-9896-bd74801ee2d1` | `team_4d79aec8-6bda-4c2b-9896-bd74801ee2d1` | **EXACT MATCH** |
| `BRACKET_VERSION` | `2` | `2` | **EXACT MATCH** |
| `ENGINE_HASH` | `5530996d28f3d0978528052d520d40225707a168448a6b8a6cd735ccc48d9e4d` | `5530996d28f3d0978528052d520d40225707a168448a6b8a6cd735ccc48d9e4d` | **EXACT MATCH** |

---

### Scenario B Exact Comparison Table

| Field | Pre-Restart Value | Post-Restart Value | Comparison |
| :--- | :--- | :--- | :--- |
| `TOURNAMENT_ID` | `uma-phase3a-dispute-2026` | `uma-phase3a-dispute-2026` | **EXACT MATCH** |
| `TOURNAMENT_STATUS` | `completed` | `completed` | **EXACT MATCH** |
| `MATCH_STATUS` | `COMPLETED` | `COMPLETED` | **EXACT MATCH** |
| `APP_MATCH_ID` | `match_95c1f00d-4cc6-4095-babb-8a201c170e22` | `match_95c1f00d-4cc6-4095-babb-8a201c170e22` | **EXACT MATCH** |
| `ENGINE_MATCH_ID` | `57b3e910-4fae-4aea-abe6-be8d6d79ae7b` | `57b3e910-4fae-4aea-abe6-be8d6d79ae7b` | **EXACT MATCH** |
| `THREAD_ID` | `1553697146258071702` | `1553697146258071702` | **EXACT MATCH** |
| `STARTER_MESSAGE_ID` | `1553697152096669840` | `1553697152096669840` | **EXACT MATCH** |
| `SUBMISSION_COUNT` | `2` (B1 `REJECTED`, B2 `APPROVED`) | `2` (B1 `REJECTED`, B2 `APPROVED`) | **EXACT MATCH** |
| `SUBMISSION_B1_ID` | `submission_b3c0773a-ce61-4756-843a-a36dadd7120b` | `submission_b3c0773a-ce61-4756-843a-a36dadd7120b` | **EXACT MATCH** |
| `SUBMISSION_B1_STATUS` | `REJECTED` | `REJECTED` | **EXACT MATCH** |
| `SUBMISSION_B1_REJECTION` | `"Ảnh chưa đủ rõ, vui lòng báo lại kết quả."` | `"Ảnh chưa đủ rõ, vui lòng báo lại kết quả."` | **EXACT MATCH** |
| `SUBMISSION_B2_ID` | `submission_c4d2e46b-22bd-42fd-b96b-a0d95f5704cd` | `submission_c4d2e46b-22bd-42fd-b96b-a0d95f5704cd` | **EXACT MATCH** |
| `SUBMISSION_B2_STATUS` | `APPROVED` | `APPROVED` | **EXACT MATCH** |
| `DISPUTE_COUNT` | `2` rows | `2` rows | **EXACT MATCH** |
| `EVIDENCE_COUNT` | `2` rows (`2,835` bytes & `3,216` bytes) | `2` rows (`2,835` bytes & `3,216` bytes) | **EXACT MATCH** |
| `CANONICAL_RESULTS` | `1` row (`team1 = 2`, `team2 = 1`, `winner = Crimson`) | `1` row (`team1 = 2`, `team2 = 1`, `winner = Crimson`) | **EXACT MATCH** |
| `RESOLUTION_REASON` | `"Đã đối chiếu ảnh và xác nhận tỷ số chính thức."` | `"Đã đối chiếu ảnh và xác nhận tỷ số chính thức."` | **EXACT MATCH** |
| `CHAMPION_TEAM_ID` | `team_f839d4d0-e438-43c8-9b2e-78bae5c1af58` | `team_f839d4d0-e438-43c8-9b2e-78bae5c1af58` | **EXACT MATCH** |
| `RUNNER_UP_TEAM_ID` | `team_da903d88-5e1b-4663-a102-e417c07ff436` | `team_da903d88-5e1b-4663-a102-e417c07ff436` | **EXACT MATCH** |
| `BRACKET_VERSION` | `2` | `2` | **EXACT MATCH** |
| `ENGINE_HASH` | `bdaea981aaca23eca1f2e17bb104480ca6cded528242ab573c1c34d2264b2f9d` | `bdaea981aaca23eca1f2e17bb104480ca6cded528242ab573c1c34d2264b2f9d` | **EXACT MATCH** |

---

## 6. Documented Limitations

1. **`AUTHORIZATION_SEPARATION_NOT_MANUALLY_VALIDATED`**:  
   Due to the single human Discord test account (`994820818993418240`, `𝑷𝒉𝒖𝒄 𝑽𝒐 💙`, Server Owner / Administrator), the same user acted as Captain A, Staff administrator, and assigned Referee. Rejection of unauthorized actions (e.g. non-captain reporting result, captain confirming own result, referee approving without assignment) is strictly enforced in the domain and thoroughly validated in the automated test suite (`tests/phase3a_results.test.ts`), with self-confirm rejection explicitly verified in Discord UI.

2. **`SECOND_CAPTAIN_RESULT_INTERACTION_NOT_MANUALLY_VALIDATED`**:  
   Captain B was assigned to the test bot user identity (`1553604832516898826`). Opponent confirmation and dispute actions for Captain B were executed via canonical domain fallback (`ResultService.confirm` and `ResultService.dispute`) rather than physical Discord UI button clicks. The resulting Discord state changes were subsequently rendered and validated live via the bot's `/uma result-refresh` command.

3. **`MULTI_ROUND_ADVANCEMENT_NOT_LIVE_DISCORD_VALIDATED`**:  
   Live Discord E2E was executed on 2-team final single-elimination fixtures in both Scenario A and Scenario B. Multi-round advancement (e.g. 4-team semifinal winner advancing into finals and waiting for opponent, and 3-team BYE advancement) is rigorously covered and verified in the automated test suite (`tests/phase3a_results.test.ts`).

---

## 7. Conclusion

Phase 3A Discord E2E validation successfully completed all test stages for both **Scenario A** (Normal Result Approval) and **Scenario B** (Dispute, Rejection via Modal, Resubmission, and Referee Resolution) on the dedicated Discord Test Guild.

- Production Guild `1435278955941986540` was **100% untouched**.
- Zero source code modifications in `src/*` were made during validation.
- All 149 automated tests remain passing.
- Database persistence across process restarts achieved **100% exact state equality**.
- Phase 3A Discord E2E is formally rated: **`PASS_WITH_LIMITATIONS`**.
