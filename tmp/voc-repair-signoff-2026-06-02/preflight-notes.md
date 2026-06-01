# Preflight Notes

- Cwd: /Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire
- Handoff read: docs/2026-06-01-voc-repair-signoff-e2e-codex-handoff.md
- Design spec read: docs/superpowers/specs/2026-06-02-voc-repair-signoff-e2e-design.md
- No source edits, migrations, push, deploy, rerun loop, or second paid run.
- Route under test: http://localhost:3000/research-v2
- Manual auth needed: not reached; paid browser run blocked by npm run test:run failure
- Corpus dispatch health result: not fully verified; unauthenticated app capability curl was Clerk-rewritten to HTML, local worker /capabilities returned status=ok but orchestrate_supported=false
