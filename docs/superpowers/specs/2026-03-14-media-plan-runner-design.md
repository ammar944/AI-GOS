# Media Plan Runner — Design Spec

## Overview

A new Railway worker runner that produces a 6-block media plan from onboarding data + approved research results. Dispatched by the lead agent like any other research tool. Results flow through the existing workspace (cards, review, approve). No new research — all evidence comes from approved research sections + vendored reference data.

## Architecture

### Execution Model

Single dispatch from lead agent → Railway worker runs 6 sequential `generateObject()` calls (one per block). After each block: validate → write block result to Supabase via `writeResearchResult` → frontend polls → cards appear. After all blocks: cross-block validation → write final validated result.

```
Lead Agent
  └─ dispatchResearch('researchMediaPlan', 'mediaPlan', context)
       └─ Railway Worker (POST /run)
            ├─ Write job_status = 'running' to Supabase
            ├─ Return 202
            └─ Sequential block execution:
                 Block 1: Channel Mix & Budget     → validate → writeResearchResult (status: 'partial') → cards appear
                 Block 2: Audience & Campaign       → validate → writeResearchResult (status: 'partial') → cards appear
                 Block 3: Creative System           → validate → writeResearchResult (status: 'partial') → cards appear
                 Block 4: Measurement & Guardrails  → validate (+ CAC validator) → writeResearchResult (status: 'partial') → cards appear
                 Block 5: Rollout Roadmap           → validate → writeResearchResult (status: 'partial') → cards appear
                 Block 6: Strategy Snapshot         → cross-block validate → writeResearchResult (status: 'complete') → cards appear
```

### Tool Name: `researchMediaPlan` (replaces existing)

The existing `researchMediaPlan` tool and runner are **replaced**, not extended. The tool name stays the same (`researchMediaPlan`) to avoid breaking the existing `TOOL_RUNNERS` map, `ToolName` union, and dispatch infrastructure. The runner implementation changes from the current lightweight media planner to the new 6-block sequential generator.

### Progressive Writes via `writeResearchResult`

The existing `writeResearchResult` function merges into the `research_results` JSONB column. Each block write **accumulates** — the runner builds the result object progressively:

```typescript
// After Block 1:
writeResearchResult(sessionId, 'mediaPlan', {
  status: 'partial',
  data: { channelMixBudget: block1Result, completedBlocks: ['channelMixBudget'] },
  durationMs: elapsed,
})

// After Block 2:
writeResearchResult(sessionId, 'mediaPlan', {
  status: 'partial',
  data: { channelMixBudget: block1Result, audienceCampaign: block2Result, completedBlocks: ['channelMixBudget', 'audienceCampaign'] },
  durationMs: elapsed,
})

// ... after Block 6 + cross-block validation:
writeResearchResult(sessionId, 'mediaPlan', {
  status: 'complete',
  data: { channelMixBudget, audienceCampaign, creativeSystem, measurementGuardrails, rolloutRoadmap, strategySnapshot, validationWarnings, completedBlocks: [...all] },
  durationMs: elapsed,
})
```

The `completedBlocks` array lets the frontend detect which blocks are new since last poll and only parse/render those. This requires **no new Supabase RPC** — the existing `merge_journey_session_research_result` RPC overwrites the `mediaPlan` key in `research_results` JSONB on each call.

### Frontend Integration

The frontend must be updated to recognize `'mediaPlan'` as a valid section:

1. **Add `'mediaPlan'` to `SectionKey` union** in workspace types
2. **Add `'mediaPlan'` to `SECTION_PIPELINE` array** so `WorkspaceResearchBridge` processes it
3. **Update `WorkspaceResearchBridge`** to handle partial results: track rendered blocks per section via `useRef<Set<string>>`. On each poll, diff `completedBlocks` against the ref set, parse only new blocks to `CardState[]`, and append (not replace) cards. This prevents re-rendering already-visible cards and preserves user edits on earlier blocks.
4. **Add card parsers** in `card-taxonomy.ts` for 6 media plan block types

### Block Order and Dependencies

| Order | Block | Inputs | Validator |
|-------|-------|--------|-----------|
| 1 | Channel Mix & Budget | onboarding + all research | Budget math, platform minimums |
| 2 | Audience & Campaign Design | Block 1 + research ICP/competitors | Heuristic range checks against ref data |
| 3 | Creative System | Block 2 + research competitors | Format specs compliance |
| 4 | Measurement & Guardrails | Blocks 1-3 | CAC model (deterministic), KPI reconciliation |
| 5 | Rollout Roadmap | Blocks 1-4 | Phase budget reconciliation, timeline consistency |
| 6 | Strategy Snapshot | Blocks 1-5 | Structured field cross-check (no free-text mutation) |

