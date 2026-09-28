# Production deployment pack report

## Status and scope

**Production Deployment Pack IMPLEMENTED. Awaiting License Decision + Explicit Production Deployment.**
Branch: `ops/production-deployment-pack`. Verified main base: `9dcccdce80498503229bd17b8939cb27276fa61c`; main CI `36366357295` completed/success. Phase 0-3B remains complete and Phase 3B E2E remains `PASS_WITH_LIMITATIONS`.

Preparation only: **0 Discord login, 0 command deployment, 0 Test Guild mutation, 0 Production Guild mutation, 0 production token usage, 0 production DB creation, 0 production VPS mutation, 0 production service start**. No PR merge. No tournament business-rule, engine, authorization or schema changes. Match/result/publication service changes only redact console error values. Existing evidence/test files in the primary checkout were preserved; a previously clean attached worktree was reused.

## Deployment architecture

One Ubuntu VPS, one non-root systemd bot, one persistent local SQLite database; `replicas = 1`. Node >=22.13 (unflagged built-in SQLite), npm >=10, no Docker/Kubernetes/Redis/Postgres/Helm/Terraform. One manual REST registration unit and one read-only backup unit are short-lived operations, not bot replicas. Arbitrary root/manual duplicate launches remain prohibited by the operator model; systemd process state is not Discord readiness.

| Artifact | Purpose |
| --- | --- |
| `src/bot/deployCommands.ts`, `src/scripts/deployCommands.ts` | Isolated REST-only guild command registration; no client/runtime/SQLite imports |
| `src/scripts/validateConfig.ts` | Offline production preflight, explicit tournament fields/IDs/persistent DB path, no values logged |
| `src/operations/logging.ts` | Fixed safe error categories; raw HTTP/Discord errors are not logged |
| `src/operations/scheduledBackup.ts` | Unique verified/flush/promoted snapshots; exact-file guarded retention, dry run default |
| `src/operations/restore.ts` | Verified staged restore, emergency old main/sidecars, atomic placement, no service start |
| `deploy/systemd/uma-bot.service` | One direct Node process, environment preflight, crash/reboot supervision and compatible hardening |
| `deploy/systemd/uma-bot-commands.service` | Explicit manual `npm run deploy:commands` under the private systemd env |
| `deploy/systemd/uma-bot-backup.service`, `.timer` | Token-free read-only snapshot at 02:30 server local time, persistent catch-up |
| `deploy/systemd/uma-bot-ops.conf` | Root-protected, reboot-created shared operations flock |
| `deploy/scripts/install.sh` | Accounts/layout/unit installation; no activation/Discord/DB creation |
| `deploy/scripts/update.sh`, `common.sh` | Sanitized unprivileged release build, guarded selection, stop/backup/switch/start and failed-start code fallback |
| `deploy/scripts/rollback.sh` | Explicit exact prepared SHA and schema-compatible confirmation; no blind DB restore |
| `deploy/scripts/restore.sh` | Stopped service + explicit backup + confirmation; SQLite work as service user |
| `deploy/uma-bot.env.example` | Portable blank IDs/token, private persistent paths, correct UTF-8 default game |
| `.gitattributes`, `.gitignore` | LF deployment scripts/templates; private env excluded and examples included |
| `.github/workflows/ci.yml` | Bash parsing and systemd-analyze verification only; does not boot/start systemd services |
| `docs/PRODUCTION_RUNBOOK.md`, `docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md` | Copyable later operator flows and unchecked release gates |
| `README.md`, `PROJECT_STATE.md`, `TODO.md`, `package.json`, `package-lock.json` | Accurate implemented/pending state, separate scripts and Node floor; dependency versions unchanged |
| `tests/production_deployment.test.ts`, `tests/production_backup_restore.test.ts` | 25 offline application/operations tests |

`npm start` remains the long-running gateway entry point. `npm run deploy:commands` requires an existing build, validates config, registers only the two guild roots and exits. The legacy `--deploy` startup switch is removed and refuses before DB creation or login. Registration is never part of installation, startup, reboot, backup or update.

## Supervision, layout and permissions

Main service: Type=simple, User/Group=uma-bot, working directory `/opt/uma-bot/current`, private root-owned `/etc/uma-bot/uma-bot.env`, direct `/usr/bin/node .../dist/index.js`, Restart=always/5s, SIGTERM/30s stop, KillMode=control-group, crash-loop limit 5 starts/120s. No shell supervisor. NoNewPrivileges, PrivateTmp, ProtectSystem=strict, ProtectHome, RestrictSUIDSGID, LockPersonality and UMask=0077 are set; data writes are explicitly permitted. No settings that intentionally block Node JIT, DNS, TLS or networking were added. Enablement supports reboot return after later operator activation.

Root-owned code lives in `/opt/uma-bot/releases/<sha>` with a `current` symlink. SQLite and backups are outside releases under `/var/lib/uma-bot`, owned by uma-bot, directory 0700/file 0600. Env is root:root 0600 in a 0700 directory; systemd reads it before changing user. Uma-build is a separate non-root nologin build account with no access to private DB/env and a cleared environment. Installer does not install Node or download unverified binaries.

