# Agent Behavioral Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the 7 agent behavioral issues identified in the audit — add code enforcement for dependency validation, unify REQUIRED_FIELDS, resolve system prompt contradictions, pass session start mode, and fix multiSelect behavior.

**Architecture:** Three categories of change: (1) Code guards in `generateResearch` and route.ts that enforce section dependencies and field readiness at runtime rather than relying on prompt alone, (2) Single source of truth for REQUIRED_FIELDS with the prompt referencing code, (3) System prompt clarifications that resolve contradictions and add session-mode awareness.

**Tech Stack:** TypeScript, Vercel AI SDK v6, Zod, Vitest

---

### Task 1: Add dependency validation to generateResearch

The `generateResearch` tool blindly executes any section the agent requests. The `dependsOn` metadata in `configs.ts` is never checked. This means the agent can call `strategicSynthesis` before its 4 dependencies complete.

**Files:**
- Modify: `src/lib/ai/tools/generate-research.ts:178-190`
- Read: `src/lib/ai/sections/configs.ts` (for `dependsOn` metadata)
- Test: `src/lib/ai/tools/__tests__/generate-research-deps.test.ts`

**Step 1: Write the failing test**

Create `src/lib/ai/tools/__tests__/generate-research-deps.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { assertDependenciesMet } from '../generate-research';

describe('assertDependenciesMet', () => {
  it('passes when section has no dependencies', () => {
    expect(() =>
      assertDependenciesMet('industryResearch', {}),
    ).not.toThrow();
  });

  it('passes when all dependencies are complete', () => {
    expect(() =>
      assertDependenciesMet('offerAnalysis', {
        competitorIntel: 'complete',
      }),
    ).not.toThrow();
  });

  it('throws when a dependency is missing', () => {
    expect(() =>
      assertDependenciesMet('offerAnalysis', {}),
    ).toThrow(/competitorIntel/);
  });

  it('throws when a dependency errored', () => {
    expect(() =>
      assertDependenciesMet('offerAnalysis', {
        competitorIntel: 'error',
      }),
    ).toThrow(/competitorIntel/);
  });

  it('throws when strategicSynthesis is called without all 4 deps', () => {
    expect(() =>
      assertDependenciesMet('strategicSynthesis', {
        industryResearch: 'complete',
        competitorIntel: 'complete',
        // missing icpValidation, offerAnalysis
      }),
    ).toThrow(/icpValidation/);
  });

  it('passes when strategicSynthesis has all 4 deps complete', () => {
    expect(() =>
      assertDependenciesMet('strategicSynthesis', {
        industryResearch: 'complete',
        competitorIntel: 'complete',
        icpValidation: 'complete',
        offerAnalysis: 'complete',
      }),
    ).not.toThrow();
  });
});
```

**Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/ai/tools/__tests__/generate-research-deps.test.ts`
Expected: FAIL — `assertDependenciesMet` is not exported

**Step 3: Implement assertDependenciesMet and wire it into execute**

In `src/lib/ai/tools/generate-research.ts`, add after the existing `assertRevisionChainAllowsSection` function (after line 113):

```typescript
import { SECTION_CONFIGS } from '@/lib/ai/sections/configs';

/**
 * Validate that all dependency sections for `sectionId` have status 'complete'
 * in the completedSections map. Throws if any dependency is missing or errored.
 */
export function assertDependenciesMet(
  sectionId: string,
  completedSections: Record<string, string>,
): void {
  const config = SECTION_CONFIGS[sectionId];
  if (!config || config.dependsOn.length === 0) return;

  const missing = config.dependsOn.filter(
    (dep) => completedSections[dep] !== 'complete',
  );

  if (missing.length > 0) {
    throw new Error(
      `Cannot run ${sectionId}: missing completed dependencies: ${missing.join(', ')}`,
    );
  }
}
```

Then in the `execute` function, after `assertRevisionChainAllowsSection` (line 190), add:

```typescript
// Validate section dependencies are met
const completedSections: Record<string, string> = {};
if (context.previousSections) {
  for (const [key, value] of Object.entries(context.previousSections)) {
    if (typeof value === 'string' && value.length > 0) {
      completedSections[key] = 'complete';
    }
  }
}
assertDependenciesMet(sectionId, completedSections);
```

**Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/ai/tools/__tests__/generate-research-deps.test.ts`
Expected: PASS (6 tests)

