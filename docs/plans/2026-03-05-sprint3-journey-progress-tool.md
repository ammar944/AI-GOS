# Sprint 3: journeyProgress Tool (todo.md Pattern)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement Manus's todo.md pattern as a `journeyProgress` tool that forces the model to articulate its state after every significant action, preventing goal drift over long trajectories.

**Architecture:** New no-op tool that the model calls to write its current plan. The tool input IS the value — it sits at the end of context in the high-attention zone. Frontend parses these tool calls to render a live progress tracker.

**Tech Stack:** Vercel AI SDK v6, Next.js App Router, Claude Opus 4.6, Zod

**Depends on:** Sprint 1 (tool results must flow back for accurate research status tracking)

---

## Why This Matters

From the alignment doc (Manus pattern):
> "The agent creates a todo.md and rewrites it after each step, checking off completed items. This is deliberate attention manipulation — by constantly rewriting the plan at the end of context, it pushes the global plan into the model's recent attention window, avoiding lost-in-the-middle degradation."

From LangChain:
> "TodoWrite as progress anchor — no-op tool that forces model to articulate plan."

Currently, `src/lib/ai/journey-state.ts` (`parseCollectedFields`) infers state server-side from messages. The model has no explicit awareness of its own progress. Over 10+ tool calls, it can loop, re-ask questions, or forget to trigger research.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/ai/tools/journey-progress.ts` | Create | journeyProgress tool definition |
| `src/hooks/use-journey-progress.ts` | Create | Extract model progress from messages |
| `src/app/api/journey/stream/route.ts` | Modify | Register new tool |
| `src/lib/ai/prompts/lead-agent-system.ts` | Modify | Add mandatory call instruction |
| `src/components/shell/progress-tracker.tsx` | Modify | Accept model-driven progress |
| `src/lib/ai/tools/__tests__/journey-progress.test.ts` | Create | Unit tests |
| `src/hooks/__tests__/use-journey-progress.test.ts` | Create | Unit tests |

---

### Task 1: Define journeyProgress tool

**Files:**
- Create: `src/lib/ai/tools/journey-progress.ts`
- Test: `src/lib/ai/tools/__tests__/journey-progress.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/ai/tools/__tests__/journey-progress.test.ts
import { describe, it, expect } from 'vitest';

