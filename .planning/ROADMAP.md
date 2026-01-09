# Roadmap

## Milestones

- [v1.0 Stabilization](milestones/v1.0-ROADMAP.md) (Phases 1-4) - SHIPPED 2025-12-26
- [v1.1 Validation Gate](milestones/v1.1-ROADMAP.md) (Phases 5-7) - SHIPPED 2025-12-29
- ✅ **v1.2 PDF Export** - Phase 8 - SHIPPED 2025-12-29
- ✅ **v1.3 Multi-Agent Research** - Phases 9-14 - SHIPPED 2026-01-05
- ✅ **v1.4 Blueprint Chat** - Phases 15-17 - SHIPPED 2026-01-07
- 📋 **v1.6 Persistence** - Planned
- 🚧 **v1.7 Testing** - Phases 19-22 (in progress)
- 📋 **v1.8 Ad Intelligence** - Phases 23-26 (planned)

## Phases

<details>
<summary>v1.0 Stabilization (Phases 1-4) - SHIPPED 2025-12-26</summary>

### Phase 1: Robust JSON Response Handling COMPLETE
**Priority:** Critical | **Effort:** Medium | **Completed:** 2025-12-24

Fix JSON parsing failures by improving extraction and adding validation.

**Tasks:**
1. Add Zod schemas for all 11 media plan section types
2. Validate AI responses against schemas before accepting
3. Improve JSON extraction to handle edge cases (truncated responses, extra text)
4. Add response repair for common malformations (missing closing braces, trailing commas)
5. Return partial results with clear error when validation fails

**Success:** Zero JSON parse errors on valid model outputs

---

### Phase 2: Timeout and Retry Logic COMPLETE
**Priority:** Critical | **Effort:** Medium | **Completed:** 2025-12-25

Add per-section timeouts and intelligent retry logic.

**Tasks:**
1. Implement per-section timeout (45s per section, adjustable)
2. Add exponential backoff retry for transient failures (max 2 retries)
3. Track section timing and detect slow sections
4. Add circuit breaker for repeated failures on same section
5. Return partial media plan if later sections fail

**Success:** 95%+ generation completion rate

---

### Phase 3: Vercel Deployment Compatibility COMPLETE
**Priority:** High | **Effort:** Low | **Completed:** 2025-12-25

Ensure all routes work within Vercel function limits.

**Tasks:**
1. Audit route timeouts against Vercel limits (60s Pro, 10s Hobby)
2. Add streaming response for long-running generations (if needed)
3. Validate environment variable loading on Vercel
4. Test cold start performance
5. Add health check endpoint

**Success:** Clean deployment with no runtime errors

---

### Phase 4: Error Reporting and Recovery COMPLETE
**Priority:** Medium | **Effort:** Low | **Completed:** 2025-12-26

Better error visibility and graceful degradation.

**Tasks:**
1. Add structured error responses with error codes
2. Surface specific failure reasons to UI (timeout, rate limit, parse error)
3. Allow user to retry from failed section
4. Add error boundary in React UI
5. Log errors with request context for debugging

**Success:** Users see clear error messages and can retry

</details>

<details>
<summary>v1.1 Validation Gate (Phases 5-7) - SHIPPED 2025-12-29</summary>

### Phase 5: Strategic Research Review UI COMPLETE
**Goal**: Display strategic research output in reviewable format with section cards
**Depends on**: Milestone 1 complete
**Plans**: 2
**Completed**: 2025-12-26

Plans:
- [x] 05-01: Review Card Foundation (SectionCard component + content renderers)
- [x] 05-02: Review UI and Integration (StrategicResearchReview + /generate page)

### Phase 6: Inline Edit Capability COMPLETE
**Goal**: Enable click-to-edit on text fields with save/discard functionality
**Depends on**: Phase 5
**Plans**: 2
**Completed**: 2025-12-29

Plans:
- [x] 06-01: EditableText Component Foundation (EditableText + EditableList components)
- [x] 06-02: Section Integration & Edit State (integrate into renderers, wire state)

