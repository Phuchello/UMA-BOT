# Phase 3A implementation report — results, evidence and advancement

## Scope and authority

Phase 3A begins at a `LIVE` match and ends with an approved canonical result, downstream engine advancement, and, for the final, a persisted champion. Captain reports, screenshots, opponent confirmation and disputes never change the bracket. Only an assigned match referee or tournament staff can invoke `TournamentEngine.reportResult` through `ResultService`. Approved results are immutable in this milestone. Phase 3B owns public announcements, ceremony, livestream, deployment and a future guarded correction policy.

## State machines and storage

Match state adds `LIVE → COMPLETED`; tournament state adds `in_progress → completed`. The result workflow is independent: `PENDING → CONFIRMED → APPROVED`, `PENDING → DISPUTED → APPROVED`, and `PENDING`/`CONFIRMED`/`DISPUTED → REJECTED`. A rejected report leaves the match `LIVE` and permits a new report. A partial unique SQLite index allows only one open report per match. Canonical `match_results` has `match_id` as primary key. Additive tables are `match_result_submissions`, `result_evidence`, `match_result_disputes`, `match_results`, `result_audit_logs`, and `tournament_outcomes`. Existing status triggers are replaced during schema initialization with guards for the two new forward transitions.

## Evidence lifecycle and external boundary

`/uma report-result` accepts only a Discord attachment in the persisted private match thread. Domain checks require a participating captain, an active `LIVE` match, valid BO3 score and no existing open or canonical result. Scores are entered as `my-score` and `opponent-score`, then mapped to engine Team A/Team B by captain identity. Valid completed BO3 scores are exactly `2–0`, `2–1`, `0–2`, `1–2`.

The attachment must declare PNG, JPEG or WebP and be 1 byte–10 MiB. `DiscordEvidenceGateway` accepts only HTTPS Discord CDN/media hosts, refuses redirects, limits downloaded bytes, checks byte signatures against the declared image type, and reuploads the bytes as a bot-authored message in the private match thread. This message carries the result card and buttons. The database stores the archived message ID, archived attachment ID, filename, type, size and time; it does not store a temporary source URL. If submission persistence fails, the gateway attempts to delete the new message and logs any failed cleanup as a recoverable orphan. No Discord API call occurs inside a database transaction.

## Opponent and referee flow

Only the opposing captain can use `✅ Đồng ý` or `⚠️ Khiếu nại`; the reporter cannot self-confirm. Confirmation changes `PENDING → CONFIRMED` without touching the engine. Dispute uses a bounded reason modal and changes `PENDING → DISPUTED`. An assigned referee or staff can normally approve `PENDING` or `CONFIRMED`, reject any open report with a bounded reason, or use `/uma result-resolve` to adjudicate a disputed report with a possibly different valid BO3 score and a reason. Normal approval cannot bypass a dispute. Rejected evidence stays as history; a new report may be filed. Buttons are presentation only: every action checks match, thread, identity and state in the domain.

## Authoritative engine transaction

Approval uses `BEGIN IMMEDIATE`. It reloads the saved engine state and bracket version, verifies the application and engine match IDs and participants, calls the application-owned engine's `reportResult` once, then compares returned `hasEnded`, scores, winner and loser with the adjudicated BO3 score. It reconciles every downstream `WAITING` application match against the returned engine bracket, filling known participants without replacing an already known team. When both teams are known, the same application row changes `WAITING → READY`; it receives no automatic room, referee or schedule. The transaction inserts one canonical result, marks the submission `APPROVED`, changes the current match `LIVE → COMPLETED`, persists serialized engine state and increments `tournament_brackets.version` once. If the engine reports tournament completion, it verifies the final and stores champion, runner-up and final match in `tournament_outcomes`, then changes the tournament to `completed`. Any failure rolls back all database changes, including downstream participants and version.

Approved evidence and starter cards refresh after commit. A Discord edit failure does not undo an authoritative result; it reports the saved state and instructs staff to run `/uma result-refresh` from that private room. Refresh rebuilds the starter and all archived result cards from persisted data without mutating engine or result state. Card edits are serialized per match so a slower earlier action cannot leave the latest card stale.

## Public views and authorization

`/uma results` shows approved scores only; unfinished matches show “Chưa hoàn tất”. `/uma matches` shows completed scores and newly ready downstream participants. `/uma status` includes `COMPLETED` counts and the champion name once the tournament is completed. These views exclude screenshot links, private thread IDs, player UIDs, contacts and dispute reasons.

| Action | Authorized actor |
| --- | --- |
| `/uma report-result` | Participating captain in the LIVE match's private thread |
| Confirm or dispute | Opposing captain in that thread |
| Approve, reject, `/uma result-resolve`, `/uma result-refresh` | Assigned referee for that match or tournament staff |
| `/uma results`, `/uma matches`, `/uma status` | Public-safe read-only |

## Restart and verification

Startup validates that completed matches have canonical approved results and ended engine matches, canonical winners participated, no open report remains on completed matches, approved submissions have canonical results, and tournament outcome agrees with the completed engine final. Restart performs no result replay, upload, room creation or version increment.

The 116-test Phase 2B baseline remains green. Phase 3A tests use real `TournamentOrganizerAdapter` brackets for two-team final completion, three-team BYE preservation, four-team advancement, restart after a semifinal and after full completion. Other tests cover BO3 input, captain/referee authorization, opponent confirmation, dispute, rejection and resubmission, evidence compensation, concurrency, failure atomicity, startup corruption, card recovery and Discord builders. The final test count and CI result are in the Draft PR.

Known limits: Discord evidence archival and card edits need separate post-merge E2E validation. If deleting an orphan evidence message fails, staff must reconcile it manually. Approved results cannot be corrected in Phase 3A. No live Discord connection or production guild mutation occurred during implementation.
