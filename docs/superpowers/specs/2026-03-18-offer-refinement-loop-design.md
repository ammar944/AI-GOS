# Offer Refinement Loop — Chat-Driven Score Improvement

## Problem

The offer analysis runner scores offers on 7 dimensions (1-10) and produces priority fixes, but the results render as static cards. A score of 5.7 says "needs work" with no path to improve. Users approve low-scoring sections because there's no alternative.

## Solution

Use the existing per-section chat sidebar (RightRail) as the refinement interface. When offer analysis results arrive with a low score, the chat auto-seeds a score breakdown with actionable recommendations. The user converses with Claude to improve specific fields, Claude writes changes back to Supabase via a new `updateField` tool, and the offer section re-runs with updated context. The loop exits when the score reaches 8+ or after 2 rounds.

## Architecture

### Data Flow

```
Offer results land (score < 8)
  ├── Cards render in ArtifactCanvas (unchanged)
  ├── RightRail chat stays visible
  └── Auto-seed: score breakdown + recommendations injected into chat
        │
        User converses with Claude
        │
        Claude suggests field improvements
        │
        User: "yeah update it"
        │
        Claude calls updateField({ key, value }) → Supabase write
        │
        User: "re-run it"
        │
        Claude calls researchOffer → worker re-runs
        │         (section phase: review → researching → review)
        │         (chat stays visible during same-section re-run)
        │
        New results land → compare scores
        ├── Score >= 8 → "Score hit 8.2, approve when ready"
        ├── Score < 8, round < 2 → continue refinement
        └── Score < 8, round >= 2 → "Remaining gaps may need business changes. Approve as-is or keep refining."

        Re-run failure → chat shows: "Re-run failed. You can retry or approve current results."
```

### Existing Infrastructure Used (Not Modified)

| Component | Role | Changes |
|-----------|------|---------|
| `research-worker/src/runners/offer.ts` | Produces 7-dimension scores, priorityFixes, recommendedActionPlan | None |
| `src/lib/workspace/card-taxonomy.ts` | Parses offer data into cards | None |
| `src/components/workspace/workspace-provider.tsx` | Section approval state machine | None |
| `src/app/api/journey/stream/route.ts` | Chat agent with tools | Additive: register `updateField` tool, refinement prompt addendum |
| `src/components/workspace/right-rail.tsx` | Per-section chat sidebar | Additive: auto-seed logic, score tracking |
| `src/components/workspace/workspace-page.tsx` | Workspace layout | Small: chat visibility tweak |

## Implementation

### 1. New Tool: `updateField`

**File**: `src/lib/ai/tools/update-field.ts`

**Key constraint**: The `key` parameter uses `z.enum()` with a hardcoded allowlist of onboarding field keys — not `z.string()`. This prevents writes to non-field keys like `activeJourneyRunId` or `researchPipeline` that share the same Supabase `metadata` JSONB blob.

```typescript
import { z } from 'zod';

// Allowlist — only onboarding fields, not internal metadata keys
const UPDATABLE_FIELD_KEYS = [
  'businessModel', 'productDescription', 'coreDeliverables',
  'pricingTiers', 'valueProp', 'guarantees', 'primaryIcpDescription',
  'topCompetitors', 'uniqueEdge', 'goals', 'monthlyAdBudget',
  'industryVertical', 'jobTitles', 'companySize', 'geography',
  'situationBeforeBuying', 'desiredTransformation', 'commonObjections',
  'brandPositioning',
] as const;

export const updateFieldSchema = z.object({
  key: z.enum(UPDATABLE_FIELD_KEYS)
    .describe("The onboarding field to update"),
  value: z.string()
    .describe("The new value for the field"),
  reason: z.string()
    .describe("One-sentence explanation of why this improves the offer"),
});
```

**Registration**: Defined **inline** in `src/app/api/journey/stream/route.ts` inside the POST handler as a closure capturing `userId` and `body.activeRunId` from the request scope. This is intentionally different from the standalone import pattern used by other tools — `updateField` needs request-scoped auth context that standalone modules don't have. The schema (`updateFieldSchema`) is imported from the standalone file; only the `execute` function is defined inline. Calls `persistToSupabase(userId, { [key]: value }, activeRunId)`.

**QC note**: `state.cards` is keyed by cardId (globally unique), NOT by sectionKey. To find offer score cards, filter: `Object.values(state.cards).filter(c => c.sectionKey === 'offerAnalysis')`. The stat-grid card has `label: 'Offer Score'` with `content.stats[0].value` formatted as `"5.7/10"` — parse with `parseFloat(value.split('/')[0])`.

**No approval gate**: The tool executes immediately when Claude calls it (same as `askUser`). The user's natural language confirmation ("yeah update it") is sufficient — the conversational context makes intent clear. If the user wants to undo, they can say "revert that" and Claude calls `updateField` again with the original value.

### 2. Auto-Seed Message on Score Arrival

**File**: `src/components/workspace/right-rail.tsx`

**Trigger**: `useEffect` watching `state.sectionStates[state.currentSection]` and `state.cards[state.currentSection]`.

**Access to cards**: `useWorkspace()` exposes `state.cards` (a `Record<SectionKey, CardState[]>`). The auto-seed reads cards for the current section and finds the stat-grid card containing `overallScore`.

**Logic**:
1. When current section is `offerAnalysis` AND phase transitions to `'review'`
2. Read `state.cards.offerAnalysis` — find the stat-grid card with score data
3. If no score card found, skip auto-seed silently (graceful fallback for malformed output)
4. If `overallScore < 8`, inject a `localMessage` with score breakdown
5. If `overallScore >= 8`, inject a brief "Score looks strong" message instead

