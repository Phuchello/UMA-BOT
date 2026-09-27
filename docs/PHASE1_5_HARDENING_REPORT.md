# PHASE 1.5 HARDENING REPORT — UMA TOURNAMENT BOT

## 1. Executive Summary

Phase 1.5 addresses critical architectural, lifecycle, documentation, and continuous integration gaps discovered during independent review of Phase 1. No feature creep or Phase 2 mechanics were introduced.

All 43 tests across 4 suites passed successfully (100% pass rate). Zero TypeScript errors exist across typechecking and compilation.

---

## 2. Issues Found & Corrective Actions Applied

| # | Discovered Gap | Impact | Corrective Action | Status |
| :--- | :--- | :--- | :--- | :--- |
| **1** | Coupling of `DISCORD_GUILD_ID` with tournament identity | Prevented multiple tournaments (e.g. 2027 vs 2028) in the same server without UID/name collisions | Introduced `ACTIVE_TOURNAMENT_ID` config; updated repository, handlers, and commands | ✅ FIXED |
| **2** | Incomplete correction lifecycle (`DRAFT` state without captain edit workflow) | Captains could not edit and resubmit corrected rosters for their existing team | Implemented `NEEDS_CORRECTION` status, `/uma my-team` command, edit modal, and atomic player replacement | ✅ FIXED |
| **3** | Unenforced tournament capacity in repository | Allowed registrations beyond `max_teams` limit | Added atomic transactional capacity check (`activeCount >= maxTeams`) rejecting with `REGISTRATION_FULL` | ✅ FIXED |
| **4** | Documentation mismatch regarding captain uniqueness | Docs claimed DB unique index on `(tournament_id, captain_id)`, which would block legitimate re-registration after rejection | Documented and verified transactional domain-level enforcement for active teams | ✅ FIXED |
| **5** | Unsupported claims in documentation ("100% test coverage", "continuous integration" before CI existed) | Inaccurate reporting of project maturity | Replaced coverage claims with exact test pass counts (43/43 passing) and implemented real CI | ✅ FIXED |
| **6** | Missing GitHub Actions CI | PRs and commits lacked automated build/test verification | Created `.github/workflows/ci.yml` running typecheck, vitest, and build on Node 22 | ✅ FIXED |
| **7** | Live guide embed advertised future Phase 2 features as active | Misled users into expecting automatic check-in and private match rooms | Rewrote guide embed to describe only verified Phase 1 actions; noted Phase 2 additions | ✅ FIXED |
| **8** | Stale commit checkpoint in `PROJECT_STATE.md` | Listed `Checkpoint pending` for commit `b41cd3f` | Updated commit history with verified SHAs | ✅ FIXED |
| **9** | Misleading legal assertions regarding GPL adapter | Implied adapter legally neutralized copyleft obligations without legal counsel | Rephrased adapter as an architectural decoupling boundary providing replacement flexibility | ✅ FIXED |
| **10** | Inconsistent Node.js runtime specifications | `node:sqlite` requires Node 22+, but some docs mentioned Node 20 | Unified runtime baseline to Node.js 22+ (tested on Node 22 and 24) across package.json, README, and CI | ✅ FIXED |

---

## 3. Tournament ID Separation

- **Configuration:** Added `ACTIVE_TOURNAMENT_ID` (default: `uma-cup-2027`) to `src/config/env.ts` and `.env.example`.
- **Architectural Scope:** `DISCORD_GUILD_ID` is restricted to Discord API operations (guild lookup, slash command deployment). All tournament operations (`registerTeam`, `listTeams`, `ensureTournament`, `status`, `panel`) operate on `ACTIVE_TOURNAMENT_ID`.
- **Verification:** Tested that two distinct tournaments (`uma-cup-2027` and `uma-cup-2028`) run concurrently on the same server without team name, tag, or player UID collisions.

---

## 4. Correction Lifecycle

- **State Transition:** `PENDING` -> `NEEDS_CORRECTION` -> Captain edit -> `PENDING`.
- **BTC Card:** When correction is requested, the review card in `#🎛️・ban-tổ-chức` updates to `✏️ ĐANG CHỜ ĐỘI CHỈNH SỬA` with reason notes and disabled buttons (`non-actionable`).
- **Captain UX:**
  - Captain runs `/uma my-team` to view their team status and the BTC reason.
  - Clicks `[✏️ Chỉnh sửa đơn]` to open the edit modal pre-filled with existing data.
- **Atomic Roster Update (`TeamRepository.resubmitCorrectedTeam`):**
  - Executed within `BEGIN IMMEDIATE TRANSACTION`.
  - Validates team ownership (`captain_discord_id`).
  - Validates status is `NEEDS_CORRECTION`.
  - Enforces 5 starters, max 2 substitutes, no duplicate UIDs across active teams.
  - Deletes previous player rows and inserts new player records.
  - Resets status to `PENDING` and clears `rejection_reason`.
  - Appends audit log `RESUBMIT_CORRECTION`.
  - Preserves original `team.id`.
  - Updates existing BTC review message in `#🎛️・ban-tổ-chức` with active buttons enabled.

---

## 5. Capacity Enforcement Strategy