**Step 5: Run full type check**

Run: `npx tsc --noEmit 2>&1 | grep -v "__tests__" | grep -v ".test." | head -5`
Expected: No non-test errors

**Step 6: Commit**

```bash
git add src/lib/ai/tools/generate-research.ts src/lib/ai/tools/__tests__/generate-research-deps.test.ts
git commit -m "feat: add dependency validation to generateResearch — enforce section ordering"
```

---

### Task 2: Unify REQUIRED_FIELDS to single source of truth

Two files define different REQUIRED_FIELDS lists:
- `journey-state.ts` line 16: 7 fields (includes `websiteUrl`, excludes `industryVertical`, `pricingTiers`)
- `session-state.ts` line 121: 8 fields (includes `industryVertical`, `pricingTiers`, excludes `websiteUrl`)

The authoritative list should be `session-state.ts` (8 fields) because it drives the profile card's essentials counter and completion percentage. `journey-state.ts` should import from `session-state.ts`.

**Files:**
- Modify: `src/lib/ai/journey-state.ts:16-24`
- Read: `src/lib/journey/session-state.ts:121-130`
- Test: `src/lib/ai/__tests__/journey-state.test.ts` (existing, may need update)

**Step 1: Write the failing test**

Add to `src/lib/ai/__tests__/journey-state-fields.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { REQUIRED_FIELDS as JOURNEY_STATE_REQUIRED } from '@/lib/ai/journey-state';
import { REQUIRED_FIELDS as SESSION_STATE_REQUIRED } from '@/lib/journey/session-state';

describe('REQUIRED_FIELDS consistency', () => {
  it('journey-state and session-state export the same REQUIRED_FIELDS', () => {
    expect([...JOURNEY_STATE_REQUIRED].sort()).toEqual(
      [...SESSION_STATE_REQUIRED].sort(),
    );
  });

  it('includes the 8 canonical required fields', () => {
    const canonical = [
      'businessModel',
      'industryVertical',
      'primaryIcpDescription',
      'productDescription',
      'topCompetitors',
      'pricingTiers',
      'monthlyAdBudget',
      'goals',
    ];
    expect([...SESSION_STATE_REQUIRED].sort()).toEqual(canonical.sort());
  });
});
```

**Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/journey-state-fields.test.ts`
Expected: FAIL — lists don't match

**Step 3: Fix journey-state.ts to import from session-state.ts**

In `src/lib/ai/journey-state.ts`, replace lines 16-24:

```typescript
// OLD:
export const REQUIRED_FIELDS = [
  'websiteUrl',
  'businessModel',
  'primaryIcpDescription',
  'productDescription',
  'topCompetitors',
  'monthlyAdBudget',
  'goals',
] as const;

type RequiredField = (typeof REQUIRED_FIELDS)[number];
```

With:

```typescript
// Single source of truth: session-state.ts
// Re-export so dependents don't need to change imports.
import { REQUIRED_FIELDS as _REQUIRED_FIELDS } from '@/lib/journey/session-state';

export const REQUIRED_FIELDS = _REQUIRED_FIELDS;

type RequiredField = (typeof _REQUIRED_FIELDS)[number];
```

**Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/ai/__tests__/journey-state-fields.test.ts`
Expected: PASS

**Step 5: Type check**

Run: `npx tsc --noEmit 2>&1 | grep -v "__tests__" | grep -v ".test." | head -5`
Expected: No new errors. The `as const` → mutable array import may need a type tweak — if so, cast: `export const REQUIRED_FIELDS = _REQUIRED_FIELDS as readonly string[];`

**Step 6: Commit**

