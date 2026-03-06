# Sprint 2: Stable System Prompt + Append-Only Context

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix KV-cache invalidation by freezing the system prompt and moving all dynamic content to append-only messages at the end of the message array. Cached tokens = $0.30/MTok vs uncached = $3.00/MTok — 10x cost reduction.

**Architecture:** Freeze system prompt to identical bytes every request. Move Stage 2 directive, Strategist Mode guard, and resume context from system prompt to appended user-role messages at the END of the message array. Add deterministic JSON serialization.

**Tech Stack:** Vercel AI SDK v6, Next.js App Router, Claude Opus 4.6

**Depends on:** Sprint 1 (tool results flow back — model needs to see data to drive its own state)

---

## Current State (The Problem)

In `src/app/api/journey/stream/route.ts` (lines 126-167), the system prompt is modified per-request:

1. **Base** (line 127): `LEAD_AGENT_SYSTEM_PROMPT` — static string from `lead-agent-system.ts`
2. **Resume context** (lines 128-134): `buildResumeContext(resumeState)` — appended when `resumeState` exists
3. **Stage 2 Directive** (lines 144-162): Competitor detection → system prompt += directive string
4. **Strategist Mode** (lines 164-167): `synthComplete === true` → system prompt += guard string

Every modification invalidates the KV-cache. Claude charges 10x more for uncached tokens.

### KV-Cache Mechanics
- Claude caches the longest common **prefix** of the input
- System prompt is first → if identical, the cache is hit for the entire prompt
- If even 1 byte changes in the system prompt, cache misses from that point forward
- Appending to the END of messages doesn't affect the prefix cache

### Manus Pattern (from alignment doc)
> "Never modify previous actions or observations in the message array. Never put timestamps or volatile data in the system prompt. Even a single-token difference invalidates the KV-cache from that point forward."

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/ai/context-directives.ts` | Create | Builds dynamic directives from messages |
| `src/lib/ai/deterministic-json.ts` | Create | Sorted-key JSON serialization |
| `src/app/api/journey/stream/route.ts` | Modify | Freeze system prompt, append directives to messages |
| `src/lib/ai/prompts/lead-agent-system.ts` | Modify | Add runtime directive instruction |
| `src/lib/ai/__tests__/context-directives.test.ts` | Create | Unit tests |
| `src/lib/ai/__tests__/deterministic-json.test.ts` | Create | Unit tests |

---

### Task 1: Create deterministic JSON serialization

**Files:**
- Create: `src/lib/ai/deterministic-json.ts`
- Test: `src/lib/ai/__tests__/deterministic-json.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/ai/__tests__/deterministic-json.test.ts
import { describe, it, expect } from 'vitest';
import { deterministicStringify } from '../deterministic-json';

