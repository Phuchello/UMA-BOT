# PHASE 3B DISCORD E2E VALIDATION REPORT

**Date/Time:** 2026-09-27T23:15:00+07:00  
**Main Commit Tested:** `f3128d1d7ab4306a8433556c2bdea9b7a85660cc`  
**Main CI Run:** Run ID `36329144232` (Conclusion: `success`)  
**Automated Baseline:** 196 / 196 tests passing across 13 test suites (Typecheck PASS, Build PASS)  
**Branch:** `docs/phase3b-e2e`  
**Final Verdict:** **`PASS_WITH_LIMITATIONS`**

---

## 1. Safety & Production Guild Exclusion Confirmation

| Check | Expected | Actual | Status |
| :--- | :--- | :--- | :--- |
| **Production Guild Exclusion** | ID `1435278955941986540` strictly excluded | Zero network calls, zero references in config, zero occurrences in database | **CONFIRMED SAFE** |
| **Test Guild Verification** | Dedicated Test Guild | ID `1435984347814432801` ("test") | **CONFIRMED TEST GUILD** |
| **Test Bot Application** | Dedicated Test Bot | ID `1553604832516898826` ("UMA Smoke Test Bot#7415") | **CONFIRMED TEST BOT** |
| **Match Hub Channel** | Belong to test guild | `1553664980086161518` (`#🧪・phase2b-match-hub`) | **CONFIRMED TEST HUB** |
| **Results Channel** | Belong to test guild | `1435984350020898891` (`#🏆・kết-quả-giải-đấu`) | **CONFIRMED TEST CHANNEL** |
| **Commands Channel** | Belong to test guild | `1435984350020898892` (`#🤖・commands`) | **CONFIRMED TEST CHANNEL** |
| **Staff Channel** | Belong to test guild | `1435984350243061794` (`#🎓・staff-chat`) | **CONFIRMED TEST CHANNEL** |
| **Staff Roles** | Belong to test guild | `1435984348192051265, 1435984348192051264` | **CONFIRMED TEST ROLES** |
| **Tournament ID** | Isolated test tournament | `uma-phase3b-e2e-2026` (`max_teams = 2`) | **CONFIRMED ISOLATED** |
| **SQLite Database** | Isolated test DB | `data/phase3b-e2e.sqlite` | **CONFIRMED FRESH DB** |

---

## 2. Controlled Identity Strategy & Synthetic Evidence Artifacts

### Controlled Discord Identities
- **Staff / Referee / Captain A:** `994820818993418240` (Real human test account: `𝑷𝒉𝒖𝒄 𝑽𝒐 💙`, Server Owner / Administrator).
- **Captain B:** `1553604832516898826` (The UMA Smoke Test Bot app user, participating as opponent captain).

### Synthetic PNG Evidence Artifact
A dedicated synthetic PNG test artifact was generated locally using Node.js (`fs` + `zlib`) with manually constructed PNG chunks, then verified against PNG magic bytes (`89 50 4e 47 0d 0a 1a 0a`) before Discord upload:
- `data/e2e-phase3b-result.png` (510 bytes, RGBA PNG)

---

## 3. Test Fixture & Foundation Entities

- **Tournament:** `uma-phase3b-e2e-2026` (`UMA Phase 3B Discord E2E 2026`, capacity: 2)
- **Team A (Seed 1 / Team 1):** `team_de335067-1753-4b9b-9713-13f46a0771af` (`UMA Phase3B Bravo` [P3B], Captain: `1553604832516898826`)
- **Team B (Seed 2 / Team 2):** `team_f618c901-2315-42a8-9f66-34660d447950` (`UMA Phase3B Alpha` [P3A], Captain: `994820818993418240`)
- **Application Match ID:** `match_a3e50342-a031-40b8-ac83-8e5948f2f3e6`
- **Engine Match ID:** `2f81e717-a485-4617-96c9-737fab8fff72`
- **Private Thread ID:** `1553790942291562516` (`r1-m1-uma-phase3b-bravo-vs-uma-phase3b-alpha`)
- **Starter Message ID:** `1553790950437036145`
- **Assigned Referee:** `994820818993418240` (`𝑷𝒉𝒖𝒄 𝑽𝒐 💙`)
- **Scheduled Time:** `2026-09-27 23:00` (Asia/Ho_Chi_Minh)
- **Match Start Time:** `1790523229536` (`LIVE`)
- **Initial Bracket Version:** `1`
- **Initial Engine Hash:** `e0e91645bfd8261c354a39b2417d58cd4b5c66f66b3565a9b681adcd5a90985c`

