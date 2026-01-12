# Project State

**Last Updated:** 2026-01-12
**Current Phase:** 29 (Onboarding Refresh) - IN PROGRESS
**Current Plan:** 29-02-PLAN.md (ready to execute)

## Position

```
Milestone 1: Stabilization COMPLETE (archived)
├── Phase 1: Robust JSON Response Handling DONE
├── Phase 2: Timeout and Retry Logic DONE
├── Phase 3: Vercel Deployment Compatibility DONE
└── Phase 4: Error Reporting and Recovery DONE

Milestone 2: Validation Gate (v1.1) COMPLETE (archived)
├── Phase 5: Strategic Research Review UI DONE
├── Phase 6: Inline Edit Capability DONE
└── Phase 7: Approval Flow DONE

Milestone 3: PDF Export (v1.2) COMPLETE (archived)
└── Phase 8: PDF Export Enhancement DONE

Milestone 4: Multi-Agent Research (v1.3) COMPLETE (archived)
├── Phase 9: OpenRouter Multi-Model Support DONE
├── Phase 10: Research Agent Infrastructure DONE
├── Phase 11: Section 4 Competitor Analysis Enhancement DONE
├── Phase 12: Section 1 Industry Market Enhancement DONE
├── Phase 13: Sections 2-3 Enhancement DONE
└── Phase 14: Citations UI & Cost Tracking DONE

Milestone 5: Blueprint Chat (v1.4) COMPLETE (archived)
├── Phase 15: RAG Foundation DONE
├── Phase 16: Edit Capability DONE
└── Phase 17: Explain Agent DONE

Milestone 6: Chat Streaming (v1.5) COMPLETE (archived)
└── Phase 18: Chat Streaming DONE

Milestone 7: Testing (v1.7) IN PROGRESS
├── Phase 19: Test Infrastructure (2/2 plans) DONE
├── Phase 20: Unit Tests Core (3/3 plans) DONE
├── Phase 21: Integration Tests (3/3 plans) DONE
└── Phase 22: E2E Tests

Milestone 8: Ad Intelligence (v1.8) COMPLETE
├── Phase 23: Ad Library Service DONE
├── Phase 24: Competitor Ad Research DONE
├── Phase 25: Creative Carousel UI DONE
└── Phase 26: Competitor Intel Enhancement DONE

Milestone 9: Design Refresh (v2.0) IN PROGRESS
├── Phase 27: Design Foundation (2/2 plans) DONE
├── Phase 28: Core Components (1/1 plans) DONE
├── Phase 29: Onboarding Refresh (1/5 plans) IN PROGRESS
├── Phase 30: Generation UI
├── Phase 31: Output Display
└── Phase 32: Chat Panel
```

Phase: 29 of 32 (Onboarding Refresh)
Plan: 2 of 5 in current phase
Status: In progress
Last activity: 2026-01-12 - Completed 29-02-PLAN.md

Progress: ███████████████░ 90% (28/32 phases complete + 29 in progress)

## Decisions

