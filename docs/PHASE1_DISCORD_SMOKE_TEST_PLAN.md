# Phase 1 Discord Smoke Test Plan

**Status:** Prepared, not executed. Separate human approval is required before connecting a bot to Discord or running these steps.

## Controlled test setup

- Use a dedicated, non-production Discord guild and test bot application. Use one fake captain account and one authorized test BTC account. Confirm the bot is absent from the UMA production guild.
- Configure every guild, channel, and staff role ID for the test guild. Do not rely on the production-looking defaults in `.env.example`. Keep the bot token in an untracked local environment file or secret store; never print, share, or commit it.
- Use a new `ACTIVE_TOURNAMENT_ID` and a separate, clearly identified SQLite file used only for this smoke test. Keep that same file for the restart check. Record its exact path and a baseline inventory before starting; never point the test at production or historical tournament data.
- Use `MAX_TEAMS=3` so panel and status counts are easy to verify. Do not edit live tournament capacity during the test. Record the test guild ID, bot application ID, tournament ID, and database path without recording the token.
- Do not alter production permissions or channels, TempVoice, Tourney Bot, or any Phase 2 feature. Do not use `@everyone` or `@here`. Stop immediately if any configured ID points to production or if the database is not isolated.

## Fake registration data

| Field | Test value |
|---|---|
| Team | `UMA Smoke Test` |
| Tag | `SMK` |
| Captain contact | `TEST-CONTACT` |
| Starters | `SMK_Top \| TEST_UID_001`<br>`SMK_Jungle \| TEST_UID_002`<br>`SMK_Mid \| TEST_UID_003`<br>`SMK_AD \| TEST_UID_004`<br>`SMK_Support \| TEST_UID_005` |
| Optional substitute | `SMK_Sub \| TEST_UID_006` |

Use these literal fake values in the registration modal. Do not enter real names, student phone numbers, Zalo numbers, or game UIDs.

## Execution checklist for a separately approved run

| # | Action | Expected observation / evidence |
|---:|---|---|
| 1 | Start the bot with the isolated test configuration. | Bot logs in to the test guild only; startup reports the test tournament and persisted capacity of 3. Capture a sanitized startup result, never the token or `.env`. |
| 2 | Register guild slash commands for the test application and guild. | `/uma` commands appear in the test guild. Command registration must target the test guild ID. |
| 3 | As test BTC staff, run `/uma panel` in the chosen test channel. | Command succeeds and posts a panel in that channel. Record its message ID. |
| 4 | Inspect the registration panel. | It displays `0 / 3` active teams, zero approved/pending, three remaining slots, and the registration button. |
| 5 | As the fake captain, press `📝 Đăng ký đội` and submit the fake team, five starter lines, optional substitute, and `TEST-CONTACT`. | Submission succeeds once. Record the test team ID from a read-only query against the isolated SQLite file. |
| 6 | Inspect the test BTC channel. | A review card for `UMA Smoke Test [SMK]` appears with the fake roster and review actions. Record its message ID. |
| 7 | As test BTC staff, request correction with a harmless reason such as `Smoke test: verify correction flow`. | Team status becomes `NEEDS_CORRECTION`; the old review action is disabled. |
| 8 | Check the fake captain's DM. | Captain receives the correction reason and `/uma my-team` guidance. If the DM is blocked, record the failure and stop this flow for investigation. |
| 9 | As the fake captain, run `/uma my-team`. | The same team's correction state and edit action are shown. |
| 10 | Edit and resubmit that same team, changing one fake field while keeping five unique fake starter UIDs. | Resubmission succeeds and status returns to `PENDING`; no second team is created. |
| 11 | Query the isolated SQLite file read-only. | `team.id` exactly matches the ID recorded at step 5; one active test team exists. |
| 12 | Inspect the test BTC channel. | The review card is refreshed or replaced for the same team ID and updated fake values. Record the current card ID. |
| 13 | As test BTC staff, approve the refreshed card. | Team status becomes `APPROVED`; approval action cannot be applied twice. |
| 14 | Run `/uma teams` in the test guild. | `UMA Smoke Test [SMK]` appears in the approved list. |
| 15 | Run `/uma status`. | It reports one approved team, zero pending/correction/rejected teams, and maximum capacity 3. |
| 16 | Stop and restart the bot using the same isolated SQLite file and tournament ID. | Startup reports persisted capacity 3 without creating a second tournament or team. |
| 17 | Query the isolated SQLite file read-only after restart. | Team ID, approved status, fake roster, and `tournaments.max_teams=3` persist. |
| 18 | Re-run `/uma my-team` as the fake captain and `/uma status`. | The same approved team appears; status counts remain one approved out of 3. |
| 19 | Clean up only confirmed test-owned artifacts after recording evidence. | There is currently no Discord withdrawal/delete action wired to the bot, although `withdrawTeam()` exists in the repository. Do not improvise a production data mutation. Stop the bot, confirm the isolated database path and ownership, then archive or remove only that test database and its test-only artifacts under an approved cleanup procedure. |
| 20 | Compare with the baseline inventory. | No production or historical database rows, channels, permissions, or other bots changed. Record any discrepancy and stop. |

## Pass criteria and stop conditions

Pass only if all 20 observations hold, the test remains in the isolated guild/database, and no secret or real identity appears in evidence. Any failed stage, unexpected target ID, duplicate team, changed `team.id`, mismatched capacity, or production contact ends the test; preserve sanitized diagnostics for review. Do not proceed to Phase 2 from this smoke test without a separate decision.
