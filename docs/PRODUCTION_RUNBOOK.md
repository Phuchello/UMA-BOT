# UMA Tournament Bot — production runbook

This is a preparation runbook. Executing a production release requires separate human authorization, completed Phase 3B Discord E2E, and `LICENSE_REVIEW_REQUIRED` resolution. Phase 3B implementation did not deploy.

## 1. Prerequisites and runtime

Use Node.js 22+ (Node 24 tested), npm 10+, Git, a persistent local filesystem, and one dedicated Discord application. Install with `npm ci`; run `npm run typecheck`, `npm test`, and `npm run build` before release. Keep `replicas = 1`: exactly one bot process against exactly one SQLite file. Never point two independent bot processes at the same database. Retain a rollback copy of the release and SQLite backup.

## 2. Private configuration

Create `.env` outside version control from `.env.example`. Set `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`, `ACTIVE_TOURNAMENT_ID`, `TOURNAMENT_NAME`, `DATABASE_PATH`, `BTC_CHANNEL_ID`, `REGISTRATION_CHANNEL_ID`, `MATCH_HUB_CHANNEL_ID`, `REFEREE_CHANNEL_ID`, `RESULTS_CHANNEL_ID`, and `TOURNAMENT_ADMIN_ROLE_IDS`. Replace all placeholders with IDs from the intended guild. Store token privately, restrict file access, and never paste it into logs or tickets. Production does not use test defaults. Do not hardcode guild IDs in source.

## 3. Discord permissions and IDs

Verify all configured text channels and staff roles belong to `DISCORD_GUILD_ID`. Grant the bot View Channel, Send Messages, Embed Links, Read Message History, Create Private Threads, Send Messages in Threads, Manage Threads, and Attach Files where needed, especially the match hub. The bot does **not** require Administrator. Staff authorization uses configured role IDs or the existing guild Administrator semantics; correct result and publish commands are staff-only. Run `/uma doctor` after intentionally starting the bot, then resolve all FAIL checks and review WARN checks.

## 4. Backup

Stop the bot before filesystem copy or restore. `npm run db:backup` builds the application and writes a unique verified SQLite snapshot under ignored `data/backups/`. An explicit destination may be passed after `--`, for example `npm run db:backup -- data/backups/before-release.sqlite`; an existing destination is refused. The command uses SQLite `VACUUM INTO` and reopens the backup for `PRAGMA quick_check`, so committed WAL data is included. Keep backups outside the deployment checkout and apply private filesystem permissions. Do not commit `.sqlite`, `-wal`, `-shm`, evidence images, or backup files.

## 5. Restore

Stop all bot processes. Preserve the current database and any WAL/SHM sidecars separately for forensic rollback; do not overwrite unknown files. Copy the selected verified backup to a **new** SQLite path, set `DATABASE_PATH` to that path, then start exactly one bot. Startup checks restored tournament, match, result, publication, and stream consistency without posting Discord messages. Run `/uma doctor` and compare tournament results before considering command or message actions. Never combine a backup main file with unrelated WAL/SHM sidecars.

## 6. Build, command deployment, and startup

After approved release gates, run `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, and `npm audit`. Review audit findings rather than applying breaking upgrades blindly. Deploy guild slash commands only as an **intentional** separate step with the intended production IDs (`node dist/index.js --deploy` currently also starts the bot; run it only when ready to start one process). The registered roots are `/uma` and `/uma-caster`. Then keep exactly one supervised process running with `npm start` only if command deployment was performed separately and the prior process is stopped. Avoid duplicate processes. SIGINT/SIGTERM stops work, destroys Discord client, and closes SQLite once.

## 7. Logs and token rotation

Collect startup, readiness, publication failure counts, and orphan-message IDs in restricted logs. Do not print `.env`, tokens, attachment URLs, private evidence, or contact values. Rotate a compromised Discord token in the Discord developer portal, update private `.env`, stop the process, and restart one process. Re-run `/uma doctor`. Token rotation does not require database reset or result republishing.

## 8. Production smoke test and rollback

After separate authorization, validate read-only `/uma status`, `/uma matches`, `/uma results`, `/uma stream`, and ephemeral `/uma doctor` in the intended guild. Staff may run `/uma publish-sync` only after checking canonical results; repeat it to confirm unchanged counts. Do not use `/uma result-correct` as a smoke test. For rollback, stop the process, take a fresh safety backup, restore the known-good binary/config/database snapshot to a new path, start one process, run `/uma doctor`, and reconcile public cards via `/uma publish-sync` only after reviewing canonical results. If Discord edits fail, the published revision stays stale; retry later. If a public message was deleted, sync creates one replacement. Inspect orphan message IDs if compensation failed.

## 9. Correction policy and license gate

Only authorized staff may correct an approved result after independent evidence review and a meaningful written reason. Confirm Team A/B orientation and BO3 score. The service refuses correction with `CORRECTION_LOCKED` if any affected downstream match has referee, room, schedule, readiness, start, submission, or result. Review `/uma result-history` and `/uma doctor` afterward, then intentionally run `/uma publish-sync` to update public cards. Never edit SQLite rows manually to bypass this gate.

`LICENSE_REVIEW_REQUIRED` remains a production and distribution gate: the dependency tree contains GPL-3.0-or-later `tournament-pairings`. Do not treat the engine adapter as legal clearance. Obtain a documented legal/license decision before external/public distribution or production release.
