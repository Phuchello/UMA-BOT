# PHASE 2A DISCORD E2E VALIDATION REPORT

**Date/Time:** 2026-09-27T11:38:00+07:00  
**Main Commit Tested:** `67d6a7101cd7feb9d23a6625b0d625603d1ef7ee`  
**Main CI Run:** Run ID `36294131097` (Conclusion: `success`)  
**Automated Baseline:** 95 / 95 tests passing across 10 test suites (Typecheck PASS, Build PASS)  
**Branch:** `docs/phase2a-e2e-retest`  
**Final Verdict:** **`PASS_WITH_LIMITATIONS`**

---

## 1. Safety & Production Guild Exclusion Confirmation

| Check | Expected | Actual | Status |
| :--- | :--- | :--- | :--- |
| **Production Guild Exclusion** | ID `1435278955941986540` strictly excluded | Zero network calls or interactions to production guild | **CONFIRMED SAFE** |
| **Test Guild Verification** | Dedicated Test Guild | ID `1435984347814432801` ("test") | **CONFIRMED TEST GUILD** |
| **Test Bot Application** | Dedicated Test Bot | ID `1553604832516898826` ("UMA Smoke Test Bot") | **CONFIRMED TEST BOT** |
| **Tournament Identity** | `uma-phase2a-e2e-2026` | `uma-phase2a-e2e-2026` (`max_teams = 3`) | **ISOLATED TOURNAMENT** |
| **Fresh Database Path** | `data/phase2a-e2e.sqlite` | Initialized fresh from schema, no dirty state | **CONFIRMED FRESH DB** |
| **Staff Channel** | Belong to test guild | `1435984350243061794` (`#🎓・staff-chat`) | **CONFIRMED TEST CHANNEL** |
| **Commands Channel** | Belong to test guild | `1435984350020898892` (`#🤖・commands`) | **CONFIRMED TEST CHANNEL** |
| **Staff Roles** | Belong to test guild | `1435984348192051265, 1435984348192051264` | **CONFIRMED TEST ROLES** |

---

## 2. Controlled Test Field

Three teams were initialized into `data/phase2a-e2e.sqlite` using canonical domain registration and approval methods before bot startup:

| Team ID | Team Name | Tag | Captain Discord ID | Status | Starters / Subs |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `team_20276f3e-4683-4c77-ae55-a08727af023b` | UMA Alpha Test | ALP | `994820818993418240` (Real Test Account: `𝑷𝒉𝒖𝒄 𝑽𝒐 💙`) | `APPROVED` | 5 starters, 0 subs |
| `team_2fc663ed-4ebe-4c11-9355-cfd668ae6175` | UMA Bravo Test | BRV | `200000000000000001` (Synthetic) | `APPROVED` | 5 starters, 0 subs |
| `team_121c62d8-7561-47a7-b9be-e793ef18390b` | UMA Charlie Test | CHR | `200000000000000002` (Synthetic) | `APPROVED` | 5 starters, 0 subs |

Initial state verified:
- Tournament status: `registration_open`
- Teams: 3 approved, 0 pending, 0 needs_correction, 0 rejected, 0 withdrawn
- Check-ins: 0 rows in `team_checkins`
- Seeds: 0 rows in `tournament_seeds`
- Brackets: 0 rows in `tournament_brackets`
- Matches: 0 rows in `tournament_matches`
- BYEs: 0 rows in `tournament_byes`

---

## 3. End-to-End Lifecycle Stage Results

### Phase A — Test-Guild Command Deployment: **PASS**
- Deployed guild slash commands to test guild `1435984347814432801`.
- Verified `/uma` command registered with all 9 subcommands:
  - `panel`, `teams`, `my-team`, `status`
  - `checkin-open`, `check-in`, `checkins`
  - `draw`, `bracket`

### Phase B — Real Windows Bot Startup: **PASS**
- Bot launched via `node dist/index.js` on Windows ESM.
- Startup log verified:
  ```text
  🚀 Initializing UMA Tournament Bot...
  Config loaded: Guild=1435984347814432801, DB=data/phase2a-e2e.sqlite
  📦 Database initialized and schema verified.
  🏆 Tournament "uma-phase2a-e2e-2026" ready (capacity: 3 teams).
  🤖 UMA Tournament Bot is online as UMA Smoke Test Bot#7415!
  ```

### Phase C — Registration-Open Panel Sanity Check: **PASS**
- Executed `/uma panel` in `#🤖・commands` (`1435984350020898892`).
- Message ID: `1553624333320982589`.
- Verified embed contents:
  - Status: `🟢 ĐANG MỞ ĐĂNG KÝ`
  - Registered: `3 / 3`
  - Approved: `3`
  - Remaining: `0 suất`
  - Register button `[📝 Đăng ký đội]` enabled (`disabled: false`).

### Phase D — Open Check-In: **PASS**
- Executed `/uma checkin-open` in `#🎓・staff-chat` (`1435984350243061794`) as staff.
- Ephemeral response received:
  `🔒 Đã khóa đăng ký và mở check-in. **3 đội đã duyệt** có thể điểm danh bằng /uma check-in.`