describe('journeyProgress tool', () => {
  it('exports a valid tool definition', async () => {
    const { journeyProgress } = await import('../journey-progress');
    expect(journeyProgress).toBeDefined();
    expect(journeyProgress.description).toContain('progress');
  });

  it('execute returns plan_updated status', async () => {
    const { journeyProgress } = await import('../journey-progress');
    // Tool has an execute function that returns { status: 'plan_updated' }
    const result = await (journeyProgress as any).execute({
      stage: 'discovery',
      fieldsCollected: { businessModel: 'B2B SaaS' },
      fieldsPending: ['industry', 'icpDescription'],
      researchStatus: {},
      completedActions: ['Asked businessModel'],
      nextActions: ['Ask industry'],
      reasoning: 'Need industry to deliver Stage 1 hot-take',
    });
    expect(result.status).toBe('plan_updated');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/lib/ai/tools/__tests__/journey-progress.test.ts`

**Step 3: Write minimal implementation**

```typescript
// src/lib/ai/tools/journey-progress.ts
import { tool } from 'ai';
import { z } from 'zod';

export const journeyProgress = tool({
  description:
    'Update your journey progress plan. Call this after every askUser response, ' +
    'research tool completion, or significant decision. This is your working memory — ' +
    'it keeps you on track across a long conversation. Your progress calls are ' +
    'visible to the user as a progress tracker.',
  inputSchema: z.object({
    stage: z.enum(['discovery', 'research', 'synthesis', 'strategy']).describe(
      'Current phase: discovery (collecting fields), research (running tools), ' +
      'synthesis (cross-analysis), strategy (final recommendations)',
    ),
    fieldsCollected: z.record(z.string(), z.string()).describe(
      'Field name → collected value (e.g., { businessModel: "B2B SaaS", industry: "Developer Tools" })',
    ),
    fieldsPending: z.array(z.string()).describe(
      'Fields still needed from the required 8',
    ),
    researchStatus: z.record(
      z.string(),
      z.enum(['pending', 'queued', 'running', 'complete', 'failed']),
    ).describe(
      'Research tool → status (e.g., { researchIndustry: "complete", researchCompetitors: "pending" })',
    ),
    completedActions: z.array(z.string()).describe(
      'What you have done so far in this session',
    ),
    nextActions: z.array(z.string()).max(3).describe(
      'Your next 1-3 planned actions (be specific)',
    ),
    reasoning: z.string().describe(
      'WHY you are doing what you plan to do next — forces explicit planning',
    ),
  }),
  execute: async (input) => {
    // No-op: The tool does NOTHING functionally.
    // Its entire purpose is forcing the model to articulate and track its plan.
    // The input IS the value — it sits in context at the high-attention position.
    return { status: 'plan_updated' as const, timestamp: new Date().toISOString() };
  },
});
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/lib/ai/tools/__tests__/journey-progress.test.ts`

**Step 5: Commit**

```bash
git add src/lib/ai/tools/journey-progress.ts src/lib/ai/tools/__tests__/journey-progress.test.ts
git commit -m "feat: add journeyProgress no-op tool (Manus todo.md pattern)"
```

---

### Task 2: Register tool in route.ts

**Files:**
- Modify: `src/app/api/journey/stream/route.ts`

**Step 1: Add import**

```typescript
import { journeyProgress } from '@/lib/ai/tools/journey-progress';
```

**Step 2: Add to tools object**

```typescript
tools: {
  askUser,
  competitorFastHits,
  journeyProgress,  // ← NEW — Manus todo.md pattern
  researchIndustry,
  researchCompetitors,
  researchICP,
  researchOffer,
  synthesizeResearch,
  researchKeywords,
  researchMediaPlan,
},
```

Now 10 tools total. This is stable — Sprint 2 requires tool stability, so this must be added once and never removed.

**Step 3: Run build**

Run: `npm run build`
Expected: Exit 0

**Step 4: Commit**

```bash
git add src/app/api/journey/stream/route.ts
git commit -m "feat: register journeyProgress tool in lead agent"
```

---

### Task 3: Add mandatory call instruction to system prompt

**Files:**
- Modify: `src/lib/ai/prompts/lead-agent-system.ts`

**Step 1: Add instruction section**

Add to `LEAD_AGENT_SYSTEM_PROMPT` (in the static section, before the closing backtick):

```
## Progress Tracking (MANDATORY)

After EVERY one of these events, call \`journeyProgress\`:
1. After receiving an \`askUser\` response from the user
2. After a research tool returns results (success or failure)
3. After making a significant decision or changing your plan
4. Before triggering research (to document why you're triggering it)

This is your working memory. Use it to stay on track across a long conversation.
Your \`journeyProgress\` calls are visible to the user as a progress tracker.

When calling \`journeyProgress\`:
- \`fieldsCollected\`: Only include fields you have CONFIRMED values for
- \`fieldsPending\`: List all 8 required fields minus what's collected
- \`researchStatus\`: Track all 7 research tools, not just the ones you've called
- \`nextActions\`: Be specific — "Ask industry using askUser" not "continue onboarding"
- \`reasoning\`: Explain WHY your next action makes sense given current state
```

**Step 2: Verify system prompt is still static**

This instruction is part of the frozen system prompt (Sprint 2). It never changes between requests.

**Step 3: Commit**

```bash
git add src/lib/ai/prompts/lead-agent-system.ts
git commit -m "feat: add mandatory journeyProgress instruction to system prompt"
```

---

### Task 4: Create useJourneyProgress hook

**Files:**
- Create: `src/hooks/use-journey-progress.ts`
- Test: `src/hooks/__tests__/use-journey-progress.test.ts`

**Step 1: Write the failing test**

```typescript
// src/hooks/__tests__/use-journey-progress.test.ts
import { describe, it, expect } from 'vitest';
import { extractLatestProgress, type ModelProgress } from '../use-journey-progress';

describe('extractLatestProgress', () => {
  it('returns null when no journeyProgress calls exist', () => {
    const messages: any[] = [
      { role: 'user', content: 'Hello', parts: [] },
      { role: 'assistant', content: 'Hi', parts: [{ type: 'text', text: 'Hi' }] },
    ];
    expect(extractLatestProgress(messages)).toBeNull();
  });

  it('extracts the latest journeyProgress tool input', () => {
    const messages: any[] = [
      {
        role: 'assistant',
        content: '',
        parts: [
          {
            type: 'tool-journeyProgress',
            state: 'output-available',
            toolInvocation: {
              args: {
                stage: 'discovery',
                fieldsCollected: { businessModel: 'B2B SaaS' },
                fieldsPending: ['industry'],
                researchStatus: {},
                completedActions: ['Asked businessModel'],
                nextActions: ['Ask industry'],
                reasoning: 'Need industry for hot-take',
              },
            },
          },
        ],
      },
    ];

    const result = extractLatestProgress(messages);
    expect(result).not.toBeNull();
    expect(result!.stage).toBe('discovery');
    expect(result!.fieldsCollected.businessModel).toBe('B2B SaaS');
  });

  it('returns the LAST journeyProgress call when multiple exist', () => {
    const makeProgressPart = (stage: string) => ({
      type: 'tool-journeyProgress',
      state: 'output-available',
      toolInvocation: {
        args: {
          stage,
          fieldsCollected: {},
          fieldsPending: [],
          researchStatus: {},
          completedActions: [],
          nextActions: [],
          reasoning: '',
        },
      },
    });

    const messages: any[] = [
      { role: 'assistant', parts: [makeProgressPart('discovery')] },
      { role: 'assistant', parts: [makeProgressPart('research')] },
    ];

    const result = extractLatestProgress(messages);
    expect(result!.stage).toBe('research');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/hooks/__tests__/use-journey-progress.test.ts`

**Step 3: Write minimal implementation**

```typescript
// src/hooks/use-journey-progress.ts
import { useMemo } from 'react';
import type { UIMessage } from '@ai-sdk/ui-utils';

export interface ModelProgress {
  stage: 'discovery' | 'research' | 'synthesis' | 'strategy';
  fieldsCollected: Record<string, string>;
  fieldsPending: string[];
  researchStatus: Record<string, string>;
  completedActions: string[];
  nextActions: string[];
  reasoning: string;
}

/**
 * Extract the latest journeyProgress tool input from messages.
 * Pure function — can be tested without React.
 */
export function extractLatestProgress(messages: UIMessage[]): ModelProgress | null {
  let latest: ModelProgress | null = null;

  for (const msg of messages) {
    if (msg.role !== 'assistant' || !msg.parts) continue;
    for (const part of msg.parts) {
      if (
        part.type === 'tool-journeyProgress' &&
        (part as any).state === 'output-available' &&
        (part as any).toolInvocation?.args
      ) {
        latest = (part as any).toolInvocation.args as ModelProgress;
      }
    }
  }

  return latest;
}

/**
 * React hook: returns the latest journeyProgress from the message stream.
 */
export function useJourneyProgress(messages: UIMessage[]): ModelProgress | null {
  return useMemo(() => extractLatestProgress(messages), [messages]);
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/hooks/__tests__/use-journey-progress.test.ts`

**Step 5: Commit**

```bash
git add src/hooks/use-journey-progress.ts src/hooks/__tests__/use-journey-progress.test.ts
git commit -m "feat: add useJourneyProgress hook for model-driven progress"
```

---

### Task 5: Wire model progress to ProgressTracker

**Files:**
- Modify: `src/components/shell/progress-tracker.tsx`

**Step 1: Add optional modelProgress prop**

```typescript
interface ProgressTrackerProps {
  journeyProgress: JourneyProgress;
  modelProgress?: ModelProgress | null;  // ← NEW
}
```

**Step 2: Use model progress to drive stage status**

When `modelProgress` is available:
- Map `modelProgress.stage` to the active stage indicator
- Use `fieldsPending.length === 0` to mark onboarding complete
- Use `researchStatus` values to drive research substage completion
- Show `nextActions` as upcoming items below the tracker
- Show `reasoning` as a subtle tooltip on the active stage

Falls back to existing `computeJourneyProgress` when `modelProgress` is null.

**Step 3: Run build**

Run: `npm run build`
Expected: Exit 0

**Step 4: Commit**

```bash
git add src/components/shell/progress-tracker.tsx
git commit -m "feat: wire model-driven progress to ProgressTracker UI"
```

---

### Task 6: Integration test — end-to-end progress tracking

**Step 1: Start dev server and run a conversation**

- Open journey page
- Answer 2-3 onboarding questions
- Watch for `journeyProgress` tool calls in the message stream

**Step 2: Verify in browser DevTools**

- Open Network tab → filter for `/api/journey/stream`
- Check SSE events for `tool-journeyProgress` parts
- Verify the model calls it after each `askUser` response

**Step 3: Verify ProgressTracker updates**

- After model calls `journeyProgress`, the progress tracker should reflect:
  - Correct stage (discovery → research → synthesis → strategy)
  - Correct fields collected vs pending
  - Correct research status per tool

**Step 4: Run build to verify**

Run: `npm run build`
Expected: Exit 0

---

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| 1 | `journeyProgress` tool registered and callable | Tool appears in SSE stream |
| 2 | Model calls it after askUser response | Check message stream for consecutive tool calls |
| 3 | Model calls it after research completion | Verify `researchStatus` updates |
| 4 | Frontend renders model-driven progress | ProgressTracker shows stage + fields |
| 5 | `nextActions` visible in UI | Check progress panel |
| 6 | Model stays on track over 15+ tool calls | No repeated questions, no forgotten research |
| 7 | Tool is instant (no blocking) | Execute returns immediately |
| 8 | Tool schema stable (Sprint 2 compatible) | Schema never changes between requests |
| 9 | `npm run build` passes | CI |
| 10 | `npm run test:run` passes | CI |

## Risks and Mitigations

1. **Model doesn't call the tool consistently**: System prompt instruction is strong. Monitor compliance in first 5 test conversations. If <80% compliance, strengthen to "MUST call" with examples.
2. **Extra tokens per call**: ~150-250 input tokens per journeyProgress call. Acceptable cost for coherent state. Over 20 calls = ~4,000 extra tokens (~$0.01).
3. **Tool part parsing**: `extractLatestProgress` depends on `part.type === 'tool-journeyProgress'`. Verify this matches the actual SDK output format.
4. **Conflict with existing progress**: Both `computeJourneyProgress` and model-driven progress can coexist. Model-driven takes precedence. Existing computation is the fallback.

## Execution Order

Tasks 1-3 are the backend foundation. Task 4 is the frontend hook. Task 5 wires them together. Task 6 is manual verification.

Recommended: 1 → 2 → 3 → 4 → 5 → 6
