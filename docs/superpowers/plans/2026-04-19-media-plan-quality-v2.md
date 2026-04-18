# Media Plan Quality v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the media plan runner pipeline so it stops publishing client-specific CAC/CPL/ROAS numbers, stops forcing SLG funnel on PLG clients, stops inventing channels/jargon, and branches routing on business model + awareness level + DR default. Addresses every item in Mahdy's 2026-04-19 voice transcript on the Choros.io run plus the content-quality items from the 2026-04-18 PDF.

**Architecture:** The skills infrastructure (loader, refs, industry templates) already works. The runner is wired correctly. Three gaps: (1) system prompt is a 16-line stub with no framing, (2) media plan has no `methodologies/` decision frameworks unlike every other runner, (3) schema *requires* client-specific numeric targets the model has no business predicting. Fix = add methodologies + business-model templates + strip numeric fields + classify business model + awareness level on the identity card.

**Tech Stack:** Next.js 15, Vercel AI SDK v6, Anthropic Claude, Supabase (JSONB persistence), Railway-hosted Express worker (separate package — cannot import from `src/lib/`).

**Spec:** This file is the spec + plan.

**Memory:** `project_media_plan_quality_v2.md`

---

## Locked decisions (2026-04-19, do not re-litigate)

1. **Numbers removal — FULL.** All client-specific numeric targets stripped from schema. Industry benchmark *ranges* remain (labeled).
2. **Awareness level — hybrid.** Identity resolver classifies into Schwartz 5 (`unaware | problem-aware | solution-aware | product-aware | most-aware`). Stored on identity card. Editable in review UI.
3. **DR is default.** All accounts direct-response unless explicitly opted into brand mode. Funnel: 85–95% conversion, ≤10% awareness, ≤10% retarget.
4. **Ship iteratively.** Phase 1 = business model classification + awareness level classification + sales cycle bounding + numbers removal + new methodology files. Phase 2 = DR funnel validator + campaign-type pruning + jargon validator + competitor discovery filter.

---

## File Structure (Phase 1)

| File | Purpose | Status |
|---|---|---|
| `research-worker/src/skills/methodologies/media-plan/business-model-routing.md` | Decision tree: businessModel → funnel + KPI + channel bias | **New** |
| `research-worker/src/skills/methodologies/media-plan/awareness-level-routing.md` | Schwartz 5 → channel + funnel + creative approach | **New** |
| `research-worker/src/skills/methodologies/media-plan/sales-cycle-bounding.md` | Cycle bounded by offer structure (trial length, close type) | **New** |
| `research-worker/src/skills/methodologies/media-plan/channel-grounding.md` | Channels must trace to competitor ads ∪ ICP channels ∪ industry defaults | **New** |
| `research-worker/src/skills/templates/business-models/plg.md` | PLG funnel + KPIs + channel bias (product-led, free trial, low-touch) | **New** |
| `research-worker/src/skills/templates/business-models/slg.md` | SLG funnel + KPIs (sales-led, demo required, mid-market to enterprise) | **New** |
| `research-worker/src/skills/templates/business-models/ecommerce.md` | E-commerce funnel (session → ATC → purchase, ROAS-centric) | **New** |
| `research-worker/src/skills/templates/business-models/transactional.md` | One-time purchase, local service, high-intent | **New** |
| `research-worker/src/skills/templates/business-models/marketplace.md` | Two-sided marketplace dynamics | **New** |
| `research-worker/src/skills/loader.ts` | Add `loadBusinessModelTemplate()` + `loadMediaPlanMethodology()` + methodology cache for `media-plan/` subdir | Modify |
| `research-worker/src/identity/resolve-identity.ts` | Add `businessModelType` + `awarenessLevel` classification to identity card | Modify |
| `research-worker/src/contracts.ts` | Strip numeric target fields from Block 1/4/6 schemas; add qualitative replacements | Modify |
| `research-worker/src/runners/media-plan.ts` | Load new methodologies/templates into system prompt per block; inject business model + awareness level + offer structure metadata | Modify |
| `research-worker/src/prompts/runners/media-plan-system.md` | Rebuild from 16-line stub into real frame (business model → awareness → DR default → offer ceiling → grounding → anti-duplication) | Modify |
| `research-worker/src/validators/media-plan.ts` | Add `validateSalesCycleBounds`; remove `validateCACModel` math checks (fields no longer exist); update `reconcileKPIs` for qualitative KPIs | Modify |
| `research-worker/src/runners/__tests__/media-plan-v2.test.ts` | Snapshot tests for new system prompt + schema + classification | **New** |
| `src/lib/journey/field-catalog.ts` | Add read-only `businessModelType` + `awarenessLevel` identityCard field metas (surfaced in review, not user-entered) | Modify |
| `src/components/workspace/cards/media-plan-*.tsx` | Render qualitative KPIs (no numeric targets); remove CAC/CPL/ROAS display | Modify |
| `docs/migrations/2026-04-19-identity-card-classifications.sql` | Supabase migration: no schema change (JSONB merge), but add idempotent backfill script for existing journey_sessions | **New** |