Each block receives all previous blocks as additional context so later blocks reference earlier decisions.

### Stale Job Timeout

The default `STALE_THRESHOLD_MS` (5 minutes) is too short for 6 sequential `generateObject()` calls. Add a `TOOL_STALE_THRESHOLDS` record in `index.ts`:

```typescript
const TOOL_STALE_THRESHOLDS: Partial<Record<ToolName, number>> = {
  researchMediaPlan: 900_000, // 15 minutes for 6-block sequential generation
}
```

The stale-job detection loop uses `TOOL_STALE_THRESHOLDS[job.tool] ?? STALE_THRESHOLD_MS` when checking job age.

## Skill Architecture (Hybrid)

### Skills (TypeScript constants)

Prompt instructions that tell the model HOW to think about each block. These live in `research-worker/src/skills/` — intentionally separate from `src/lib/ai/prompts/skills/` because the Railway worker is a standalone process that cannot import from `src/lib/`. This is the same pattern used by the existing runner skill imports.

```
research-worker/src/skills/
├── channel-mix-skill.ts          # Block 1 prompt
├── audience-campaign-skill.ts    # Block 2 prompt
├── creative-system-skill.ts      # Block 3 prompt
├── measurement-skill.ts          # Block 4 prompt
├── rollout-skill.ts              # Block 5 prompt
├── strategy-snapshot-skill.ts    # Block 6 prompt
```

### Reference Data (vendored `.md` files)

Benchmark tables, platform specs, compliance rules — FACTS that the model references but does not invent. Vendored from `claude-ads` (AgriciDaniel/claude-ads, 928 stars, MIT) and `marketingskills` (coreyhaines31/marketingskills, 13K stars, MIT).

```
research-worker/src/skills/refs/
├── benchmarks.md                 # CPL/CPC/CTR/ROAS by industry (13+ verticals)
├── budget-allocation.md          # 70/20/10 rule, scaling triggers, saturation signals, seasonality
├── platform-specs.md             # Creative specs (dimensions, character limits, safe zones)
├── compliance.md                 # Platform policy rules
├── conversion-tracking.md        # Tracking implementation guides
├── bidding-strategies.md         # Bid strategy decision trees
├── ad-copy-templates.md          # Copy formulas (PAS, BAB, social proof)
├── audience-targeting.md         # Platform targeting capabilities
```

### Industry Templates

Per-vertical defaults vendored from `claude-ads/skills/ads-plan/assets/`.

```
research-worker/src/skills/templates/
├── saas.md
├── ecommerce.md
├── b2b-enterprise.md
├── local-service.md
├── healthcare.md
├── finance.md
├── real-estate.md
├── mobile-app.md
├── info-products.md
├── agency.md
├── generic.md
```

Each template contains: platform mix, campaign architecture, creative strategy, targeting guidelines, budget guidelines, KPI targets for that vertical.

### Reference Loader

Maps each block to only the ref files it needs. Reads and caches `.md` files at module load time (worker is long-running Express process). Falls back to empty string with a console warning if a file is missing — the block still generates but without that reference context.

```typescript
// research-worker/src/skills/loader.ts

const BLOCK_REFS: Record<MediaPlanBlock, string[]> = {
  channelMixBudget:       ['benchmarks.md', 'budget-allocation.md', 'bidding-strategies.md'],
  audienceCampaign:        ['audience-targeting.md', 'benchmarks.md'],
  creativeSystem:          ['platform-specs.md', 'ad-copy-templates.md'],
  measurementGuardrails:   ['conversion-tracking.md', 'compliance.md', 'benchmarks.md'],
  rolloutRoadmap:          ['budget-allocation.md'],
  strategySnapshot:        [],
}

export function loadBlockRefs(block: MediaPlanBlock): string {
  const files = BLOCK_REFS[block]
  return files
    .map(f => {
      try { return refCache.get(f) ?? '' }
      catch { console.warn(`[media-plan] Missing ref: ${f}`); return '' }
    })
    .filter(Boolean)
    .join('\n\n---\n\n')
}

export function loadIndustryTemplate(industry: string): string {
  const file = `${industry}.md`
  try { return templateCache.get(file) ?? templateCache.get('generic.md') ?? '' }
  catch { console.warn(`[media-plan] Missing template: ${file}, using generic`); return '' }
}
```