- SQLite Read-Only Verification:
  - `tournament.status = 'checkin_open'`

### Phase E — Registration Lock Regression: **PASS**
1. Re-executed `/uma panel` in `#🤖・commands`:
   - Status updated: `🟡 ĐÃ KHÓA ĐĂNG KÝ — ĐANG CHECK-IN`
   - Register button `[📝 Đăng ký đội]` disabled (`disabled: true`).
2. Clicked previous panel's register button on Message `1553624333320982589`:
   - Ephemeral rejection: `🔒 Đăng ký đã khóa.`
   - No modal opened.
3. Domain registration probe (`TeamRepository.registerTeam`):
   - Returned `REGISTRATION_CLOSED`.
   - Teams count in SQLite strictly maintained at 3.

### Phase F — Real Captain Check-In: **PASS**
1. Executed `/uma check-in` in `#🤖・commands` as Team A captain (`994820818993418240`):
   - Ephemeral reply: `✅ Đội UMA Alpha Test đã check-in thành công.`
2. Re-executed `/uma check-in` in `#🤖・commands` (idempotency check):
   - Ephemeral reply: `ℹ️ Đội UMA Alpha Test đã check-in trước đó.`
3. SQLite Read-Only Verification:
   - Exactly 1 row in `team_checkins` for `TEAM_A_ID` (`team_20276f3e-4683-4c77-ae55-a08727af023b`), `checked_in_by_discord_id = '994820818993418240'`.

### Phase G — Complete Test Field Check-In: **PASS**
- Executed `TournamentService.checkIn` domain fallback for Team B (`team_2fc663ed-4ebe-4c11-9355-cfd668ae6175`, captain `200000000000000001`) and Team C (`team_121c62d8-7561-47a7-b9be-e793ef18390b`, captain `200000000000000002`).
- Both teams returned `{ repeated: false }`.
- Restarted bot daemon; verified online.
- Executed `/uma checkins` in `#🤖・commands`:
  - Embed: `UMA CUP — ĐIỂM DANH ĐỘI`
  - Stats: `Đã duyệt: 3 • Đã check-in: 3 • Chưa check-in: 0`
  - Checked-in list: `UMA Alpha Test, UMA Bravo Test, UMA Charlie Test`
  - Missing list: `Không có`
- Executed `/uma status` in `#🤖・commands`:
  - Status: `Đang check-in`
  - Approved: `3 / 3 đội`
  - Checked in: `3 đội`
  - Bracket: `Chưa bốc thăm`

### Phase H — Random Draw & Seeding: **PASS**
- Executed `/uma draw` in `#🎓・staff-chat` (`1435984350243061794`) as staff.
- Ephemeral response received:
  ```text
  BỐC THĂM THÀNH CÔNG
  Đội hợp lệ: 3
  Số vòng: 2
  BYE: 1
  Nhánh đấu: Đã lưu thành công

  Thứ tự hạt giống ngẫu nhiên:
  #1 — UMA Alpha Test
  #2 — UMA Bravo Test
  #3 — UMA Charlie Test
  ```
- **Captured State Before Restart:**
  - `SEED_MAPPING_BEFORE_RESTART`:
    - Seed 1: `team_20276f3e-4683-4c77-ae55-a08727af023b` (UMA Alpha Test)
    - Seed 2: `team_2fc663ed-4ebe-4c11-9355-cfd668ae6175` (UMA Bravo Test)
    - Seed 3: `team_121c62d8-7561-47a7-b9be-e793ef18390b` (UMA Charlie Test)
  - `APP_MATCH_IDS_BEFORE_RESTART`:
    - Round 1 Match 1: `match_7ad86104-4e61-4a74-81da-304230424aeb`
    - Round 2 Match 1: `match_053bbe70-4b9e-47d0-85fc-189665a779fa`
  - `ENGINE_MATCH_IDS_BEFORE_RESTART`:
    - Round 1 Match 1: `a381f6f3-c622-46b5-92d1-37cd284ba3f0`
    - Round 2 Match 1: `d8286ffe-3c13-487a-9108-5216ea86d29e`
  - `BYE_TEAM_ID_BEFORE_RESTART`:
    - `team_20276f3e-4683-4c77-ae55-a08727af023b` (advances to `d8286ffe-3c13-487a-9108-5216ea86d29e` in round 1)
  - `BRACKET_ENGINE_STATE_HASH`:
    - `842e724d56ec2302b7a839b0724f4a1ed12496c7cf3d3a883b5feb14a550745d`

### Phase I & J — Public Bracket UX & Invariants: **PASS**
- Executed `/uma bracket` in `#🤖・commands`:
  - Embed title: `🏆 UMA CUP — NHÁNH ĐẤU`
  - Overview: `Số đội: 3`, `Thể thức: Single Elimination`, `Tổng số vòng: 2`, `BYE: 1`
  - Round 1:
    - `M1 — UMA Bravo Test vs UMA Charlie Test`
    - `BYE 1 — UMA Alpha Test → Vòng 2`
  - Round 2:
    - `M1 — UMA Alpha Test vs Chờ xác định`
