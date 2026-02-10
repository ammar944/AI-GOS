# Vercel AI SDK Migration Plan

**Created:** 2026-02-03  
**Status:** Ready to Execute  
**Estimated Cost:** ~$0.34 per generation  
**Estimated Time:** ~75 seconds per generation

---

## Overview

Migrate SaasLaunch research generation from OpenRouter to Vercel AI SDK with:
- Native providers (Perplexity, Anthropic)
- Schema-enforced structured outputs
- Multi-model strategy (Sonar Pro + Reasoning Pro + Claude)
- Hybrid data sourcing (AI + Firecrawl + Ad Library)

---

## Model Strategy

| Section | Model | Cost | Latency | Why |
|---------|-------|------|---------|-----|
| 1. Industry/Market | Sonar Pro | ~$0.05 | 5-10s | Research aggregation |
| 2. ICP Validation | **Sonar Reasoning Pro** | ~$0.03 | 10-20s | Judgment & risk assessment |
| 3. Offer Analysis | **Sonar Reasoning Pro** | ~$0.03 | 10-20s | Scoring & recommendations |
| 4. Competitors | Sonar Pro + Firecrawl | ~$0.10 | 15s | Research + real pricing |
| 5. Synthesis | Claude Sonnet 4 | ~$0.08 | 30s | Strategic prose |

**Total: ~$0.34 per generation**

---

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         GENERATION PIPELINE                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PHASE 1: Parallel Research (~15s)                                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Promise.all([                                                   │   │
│  │    Section 1: Industry/Market     → Perplexity Sonar Pro        │   │
│  │    Section 4: Competitors         → Perplexity Sonar Pro        │   │
│  │      + Firecrawl pricing (parallel)                             │   │
│  │      + Ad Library fetch (parallel)                              │   │
│  │  ])                                                              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              ↓                                          │
│  PHASE 2: Sequential Analysis (~30s)                                   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Section 2: ICP Validation        → Sonar Reasoning Pro         │   │
│  │    ← Context: Section 1 results                                  │   │
│  │                                                                   │   │
│  │  Section 3: Offer Analysis        → Sonar Reasoning Pro         │   │
│  │    ← Context: Section 1 + 2 results                              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              ↓                                          │
│  PHASE 3: Synthesis (~30s, streamed)                                   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Section 5: Cross-Analysis        → Claude Sonnet 4             │   │
│  │    ← Context: All sections                                       │   │
│  │    → Streams to client                                          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Quality Strategy

| Data Type | Source | Why |
|-----------|--------|-----|
| Market trends | Perplexity | Good at aggregating recent data |
| Pain points | Perplexity | Synthesizes forums, reviews |
| ICP validation | Perplexity Reasoning | Needs judgment calls |
| Offer scoring | Perplexity Reasoning | Needs analytical thinking |
| **Competitor pricing** | **Firecrawl** | Real data, not hallucinated |
| **Ad creatives** | **Ad Library API** | Real ads, not imagined |
| Strategic synthesis | Claude | Best prose quality |

**Rule:** Perplexity does research, Firecrawl/Ad Library provide truth for specific data.

---

## Package Installation

```bash
cd /Users/ammar/Dev-Projects/AI-GOS-main
pnpm add ai @ai-sdk/perplexity @ai-sdk/anthropic
```

---

## Environment Variables

```env
# Required
PERPLEXITY_API_KEY=pplx-xxx
ANTHROPIC_API_KEY=sk-ant-xxx

# Keep (for Firecrawl)
FIRECRAWL_API_KEY=xxx

# Remove after migration
OPENROUTER_API_KEY=xxx
```

---

## File Structure

```
/src/lib/ai/
├── providers.ts          # Provider instances & model config
├── research.ts           # Research functions (5 sections)
├── types.ts              # Shared types
└── schemas/
    ├── index.ts
    ├── industry-market.ts
    ├── icp-analysis.ts
    ├── offer-analysis.ts
    ├── competitor-analysis.ts
    └── cross-analysis.ts
```

---

## Files to Create/Update

### New Files
| File | Purpose |
|------|---------|
| `/lib/ai/providers.ts` | Provider instances, model constants |
| `/lib/ai/research.ts` | All 5 research functions |
| `/lib/ai/types.ts` | Shared types |
| `/lib/ai/schemas/*.ts` | Enhanced Zod schemas |

### Files to Update
| File | Changes |
|------|---------|
| `strategic-blueprint-generator.ts` | Use new research functions, parallel execution |
| `/api/strategic-blueprint/generate/route.ts` | Minor type updates |

### Files to Delete (after migration)
| File | Reason |
|------|--------|
| `/lib/openrouter/client.ts` | Replaced by Vercel AI SDK |
| `/lib/openrouter/circuit-breaker.ts` | SDK handles retries |
| `/lib/research/agent.ts` | Replaced by `/lib/ai/research.ts` |
| `/lib/strategic-blueprint/pipeline/*-research.ts` | Consolidated into `/lib/ai/research.ts` |

---

## Execution Plan

### Day 1 (Tuesday) - Core Migration

**Morning:**
1. Install packages
2. Create `/lib/ai/providers.ts`
3. Create `/lib/ai/schemas/*.ts` (enhanced with `.describe()`)
4. Create `/lib/ai/research.ts` (all 5 functions)

**Afternoon:**
5. Update `strategic-blueprint-generator.ts`:
   - Import new research functions
   - Implement parallel Phase 1
   - Wire context chaining for Phase 2
6. Test end-to-end with sample data

### Day 2 (Wednesday) - Chat + Polish

7. Migrate chat agents to Vercel AI SDK
8. Test streaming
9. Compare output quality vs old system

### Day 3 (Thursday) - Testing

10. Full E2E testing
11. Performance benchmarks
12. Quality review

### Day 4 (Friday) - Cleanup

13. Delete old OpenRouter code
14. Update documentation
15. Deploy

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Generation time | ~90s | ~75s |
| JSON parse errors | ~5% | 0% |
| Cost per generation | ~$0.25 | ~$0.34 (better quality) |
| Code lines (client) | ~800 | ~200 |
| Pricing accuracy | 60-70% | 95%+ (Firecrawl) |

---

## Rollback Plan

Keep old code until migration is validated:
1. Feature flag: `USE_VERCEL_AI_SDK=true`
2. Can revert by setting to `false`
3. Delete old code after 1 week stable
