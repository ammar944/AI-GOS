# Offer Refinement Loop Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When offer analysis scores below 8/10, the per-section chat sidebar auto-seeds recommendations and lets users improve fields via conversation, then re-run to get a higher score.

**Architecture:** New `updateField` tool registered inline in stream route as a closure. RightRail gets a `useEffect` that reads offer score cards and injects local messages. Chat visibility logic updated to keep chat open during same-section re-runs.

**Tech Stack:** Vercel AI SDK v6 (tools, streamText), Zod schemas, React (useEffect, useRef), Supabase (persistToSupabase)

**Spec:** `docs/superpowers/specs/2026-03-18-offer-refinement-loop-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/ai/tools/update-field.ts` | Create | Zod schema + allowlist for updateField |
| `src/app/api/journey/stream/route.ts` | Modify (lines 551-561) | Register updateField tool inline, add refinement prompt addendum |
| `src/components/workspace/right-rail.tsx` | Modify | Auto-seed logic, score refs, comparison messages |
| `src/components/workspace/workspace-page.tsx` | Modify (line 228) | Chat visibility during same-section re-run |

---

### Task 1: Create updateField Schema

**Files:**
- Create: `src/lib/ai/tools/update-field.ts`

- [ ] **Step 1: Create the schema file**

```typescript
// src/lib/ai/tools/update-field.ts
import { z } from 'zod';

/**
 * Allowlist of onboarding field keys that the chat agent may update.
 * Excludes internal metadata keys (activeJourneyRunId, researchPipeline, lastUpdated).
 */
export const UPDATABLE_FIELD_KEYS = [
  'businessModel',
  'productDescription',
  'coreDeliverables',
  'pricingTiers',
  'valueProp',
  'guarantees',
  'primaryIcpDescription',
  'topCompetitors',
  'uniqueEdge',
  'goals',
  'monthlyAdBudget',
  'industryVertical',
  'jobTitles',
  'companySize',
  'geography',
  'situationBeforeBuying',
  'desiredTransformation',
  'commonObjections',
  'brandPositioning',
] as const;

export type UpdatableFieldKey = (typeof UPDATABLE_FIELD_KEYS)[number];

export const updateFieldInputSchema = z.object({
  key: z
    .enum(UPDATABLE_FIELD_KEYS)
    .describe('The onboarding field to update'),
  value: z
    .string()
    .describe('The new value for the field'),
  reason: z
    .string()
    .describe('One-sentence explanation of why this change improves the offer'),
});
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep update-field`
Expected: No output (no errors)

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/tools/update-field.ts
git commit -m "feat: add updateField schema with z.enum allowlist"
```

---

### Task 2: Register updateField in Stream Route

**Files:**
- Modify: `src/app/api/journey/stream/route.ts` (lines 1-10 for import, lines 551-561 for tools object)

- [ ] **Step 1: Add import at top of route**

Add after the existing tool imports (around line 18):

```typescript
import { updateFieldInputSchema } from '@/lib/ai/tools/update-field';
```

Also add `persistToSupabase` to the existing import from `session-state.server` if not already imported (check line 28 — it's already imported).

- [ ] **Step 2: Define updateField tool inline in the tools object**

In the `streamText` call (around line 551), add `updateField` to the tools object. It must be defined inline as a closure to capture `userId` and `body.activeRunId`:

```typescript
tools: {
  askUser,
  competitorFastHits,
  scrapeClientSite,
  researchIndustry,
  researchCompetitors,
  researchICP,
  researchOffer,
  synthesizeResearch,
  researchKeywords,
  updateField: {
    description:
      'Update a specific onboarding field in the user\'s session. Call this when the user approves a recommended improvement to their business data (value prop, pricing, ICP description, etc.). Only call after the user explicitly confirms the change.',
    inputSchema: updateFieldInputSchema,
    execute: async ({ key, value, reason }) => {
      const result = await persistToSupabase(
        userId,
        { [key]: value },
        body.activeRunId ?? undefined,
      );
      if (!result.ok) {
        return { updated: false, error: result.error ?? 'Failed to update field' };
      }
      return { updated: true, key, value, reason };
    },
  },
},
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep "stream/route"`
Expected: No output (no errors)

- [ ] **Step 4: Verify existing tools still listed**

Visually confirm all 9 existing tools are still in the tools object — `askUser`, `competitorFastHits`, `scrapeClientSite`, `researchIndustry`, `researchCompetitors`, `researchICP`, `researchOffer`, `synthesizeResearch`, `researchKeywords`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/journey/stream/route.ts
git commit -m "feat: register updateField tool in stream route"
```