## Anti-Hallucination Contract

Every media plan agent call must follow these rules:

1. Do not use model memory for benchmarks, platform rules, compliance rules, or conversion rate assumptions.
2. Only synthesize from: onboarding inputs, approved research results, loaded skill prompts, loaded reference files, deterministic calculations.
3. If a number is not evidenced by a reference file or research result, do not invent it.
4. AI generates CAC model using skill/ref data. Deterministic validator corrects the math post-generation.
5. After each block generation, the runner appends to the system prompt: "Use only the provided reference data and research results. Do not infer unsupported facts."
6. No Google Ads / Meta Ads / GA4 API calls — all benchmarks come from vendored reference data.
7. All benchmark numbers are labeled as `industry benchmark` (never `live account data`).

## Output Schemas

### Block 1: Channel Mix & Budget

```typescript
const channelMixBudgetSchema = z.object({
  platforms: z.array(z.object({
    name: z.string(),
    role: z.enum(['primary-acquisition', 'retargeting', 'awareness', 'testing']),
    monthlySpend: z.number().min(0),
    percentage: z.number().min(0).max(100),
    expectedCPL: z.object({ low: z.number().min(0), high: z.number().min(0) }),
    rationale: z.string(),
  })),
  budgetSummary: z.object({
    totalMonthly: z.number().min(0),
    funnelSplit: z.object({
      awareness: z.number().min(0).max(100),
      consideration: z.number().min(0).max(100),
      conversion: z.number().min(0).max(100),
    }),
    rampUpWeeks: z.number().int().min(1),
  }),
  dailyCeilings: z.array(z.object({
    platform: z.string(),
    dailyBudget: z.number().min(0),
    minimumMet: z.boolean(),
  })),
})
```

**Cards**: one `platform-card` per platform + one `budget-summary` card.

### Block 2: Audience & Campaign Design

```typescript
const audienceCampaignSchema = z.object({
  segments: z.array(z.object({
    name: z.string(),
    description: z.string(),
    targetingParams: z.record(z.string(), z.unknown()),
    estimatedReach: z.string(),
    funnelPosition: z.enum(['top', 'mid', 'bottom']),
    priority: z.number().int().min(1).max(10),
  })),
  campaigns: z.array(z.object({
    platform: z.string(),
    name: z.string(),
    objective: z.string(),
    adSets: z.array(z.object({
      name: z.string(),
      segment: z.string(),
      budget: z.number().min(0),
    })),
    namingConvention: z.string(),
  })),
  retargetingSegments: z.array(z.object({
    name: z.string(),
    source: z.string(),
    windowDays: z.number().int().min(1).max(180),
    estimatedSize: z.string(),
  })),
})
```

**Cards**: one `segment-card` per segment + one `campaign-card` per platform.

### Block 3: Creative System

```typescript
const creativeSystemSchema = z.object({
  angles: z.array(z.object({
    theme: z.string(),
    hook: z.string(),
    messagingApproach: z.string(),
    targetSegment: z.string(),
  })),
  formatSpecs: z.array(z.object({
    platform: z.string(),
    format: z.string(),
    dimensions: z.string(),
    duration: z.string().optional(),
    copyLimits: z.object({
      headline: z.number().int().min(1),
      description: z.number().int().min(1),
    }),
  })),
  testingPlan: z.object({
    firstTests: z.array(z.string()),
    methodology: z.string(),
    minBudgetPerTest: z.number().min(0),
  }),
  refreshCadence: z.object({
    frequencyDays: z.number().int().min(1),
    fatigueSignals: z.array(z.string()),
  }),
})
```

**Cards**: one `creative-angle` card per angle + one `format-spec` card + one `testing-plan` card.

### Block 4: Measurement & Guardrails

```typescript
const measurementGuardrailsSchema = z.object({
  kpis: z.array(z.object({
    metric: z.string(),
    target: z.number(),
    industryBenchmark: z.number(),
    benchmarkSource: z.string(),
    measurementMethod: z.string(),
  })),
  cacModel: z.object({
    targetCAC: z.number().min(0),
    expectedCPL: z.number().min(0),
    leadToSqlRate: z.number().min(0).max(1),
    sqlToCustomerRate: z.number().min(0).max(1),
    expectedLeadsPerMonth: z.number().min(0),
    expectedSQLsPerMonth: z.number().min(0),
    expectedCustomersPerMonth: z.number().min(0),
    ltv: z.number().min(0),
    ltvCacRatio: z.number().min(0),
  }),
  risks: z.array(z.object({
    risk: z.string(),
    category: z.enum(['budget', 'creative', 'targeting', 'tracking', 'compliance', 'competitive', 'seasonal']),
    severity: z.enum(['high', 'medium', 'low']),
    likelihood: z.enum(['high', 'medium', 'low']),
    mitigation: z.string(),
    earlyWarning: z.string(),
  })),
  trackingRequirements: z.array(z.object({
    platform: z.string(),
    requirement: z.string(),
    status: z.enum(['required', 'recommended', 'optional']),
  })),
})
```

