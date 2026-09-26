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
- [x] Setup normalized database schema (Tournament, Team, Player) with strict invariants
- [x] Implement database repositories with transaction and concurrency support
- [x] Build Discord bot client startup and slash command registration
- [x] Build Vietnamese-first Registration Panel (`📝 Đăng ký đội`, `👥 Danh sách đội`, `📘 Hướng dẫn`)
- [x] Build Team Registration Modal & Submitter with exactly 5 starters + optional substitutes
- [x] Build BTC Review Queue in `🎛️・ban-tổ-chức` (`✅ Duyệt`, `✏️ Yêu cầu sửa`, `❌ Từ chối`)
- [x] Implement concurrency, idempotency, and race condition protections
- [x] Write comprehensive Vitest test suite for Phase 1 domain & handlers
- [x] Create `docs/ARCHITECTURE.md` and `docs/PHASE1_TEST_REPORT.md`
- [x] Update `README.md` and `PROJECT_STATE.md`
- [x] Commit & push Phase 1 checkpoint to `feat/phase0-phase1`
- [x] Create Draft Pull Request to `main`

## Phase 2: Tournament Execution & Match Management (Deferred)
- [ ] Implement check-in workflow for approved teams
- [ ] Build bracket generation & seeding based on Phase 0 engine adapter
- [ ] Automated private match thread creation for competing captains and referees
- [ ] Screenshot evidence upload & score submission modal
- [ ] BTC score verification & match advancement