**Files explicitly NOT touched in Phase 1:**
- `research-worker/src/skills/audience-campaign-skill.ts` (Phase 2 — campaign pruning)
- `research-worker/src/skills/*-skill.ts` (Phase 2 — updated in-place to reference methodologies)
- Competitor discovery runners (Phase 2 — active-ads filter)
- Any `src/lib/meeting-intel/` (orthogonal)

---

## Task 1: Create business-model methodology files (TDD foundation)

These are the knowledge files that teach the model how to think. Written in present-tense instructional voice like existing methodology files (`market-opportunity.md`, `audience-refinement.md`).

**Files:**
- Create: `research-worker/src/skills/methodologies/media-plan/business-model-routing.md`
- Create: `research-worker/src/skills/methodologies/media-plan/awareness-level-routing.md`
- Create: `research-worker/src/skills/methodologies/media-plan/sales-cycle-bounding.md`
- Create: `research-worker/src/skills/methodologies/media-plan/channel-grounding.md`

- [ ] **Step 1.1: Write `business-model-routing.md`**

Content structure:
- Opening: "Before drafting any block, classify the business model from the identity card."
- Classification table: for each of PLG / SLG / e-commerce / transactional / marketplace — signals, default funnel, KPI framework, primary channels, gotchas
- PLG section: free trial / freemium / self-serve. Funnel = signup → activation → paid conversion. KPIs = cost per signup, activation rate, free-to-paid. NEVER use lead → SQL → customer. Channels: Meta + YouTube primary, Google supplementary only if solution-aware+, NOT LinkedIn.
- SLG section: demo required, sales team closes. Funnel = lead → SQL → opportunity → customer. KPIs = CPL, SQL rate, sales cycle. LinkedIn primary for B2B, Google search for high-intent, Meta for retargeting.
- E-commerce section: direct purchase. Funnel = session → ATC → purchase. KPIs = CPC, ROAS, AOV, MER. Meta + TikTok + Google Shopping primary.
- Transactional section: local service, one-time purchase. Funnel = click → lead → booking. KPIs = CPL, show rate. Google LSA + search primary, Meta supplementary.
- Marketplace section: two-sided. Separate acquisition strategies for each side. Different KPIs per side.
- Closing: "If businessModel is ambiguous or absent from identity card, default to SLG and flag as `classificationConfidence: low`."

- [ ] **Step 1.2: Write `awareness-level-routing.md`**

Content structure:
- Opening: "Classify market awareness using Eugene Schwartz's 5 levels."
- Level 1 unaware: prospect doesn't know the problem exists. Channel: Meta/TikTok content-led, education-first creative. Funnel: top-heavy but conversion-campaign (no retargeting pool yet). Messaging: problem agitation. NO Google search.
- Level 2 problem-aware: prospect knows problem, doesn't know solution exists. Channel: Meta + YouTube, education + solution reveal. Google display remarketing only.
- Level 3 solution-aware: prospect knows solution category exists. Channel: Meta + Google search (category keywords) viable. Messaging: comparison + differentiation.
- Level 4 product-aware: prospect knows your product, comparing options. Channel: Google search (branded + competitor), Meta retargeting. Messaging: proof + objection handling.
- Level 5 most-aware: has considered buying. Channel: retargeting-heavy, Google branded. Messaging: offer urgency + price.
- Channel gating rules table
- Funnel split rules by awareness level

- [ ] **Step 1.3: Write `sales-cycle-bounding.md`**