| Date | Phase | Decision | Rationale |
|------|-------|----------|-----------|
| 2025-12-24 | 1 | Use Zod for validation | TypeScript-first, standard choice |
| 2025-12-24 | 1 | Split phase into 3 plans | Scope ~100% context, need atomic commits |
| 2025-12-24 | 1 | 3+ sections = partial result | Provide value even on failure |
| 2025-12-24 | 01-01 | Use passthrough() for AI flexibility | Allow extra fields from AI responses |
| 2025-12-25 | 02-01 | Use native AbortController | No external dependencies for timeout |
| 2025-12-25 | 02-01 | 45s section timeout | Matches typical AI response times with buffer |
| 2025-12-25 | 02-01 | 30s slow threshold | Catches notably slow sections for logging |
| 2025-12-25 | 02-01 | Longer backoff for 429 | Rate limits need more recovery time |
| 2025-12-25 | 02-02 | Module-level circuit breaker | Shared state across all generations |
| 2025-12-25 | 02-02 | 3 failure threshold | Balance between too sensitive/tolerant |
| 2025-12-25 | 02-02 | 1 minute reset timeout | Give API time to recover |
| 2025-12-25 | 03-01 | Health endpoint returns 200 for ok/degraded | Allow monitoring while degraded |
| 2025-12-25 | 03-01 | Env validation doesn't throw | App starts and reports health vs crash |
| 2025-12-25 | 04-01 | Automatic retryability by code | TIMEOUT/RATE_LIMITED/CIRCUIT_OPEN = true |
| 2025-12-25 | 04-01 | HTTP status by error type | 400/502/503/500 based on ErrorCode |
| 2025-12-26 | 04-02 | ErrorBoundary wraps entire app | Catch unhandled React errors globally |
| 2025-12-26 | 04-02 | Code-aware error messages | Human-readable messages per ErrorCode |
| 2025-12-26 | v1.1 | Strategic research only at gate | User reviews research before media plan |
| 2025-12-26 | v1.1 | Inline text editing for edits | Click-to-edit UX, not forms or rich text |
| 2025-12-26 | 05-01 | CSS max-h for expand/collapse | Simple, performant vs JS height calculation |
| 2025-12-26 | 05-01 | Copy helpers to section-content | Maintain consistency, enable future editability |
| 2025-12-26 | 05-02 | Multiple sections can expand | Allow comparison between sections |
| 2025-12-26 | 05-02 | Auto-scroll to next unreviewed | Smooth UX flow through review process |
| 2025-12-26 | 05-02 | Resume goes to review-blueprint | Ensure review happens before proceeding |
| 2025-12-26 | 06-01 | Controlled Input vs contenteditable | Predictable behavior, shadcn/ui consistency |
| 2025-12-26 | 06-01 | Hover-visible remove button | Cleaner UI, less visual clutter |
| 2025-12-29 | 07-01 | approvalMetadata as separate field | Clean separation from generation metadata |
| 2025-12-29 | 07-01 | Dynamic button label for edits | Clear UX signal when edits will be applied |
| 2025-12-29 | 08-01 | HTML-to-canvas PDF generation | Exact visual match with review UI |
| 2025-12-29 | 08-01 | Inline styles for PDF component | Avoid CSS variable parsing issues with html2canvas |
| 2025-12-29 | 08-01 | Scale 2x for canvas capture | High-quality PDF output |
| 2026-01-05 | 09-01 | Set<string> for model capability sets | TypeScript type compatibility with string params |
| 2026-01-05 | 10-01 | Prefer searchResults over citations | New Perplexity format (May 2025) has richer metadata |
| 2026-01-05 | 10-02 | Wrap existing OpenRouterClient | No duplication, ResearchAgent delegates to client |
| 2026-01-05 | 10-02 | Separate citation cost tracking | Perplexity citation tokens priced differently |
| 2026-01-05 | 10-02 | Empty citations for JSON-validated | chatJSONValidated doesn't preserve citations |
| 2026-01-05 | 11-01 | Use research() for citations | researchJSON() doesn't preserve citations, manual parse needed |
| 2026-01-05 | 11-01 | 120s timeout for deep research | Multi-step web search takes longer than standard 45s |
| 2026-01-05 | 11-01 | Defensive JSON validation | Parse and validate manually with fallback defaults |
| 2026-01-05 | 11-01 | Version 1.1 for metadata | Reflect multi-model architecture change |
| 2026-01-05 | 12-01 | Copy JSON helpers from competitor-research | Consistency, same parsing patterns |
| 2026-01-05 | 12-01 | Defensive enum defaults | marketMaturity=growing, awarenessLevel=medium, buyingBehavior=mixed |
| 2026-01-05 | 13-01 | Context chaining for research | ICP receives industry context, Offer receives ICP context |
| 2026-01-05 | 13-01 | Score averaging for offers | Overall score = average of 6 sub-scores with 1-decimal precision |
| 2026-01-05 | 14-01 | Collapsible for sources | Consistent with shadcn patterns, clean UX |
| 2026-01-05 | 14-01 | 4 decimal cost precision | Appropriate for API costs ($0.0123 format) |
| 2026-01-07 | 15-01 | IVFFlat with 100 lists | Appropriate for initial scale, can tune later |
| 2026-01-07 | 15-01 | vector(1536) dimension | Matches text-embedding-3-small output |
| 2026-01-07 | 15-01 | SECURITY DEFINER for RPC | Enables proper RLS bypass during search |
| 2026-01-07 | 15-02 | Semantic chunking by unit type | Pain points individually, competitors as units for better retrieval |
| 2026-01-07 | 15-02 | Batch embedding generation | Single API call for all chunks minimizes cost |
| 2026-01-07 | 15-03 | Match threshold 0.65 for API | Lower than 0.7 default for better recall in Q&A |
| 2026-01-07 | 15-03 | Chat history limit 6 messages | Control context size while preserving conversation flow |
| 2026-01-07 | 15-03 | Temperature 0.3 for Q&A | More consistent, focused responses for blueprint questions |
| 2026-01-07 | 15-04 | Bottom-left chat button position | Avoid conflict with approval buttons on right |
| 2026-01-07 | 15-04 | z-50 for chat panel layering | Proper visibility above other content |
| 2026-01-07 | 16-01 | CLAUDE_SONNET for intent classification | Haiku not available on OpenRouter, Sonnet fast enough |
| 2026-01-07 | 16-01 | Temperature 0 for classification | Deterministic intent routing |
| 2026-01-07 | 16-01 | Section validation with fallback | crossAnalysisSynthesis default for invalid sections |
| 2026-01-07 | 16-02 | Temperature 0.2 for edit precision | Lower than 0.3 Q&A for deterministic field identification |
| 2026-01-07 | 16-02 | Store full_snapshot BEFORE change | Enables clean rollback to any version |
| 2026-01-07 | 16-02 | Regex for array index paths | Handle "competitors[0].name" → path array conversion |
| 2026-01-07 | 16-03 | Session-based edit flow | Local edit application without DB persistence during review |
| 2026-01-07 | 17-01 | Temperature 0.3 for explain | Same as Q&A for consistent, informative responses |
| 2026-01-07 | 17-01 | maxTokens 1536 for explanations | Explanations need more space than Q&A's 1024 |
| 2026-01-07 | 17-01 | JSON block format for explain detection | Consistent with edit detection pattern |
| 2026-01-07 | 17-01 | Blue styling for explanation messages | Visual distinction from Q&A and edits |
| 2026-01-07 | 18-01 | Regex intent detection for streaming | Avoid extra LLM call; edit/explain keywords → JSON, questions → stream |
| 2026-01-07 | 18-01 | Streaming only for Q&A | Edit/explain need structured JSON for confirmation UI |
| 2026-01-07 | 18-01 | Content-Type based response handling | Client checks text/event-stream vs application/json |
| 2026-01-07 | 18-01 | Separate isStreaming state | Distinct from isLoading for real-time UX updates |
| 2026-01-09 | 23-01 | SearchApiResponse interface | Explicit typing over Record<string, unknown> for API responses |
| 2026-01-09 | 23-01 | 100ms rate limit per platform | Prevent hitting SearchAPI.io rate limits |
| 2026-01-09 | 23-01 | extractDomain helper | Convert company names to domains for Google Ads queries |
| 2026-01-09 | 24-01 | 10 ads per platform per competitor | Balance breadth vs API call volume |
| 2026-01-09 | 24-01 | Graceful degradation without SEARCHAPI_KEY | Research continues without ads if key missing |
| 2026-01-09 | 24-01 | No separate ad cost tracking | SearchAPI.io subscription model, no per-call costs |
| 2026-01-09 | 25-01 | aspect-video for ad image container | Matches typical ad creative aspect ratios |
| 2026-01-09 | 25-01 | Platform brand colors for badges | LinkedIn=#0A66C2, Meta=#1877F2, Google=#4285F4 |
| 2026-01-09 | 25-01 | Loop carousel when >1 ad | Better UX for browsing multiple creatives |
| 2026-01-09 | 26-01 | Regex frequency analysis for ad themes | Simple but effective for extracting 3-5 recurring themes |
| 2026-01-09 | 26-01 | Merge ad-extracted with Perplexity pricing | Prefer research data, fallback to ad extraction |
| 2026-01-09 | 26-01 | "Tier: $Price" format for editable tiers | Simple string format for EditableList compatibility |
| 2026-01-12 | 19-01 | Vitest 4.0 with jsdom environment | Modern test runner, React 19 compatible |
| 2026-01-12 | 19-01 | v8 coverage provider | Faster than istanbul for TypeScript |
| 2026-01-12 | 19-01 | Defer MSW installation | Current mock implementation sufficient, add later if needed |
| 2026-01-12 | 19-02 | AAA pattern for test structure | Arrange-Act-Assert for clarity and consistency |
| 2026-01-12 | 19-02 | vi.useFakeTimers for time-dependent tests | Clean timer mocking for circuit breaker |
| 2026-01-12 | 19-02 | it.each for parameterized tests | Reduce test boilerplate for mapping functions |
| 2026-01-12 | 20-01 | Protected methods for testability | Change private→protected for extractJSON/repairJSON/isValidJSON |
| 2026-01-12 | 20-01 | TestableOpenRouterClient pattern | Subclass in tests to access protected methods cleanly |
| 2026-01-12 | 20-03 | vi.spyOn(Storage.prototype) for mocking | jsdom doesn't allow direct localStorage assignment |
| 2026-01-12 | 20-03 | it.each for model capability tests | Reduces boilerplate for parameterized tests |
| 2026-01-12 | 28-01 | HTMLMotionProps for MagneticButton | React.ComponentPropsWithoutRef caused type conflicts with motion.button |
| 2026-01-12 | 28-01 | useSpring for magnetic reset | Smoother physics-based interpolation during reset |

