# LICENSE REVIEW — UMA TOURNAMENT BOT

## Status: UNLICENSED / Pending Review

The final repository license for `Phuchello/UMA-BOT` is intentionally kept as **UNLICENSED / Pending Review**.

---

## Dependency Licensing Summary

- **`discord.js@14.18.0`**: Apache-2.0
- **`zod@3.24.2`**: MIT
- **`tournament-organizer@4.1.1`**: MIT (declared)
  - **`tournament-pairings@2.0.1`** (runtime dependency of `tournament-organizer`): **GPL-3.0-or-later**

Full audit details are documented in [`docs/DEPENDENCY_LICENSE_REPORT.md`](file:///C:/Users/lyle3/Music/Discord/UMA-BOT/docs/DEPENDENCY_LICENSE_REPORT.md).

---

## Architectural Boundary Note

The application introduces the **`TournamentEngine`** interface (`src/tournament/TournamentEngine.ts`) and **`TournamentOrganizerAdapter`** (`src/tournament/TournamentOrganizerAdapter.ts`).

This layer serves strictly as an **architectural decoupling boundary** and **dependency isolation mechanism**:
- It keeps the application domain, database models, and Discord UI code decoupled from third-party bracket libraries.
- It provides **replacement flexibility**, allowing the tournament pairing engine to be substituted with an independent permissive-licensed implementation in the future if required.
- **Legal Clarification:** This technical adapter boundary does not constitute a legal determination regarding GPL copyleft scope. No formal legal analysis has been performed. Therefore, the repository remains `UNLICENSED / Pending Review`.