Content structure:
- Opening: "Sales cycle is bounded by the offer structure. Never generate a cycle longer than the offer physically allows."
- Ceiling table:
  - Free trial (≤ N days): cycle ≤ trial length + 3 days buffer
  - One-call close: cycle ≤ 7 days
  - Demo required + self-serve decision: cycle 7–30 days
  - Demo required + committee decision: cycle 30–60 days
  - Enterprise (5+ stakeholders, procurement): cycle 60–180 days
- Instruction: read `identityCard.offerStructure` + `identityCard.closeType` before setting cycle estimates
- Instruction: "If the research-derived cycle contradicts the offer ceiling, use the offer ceiling and flag the research signal as anomalous."

- [ ] **Step 1.4: Write `channel-grounding.md`**

Content structure:
- Opening: "Every channel in your output must trace to evidence."
- Allowed sources, ranked by strength:
  1. Competitors with active ads on that channel (strongest)
  2. ICP `preferredChannels` array from icpValidation
  3. Industry template default channels for the vertical
  4. Business-model template default channels
- Hard rule: if a proposed channel appears in zero of the above, **do not propose it**. Better to concentrate on fewer evidenced channels.
- Instruction: for each proposed channel, include `evidenceSource: "competitor_ad|icp_channel|industry_default|business_model_default"` in the output rationale field.

- [ ] **Step 1.5: Verify by reading files back and checking line counts**

Each file should be 80–200 lines. If shorter than 80 lines, the content is too sparse; revise to match the depth of existing methodology files (`market-opportunity.md` = 147 lines, `readiness-scorecard.md` = 150 lines).

---

## Task 2: Create business-model templates (5 files)

Parallel structure to existing `templates/{saas,b2b-enterprise,ecommerce}.md` but focused on business-model dynamics rather than industry verticals. Loaded alongside the industry template — they layer.

**Files:**
- Create: `research-worker/src/skills/templates/business-models/plg.md`
- Create: `research-worker/src/skills/templates/business-models/slg.md`
- Create: `research-worker/src/skills/templates/business-models/ecommerce.md`
- Create: `research-worker/src/skills/templates/business-models/transactional.md`
- Create: `research-worker/src/skills/templates/business-models/marketplace.md`

- [ ] **Step 2.1: Write `plg.md`**

Sections:
- Funnel: Signup → Activation → Paid Conversion. Do NOT use lead/SQL terminology.
- KPI framework (qualitative): cost per signup, activation rate, time-to-value, free-to-paid rate, expansion rate. No client-specific targets — benchmark ranges only.
- Channel bias: Meta + YouTube + TikTok primary; Google search only if solution-aware+; NOT LinkedIn.
- Creative approach: product demo clips, "here's what it does in 30 seconds", social proof from user count.
- Campaign types allowed: conversion campaigns for signup, NOT separate "trial conversion" campaigns.
- Budget floor: ≤£2k → single platform (usually Meta); ≤£5k → Meta + one supplement.

- [ ] **Step 2.2–2.5: Write slg.md, ecommerce.md, transactional.md, marketplace.md**

Match the structure from 2.1 but with business-model-specific funnel, KPIs, channels, creative, campaign types, budget rules.

---

## Task 3: Extend skill loader

**Files:**
- Modify: `research-worker/src/skills/loader.ts`

- [ ] **Step 3.1: Add `loadBusinessModelTemplate(type: string): string`**

Cache `src/skills/templates/business-models/*.md` at module load (like existing `templateCache`). Export function that returns template by business model type with fallback to empty string.

- [ ] **Step 3.2: Add `loadMediaPlanMethodology(filename: string): string`**

Cache `src/skills/methodologies/media-plan/*.md` at module load. Similar pattern to existing `methodologyCache` but for the new subdirectory.

- [ ] **Step 3.3: Add test coverage**

Extend `research-worker/src/skills/__tests__/loader.test.ts` (or create if missing) with:
- `loadBusinessModelTemplate('plg')` returns non-empty
- `loadBusinessModelTemplate('nonexistent')` returns empty string
- `loadMediaPlanMethodology('business-model-routing.md')` returns non-empty

---

## Task 4: Identity resolver — classify business model + awareness level

**Files:**
- Modify: `research-worker/src/identity/resolve-identity.ts`

- [ ] **Step 4.1: Extend identity card schema (internal to resolver, not contracts.ts)**

