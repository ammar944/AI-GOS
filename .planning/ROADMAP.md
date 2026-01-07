# Roadmap

## Milestones

- [v1.0 Stabilization](milestones/v1.0-ROADMAP.md) (Phases 1-4) - SHIPPED 2025-12-26
- [v1.1 Validation Gate](milestones/v1.1-ROADMAP.md) (Phases 5-7) - SHIPPED 2025-12-29
- ✅ **v1.2 PDF Export** - Phase 8 - SHIPPED 2025-12-29
- ✅ **v1.3 Multi-Agent Research** - Phases 9-14 - SHIPPED 2026-01-05
- 🚧 **v1.4 Blueprint Chat** - Phases 15-17 (in progress)
- v1.5 Persistence - Planned
- v1.6 Testing - Planned

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

### 🚧 v1.4 Blueprint Chat (In Progress)

RAG-powered conversational interface for interacting with Strategic Blueprints. Ask questions, request explanations, and make edits through natural language.

**Milestone Goal:** Users can chat with their blueprints to understand content, get explanations, and make targeted edits.

**Spec:** [Blueprint_AI_Chat_RAG_Specification_OpenRouter.md](docs/Blueprint_AI_Chat_RAG_Specification_OpenRouter.md)

#### Phase 15: RAG Foundation
**Goal**: Set up pgvector, chunking, embeddings, and basic Q&A agent
**Depends on**: v1.3 complete
**Research**: Likely (pgvector setup, OpenRouter embeddings API)
**Research topics**: pgvector Supabase setup, vector index tuning, OpenRouter embeddings endpoint
**Plans**: TBD

Plans:
- [ ] 15-01: TBD (run /gsd:plan-phase 15 to break down)

#### Phase 16: Edit Capability
**Goal**: Intent router, Edit agent, confirmation flow, version history
**Depends on**: Phase 15
**Research**: Unlikely (builds on existing patterns)
**Plans**: TBD

Plans:
- [ ] 16-01: TBD

#### Phase 17: Explain Agent
**Goal**: Explain agent for reasoning explanations, related factors, polished chat UX
**Depends on**: Phase 16
**Research**: Unlikely (established agent patterns)
**Plans**: TBD

Plans:
- [ ] 17-01: TBD

---

### Future Milestones

#### v1.5 Persistence
- Save blueprints and media plans to Supabase
- User project history
- Re-generate from saved inputs

#### v1.6 Testing
- Vitest setup
- Unit tests for JSON extraction
- Integration tests for pipeline stages

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
| 15. RAG Foundation | v1.4 | 0/? | Not started | - |
| 16. Edit Capability | v1.4 | 0/? | Not started | - |
| 17. Explain Agent | v1.4 | 0/? | Not started | - |

---

*Created: 2025-12-24*
*Updated: 2026-01-07 (v1.4 Blueprint Chat milestone created)*