---

### Task 3: Add Refinement Prompt Addendum

**Files:**
- Modify: `src/app/api/journey/stream/route.ts` (add after existing prompt addenda, before the `streamText` call)

- [ ] **Step 1: Add refinement mode detection and prompt addendum**

Add this block after the existing `isPrefillMessage` / `pendingReviewSection` / `strategistModeReady` addenda (around line 535, before the `// ── Stream` comment):

```typescript
// ── Offer refinement mode ──────────────────────────────────────────────
// Detect if the RightRail chat contains offer score data (seeded by frontend).
// If so, append refinement instructions so Claude knows to use updateField.
const isRefinementChat = requestMessages.some(
  (m) =>
    m.role === 'assistant' &&
    m.parts.some((p) => {
      if (typeof p !== 'object' || !p || !('type' in p)) return false;
      const typed = p as { type: string; text?: string };
      return (
        typed.type === 'text' &&
        typeof typed.text === 'string' &&
        typed.text.includes('Score:') &&
        typed.text.includes('/10')
      );
    }),
);

if (isRefinementChat) {
  systemPrompt += `\n\n## Offer Refinement Mode

You are helping the user improve their offer based on scoring data visible in the conversation.
Rules:
1. Reference specific dimensions that scored low
2. Suggest concrete field updates — always name the field key (valueProp, productDescription, coreDeliverables, pricingTiers, etc.)
3. Call updateField ONLY after the user confirms ("yes", "do it", "update it", etc.)
4. After 2-3 field updates, suggest re-running offer analysis to see the new score
5. Base suggestions on the conversation context — never fabricate metrics
6. If the user says "re-run" or "re-analyze", call researchOffer to re-dispatch the offer analysis`;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep "stream/route"`
Expected: No output

- [ ] **Step 3: Commit**

```bash
git add src/app/api/journey/stream/route.ts
git commit -m "feat: add offer refinement prompt addendum to stream route"
```

---

### Task 4: Chat Visibility During Same-Section Re-Run

**Files:**
- Modify: `src/components/workspace/workspace-page.tsx` (around line 228)

- [ ] **Step 1: Update chat visibility logic**

Find the current `hasActiveResearch` usage (around line 228):

```typescript
{!hasActiveResearch && (
  <RightRail className="hidden md:flex w-[380px] shrink-0" />
)}
```

Replace with:

```typescript
{(() => {
  const currentPhase = state.sectionStates[state.currentSection];
  const isCurrentSectionActive = currentPhase === 'review' || currentPhase === 'researching';
  const showChat = !hasActiveResearch || isCurrentSectionActive;
  return showChat ? (
    <RightRail className="hidden md:flex w-[380px] shrink-0" />
  ) : null;
})()}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep "workspace-page"`
Expected: No output

- [ ] **Step 3: Commit**

```bash
git add src/components/workspace/workspace-page.tsx
git commit -m "fix: show chat sidebar during same-section re-runs"
```

---

### Task 5: Auto-Seed Score Breakdown in RightRail

**Files:**
- Modify: `src/components/workspace/right-rail.tsx`

This is the largest task. It adds score reading, auto-seed messages, round tracking, and score comparison.