```bash
git add src/lib/ai/journey-state.ts src/lib/ai/__tests__/journey-state-fields.test.ts
git commit -m "fix: unify REQUIRED_FIELDS — journey-state imports from session-state (single source of truth)"
```

---

### Task 3: Resolve prefill semantics contradiction in system prompt

The system prompt contradicts itself:
- Line 206 (buildResumeContext): "Do NOT re-ask questions for fields listed above — they are already collected"
- Line 220 (system prompt): "Prefill data counts as 'collected' only after the user confirms it"

**Resolution:** Prefill data accepted via the Prefill Review Card (the "Use these details and start" button) IS confirmed — the user explicitly approved it. The system prompt line 220 is about site-scrape inferences that haven't been reviewed, not reviewed prefill. Clarify this distinction.

**Files:**
- Modify: `src/lib/ai/prompts/lead-agent-system.ts:204-221`

**Step 1: Read the current prompt section**

Already read above. Lines 204-221 in the system prompt handle prefill.

**Step 2: Edit the prefill section**

In `src/lib/ai/prompts/lead-agent-system.ts`, replace the prefill rules section (lines 215-220 in the LEAD_AGENT_SYSTEM_PROMPT string — the "Rules:" block under "Using Prefill Data"):

Replace:
```
Rules:
- Present ONE field at a time as you naturally reach that topic in conversation
- Frame as confirmation, not interrogation: "I see X — is that right?" not "Please confirm X"
- If the user corrects the prefill, use their correction and move on
- If no prefill exists for a field, ask normally
- Prefill data counts as "collected" only after the user confirms it (same rules as site scrape inferences)
```

With:
```
Rules:
- Present ONE field at a time as you naturally reach that topic in conversation
- Frame as confirmation, not interrogation: "I see X — is that right?" not "Please confirm X"
- If the user corrects the prefill, use their correction and move on
- If no prefill exists for a field, ask normally
- **Reviewed prefill** (user clicked "Use these details" in the prefill review card) is ALREADY confirmed — do NOT re-ask those fields. They appear in the Session Resume section.
- **Unreviewed site-scrape inferences** (from scrapeClientSite) are NOT confirmed until the user validates them in conversation or you call confirmJourneyFields.
```

Also update `buildResumeContext` (line 48-67) to clarify:

Replace:
```
**Important**: Do NOT re-ask questions for fields listed above — they are already collected.
```

With:
```
**Important**: These fields were reviewed and accepted by the user. They are CONFIRMED — do NOT re-ask them. Start by briefly acknowledging you have their context (one sentence max), then immediately continue with the next unanswered required field.
```

**Step 3: Type check**

Run: `npx tsc --noEmit 2>&1 | grep "lead-agent-system" | head -5`
Expected: No errors

**Step 4: Commit**

```bash
git add src/lib/ai/prompts/lead-agent-system.ts
git commit -m "fix: resolve prefill semantics contradiction — distinguish reviewed prefill from unreviewed scrape"
```

---

### Task 4: Pass session start mode to the agent

When the user clicks "Start without website analysis", the agent still asks for a URL because it doesn't know the session was started without one.

**Files:**
- Modify: `src/app/journey/page.tsx` (where `transportBody` is set)
- Modify: `src/app/api/journey/stream/route.ts:49-54` (request interface)
- Modify: `src/lib/ai/prompts/lead-agent-system.ts` (add session mode addendum)

**Step 1: Add `startMode` to the transport body in page.tsx**

Find where `transportBody` / `body` is configured in `src/app/journey/page.tsx`. When the user clicks "Start without website analysis", add `startMode: 'no-url'` to the body. When they click "Analyze website first", add `startMode: 'with-url'`.

In `page.tsx`, find the `handleSeedSubmit` function and the "Start without website analysis" handler. Add the `startMode` field to whichever state object or ref is passed to the stream route body.

**Step 2: Read `startMode` in route.ts**

In `src/app/api/journey/stream/route.ts`, add to the `JourneyStreamRequest` interface (line 49):

