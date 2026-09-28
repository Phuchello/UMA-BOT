# Production deployment checklist

**Production Deployment Pack IMPLEMENTED. Awaiting License Decision + Explicit Production Deployment.**
All release items remain unchecked. Preparation performed no deployment or Discord connection. Use the [runbook](PRODUCTION_RUNBOOK.md) for commands. `replicas = 1`.

## PRE-DEPLOY

- [ ] License decision documented; `LICENSE_REVIEW_REQUIRED` cleared only by a separately authorized decision
- [ ] Pack Draft PR reviewed/merged by a human; explicit production deployment authorized
- [ ] Phase 3B `PASS_WITH_LIMITATIONS` report reviewed, limitations accepted or addressed
- [ ] Production token created/rotated privately; no token in Git/logs/arguments
- [ ] Production application/guild/channel/staff role IDs verified
- [ ] Bot is NOT Administrator; effective per-channel/private-thread permissions verified
- [ ] Backup location/disk headroom ready; isolated restore rehearsal passed on the chosen Ubuntu host
- [ ] Trusted Node >=22.13/npm >=10 verified at the service's /usr/bin paths
- [ ] Exact commit/tag selected and immutable resolved SHA recorded
- [ ] Exact-head CI green; 196+ tests/current 221-test baseline green
- [ ] npm audit findings reviewed/accepted or independently remediated
- [ ] One VPS, one service, persistent SSD; no network-mounted/shared SQLite
- [ ] Root-owned releases/env, dedicated non-root accounts and private data permissions verified
- [ ] Schema compatibility and prepared previous-release rollback reviewed

## RELEASE

- [ ] Install templates/accounts without starting the service
- [ ] Fill portable env privately; validate offline and verify root:root 0600
- [ ] Build release with lockfile (`npm ci`, typecheck, tests, build, diff-check)
- [ ] systemd unit verification passed on the intended Ubuntu host
- [ ] Existing DB backed up and backup integrity verified; first install explicitly confirmed as no prior DB
- [ ] Deploy slash commands once through the one-shot unit after authorization
- [ ] Enable/start the sole systemd bot service
- [ ] Confirm exactly one bot process; no unmanaged old release
- [ ] Verify online startup log and absence of restarts/crash loop
- [ ] Staff /uma doctor: 0 FAIL, no unnecessary WARN, Administrator warning unacceptable

## SMOKE (read-only)

- [ ] /uma status
- [ ] /uma matches
- [ ] /uma results
- [ ] /uma stream
- [ ] Staff /uma doctor

Do not use result correction, real match mutation, fake result submission/publication, or publish-sync as smoke tests.

## POST-DEPLOY

- [ ] Backup service succeeds; daily timer enabled, server timezone/catch-up verified
- [ ] Backup retention dry run reviewed; at least 14 verified snapshots retained when available
- [ ] Reboot persistence verified during an approved maintenance window if appropriate
- [ ] Journald reviewed for failures/secrets and host retention policy confirmed
- [ ] Disk free space/inodes monitoring and operational ownership assigned
- [ ] Code rollback command and compatible previous SHA documented
- [ ] Restore/emergency shutdown procedure and forensic preservation reviewed
- [ ] Release SHA, CI, operator, time, DB/backup/doctor disposition recorded privately
- [ ] Optional encrypted offsite backup policy approved separately