### Phase 7: Approval Flow COMPLETE
**Goal**: Add approve/edit mode toggle, store user edits, feed approved data to media plan pipeline
**Depends on**: Phase 6
**Plans**: 1
**Completed**: 2025-12-29

Plans:
- [x] 07-01: Approval Flow (createApprovedBlueprint helper, localStorage persistence)

</details>

---

<details>
<summary>v1.2 PDF Export (Phase 8) - SHIPPED 2025-12-29</summary>

### Phase 8: PDF Export Enhancement COMPLETE
**Goal**: HTML-to-canvas PDF generation with full visual styling
**Depends on**: v1.1 complete
**Plans**: 1
**Completed**: 2025-12-29

Plans:
- [x] 08-01: HTML-to-Canvas PDF Generation (PdfExportContent + html2canvas capture)

</details>

---

### ✅ v1.3 Multi-Agent Research (Complete)

Transform from single-model to multi-agent research pipeline. Integrate Perplexity, OpenAI o3, Google Gemini, and Claude Opus through OpenRouter for real-time market intelligence with citations.

**Milestone Goal:** Real-time, verified, and cited strategic blueprints using specialized research agents per section.

#### Phase 9: OpenRouter Multi-Model Support COMPLETE
**Goal**: Add Perplexity, OpenAI o3, Gemini, Claude Opus models to OpenRouter client
**Depends on**: v1.2 complete
**Completed**: 2026-01-05
**Plans**: 1/1

Plans:
- [x] 09-01: Multi-model support with reasoning parameters

#### Phase 10: Research Agent Infrastructure COMPLETE
**Goal**: Create research agent abstraction with citation extraction and multi-step pipelines
**Depends on**: Phase 9
**Completed**: 2026-01-05
**Plans**: 2/2

Plans:
- [x] 10-01: Citation Types & OpenRouter Extension
- [x] 10-02: Research Agent Abstraction

#### Phase 11: Section 4 Competitor Analysis Enhancement COMPLETE
**Goal**: Competitor Analysis with Perplexity + o3 Deep Research for real-time competitor intel
**Depends on**: Phase 10
**Completed**: 2026-01-05
**Plans**: 1/1

Plans:
- [x] 11-01: Perplexity Deep Research integration for Section 4

#### Phase 12: Section 1 Industry Market Enhancement COMPLETE
**Goal**: Industry Market with Perplexity Deep Research + citations for real-time market data
**Depends on**: Phase 11
**Completed**: 2026-01-05
**Plans**: 1/1

Plans:
- [x] 12-01: Perplexity Deep Research integration for Section 1

#### Phase 13: Sections 2-3 Enhancement COMPLETE
**Goal**: ICP Analysis + Offer Analysis with research agents for verified data
**Depends on**: Phase 12
**Completed**: 2026-01-05
**Plans**: 1/1

Plans:
- [x] 13-01: Perplexity Deep Research integration for Sections 2-3

#### Phase 14: Citations UI & Cost Tracking COMPLETE
**Goal**: Display inline citations and sources section in review UI, per-agent cost tracking
**Depends on**: Phase 13
**Completed**: 2026-01-05
**Plans**: 1/1

Plans:
- [x] 14-01: CitationBadge, SourcesList components, cost display in header

---

### ✅ v1.4 Blueprint Chat (Complete)

RAG-powered conversational interface for interacting with Strategic Blueprints. Ask questions, request explanations, and make edits through natural language.

**Milestone Goal:** Users can chat with their blueprints to understand content, get explanations, and make targeted edits.

**Spec:** [Blueprint_AI_Chat_RAG_Specification_OpenRouter.md](docs/Blueprint_AI_Chat_RAG_Specification_OpenRouter.md)

#### Phase 15: RAG Foundation COMPLETE
**Goal**: Set up pgvector, chunking, embeddings, and basic Q&A agent
**Depends on**: v1.3 complete
**Research**: Likely (pgvector setup, OpenRouter embeddings API)
**Research topics**: pgvector Supabase setup, vector index tuning, OpenRouter embeddings endpoint
**Plans**: 4/4 complete

