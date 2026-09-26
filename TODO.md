# UMA TOURNAMENT BOT — TODO LIST

## Phase 0: Tournament Engine Validation
- [ ] Push foundational commit to `main` and branch to `feat/phase0-phase1`
- [ ] Install `tournament-organizer` and analyze version, package type, dependencies, and licenses
- [ ] Create `docs/DEPENDENCY_LICENSE_REPORT.md` (audit `tournament-pairings` etc.)
- [ ] Create `docs/ENGINE_SPIKE_REPORT.md`
- [ ] Phase 0A: Run isolated 15-team Single Elimination spike (16 slots, 1 BYE, 14 matches)
- [ ] Phase 0B: Validate test matrix (seeding, progression, score lifecycle, rollback, persistence)
- [ ] Phase 0C: Implement `TournamentEngine` interface & `TournamentOrganizerAdapter`
- [ ] Pass Phase 0 Gate (`USE` / `USE_WITH_ADAPTER`)
- [ ] Commit & push Phase 0 checkpoint to `feat/phase0-phase1`

## Phase 1: Application Scaffold & Team Registration
- [ ] Setup TypeScript, ESLint/Prettier, Vitest, discord.js, better-sqlite3
- [ ] Create normalized database schema (Tournament, Team, Player) with invariants
- [ ] Implement database repositories with strict transaction support
- [ ] Build Discord bot startup and slash command registration
- [ ] Build Vietnamese-first Registration Panel (`📝 Đăng ký đội`, `👥 Danh sách đội`, `📘 Hướng dẫn`)
- [ ] Build Team Registration Modal & Submitter with 5 starters + optional substitutes
- [ ] Build BTC Review Card in `🎛️・ban-tổ-chức` (`✅ Duyệt`, `✏️ Yêu cầu sửa`, `❌ Từ chối`)
- [ ] Implement concurrency, idempotency, and race condition protections
- [ ] Write comprehensive Vitest test suite for Phase 1 domain & handlers
- [ ] Create `docs/ARCHITECTURE.md` and `docs/PHASE1_TEST_REPORT.md`
- [ ] Update `README.md` and `PROJECT_STATE.md`
- [ ] Commit & push Phase 1 checkpoint to `feat/phase0-phase1`
- [ ] Create Draft Pull Request to `main`
