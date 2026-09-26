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
- **Phase 1 (Application Scaffold & Registration Workflow):** Complete (100% test coverage)
- **Phase 2+ (Matches, Bracket, Evidence & Scoring):** Deferred to subsequent milestone

*Note: Features not yet built are strictly marked as pending or planned. Unfinished features are never claimed as operational.*

## Architecture Overview

The system is built as a standalone Discord application with clean separation of concerns:
- **Discord Bot Layer (`src/bot/`):** Slash commands (`/uma`), mobile-optimized 5-row registration modal, buttons, and embeds providing intuitive Vietnamese-first UX.
- **Tournament Engine Adapter (`src/tournament/`):** Application-owned `TournamentEngine` interface isolating bracket mechanics from 3rd-party libraries.
- **Registration & Approval Domain (`src/registration/`):** Normalized relational storage (`node:sqlite`) enforcing strict domain invariants (5 starters, unique UIDs, atomic staff reviews).
- **Concurrency & Idempotency:** Guaranteed single-state transitions with race condition locks for BTC staff actions.

## Development Setup

### Prerequisites

- Node.js 22+ or 24+ (uses built-in `node:sqlite` module)
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

| Variable | Description |
| :--- | :--- |
| `DISCORD_TOKEN` | Discord Bot authentication token |
| `DISCORD_CLIENT_ID` | Discord Application client ID |
| `DISCORD_GUILD_ID` | UMA GAMING Discord Server ID |
| `BTC_CHANNEL_ID` | Channel ID for BTC tournament management (`#🎛️・ban-tổ-chức`) |
| `REGISTRATION_CHANNEL_ID` | Channel ID for public registration (`#📝・đăng-ký-thi-đấu`) |
| `DATABASE_PATH` | Path to SQLite database file (e.g. `data/tournament.sqlite`) |

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

- `PROJECT_STATE.md`: Real-time milestone tracker and risk registry
- `TODO.md`: Concrete implementation tasks
- `LICENSE_REVIEW.md`: License audit notes
- `docs/ARCHITECTURE.md`: High-level system design
- `docs/ENGINE_SPIKE_REPORT.md`: Tournament engine spike findings
- `docs/DEPENDENCY_LICENSE_REPORT.md`: Dependency license audit
- `docs/PHASE1_TEST_REPORT.md`: Phase 1 test execution report
