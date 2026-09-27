# PHASE 1.6 PRE-MERGE REPORT — UMA TOURNAMENT BOT

**Branch:** `feat/phase0-phase1`  
**Draft PR:** [#1](https://github.com/Phuchello/UMA-BOT/pull/1)  
**Status:** AWAITING HUMAN REVIEW — Do NOT merge without approval.

---

## 1. Summary of Changes

Phase 1.6 is the final consistency patch before merging Phase 0 + Phase 1 into `main`.
All changes are **non-feature**: no new user-facing functionality, no bracket logic, no Phase 2 work.

---

## 2. Fix 1 — REJECTED/WITHDRAWN Re-Registration Semantics (CRITICAL)

### Problem
The database had three unconditional `UNIQUE INDEX` constraints:
- `UNIQUE INDEX idx_teams_tourney_name ON teams(tournament_id, name)`
- `UNIQUE INDEX idx_teams_tourney_abbr ON teams(tournament_id, abbreviation)`
- `UNIQUE INDEX idx_players_tourney_uid ON players(tournament_id, game_uid)`

These constraints applied to **all statuses**, including `REJECTED` and `WITHDRAWN`.
This meant that a team which was rejected permanently reserved its name, abbreviation,
and player UIDs — blocking any re-registration with the same identifiers.
This contradicted the intended domain model.

### Fix
- Removed all three `UNIQUE INDEX` declarations.
- Replaced with non-unique `INDEX` declarations for query performance only.
- Active-only uniqueness (`PENDING`, `APPROVED`, `NEEDS_CORRECTION`) is now enforced
  **transactionally** inside `BEGIN IMMEDIATE TRANSACTION` in `TeamRepository`:
  - `registerTeam()`: name/abbr check with `AND status IN ('PENDING', 'APPROVED', 'NEEDS_CORRECTION')`
  - `registerTeam()`: UID check already filtered by active status in Phase 1.5 (unchanged)
  - `resubmitCorrectedTeam()`: name/abbr check updated to also filter by active status

### Result
- `REJECTED` / `WITHDRAWN` rows are preserved for **audit trail** only.
- Their identifiers (name, tag, UIDs) are **freed** for new registrations.
- Historical records remain intact and distinct from new registrations.

> **NOTE FOR DEVELOPERS:** If you have a local `data/tournament.sqlite` created before
> Phase 1.6, you **MUST** delete it and let the bot recreate it. The old UNIQUE indexes
> cannot be retroactively dropped with `IF NOT EXISTS` guards alone.

---

## 3. Fix 2 — MAX_TEAMS Source of Truth

### Problem
`registerTeam()` called `ensureTournament(input.tournamentId, 'UMA Cup')` with a hardcoded
`maxTeams=16` default. This meant that if `config.MAX_TEAMS` was set to anything other than
`16`, the DB tournament row could be created with the wrong capacity on first registration,
causing `UI capacity != database capacity`.

### Fix
- `registerTeam()` **no longer calls** `ensureTournament()`.
- If the tournament doesn't exist, it returns `TOURNAMENT_NOT_FOUND` immediately.
- Tournament creation is now exclusively done at **bootstrap** in `src/index.ts`:
  ```typescript
  repo.ensureTournament(config.ACTIVE_TOURNAMENT_ID, config.TOURNAMENT_NAME, config.MAX_TEAMS);
  ```
- `TOURNAMENT_NAME` added to `env.ts` (`default: 'UMA Cup 2027'`) and `.env.example`.

### Result
- On initial creation, DB capacity takes `config.MAX_TEAMS`.
- After creation, SQLite `tournaments.max_teams` remains authoritative. Later `.env` edits do not silently change a live tournament.

---

## 4. Fix 3 — Registration Panel Capacity UX

### Problem
The `/uma panel` command passed only `approved.length` to `createRegistrationPanelEmbed()`,
so the panel showed `0 / 16` even when 14 teams were `PENDING`.
This was misleading to members browsing the panel.

### Fix
`createRegistrationPanelEmbed()` now accepts four parameters:

| Parameter | Description |
|-----------|-------------|
| `activeCount` | PENDING + APPROVED + NEEDS_CORRECTION |
| `approvedCount` | APPROVED only |
| `pendingOrCorrectionCount` | PENDING + NEEDS_CORRECTION |
| `maxTeams` | Persisted tournament capacity from SQLite |

Panel now renders:
```
📊 TÌNH HÌNH ĐĂNG KÝ:
• 👥 Đã đăng ký: 14 / 16
• ✅ Đã duyệt: 0
• ⏳ Chờ duyệt / chỉnh sửa: 14
• 🟢 Còn lại: 2 suất
```

---

## 5. Fix 4 — Single-Instance Concurrency Assumption Documentation

Added **Section 6** to `docs/ARCHITECTURE.md` documenting:
- UMA v1 runs as **ONE active bot process** against **ONE SQLite file**.
- `BEGIN IMMEDIATE TRANSACTION` serializes same-process writes — not multi-process.
- Migration path if multi-instance is ever needed (retry policy, `busyTimeout`, or Postgres).

---

## 6. Fix 5 — Clean PR #1 Body (Shell Escaping Artifacts)

PR #1 body was cleaned after the Phase 1.6 push. The merge checklist now records the verified CI result while leaving human review and Ready for Review unchecked.

---

## 7. Fix 6 — PROJECT_STATE Commit SHA Accuracy

Phase 1.6 was pushed as `3107dc6` (`fix: active-only uniqueness, max-teams bootstrap, panel ux, phase 1.6 tests`). See `PROJECT_STATE.md` for the full commit history.

---

## 8. Fix 7 — Database Index Audit

| Index | Type | Purpose |
|-------|------|---------|
| `idx_teams_tourney_name` | Non-unique | Name lookup / filtering |
| `idx_teams_tourney_abbr` | Non-unique | Abbreviation lookup / filtering |
| `idx_teams_tourney_captain` | Non-unique | Captain team lookups |
| `idx_players_tourney_uid` | Non-unique | UID lookup by tournament |

All uniqueness enforcement is transactional, not index-based.

---

## 9. Test Results

### Phase 1.6 New Tests (`tests/phase1_6_premerge.test.ts`)

| # | Test Case | Result |
|---|-----------|--------|
| 1 | Rejected team frees capacity slot | ✅ PASS |
| 2 | Same captain registers again after rejection | ✅ PASS |
| 3 | Former roster UIDs re-used after REJECTED | ✅ PASS |
| 4 | Same team name re-used after REJECTED | ✅ PASS |
| 5 | Same abbreviation re-used after REJECTED | ✅ PASS |
| 6a | Same team name re-used after WITHDRAWN | ✅ PASS |
| 6b | Same roster UIDs re-used after WITHDRAWN | ✅ PASS |
| 7 | Historical REJECTED row intact after re-registration | ✅ PASS |
| 8 | Active duplicate name is still rejected (PENDING) | ✅ PASS |
| 9 | Active duplicate abbreviation is still rejected (PENDING) | ✅ PASS |
| 10 | Active duplicate UID is still rejected (APPROVED) | ✅ PASS |
| 11 | MAX_TEAMS=3 → DB capacity=3, 4th registration fails | ✅ PASS |
| 12 | registerTeam fails with TOURNAMENT_NOT_FOUND | ✅ PASS |

### Full Test Suite

| File | Tests | Status |
|------|-------|--------|
| `phase0_tournament_engine.test.ts` | 4 | ✅ PASS |
| `tournament_organizer_adapter.test.ts` | 4 | ✅ PASS |
| `phase1_registration_approval.test.ts` | 19 | ✅ PASS |
| `phase1_5_hardening.test.ts` | 16 | ✅ PASS |
| `phase1_6_premerge.test.ts` | 13 | ✅ PASS |
| **TOTAL** | **56** | **✅ ALL PASS** |

### TypeScript / Build

- `npm run typecheck` — ✅ Zero errors
- `npm run build` — ✅ Compiled successfully

---

## 10. CI Verification

Phase 1.6 was pushed to `feat/phase0-phase1`. GitHub Actions run `36287888779` for commit `3107dc6` completed with conclusion `success`.

Phase 1.6.1 adds two runtime capacity tests. They verify config drift from 3 to 15 leaves the DB name and capacity unchanged; panel, status, and registration button display 3; the fourth registration is rejected; and missing tournaments produce a clear error.

---

## 11. Remaining Risks

| Risk | Severity | Notes |
|------|----------|-------|
| Dev DBs with old UNIQUE indexes | Low | Local only; must delete `data/tournament.sqlite` |
| `ensureTournament` preserves existing tournament configuration | Low | A new `ACTIVE_TOURNAMENT_ID` creates a separate row; existing rows remain |
| Multi-instance not supported | Low | Documented; out of scope for v1 |

---

## 12. Verdict

```
READY_TO_MERGE — pending:
  1. Human review and explicit PR approval
  2. PR #1 marked Ready for Review (not Draft) by maintainer
```

Do NOT merge automatically. Do NOT mark PR ready without human decision.
