# Journey Research Schemas — Design Doc
**Date**: 2026-03-07
**Branch**: aigos-v2
**Status**: Approved

---

## Problem

The Journey research flow has a strong section map, live section agents, and review checkpoints, but it does not yet have a stable typed output contract per section.

Today, `generateResearch` normalizes every section into the same metadata envelope:

- `content`
- `citations`
- `provenance`
- `claims`
- `missingData`
- `fileIds`

That generic shape is useful for storage and source verification, but it leaves the section cards underpowered. The Journey UI already contains rich section-specific cards for:

- `industryResearch`
- `competitorIntel`
- `icpValidation`
- `offerAnalysis`
- `strategicSynthesis`
- `keywordIntel`
- `mediaPlan`

Those cards are written as if they can receive structured per-section data, but the current section runner generally only returns freeform report text. As a result, the cards often fall back to `data.content` instead of rendering typed findings.

This creates four problems:

1. The UI contract is implied, not enforced.
2. The section skills define markdown report layouts, not typed output schemas.
3. Older schema assets exist elsewhere in the repo, but the Journey runner does not use them.
4. The persistence layer stores good shared metadata, but not reliable section payloads.

---

## Goal

Introduce a hybrid Journey schema system that preserves the current normalized metadata envelope while adding section-specific typed `data` payloads for the fields the Journey cards actually render.

The rollout must:

- preserve the current `content` fallback
- avoid breaking realtime, persistence, or review flows
- reuse legacy schema ideas where they map cleanly
- avoid forcing a full strategic-blueprint schema migration into Journey

---

## Decision

Adopt a **hybrid schema strategy**:

- Keep one shared envelope for all research sections.
- Add a typed `data` field per section.
- Define Journey-specific schemas under `src/lib/journey/schemas/`.
- Reuse legacy field names where there is a clear card mapping.
- Keep `content` as the universal rendering fallback.
- Parse and validate section-specific payloads inside `generateResearch` before persistence.

This is the narrowest change that gives Journey real typed outputs without requiring the agents to jump straight from freeform markdown into a large all-JSON legacy schema system.

---

## Architecture

### Shared Envelope

Every completed Journey section should normalize into one stable outer shape:

```ts
type JourneyResearchSectionResult<TData> = {
  status: "complete" | "error";
  sectionId: string;
  content: string;
  citations: ResearchCitation[];
  provenance: {
    status: "sourced" | "missing";
    citationCount: number;
  };
  claims: ResearchClaim[];
  missingData: string[];
  fileIds: string[];
  data?: TData;
};
```

The shared envelope stays responsible for:

- storage compatibility
- review and revision safety
- source verification
- generic fallback rendering
- compacting older tool outputs for model context

### Section-Specific Payloads

Each section receives its own typed `data` payload validated by a dedicated Zod schema.

The envelope remains shared; only `data` varies by `sectionId`.

### Parser Layer

The parser layer sits between section generation and persistence:

```text
section skill + tools
  -> generated report text
  -> generic metadata normalization
  -> section-specific parse/validate step
  -> persisted section result with typed data
```

This lets us improve sections incrementally. If typed parsing fails, the result should still persist with valid `content`, `citations`, and quality metadata.

---

## Section Schema Design

The schemas below define the minimum stable contract for Journey cards, plus a small amount of optional carryover for future depth.

### 1. `industryResearch`

**Card-driven required fields:**

- `categorySnapshot`
- `marketDynamics`
- `painPoints`
- `messagingOpportunities`

**Optional carryover fields:**

- `psychologicalDrivers`
- `audienceObjections`

**Why this shape**

The current card already reads these fields directly. The legacy `industry-market` schema is a close fit, so the Journey schema can reuse the same field names with lighter constraints where needed.

### 2. `competitorIntel`

**Card-driven required fields:**

- `competitors`
- `marketStrengths`
- `marketWeaknesses`
- `whiteSpaceGaps`

**Optional carryover fields:**

- `creativeLibrary`
- `funnelBreakdown`
- `keywordOverlap`

**Why this shape**

The card only needs a subset of the older competitor schema. We should preserve the useful list structures while avoiding extra fields that Journey does not yet surface.

### 3. `icpValidation`

**Card-driven required fields:**

- `validatedPersona`
- `demographics`
- `channels`
- `triggers`
- `objections`
- `decisionFactors`
- `audienceSize`
- `confidenceScore`
- `decisionProcess`

**Optional carryover fields:**

- `coherenceCheck`
- `painSolutionFit`
- `riskScores`

**Why this shape**

The legacy ICP schema is much richer than the Journey card contract. Journey needs a simplified, presentation-first schema with optional hooks for future enrichment.

### 4. `offerAnalysis`

**Card-driven required fields:**

- `offerClarity`
- `offerStrength`
- `marketOfferFit`
- `redFlags`
- `recommendation`

**Optional carryover fields:**

- `strengths`
- `weaknesses`
- `pricingComparison`

**Why this shape**

This is the cleanest section match in the current codebase. The Journey schema should closely mirror the existing offer-analysis schema.

### 5. `strategicSynthesis`

**Card-driven required fields:**

- `keyInsights`
- `recommendedPositioning`
- `positioningStrategy`
- `recommendedPlatforms`
- `potentialBlockers`
- `nextSteps`

**Optional carryover fields:**

- `criticalSuccessFactors`
- `messagingFramework`

**Why this shape**

The existing cross-analysis and strategic-analysis schemas already align well with the Journey card. This section should be one of the first rollouts.

### 6. `keywordIntel`

**Journey-required fields:**

