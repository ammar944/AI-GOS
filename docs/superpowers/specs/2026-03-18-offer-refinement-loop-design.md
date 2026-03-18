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
        Claude calls researchOffer → worker re-runs offer analysis
        │
        New results land → compare scores
        ├── Score >= 8 → "Score hit 8.2, approve when ready"
        └── Score < 8 after 2 rounds → "Remaining gaps may need business changes. Approve as-is or keep refining."
```

### Existing Infrastructure Used (Not Modified)

| Component | Role | Changes |
|-----------|------|---------|
| `research-worker/src/runners/offer.ts` | Produces 7-dimension scores, priorityFixes, recommendedActionPlan | None |
| `src/lib/workspace/card-taxonomy.ts` | Parses offer data into cards | None |
| `src/components/workspace/workspace-provider.tsx` | Section approval state machine | None |
| `src/app/api/journey/stream/route.ts` | Chat agent with tools | Additive: register `updateField` tool |
| `src/components/workspace/right-rail.tsx` | Per-section chat sidebar | Additive: auto-seed logic |
| `src/components/workspace/workspace-page.tsx` | Workspace layout | Small: chat visibility tweak |

## Implementation

### 1. New Tool: `updateField`

**File**: `src/lib/ai/tools/update-field.ts`

```typescript
// Tool definition for the journey stream route
{
  description: "Update a specific onboarding field in the user's session. Use when the user approves a recommended improvement to their business data (value prop, pricing, ICP, etc.).",
  inputSchema: z.object({
    key: z.string().describe("The field key to update (e.g., 'valueProp', 'productDescription', 'coreDeliverables', 'pricingTiers', 'primaryIcpDescription', 'topCompetitors', 'uniqueEdge', 'goals')"),
    value: z.string().describe("The new value for the field"),
    reason: z.string().describe("Brief explanation of why this change improves the offer (shown to user)"),
  }),
  execute: async ({ key, value, reason }) => {
    // Write to Supabase journey_sessions.metadata[key]
    // Reuse existing persistToSupabase() logic
    return { updated: true, key, reason };
  }
}
```

**Registration**: Add to the tools object in `src/app/api/journey/stream/route.ts` alongside `askUser`, `scrapeClientSite`, etc.

**Allowed keys**: Restrict to known onboarding field keys from `JOURNEY_FIELD_LABELS` to prevent arbitrary writes.

### 2. Auto-Seed Message on Score Arrival

**File**: `src/components/workspace/right-rail.tsx`

**Trigger**: When `state.currentSection === 'offerAnalysis'` and the section transitions to `'review'` phase.

**Logic**:
1. Read offer results from workspace state (cards for the current section)
2. Find the score card (stat-grid type with `overallScore`)
3. If `overallScore < 8`, format a seeded assistant message:
   - Score breakdown (7 dimensions as a compact list)
   - Top 2-3 weakest dimensions highlighted
   - "I can help improve these. Which should we tackle first?"
4. Inject as a local assistant message in the chat thread

**Does NOT**:
- Call the AI (it's a locally injected message, not a round-trip)
- Modify the chat transport or useChat hook
- Fire on sections without scoring data

### 3. Chat Visibility During Refinement

**File**: `src/components/workspace/workspace-page.tsx`

**Current**: `hasActiveResearch` hides RightRail when any section is researching/streaming.

**Change**: Add exception — if the *current* section is in `'review'` phase, show the chat even if other sections are active. The user needs the chat to refine the section they're looking at.

```typescript
const showChat = !hasActiveResearch || state.sectionStates[state.currentSection] === 'review';
```

### 4. Score Comparison on Re-Run

**File**: `src/components/workspace/right-rail.tsx`

When offer results arrive after a re-run (section transitions from `'researching'` back to `'review'`):
1. Compare new `overallScore` to the previous score (stored in component state)
2. Inject a comparison message: "Score improved from 5.7 to 7.8. Differentiation: 3 → 7."
3. If score >= 8: "Looking good. Approve when you're ready."
4. If score < 8 and this is round 2+: "Score is 6.9. The remaining gaps (proof: 5/10) may need real business changes — add case studies with metrics. You can approve as-is or keep refining."

### 5. System Prompt Addendum for Refinement Context

**File**: `src/app/api/journey/stream/route.ts`

When the conversation context indicates offer results exist with a low score, append a directive:

```
## Offer Refinement Mode

Offer analysis results are available with an overall score of [X]/10.
When the user asks to improve their offer:
1. Reference specific dimensions that scored low
2. Suggest concrete field updates tied to onboarding fields
3. Use updateField tool when the user approves a change
4. After multiple changes, suggest re-running offer analysis
5. Never fabricate metrics — base suggestions on competitor data and ICP
```

This is appended per-request (same pattern as existing Stage 2 Directive, Strategist Mode, etc.).

## Safety Constraints

1. **Runner untouched** — offer.ts scoring schema, prompt, and output format unchanged
2. **Card rendering untouched** — card-taxonomy.ts offer parsing unchanged
3. **Stream route additive** — updateField added to tools object, no existing tools modified
4. **RightRail additive** — auto-seed is a new useEffect, existing chat logic unchanged
5. **Pipeline unchanged** — approval state machine and section transitions unchanged
6. **Field validation** — updateField only accepts keys from JOURNEY_FIELD_LABELS
7. **Build order** — each piece verified independently before moving to next

## Build Order

1. `updateField` tool → verify stream route compiles and existing tools work
2. Register in stream route → verify chat still functions
3. Auto-seed logic in RightRail → verify cards still render
4. Chat visibility fix → verify hide/show still works for other sections
5. Score comparison logic → verify re-run flow end-to-end
6. System prompt addendum → verify existing directives still fire

## Success Criteria

- User enters offer analysis with score 5.7
- Chat shows score breakdown and asks what to improve
- User converses naturally, approves field changes
- Fields update in Supabase
- User triggers re-run, new score reflects improvements
- After 2 rounds below 8, system explains structural gaps
- Score >= 8 transitions cleanly to standard approval
- No regression in existing offer cards, pipeline flow, or other sections
