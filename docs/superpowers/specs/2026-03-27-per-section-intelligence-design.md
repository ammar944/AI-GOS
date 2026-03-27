# Per-Section Intelligence + Synthesis Readiness Scorecard

**Date**: 2026-03-27
**Branch**: `redesign/v2-command-center`
**Status**: Design (QA'd against runner architecture)

## Problem

Only Offer Analysis has actionable intelligence (ICE-scored fixes, generated offer statements). The other 4 research sections produce raw data without telling the user what to *do* about it. Strategic Synthesis summarizes findings but doesn't score readiness or surface a prioritized action list.

A media buyer looking at this needs to know: "Where are my gaps, and what should I fix before I launch?"

## Solution

Add a **section-appropriate intelligence card** as the **first card** in each research section. Each card type is tailored to the domain — not a generic ICE table pasted everywhere.

Strategic Synthesis gains a **Readiness Scorecard** (composite score + per-dimension breakdown) and a **Top Actions** card (5-7 highest-priority actions pulled from all sections).

Intelligence prompts live in a new **skill file** (`research-worker/src/skills/intelligence-skill.ts`), following the same pattern used by media-plan skills.

## Scope

### In Scope

- New `intelligence-skill.ts` with per-section prompt fragments
- Intelligence cards for: Industry, ICP, Competitors, Keywords
- Readiness Scorecard + Top Actions cards for Synthesis
- Schema extensions in runner output (same API call, no new round-trips)
- New card components for each type
- Card taxonomy parsing for new card types
- Update `summarizeForSynthesis` to pass intelligence data to synthesis

### Out of Scope

- Changes to Offer Analysis (already has intelligence)
- Changes to Media Plan (already prescriptive)
- Inline editing of new intelligence cards (can be added later)
- Reordering existing cards (intelligence cards are prepended, rest stays as-is)

## Timing Constraint

**Max 5-10 seconds additional generation time across the entire pipeline.**

Intelligence is generated in the **same API call** as existing research — no new round-trips. Each runner outputs ~100-200 extra tokens for 3 compact intelligence items. At Sonnet speed (~50 tok/s), that's ~2-4 seconds per runner. But since items are compact and part of the existing generation, real-world overhead is lower.

Mitigations:
- **3 items per section** (not 5) — keeps output compact
- **Short strings only** — opportunity/refinement/move descriptions max 1 sentence
- **Reuse existing data** where it exists (see Keywords and Competitors below)
- **No separate API calls** — intelligence is part of the same `generateObject`/`toolRunner` response

---

## Skill Architecture

### New File: `research-worker/src/skills/intelligence-skill.ts`

Exports 5 constants following the established pattern:

```typescript
export const INDUSTRY_INTELLIGENCE_SKILL = `...`;
export const ICP_INTELLIGENCE_SKILL = `...`;
export const COMPETITORS_INTELLIGENCE_SKILL = `...`;
export const KEYWORDS_INTELLIGENCE_SKILL = `...`;
export const SYNTHESIS_INTELLIGENCE_SKILL = `...`;
```

Each runner imports its skill and appends it to the system prompt:

```typescript
// Example: industry.ts
import { INDUSTRY_INTELLIGENCE_SKILL } from '../skills/intelligence-skill';

const systemPrompt = `${INDUSTRY_PRIMARY_SYSTEM_PROMPT}\n\n${INDUSTRY_INTELLIGENCE_SKILL}`;
```

This keeps intelligence prompts centralized, reviewable, and separate from research prompts.

---

## Per-Section Intelligence Cards

### 1. Industry/Market — "Opportunities to Exploit"

**Card type**: `opportunity-card`
**Position**: First card in section
**Count**: 3 opportunities

**Runner**: `industry.ts` — Haiku primary, Sonnet repair. Uses `toolRunner()`. Schema in `contracts.ts`.

Schema per opportunity:

```typescript
{
  opportunity: string        // What the gap/opening is (1 sentence max)
  size: 'small' | 'medium' | 'large'
  timing: 'now' | '3-6 months' | '6-12 months'
  difficulty: 'low' | 'medium' | 'high'
  evidence: string           // Which data point supports this (1 sentence)
}
```

**Schema location**: Add `marketOpportunities` array to `industryResearchDataSchema` in `contracts.ts`. Enum fields use `flexibleEnum()`.

**Sort**: By size descending (large first).

**Rendering**: Table with columns: Opportunity | Size | Timing | Difficulty | Evidence. Size/timing/difficulty use color-coded badges (same pattern as ICE table scoring).

**Skill prompt**: Generate 3 market opportunities a paid media buyer could exploit. Each must cite evidence from the research. Keep descriptions to 1 sentence. Focus on timing-sensitive gaps.

---

### 2. ICP Validation — "Audience Refinements to Test"

**Card type**: `refinement-card`
**Position**: First card in section
**Count**: 3 refinements

**Runner**: `icp.ts` — Sonnet. Uses `toolRunner()`. Schema in `contracts.ts`.

Schema per refinement:

```typescript
{
  refinement: string         // What to change (1 sentence)
  segment: string            // Which audience slice
  expectedLift: 'low' | 'moderate' | 'high'
  testMethod: string         // How to validate (1 sentence)
  risk: string               // What if wrong (1 sentence)
}
```

**Schema location**: Add `audienceRefinements` array to `icpValidationDataSchema` in `contracts.ts`.

**Sort**: By expectedLift descending (high first).

**Rendering**: Stacked cards. Each: refinement as title, segment as subtitle, lift badge + test method + risk as body.

**Skill prompt**: Generate 3 audience refinements to test in paid media. Each must include a concrete split-test method and risk acknowledgment. Use buyer language from the ICP validation.

---

### 3. Competitors — "Positioning Moves to Make"

**Card type**: `positioning-move-card`
**Position**: First card in section
**Count**: 3 moves

**Runner**: `competitors.ts` — Sonnet, 3-tier recovery. Uses `toolRunner()`. Schema in `contracts.ts`.

**Existing intelligence to build on**: `whiteSpaceGaps[]` already has gap/type/evidence/exploitability/impact/recommendedAction. The positioning moves card is a more actionable, media-buyer-focused presentation of this data.

Schema per move:

```typescript
{
  move: string               // The positioning action (1 sentence)
  targetCompetitor: string   // Who you're countering
  risk: 'low' | 'medium' | 'high'
  reward: 'low' | 'medium' | 'high'
  playbook: string           // Execution hint (1 sentence)
}
```

**Schema location**: Add `positioningMoves` array to competitor schema in `contracts.ts`.

**Sort**: By reward descending, then risk ascending.

**Rendering**: Table with columns: Move | vs. Competitor | Risk | Reward | Playbook.

**Skill prompt**: Generate 3 positioning moves for paid media. Each must name a specific competitor and include a 1-sentence execution hint for ad creative/messaging. Derive from white-space gaps and competitor weaknesses.

**Note for all 3 recovery tiers**: The repair and rescue prompts also need the intelligence skill appended, but with reduced counts (2 moves for repair, 1 for rescue) to stay within token budgets.

---

### 4. Keywords — "Keyword Gaps to Fill"

**Card type**: `keyword-gap-card`
**Position**: First card in section
**Count**: 3 gap clusters

**Runner**: `keywords.ts` — Sonnet, 4-tier recovery. Uses `toolRunner()`. Schema is inline JSON format string + Zod validation in `contracts.ts`.

**Existing intelligence to reuse**: `competitorGaps[]` and `quickWins[]` already exist. Rather than generating a new `keywordGaps` field, parse existing fields INTO the keyword-gap-card:

- `competitorGaps` → gap clusters themed by competitor
- `topOpportunities` → gap clusters themed by intent/opportunity
- `quickWins` → surfaced as actionable items

Schema per gap (derived from existing data, NOT new generation):

```typescript
{
  gapCluster: string         // Theme derived from competitorGaps + topOpportunities
  estimatedVolume: number    // Sum from grouped keywords
  competition: 'low' | 'medium' | 'high'
  suggestedKeywords: string[] // 3-5 terms from existing data
  priority: 'high' | 'medium' | 'low'
}
```

**No worker prompt change needed for keywords.** The intelligence card is built by the **frontend card taxonomy parser** from existing keyword data. This saves ~3 seconds of generation time.

**Schema location**: No new fields in keyword runner output. New parsing logic in `parseKeywordIntel()` in `card-taxonomy.ts`.

**Parsing**: `parseKeywordIntel()` is currently a raw passthrough. Add gap extraction BEFORE the passthrough card:
1. Group `competitorGaps` by competitor name → gap clusters
2. Group `topOpportunities` by difficulty level → opportunity clusters
3. Create `keyword-gap-card` CardState from grouped data
4. Return `[gapCard, existingPassthroughCard]`

**Rendering**: Stacked cards. Each: gap cluster as title, priority + competition badges, estimated volume, comma-separated keyword list.

---

### 5. Offer Analysis — No Change

Already has ICE-scored fixes + generated offer statements.

---

### 6. Strategic Synthesis — Readiness Scorecard + Top Actions

Two new cards prepended to synthesis.

**Runner**: `synthesize.ts` — Sonnet. Uses `generateObject()`. Inline Zod schema. 8000 max tokens, 180s timeout.

#### Card 1: Readiness Scorecard

**Card type**: `readiness-scorecard`
**Position**: First card in synthesis

Schema:

```typescript
{
  overallScore: number       // 1-10, weighted average
  verdict: 'ready' | 'fix-gaps-first' | 'needs-work'
  verdictLabel: string       // "Ready to launch" / "Fix gaps first" / "Needs significant work"
  dimensions: Array<{
    name: string             // "Market Opportunity" | "Audience Clarity" | "Competitive Position" | "Offer Strength" | "Keyword Coverage"
    score: number            // 1-10
    summary: string          // One-line explanation
  }>
}
```

**Schema location**: Add `readinessScorecard` object to `synthesisGenerateSchema` in `synthesize.ts`. Score fields must be plain `z.number()` — no `.min()/.max()/.int()` constraints (Anthropic API rejects those in JSON Schema output_config).

**Verdict thresholds**: overall >= 8 → "ready", 5-7 → "fix-gaps-first", <5 → "needs-work"

**Rendering**: Large hero card. Overall score as big number with color (green/amber/red) + verdict label. Below: 5 dimension rows, each with name, horizontal score bar (0-10 fill), and summary. Custom component — not reusing stat-grid.

**Skill prompt**: Score each dimension 1-10 from research findings. Market Opportunity from industry, Audience Clarity from ICP, Competitive Position from competitors, Offer Strength from offer analysis, Keyword Coverage from keywords. Be honest — do not inflate. If a section is absent, score 0 with "insufficient data" summary.

#### Card 2: Top Actions

**Card type**: `priority-actions`
**Position**: Second card in synthesis (after scorecard)

Schema:

```typescript
{
  actions: Array<{
    action: string           // What to do (1 sentence)
    source: 'industry' | 'icp' | 'competitors' | 'offer' | 'keywords'
    priority: 'high' | 'medium' | 'low'
  }>
}
```

**Schema location**: Add `topActions` object to `synthesisGenerateSchema` in `synthesize.ts`.

**Count**: 5-7 actions.
**Sort**: By priority descending (high first).

**Rendering**: Numbered list. Each row: priority badge (color-coded) + action text + source section tag (small pill).

**Skill prompt**: Review all research findings. Select the 5-7 highest-impact actions for a paid media launch. Rank by needle-moving potential. Label each with source section.

---

### 7. Media Plan — No Change

Already prescriptive (budget allocations, platform splits, campaign structures).

---

## Implementation Notes

### Worker Changes

**New file**: `research-worker/src/skills/intelligence-skill.ts` — 5 exported prompt fragments.

**Runner modifications** (3 runners + synthesis):

| Runner | Change | Schema Location |
|--------|--------|-----------------|
| `industry.ts` | Append `INDUSTRY_INTELLIGENCE_SKILL` to system prompt, add `marketOpportunities` to output | `contracts.ts` |
| `icp.ts` | Append `ICP_INTELLIGENCE_SKILL` to system prompt, add `audienceRefinements` to output | `contracts.ts` |
| `competitors.ts` | Append `COMPETITORS_INTELLIGENCE_SKILL` to all 3 tier prompts, add `positioningMoves` to output | `contracts.ts` |
| `keywords.ts` | **No change** — intelligence derived from existing `competitorGaps`/`topOpportunities` on frontend | N/A |
| `synthesize.ts` | Append `SYNTHESIS_INTELLIGENCE_SKILL` to system prompt, add `readinessScorecard` + `topActions` to inline schema | Inline in `synthesize.ts` |

**Zod constraint restriction**: All score fields in synthesis schema must be plain `z.number()` — no `.min()/.max()/.int()`. Anthropic API rejects those in JSON Schema output_config.

**`flexibleEnum()` usage**: Required in `contracts.ts` for all new enum fields (size, timing, difficulty, expectedLift, risk, reward, competition, priority). NOT needed in frontend parsers — they pass through as strings.

**Recovery tier adjustments** (competitors only):
- Primary prompt: 3 positioning moves
- Repair prompt: 2 moves
- Rescue prompt: 1 move (or omit entirely to stay within token budget)

### Context Pipeline Update

**File**: `src/app/api/journey/dispatch/route.ts`

`summarizeForSynthesis()` currently trims upstream data for synthesis. Update to include intelligence fields:

```typescript
case 'industryMarket':
  return JSON.stringify({
    marketSize: d.marketSize, trends: d.trends,
    topOpportunities: d.topOpportunities,
    marketOpportunities: d.marketOpportunities,  // NEW
  }, null, 1);

case 'icpValidation':
  return JSON.stringify({
    segments: d.segments, buyingTriggers: d.buyingTriggers,
    finalVerdict: d.finalVerdict,
    audienceRefinements: d.audienceRefinements,  // NEW
  }, null, 1);

case 'offerAnalysis':
  // Already includes overallScore, redFlags — sufficient for synthesis scoring

case 'competitors':
  // Add positioningMoves to existing trim
  return JSON.stringify(
    comps.map(c => ({
      name: c.name, positioning: c.positioning, weaknesses: c.weaknesses,
    })).concat({ positioningMoves: d.positioningMoves }),  // NEW
    null, 1,
  );
```

This ensures synthesis can see upstream intelligence when building the Top Actions card.

### Frontend Changes

1. **New card components** (6 new files in `src/components/workspace/cards/`):
   - `opportunity-card.tsx`
   - `refinement-card.tsx`
   - `positioning-move-card.tsx`
   - `keyword-gap-card.tsx` (parses existing data, no new runner output)
   - `readiness-scorecard.tsx`
   - `priority-actions.tsx`

2. **Card taxonomy** (`src/lib/workspace/card-taxonomy.ts`):
   - `parseIndustryMarket()` — prepend opportunity-card from `data.marketOpportunities`
   - `parseIcpValidation()` — prepend refinement-card from `data.audienceRefinements`
   - `parseCompetitors()` — prepend positioning-move-card from `data.positioningMoves`
   - `parseKeywordIntel()` — prepend keyword-gap-card derived from existing `competitorGaps` + `topOpportunities`
   - `parseCrossAnalysis()` — prepend readiness-scorecard + priority-actions from `data.readinessScorecard` + `data.topActions`

3. **Card renderer** — add cases for 6 new card types in `CardContentSwitch`

### Data Flow

No new Supabase columns. No new API endpoints. Intelligence data is part of each section's existing output blob in `journey_sessions.research_results`. Frontend card taxonomy parser extracts intelligence into cards.

### Timing Budget (Estimated)

| Runner | Current Tokens | Added Tokens | Added Time (est.) |
|--------|---------------|-------------|-------------------|
| Industry (Haiku) | ~3,000 | +100 | ~1s |
| ICP (Sonnet) | ~3,500 | +150 | ~3s |
| Competitors (Sonnet) | ~3,000 | +150 | ~3s |
| Keywords | 0 (frontend-only) | 0 | 0s |
| Synthesis (Sonnet) | ~5,000 | +300 | ~4s |
| **Total** | | **+700** | **~8-11s** (worst case, sequential) |

Real-world impact will be lower because:
- Extra tokens are generated within existing API calls (no connection overhead)
- Intelligence items are compact (3 items × ~40 tokens each)
- Keywords adds 0 seconds (frontend-only parsing)

### Risks

- **Timing**: Worst-case ~11 seconds over budget by 1s. Mitigation: reduce to 2 items per section if testing shows >10s.
- **Quality**: Intelligence quality depends on research quality. Weak research → weak recommendations. Acceptable.
- **Synthesis scoring**: AI-generated assessment, not computed metric. Scores may not match a human strategist. Acceptable for v1.
- **Recovery tiers**: Competitors' repair/rescue prompts must include intelligence skill at reduced counts. If omitted, those tiers produce no intelligence card — the frontend should handle missing data gracefully (don't render card if field absent).
