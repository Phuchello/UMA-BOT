# Phase 3B implementation report

## Checkpoint

- Branch: `feat/phase3b-finalization`; base: `aa45deacb4094d71daa7d01026561d1241afe3a6`.
- Baseline in a fresh Windows development clone: Node 24.19.0, npm 11.17.0, 149/149 tests across 12 suites, typecheck/build/diff-check passed.
- Phase 3B is implemented for automated review. No live Discord connection, command deployment, Test Guild mutation, Production Guild mutation, or production deployment occurred in this implementation run. No PR merge is authorized.

## Persistence and domain boundaries

`Database.ts` adds `match_results.revision` with default 1 and an additive migration for Phase 3A databases. Each safe correction increments it once. `match_result_corrections` records old/new scores and teams, actor, reason, timestamp, and before/after bracket versions. SQLite triggers reject edits and deletes to this history. `public_result_messages` and `public_champion_messages` persist message IDs, channel, published revision, and content hash. `match_streams` and `match_casters` store metadata only. All tables retain tournament and match foreign keys.

`ResultService` owns authoritative correction and engine mutation. `PublicationService` owns derived public announcements and retry behavior. `StreamService` owns public HTTPS stream/VOD and caster metadata. `ProductionReadinessService` performs read-only checks. Discord gateways implement effects and resource validation; automated tests inject fakes.

## Guarded approved-result correction

Staff `/uma result-correct` requires Team A/B BO3 scores, `confirm:true`, and a 10–500 character reason. It restores the persisted engine inside `BEGIN IMMEDIATE`, verifies the completed match and canonical score, resets the target **in memory**, and compares engine matches before/after to identify affected downstream matches. Affected matches must be `WAITING` or `READY` with no referee, room, schedule, ready confirmation, start, submission, or result. Otherwise it returns `CORRECTION_LOCKED` with no authoritative change. A successful correction reports the revised result to the engine, reconciles passive participant rows without changing match IDs, inserts immutable history, updates the canonical score and revision, saves engine state with one bracket-version increment, writes audit, and updates champion/runner-up atomically for a final correction. Evidence, approved submissions, disputes, and old audits remain. `/uma result-history` is staff-only and does not show evidence URLs.

Real adapter tests verify two-team final reversal, three-team BYE preservation, and four-team semifinal finalist replacement. Separate tests cover locks for referee, room, schedule, ready confirmation, start, submission, canonical result, and active state; concurrent correction; and injected history/canonical/bracket/outcome failures with complete rollback.

## Public publication and champion ceremony

Staff `/uma publish-sync` publishes canonical results to the configured results channel and a champion ceremony only when completion/outcome are valid. Cards contain public-safe team names and scores, a correction marker, and an optional VOD link; they omit private evidence, IDs, contact, and dispute details. The Discord gateway checks guild, GuildText channel, required permissions, and embed limits, and suppresses mentions.

For a new message, Discord send precedes transactional ID persistence; persistence failure attempts message deletion and logs an orphan ID if cleanup fails. Existing messages are edited before `published_revision` advances. Failed edits remain stale for retry. Every sync checks message existence; a manually deleted card receives one replacement identity. Content hashes update VOD changes without incrementing canonical revision. Tests cover first publish, repeat, multiple results, corrected result/champion edit, failure/retry, deleted-message replacement, compensation, and privacy.

## Streams, caster, and command budget

Staff `/uma stream-set` and `/uma stream-clear` manage URL/title; public `/uma stream` shows URL, caster names, teams, schedule, and state without pinging. Metadata is allowed only for two known teams (`READY` through `COMPLETED`), so completed matches may retain VOD. URL validation accepts HTTPS from an explicit YouTube/Twitch/Facebook/TikTok/fb.watch host list, max 2048 characters, no credentials; title max 100. No keys, passwords, OBS, or streaming API calls exist. `/uma matches` adds a compact stream marker.

Discord caps one slash root at 25 top-level options. The 18 existing `/uma` subcommands plus seven Phase 3B result/stream/readiness commands fill that budget. To preserve every older path, caster add/remove are deployed as `/uma-caster add` and `/uma-caster remove`. This differs from the proposed `/uma caster-add` and `/uma caster-remove` spelling and needs explicit human review.

## Readiness and production hardening

Staff `/uma doctor` is ephemeral and read-only. It checks active tournament/status, restored bracket, persisted match/result/history/publication/stream consistency, SQLite `quick_check`, configured guild/channel/role identity, cross-guild channels, and required bot permissions. It never prints the Discord token. `npm run db:backup` uses SQLite `VACUUM INTO` from a read-only source handle, refuses overwrite, and reopens/validates the independent backup. Backups are ignored. SIGINT/SIGTERM stop interaction acceptance, destroy the client, close SQLite, and exit once. Production remains one process per SQLite file.

## Verification and release gates

The Phase 3B suite adds 47 tests; together with 149 prior tests the final local run passed 196/196 across 13 suites. Final `npm ci`, typecheck, build, and `git diff --check` all passed. Draft PR CI must complete successfully before review. `npm audit` reports two **moderate** findings in the development test toolchain (`vitest` and `@vitest/mocker`, GHSA-82fw-gwwq-j7x9). The available automatic fix is a major Vitest upgrade, deferred for separate review; no breaking dependency change was made here.

`LICENSE_REVIEW_REQUIRED`: `tournament-pairings` is GPL-3.0-or-later. The adapter is technical isolation and does not establish legal clearance. Human review, separate post-merge Phase 3B Discord E2E, and explicit production release approval remain pending. No production deployment was performed.
