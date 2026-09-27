# PHASE 1 DISCORD E2E SMOKE RETEST REPORT

**Date/Time:** 2026-09-27T10:51:58+07:00  
**Main Commit Tested:** `5e47f498091c59c855d94f03e7500b1b927a0126`  
**Main CI Run:** Run ID `36292054406` (Conclusion: `success`)  
**Automated Baseline:** 78 / 78 tests passing across 9 suites (Typecheck PASS, Build PASS)  
**Branch:** `docs/phase1-e2e-retest`  
**Final Verdict:** **`PASS_WITH_LIMITATIONS`**

---

## 1. Safety & Production Guild Exclusion Confirmation

| Check | Expected | Actual | Status |
| :--- | :--- | :--- | :--- |
| **Production Guild Exclusion** | ID `1435278955941986540` strictly excluded | Zero network calls or interactions to production guild | **CONFIRMED SAFE** |
| **Test Guild Verification** | Dedicated Test Guild | ID `1435984347814432801` ("test") | **CONFIRMED TEST GUILD** |
| **Test Bot Application** | Dedicated Test Bot | ID `1553604832516898826` ("UMA Smoke Test Bot") | **CONFIRMED TEST BOT** |
| **New Tournament Identity** | `uma-smoke-retest-2026` | `uma-smoke-retest-2026` | **ISOLATED TOURNAMENT** |
| **Fresh Database Path** | `data/smoke-retest.sqlite` | Created fresh, did not exist prior to retest | **CONFIRMED FRESH DB** |
| **Test BTC Channel** | Belong to test guild | `1435984350243061794` (`#🎓・staff-chat`) | **CONFIRMED TEST CHANNEL** |
| **Test Registration Channel** | Belong to test guild | `1435984350020898892` (`#🤖・commands`) | **CONFIRMED TEST CHANNEL** |
| **Test Referee Channel** | Belong to test guild | `1435984350243061795` (`#🔐・staff-commands`) | **CONFIRMED TEST CHANNEL** |
| **Test Results Channel** | Belong to test guild | `1435984350020898891` (`#📁・bug-reports`) | **CONFIRMED TEST CHANNEL** |
| **Test Staff Roles** | Belong to test guild | `1435984348192051265, 1435984348192051264` | **CONFIRMED TEST ROLES** |

---

## 2. End-to-End Lifecycle Stage Results

### Phase A — Windows Real Entry Point (`node dist/index.js`): **PASS**
- Bot launched directly with `node dist/index.js` (no workarounds).
- Verified console log sequence:
  ```text
  🚀 Initializing UMA Tournament Bot...
  Config loaded: Guild=1435984347814432801, DB=data/smoke-retest.sqlite
  📦 Database initialized and schema verified.
  🏆 Tournament "uma-smoke-retest-2026" ready (capacity: 3 teams).
  🤖 UMA Tournament Bot is online as UMA Smoke Test Bot#7415!
  ```
- Windows ESM direct-entry detection defect fixed by PR #4 is **fully verified**.

### Phase B — Slash Command Check: **PASS**
- Queried registered commands in test guild `1435984347814432801`.
- Verified `/uma` registered with all 4 subcommands: `panel`, `teams`, `my-team`, `status`.

### Phase C — Registration Panel Sanity Check: **PASS**
- Executed `/uma panel` in `#🤖・commands` (`1435984350020898892`).
- Message ID: `1553613645089341501`.
- Embed rendered:
  - Title: `🏆 UMA CUP — ĐĂNG KÝ THI ĐẤU`
  - Stats: `Đã đăng ký: 0 / 3`, `Đã duyệt: 0`, `Chờ duyệt / chỉnh sửa: 0`, `Còn lại: 3 suất`
  - Buttons: `[📝 Đăng ký đội]`, `[👥 Danh sách đội]`, `[📘 Hướng dẫn]`

### Phase D — Registration Modal Regression: **PASS**
- Clicked `📝 Đăng ký đội` on the new panel message.
- Discord modal `Đăng ký Đội — Liên Quân Mobile` opened successfully without throwing `ExpectedConstraintError`.
- Field 4 placeholder verified shortened (`Tên | UID, đúng 5 dòng\nVD: UMA_Top | 100000001`, ≤ 100 chars).
- **The previous smoke test blocker is fully resolved.**

