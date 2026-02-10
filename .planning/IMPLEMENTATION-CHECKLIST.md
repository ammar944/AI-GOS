# Implementation Checklist

## Files Created ✅

```
/src/lib/ai/
├── providers.ts      ✅ Provider instances, model config
├── types.ts          ✅ Shared types
├── research.ts       ✅ All 5 research functions
├── generator.ts      ✅ Main orchestrator with parallel execution
└── schemas/
    ├── index.ts              ✅ Exports
    ├── industry-market.ts    ✅ Enhanced schema
    ├── icp-analysis.ts       ✅ Enhanced schema
    ├── offer-analysis.ts     ✅ Enhanced schema
    ├── competitor-analysis.ts ✅ Enhanced schema
    └── cross-analysis.ts     ✅ Enhanced schema
```

## To Do

### Step 1: Install Packages
```bash
cd /Users/ammar/Dev-Projects/AI-GOS-main
pnpm add ai @ai-sdk/perplexity @ai-sdk/anthropic
```

### Step 2: Update Environment
```env
# Ensure these are set in .env.local
PERPLEXITY_API_KEY=pplx-xxx
ANTHROPIC_API_KEY=sk-ant-xxx
```

### Step 3: Fix Import Paths
The generator.ts imports existing modules that need verification:
```typescript
import { scrapePricingForCompetitors } from '@/lib/firecrawl';
import { fetchCompetitorAdsWithFallback } from '@/lib/ad-library';
```
Verify these paths match your actual file structure.

### Step 4: Update API Route
Update `/api/strategic-blueprint/generate/route.ts` to use the new generator:
```typescript
import { generateStrategicBlueprint } from '@/lib/ai/generator';
```

### Step 5: Test
```bash
pnpm dev
# Test with sample onboarding data
```

### Step 6: Delete Old Code (after testing)
- `/lib/openrouter/`
- `/lib/research/`
- `/lib/strategic-blueprint/pipeline/*-research.ts`

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│  Phase 1: Parallel (~15s)                                       │
│  ├── Section 1: Industry/Market     (Sonar Pro)                │
│  └── Section 4: Competitors         (Sonar Pro + Firecrawl)    │
├─────────────────────────────────────────────────────────────────┤
│  Phase 2: Sequential (~30s)                                     │
│  ├── Section 2: ICP Validation      (Sonar Reasoning Pro)      │
│  └── Section 3: Offer Analysis      (Sonar Reasoning Pro)      │
├─────────────────────────────────────────────────────────────────┤
│  Phase 3: Synthesis (~30s)                                      │
│  └── Section 5: Cross-Analysis      (Claude Sonnet 4)          │
└─────────────────────────────────────────────────────────────────┘

Total: ~75 seconds
Cost: ~$0.34 per generation
```

## Model Strategy

| Section | Model | Why |
|---------|-------|-----|
| 1. Industry/Market | Sonar Pro | Research aggregation |
| 2. ICP Validation | **Sonar Reasoning Pro** | Needs judgment |
| 3. Offer Analysis | **Sonar Reasoning Pro** | Needs scoring |
| 4. Competitors | Sonar Pro + **Firecrawl** | Real pricing |
| 5. Synthesis | Claude Sonnet 4 | Best prose |

## Data Quality

| Data Type | Source |
|-----------|--------|
| Market trends | Perplexity |
| Pain points | Perplexity |
| ICP validation | Perplexity Reasoning |
| Offer scoring | Perplexity Reasoning |
| **Competitor pricing** | **Firecrawl** |
| **Ad creatives** | **Ad Library** |
| Strategic synthesis | Claude |
