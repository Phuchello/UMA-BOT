# Phase 1 Smoke-Test Defect Fix (PR #4)

The original [Phase 1 Discord E2E smoke-test report](PHASE1_DISCORD_SMOKE_TEST_REPORT.md) remains the historical record: Phase D **FAIL**, Phase E–L **BLOCKED**. No live Discord test was rerun for this fix.

| Defect | Root cause | Fix | Regression coverage |
|---|---|---|---|
| Registration modal fails to open | Five-line starters placeholder exceeds Discord TextInput's 100-character limit. | Use a compact two-line Vietnamese placeholder; keep the full five-line roster example in the guide embed. | `registration_ui_constraints.test.ts` constructs and serializes registration, edit, and reason modals, Phase 1 button rows, and relevant embeds. |
| `node dist/index.js` exits silently on Windows | Manual `file://` string concatenation does not match Windows `import.meta.url`. | Compare with Node's `pathToFileURL(argvEntry).href`. | `direct_execution.test.ts` covers matching, different, missing, relative, and URL-escaped paths. |

## Verification

- `npm ci` completed.
- `npm run typecheck` passed with zero errors.
- `npm test` passed: **78/78 tests across 9 suites** (69 existing + 9 new).
- `npm run build` passed.
- On Windows, the built `dist/index.js` was run from a clean temp working directory with required Discord settings removed. It entered bootstrap, exited with code 1 through configuration validation, and did not reach Discord login. The proof used no real token and made no Discord connection.
- No tournament engine, registration domain, or database schema logic changed.

The next live step requires human review and merge of PR #4, followed by a separately authorized Discord E2E re-test with the safety preflight repeated.