**Round counter**: Stored as a `useRef<number>` in RightRail, scoped to the `offerAnalysis` section. Incremented each time the section transitions from `researching` → `review`. Resets to 0 on section navigation (acceptable — if user leaves and comes back, refinement restarts fresh).

**Previous score**: Stored as a `useRef<number | null>`. Updated each time score data is read. Used for comparison messages ("5.7 → 7.8").

### 3. Chat Visibility During Refinement

**File**: `src/components/workspace/workspace-page.tsx`

**Current**: `hasActiveResearch` hides RightRail when any section is researching/streaming.

**Change**: Show chat when current section is in `'review'` OR `'researching'` (to keep chat visible during same-section re-runs):

```typescript
const currentSectionPhase = state.sectionStates[state.currentSection];
const isCurrentSectionActive = currentSectionPhase === 'review' || currentSectionPhase === 'researching';
const showChat = !hasActiveResearch || isCurrentSectionActive;
```

This ensures the chat stays visible during the re-run of the section the user is looking at, while still hiding it when the user is on a queued section with background research running.

### 4. Score Comparison on Re-Run

**File**: `src/components/workspace/right-rail.tsx`

When the offer section transitions from `'researching'` back to `'review'` (detected by the same `useEffect` as auto-seed):

1. Read new `overallScore` from updated cards
2. Compare against `prevScoreRef.current`
3. Inject comparison message with dimension-level deltas
4. Apply exit logic:
   - Score >= 8 → "Score hit [X]. Approve when ready."
   - Score < 8 AND `roundRef.current >= 2` → "Score is [X]. The remaining gaps may need business-level changes (e.g., [weakest dimension]: [score]/10). You can approve as-is or keep refining."
   - Score < 8 AND `roundRef.current < 2` → "Score improved to [X]. Want to keep going?"

**Re-run failure**: If section transitions to `'error'` instead of `'review'`, inject: "Re-run failed: [error message]. You can retry or approve the previous results."

### 5. System Prompt Addendum for Refinement Context

**File**: `src/app/api/journey/stream/route.ts`

**Trigger detection**: The RightRail chat uses a separate `useChat` instance (scoped to the section). Its messages do NOT contain the main journey conversation's research outputs. Therefore, the refinement context is injected via **the auto-seed message text itself** — when the RightRail sends the first user message, the seeded assistant message (containing score data) is already in the conversation, giving Claude the context it needs.

Additionally, the stream route detects refinement mode by checking if the latest user message references offer scores or improvement. A lightweight heuristic:

```typescript
const isRefinementChat = requestMessages.some(m =>
  m.role === 'assistant' &&
  m.parts.some(p => typeof p === 'object' && 'text' in p &&
    typeof (p as {text: string}).text === 'string' &&
    (p as {text: string}).text.includes('Score:') &&
    (p as {text: string}).text.includes('/10'))
);
```

When detected, append:

```
## Offer Refinement Mode

You are helping the user improve their offer based on scoring data visible in the conversation.
Rules:
1. Reference specific dimensions that scored low
2. Suggest concrete field updates — always name the field key (valueProp, productDescription, etc.)
3. Call updateField ONLY after the user confirms ("yes", "do it", "update it", etc.)
4. After 2-3 field updates, suggest re-running offer analysis to see the new score
5. Base suggestions on competitor data and ICP from the research — never fabricate metrics
6. If the user says "re-run" or "re-analyze", call researchOffer to re-dispatch
```

## Safety Constraints

1. **Runner untouched** — offer.ts scoring schema, prompt, and output format unchanged
2. **Card rendering untouched** — card-taxonomy.ts offer parsing unchanged
3. **Stream route additive** — updateField added to tools object, no existing tools modified
4. **RightRail additive** — auto-seed is a new useEffect, existing chat logic unchanged
5. **Pipeline unchanged** — approval state machine and section transitions unchanged
6. **Field validation** — updateField uses `z.enum()` with hardcoded allowlist, not `z.string()`
7. **No metadata corruption** — allowlist excludes internal keys (`activeJourneyRunId`, `researchPipeline`, `lastUpdated`)
8. **Build order** — each piece verified independently before moving to next

## Build Order

1. `updateField` tool with `z.enum` allowlist → verify stream route compiles and existing tools work
2. Register in stream route as closure with userId/activeRunId → verify chat still functions
3. Auto-seed logic in RightRail with score reading from `state.cards` → verify cards still render
4. Chat visibility fix with same-section re-run support → verify hide/show works for all phases
5. Score comparison + round counter logic → verify re-run flow end-to-end
6. System prompt addendum with heuristic detection → verify existing directives still fire
7. Error path: re-run failure message → verify error state handling

## Success Criteria

- User enters offer analysis with score 5.7
- Chat auto-seeds score breakdown and asks what to improve
- User converses naturally, approves field changes via natural language
- `updateField` writes to Supabase with validated key (z.enum enforcement)
- User triggers re-run, chat stays visible during re-run
- New results show score comparison ("5.7 → 7.8")
- Score >= 8 prompts approval
- After 2 rounds below 8, system explains structural gaps
- Re-run failure shows recovery message in chat
- No score card in results → auto-seed skips silently
- Navigation away and back resets refinement (acceptable)
- No regression in existing offer cards, pipeline flow, or other sections
