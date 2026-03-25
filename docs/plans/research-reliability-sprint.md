# Research Pipeline Reliability Sprint

**Branch**: `redesign/v2-command-center`
**Goal**: Stop research failures, fix media plan UX bugs, optimize synthesis speed, verify chat.

## Problems (from audit)

### P1: Research schemas fail on AI output variations
The frontend validation layer uses strict `z.enum()` that rejects valid AI output with slightly different casing or wording. Already hit: `pricingPosition` (fixed). 30+ more strict enums across 7 schema files remain vulnerable.

### P2: Section count shows "7/6" after media plan
`getCompletedJourneySessions()` counts against `SECTION_PIPELINE` (7 items including mediaPlan) but the denominator on the research list page uses `RESEARCH_SECTIONS` (6 items).

### P3: "Generate Media Plan" button shows for incomplete research
`MediaPlanButton` renders whenever `sessionId && runId` exist — no check that all 6 research sections are complete.

### P4: "Generate Media Plan" navigates to broken page
Button redirects to `/journey?session=X&mediaPlan=1` which loads a fresh workspace with all sections in `queued` state. The workspace doesn't hydrate existing research results before rendering.

### P5: Synthesis (crossAnalysis) is slow (~2-3 min)
Dispatch route passes full JSON of all prior sections (~15K tokens) as context. The system prompt says "summaries" but code passes complete output. Sonnet must process all of it before generating.

### P6: Chat feature needs verification
Unified chat with profile context injection needs a quick check.

---

## Tasks

### Task 1: Harden all z.enum() schemas (P1)
**Files**: `src/lib/journey/schemas/*.ts` (7 files)
**Approach**: Create a shared `flexibleEnum()` helper that uses `z.string().transform()` with keyword matching and fallback. Replace all 30+ strict `z.enum()` calls.

High-risk enums (can vary from AI):
- `pricingPosition` — ALREADY FIXED
- `fitAssessment` (strong/moderate/weak)
- `urgencyLevel` (immediate/near-term/planning-cycle)
- `influence` (decision-maker/influencer/gatekeeper)
- `status` in recommendations (proceed/needs-work/etc.)
- `severity` (high/medium/low) — used 4 places
- `confidence` (high/medium/low) — used 3 places
- `direction` (rising/declining/stable)
- `category` in risk monitoring (6 values)
- `matchType` (exact/phrase/broad)
- `funnelStage/funnelPosition` (cold/warm/hot)
- `priority` (primary/secondary/testing)
- `chartType` (pie/radar/bar/funnel/word_cloud)
- `platform` in competitor ads (linkedin/meta/google)
- `format` in ads (video/image/carousel/text/message/unknown)

Low-risk enums (structural, not AI-generated):
- `downstreamSequence` — hardcoded in prompts
- `role` in channel allocation — controlled

**Strategy**: For severity/confidence/direction/priority, use keyword includes. For structured enums like platform/format, keep strict but add `.catch()` fallback.

### Task 2: Fix 7/6 count (P2)
**File**: `src/lib/actions/journey-sessions.ts:127`
**Change**: Count against `RESEARCH_SECTIONS` (6) not `SECTION_PIPELINE` (7). Track media plan separately as a boolean `hasMediaPlan`.

### Task 3: Gate media plan button (P3)
**File**: `src/app/research/[sessionId]/page.tsx`
**Change**: Add `allResearchComplete` check — only show `MediaPlanButton` when all 6 research sections have `status === 'complete'`.

### Task 4: Fix media plan navigation (P4)
**File**: `src/components/research/media-plan-button.tsx:45`
**Change**: Instead of redirecting to `/journey?session=X&mediaPlan=1`, stay on the current research view page. Show a "Media plan generating..." status indicator. The worker runs in background and results appear via Supabase realtime.

### Task 5: Trim synthesis context (P5)
**File**: `src/app/api/journey/dispatch/route.ts:99-111`
**Change**: Instead of `JSON.stringify(payload, null, 1)` for full section output, extract a summary of key fields only. Target: reduce from ~15K tokens to ~5-7K tokens.

Summary extraction per section:
- `industryMarket`: marketSize, trends[].name+direction, topOpportunities
- `icpValidation`: segments[].name+fitAssessment, buyingTriggers
- `offerAnalysis`: offerStrength.overallScore, recommendation.status, pricingAnalysis.pricingPosition
- `competitors`: competitors[].name+positioningAngle+weaknesses (first 3 only)

### Task 6: Verify chat (P6)
Quick code-level check that unified chat route loads profile and injects context.

---

## File Impact

| File | Change |
|------|--------|
| `src/lib/journey/schemas/base.ts` | Add `flexibleEnum()` helper |
| `src/lib/journey/schemas/offer-analysis.ts` | Replace strict enums |
| `src/lib/journey/schemas/icp-validation.ts` | Replace strict enums |
| `src/lib/journey/schemas/industry-research.ts` | Replace strict enums |
| `src/lib/journey/schemas/competitor-intel.ts` | Replace strict enums |
| `src/lib/journey/schemas/keyword-intel.ts` | Replace strict enums |
| `src/lib/journey/schemas/strategic-synthesis.ts` | Replace strict enums |
| `src/lib/journey/schemas/media-plan.ts` | Replace strict enums |
| `src/lib/actions/journey-sessions.ts` | Fix section count |
| `src/app/research/[sessionId]/page.tsx` | Gate media plan button |
| `src/components/research/media-plan-button.tsx` | Fix navigation |
| `src/app/api/journey/dispatch/route.ts` | Trim synthesis context |

**12 files touched. 0 new files** (helper goes in existing `base.ts`).

## NOT in scope
- Changing the worker-side contracts (they already use `z.string()`)
- Changing models or token budgets
- Parallel synthesis (complex, UX change)
- Media plan result display in research view (separate feature)
- Profile pre-fill from saved profiles

## Verification
- [ ] Run a full research journey — all 7 sections complete without validation errors
- [ ] Research list shows "6/6" not "7/6" after media plan
- [ ] "Generate Media Plan" button hidden when research is incomplete
- [ ] "Generate Media Plan" button doesn't navigate away from research view
- [ ] Synthesis completes faster (target: under 90s, currently 2-3 min)
- [ ] `npm run build` passes
- [ ] `npm run test:run` passes