---

## 4. Execution Log & Observed Results

| Step | Area | Action | Observed Result | Verdict |
| :--- | :--- | :--- | :--- | :--- |
| **0** | Baseline | Automated test & build check | 196 / 196 tests passing across 13 suites; `tsc --noEmit` and `tsc` PASS cleanly. | **PASS** |
| **1** | Environment | Fresh test environment setup | `.env.phase3b-e2e` copied to `.env` targeting `ACTIVE_TOURNAMENT_ID=uma-phase3b-e2e-2026`, `DATABASE_PATH=data/phase3b-e2e.sqlite`, `MAX_TEAMS=2`. | **PASS** |
| **2** | Commands | Slash command deployment | Verified exactly 2 root guild commands on `1435984347814432801`: `/uma` (25 subcommands) and `/uma-caster` (2 subcommands: `add`, `remove`). Discord 25-option ceiling respected. | **PASS** |
| **3** | Fixture | Tournament & match setup | Built 2-team fixture, scheduled match for `2026-09-27 23:00`, both captains confirmed ready, started match via Discord button click `▶️ Bắt đầu trận` $\to$ status `LIVE`. | **PASS** |
| **4** | Pre-State | Invariant verification | Bracket version = 1, engine hash = `e0e91645...`, 0 results, 0 submissions. | **PASS** |
| **5** | Stream | Livestream metadata | Staff executed `/uma stream-set url:https://youtu.be/dQw4w9WgXcQ title:"UMA Phase 3B E2E Stream"` in thread. Stream stored. Public `/uma stream round:1 match:1` showed teams, LIVE, schedule, stream URL, caster none. Compact stream marker rendered in `/uma matches`. | **PASS** |
| **6** | Caster | Caster assignment & idempotency | Staff ran `/uma-caster add round:1 match:1 caster:@𝑷𝒉𝒖𝒄 𝑽𝒐 💙`. Caster assigned and rendered in embed without raw user ping. Repeated add rejected with `Caster đã được gán trước đó.` Ran `/uma-caster remove` $\to$ `Đã gỡ caster.` Re-added caster for persistent state. | **PASS** |
| **7** | Result | Report, confirm, and approve | Captain A executed `/uma report-result my-score:2 opponent-score:0` with attached PNG (`510` bytes). Evidence archived (`submission_aeb7a2fc...`, Msg `1553794819191603212`, Attachment `1553794819279556648`). Opponent confirmation via domain fallback for Captain B. Referee clicked `✅ Duyệt kết quả` $\to$ approved, `match_results` created (`0-2` Alpha wins), match `COMPLETED`, tournament `completed`, champion Alpha, runner-up Bravo. Bracket version $1 \to 2$, hash mutated to `dfe1a89a...`. | **PASS** |
| **8** | Publish | Initial public synchronization | Staff ran `/uma publish-sync` in Discord $\to$ `created = 2, updated = 0, unchanged = 0, failed = 0`. Results channel received Result card `1553795350182109265` (Bravo 0 — 2 Alpha, winner Alpha, stream link) and Champion ceremony card `1553795351943581717`. Zero private data leaked. | **PASS** |
| **9** | Idempotency | Publication idempotency | Repeated `/uma publish-sync` immediately $\to$ `created = 0, updated = 0, unchanged = 2, failed = 0`. Identical message IDs preserved, zero duplicate messages. | **PASS** |
| **10** | History | Result history before correction | Staff ran `/uma result-history round:1 match:1` $\to$ Ephemeral output: `Kết quả gốc: 0–2`, `Hiện tại: 0–2 • revision 1`, no correction rows. | **PASS** |
| **11** | Correction | Guarded approved-result correction | Staff ran `/uma result-correct round:1 match:1 team1-score:2 team2-score:1 reason:"Kết quả E2E chính thức được BTC hiệu chỉnh sau đối chiếu." confirm:true`. Canonical result mutated to Bravo 2–1 Alpha. Revision incremented `1 → 2`. Winner mutated to Bravo, loser to Alpha. Champion mutated to Bravo, runner-up to Alpha. Bracket version incremented $2 \to 3$ (exactly one increment). Engine hash mutated to `c06ea6bc...`. Original submission and evidence preserved. | **PASS** |
| **12** | Private UI | Evidence card after correction | Thread evidence card updated: displays official score `2-1`, winner `UMA Phase3B Bravo`, and marker `BTC đã cập nhật kết quả chính thức • Revision 2`. Attachment image preserved, 0 buttons. | **PASS** |
| **13** | History | Result history after correction | Staff ran `/uma result-history round:1 match:1` $\to$ Ephemeral output: `Kết quả gốc: 0–2`, `#1: 0–2 → 2–1 • Kết quả E2E chính thức... • BTC 994820818993418240`, `Hiện tại: 2–1 • revision 2`. | **PASS** |
| **14** | Publish | Publication update after correction | Staff ran `/uma publish-sync` $\to$ `created = 0, updated = 2, unchanged = 0, failed = 0`. In-place edits on identical message IDs: Result card `1553795350182109265` updated to `Bravo 2 — 1 Alpha` with footer `Hiệu chỉnh #1`; Champion card `1553795351943581717` updated to Champion Bravo, Runner-up Alpha, score 2-1. Zero duplicates. | **PASS** |
| **15** | Recovery | Deleted message single replacement | Manually deleted Result message `1553795350182109265` via REST API. Ran `/uma publish-sync` $\to$ `created = 1, unchanged = 1, updated = 0, failed = 0`. New Result message ID `1553797319458160681` created; Champion message ID untouched (`1553795351943581717`). Subsequent `/uma publish-sync` $\to$ `created = 0, updated = 0, unchanged = 2, failed = 0`. | **PASS** |
| **16** | VOD Refresh | Stream URL update & sync | Staff ran `/uma stream-set url:https://youtu.be/dQw4w9WgXcQ?t=10 title:"UMA Phase 3B E2E VOD"`. Ran `/uma publish-sync` $\to$ `created = 0, updated = 1, unchanged = 1, failed = 0`. Content hash updated, canonical revision and bracket version untouched. | **PASS** |
| **17** | Clear | Stream clear & sync | Staff ran `/uma stream-clear round:1 match:1` $\to$ `Đã xóa liên kết livestream/VOD; caster vẫn được giữ.` Ran `/uma stream` $\to$ `Livestream / VOD: Chưa có`, `Caster: @𝑷𝒉𝒖𝒄 𝑽𝒐 💙`. Ran `/uma publish-sync` $\to$ `created = 0, updated = 1, unchanged = 1, failed = 0` (result card edited in-place to remove VOD link). | **PASS** |
| **18** | Doctor | Operational readiness check | Staff ran `/uma doctor` → 16 readiness entries returned: 15 PASS (system, SQLite `quick_check`, bracket restore, match status, results, publication, streams/casters, guild, 5 channels, 2 staff roles) and 1 expected WARN (`BOT_HAS_ADMINISTRATOR_IN_TEST_GUILD`). | **PASS** |
| **19** | Restart | Cold process restart | Captured pre-restart DB snapshot (20 tables). Stopped daemon. Cold restarted `node dist/index.js` $\to$ logged `Restored 1 bracket matches without redraw.` Verified 100% exact equality across all 20 tables (0 diffs). Ran `/uma doctor` $\to$ all PASS + 1 expected WARN. | **PASS** |
| **20** | Post-Restart | Post-restart publication sync | Ran `/uma publish-sync` $\to$ `created = 0, updated = 0, unchanged = 2, failed = 0`. Zero duplicates, zero state churn. | **PASS** |
| **21** | Backup | SQLite snapshot & overwrite refusal | Ran `node dist/operations/backup.js data/backups/phase3b-e2e-backup.sqlite` $\to$ backup created. Verified `PRAGMA quick_check = ok` and 27 tables present. Tested overwrite refusal: re-running with same destination threw `Backup destination already exists.` with exit code 1. | **PASS** |
| **22** | Privacy | Information boundary audit | Inspected all public cards in `#🏆・kết-quả-giải-đấu` (`1435984350020898891`). Zero thread IDs, attachment IDs, game UIDs, contact details, UUIDs, or user pings leaked. | **PASS** |
| **23** | Isolation | Production guild exclusion audit | Confirmed Production Guild `1435278955941986540` was 100% untouched in code, configuration, database, and network activity. | **PASS** |