**Cards**: `kpi-grid` card + `cac-model` card + one `risk-card` per risk.

### Block 5: Rollout Roadmap

```typescript
const rolloutRoadmapSchema = z.object({
  phases: z.array(z.object({
    name: z.string(),
    duration: z.string(),
    objectives: z.array(z.string()),
    activities: z.array(z.string()),
    successCriteria: z.array(z.string()),
    budgetAllocation: z.number().min(0),
    goNoGo: z.string(),
  })),
  timeline: z.object({
    totalWeeks: z.number().int().min(1),
    monthlyMilestones: z.array(z.object({
      month: z.number().int().min(1),
      milestone: z.string(),
    })),
  }),
})
```

**Cards**: one `phase-card` per phase.

### Block 6: Strategy Snapshot

```typescript
const strategySnapshotSchema = z.object({
  headline: z.string(),
  topPriorities: z.array(z.object({
    priority: z.string(),
    rationale: z.string(),
  })).max(3),
  budgetOverview: z.object({
    total: z.number().min(0),
    topPlatform: z.string(),
    timeToFirstResults: z.string(),
  }),
  expectedOutcomes: z.object({
    leadsPerMonth: z.number().min(0),
    estimatedCAC: z.number().min(0),
    expectedROAS: z.number().min(0).optional(),  // undefined for non-ecommerce businesses
  }),
})
```

`expectedROAS` is optional — for pure lead-gen / B2B businesses where ROAS is not meaningful, the model omits it and the skill prompt instructs: "Only include expectedROAS if the business model has direct e-commerce conversions. For lead-gen businesses, omit this field."

**Cards**: one `strategy-snapshot` card (hero card at the top of the workspace).

### Combined Media Plan Data Schema

The `mediaPlanDataSchema` in `contracts.ts` is **replaced** with a new schema that validates the progressive 6-block structure:

```typescript
const mediaPlanDataSchema = z.object({
  completedBlocks: z.array(z.enum([
    'channelMixBudget', 'audienceCampaign', 'creativeSystem',
    'measurementGuardrails', 'rolloutRoadmap', 'strategySnapshot',
  ])),
  channelMixBudget: channelMixBudgetSchema.optional(),
  audienceCampaign: audienceCampaignSchema.optional(),
  creativeSystem: creativeSystemSchema.optional(),
  measurementGuardrails: measurementGuardrailsSchema.optional(),
  rolloutRoadmap: rolloutRoadmapSchema.optional(),
  strategySnapshot: strategySnapshotSchema.optional(),
  validationWarnings: z.array(z.string()).optional(),
})
```

Each block schema is optional because partial writes contain only the completed blocks. The `completedBlocks` array is the source of truth for which blocks are present. `SECTION_DATA_SCHEMAS['mediaPlan']` points to this new schema. The existing `hasFallbackLanguage()` guard for `'mediaPlan'` remains — it checks for timeout/placeholder language in the data, which is still relevant.

**Schema migration**: The old `mediaPlanDataSchema` (4-field: `channelPlan`, `budgetSummary`, `launchSequence`, `kpiFramework`) is replaced outright. Any existing `mediaPlan` results in Supabase from the old runner will fail the new schema's `safeParse`. This is acceptable — the old lightweight media plan was a research artifact, not a user-facing deliverable. Sessions with old-format results will simply show no media plan cards (the data is still in JSONB but won't parse). No migration needed.

## Deterministic Validators

Run inside the runner after AI generates each block. Validators correct math errors and flag inconsistencies.

### Per-Block Validators