```typescript
interface JourneyStreamRequest {
  messages: UIMessage[];
  resumeState?: Record<string, unknown>;
  confirmedState?: unknown;
  sessionId?: string;
  startMode?: 'with-url' | 'no-url';
}
```

Then after building `systemPrompt` (around line 204), inject the mode:

```typescript
if (body.startMode === 'no-url') {
  systemPrompt += `\n\n## Session Start Mode\n\nThe user explicitly chose "Start without website analysis." Do NOT ask for their website URL. Skip directly to asking their company name, what they do, and their business model via askUser chips. They made a deliberate choice not to provide a URL — respect it.`;
}
```

**Step 3: Type check**

Run: `npx tsc --noEmit 2>&1 | grep -v "__tests__" | grep -v ".test." | head -5`
Expected: No non-test errors

**Step 4: Commit**

```bash
git add src/app/journey/page.tsx src/app/api/journey/stream/route.ts
git commit -m "feat: pass startMode to agent — skip URL asking when user chose 'Start without website'"
```

---

### Task 5: Add citation-required guard to system prompt

The agent stated competitor data ("zero paid ads") without tool backing. The system prompt already forbids this (line 84), but the rule is buried. Make it more prominent with a specific enforcement section.

**Files:**
- Modify: `src/lib/ai/prompts/lead-agent-system.ts`

**Step 1: Add an explicit data integrity section**

In `src/lib/ai/prompts/lead-agent-system.ts`, add after the "You ALWAYS:" block (after line 97):

```typescript
## Data Integrity (CRITICAL — violations destroy credibility)

You MUST follow these rules for ALL factual claims about companies, markets, or metrics:

1. **Tool-sourced only**: Every statistic, ad count, keyword ranking, market size figure, or competitor behavior claim MUST come from a tool result (competitorFastHits, generateResearch, scrapeClientSite). If you don't have tool data, say "I'll dig into this in the research phase."
2. **No training data for specifics**: Never state "Company X is doing Y" or "the market is $Z" from your training data. You may use domain expertise for GENERAL strategic advice ("B2B SaaS companies typically see longer sales cycles") but never for SPECIFIC claims about a named company or market.
3. **Cite your source**: When referencing a finding, name the tool: "From our competitor analysis...", "Our market research found...", "Looking at your site..."
4. **When in doubt, qualify**: "I'll need to verify this in our research phase" is always better than a confident guess.
```

**Step 2: Type check**

Run: `npx tsc --noEmit 2>&1 | grep "lead-agent-system" | head -5`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/ai/prompts/lead-agent-system.ts
git commit -m "fix: add prominent data integrity section to system prompt — no unsourced claims"
```

---

### Task 6: Inject onboarding progress into route.ts

The `getOnboardingProgress()` function exists in `journey-state.ts` but is NEVER called in route.ts. It computes `readyForResearch`, `readyForCompletion`, current phase, and next fields. Injecting this as a system prompt addendum gives the agent code-derived awareness of where it is.

**Files:**
- Modify: `src/app/api/journey/stream/route.ts:207-223`
- Read: `src/lib/ai/journey-state.ts:258-310`

**Step 1: Import and call getOnboardingProgress in route.ts**

In `src/app/api/journey/stream/route.ts`, add to the import from `journey-state`:

```typescript
import { parseCollectedFields, mergeExternalFields, getOnboardingProgress } from '@/lib/ai/journey-state';
```

Then after the `mergeExternalFields` block (after line 223), add:

```typescript
// Derive progress and inject as system prompt addendum
const progress = getOnboardingProgress(journeySnap);
systemPrompt += `\n\n## Current Onboarding State (auto-injected)\n\nPhase: ${progress.phase}/6 (${progress.phaseName})\nCompleted fields: ${progress.completedFields.length > 0 ? progress.completedFields.join(', ') : 'none'}\nNext fields to collect: ${progress.nextFields.length > 0 ? progress.nextFields.join(', ') : 'none — ready for completion'}\nReady for research: ${progress.readyForResearch ? 'YES — businessModel + ICP confirmed' : 'NO — need businessModel + ICP first'}\nAll required fields complete: ${progress.readyForCompletion ? 'YES' : 'NO'}\n\nUse this state to guide your next action. If readyForResearch is YES and you haven't called generateResearch for industryResearch yet, do it NOW.`;
```

**Step 2: Type check**

Run: `npx tsc --noEmit 2>&1 | grep -v "__tests__" | grep -v ".test." | head -5`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/journey/stream/route.ts
git commit -m "feat: inject onboarding progress into system prompt — code-derived phase awareness"
```

