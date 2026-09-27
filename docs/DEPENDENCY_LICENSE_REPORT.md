# DEPENDENCY LICENSE REPORT — UMA TOURNAMENT BOT

## 1. Executive Summary

This report documents the local package metadata and license audit of the candidate tournament engine (`tournament-organizer`) and its transitive dependencies, performed on **2026-09-26**.

**Key Finding:** While `tournament-organizer` claims an **MIT** license at the top level, its sole runtime dependency `tournament-pairings` is licensed under **GNU General Public License v3.0 or later (GPL-3.0-or-later)**.

---

## 2. Dependency Hierarchy & Verified Licenses

| Package | Installed Version | Declared License | License File Verified | Direct Dependency Of |
| :--- | :--- | :--- | :--- | :--- |
| **`tournament-organizer`** | `4.1.1` | **MIT** | Yes (`node_modules/tournament-organizer/LICENSE`) | Application (`package.json`) |
| **`tournament-pairings`** | `2.0.1` | **GPL-3.0-or-later** | Yes (`node_modules/tournament-pairings/LICENSE`) | `tournament-organizer` |
| **`edmonds-blossom-fixed`**| `1.0.1` | **MIT** | Yes (`package.json` license field) | `tournament-pairings` |

---

## 3. Detailed Package Metadata

### 3.1. `tournament-organizer`
- **Version:** `4.1.1` (Current stable)
- **Author:** Matt Braddock (`slashinfty`)
- **Package Type:** CommonJS / TypeScript bundled declarations in `dist/`
- **Repository:** `https://github.com/slashinfty/tournament-organizer`
- **Dependencies:** `tournament-pairings: ^2.0.1`

### 3.2. `tournament-pairings`
- **Version:** `2.0.1`
- **Author:** Matt Braddock (`slashinfty`)
- **SPDX Identifier:** `GPL-3.0-or-later`
- **License Text:** Full GNU General Public License version 3 text present in package root.
- **Dependencies:** `edmonds-blossom-fixed: ^1.0.1`

---

## 4. Legal & Architectural Implications

1. **GPL-3.0 Copyleft Scope:**
   - `tournament-pairings` generates pairing graphs for elimination, Swiss, and round-robin stages using Blossom maximum matching algorithms.
   - Because `tournament-organizer` directly imports `tournament-pairings`, any software distributing combined binaries or source code that links with `tournament-pairings` is legally considered a derivative work under GPL-3.0.
2. **Network/Hosted Execution (ASP/SaaS Model):**
   - A Discord bot typically operates over a network (WebSocket/REST API) without distributing software binaries to users. Under standard GPL-3.0 (unlike AGPL-3.0), running software on a server for end users over a network does *not* trigger the copyleft source distribution requirement to users.
3. **Public Repository Considerations:**
   - The repository `Phuchello/UMA-BOT` is hosted publicly on GitHub.
   - If the repository chooses an open-source license, **GPL-3.0-or-later** is 100% compliant with all dependencies.
   - If UMA Club desires a permissive license (such as MIT or Apache-2.0), `tournament-organizer` cannot be shipped in that repository without violating the copyleft obligations of `tournament-pairings`.
4. **Architectural Decoupling Boundary:**
   - Under Phase 0C, bracket mechanics are placed behind the application-owned **`TournamentEngine`** interface.
   - Application domain models (`Tournament`, `Team`, `Player`, `Match`) do not import third-party bracket packages directly.
   - This architectural boundary provides **replacement flexibility**: should UMA Club require a strictly permissive stack in the future, `TournamentOrganizerAdapter` can be swapped with a custom or MIT-licensed elimination engine without modifying the Discord UI or registration repositories.
   - *Note:* This technical boundary provides architectural isolation and modularity; it does not constitute formal legal analysis or claim to neutralize copyleft obligations.

---

## 5. Recommendation

- Classify tournament engine integration as **`USE_WITH_ADAPTER`**.
- Keep the repository license as **UNLICENSED / Pending Review** in `LICENSE_REVIEW.md`.
- Maintain clean dependency boundaries within `src/tournament/TournamentOrganizerAdapter.ts`.