### Phase E — Team Registration Submission: **PASS**
- Submitted synthetic team data:
  - Team Name: `UMA Smoke Retest`
  - Tag: `SMK`
  - Captain Contact: `TEST-CONTACT`
  - 5 Starters: `SMK_Top` (`TEST_UID_001`), `SMK_Jungle` (`TEST_UID_002`), `SMK_Mid` (`TEST_UID_003`), `SMK_AD` (`TEST_UID_004`), `SMK_Support` (`TEST_UID_005`)
  - 1 Substitute: `SMK_Sub` (`TEST_UID_006`)
- Ephemeral confirmation received: `✅ ĐƠN ĐĂNG KÝ THÀNH CÔNG!`.
- BTC Review Card posted in `#🎓・staff-chat`: Message ID `1553613763444219966`.
- SQLite Read-Only Verification:
  - Exactly 1 team row.
  - `ORIGINAL_TEAM_ID`: `team_e170baac-1531-4cb7-af9f-00a17008ed93`
  - Status: `PENDING`
  - Players: 5 starters + 1 substitute (6 rows total).

### Phase F — BTC Requests Correction: **PASS**
- Clicked `✏️ Yêu Cầu Sửa` on review card in `#🎓・staff-chat`.
- Modal opened: entered reason `Smoke retest: verify correction lifecycle`.
- Review card updated in-place:
  - Header: `✏️ ĐANG CHỜ ĐỘI CHỈNH SỬA — UMA Smoke Retest [SMK]`
  - Status: `NEEDS_CORRECTION`
  - Reason: `Smoke retest: verify correction lifecycle`
  - Review buttons disabled (`disabled: true`).
- SQLite Read-Only Verification:
  - `status = 'NEEDS_CORRECTION'`
  - Audit log recorded: action `REQUEST_CORRECTION`, previous `PENDING`, new `NEEDS_CORRECTION`.

### Phase G — Captain Inspection & Edit/Resubmission: **PASS**
- Executed `/uma my-team` in `#🤖・commands`.
- Embed correctly displayed `Trạng thái: ✏️ YÊU CẦU CHỈNH SỬA` and reason `Smoke retest: verify correction lifecycle`.
- Clicked `[✏️ Chỉnh sửa đơn]`: edit modal `Sửa Đơn — UMA Smoke Retest` opened with all fields prefilled.
- Modified team name to: `UMA Smoke Retest Revised`.
- Kept Tag `SMK`, contact `TEST-CONTACT`, and all starter/substitute UIDs unchanged.
- Submitted edit modal: received confirmation `✅ NỘP LẠI ĐƠN THÀNH CÔNG!`.

### Phase H — Identity Preservation & Database Invariants: **PASS**
- SQLite Read-Only Verification:
  - `team.id AFTER resubmission`: `team_e170baac-1531-4cb7-af9f-00a17008ed93`
  - `ORIGINAL_TEAM_ID`: `team_e170baac-1531-4cb7-af9f-00a17008ed93`
  - **IDs match 100% (Identity preserved).**
  - Name updated to `UMA Smoke Retest Revised`.
  - Status: `PENDING`.
  - Exactly 1 team in database; zero duplicate teams.
  - Exactly 6 players; zero duplicate or orphan player rows.
  - Audit trail contains: `REQUEST_CORRECTION` followed by `RESUBMIT_CORRECTION`.

### Phase I — BTC Approval: **PASS**
- Navigated to `#🎓・staff-chat`: review card refreshed automatically upon resubmission:
  - Header: `🟡 ĐƠN ĐĂNG KÝ CHỜ DUYỆT — UMA Smoke Retest Revised [SMK]`
  - Status: `PENDING`
  - Buttons re-enabled: `[✅ Duyệt Đội]`, `[✏️ Yêu Cầu Sửa]`, `[❌ Từ Chối]`.
- Clicked `✅ Duyệt Đội`.
- Card updated to: `🟢 ĐƠN ĐÃ ĐƯỢC DUYỆT — UMA Smoke Retest Revised [SMK]`.
- All buttons disabled (`disabled: true`).
- SQLite Read-Only Verification:
  - `status = 'APPROVED'`
  - Audit log recorded: action `APPROVE`, previous `PENDING`, new `APPROVED`.

