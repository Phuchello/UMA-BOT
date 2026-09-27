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

## Phase 1.5: Hardening & Consistency Patch
- [x] Separate `tournamentId` (`ACTIVE_TOURNAMENT_ID`) from `DISCORD_GUILD_ID`
- [x] Complete registration correction workflow (`NEEDS_CORRECTION` -> `/uma my-team` edit -> `PENDING`)
- [x] Atomic capacity enforcement in domain (`activeCount >= maxTeams` rejection)
- [x] Align captain uniqueness claims (transactional domain enforcement allowing re-registration after rejection/withdrawal)
- [x] Accurate guide embed without claiming Phase 2 features are live
- [x] Add GitHub Actions CI workflow (`.github/workflows/ci.yml`)
- [x] Cautious architectural boundary language in license documentation
- [x] Phase 1.5 comprehensive test hardening suite (`tests/phase1_5_hardening.test.ts`)
- [x] Create `docs/PHASE1_5_HARDENING_REPORT.md`
- [x] Update Draft PR #1 body

## Phase 2A: Lock / Check-in / Draw / Bracket
- [x] Lock registration after all active applications receive a final decision
- [x] Captain check-in for approved teams, stored independently of approval
- [x] Random persisted seed assignment for approved, checked-in teams only
- [x] Generate and restore Single Elimination bracket through the engine adapter
- [x] Persist stable application match IDs and explicit BYE advancement paths
- [x] Add public-safe check-in, status and bracket views
- [x] Human review and Phase 2A Discord E2E after merge

## Phase 2B: Match Rooms / Match Lifecycle
- [x] Staff tournament start (`bracket_ready` → `in_progress`)
- [x] One-time Phase 2A match-status migration
- [x] Per-match referee assignment
- [x] Private match-room gateway and persisted room identities
- [x] Staff scheduling in Vietnamese local time
- [x] Captain ready confirmations and referee/staff LIVE transition
- [x] Restart persistence and corruption validation
- [x] Human review and separate post-merge Phase 2B Discord E2E

## Phase 3: Results / Evidence / Referee / Advancement

### Phase 3A — Results / Evidence / Referee / Advancement
- [x] Captain BO3 result reporting with durable private-thread screenshot evidence
- [x] Opponent confirmation and dispute; referee/staff rejection or adjudication
- [x] Canonical engine result, stable downstream advancement and bracket versioning
- [x] Match COMPLETED, tournament completed and champion persistence
- [x] Restart validation and recovery command for Discord card refresh
- [ ] Human review and separate post-merge Discord E2E

### Phase 3B — Public Results / Champion Ceremony / Livestream / Final Hardening
- [ ] Polished public results publishing and champion ceremony
- [ ] Livestream/caster integration
- [ ] Guarded approved-result correction policy and production hardening/deployment