- **Capacity Invariant:** Total active teams consuming tournament slots cannot exceed `tournaments.max_teams`.
- **Active Statuses:** `PENDING`, `APPROVED`, `NEEDS_CORRECTION` consume capacity.
- **Non-consuming Statuses:** `REJECTED`, `WITHDRAWN`, `DRAFT`.
- **Implementation:** Inside `registerTeam` transaction:
  ```sql
  SELECT COUNT(*) as count FROM teams 
  WHERE tournament_id = ? AND status IN ('PENDING', 'APPROVED', 'NEEDS_CORRECTION')
  ```
  If `count >= max_teams`, transaction rolls back and returns `REGISTRATION_FULL` (`"Giải đấu đã đủ số lượng đội đăng ký."`).
- **Slot Reclamation:** If an active team withdraws (`withdrawTeam`) or is rejected (`rejectTeam`), active count decreases and frees a slot for new registrations.

---

## 6. Captain Uniqueness Enforcement Strategy

- **Domain Rule:** A Discord user may serve as captain for at most one **active** team (`PENDING`, `APPROVED`, `NEEDS_CORRECTION`) per tournament.
- **Decision on DB Constraint vs Domain Check:** Rather than placing a static `UNIQUE(tournament_id, captain_id)` table constraint (which would permanently lock out captains whose teams were rejected or withdrawn), captain uniqueness is enforced transactionally at the application/domain layer:
  ```sql
  SELECT id, name FROM teams 
  WHERE tournament_id = ? AND captain_discord_id = ? AND status IN ('PENDING', 'APPROVED', 'NEEDS_CORRECTION')
  ```
- **Benefit:** If Team A is rejected or withdrawn, the captain is immediately permitted to register a new team without database constraint violation.

---

## 7. Idempotency vs Concurrency Semantics

- **Idempotency Tests:** Verifies that repeated sequential deliveries of the same action (e.g. clicking "Approve" twice, or resubmitting twice) reject the second call safely (`ALREADY_PROCESSED` or `INVALID_STATUS`) without duplicate database records or multiple audit log entries.
- **Concurrency & Race Conditions:** In Node.js with native `node:sqlite` (`DatabaseSync`), database execution is synchronous within the process. Transactions using `BEGIN IMMEDIATE TRANSACTION;` obtain the write lock immediately, ensuring that overlapping attempts (such as two captains competing for the 16th slot) are serialized at the SQLite write boundary. Only the first transaction acquires the slot; the second evaluates capacity and rolls back with `REGISTRATION_FULL`.

---

## 8. GitHub Actions CI Setup

- **Workflow File:** `.github/workflows/ci.yml`
- **Trigger Events:**
  - `push` to `main` and `feat/**`
  - `pull_request` targeting `main`
- **Environment:** Ubuntu Linux, Node.js 22.x
- **Pipeline Steps:**
  1. `npm ci`
  2. `npm run typecheck`
  3. `npm test` (`vitest run` with `NODE_ENV=test` and `CI=true`)
  4. `npm run build` (`tsc`)
- **Security:** Zero Discord credentials or production secrets required. Tests remain 100% hermetic and isolated.

---

## 9. Final Test Suite Results

```
 RUN  v3.2.7 C:/Users/lyle3/Music/Discord/UMA-BOT

 ✓ tests/phase0_tournament_engine.test.ts (4 tests) 10ms
 ✓ tests/tournament_organizer_adapter.test.ts (4 tests) 10ms
 ✓ tests/phase1_registration_approval.test.ts (19 tests) 94ms
 ✓ tests/phase1_5_hardening.test.ts (16 tests) 26ms

 Test Files  4 passed (4)
      Tests  43 passed (43)
   Duration  1.11s
```

- **Typecheck Status:** 0 errors (`npm run typecheck`)
- **Build Status:** 0 errors (`npm run build`)

---

## 10. Documentation & License Corrections

1. **Accuracy of Claims:** Removed all claims of "100% test coverage" and replaced with exact test metrics: **43/43 tests passing (100% pass rate)**.
2. **License Language:** Rephrased `TournamentOrganizerAdapter` as an **architectural decoupling boundary** and **dependency boundary** providing replacement flexibility. Removed any text implying legal neutralization of GPL copyleft obligations.
3. **Runtime Baseline:** Aligned Node.js requirement to **Node.js 22+** across `package.json` (`engines`), `README.md`, `ARCHITECTURE.md`, and `.github/workflows/ci.yml`.

---

## 11. Remaining Phase 1 Risks

- **Third-Party Package License:** `tournament-pairings` remains GPL-3.0-or-later. If UMA Club later mandates an MIT-only distribution, `TournamentOrganizerAdapter` must be replaced with an independent pairing algorithm before public release.
- **Discord API Rate Limits:** Production deployment must respect Discord REST rate limits when multiple teams register rapidly.

---

## 12. Merge Readiness Verdict

**Verdict:** `READY_TO_MERGE` (Pending User Review & Manual Approval)

**Factual Justification:**
1. All 10 discovered Phase 1 issues have been resolved and verified.
2. All 43 automated tests pass cleanly across 4 test suites.
3. TypeScript typechecking and compilation complete with zero errors.
4. GitHub Actions CI workflow is configured and ready.
5. All working Phase 0 and Phase 1 behaviors have been preserved.
6. The PR remains in Draft status awaiting human review.
