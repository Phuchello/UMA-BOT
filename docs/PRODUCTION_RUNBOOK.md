# UMA Tournament Bot - production runbook

**Production Deployment Pack IMPLEMENTED. Awaiting License Decision + Explicit Production Deployment.**
No production deployment, Discord login, guild command registration, or VPS/service activation occurred during preparation. Phase 0-3B is complete; Phase 3B Discord E2E remains `PASS_WITH_LIMITATIONS`. `LICENSE_REVIEW_REQUIRED` is unresolved because `tournament-pairings` is GPL-3.0-or-later. The adapter is not legal clearance. All activation commands below are for a later human-authorized release after a documented license decision and review of the E2E limitations.

## 1. Architecture and hard limits

```text
Discord Gateway -> one Ubuntu VPS -> systemd -> one Node.js bot -> one local SQLite DB
```

`replicas = 1`. Use only `uma-bot.service` for the bot. Never start `npm start`, `node dist/index.js`, a second service, another host, or another release alongside it. Backup processes are read-only SQLite snapshot readers, not bot replicas. Use persistent local SSD storage; no network-mounted SQLite, shared DB between hosts, containers, or orchestration platform is supported by this pack.

Install a trusted Node.js distribution and npm separately. This pack requires **Node >=22.13**, npm >=10, Git, Bash, systemd, and Ubuntu (24.04 LTS is the intended operator target). `/usr/bin/node` and `/usr/bin/npm` must resolve to the approved installation. The floor is 22.13 because built-in SQLite no longer requires a flag there ([Node SQLite history](https://nodejs.org/docs/latest-v22.x/api/sqlite.html)). Review platform updates independently; the installer does not download Node or run remote installers.

## 2. Filesystem and ownership

```text
/opt/uma-bot/releases/<full-commit-sha>/   root:root, readable/executable code
/opt/uma-bot/current -> releases/<sha>    root-managed release pointer
/var/lib/uma-bot/tournament.sqlite       uma-bot:uma-bot, 0600
/var/lib/uma-bot/backups/                 uma-bot:uma-bot, 0700
/etc/uma-bot/uma-bot.env                  root:root, 0600 (parent 0700)
/var/cache/uma-bot/build.*/               isolated uma-build staging
/run/uma-bot-ops/operations.lock          root:uma-bot, 0660, parent root 0755
```

Data and backups survive release replacement. Do not put SQLite or secrets inside a release. Scripts intentionally support exactly `DATABASE_PATH=/var/lib/uma-bot/tournament.sqlite`; customize the entire pack together if changing this convention. `uma-bot` is a non-root nologin service account. `uma-build` is a separate non-root nologin builder with no access to the private env/data directories. Dependency scripts and tests run with a cleared environment and synthetic test configuration. Releases become root-owned before selection. Treat approved Git refs as executable code; review them before running npm lifecycle scripts. No service can rewrite the selected release. Do not run builds as root or as the bot account.

## 3. First installation (later, authorized operator only)

Select an exact reviewed commit containing this pack, and record its successful CI run. Replace the placeholder before executing; no token belongs in a command argument.

```bash
RELEASE_SHA='<reviewed-full-40-character-commit-sha>'
git clone https://github.com/Phuchello/UMA-BOT.git uma-deploy-pack
cd uma-deploy-pack
git checkout --detach "$RELEASE_SHA"
git rev-parse HEAD
/usr/bin/node --version
/usr/bin/npm --version
sudo bash deploy/scripts/install.sh
```

The installer creates accounts/directories, installs four units and a tmpfiles lock, and runs daemon-reload. It never creates a DB or fake env, enables/starts a service, or deploys commands. Missing configuration leaves activation pending. It requires root for account/unit management, validates the platform/Node version, and refuses symlinked layout directories.

## 4. Create and validate private environment

```bash
sudo install -o root -g root -m 600 deploy/uma-bot.env.example /etc/uma-bot/uma-bot.env
sudoedit /etc/uma-bot/uma-bot.env
sudo stat -c '%U:%G %a %n' /etc/uma-bot/uma-bot.env
```

Fill **every** blank token/ID/tournament field privately. Use IDs from the approved production application/guild only, verify channels and staff roles individually, and set `NODE_ENV=production`. The portable repository template contains no real IDs or token. Quote names with spaces as shown. The file is dotenv/systemd data, never shell code: do not `source` it, print it, paste it into tickets, or use it while running tests. systemd reads the root-only file before dropping privileges; the bot user does not need to read it from disk.

## 5. Build the first release; leave activation pending

```bash
sudo bash deploy/scripts/update.sh "$RELEASE_SHA"
sudo /usr/bin/node "/opt/uma-bot/releases/$RELEASE_SHA/dist/scripts/validateConfig.js"   --env-file /etc/uma-bot/uma-bot.env   --expect-database /var/lib/uma-bot/tournament.sqlite
sudo systemd-analyze verify /etc/systemd/system/uma-bot.service   /etc/systemd/system/uma-bot-backup.service /etc/systemd/system/uma-bot-backup.timer   /etc/systemd/system/uma-bot-commands.service
```

`update.sh <commit-or-tag>` defaults to **build only**: fetch from the canonical public repository, resolve an exact commit, assemble with `npm ci`, typecheck, test, build, diff-check, and require a clean build tree. It leaves `current` unchanged and starts nothing. Failed build staging is retained for diagnosis. Audit findings must be reviewed before activation; do not use `npm audit fix --force`. A prepared SHA cannot be overwritten; a later `--activate` may select the existing root-owned prepared SHA without rebuilding. Record the resolved SHA if using a tag.

On a **first install only**, with no previous `current` and no existing production database:

```bash
if sudo test ! -e /opt/uma-bot/current && sudo test ! -L /opt/uma-bot/current \
  && sudo test ! -e /var/lib/uma-bot/tournament.sqlite \
  && sudo test ! -L /var/lib/uma-bot/tournament.sqlite; then
  sudo ln -sT "/opt/uma-bot/releases/$RELEASE_SHA" /opt/uma-bot/current
else
  printf '%s\n' 'Existing current/database: STOP and inspect; use the update/rollback flow.' >&2
fi
```

If any precondition fails, inspect the prior release and follow update/rollback instead. Do not overwrite unknown paths.

## 6. Explicit command deployment and activation

The application paths are now separate:

```bash
npm run deploy:commands   # built REST-only one-shot, registers /uma and /uma-caster
npm start                # gateway bot only; opens/bootstrap-validates SQLite
```

These illustrative commands require the intended private environment; do not run `npm start` beside the service. `node dist/index.js --deploy` is removed and refuses before DB creation/login. No automatic command deployment occurs at startup, reboot, or update.

For the supported root-owned env, run the installed **manual-only** command registration unit. It runs `npm run deploy:commands` as `uma-bot`, reads the private env via systemd, has a read-only filesystem, creates no gateway client/SQLite state, and exits. It is never enabled or attached to startup/update. Register commands once when the command schema changes, after explicit production authorization:

```bash
sudo systemctl start uma-bot-commands.service
sudo journalctl -u uma-bot-commands.service --since today --no-pager
sudo systemctl show uma-bot-commands.service -p Result -p ExecMainStatus
sudo systemctl enable --now uma-bot.service
sudo systemctl status uma-bot.service --no-pager
sudo systemctl show uma-bot.service -p MainPID -p NRestarts
pgrep -a -u uma-bot node
```

Require one **bot** process. A short backup/registration process may be visible during a deliberate one-shot; it must not be another `dist/index.js`. Confirm the online log, then staff `/uma doctor`. systemd active state is process liveness, not Discord/domain readiness. Target **0 FAIL, 0 unnecessary WARN**. Every WARN requires human review; Administrator is unacceptable for production. No HTTP health server was added.

## 7. Least privilege Discord permissions

Invite the approved app with bot and application-command scopes. Validate effective channel overwrites, private-thread membership, staff role IDs, and the intended guild; this pack changes none of them.

| Configured channel | Bot permissions |
| --- | --- |
| `BTC_CHANNEL_ID` | View Channel, Send Messages, Embed Links, Read Message History |
| `REGISTRATION_CHANNEL_ID` | View Channel, Send Messages, Embed Links, Read Message History |
| `MATCH_HUB_CHANNEL_ID` and its private match threads | All above, Create Private Threads, Send Messages in Threads, Manage Threads, Attach Files |
| `REFEREE_CHANNEL_ID` | View Channel, Send Messages, Embed Links, Read Message History |
| `RESULTS_CHANNEL_ID` | View Channel, Send Messages, Embed Links, Read Message History |

**Do not grant Administrator.** Evidence uploads occur in private match threads. Public result cards contain no raw evidence attachments. No Manage Guild, Manage Roles, or Manage Channels permission is required for this workflow. Staff authorization uses configured roles and the existing human Administrator semantics. Review [Discord permissions](https://docs.discord.com/developers/topics/permissions) and [thread permissions](https://docs.discord.com/developers/topics/threads) when validating the guild.

## 8. Control and logs

```bash
sudo systemctl stop uma-bot
sudo systemctl restart uma-bot
sudo systemctl status uma-bot --no-pager
sudo systemctl enable uma-bot
sudo journalctl -u uma-bot
sudo journalctl -u uma-bot -f
sudo journalctl -u uma-bot --since today
sudo journalctl --disk-usage
```

systemd runs Node directly with SIGTERM, a 30-second graceful-stop deadline, process-group cleanup, restart after 5 seconds, and a 5-start/120-second crash-loop limit. Enablement returns the service after reboot. Restart limits can intentionally leave a persistent failure stopped; investigate and reset-failed after fixing it. Hardening includes NoNewPrivileges, PrivateTmp, ProtectSystem=strict, ProtectHome, RestrictSUIDSGID, LockPersonality, UMask=0077, and explicit data writes. No restrictions on networking/TLS/DNS or JIT memory were added. No shell wrapper supervises the bot.

Journald handles log retention; there are no application file logs and no logrotate requirement. Review the VPS journald disk/time limits (`SystemMaxUse`, `MaxRetentionSec`) under the host's policy; global changes affect other services too. Restrict journal access. Operational contexts/IDs and fixed error categories remain; raw exceptions, stacks, headers, signed evidence URLs, credentials and contact data are not emitted by console error handlers. Never enable debug payload logging. See the [upstream systemd service documentation](https://github.com/systemd/systemd/blob/v255/man/systemd.service.xml) and [execution hardening documentation](https://github.com/systemd/systemd/blob/v255/man/systemd.exec.xml).

## 9. Manual backup and daily timer

```bash
sudo systemctl start uma-bot-backup.service
sudo journalctl -u uma-bot-backup.service --since today --no-pager
sudo systemctl show uma-bot-backup.service -p Result -p ExecMainStatus
sudo systemctl enable --now uma-bot-backup.timer
systemctl list-timers uma-bot-backup.timer
```

The timer runs at **02:30 server local time**, catches a missed run after reboot with Persistent=true, and must be reviewed against the VPS timezone (`timedatectl`). It neither depends on a Discord token nor connects to Discord. It uses the existing verified `VACUUM INTO` helper against an existing DB, verifies a staged snapshot, flushes it, and atomically promotes it to a unique `uma-<UTC timestamp>-<UUID>.sqlite`, mode 0600. No overwrite. SQLite provides a consistent snapshot including committed WAL data ([SQLite VACUUM INTO](https://www.sqlite.org/lang_vacuum.html)). Source tournament data is untouched. Failures are nonzero/visible in systemd/journald. Partial `.pending-*` files are never treated as successful backups. No directory/service failure creates a fake DB.

Backups, updates, rollbacks and restores share a nonblocking flock protected by a root-owned parent. If an overlapping operation causes a backup failure, review it and rerun the backup after that operation. Missing `/run` lock after reboot indicates a tmpfiles problem:

```bash
sudo systemd-tmpfiles --create /etc/tmpfiles.d/uma-bot-ops.conf
```

The developer `npm run db:backup -- <destination>` remains available and builds first; production automation runs the built helper from immutable code instead. Never copy the main DB alone while the bot is running.

## 10. Retention and optional offsite copy

Retention is **manual, dry run first**. Keep at least the 14 newest verified snapshots; extra pre-update backups count toward this snapshot count. Keep important release/emergency and optional weekly copies separately. Emergency `pre-restore-*` directories, partial files, foreign names, directories, and symlinks are excluded. Only exact regular snapshot filenames directly in the fixed backup directory may be deleted; the helper never follows symlinks or recurses. No timer deletes backups automatically.

```bash
sudo -u uma-bot flock -n /run/uma-bot-ops/operations.lock   /usr/bin/node /opt/uma-bot/current/dist/operations/scheduledBackup.js --retention-dry-run
# After reviewing the displayed exact files:
sudo -u uma-bot flock -n /run/uma-bot-ops/operations.lock   /usr/bin/node /opt/uma-bot/current/dist/operations/scheduledBackup.js --prune
```

After a successful verified local backup, a future operator may encrypt it and copy it to private S3-compatible storage, B2, or another approved offsite location. Verify upload/decryption/recovery independently before treating offsite storage as a backup. This is documentation only: no provider SDK, credentials, hooks executing uploads, or cloud resources were added.

## 11. Update and code rollback

Review the exact target CI, audit, license/authorization, disk space, and database compatibility **before** activation. Command deployment is separate; an update never silently changes guild commands. Never overlap administrator start/stop actions with an operation. Scripts serialize operations but cannot prevent another root administrator from starting unmanaged processes.

```bash
NEXT_REF='<reviewed-full-commit-sha-or-tag>'
sudo env KEEP_RELEASES=3 bash /opt/uma-bot/current/deploy/scripts/update.sh "$NEXT_REF" --activate
sudo systemctl status uma-bot --no-pager
sudo journalctl -u uma-bot --since today --no-pager
```

Activation builds/checks before stopping the old bot, verifies it has stopped, takes a unique verified SQLite snapshot, switches `current` via a same-directory temporary symlink/rename, starts the new service, and checks 15 seconds of active state with zero restarts. A failed backup aborts before switching and leaves the bot stopped for review. Failed startup stops the new process, restores previous code, and tries the previous service; if it also fails, it leaves the bot stopped. It does **not** blindly restore DB: startup migrations/data from an attempted new release may be incompatible with old code. Review schema compatibility in advance; incompatible changes require a separately reviewed maintenance/restore plan. Human doctor and smoke checks are still required after any successful process check.

For a prepared, known-good **schema-compatible** code release:

```bash
PREVIOUS_SHA='<previous-prepared-full-commit-sha>'
sudo bash /opt/uma-bot/current/deploy/scripts/rollback.sh "$PREVIOUS_SHA" --confirm-schema-compatible
```

Rollback also stops, backs up, switches and starts sequentially. No concurrent releases, DB deletion, or implicit DB restore. All releases are retained; automatic deletion is disabled. `KEEP_RELEASES` (2..100, default 3) states the minimum retained-history policy. Maintain at least current + previous + a spare when available; clean older approved release/build paths manually after reviewing recorded hashes, current target and recovery needs. Never delete the previous release immediately or use recursive deletion against computed/unvalidated paths.

## 12. Intentional restore

Stop the bot, pause the timer, confirm zero MainPID and no unmanaged bot process. Choose a standalone snapshot directly inside the backup directory and the matching code release. Restore requires an explicit path and confirmation flag; it never starts a service.

```bash
sudo systemctl stop uma-bot-backup.timer
sudo systemctl stop uma-bot
sudo systemctl show uma-bot -p ActiveState -p MainPID
pgrep -a -u uma-bot node
BACKUP='/var/lib/uma-bot/backups/<exact-verified-snapshot-name>.sqlite'
sudo bash /opt/uma-bot/current/deploy/scripts/restore.sh "$BACKUP" --confirm-replace-database
```

The wrapper requires stopped systemd state, obtains the operations lock, verifies configuration/path, and runs SQLite work as `uma-bot`. It checks backup integrity, refuses source WAL/SHM/journal or symlinks, builds/validates a new file on the target filesystem, and flushes it. Before replacement, it preserves the old main and any old WAL/SHM/journal sidecars in a private `pre-restore-<UUID>/` emergency directory, including a corrupt old main for forensics. Original sidecars are never copied next to the new DB. Placement uses an atomic rename. If placement fails, preserved old sidecars are reinstated; emergency originals remain. Validation failure leaves the original untouched and the bot stopped. Preserve partial files for inspection rather than guessing at cleanup.

A restore does not publish/edit Discord messages. After explicit review and authorization:

```bash
sudo systemctl reset-failed uma-bot
sudo systemctl start uma-bot
sudo systemctl status uma-bot --no-pager
sudo systemctl start uma-bot-backup.timer
```

Then staff `/uma doctor`, before any mutating tournament action. Compare restored state with the operational record; existing Discord cards may be newer than restored data. Any `/uma publish-sync` reconciliation requires independent human review and is not a smoke test. Never bypass canonical guards with ad-hoc SQL.

## 13. Read-only production smoke

After authorization/start, verify `/uma status`, `/uma matches`, `/uma results`, `/uma stream`, and staff `/uma doctor`. Require no unexplained FAIL; review all WARN, remove Administrator. Do not correct results, submit fake results, mutate matches, publish fake public results, or use publication sync as smoke. Record release SHA, CI run, operator, time, DB path, backup name, doctor disposition and rollback SHA privately without secrets.

## 14. Token rotation

```bash
sudo systemctl stop uma-bot
sudoedit /etc/uma-bot/uma-bot.env
sudo stat -c '%U:%G %a %n' /etc/uma-bot/uma-bot.env
sudo systemctl start uma-bot
sudo journalctl -u uma-bot --since today --no-pager
```

Create/rotate the token in the approved application's developer portal privately, update the file without echoing it, and verify one process and `/uma doctor`. Revoke compromised old credentials immediately. Rotation requires neither DB reset, command deployment, nor result republishing.

## 15. Emergency shutdown and crash loops

```bash
sudo systemctl stop uma-bot-backup.timer
sudo systemctl disable --now uma-bot
sudo systemctl mask --runtime uma-bot
sudo systemctl show uma-bot -p ActiveState -p MainPID
sudo journalctl -u uma-bot -n 100 --no-pager
```

This blocks restart until an operator reviews the cause; intentional systemctl stop is not undone by Restart=always. Do not kill random Node processes. Inspect configuration, permissions, disk and DB consistency without printing secrets. A start-limit failure is a signal to investigate. After the cause is fixed and authorization reconfirmed:

```bash
sudo systemctl unmask --runtime uma-bot
sudo systemctl reset-failed uma-bot
sudo systemctl enable --now uma-bot
```

## 16. Disk-full and corrupted DB recovery

```bash
df -h
df -i
du -sh /var/lib/uma-bot
sudo journalctl --disk-usage
sudo systemctl status uma-bot --no-pager
```

Stop bot/timer if persistence is failing. Free space only from reviewed unrelated logs/old backups/builds; preserve the current DB, WAL/SHM and emergency snapshots. Do not vacuum or delete a live DB. Leave headroom for SQLite snapshots, WAL growth and at least current/previous releases. Review dry-run retention, preserve recovery backups, and expand disk if needed. Journal cleanup is a host-wide policy decision. Retry a verified backup before update/start.

For corruption: keep the service stopped; retain the old main and sidecars for forensics. Choose a known-good snapshot and compatible release, follow the guarded restore flow, then human doctor before mutations. If no valid backup exists, escalate for recovery; never initialize a replacement tournament to hide lost data. Backups are sensitive tournament records and require private storage/access.

## 17. Discord outage

Inspect network/DNS and the safe journal, check the provider's status through approved channels, and wait for normal gateway reconnection. Do not deploy commands repeatedly, reset SQLite, fabricate results, or launch a second instance. If the service crash-loops, stop it and investigate before reset-failed. Domain state remains authoritative; perform publication recovery only after independent human review when connectivity returns.

## 18. Release gates still active

`LICENSE_REVIEW_REQUIRED` remains. No dependency replacement, license change, GPL compliance claim or legal approval is made. Complete documented license decision, human PR review/merge, exact-head CI and audit acceptance, Ubuntu operator validation/restore rehearsal, least privilege IDs/config review, E2E limitations disposition and explicit production deployment authorization. This pack prepares 24/7 supervision; it does not claim a production deployment or a 24/7 live service.