Bot channel permissions are View Channel, Send Messages, Embed Links and Read Message History in BTC, registration, referee and results channels; match hub/private match threads additionally require Create Private Threads, Send Messages in Threads, Manage Threads and Attach Files. Administrator is unacceptable in production. Production `/uma doctor` should show 0 FAIL and 0 unnecessary WARN; all WARN require human review. No production permissions changed.

## Release, backup and recovery behavior

- Install templates only; fill/validate env privately; assemble exact SHA with lockfile/typecheck/test/build/diff checks. Default build mode leaves current/service untouched. Reviewed prepared SHA may be activated later.
- Update explicitly stops old service, verifies MainPID=0, takes a verified snapshot, switches the symlink, starts one service, and observes 15 seconds without restart. Backup failure leaves it stopped before switching. Startup failure stops failed code, selects prior code and tries it; failure of prior code leaves it stopped. No automatic DB rollback. Review compatibility before activation.
- Code rollback requires an exact prepared SHA and schema-compatibility confirmation and repeats stop/backup/switch/start. Release pruning is manual: retain all by default, at least configurable KEEP_RELEASES=3 (allowed 2..100) including current/previous.
- Daily backup is token-free, preserves canonical source content, includes committed WAL data, uses unique names/no overwrite, verifies via existing `createSqliteBackup`/quick_check, flushes/promotes only complete files. Failure is visible in journal/service exit status.
- Snapshot retention is manual after dry run: keep 14 newest exact regular snapshots. No recursion, symlink traversal, unknown-file deletion, emergency-dir deletion or automated timer pruning. Extra update snapshots count toward the 14; this is not a guarantee of 14 calendar days. Optional weekly/offsite encrypted copies are documentation only.
- Restore refuses active service, outside/symlinked paths and non-standalone source snapshots. Validates a new file before replacement, preserves old main/WAL/SHM/journal separately (including corruption for forensics), then places the restored main on the same filesystem. No unrelated sidecars copied into the new live state. Failed placement reinstates preserved old sidecars. No automatic start. Human doctor precedes tournament mutations after authorized restart; no automatic Discord publication/reconciliation.
- Journald is the only log sink/retention manager. No logrotate/file logging framework added. Error logs retain context/IDs/categories without raw tokens, headers, request payloads, signed evidence URLs, contact values or stack traces. Startup/shutdown, orphan compensation and publication/backup failures remain observable.
- Runbook covers first install/env/permissions/build/commands/service control/logs/timer/update/rollback/restore/token rotation/doctor/emergency stop/disk-full/corruption/Discord outage/crash loops and read-only smoke.

## Verification

Baseline: npm ci, typecheck, **196/196 tests in 13 suites**, build and diff-check PASS at the required main SHA.
Final local verification: npm ci, typecheck, **221/221 tests in 15 suites**, build and diff-check PASS. New coverage: 17 deployment/preflight/logging/shutdown/package/artifact tests + 8 WAL/backup/retention/restore tests. REST, Client and database construction are trapped/mocked for command deployment tests; no real Discord calls. SQLite tests use isolated temporary fixtures, not a production DB. Bash syntax is parsed with Git Bash locally and Bash in CI. Linux systemd unit validation is static in CI; no systemd services booted. CI verifies temporary unit copies adapting only Node/npm executable paths to setup-node toolcache locations; production units remain at /usr/bin. Initial CI run `36386490660` passed npm/typecheck/221 tests/build but exposed absent /usr/bin Node/npm on the hosted runner; the static verification environment was corrected. Actual Ubuntu installation/reboot/crash/restore rehearsal is not claimed and remains a later release gate. Shell executable bits and UTF-8/LF templates are staged explicitly; no generated dist, DB, WAL/SHM, evidence, secrets or backup is staged.

npm audit: **2 moderate findings** (`vitest`, `@vitest/mocker`), 0 high/critical; advisory `GHSA-82fw-gwwq-j7x9`. Audit exits nonzero as expected. These are development tooling packages; npm proposes a major Vitest upgrade. No blind audit fix or dependency-version change performed. Human disposition/remediation is required before release. Local Node 24.19.0/npm 11.17.0 used; CI uses Node 22. npm also reported the existing esbuild allow-scripts review notice; no install-script policy was changed.

## Security review and remaining gates

Reviewed root execution/ownership/chmod, shell quoting, traversal/ref interpolation, symlinks, env/DB secrecy, process ordering, token output and deletion. No eval, remote curl installer or recursive deletion in operator scripts. Root is confined to installation/build ownership/service control; npm builds run as uma-build and SQLite mutations run as uma-bot. Release refs/markers and fixed paths are validated; operations are serialized by protected flock. No secrets or real production IDs added.

Remaining limitations: approved refs execute dependency/build code; never assemble unreviewed code. Process liveness alone cannot prove Discord readiness. Operator actions must not race manual root starts. Automatic code fallback assumes previously reviewed DB compatibility and cannot undo migration/data changes. Retention/offsite copy requires human operation; failures/disk capacity need monitoring. Ubuntu runtime rehearsal and least privilege guild/config verification are outstanding. No legal/license clearance is inferred.

**LICENSE_REVIEW_REQUIRED** remains active for GPL-3.0-or-later `tournament-pairings`; adapter is not legal clearance. No license/dependency/engine rewrite or compliance claim. Human Draft PR review/merge, exact-head CI, audit disposition, license decision and explicit production authorization remain required. No production deployment, no 24/7 live claim, no merge.