Add two new fields to the identity card JSONB shape:
- `businessModelType`: `'plg' | 'slg' | 'ecommerce' | 'transactional' | 'marketplace' | 'unknown'`
- `awarenessLevel`: `'unaware' | 'problem-aware' | 'solution-aware' | 'product-aware' | 'most-aware' | 'unknown'`

Both classified from existing context (URL content, form inputs, businessModel free-text string).

- [ ] **Step 4.2: Extend resolver prompt**

Add classification section to the system prompt:

```
CLASSIFICATION (new fields):

businessModelType — classify into one of:
- plg: product-led growth, free trial, freemium, self-serve signup
- slg: sales-led growth, demo required, sales team closes deals
- ecommerce: direct purchase, physical or digital goods
- transactional: local service, one-time bookings
- marketplace: two-sided network effects
- unknown: insufficient signal

awarenessLevel — classify the target market into Schwartz 5:
- unaware: market doesn't know the problem exists
- problem-aware: knows problem, doesn't know solution category
- solution-aware: knows solution category, evaluating options
- product-aware: knows your brand, comparing against alternatives
- most-aware: has considered buying, needs trigger to close
- unknown: insufficient signal

Base classifications on evidence. If signals are mixed or missing, return 'unknown' — do not guess.
```

- [ ] **Step 4.3: Update identity card response schema + fallback**

Add both enum fields to the Zod schema used to parse the resolver output. Default to `'unknown'` in the fallback `extractFieldFromContext` path.

- [ ] **Step 4.4: Add resolver test**

Verify: given a fixture with "free trial + self-serve signup" the resolver classifies `businessModelType = 'plg'`. Given ambiguous input, returns `'unknown'`.

---

## Task 5: Schema strip — remove all numeric targets

**Files:**
- Modify: `research-worker/src/contracts.ts`

- [ ] **Step 5.1: Block 1 channelMixBudgetSchema — remove `expectedCPL`**

```diff
- expectedCPL: z.object({ low: z.number().min(0), high: z.number().min(0) }),
```

Replace with:
```typescript
benchmarkCPL: z.object({
  low: z.number().min(0),
  high: z.number().min(0),
  source: z.string(), // "industry benchmark" required
  note: z.string().optional(), // e.g. "actual CPL depends on offer strength + creative"
}).optional(),
```

- [ ] **Step 5.2: Block 4 measurementGuardrailsSchema — strip CAC model**

Remove entire `cacModel` object. Replace with:

```typescript
cacFramework: z.object({
  drivers: z.array(z.string()), // what influences CAC (sales process, offer strength, creative)
  improvementLevers: z.array(z.string()), // how to improve (follow sales process, stronger offer, etc.)
  benchmarkRange: z.object({
    low: z.number().min(0),
    high: z.number().min(0),
    source: z.string(),
  }).optional(),
}),
```

Also modify `kpis[]`:
```diff
- target: z.number(),
- industryBenchmark: z.number(),
- benchmarkSource: z.string(),
+ drivers: z.array(z.string()), // what influences this KPI
+ improvementLevers: z.array(z.string()),
+ benchmarkRange: z.object({
+   low: z.number(),
+   high: z.number(),
+   source: z.string(),
+ }).optional(),
```

- [ ] **Step 5.3: Block 6 strategySnapshotSchema — strip expectedOutcomes numerics**

```diff
- expectedOutcomes: z.object({
-   leadsPerMonth: z.number().min(0),
-   estimatedCAC: z.number().min(0),
-   expectedROAS: z.number().min(0).optional(),
- }),
+ expectedSignals: z.object({
+   timeToFirstResults: z.string(), // e.g. "2-4 weeks for initial performance read"
+   qualitativeOutcomes: z.array(z.string()), // "initial lead flow", "creative signal", "CPL baseline established"
+ }),
```

- [ ] **Step 5.4: Remove `.min().max()` constraints from remaining number fields on these schemas**

Per project gotcha (`.claude/rules/ai-sdk-patterns.md`): Anthropic rejects `.min()`/`.max()` on number fields inside `generateObject` schemas. `stripNumericConstraints` already handles this at runtime, but we should remove them at source for clarity.

---

## Task 6: Rebuild media plan system prompt

**Files:**
- Modify: `research-worker/src/prompts/runners/media-plan-system.md`

- [ ] **Step 6.1: Replace 16-line stub with full frame**

