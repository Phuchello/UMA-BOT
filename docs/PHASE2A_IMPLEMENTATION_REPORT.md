# Phase 2A implementation report

## Scope and boundary

Phase 2A locks registration, allows captain-driven team check-in, freezes the eligible field with a random draw, generates a Single Elimination bracket through `TournamentEngine`/`TournamentOrganizerAdapter`, and stores a public-safe bracket. It adds no result submission or advancement controls. No live Discord connection or deployment was used during implementation.

## State machine

| From | To | Gate |
| --- | --- | --- |
| `registration_open` | `checkin_open` | Staff `/uma checkin-open`; zero `PENDING` and `NEEDS_CORRECTION`; at least two `APPROVED` |
| `checkin_open` | `bracket_ready` | Staff `/uma draw`; at least two `APPROVED` + checked-in teams; seeds, serialized engine state, match snapshot and BYEs committed together |
| `bracket_ready` | `in_progress` | Reserved for Phase 2B; no Phase 2A command can enter it |

The application uses a `TournamentStatus` union, conditional updates, and additive SQLite triggers to forbid invalid status values, backward transitions and skipped transitions. Phase 2A has no completion state. Repeated check-in opening and draw calls are rejected without changing persisted state.

## Storage and migrations

`initializeSchema` adds tables and indexes with `IF NOT EXISTS`, preserving existing Phase 1 rows and files. No Phase 1 database needs to be deleted for Phase 2A. The new tables are:

- `team_checkins`: composite team/tournament primary key, actor and timestamp. Composite foreign key keeps the team in its tournament.
- `tournament_seeds`: one row per team, unique `(tournament_id, seed)`, seed, draw actor and timestamp.
- `tournament_brackets`: one serialized engine state per tournament, generation actor/time and version.
- `tournament_matches`: stable application-owned `match_<UUID>` ID, unique tournament/engine-match mapping, round and match numbers, known participants, status and timestamps. Result mutation is deferred.
- `tournament_byes`: automatic advancement paths omitted from the adapter's playable match list, keyed by team/tournament and pointing to the destination engine match. This is not a synthetic match or team.

An additive unique `(tournament_id, id)` team index supports composite foreign keys. Status triggers enforce the forward-only lifecycle on both fresh and existing SQLite databases.

## Registration and check-in semantics

Opening check-in atomically changes tournament status under `BEGIN IMMEDIATE`. Registration and correction resubmission check the status inside their own write transaction. Buttons and modals also reject stale clicks. Newly posted registration panels disable the register button and show the current phase. Previously posted panels may still display their old button; the interaction and repository reject it after lock.

Only the captain of an `APPROVED` team in the active tournament can check in while `checkin_open`. Player Discord IDs remain optional. Repeated check-in returns an informational result with a single stored row. Approval status is unchanged. `/uma checkins` lists public team names and counts; it omits contact details and player UIDs.

## Draw and bracket

Eligibility is exactly `teams.status = 'APPROVED'` joined to `team_checkins` for the same tournament. The draw uses a Fisher–Yates shuffle with `crypto.randomInt`, then stores unique integer seeds `1..N`; no rating or roster property influences their assignment. There is no redraw or reset command.

Within one SQLite transaction, the service loads eligible teams, assigns seeds, creates and starts a tournament through the application-owned engine interface, serializes the adapter state, stores seeds/bracket/matches/BYEs, and changes status to `bracket_ready`. Any engine or database failure rolls back the whole draw and leaves `checkin_open`. Read and startup restore load the persisted engine state; they never rerun the shuffle or regenerate match IDs.

For 15 teams the adapter creates a 16-slot bracket with one automatic BYE and 14 playable match objects across four rounds. The BYE team appears already advanced in round two. Phase 2A records that path in `tournament_byes`, and public `/uma bracket` shows `BYE — team → Vòng 2` in round one. No captain action is needed for a BYE. The public view uses team names and match numbers; it excludes contact, player UID, engine JSON and internal engine match IDs. At 16 teams it uses one overview embed plus one embed per round, below Discord's per-message and per-embed limits.

## Authorization

| Action | Who |
| --- | --- |
| `/uma checkin-open`, `/uma draw` | Staff role or guild Administrator, via existing `isStaffMember` logic |
| `/uma check-in` | Captain of own approved team |
| `/uma checkins`, `/uma bracket`, `/uma status` | Public-safe read-only |

The bot does not require Administrator permission. No production resource IDs are hardcoded.

## Automated verification

The Phase 1 baseline was 78 tests in 9 suites. Phase 2A adds state, lock, check-in, eligibility, draw idempotency, mid-transaction rollback, real-adapter 2/10/15/16-team brackets, 15-team BYE and 14 playable matches, persistent restart identity, additive schema, and Discord builder serialization tests. Final counts and CI result are recorded in the PR once CI completes. Typecheck and build are required gates.

## Known limits and deferred work

This milestone does not start matches or mutate results. Match rooms, scheduling, scores, evidence, referees, disputes, advancement, champion ceremony, livestream and production deployment remain deferred. Existing registration panels posted before the lock cannot be edited reliably because Phase 1 did not store their message IDs; their stale register button is rejected by both Discord handler and repository. Phase 2A Discord E2E requires a separate post-merge run.