- [ ] **Step 1: Add score helper function at top of file (after imports)**

```typescript
import type { CardState } from '@/lib/workspace/types';

/**
 * Extract the numeric offer score from workspace cards.
 * Returns null if no offer score card is found.
 */
function extractOfferScore(cards: Record<string, CardState>): {
  overall: number;
  dimensions: Array<{ label: string; value: number }>;
} | null {
  const scoreCard = Object.values(cards).find(
    (c) => c.sectionKey === 'offerAnalysis' && c.label === 'Offer Score',
  );
  if (!scoreCard) return null;

  const stats = scoreCard.content?.stats;
  if (!Array.isArray(stats) || stats.length === 0) return null;

  const dimensions: Array<{ label: string; value: number }> = [];
  let overall = 0;

  for (const stat of stats) {
    const s = stat as { label?: string; value?: string };
    if (!s.label || !s.value) continue;
    const num = parseFloat(String(s.value).split('/')[0]);
    if (Number.isNaN(num)) continue;

    if (s.label === 'Overall Score') {
      overall = num;
    } else {
      dimensions.push({ label: s.label, value: num });
    }
  }

  return overall > 0 ? { overall, dimensions } : null;
}

/**
 * Format score breakdown into a chat-friendly message.
 */
function formatScoreMessage(
  score: { overall: number; dimensions: Array<{ label: string; value: number }> },
  prevScore: number | null,
  round: number,
): string {
  const lines: string[] = [];

  // Score comparison header
  if (prevScore !== null) {
    lines.push(`Score updated: ${prevScore}/10 → ${score.overall}/10`);
  } else {
    lines.push(`Your offer analysis scored ${score.overall}/10.`);
  }

  // Dimension breakdown — sort weakest first
  const sorted = [...score.dimensions].sort((a, b) => a.value - b.value);
  lines.push('');
  lines.push('Breakdown:');
  for (const dim of sorted) {
    const bar = dim.value >= 7 ? 'strong' : dim.value >= 5 ? 'moderate' : 'weak';
    lines.push(`  ${dim.label}: ${dim.value}/10 (${bar})`);
  }

  // Exit logic
  if (score.overall >= 8) {
    lines.push('');
    lines.push('Looking good — approve when you\'re ready.');
  } else if (round >= 2) {
    const weakest = sorted[0];
    lines.push('');
    lines.push(
      `The remaining gaps may need business-level changes (e.g., ${weakest.label}: ${weakest.value}/10). You can approve as-is or keep refining.`,
    );
  } else {
    lines.push('');
    lines.push('I can help improve the weak areas. Which should we tackle first?');
  }

  return lines.join('\n');
}
```

- [ ] **Step 2: Add refs and auto-seed useEffect inside the RightRail component**

Add these refs after the existing `prevSectionRef`:

```typescript
// Offer refinement tracking
const refinementRoundRef = useRef(0);
const prevScoreRef = useRef<number | null>(null);
const lastSeededPhaseRef = useRef<string | null>(null);
```

Add this `useEffect` after the existing "Clear local messages on section change" effect:

```typescript
// Auto-seed offer score breakdown when section enters review
useEffect(() => {
  if (state.currentSection !== 'offerAnalysis') return;

  const phase = state.sectionStates.offerAnalysis;

  // Build a discriminator that changes on re-runs — use the score card's
  // latest version timestamp (changes each time worker writes new results).
  const scoreCard = Object.values(state.cards).find(
    (c) => c.sectionKey === 'offerAnalysis' && c.label === 'Offer Score',
  );
  const latestVersion = scoreCard?.versions?.[scoreCard.versions.length - 1]?.timestamp ?? 0;
  const phaseKey = `${phase}-${latestVersion}`;

  // Only fire once per distinct phase+result combination (not on re-renders)
  if (lastSeededPhaseRef.current === phaseKey) return;

  if (phase === 'review') {
    lastSeededPhaseRef.current = phaseKey;

    const score = extractOfferScore(state.cards);
    if (!score) return; // No score card — skip silently

    // Increment round counter on each re-run (prevScore exists = this is a re-run).
    // Round 0 = first result, round 1 = first re-run, round 2 = second re-run.
    // Exit condition (round >= 2) fires after the second re-run attempt.
    if (prevScoreRef.current !== null) {
      refinementRoundRef.current += 1;
    }

    const message = formatScoreMessage(
      score,
      prevScoreRef.current,
      refinementRoundRef.current,
    );

    prevScoreRef.current = score.overall;

    setLocalMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: 'assistant' as const,
        text: message,
      },
    ]);
  }

  if (phase === 'error') {
    lastSeededPhaseRef.current = phaseKey;
    const errorMsg = state.sectionErrors.offerAnalysis ?? 'Unknown error';
    setLocalMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: 'assistant' as const,
        text: `Re-run failed: ${errorMsg}. You can retry or approve the previous results.`,
      },
    ]);
  }
}, [state.currentSection, state.sectionStates, state.cards, state.sectionErrors]);
```

- [ ] **Step 3: Reset refs on section change**

Update the existing "Clear local messages on section change" effect to also reset refinement refs:

```typescript
useEffect(() => {
  if (prevSectionRef.current !== state.currentSection) {
    setLocalMessages([]);
    prevSectionRef.current = state.currentSection;
    // Reset refinement tracking for new section
    refinementRoundRef.current = 0;
    prevScoreRef.current = null;
    lastSeededPhaseRef.current = null;
  }
}, [state.currentSection]);
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep "right-rail"`
Expected: No output

- [ ] **Step 5: Verify the component renders**

Start dev server (`npm run dev`), navigate to the workspace with an existing offer analysis section. Confirm:
- Cards still render in ArtifactCanvas
- Chat sidebar appears
- If offer has a score card, a score breakdown message appears in the chat

- [ ] **Step 6: Commit**

```bash
git add src/components/workspace/right-rail.tsx
git commit -m "feat: auto-seed offer score breakdown in RightRail chat"
```

---

### Task 6: End-to-End Verification

No code changes — manual testing.

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: Build succeeds with no new errors

- [ ] **Step 2: Run existing tests**

Run: `npm run test:run`
Expected: All existing tests pass (pre-existing failures in openrouter/deep-dive tests are expected)

- [ ] **Step 3: Test the refinement flow end-to-end**

1. Start dev server + worker (`npm run dev` + `cd research-worker && npm run dev`)
2. Go through onboarding with saaslaunch.net
3. Wait for offer analysis to complete
4. Check: does the RightRail chat show a score breakdown?
5. Type "improve the differentiation" in the chat
6. Check: does Claude suggest a field update and use updateField?
7. Type "re-run the offer analysis"
8. Check: does the section re-dispatch and new results show a score comparison?

- [ ] **Step 4: Verify no regression**

1. Navigate between sections — chat should clear on section change
2. Approve a non-offer section — pipeline should advance normally
3. Check other sections (industry, competitors, ICP) — no score auto-seed should fire
4. Hide/show chat — should still hide when on a queued section with background research

- [ ] **Step 5: Final commit if any tweaks needed**

```bash
git add -A
git commit -m "fix: refinement loop end-to-end adjustments"
```

---

## Verification Checklist

- [ ] `updateField` tool compiles and is in the tools object
- [ ] Existing 9 tools unchanged in stream route
- [ ] RightRail auto-seeds score breakdown for offer section only
- [ ] Chat stays visible during same-section re-run
- [ ] Score comparison shows after re-run
- [ ] Round 2+ shows structural gap message
- [ ] Error state shows recovery message
- [ ] No score card → auto-seed skips silently
- [ ] Section navigation resets refinement state
- [ ] `npm run build` passes
- [ ] `npm run test:run` passes (pre-existing failures only)
