# PROJECT STATE — UMA TOURNAMENT BOT

## Current Phase
Phase 1 E2E FAILED / Fix PR Pending

## PR #1–#3
- PR #1 MERGED into `main` with merge commit `30a21aa`.
- PR #2 MERGED into `main` with merge commit `2fe7c3c` (explicit Discord resource IDs).
- PR #3 MERGED into `main` with merge commit `2a81dc6` (historical smoke-test findings).

## Discord E2E Smoke Test (Phase 1)
- **Status:** FAILED at Phase D (Team Registration interaction)
- **Report:** `docs/PHASE1_DISCORD_SMOKE_TEST_REPORT.md`
- **Defects Discovered:**
  1. `RegistrationUI.createRegistrationModal`: `startersInput` placeholder length is 165 chars, violating Discord's `placeholder <= 100` API constraint and throwing `ExpectedConstraintError`.
  2. `src/index.ts`: `import.meta.url === \`file://${process.argv[1]}\`` fails on Windows due to slash/backslash mismatch.
- **Safety Boundary:** 100% verified. Zero requests or mutations reached UMA production server (`1435278955941986540`). All tests executed on isolated test guild (`1435984347814432801`) and test DB (`data/smoke-test.sqlite`).

## Smoke-Test Defect Remediation (PR #4 Pending)
- Registration modal starters placeholder shortened to satisfy Discord builder constraints; the full five-line example remains in the guide embed.
- Windows ESM direct-entry guard now compares `import.meta.url` with `pathToFileURL(process.argv[1]).href`.
- Nine new regression tests serialize real Phase 1 Discord builders and cover direct-entry matching; 78/78 automated tests pass across 9 suites, with typecheck and build clean.
- Windows non-network proof: built `dist/index.js` invoked bootstrap and failed configuration validation with exit code 1 before Discord login.
- Live Discord E2E was **not** rerun. The historical Phase D FAIL and Phase E–L BLOCKED verdict remain in the smoke report.

## Last Safe Checkpoint
Merge commit `2a81dc6` on `main` remains the last live-tested baseline (69/69 automated tests). PR #4 branch fixes both known defects with 78/78 automated tests; Discord re-test is still required.

## Exact Next Action
Review and merge PR #4, then rerun Phase 1 Discord E2E from the previously failed registration interaction while re-validating the earlier safety preflight. Do not start Phase 2.

## Branch
`fix/phase1-smoke-defects`