Plans:
- [x] 15-01: Database Foundation (pgvector, blueprints, blueprint_chunks tables)
- [x] 15-02: Embeddings & Chunking (OpenRouterClient embeddings, semantic chunking, storage service)
- [x] 15-03: Retrieval Service & Chat API (retrieval service, Q&A agent, chat endpoint)
- [x] 15-04: Chat UI Integration

#### Phase 16: Edit Capability COMPLETE
**Goal**: Intent router, Edit agent, confirmation flow, version history
**Depends on**: Phase 15
**Research**: Unlikely (builds on existing patterns)
**Completed**: 2026-01-07
**Plans**: 3/3 complete

Plans:
- [x] 16-01: Intent Router (ChatIntent types, classifyIntent service, API routing)
- [x] 16-02: Edit Agent & Version History (edit-agent.ts, blueprint_versions table, apply_blueprint_edit RPC)
- [x] 16-03: Edit Confirmation Flow (session-based chat with edit detection, confirm/cancel UI)

#### Phase 17: Explain Agent COMPLETE
**Goal**: Explain agent for reasoning explanations, related factors, polished chat UX
**Depends on**: Phase 16
**Research**: Unlikely (established agent patterns)
**Completed**: 2026-01-07
**Plans**: 1/1 complete

Plans:
- [x] 17-01: Explain Agent & Chat UX Polish (explain-agent.ts, API integration, response formatting)

---

### ✅ v1.5 Chat Streaming (Complete)

Streaming responses for Blueprint Chat to improve perceived responsiveness and UX.

**Milestone Goal:** Real-time token streaming for chat responses instead of waiting for full completion.

#### Phase 18: Chat Streaming COMPLETE
**Goal**: Add SSE streaming to OpenRouter client and chat API for real-time response display
**Depends on**: Phase 17
**Completed**: 2026-01-07
**Plans**: 1/1 complete

Plans:
- [x] 18-01: OpenRouter streaming support and chat API streaming endpoint

---

### 📋 v1.7 Testing (Planned)

Comprehensive test coverage for the AI-GOS application with unit, integration, and end-to-end tests.

**Milestone Goal:** Reliable, maintainable codebase with automated testing for all critical paths.

#### Phase 19: Test Infrastructure
**Goal**: Set up Vitest, test utilities, and mocks for OpenRouter/Supabase
**Depends on**: v1.5 complete
**Research**: Unlikely (standard Vitest patterns)
**Plans**: TBD

Plans:
- [ ] 19-01: TBD (run /gsd:plan-phase 19 to break down)

#### Phase 20: Unit Tests Core
**Goal**: Unit tests for JSON extraction, Zod schemas, and utility functions
**Depends on**: Phase 19
**Research**: Unlikely (internal patterns)
**Plans**: TBD

Plans:
- [ ] 20-01: TBD

#### Phase 21: Integration Tests
**Goal**: Integration tests for pipeline stages, API routes, and RAG retrieval
**Depends on**: Phase 20
**Research**: Likely (testing RAG/embeddings patterns)
**Research topics**: Testing vector search, mocking embeddings API, API route testing
**Plans**: TBD

Plans:
- [ ] 21-01: TBD

#### Phase 22: E2E Tests
**Goal**: End-to-end tests for critical user flows (generate blueprint, chat)
**Depends on**: Phase 21
**Research**: Likely (Playwright/Cypress setup)
**Research topics**: Next.js E2E testing, Playwright vs Cypress, CI integration
**Plans**: TBD

Plans:
- [ ] 22-01: TBD

---

### 📋 v1.8 Ad Intelligence (Planned)

Enrich competitor analysis with real ad data from LinkedIn, Meta, and Google Ad Libraries, plus verified competitor insights (offers, pricing, creatives).

**Milestone Goal:** Real competitor ad creatives and intelligence integrated into Section 4 with carousel display.

**API Reference:** SearchAPI.io Ad Libraries (LinkedIn, Meta, Google Ads Transparency Center)