---

### Task 7: Fix multiSelect behavior in askUser tool

The conversion mechanism question (`currentFunnelType`) submitted on first click instead of allowing multi-select with a "Done" button. This is likely an issue with how the agent calls `askUser` — it may be setting `multiSelect: false` or omitting it.

**Files:**
- Read: `src/lib/ai/tools/ask-user.ts` (to see the schema)
- Modify: `src/lib/ai/prompts/lead-agent-system.ts:157` (clarify multiSelect for currentFunnelType)

**Step 1: Read the askUser tool definition**

Read `src/lib/ai/tools/ask-user.ts` to see how `multiSelect` is defined in the schema.

**Step 2: Verify the prompt specifies multiSelect for currentFunnelType**

In `src/lib/ai/prompts/lead-agent-system.ts`, line 157 already says:
```
- `currentFunnelType` — askUser multiSelect chips: "Lead Form", "Booking / Calendar Page", ...
```

The word "multiSelect" is there, but the agent may not reliably set `multiSelect: true` in the tool call. Reinforce it:

Replace line 157:
```
- \`currentFunnelType\` — askUser multiSelect chips: "Lead Form", "Booking / Calendar Page", "Free Trial", "Webinar / Live Event", "Product Demo", "Application Form", "Challenge / Course", "E-commerce / Direct Purchase"
```

With:
```
- \`currentFunnelType\` — askUser with **multiSelect: true** (most businesses use multiple funnels). Chips: "Lead Form", "Booking / Calendar Page", "Free Trial", "Webinar / Live Event", "Product Demo", "Application Form", "Challenge / Course", "E-commerce / Direct Purchase"
```

Also reinforce in the askUser usage section (around line 191):

Add after line 191:
```
- When the field allows multiple answers (bestClientSources, currentFunnelType, companySize), ALWAYS set multiSelect: true. Single-select for these fields is a bug.
```

**Step 3: Type check**

Run: `npx tsc --noEmit 2>&1 | grep "lead-agent-system" | head -5`
Expected: No errors

**Step 4: Commit**

```bash
git add src/lib/ai/prompts/lead-agent-system.ts
git commit -m "fix: reinforce multiSelect: true for multi-answer fields in system prompt"
```

---

## Execution Order

Tasks are ordered by priority and dependency:

1. **Task 1** (P0): Dependency validation — code guard
2. **Task 2** (P0): Unify REQUIRED_FIELDS — data consistency
3. **Task 3** (P0): Prefill semantics — prompt fix
4. **Task 6** (P1): Inject onboarding progress — code-derived state
5. **Task 4** (P1): Session start mode — prompt context
6. **Task 5** (P1): Citation guard — prompt fix
7. **Task 7** (P2): multiSelect fix — prompt fix

Tasks 3, 5, and 7 all modify the same file (`lead-agent-system.ts`). Execute them in the order above to avoid merge conflicts. Tasks 1 and 2 are independent and could be parallelized.

---

## Verification Gate

After all 7 tasks:

```bash
# Build check
npx tsc --noEmit 2>&1 | grep -v "__tests__" | grep -v ".test." | head -5

# Test check
npx vitest run src/lib/ai/tools/__tests__/generate-research-deps.test.ts src/lib/ai/__tests__/journey-state-fields.test.ts src/lib/journey/__tests__/prefill.test.ts src/lib/journey/__tests__/research-sections.test.ts

# Manual check: start app, go through onboarding with "Start without website",
# verify agent doesn't ask for URL, verify research fires after businessModel + ICP confirmed
```