## Deferred Issues

| ID | From | Description | Priority |
|----|------|-------------|----------|
| - | - | No deferred issues | - |

## Blockers

None.

## Brief Alignment

- **On track:** Yes - v2.0 Design Refresh Phase 29
- **Scope creep:** None
- **Technical concerns:** None

## Roadmap Evolution

- v1.0 Stabilization: 4 phases (Phase 1-4) - SHIPPED 2025-12-26
- v1.1 Validation Gate: 3 phases (Phase 5-7) - SHIPPED 2025-12-29
- v1.2 PDF Export: 1 phase (Phase 8) - SHIPPED 2025-12-29
- v1.3 Multi-Agent Research: 6 phases (Phase 9-14) - SHIPPED 2026-01-05
- v1.4 Blueprint Chat: 3 phases (Phase 15-17) - SHIPPED 2026-01-07
- v1.5 Chat Streaming: 1 phase (Phase 18) - SHIPPED 2026-01-07
- v1.7 Testing: 4 phases (Phase 19-22) - Started 2026-01-08
- v1.8 Ad Intelligence: 4 phases (Phase 23-26) - SHIPPED 2026-01-09
- v2.0 Design Refresh: 6 phases (Phase 27-32) - Created 2026-01-12

## Session Continuity

Last session: 2026-01-12
Stopped at: Completed 29-02-PLAN.md
Resume file: None

---

*v2.0 Design Refresh: Phase 29 in progress (2/5 plans). Ready for 29-03-PLAN.md (Step 2 Form).*
