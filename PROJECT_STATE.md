# PROJECT STATE — UMA TOURNAMENT BOT

## Current Phase
Phase 1 E2E FAILED / Investigation Required

## PR #1 & PR #2
- PR #1 MERGED into `main` with merge commit `30a21aa`.
- PR #2 MERGED into `main` with merge commit `2fe7c3c` (explicit Discord resource IDs).

## Discord E2E Smoke Test (Phase 1)
- **Status:** FAILED at Phase D (Team Registration interaction)
- **Report:** `docs/PHASE1_DISCORD_SMOKE_TEST_REPORT.md`
- **Defects Discovered:**
  1. `RegistrationUI.createRegistrationModal`: `startersInput` placeholder length is 165 chars, violating Discord's `placeholder <= 100` API constraint and throwing `ExpectedConstraintError`.
  2. `src/index.ts`: `import.meta.url === \`file://${process.argv[1]}\`` fails on Windows due to slash/backslash mismatch.
- **Safety Boundary:** 100% verified. Zero requests or mutations reached UMA production server (`1435278955941986540`). All tests executed on isolated test guild (`1435984347814432801`) and test DB (`data/smoke-test.sqlite`).

## Last Safe Checkpoint
Merge commit `2fe7c3c` on `main`. 69/69 automated tests pass. E2E smoke test identified 1 critical Discord API limitation defect and 1 Windows ESM entry point defect.

## Exact Next Action
Review smoke test findings on branch `bug/phase1-smoke-findings`. Create PR to patch `RegistrationUI.ts` placeholder constraint (with unit test) and cross-platform entry point in `src/index.ts`. Re-run E2E smoke test after fixes are approved.

## Branch
`bug/phase1-smoke-findings`