| Block | Validator | What it checks |
|-------|-----------|----------------|
| 1 | `validateBudgetMath` | Platform spend sums to total, daily ceilings = monthly/30, platform minimums met (per `budget-allocation.md` reference) |
| 2 | `validateTargetingHeuristics` | Retargeting window within platform limits (1-180 days), segment count reasonable (1-10), priority values within range. Heuristic checks only — no live traffic data available. |
| 3 | `validateFormatSpecs` | Dimensions match `platform-specs.md` reference values, copy limits within platform maximums, duration within platform limits |
| 4 | `validateCACModel` | CPL × volume = spend, conversion rates within 0-1, LTV:CAC ratio within ref data ranges for the industry vertical |
| 4 | `reconcileKPIs` | KPI targets consistent with CAC model math (e.g., leads/month matches budget/CPL) |
| 5 | `validatePhaseBudgets` | Phase budget allocations sum to total monthly, timeline weeks align with ramp-up from Block 1 |

### Cross-Block Validators (after Block 6)

| Validator | What it checks |
|-----------|----------------|
| `reconcileBudgetAcrossBlocks` | Block 1 totals match Block 4 CAC math match Block 5 phase allocations |
| `validateSnapshotConsistency` | Block 6 `expectedOutcomes.leadsPerMonth` matches Block 4 `cacModel.expectedLeadsPerMonth`, `estimatedCAC` matches `cacModel.targetCAC`, `budgetOverview.total` matches Block 1 `budgetSummary.totalMonthly`. Structured field comparison only — no free-text mutation. |

Note: `sweepStaleReferences` (free-text number mutation) is **removed**. Cross-block validation only compares structured schema fields. If a validator corrects a number in an earlier block, the runner re-generates Block 6 with the corrected inputs rather than patching free-text strings.

## Files Changed

### New Files

```
research-worker/src/runners/media-plan.ts          # 6-block sequential runner (replaces existing)
research-worker/src/skills/channel-mix-skill.ts
research-worker/src/skills/audience-campaign-skill.ts
research-worker/src/skills/creative-system-skill.ts
research-worker/src/skills/measurement-skill.ts
research-worker/src/skills/rollout-skill.ts
research-worker/src/skills/strategy-snapshot-skill.ts
research-worker/src/skills/loader.ts                # Block → ref file loader with caching + fallback
research-worker/src/skills/refs/benchmarks.md       # Vendored from claude-ads
research-worker/src/skills/refs/budget-allocation.md
research-worker/src/skills/refs/platform-specs.md
research-worker/src/skills/refs/compliance.md
research-worker/src/skills/refs/conversion-tracking.md
research-worker/src/skills/refs/bidding-strategies.md
research-worker/src/skills/refs/ad-copy-templates.md   # Vendored from marketingskills
research-worker/src/skills/refs/audience-targeting.md   # Vendored from marketingskills
research-worker/src/skills/templates/saas.md         # Vendored from claude-ads/ads-plan/assets
research-worker/src/skills/templates/ecommerce.md
research-worker/src/skills/templates/b2b-enterprise.md
research-worker/src/skills/templates/local-service.md
research-worker/src/skills/templates/healthcare.md
research-worker/src/skills/templates/finance.md
research-worker/src/skills/templates/real-estate.md
research-worker/src/skills/templates/mobile-app.md
research-worker/src/skills/templates/info-products.md
research-worker/src/skills/templates/agency.md
research-worker/src/skills/templates/generic.md
research-worker/src/validators/media-plan.ts         # Per-block + cross-block validators
```

### Modified Files

```
research-worker/src/runners/index.ts                 # Replace researchMediaPlan runner export
research-worker/src/index.ts                          # Update STALE_THRESHOLD for media plan runner
research-worker/src/contracts.ts                      # Replace mediaPlanDataSchema with 6-block schema
src/lib/ai/tools/research/research-media-plan.ts      # Update context assembly: the tool's execute() reads all approved research results from the conversation messages (same pattern as synthesizeResearch) and concatenates them with onboarding fields into the context string passed to the worker. The runner does NOT query Supabase directly — all input arrives via the context parameter.
src/lib/workspace/card-taxonomy.ts                    # Add card parsers for 6 media plan block types
src/lib/workspace/types.ts                            # Add 'mediaPlan' to SectionKey union
src/lib/workspace/pipeline.ts                         # Add 'mediaPlan' to SECTION_PIPELINE array
src/components/workspace/workspace-page.tsx           # Update WorkspaceResearchBridge to handle partial results via completedBlocks diffing
```

## Data Flow