---

## 5. Pre/Post Cold Restart Exact State Comparisons

Exact state equality was captured across all 20 active relational tables immediately before and after cold process termination and reboot:

| Table | Pre-Restart Rows | Post-Restart Rows | State Equality Verdict |
| :--- | :--- | :--- | :--- |
| `tournaments` | 1 | 1 | **EXACT MATCH** |
| `teams` | 2 | 2 | **EXACT MATCH** |
| `players` | 10 | 10 | **EXACT MATCH** |
| `team_checkins` | 2 | 2 | **EXACT MATCH** |
| `tournament_brackets` | 1 | 1 | **EXACT MATCH** |
| `tournament_matches` | 1 | 1 | **EXACT MATCH** |
| `match_rooms` | 1 | 1 | **EXACT MATCH** |
| `match_referee_assignments` | 1 | 1 | **EXACT MATCH** |
| `match_schedules` | 1 | 1 | **EXACT MATCH** |
| `match_ready_confirmations` | 2 | 2 | **EXACT MATCH** |
| `match_starts` | 1 | 1 | **EXACT MATCH** |
| `match_result_submissions` | 1 | 1 | **EXACT MATCH** |
| `result_evidence` | 1 | 1 | **EXACT MATCH** |
| `match_results` | 1 | 1 | **EXACT MATCH** |
| `tournament_outcomes` | 1 | 1 | **EXACT MATCH** |
| `match_result_corrections` | 1 | 1 | **EXACT MATCH** |
| `public_result_messages` | 1 | 1 | **EXACT MATCH** |
| `public_champion_messages` | 1 | 1 | **EXACT MATCH** |
| `match_streams` | 0 | 0 | **EXACT MATCH** |
| `match_casters` | 1 | 1 | **EXACT MATCH** |