#### Phase 23: Ad Library Service COMPLETE
**Goal**: SearchAPI.io integration for all 3 platforms (LinkedIn, Meta, Google)
**Depends on**: v1.7 complete
**Research**: Unlikely (APIs tested in test-ad-libraries-local.ts)
**Completed**: 2026-01-09
**Plans**: 1/1

Plans:
- [x] 23-01: Ad Library Service (types, service class, env config)

#### Phase 24: Competitor Ad Research COMPLETE
**Goal**: Integrate ad fetching into Section 4 pipeline, extract insights per competitor
**Depends on**: Phase 23
**Research**: Unlikely (existing research agent patterns)
**Completed**: 2026-01-09
**Plans**: 1/1

Plans:
- [x] 24-01: Ad integration into competitor-research.ts

#### Phase 25: Creative Carousel UI
**Goal**: Display competitor ads in carousel with images, headlines, platform badges
**Depends on**: Phase 24
**Research**: Unlikely (UI component work)
**Plans**: TBD

Plans:
- [ ] 25-01: TBD

#### Phase 26: Competitor Intel Enhancement
**Goal**: True offers, pricing tiers, and positioning from research + ads
**Depends on**: Phase 25
**Research**: Likely (pricing/offer extraction patterns)
**Research topics**: Structured pricing extraction, competitor positioning analysis
**Plans**: TBD

Plans:
- [ ] 26-01: TBD

---

### Future Milestones

#### v1.6 Persistence
- Save blueprints and media plans to Supabase
- User project history
- Re-generate from saved inputs

---

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1. JSON Handling | v1.0 | 3/3 | Complete | 2025-12-24 |
| 2. Timeout/Retry | v1.0 | 2/2 | Complete | 2025-12-25 |
| 3. Vercel Deploy | v1.0 | 1/1 | Complete | 2025-12-25 |
| 4. Error Reporting | v1.0 | 2/2 | Complete | 2025-12-26 |
| 5. Research Review UI | v1.1 | 2/2 | Complete | 2025-12-26 |
| 6. Inline Edit | v1.1 | 2/2 | Complete | 2025-12-29 |
| 7. Approval Flow | v1.1 | 1/1 | Complete | 2025-12-29 |
| 8. PDF Export Enhancement | v1.2 | 1/1 | Complete | 2025-12-29 |
| 9. OpenRouter Multi-Model | v1.3 | 1/1 | Complete | 2026-01-05 |
| 10. Research Agent Infra | v1.3 | 2/2 | Complete | 2026-01-05 |
| 11. Section 4 Enhancement | v1.3 | 1/1 | Complete | 2026-01-05 |
| 12. Section 1 Enhancement | v1.3 | 1/1 | Complete | 2026-01-05 |
| 13. Sections 2-3 Enhancement | v1.3 | 1/1 | Complete | 2026-01-05 |
| 14. Citations UI & Cost | v1.3 | 1/1 | Complete | 2026-01-05 |
| 15. RAG Foundation | v1.4 | 4/4 | Complete | 2026-01-07 |
| 16. Edit Capability | v1.4 | 3/3 | Complete | 2026-01-07 |
| 17. Explain Agent | v1.4 | 1/1 | Complete | 2026-01-07 |
| 18. Chat Streaming | v1.5 | 1/1 | Complete | 2026-01-07 |
| 19. Test Infrastructure | v1.7 | 0/? | Not started | - |
| 20. Unit Tests Core | v1.7 | 0/? | Not started | - |
| 21. Integration Tests | v1.7 | 0/? | Not started | - |
| 22. E2E Tests | v1.7 | 0/? | Not started | - |
| 23. Ad Library Service | v1.8 | 1/1 | Complete | 2026-01-09 |
| 24. Competitor Ad Research | v1.8 | 1/1 | Complete | 2026-01-09 |
| 25. Creative Carousel UI | v1.8 | 0/? | Not started | - |
| 26. Competitor Intel Enhancement | v1.8 | 0/? | Not started | - |

---

*Created: 2025-12-24*
*Updated: 2026-01-09 (Phase 24 complete)*
