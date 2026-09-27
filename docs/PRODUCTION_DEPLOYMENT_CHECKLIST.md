# UMA Tournament Bot — production deployment checklist

All items are intentionally unchecked. This checklist is for a later, separately authorized release; Phase 3B implementation performed none of these actions.

- [ ] Phase 3B Draft PR reviewed, CI successful, and merged by a human
- [ ] Separate Phase 3B Discord E2E completed and reviewed
- [ ] `LICENSE_REVIEW_REQUIRED` resolved with documented legal decision
- [ ] Production token configured privately and access restricted
- [ ] Production guild, channel, and staff role IDs verified against intended guild
- [ ] Bot permissions verified without Administrator requirement
- [ ] One-process SQLite deployment design verified (`replicas = 1`)
- [ ] Database backup created and restore path tested
- [ ] `npm ci` completed
- [ ] `npm run typecheck` passed
- [ ] `npm test` passed
- [ ] `npm run build` passed
- [ ] `npm audit` findings reviewed and accepted or remediated
- [ ] Guild commands intentionally deployed in the approved production guild
- [ ] Exactly one supervised bot process started
- [ ] `/uma doctor` PASS or documented WARN disposition
- [ ] Read-only production smoke views verified
- [ ] Public result sync run intentionally and unchanged retry verified
- [ ] Logs checked for secrets, private evidence, and failures
- [ ] Backup/rollback procedure verified
- [ ] Explicit production release approval recorded
