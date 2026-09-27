# UMA Tournament Bot

Vietnamese-first Discord tournament system tailored specifically for UMA Club.

## Target Scope (v1)

- **Game:** Liên Quân Mobile
- **Format:** 5v5 (exactly 5 starting players + optional substitutes)
- **Scale:** 10–15 teams (stress capacity up to 16 teams)
- **Bracket:** Single Elimination
- **Operations:** Discord-first native interactions with Vietnamese-first user experience

## Current Project Status

- **Phase 0 (Tournament Engine Validation):** Complete (`USE_WITH_ADAPTER`)
- **Phase 1 (Registration):** Complete; Discord E2E passed with documented limitations.
- **Phase 2A (Lock, Check-in, Draw & Bracket):** Complete; Discord E2E passed with documented limitations.
- **Phase 2B (Match Rooms & Lifecycle):** Complete; Discord E2E passed with documented limitations.
- **Phase 3A (Results, Evidence & Advancement):** Implemented; automated review and Discord E2E pending.
- **Phase 3B (Public Results, Ceremony, Livestream & Final Hardening):** Deferred within Phase 3.

*Note: Features not yet built are strictly marked as pending or planned. Unfinished features are never claimed as operational.*

## Architecture Overview

The system is built as a standalone Discord application with clean separation of concerns:
- **Discord Bot Layer (`src/bot/`):** Registration, match rooms, and Phase 3A result commands. Private match rooms support screenshot reports, opponent confirmation/dispute, referee adjudication and results up to `COMPLETED`.
- **Tournament Engine Adapter (`src/tournament/`):** Application-owned `TournamentEngine` interface serving as an architectural decoupling boundary to isolate bracket mechanics and provide dependency replacement flexibility.
- **Registration & Approval Domain (`src/registration/`):** Normalized relational storage (`node:sqlite`) enforcing strict domain invariants (5 starters, unique UIDs, atomic capacity limits, and multi-tournament separation).
- **Concurrency & Idempotency:** Guaranteed single-state transitions with race condition locks for BTC staff actions and team resubmissions.

## Development Setup

### Prerequisites

- Node.js 22+ (tested on Node 22 and 24; requires built-in `node:sqlite`)
- npm 10+
- Git

### Installation

```bash
git clone https://github.com/Phuchello/UMA-BOT.git
cd UMA-BOT
npm install
```

### Environment Variables

Copy `.env.example` to `.env` and fill in required values:

```bash
cp .env.example .env
```

Outside `NODE_ENV=test`, the Discord application, guild, channel, and staff role IDs must be supplied explicitly as 17–20 digit IDs. `CI=true` does not enable test defaults. Replace every ID placeholder in `.env.example` before starting the bot or registering slash commands; use IDs from the intended guild, never another server's IDs.

| Variable | Description |
| :--- | :--- |
| `DISCORD_TOKEN` | Discord Bot authentication token |
| `DISCORD_CLIENT_ID` | Discord Application client ID |
| `DISCORD_GUILD_ID` | Intended Discord guild ID |
| `ACTIVE_TOURNAMENT_ID` | Active tournament identifier (e.g. `uma-cup-2027`) |
| `BTC_CHANNEL_ID` | Channel ID for BTC tournament management (`#🎛️・ban-tổ-chức`) |
| `REGISTRATION_CHANNEL_ID` | Channel ID for public registration (`#📝・đăng-ký-thi-đấu`) |
| `MATCH_HUB_CHANNEL_ID` | Explicit parent text channel for private match threads; required outside tests |
| `REFEREE_CHANNEL_ID` | Referee channel ID |
| `RESULTS_CHANNEL_ID` | Results channel ID |
| `TOURNAMENT_ADMIN_ROLE_IDS` | Comma-separated staff role IDs (at least one) |
| `DATABASE_PATH` | Path to SQLite database file (e.g. `data/tournament.sqlite`) |

The bot needs View Channel, Send Messages, Create Private Threads, Send Messages in Threads, Manage Threads, Read Message History, Attach Files, and Embed Links in the match hub. Do not grant Administrator to the bot. See [Discord's thread permissions guide](https://support.discord.com/hc/en-us/articles/4403205878423-Threads-FAQ). Staff use `/uma start`, assign a referee by `round` and `match`, and run `/uma rooms-create`. Staff schedule with `YYYY-MM-DD HH:mm` in `Asia/Ho_Chi_Minh`; each captain confirms ready in the private room, then its referee or staff starts the match.

For Phase 3A, a participating captain uses `/uma report-result my-score:<0–2> opponent-score:<0–2> evidence:<image>` inside a LIVE private match room. The bot archives a PNG, JPEG or WebP screenshot (at most 10 MiB) in that room. The opposing captain can confirm or dispute; only the assigned referee or staff can approve, reject or resolve a dispute. `/uma result-resolve` accepts Team A/Team B scores and a reason; `/uma result-refresh` repairs Discord cards from saved state. `/uma results` shows approved scores without private evidence. Approved results advance the engine and are immutable in Phase 3A.

### Running Tests

```bash
npm test
```

### Building & Running

```bash
npm run build
npm start
```

## Documentation

- `PROJECT_STATE.md`: Real-time milestone tracker, risk registry, and commit history
- `TODO.md`: Concrete implementation tasks
- `LICENSE_REVIEW.md`: License audit notes and architectural boundary explanation
- `docs/ARCHITECTURE.md`: High-level system design
- `docs/ENGINE_SPIKE_REPORT.md`: Tournament engine spike findings
- `docs/DEPENDENCY_LICENSE_REPORT.md`: Dependency license audit
- `docs/PHASE1_TEST_REPORT.md`: Phase 1 test execution report
- `docs/PHASE1_5_HARDENING_REPORT.md`: Phase 1.5 hardening and CI verification report
- `docs/PHASE2A_IMPLEMENTATION_REPORT.md`: Lock, check-in, draw, bracket and persistence design
- `docs/PHASE2B_IMPLEMENTATION_REPORT.md`: Match state, private rooms, scheduling, readiness and restart design
- `docs/PHASE3A_IMPLEMENTATION_REPORT.md`: Evidence, referee adjudication, engine advancement and champion persistence
