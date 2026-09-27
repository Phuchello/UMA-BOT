# Phase 2B implementation report

## Scope

Phase 2B starts a persisted Phase 2A bracket, assigns referees, creates private Discord match threads for matches with two known teams, schedules them, records each captain's readiness, and lets an assigned referee or staff start a match. The operational boundary is `LIVE`. There are no scores, results, winner decisions, engine result calls, bracket advancement, or production deployment in this milestone.

## State machines

Tournament: `registration_open → checkin_open → bracket_ready → in_progress`. Staff `/uma start` performs the final transition exactly once after restoring the persisted bracket and finding at least one match with two known teams. It does not create rooms or regenerate seeds, engine state, or match IDs.

Match: `WAITING → READY → ROOM_OPEN → SCHEDULED → READY_TO_START → LIVE`. `WAITING` means an unknown participant remains; `READY` means both teams are known; `ROOM_OPEN` has a persisted private room; `SCHEDULED` has a room and future time; `READY_TO_START` has both captains' confirmations; `LIVE` has a recorded start actor and time. SQLite triggers reject backward and skipped status transitions. Rescheduling updates `scheduled_at` while staying `SCHEDULED`; it clears an earlier one-team confirmation if the time changes. No transition out of `LIVE` exists in Phase 2B.

## Legacy Phase 2A match migration

Phase 2A wrote placeholder `SCHEDULED` on all match rows. At schema initialization, an additive `schema_migrations` marker controls a one-time conversion: rows with two known teams become `READY`, and rows with an unknown team become `WAITING`. Rows with operational room or schedule metadata are excluded, so a real Phase 2B `SCHEDULED` match cannot be renormalized. The migration runs under `BEGIN IMMEDIATE` and preserves application IDs, engine IDs, participants, round and match numbers, seeds, BYEs and serialized bracket state. New draws directly insert `READY` or `WAITING`. Existing Phase 1 and 2A databases remain loadable; tests use isolated temporary files rather than preserved E2E evidence databases.

## Schema and persistence

- `match_rooms`: one room per application match, unique Discord thread ID, parent hub ID, starter message ID, creator and timestamp.
- `match_referee_assignments`: explicit per-match user IDs, assigner and time; unique match/referee pair. Discord roles are never inserted as private thread members.
- `match_schedules`: one current epoch-millisecond schedule per match, actor and update time.
- `match_ready_confirmations`: one confirmation per team per match, captain and timestamp.
- `match_starts`: start time and actor per match.
- `match_audit_logs`: actor, action, previous/new states and time for assignment, room creation, schedule/reschedule, readiness and start. No contact or UID data is stored in audit details.
- `schema_migrations`: one-time legacy normalization marker.

The existing `tournament_matches.id` remains the application identity, while `engine_match_id` remains only the adapter mapping. Public selectors are `R<round>-M<match>`. The `tournament_byes` table remains unchanged; BYEs are not match rows or rooms.

## Room architecture and failure boundary

`MatchService` owns state and eligibility, `MatchRepository` owns SQLite operations, and the small `MatchRoomGateway` interface isolates Discord calls. `DiscordMatchRoomGateway` creates a **private** thread under the explicit `MATCH_HUB_CHANNEL_ID`, admits both captains and each assigned referee user, and posts a starter card. Tests use a fake gateway. The thread name uses a sanitized `r1-m1-team-vs-team` form with a 100-character cap and no private information.

Room creation checks `in_progress`, `READY`, two existing teams/captains and at least one referee. It skips `WAITING` matches and BYEs. The thread and starter message are created first; one SQLite transaction then stores their IDs and changes `READY → ROOM_OPEN`. A retry sees persisted state and creates no second room. If adding members, posting, or persistence fails, the service attempts to delete the newly created thread. If cleanup also fails, it logs the orphan thread and match IDs as a recoverable inconsistency. Database transactions cannot include Discord API calls. Schedule, ready and LIVE mutations commit first, then edit the starter card; an edit failure is reported as “state saved, card not updated” for staff recovery.

