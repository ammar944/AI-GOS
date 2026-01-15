# Phase 19: Test Infrastructure - Context

**Gathered:** 2026-01-12
**Status:** Ready for planning

<vision>
## How This Should Work

Testing focuses on critical paths rather than comprehensive coverage. The three core systems need test coverage:

1. **Blueprint generation pipeline** — JSON parsing, schema validation, section generation
2. **Chat/RAG system** — Intent routing, retrieval, edit application
3. **API integrations** — OpenRouter, Supabase, SearchAPI calls and error handling

The infrastructure should be set up so tests run automatically on commits and PRs. CI integration is the priority — tests that give confidence before merging, not tests you have to remember to run manually.

</vision>

<essential>
## What Must Be Nailed

- **CI integration** — Tests run automatically on commits/PRs. This is the non-negotiable. If tests don't run automatically, they won't get run.

</essential>

<boundaries>
## What's Out of Scope

- Performance testing (load tests, benchmarks) — not for now
- E2E browser tests — designated for Phase 22
- Visual regression testing — not needed

</boundaries>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for Vitest setup, mocking patterns, and CI configuration.

</specifics>

<notes>
## Additional Context

The roadmap already breaks testing into phases:
- Phase 19: Test Infrastructure (this phase)
- Phase 20: Unit Tests Core
- Phase 21: Integration Tests
- Phase 22: E2E Tests

This phase sets up the foundation that the later phases build on. Focus is on getting CI running and establishing patterns for mocking the AI/database dependencies.

</notes>

---

*Phase: 19-test-infrastructure*
*Context gathered: 2026-01-12*