```markdown
You are a senior media planner building a paid media plan from approved research.

## Business model awareness (CRITICAL)

Read `identityCard.businessModelType` from the context. Load the corresponding business-model template. Its funnel and KPI framework override any defaults in the block skills.

- PLG: signup → activation → paid. NEVER lead → SQL → customer.
- SLG: lead → SQL → customer. Demo-centric.
- E-commerce: session → ATC → purchase. ROAS-centric.
- Transactional: click → lead → booking.
- Marketplace: separate acquisition per side.

If businessModelType is 'unknown', flag in output and default to SLG with low confidence.

## Awareness level routing (CRITICAL)

Read `identityCard.awarenessLevel`. This drives channel selection:

- unaware / problem-aware: Meta + YouTube + TikTok primary. NO Google search. Education-led creative.
- solution-aware: Meta + Google search viable. Comparison creative.
- product-aware / most-aware: Google search + retargeting heavy. Proof + urgency.

## Direct-response default

Assume the account is direct-response unless the context explicitly says otherwise. DR default funnel split: 85–95% conversion, 0–10% awareness, 0–10% retargeting (only if retargeting pool exists — no pixel → no retargeting).

## Offer ceiling

Sales cycle must respect the offer structure:
- Free trial: cycle ≤ trial length + 3 days
- One-call close: ≤ 7 days
- Demo required: 7–30 days
- Enterprise: 30–180 days

Never generate cycles longer than the offer physically allows.

## Channel grounding

Every channel in your output must trace to evidence: (a) competitor with active ads on that channel, (b) ICP preferred channel, (c) industry template default, or (d) business-model template default. If a channel has none of these, do not propose it.

## No client-specific numeric targets

Do not output client-specific CPL, CAC, ROAS, lead-count, or customer-count targets. These depend on sales process, offer strength, creative quality — variables beyond paid media. Use qualitative guidance: what drives this metric, how to improve it, and optionally an industry benchmark range labeled "industry benchmark".

## Use the client's actual words

Do not invent acronyms or jargon (AEO, GEO, etc.). Use the client's terminology from the identity card. If the client says "ChatGPT visibility", say "ChatGPT visibility" — not "generative AI search optimization".

## Current Marketing Activities (anti-duplication rule)

[Existing 8-line section preserved verbatim]
```

- [ ] **Step 6.2: Verify prompt is loaded**

Runner already loads via `loadRunnerPrompt('media-plan-system')`. Verify the file is present at build time by running a quick sanity check: `node -e "console.log(require('./dist/prompts/...'))"` after build — or add a test.

---

## Task 7: Wire new methodologies + templates into runner

**Files:**
- Modify: `research-worker/src/runners/media-plan.ts`

- [ ] **Step 7.1: Extract business model + awareness level from context**

Add helpers alongside existing `detectIndustry` and `extractMetadata`:

```typescript
function extractBusinessModel(context: string): BusinessModelType {
  const match = context.match(/\[businessModelType:([^\]]+)\]/);
  return (match?.[1] as BusinessModelType) ?? 'unknown';
}

function extractAwarenessLevel(context: string): AwarenessLevel {
  const match = context.match(/\[awarenessLevel:([^\]]+)\]/);
  return (match?.[1] as AwarenessLevel) ?? 'unknown';
}
```

Dispatch route (`src/app/api/journey/dispatch/route.ts`) already prepends identityCard-derived metadata to the context. Extend it to prepend `[businessModelType:X]` and `[awarenessLevel:Y]` lines. (See Task 8.)

- [ ] **Step 7.2: Load business-model template + methodologies**

In `runMediaPlan`:

```typescript
const businessModelType = extractBusinessModel(context);
const awarenessLevel = extractAwarenessLevel(context);
const businessModelTemplate = loadBusinessModelTemplate(businessModelType);
const bmRouting = loadMediaPlanMethodology('business-model-routing.md');
const awarenessRouting = loadMediaPlanMethodology('awareness-level-routing.md');
const salesCycleBounding = loadMediaPlanMethodology('sales-cycle-bounding.md');
const channelGrounding = loadMediaPlanMethodology('channel-grounding.md');
```

- [ ] **Step 7.3: Inject into `systemParts` for every block**

Add a new section after the skill, before existing ref injection:

```typescript
const systemParts = [
  block.skill,
  bmRouting,
  awarenessRouting,
  salesCycleBounding,
  channelGrounding,
  businessModelTemplate ? `\n\n## Business Model Template (${businessModelType})\n\n${businessModelTemplate}` : '',
  refs ? `\n\n## Reference Benchmarks...` : '',
  industryTemplate ? `\n\n## Industry Template...` : '',
  ANTI_HALLUCINATION,
  CURRENT_ACTIVITIES_GUARDRAIL,
];
```

Methodology + business-model template go BEFORE industry template because the business model decision frames the industry data, not the other way round.

---

## Task 8: Dispatch route — inject identityCard classifications into context

**Files:**
- Modify: `src/app/api/journey/dispatch/route.ts` (or wherever `buildJourneyResearchContext` is called to add metadata lines)

- [ ] **Step 8.1: Find the dispatch context builder**

The existing code already adds `[userId:...]` and `[sessionId:...]` lines. Locate that spot.

- [ ] **Step 8.2: Add identityCard classification lines**

```typescript
const identityCard = session.identity_card ?? {};
const lines = [
  `[userId:${userId}]`,
  session.id ? `[sessionId:${session.id}]` : '',
  identityCard.businessModelType ? `[businessModelType:${identityCard.businessModelType}]` : '',
  identityCard.awarenessLevel ? `[awarenessLevel:${identityCard.awarenessLevel}]` : '',
].filter(Boolean);
const contextWithMeta = lines.join('\n') + '\n\n' + context;
```

---

## Task 9: Validator updates

**Files:**
- Modify: `research-worker/src/validators/media-plan.ts`

- [ ] **Step 9.1: Remove obsolete CAC math validator**

`validateCACModel` and its `reconcileKPIs` currently reconcile numeric fields that no longer exist. Remove or gut these.

- [ ] **Step 9.2: Add `validateSalesCycleBounds`**

```typescript
export function validateSalesCycleBounds(
  identityCard: IdentityCard,
  block1: ChannelMixBudget,
  block5: RolloutRoadmap,
): { warnings: string[] } {
  // Derive ceiling from offer structure
  const ceiling = computeSalesCycleCeiling(identityCard);
  // Check if rampUpWeeks or phase durations exceed ceiling
  const warnings: string[] = [];
  if (block1.budgetSummary.rampUpWeeks * 7 > ceiling) {
    warnings.push(`Ramp-up (${block1.budgetSummary.rampUpWeeks} weeks) exceeds offer-structure sales cycle ceiling (${ceiling} days).`);
  }
  // Add more checks for phase durations
  return { warnings };
}
```

- [ ] **Step 9.3: Wire validator into runner**

Call `validateSalesCycleBounds` in the runner's cross-block validation section.

---

## Task 10: UI updates

**Files:**
- Modify: `src/components/workspace/cards/*` (media plan cards)

- [ ] **Step 10.1: Identify all cards that render CAC/CPL/ROAS**

Grep for `estimatedCAC`, `leadsPerMonth`, `expectedROAS`, `expectedCPL` in `src/components/workspace/cards/`. These render fields that no longer exist — they must be removed or updated to render the new qualitative fields.

- [ ] **Step 10.2: Render qualitative KPIs**

For each KPI card, replace:
- Target display → Driver list + improvement levers
- Benchmark number → Benchmark range with "(industry benchmark)" label

- [ ] **Step 10.3: Update card taxonomy parser**

`src/lib/workspace/card-taxonomy.ts` — `parseMediaPlan` currently destructures the stripped fields. Update to handle optional fields gracefully.

---

## Task 11: Review UI — surface classifications

**Files:**
- Modify: `src/lib/journey/field-catalog.ts`
- Modify: `src/components/journey/UnifiedFieldReview.tsx` (or equivalent)

- [ ] **Step 11.1: Add field metas for editable classifications**

Add `businessModelType` + `awarenessLevel` to `JOURNEY_ENRICHMENT_FIELD_METAS` as dropdowns with the 6 + 6 enum options.

- [ ] **Step 11.2: Read from identityCard, write on submit**

Pull values from session.identity_card on review page load. On submit, write back to identity_card JSONB via existing `all_fields` merge path.

---

## Task 12: Tests

**Files:**
- Create: `research-worker/src/runners/__tests__/media-plan-v2.test.ts`
- Extend: `research-worker/src/skills/__tests__/loader.test.ts`
- Extend: `research-worker/src/identity/__tests__/resolve-identity.test.ts` (create if missing)

- [ ] **Step 12.1: Snapshot test for system prompt**

Assert the rebuilt system prompt contains:
- "Business model awareness"
- "Awareness level routing"
- "Direct-response default"
- "No client-specific numeric targets"
- "Use the client's actual words"
- Existing anti-duplication rule

- [ ] **Step 12.2: Schema shape tests**

Assert:
- `measurementGuardrailsSchema` has no `cacModel` field
- `measurementGuardrailsSchema.kpis` has no `target` field
- `strategySnapshotSchema` has no `expectedOutcomes.estimatedCAC` field
- `channelMixBudgetSchema.platforms[].expectedCPL` no longer exists

- [ ] **Step 12.3: Classification fallback tests**

Identity resolver with ambiguous input returns `businessModelType: 'unknown'`, `awarenessLevel: 'unknown'`.

- [ ] **Step 12.4: Build passes**

`cd research-worker && npm run build` exits 0. `npm run build` at root exits 0. `npm run test:run` passes.

---

## Task 13: Migration + deploy

**Files:**
- Create: `docs/migrations/2026-04-19-identity-card-classifications.sql`
- Deploy: Railway (worker) + Vercel (app)

- [ ] **Step 13.1: No Supabase schema change required**

`journey_sessions.identity_card` is a JSONB column; new classification fields merge in automatically. Existing rows without the fields default to `'unknown'` at runtime.

- [ ] **Step 13.2: Optional backfill script**

If we want existing journey sessions to get classified retroactively, write a script that reads `identity_card.businessModel` free text and infers the enum. Low priority — forward-only is acceptable.

- [ ] **Step 13.3: Deploy worker + app**

```bash
cd research-worker && railway up
# Vercel auto-deploys on main
```

- [ ] **Step 13.4: Re-run Choros acceptance test**

Re-run Choros.io end-to-end. Verify:
1. No 50-year payback
2. No client-specific CAC/CPL/ROAS numbers anywhere in output
3. PLG business model classified correctly
4. Funnel split is DR-appropriate (85%+ conversion)
5. Sales cycle ≤ 7 days (7-day free trial)
6. No Google Ads proposed (unaware market)
7. No invented acronyms (AEO/GEO)

---

## Phase 2 outline (NOT in scope for this plan)

After Phase 1 ships and Choros acceptance passes:

- DR funnel validator (enforce ≥85% conversion for DR + low budget)
- Campaign-type feasibility validator (no retargeting without pixel, no separate trial-conversion for PLG)
- Jargon avoidance validator (flag invented acronyms not in identityCard brand voice)
- Competitor discovery: active-ads filter (drop competitors with 0 ads in last 30 days)
- Channel provenance validator (hard enforce evidence requirement from `channel-grounding.md`)
- Budget tier hard validator (enforce £2k/£5k platform-count caps)
- Messaging vs. targeting schema separation (distinct fields for angles vs. audiences)
- Creative diversity minimum (≥3 angles covering ≥2 pain points, at least 1 white-space gap)

Estimated Phase 2 scope: 2–3 days. Write as separate plan doc after Phase 1 verified in production.

---

## Acceptance criteria (Phase 1)

1. Re-run Choros.io with `businessModelType=plg`, `awarenessLevel=unaware`:
   - ✅ No CAC/CPL/ROAS numbers in output (schema enforced)
   - ✅ Funnel uses signup → activation → paid (not lead → SQL → customer)
   - ✅ Sales cycle ≤ 7 days
   - ✅ No Google Ads as primary channel
   - ✅ No AEO/GEO invented acronyms
2. Identity resolver correctly classifies 5 test fixtures (PLG/SLG/ecommerce/transactional/unknown)
3. All tests pass, build passes on both worker and app
4. Review UI shows businessModelType + awarenessLevel as editable dropdowns
5. Existing non-Choros journey sessions continue to generate plans (defaults to `unknown` → SLG fallback)

---

## Rollback

If Phase 1 breaks production media plan generation:
- Revert schema changes in `contracts.ts` (git revert)
- Revert runner changes in `media-plan.ts`
- Identity resolver changes are additive (new fields default to 'unknown') — safe to leave
- Methodology + template files are additive — safe to leave

Schema change is the risk vector. Worker build + vitest run must pass before deploy.