- `keywords`
- `quickWins`
- `highIntentKeywords`
- `clientStrengths`
- `contentTopicClusters`
- `metadata.totalKeywordsAnalyzed`

**Why this shape**

There is no mature Journey-specific section schema for keyword intelligence today. The schema should be designed from the current card contract rather than imported from the old blueprint pipeline.

### 7. `mediaPlan`

**Journey-required fields:**

- `allocations`
- `totalBudget`
- `timeline`
- `kpis`
- `testingPlan`

**Why this shape**

The full media plan pipeline already has its own rich schema family. Journey only needs a lightweight planning preview, not the complete post-blueprint media plan document structure.

---

## Files And Responsibilities

### New Files

- `src/lib/journey/schemas/base.ts`
  - shared Journey section envelope helpers
- `src/lib/journey/schemas/industry-research.ts`
- `src/lib/journey/schemas/competitor-intel.ts`
- `src/lib/journey/schemas/icp-validation.ts`
- `src/lib/journey/schemas/offer-analysis.ts`
- `src/lib/journey/schemas/strategic-synthesis.ts`
- `src/lib/journey/schemas/keyword-intel.ts`
- `src/lib/journey/schemas/media-plan.ts`
- `src/lib/journey/schemas/index.ts`
  - section-to-schema map
- `src/lib/journey/normalize-section-data.ts`
  - section-aware parsing and validation

### Existing Files To Modify

- `src/lib/ai/tools/generate-research.ts`
  - call section-aware normalization
  - persist typed `data`
  - return typed tool output
- `src/lib/journey/session-state.ts`
  - preserve typed `data` in extracted outputs
- `src/components/journey/chat-message.tsx`
  - continue to pass `data`, but expect typed payloads over time
- `src/components/journey/research-cards/*`
  - gradually tighten types from `Record<string, unknown>` to section payload types
- `src/lib/ai/skills/*/SKILL.md`
  - add structured field expectations to improve parse reliability

---

## Normalization Strategy

### Primary Recommendation

Start with schema validation against structured JSON-like output embedded in the section result, rather than trying to perfectly parse arbitrary prose.

That means the section agents should be instructed to produce:

1. a short narrative report for `content`
2. a structured payload block that matches the Journey section schema

Recommended shape:

````text
### Narrative Report
<human-readable section report with citations>

```journey-data
{
  "data": {
    // section-specific payload only
  }
}
```
````

The fenced `journey-data` block should contain only the section payload for the current `sectionId`. Shared metadata such as citations, provenance, claims, and file IDs should continue to be derived by the normalizer rather than duplicated inside the payload block.

The normalizer should then:

1. read the generated text
2. extract structured data from the `journey-data` block
3. validate it against the section schema
4. return `data` when validation passes
5. fall back to metadata + `content` when validation fails

### Fallback Behavior

If typed parsing fails:

- do not fail the whole section
- persist the section as complete if the generic envelope is valid
- leave `data` undefined
- keep the current card fallback path

This is important for rollout safety and for avoiding blocked user journeys due to schema drift.

---

## Skill Prompt Changes

The existing section skills should not be replaced with pure JSON-only instructions in the first rollout.

Instead, each `SKILL.md` should be updated to require:

- a concise narrative section report
- explicit section field labels for typed extraction
- consistent list formatting for arrays
- citation preservation
- no extra invented fields outside the documented schema

This keeps the reports readable while making structured extraction realistic.

---

## Rollout Plan

### Wave 1

- `offerAnalysis`
- `strategicSynthesis`

These sections have the strongest alignment between legacy schemas and current cards.

### Wave 2

- `industryResearch`
- `competitorIntel`

These are good candidates after the parser pattern is proven.

### Wave 3

- `icpValidation`
- `keywordIntel`
- `mediaPlan`

These need more schema judgment and may require card type adjustments.

---

## Testing Strategy

### Unit Tests

Add parser and schema validation tests for each section:

- valid typed payload parses successfully
- partial payload fails cleanly
- invalid payload preserves fallback behavior
- metadata stays intact when `data` is absent

### Session Persistence Tests

Ensure `extractResearchOutputs()` preserves:

- `content`
- `citations`
- `provenance`
- `claims`
- `missingData`
- typed `data`

### UI Tests

For each card:

- typed `data` renders rich UI
- missing `data` renders `content`
- missing citations still shows provisional warning

---

## Risks

### Risk: brittle parsing from freeform skill output

**Mitigation:** require structured field sections in the skills; keep `content` fallback.

### Risk: overfitting Journey to legacy blueprint schemas

**Mitigation:** create Journey-specific schemas first; only import legacy field names where the card already wants them.

### Risk: partial rollout creates inconsistent section behavior

**Mitigation:** keep one shared envelope and explicit fallback rules for all sections.

### Risk: cards depend on loose untyped records during migration

**Mitigation:** migrate card typings section-by-section, not all at once.

---

## Success Criteria

The design is successful when:

1. Each Journey research section has a documented typed schema.
2. `generateResearch` returns stable typed `data` for at least the first rollout sections.
3. Persistence preserves the typed payload without changing the shared metadata contract.
4. Research cards render rich section UI from typed data rather than `content` fallback.
5. A failed typed parse does not break the user journey.

---

## Recommendation

Proceed with the hybrid plan:

- define Journey-specific section schemas
- keep the shared normalized envelope
- add section-aware parsing inside `generateResearch`
- preserve `content` fallback everywhere
- roll out in waves beginning with `offerAnalysis` and `strategicSynthesis`

This provides the best balance of safety, speed, and long-term schema clarity.
