# PHASE 1 DISCORD E2E SMOKE TEST REPORT

**Date/Time:** 2026-09-27T10:16:30+07:00  
**Main Commit Tested:** `2fe7c3c` (*Merge pull request #2 — explicit Discord resource IDs*)  
**Branch:** `bug/phase1-smoke-findings`  
**Verdict:** **FAIL**

---

## 1. Safety & Production Integrity Summary

| Parameter | Value | Status |
| :--- | :--- | :--- |
| **Known Production Guild ID** | `1435278955941986540` | Strictly Excluded |
| **Configured Test Guild ID** | `1435984347814432801` ("test") | Confirmed SAFE |
| **Test Bot Application ID** | `1553604832516898826` ("UMA Smoke Test Bot") | Dedicated Test App |
| **Active Tournament ID** | `uma-smoke-test-2026` | Isolated |
| **Database Path** | `data/smoke-test.sqlite` | Isolated Test DB |
| **Test BTC Channel ID** | `1435984350243061794` (`#🎓・staff-chat`) | Test Guild Only |
| **Test Registration Channel ID** | `1435984350020898892` (`#🤖・commands`) | Test Guild Only |
| **Test Staff Role IDs** | `1435984348192051265, 1435984348192051264` | Test Guild Only |
| **Production Server Touched** | **NONE** | 100% Verified |

---

## 2. Execution Log & Stage Results

### Phase A — Command Deployment: **PASS**
- Slash commands deployed strictly to test guild `1435984347814432801`.
- Verified via Discord REST API query (`Routes.applicationGuildCommands`).
- Registered command:
  - `/uma` with subcommands:
    - `panel`
    - `teams`
    - `my-team`
    - `status`
- Zero commands registered globally or in production guild.

### Phase B — Bot Startup: **PASS**
- Bot started against `.env.smoke` configuration.
- Log verified:
  ```text
  🚀 Initializing UMA Tournament Bot...
  Config loaded: Guild=1435984347814432801, DB=data/smoke-test.sqlite
  📦 Database initialized and schema verified.
  🏆 Tournament "uma-smoke-test-2026" ready (capacity: 3 teams).
  🤖 UMA Tournament Bot is online as UMA Smoke Test Bot#7415!
  ```
- Bot appeared online in test guild member list.

### Phase C — Registration Panel: **PASS**
- Executed `/uma panel` in test channel `#🤖・commands` (`1435984350020898892`).
- Message ID: `1553606102070075484`.
- Embed correctly rendered:
  - Tournament: `Liên Quân Mobile 5v5`
  - Active capacity breakdown: `Đã đăng ký: 0 / 3`, `Đã duyệt: 0`, `Chờ duyệt / chỉnh sửa: 0`, `Còn lại: 3 suất`
  - Buttons rendered:
    - `📝 Đăng ký đội`
    - `👥 Danh sách đội`
    - `📘 Hướng dẫn`

### Phase D — Team Registration Interaction: **FAIL (DEFECT DISCOVERED)**
- Clicked button `📝 Đăng ký đội` on panel `1553606102070075484`.
- Bot threw an uncaught builder constraint error:
  ```text
  Error handling interaction: ExpectedConstraintError > s.string().lengthLessThanOrEqual()
    Invalid string length

    Expected: expected.length <= 100

    Received:
    | 'Đúng 5 dòng, định dạng: [Tên Ingame | Game UID]\nVD:\nUMA_Captain | 100000001\nUMA_Mid | 100000002\nUMA_Adc | 100000003\nUMA_Sp | 100000004\nUMA_Jungle | 100000005'

      at Object.run (node_modules/@sapphire/shapeshift/dist/cjs/index.cjs:2422:79)
      at TextInputBuilder.setPlaceholder (node_modules/@discordjs/builders/dist/index.js:2131:51)
      at RegistrationUI.createRegistrationModal (src/bot/ui/RegistrationUI.ts:102:8)
      at RegistrationHandler.handleButton (src/bot/handlers/RegistrationHandler.js:38:56)
  ```
- Result: Discord client received `Đã xảy ra lỗi trong quá trình xử lý yêu cầu`, and the modal was never shown to the user.
- Root Cause: Discord API and `@discordjs/builders` strictly enforce `placeholder.length <= 100` for `TextInputComponent`. The placeholder in `RegistrationUI.ts` (lines 102–110) has a length of 165 characters.

### Phases E through L: **BLOCKED**
- Blocked by failure of Phase D modal display.

---

## 3. Discovered Defects & Evidence

### Defect 1 (CRITICAL — Blocks Registration Lifecycle): Modal Placeholder Length Exceeds Discord API Limit
- **File:** [`src/bot/ui/RegistrationUI.ts`](file:///C:/Users/lyle3/Music/Discord/UMA-BOT/src/bot/ui/RegistrationUI.ts#L102-L110)
- **Constraint:** Discord `TextInputComponent` placeholder string length must be `≤ 100`.
- **Current Code:**
  ```typescript
  const startersInput = new TextInputBuilder()
    .setCustomId('txt_starters')
    .setLabel('4. 5 Tuyển thủ chính (Tên | UID)')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder(
      'Đúng 5 dòng, định dạng: [Tên Ingame | Game UID]\n' +
      'VD:\n' +
      'UMA_Captain | 100000001\n' +
      'UMA_Mid | 100000002\n' +
      'UMA_Adc | 100000003\n' +
      'UMA_Sp | 100000004\n' +
      'UMA_Jungle | 100000005'
    ) // 165 characters -> FAILS WITH ExpectedConstraintError
    .setRequired(true);
  ```
- **Why Automated Tests Missed It:** Unit tests tested `RegistrationParser` and `TeamRepository` directly, but never constructed `RegistrationUI.createRegistrationModal()`.

### Defect 2 (OPERATIONAL — Windows ESM Entry Point Guard):
- **File:** [`src/index.ts`](file:///C:/Users/lyle3/Music/Discord/UMA-BOT/src/index.ts#L40)
- **Code:** `if (import.meta.url === \`file://${process.argv[1]}\`)`
- **Behavior:** On Windows, `import.meta.url` uses URI forward slashes (`file:///C:/...`), while `process.argv[1]` contains Windows backslashes (`C:\...`). Consequently, `node dist/index.js` exits silently without invoking `bootstrap()`. Cross-platform resolution via `fileURLToPath` is required.

---

## 4. Test Matrix & Progress Checklist

- [x] Baseline test verification (69/69 passing)
- [x] Dedicated test guild isolation verified (`1435984347814432801`)
- [x] Production server protection check passed (ID `1435278955941986540` never called)
- [x] Phase A: Slash command deployment to test guild (PASS)
- [x] Phase B: Bot process startup & gateway connection (PASS)
- [x] Phase C: `/uma panel` display & embed layout (PASS)
- [x] Phase D: Team registration button & modal display (**FAIL**)
- [ ] Phase E: First registration DB inspection (BLOCKED)
- [ ] Phase F: BTC correction request (BLOCKED)
- [ ] Phase G: Captain edits same team (BLOCKED)
- [ ] Phase H: Identity / atomicity check (BLOCKED)
- [ ] Phase I: BTC approval (BLOCKED)
- [ ] Phase J: Public/staff status validation (BLOCKED)
- [ ] Phase K: Persistence restart (BLOCKED)
- [ ] Phase L: Post-restart validation (BLOCKED)
- [x] Phase M: Safety & production integrity verification (PASS)

---

## 5. Cleanup Status
- Bot daemon terminated gracefully.
- Test database `data/smoke-test.sqlite` preserved locally for developer inspection.
- Untracked `.env.smoke` contains test credentials and remains gitignored.
- No code modifications performed in this run in accordance with testing rules.

---

## 6. Final Verdict

**FAIL**

*Investigation and bug fix required on branch `bug/phase1-smoke-findings` before re-running the Discord E2E smoke test.*
