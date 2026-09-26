# UMA TOURNAMENT BOT — TODO LIST

## Phase 0: Tournament Engine Validation
- [x] Push foundational commit to `main` and branch to `feat/phase0-phase1`
- [x] Install `tournament-organizer` and analyze version, package type, dependencies, and licenses
- [x] Create `docs/DEPENDENCY_LICENSE_REPORT.md` (audit `tournament-pairings` etc.)
- [x] Create `docs/ENGINE_SPIKE_REPORT.md`
- [x] Phase 0A: Run isolated 15-team Single Elimination spike (16 slots, 1 BYE, 14 matches)
- [x] Phase 0B: Validate test matrix (seeding, progression, score lifecycle, rollback, persistence)
- [x] Phase 0C: Implement `TournamentEngine` interface & `TournamentOrganizerAdapter`
- [x] Pass Phase 0 Gate (`USE_WITH_ADAPTER`)
- [x] Commit & push Phase 0 checkpoint to `feat/phase0-phase1`

## Phase 1: Application Scaffold & Team Registration
- [ ] Setup normalized database schema (Tournament, Team, Player) with strict invariants
- [ ] Implement database repositories with transaction and concurrency support
- [ ] Build Discord bot client startup and slash command registration
- [ ] Build Vietnamese-first Registration Panel (`📝 Đăng ký đội`, `👥 Danh sách đội`, `📘 Hướng dẫn`)
- [ ] Build Team Registration Modal & Submitter with exactly 5 starters + optional substitutes
- [ ] Build BTC Review Queue in `🎛️・ban-tổ-chức` (`✅ Duyệt`, `✏️ Yêu cầu sửa`, `❌ Từ chối`)
- [ ] Implement concurrency, idempotency, and race condition protections
- [ ] Write comprehensive Vitest test suite for Phase 1 domain & handlers
- [ ] Create `docs/ARCHITECTURE.md` and `docs/PHASE1_TEST_REPORT.md`
- [ ] Update `README.md` and `PROJECT_STATE.md`
- [ ] Commit & push Phase 1 checkpoint to `feat/phase0-phase1`
- [ ] Create Draft Pull Request to `main`