- Invariant & Privacy Verification:
  - Clean Vietnamese esports presentation.
  - Zero player UIDs, phone numbers, contact info, or internal DB keys leaked publicly.

### Phase K — Idempotency & Lifecycle Boundary Checks: **PASS**
1. Re-executed `/uma check-in` in `#🤖・commands`:
   - Rejected with: `⚠️ Check-in chưa mở hoặc đã khóa sau khi bốc thăm.`
2. Re-executed `/uma draw` in `#🎓・staff-chat`:
   - Rejected with: `⚠️ Nhánh đấu đã được bốc thăm hoặc giải đấu không ở giai đoạn check-in. Không thể bốc thăm lại.`
3. Re-executed `/uma checkin-open` in `#🎓・staff-chat`:
   - Rejected with: `⚠️ Giai đoạn check-in đã mở hoặc giải đấu đã tiến sang giai đoạn tiếp theo.`

### Phase L & M — Real Process Restart & Persistence: **PASS**
- Gracefully stopped bot daemon.
- Restarted via `node dist/index.js` using identical `.env` and `data/phase2a-e2e.sqlite`.
- Bot startup verified:
  ```text
  🚀 Initializing UMA Tournament Bot...
  Config loaded: Guild=1435984347814432801, DB=data/phase2a-e2e.sqlite
  📦 Database initialized and schema verified.
  🏆 Tournament "uma-phase2a-e2e-2026" ready (capacity: 3 teams).
  🏆 Restored 2 bracket matches without redraw.
  🤖 UMA Tournament Bot is online as UMA Smoke Test Bot#7415!
  ```
- Post-Restart Discord Command Verification:
  - `/uma bracket`: Matched pre-restart bracket embed exactly (2 rounds, 1 BYE, identical pairings).
  - `/uma status`: Showed `Giai đoạn: Đã bốc thăm nhánh đấu`, `Đã duyệt chính thức: 3 / 3 đội`, `Đã check-in: 3 đội`, `Nhánh đấu: Đã sẵn sàng`.
  - `/uma checkins`: Showed `Đã duyệt: 3 • Đã check-in: 3 • Chưa check-in: 0`.
- **Database Exact Match Verification:**
  - `SEED_MAPPING_AFTER_RESTART` == `SEED_MAPPING_BEFORE_RESTART` (100% exact match).
  - `APP_MATCH_IDS_AFTER_RESTART` == `APP_MATCH_IDS_BEFORE_RESTART` (100% exact match).
  - `ENGINE_MATCH_IDS_AFTER_RESTART` == `ENGINE_MATCH_IDS_BEFORE_RESTART` (100% exact match).
  - `BYE_TEAM_ID_AFTER_RESTART` == `BYE_TEAM_ID_BEFORE_RESTART` (100% exact match).
  - `BRACKET_ENGINE_STATE_HASH`: `842e724d56ec2302b7a839b0724f4a1ed12496c7cf3d3a883b5feb14a550745d` (100% exact match).

### Phase N — Safety & Production Integrity: **PASS**
- Zero messages sent to UMA production guild (`1435278955941986540`).
- Zero commands deployed to production guild.
- Zero global commands created.
- Zero production channels, roles, or configurations touched.
- 100% synthetic team data and isolated SQLite database used.

---

## 4. Discovered Limitations

1. **`AUTHORIZATION_SEPARATION_NOT_MANUALLY_VALIDATED`**:  
   Only one physical test Discord user account was available (`𝑷𝒉𝒖𝒄 𝑽𝒐 💙`, Server Owner / Administrator), which acted as both captain and BTC staff. Automated authorization separation (non-staff calling `/uma draw` or `/uma checkin-open`, non-captain calling `/uma check-in`) is comprehensively validated by unit tests in `tests/phase2a_checkin_bracket.test.ts`.

2. **`MULTI_CAPTAIN_DISCORD_CHECKIN_NOT_MANUALLY_VALIDATED`**:  
   Only Team A was checked in directly through the Discord client interface (`/uma check-in`); Team B and Team C were checked in via canonical domain fallback (`TournamentService.checkIn`) due to having only one physical Discord account for testing.

---

## 5. Newly Discovered Defects

**NONE.** The Phase 2A lock, check-in, cryptographic shuffle seeding, engine adapter integration, BYE path handling, restart restoration, and public Discord views executed without errors or regressions.

---

## 6. Cleanup & Evidence State

- Bot daemon stopped gracefully.
- Test evidence database `data/phase2a-e2e.sqlite` preserved locally for developer inspection.
- Environment files `.env.phase2a-e2e` and `.env` remain gitignored and uncommitted.
- All 95 Vitest automated tests continue to pass.

---

## 7. Final Verdict

**`PASS_WITH_LIMITATIONS`**

*Phase 2A lifecycle (registration lock, captain check-in, draw, single-elimination bracket with BYEs, process restart persistence) is fully operational in real Discord interaction.*
