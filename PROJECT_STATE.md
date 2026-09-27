# PROJECT STATE — UMA TOURNAMENT BOT

## Current Phase
Phase 1 E2E VALIDATED WITH LIMITATIONS / Awaiting Review

## PR #1–#4
- PR #1 MERGED into `main` with merge commit `30a21aa`.
- PR #2 MERGED into `main` with merge commit `2fe7c3c` (explicit Discord resource IDs).
- PR #3 MERGED into `main` with merge commit `2a81dc6` (historical smoke-test findings).
- PR #4 MERGED into `main` with merge commit `5e47f49` (fixed modal placeholder constraint and Windows direct entry).

## Discord E2E Smoke Retest (Phase 1)
- **Status:** PASS_WITH_LIMITATIONS
- **Report:** `docs/PHASE1_DISCORD_SMOKE_RETEST_REPORT.md`
- **Main Commit Tested:** `5e47f498091c59c855d94f03e7500b1b927a0126` (CI Run `36292054406`: `success`)
- **Automated Baseline:** 78 / 78 tests passing across 9 suites (Typecheck PASS, Build PASS)
- **Verified Lifecycle Stages:**
  - Phase A: Windows native entry point (`node dist/index.js`) — PASS
  - Phase B: Slash command registration check — PASS
  - Phase C: `/uma panel` display & embed counts (`0/3`, `3 remaining`) — PASS
  - Phase D: Registration modal regression (opened cleanly without constraint error) — PASS
  - Phase E: Team registration submission (`team_e170baac-1531-4cb7-af9f-00a17008ed93`, `PENDING`) — PASS
  - Phase F: BTC correction request (`PENDING` -> `NEEDS_CORRECTION`, buttons disabled) — PASS
  - Phase G: Captain inspection (`/uma my-team`) & edit modal resubmission (`NEEDS_CORRECTION` -> `PENDING`) — PASS
  - Phase H: Team identity preservation (team.id identical before/after, 1 active team, 0 orphans) — PASS
  - Phase I: BTC approval (`PENDING` -> `APPROVED`, review buttons disabled) — PASS
  - Phase J: Public `/uma teams`, `/uma status`, `/uma panel` validation — PASS
  - Phase K: Real process restart with persisted database (`data/smoke-retest.sqlite`) — PASS
  - Phase L: Post-restart persistence verification (`/uma my-team`, `/uma teams`, `/uma status`) — PASS
  - Phase M: Safety & production integrity (UMA production guild `1435278955941986540` untouched) — PASS
- **Limitations:**
  1. `AUTHORIZATION_SEPARATION_NOT_MANUALLY_VALIDATED`: Single Discord test account (`𝑷𝒉𝒖𝒄 𝑽𝒐 💙`, Server Owner / Administrator) acted as both captain and BTC staff. Automated authorization separation is verified in test suites.
  2. Direct Message delivery to captain was blocked by Discord user privacy settings; full lifecycle was verified in-channel via `/uma my-team` and BTC cards.

## Last Safe Checkpoint
Main commit `5e47f49` with 78/78 automated tests and live Discord E2E validation completed with `PASS_WITH_LIMITATIONS`.

## Exact Next Action
Await human review of Draft PR on branch `docs/phase1-e2e-retest`. Do not merge automatically. Do not start Phase 2 until reviewed.

## Branch
`docs/phase1-e2e-retest`