### Phase J — Public & Staff Command Validation: **PASS**
1. `/uma teams`:
   - Output: `🟢 Đội đã duyệt (1): 1. UMA Smoke Retest Revised [SMK] — Đội trưởng: @𝑷𝒉𝒖𝒄 𝑽𝒐 💙`
   - Zero raw contact details or UIDs leaked publicly.
2. `/uma status`:
   - Output: `Đã duyệt chính thức: 1 / 3 đội`, `Đang chờ BTC duyệt: 0 đội`, `Yêu cầu chỉnh sửa: 0 đội`, `Đã từ chối: 0 đội`, `Hạn ngạch: Tối đa 3 đội`.
3. `/uma panel`:
   - Output: `Đã đăng ký: 1 / 3`, `Đã duyệt: 1`, `Chờ duyệt / chỉnh sửa: 0`, `Còn lại: 2 suất`.

### Phase K — Real Process Restart: **PASS**
- Gracefully stopped bot daemon.
- Re-executed: `node dist/index.js` using identical `.env` and `data/smoke-retest.sqlite`.
- Startup verified:
  ```text
  🚀 Initializing UMA Tournament Bot...
  Config loaded: Guild=1435984347814432801, DB=data/smoke-retest.sqlite
  📦 Database initialized and schema verified.
  🏆 Tournament "uma-smoke-retest-2026" ready (capacity: 3 teams).
  🤖 UMA Tournament Bot is online as UMA Smoke Test Bot#7415!
  ```

### Phase L — Post-Restart Persistence: **PASS**
- Executed commands post-restart:
  - `/uma my-team`: Shows `ĐỘI CỦA BẠN: UMA Smoke Retest Revised [SMK]`, status `🟢 ĐÃ ĐƯỢC DUYỆT`, team ID `team_e170baac-1531-4cb7-af9f-00a17008ed93`.
  - `/uma teams`: Shows `1. UMA Smoke Retest Revised [SMK]`.
  - `/uma status`: Shows `Đã duyệt chính thức: 1 / 3 đội`.
- SQLite Read-Only Verification:
  - Exactly 1 tournament (`uma-smoke-retest-2026`, `max_teams = 3`).
  - Exactly 1 team (`team_e170baac-1531-4cb7-af9f-00a17008ed93`, `status = 'APPROVED'`).
  - Exactly 6 players (5 starters + 1 substitute).
  - 3 audit log records intact.

### Phase M — Production Integrity: **PASS**
- Zero messages sent to UMA production guild (`1435278955941986540`).
- Zero commands deployed to production.
- Zero global commands created.
- Zero production channels, roles, or configurations touched.
- TempVoice and Tourney Bot untouched.
- 100% synthetic data used.

---

## 3. Discovered Limitations

1. **`AUTHORIZATION_SEPARATION_NOT_MANUALLY_VALIDATED`**:  
   Only one test Discord user account was available (`𝑷𝒉𝒖𝒄 𝑽𝒐 💙`, Server Owner / Administrator), which acted as both captain and BTC staff. Automated authorization separation is comprehensively validated by unit tests in `tests/phase1_registration_approval.test.ts` and `tests/phase1_5_hardening.test.ts`.

2. **Direct Message Delivery Limitation**:  
   Direct messages from the bot to the captain account were not received due to Discord account privacy settings restricting DMs from server bot apps. The complete correction lifecycle (`PENDING` → `NEEDS_CORRECTION` → `/uma my-team` → edit → `PENDING` → `APPROVED`) was 100% functional and verified through the in-server Discord UI and SQLite audit logs.

---

## 4. Newly Discovered Defects

**NONE.** Both defects from the initial smoke run (TextInput placeholder length constraint and Windows direct entry guard) are completely resolved and verified in real Discord interaction.

---

## 5. Cleanup & Evidence State

- Bot daemon stopped gracefully.
- Test evidence database `data/smoke-retest.sqlite` preserved locally for developer verification.
- Test environment `.env.smoke-retest` and `.env` remain gitignored and uncommitted.
- Historical failed report `docs/PHASE1_DISCORD_SMOKE_TEST_REPORT.md` preserved unmutated.

---

## 6. Final Verdict

**`PASS_WITH_LIMITATIONS`**

*Core Discord E2E interaction lifecycle is fully operational, verified end-to-end, and ready for review.*