```
User approves all research sections
  ↓
Lead agent detects research complete (Strategist Mode)
  ↓
Lead agent calls researchMediaPlan({ context: assembledOnboarding + researchResults })
  ↓
dispatchResearch('researchMediaPlan', 'mediaPlan', context)
  ↓
Railway Worker POST /run
  ├─ writeJobStatus('running') to Supabase
  ├─ Return 202
  └─ Runner starts:
       ├─ Detect industry from onboarding fields in context string
       ├─ Load industry template via loadIndustryTemplate(industry)
       ├─ Parse research results from context string (assembled by the tool's execute fn)
       │
       ├─ Block 1: Channel Mix & Budget
       │   ├─ System prompt: channel-mix-skill + loadBlockRefs('channelMixBudget') + industry template
       │   ├─ User prompt: onboarding context + research results summary
       │   ├─ generateObject() with channelMixBudgetSchema
       │   ├─ validateBudgetMath() → correct math, collect warnings
       │   └─ writeResearchResult(sessionId, 'mediaPlan', { status: 'partial', data: { channelMixBudget, completedBlocks: ['channelMixBudget'] } })
       │
       ├─ Block 2: Audience & Campaign
       │   ├─ System prompt: audience-campaign-skill + loadBlockRefs('audienceCampaign') + industry template
       │   ├─ User prompt: onboarding + research + Block 1 output
       │   ├─ generateObject() with audienceCampaignSchema
       │   ├─ validateTargetingHeuristics() → range checks, collect warnings
       │   └─ writeResearchResult(sessionId, 'mediaPlan', { status: 'partial', data: { ...prev, audienceCampaign, completedBlocks: [..., 'audienceCampaign'] } })
       │
       ├─ Block 3: Creative System
       │   ├─ System prompt: creative-system-skill + loadBlockRefs('creativeSystem') + industry template
       │   ├─ User prompt: onboarding + research + Blocks 1-2 output
       │   ├─ generateObject() with creativeSystemSchema
       │   ├─ validateFormatSpecs() → check against platform-specs.md
       │   └─ writeResearchResult(...)
       │
       ├─ Block 4: Measurement & Guardrails
       │   ├─ System prompt: measurement-skill + loadBlockRefs('measurementGuardrails') + industry template
       │   ├─ User prompt: onboarding + research + Blocks 1-3 output
       │   ├─ generateObject() with measurementGuardrailsSchema
       │   ├─ validateCACModel() → correct math, enforce ranges
       │   ├─ reconcileKPIs() → align KPI targets with CAC model
       │   └─ writeResearchResult(...)
       │
       ├─ Block 5: Rollout Roadmap
       │   ├─ System prompt: rollout-skill + loadBlockRefs('rolloutRoadmap') + industry template
       │   ├─ User prompt: Blocks 1-4 output
       │   ├─ generateObject() with rolloutRoadmapSchema
       │   ├─ validatePhaseBudgets() → sum check, timeline alignment
       │   └─ writeResearchResult(...)
       │
       ├─ Block 6: Strategy Snapshot
       │   ├─ System prompt: strategy-snapshot-skill (no refs — summary only)
       │   ├─ User prompt: Blocks 1-5 outputs (validated versions)
       │   ├─ generateObject() with strategySnapshotSchema
       │   └─ (no per-block validator — cross-block handles this)
       │
       ├─ Cross-block validation
       │   ├─ reconcileBudgetAcrossBlocks() → Block 1 ↔ Block 4 ↔ Block 5
       │   ├─ validateSnapshotConsistency() → Block 6 fields match Blocks 1-5
       │   └─ If Block 6 numbers don't match → re-generate Block 6 with corrected inputs
       │
       └─ writeResearchResult(sessionId, 'mediaPlan', { status: 'complete', data: { all 6 blocks + validationWarnings + completedBlocks: [...all] } })
            ↓
Frontend polls via useResearchRealtime()
  ├─ Detects mediaPlan section in research_results
  ├─ Reads completedBlocks, diffs against last render
  ├─ Parses new blocks to CardState[] via card-taxonomy parsers
  ├─ Workspace renders cards progressively
  └─ User reviews, edits, approves each block
```

## Constraints

- No Google Ads / Meta Ads / GA4 API calls
- No Perplexity / Sonar Pro research calls
- All benchmark data sourced from vendored `.md` reference files (claude-ads, marketingskills)
- Model: Sonnet (consistent with other synthesis runners)
- Industry template selected by matching onboarding `businessModel` / `industryVertical` fields
- Runner reads approved research results from Supabase `journey_sessions.research_results`
- Stale job timeout: 15 minutes (override from default 5 minutes)
- Runner replaces existing `researchMediaPlan` — same tool name, new implementation