### Key Entities Exact Comparison

| Field | Pre-Restart Value | Post-Restart Value | Comparison |
| :--- | :--- | :--- | :--- |
| `TOURNAMENT_STATUS` | `completed` | `completed` | **EXACT MATCH** |
| `MATCH_STATUS` | `COMPLETED` | `COMPLETED` | **EXACT MATCH** |
| `APP_MATCH_ID` | `match_a3e50342-a031-40b8-ac83-8e5948f2f3e6` | `match_a3e50342-a031-40b8-ac83-8e5948f2f3e6` | **EXACT MATCH** |
| `ENGINE_MATCH_ID` | `2f81e717-a485-4617-96c9-737fab8fff72` | `2f81e717-a485-4617-96c9-737fab8fff72` | **EXACT MATCH** |
| `THREAD_ID` | `1553790942291562516` | `1553790942291562516` | **EXACT MATCH** |
| `STARTER_MESSAGE_ID` | `1553790950437036145` | `1553790950437036145` | **EXACT MATCH** |
| `CANONICAL_REVISION` | `2` | `2` | **EXACT MATCH** |
| `OFFICIAL_SCORE` | `2–1` (Bravo wins 2-1) | `2–1` (Bravo wins 2-1) | **EXACT MATCH** |
| `CHAMPION_TEAM_ID` | `team_de335067-1753-4b9b-9713-13f46a0771af` (`Bravo`) | `team_de335067-1753-4b9b-9713-13f46a0771af` (`Bravo`) | **EXACT MATCH** |
| `RUNNER_UP_TEAM_ID` | `team_f618c901-2315-42a8-9f66-34660d447950` (`Alpha`) | `team_f618c901-2315-42a8-9f66-34660d447950` (`Alpha`) | **EXACT MATCH** |
| `CORRECTION_COUNT` | `1` row | `1` row | **EXACT MATCH** |
| `PUBLIC_RESULT_MSG_ID` | `1553797319458160681` | `1553797319458160681` | **EXACT MATCH** |
| `PUBLIC_CHAMPION_MSG_ID`| `1553795351943581717` | `1553795351943581717` | **EXACT MATCH** |
| `BRACKET_VERSION` | `3` | `3` | **EXACT MATCH** |
| `ENGINE_HASH` | `c06ea6bc893951da07b77957240e0321537d289ca2f4d550839d43826011ead7` | `c06ea6bc893951da07b77957240e0321537d289ca2f4d550839d43826011ead7` | **EXACT MATCH** |