describe('deterministicStringify', () => {
  it('sorts top-level keys alphabetically', () => {
    const result = deterministicStringify({ z: 1, a: 2, m: 3 });
    expect(result).toBe('{"a":2,"m":3,"z":1}');
  });

  it('sorts nested object keys recursively', () => {
    const result = deterministicStringify({ b: { z: 1, a: 2 }, a: 1 });
    expect(result).toBe('{"a":1,"b":{"a":2,"z":1}}');
  });

  it('handles arrays without reordering elements', () => {
    const result = deterministicStringify({ items: [3, 1, 2] });
    expect(result).toBe('{"items":[3,1,2]}');
  });

  it('sorts keys in objects within arrays', () => {
    const result = deterministicStringify({ items: [{ z: 1, a: 2 }] });
    expect(result).toBe('{"items":[{"a":2,"z":1}]}');
  });

  it('handles null and primitives', () => {
    expect(deterministicStringify(null)).toBe('null');
    expect(deterministicStringify('hello')).toBe('"hello"');
    expect(deterministicStringify(42)).toBe('42');
  });

  it('produces identical output for same data regardless of insertion order', () => {
    const obj1: Record<string, number> = {};
    obj1['b'] = 2; obj1['a'] = 1;
    const obj2: Record<string, number> = {};
    obj2['a'] = 1; obj2['b'] = 2;
    expect(deterministicStringify(obj1)).toBe(deterministicStringify(obj2));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/lib/ai/__tests__/deterministic-json.test.ts`

**Step 3: Write minimal implementation**

```typescript
// src/lib/ai/deterministic-json.ts

function sortKeys(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(sortKeys);
  if (typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

export function deterministicStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/lib/ai/__tests__/deterministic-json.test.ts`

**Step 5: Commit**

```bash
git add src/lib/ai/deterministic-json.ts src/lib/ai/__tests__/deterministic-json.test.ts
git commit -m "feat: add deterministic JSON serialization with sorted keys"
```

---

### Task 2: Create context directives builder

**Files:**
- Create: `src/lib/ai/context-directives.ts`
- Test: `src/lib/ai/__tests__/context-directives.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/ai/__tests__/context-directives.test.ts
import { describe, it, expect, vi } from 'vitest';
import type { UIMessage } from '@ai-sdk/ui-utils';

vi.mock('../competitor-detector', () => ({
  detectCompetitorMentions: vi.fn(),
}));
vi.mock('../journey-state', () => ({
  parseCollectedFields: vi.fn(),
}));

describe('buildContextDirectives', () => {
  it('returns empty array when no directives apply', async () => {
    const { detectCompetitorMentions } = await import('../competitor-detector');
    const { parseCollectedFields } = await import('../journey-state');

    vi.mocked(detectCompetitorMentions).mockReturnValue(null);
    vi.mocked(parseCollectedFields).mockReturnValue({
      synthComplete: false,
      competitorFastHitsCalledFor: new Set(),
    } as any);

    const { buildContextDirectives } = await import('../context-directives');
    const directives = buildContextDirectives([], []);
    expect(directives).toHaveLength(0);
  });

  it('includes Stage 2 directive when competitor detected and not already called', async () => {
    const { detectCompetitorMentions } = await import('../competitor-detector');
    const { parseCollectedFields } = await import('../journey-state');

    vi.mocked(detectCompetitorMentions).mockReturnValue({
      domain: 'hubspot.com',
      rawMention: 'HubSpot',
      inferredDomain: true,
    });
    vi.mocked(parseCollectedFields).mockReturnValue({
      synthComplete: false,
      competitorFastHitsCalledFor: new Set(),
    } as any);

    const { buildContextDirectives } = await import('../context-directives');
    const messages = [{ role: 'user', content: 'My competitor is HubSpot' }] as UIMessage[];
    const directives = buildContextDirectives(messages, messages);

    expect(directives.length).toBeGreaterThan(0);
    expect(directives[0]).toContain('hubspot.com');
    expect(directives[0]).toContain('competitorFastHits');
  });

  it('includes Strategist Mode when synthComplete is true', async () => {
    const { detectCompetitorMentions } = await import('../competitor-detector');
    const { parseCollectedFields } = await import('../journey-state');

    vi.mocked(detectCompetitorMentions).mockReturnValue(null);
    vi.mocked(parseCollectedFields).mockReturnValue({
      synthComplete: true,
      competitorFastHitsCalledFor: new Set(),
    } as any);

    const { buildContextDirectives } = await import('../context-directives');
    const directives = buildContextDirectives([], []);

    expect(directives.some(d => d.includes('Strategist Mode'))).toBe(true);
  });

  it('skips Stage 2 when competitor already called', async () => {
    const { detectCompetitorMentions } = await import('../competitor-detector');
    const { parseCollectedFields } = await import('../journey-state');

    vi.mocked(detectCompetitorMentions).mockReturnValue({
      domain: 'hubspot.com',
      rawMention: 'HubSpot',
      inferredDomain: true,
    });
    vi.mocked(parseCollectedFields).mockReturnValue({
      synthComplete: false,
      competitorFastHitsCalledFor: new Set(['hubspot.com']),
    } as any);

    const { buildContextDirectives } = await import('../context-directives');
    const messages = [{ role: 'user', content: 'My competitor is HubSpot' }] as UIMessage[];
    const directives = buildContextDirectives(messages, messages);

    expect(directives.every(d => !d.includes('competitorFastHits'))).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/lib/ai/__tests__/context-directives.test.ts`

**Step 3: Write minimal implementation**

```typescript
// src/lib/ai/context-directives.ts
import type { UIMessage } from '@ai-sdk/ui-utils';
import { detectCompetitorMentions } from './competitor-detector';
import { parseCollectedFields } from './journey-state';

/**
 * Build dynamic context directives from message history.
 * These are appended to the END of the message array as user-role messages,
 * NOT injected into the system prompt (which would break KV-cache).
 *
 * @param sanitizedMessages - Messages with incomplete tool parts stripped
 * @param rawMessages - Original messages for competitor dedup scanning
 */
export function buildContextDirectives(
  sanitizedMessages: UIMessage[],
  rawMessages: UIMessage[],
  resumeState?: Record<string, unknown>,
): string[] {
  const directives: string[] = [];

  // Resume context (if resuming a session)
  if (resumeState && Object.keys(resumeState).length > 0) {
    directives.push(
      `[SYSTEM DIRECTIVE — Resume Context]\n\n` +
      `You are resuming a previous session. Here is where you left off:\n` +
      JSON.stringify(resumeState, null, 2),
    );
  }

  // Stage 2 Directive — Competitor detection
  const lastUserMsg = [...sanitizedMessages].reverse().find(m => m.role === 'user');
  const lastUserText = typeof lastUserMsg?.content === 'string'
    ? lastUserMsg.content
    : '';

  if (lastUserText) {
    const competitorDetection = detectCompetitorMentions(lastUserText);
    const rawSnap = parseCollectedFields(rawMessages);
    const alreadyCalled = competitorDetection !== null &&
      rawSnap.competitorFastHitsCalledFor.has(competitorDetection.domain);

    if (competitorDetection !== null && !alreadyCalled) {
      directives.push(
        `[SYSTEM DIRECTIVE — Stage 2: Competitor Fast Hit]\n\n` +
        `The user's latest message contains a competitor reference: **${competitorDetection.rawMention}**. ` +
        `Extracted domain: \`${competitorDetection.domain}\`${competitorDetection.inferredDomain ? ' (inferred from company name)' : ''}.\n\n` +
        `Call \`competitorFastHits\` with \`competitorUrl: "${competitorDetection.domain}"\` as your FIRST action ` +
        `before responding with text. This is a live lookup — do not skip it.`,
      );
    }
  }

  // Strategist Mode guard
  const journeySnap = parseCollectedFields(sanitizedMessages);
  if (journeySnap.synthComplete) {
    directives.push(
      `[SYSTEM DIRECTIVE — Strategist Mode]\n\n` +
      `All research is complete. You are now in Strategist Mode:\n` +
      `- Do NOT call askUser to collect new onboarding fields\n` +
      `- Do NOT call any research tools\n` +
      `- Present synthesis findings and strategic recommendations\n` +
      `- Respond to the user's strategic questions with specific, data-backed advice`,
    );
  }

  return directives;
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/lib/ai/__tests__/context-directives.test.ts`

**Step 5: Commit**

```bash
git add src/lib/ai/context-directives.ts src/lib/ai/__tests__/context-directives.test.ts
git commit -m "feat: extract dynamic directives from system prompt to append-only messages"
```

---

### Task 3: Update system prompt for directive awareness

**Files:**
- Modify: `src/lib/ai/prompts/lead-agent-system.ts`

**Step 1: Add instruction about runtime directives**

Add to the end of `LEAD_AGENT_SYSTEM_PROMPT` (before the closing backtick):

```typescript
// Append this section to the static system prompt:
`

## Runtime Directives

You may receive messages prefixed with \`[SYSTEM DIRECTIVE]\` appended to the conversation. These contain dynamic instructions based on the current conversation state (competitor detection, mode changes, session resumption). Follow them as if they were part of this system prompt. They take precedence over general guidelines when there is a conflict.`
```

**Step 2: Verify system prompt is now fully static**

The system prompt should contain NO dynamic sections. All volatile content moves to Task 4.

**Step 3: Commit**

```bash
git add src/lib/ai/prompts/lead-agent-system.ts
git commit -m "feat: add runtime directive instruction to static system prompt"
```

---

### Task 4: Freeze system prompt in route.ts

**Files:**
- Modify: `src/app/api/journey/stream/route.ts`

**Step 1: Remove all dynamic system prompt modifications**

Replace lines 126-167 with:

```typescript
// System prompt is 100% static — NEVER modify it between requests.
// Dynamic directives are appended to the message array (end of context).
const systemPrompt = LEAD_AGENT_SYSTEM_PROMPT;

// Build dynamic directives from messages
const directives = buildContextDirectives(
  sanitizedMessages as UIMessage[],
  body.messages as UIMessage[],
  body.resumeState,
);

// Append directives as user-role messages at END of array
const messagesWithDirectives = [
  ...sanitizedMessages,
  ...directives.map(d => ({
    role: 'user' as const,
    content: d,
  })),
];
```

Then update the `streamText` call to use `messagesWithDirectives` instead of `sanitizedMessages`.

**Step 2: Add cache hit logging to onFinish**

```typescript
onFinish: async ({ usage, steps }) => {
  console.log('[journey] Cache hit rate:', {
    cachedTokens: usage?.cachedTokens ?? 0,
    totalInputTokens: usage?.promptTokens ?? 0,
    hitRate: usage?.promptTokens
      ? `${((usage.cachedTokens ?? 0) / usage.promptTokens * 100).toFixed(1)}%`
      : 'N/A',
  });
  // ... existing logging
},
```

**Step 3: Remove unused imports**

Remove `buildResumeContext` import from `lead-agent-system.ts` if no longer used elsewhere.

**Step 4: Run tests and build**

Run: `npm run test:run && npm run build`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/journey/stream/route.ts
git commit -m "feat: freeze system prompt, move directives to append-only messages"
```

---

### Task 5: Manual verification — cache hit rate

**Step 1: Start dev server**

```bash
npm run dev
```

**Step 2: Run a conversation with 3+ turns**

Open the journey page and go through 3 onboarding questions.

**Step 3: Check server logs**

Look for `[journey] Cache hit rate:` entries. After the first request:
- First request: `hitRate: '0%'` (cold cache, expected)
- Second request: `hitRate: '~70-90%'` (system prompt cached)
- Third request: `hitRate: '~70-90%'` (system prompt + early messages cached)

If hit rate stays at 0% across all requests, the system prompt is still changing between requests.

**Step 4: Run build to verify**

Run: `npm run build`
Expected: Exit 0

---

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| 1 | `LEAD_AGENT_SYSTEM_PROMPT` never modified | Grep route.ts for `systemPrompt +=` — should be 0 results |
| 2 | System prompt identical bytes every request | Log `systemPrompt.length` — constant across requests |
| 3 | Stage 2 directive still triggers | Name competitor in chat → model calls `competitorFastHits` |
| 4 | Strategist Mode still works | Complete synthesis → model stops asking questions |
| 5 | Resume context works | Resume session → model acknowledges previous state |
| 6 | Cache hit rate >50% after first request | Check `[journey] Cache hit rate` logs |
| 7 | Tool definitions stable | All 9 tools registered identically every request |
| 8 | `npm run build` passes | CI |
| 9 | `npm run test:run` passes | CI |

## Risks and Mitigations

1. **Model ignoring appended directives**: User-role messages at end of context are high-attention (Lost in the Middle paper). The `[SYSTEM DIRECTIVE]` prefix makes them salient.
2. **Directive ordering**: Strategist Mode takes precedence over Stage 2. If both apply, Strategist Mode wins (no research tools in strategist mode).
3. **Frontend message rendering**: Directive messages could appear in chat UI. **Mitigation**: Filter messages starting with `[SYSTEM DIRECTIVE]` on frontend, or use a content prefix the frontend ignores.
4. **`convertToModelMessages` compatibility**: Appended user-role messages must be valid UIMessage format. Verify the SDK accepts them.

## Execution Order

Task 1 (deterministic JSON) is independent. Tasks 2-4 are sequential. Task 5 is manual verification.

Recommended: 1 → 2 → 3 → 4 → 5