A referee assigned after room creation is added to that private thread and the starter card is refreshed. If Discord admission fails, the assignment remains persisted, the command reports the failure, and repeating the same assignment retries admission without adding a duplicate database row.

`MATCH_HUB_CHANNEL_ID` is a required 17–20 digit Discord snowflake outside `NODE_ENV=test`. A synthetic default exists only in test mode; `CI=true` does not enable it. It is independent of the registration channel. The bot needs View Channel, Send Messages, Create Private Threads, Send Messages in Threads, Manage Threads, Read Message History, and Embed Links in the hub. [Discord's thread guide](https://support.discord.com/hc/en-us/articles/4403205878423-Threads-FAQ) describes the thread permissions. The bot does not need Administrator. No channel or permission was changed during implementation.

## Scheduling, readiness and LIVE

Staff `/uma match-schedule round:<n> match:<n> time:YYYY-MM-DD HH:mm` parses the input strictly as `Asia/Ho_Chi_Minh` (UTC+07:00), rejects impossible or past times, and stores epoch milliseconds. The room card shows Discord `<t:UNIX:F>` and `<t:UNIX:R>` timestamps.

The `✅ Sẵn sàng` button checks the tournament, match, actual thread ID and captain identity. A captain can confirm only their own team, once. One confirmation keeps `SCHEDULED`; both change the match to `READY_TO_START`. An assigned referee for that match or tournament staff can use `▶️ Bắt đầu trận` only with both confirmations and a persisted room. The action records `started_at` and `started_by_discord_id`, changes `READY_TO_START → LIVE`, and removes the buttons. The LIVE card explicitly says results will arrive in Phase 3.

## Public UX and authorization

`/uma matches` shows team names, round/match selectors, schedule and state in round-based embeds without private thread links, player UIDs or captain contact. `/uma status` adds counts for all six match states while `in_progress`.

| Action | Authorization |
| --- | --- |
| `/uma start`, `/uma match-referee`, `/uma rooms-create`, `/uma match-schedule` | Tournament staff or guild Administrator; checked by handler and service |
| `✅ Sẵn sàng` | Captain of one participating team, in the corresponding private thread |
| `▶️ Bắt đầu trận` | Assigned referee for this match or tournament staff, in the corresponding private thread |
| `/uma matches`, `/uma status` | Public-safe read-only |

Buttons may be stale or copied; domain checks still enforce state, identity, thread and tournament. Referees are stored per match and admitted as users, not by role membership.

## Restart and future rounds

Startup restores the Phase 2A engine state and validates Phase 2B rows. It fails clearly if a room state lacks a room, a scheduled state lacks its room/schedule, both-ready state lacks confirmations, or LIVE lacks start metadata. Restart reads persisted room/message IDs, referee assignments, schedules, readiness and LIVE state. It does not recreate threads, resend starter cards, clear confirmations, reshuffle seeds or regenerate match IDs.

Unknown future-round participants remain `WAITING`, with no room. An internal `syncParticipants` method can change `WAITING → READY` once two distinct drawn teams are known, preserving any already-known participant. Phase 2B does not call it from Discord and never calls `engine.reportResult` or `engine.resetResult`.

## Automated tests and limits

The pre-Phase 2B baseline was 95 tests in 10 suites. New tests cover a real four-team Phase 2A draw (two READY first-round matches, one WAITING final), 3-team BYE room exclusion, referee and staff authorization, idempotent rooms, Discord/API and DB failure compensation, strict scheduling, reschedule readiness reset, captain confirmations, LIVE authorization, legacy migration, startup corruption detection, restart persistence, and builder limits. Final count and CI run are recorded in the Draft PR and project state.

Automated tests use an in-memory Discord gateway; no live Discord connection, command deployment, thread creation, guild mutation or production deployment occurred. Match-room reconciliation after a failed cleanup is manual in v1. Phase 3 retains scores, evidence, referee result verification, disputes, winner advancement, champion detection and livestream features.