---

## 6. Documented Limitations

1. **`AUTHORIZATION_SEPARATION_NOT_MANUALLY_VALIDATED`**:  
   Due to the single human Discord test account (`994820818993418240`, `𝑷𝒉𝒖𝒄 𝑽𝒐 💙`, Server Owner / Administrator), the same user acted as Captain A, Staff administrator, and assigned Referee. Rejection of unauthorized actions (e.g. non-staff executing `/uma result-correct`, `/uma publish-sync`, `/uma stream-set`, `/uma-caster add`) is strictly enforced in the domain and thoroughly validated in the automated test suite (`tests/phase3b_operations.test.ts`).

2. **`SECOND_CAPTAIN_RESULT_INTERACTION_NOT_MANUALLY_VALIDATED`**:  
   Captain B was assigned to the test bot user identity (`1553604832516898826`). Opponent confirmation for Captain B during the result phase was executed via canonical domain fallback (`ResultService.confirm`) rather than physical Discord UI button clicks. The resulting Discord state changes were subsequently rendered and validated live via the bot's `/uma result-refresh` command.

3. **`DOWNSTREAM_LOCK_RECONCILIATION_NOT_LIVE_DISCORD_VALIDATED`**:  
   Live Discord E2E was executed on a 2-team final single-elimination tournament fixture. Downstream match lock reconciliation (`CORRECTION_LOCKED` error when downstream matches have progressed to `SCHEDULED`, `READY_TO_START`, `LIVE`, or `COMPLETED`) is rigorously covered and verified in the automated test suite (`tests/phase3b_operations.test.ts`).

4. **`BOT_HAS_ADMINISTRATOR_IN_TEST_GUILD`**:  
   In the test guild (`1435984347814432801`), the test bot has been granted the `Administrator` permission for convenience during smoke testing. `/uma doctor` correctly surfaced a warning (`WARN Administrator: Bot có Administrator; nên dùng quyền tối thiểu.`). For production deployment, explicit granular channel permissions must be configured in accordance with `docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md`.

---

## 7. Conclusion

Phase 3B Discord E2E validation successfully completed all 24 verification stages across public result synchronization, champion ceremony, livestream/VOD management, caster assignment, guarded result correction, recovery from deleted messages, process restart persistence, operational readiness checking, and SQLite backup operations.

- Production Guild `1435278955941986540` was **100% untouched**.
- Zero source code modifications in `src/*` or `tests/*` were made during validation.
- All 196 automated tests remain passing across 13 suites.
- Database persistence across process restarts achieved **100% exact state equality across all 20 relational tables**.
- The dependency license gate remains active: **`LICENSE_REVIEW_REQUIRED`**.
- Phase 3B Discord E2E is formally rated: **`PASS_WITH_LIMITATIONS`**.
