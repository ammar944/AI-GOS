# Task 2.1: Route Integration

## Objective

Modify the journey stream route to include the askUser tool, add step control with `stepCountIs(15)`, and extract askUser results from incoming messages for Supabase persistence.

## Context

The route at `src/app/api/journey/stream/route.ts` currently streams a basic chat with Claude Opus 4.6 using adaptive thinking. This task adds the askUser tool so the agent can present structured questions, adds step control so the multi-turn flow has headroom for ~8 questions + follow-ups, and adds server-side persistence of answered fields to Supabase.

**CRITICAL (DISCOVERY.md D9 REVISED)**: For interactive tools (no `execute`), `streamText.onFinish.steps[N].toolResults` is EMPTY. The tool result comes from the client on the NEXT HTTP request. Therefore, persistence must extract from the incoming `body.messages`, NOT from `onFinish`.

## Dependencies

- Task 1.1 — `askUser` tool definition
- Task 1.2 — `extractAskUserResults`, `persistToSupabase` functions

## Blocked By

- Phase 1 complete

## Research Findings

- From `ai-sdk-tool-implementation.md`: `stepCountIs` imported from `ai`. Verified exists at `node_modules/ai/dist/index.d.ts:953`. `maxSteps` is REMOVED from v6.
- From DISCOVERY.md D6: Use `stopWhen: stepCountIs(15)`, NOT deprecated `maxSteps`.
- From DISCOVERY.md D9: onFinish for logging only. Persistence from body.messages.
- From DISCOVERY.md D11: Extract from body.messages at start of POST request, before streamText().
- From DISCOVERY.md D22: Supabase write failure → silent fail. Fire-and-forget (no await blocking the response).

## Implementation Plan

### Step 1: Read current route

Read `src/app/api/journey/stream/route.ts` to understand current structure. Preserve ALL existing logic — auth, message parsing, sanitization.

### Step 2: Add imports

```typescript
import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import { askUser } from '@/lib/ai/tools/ask-user';
import { extractAskUserResults, persistToSupabase } from '@/lib/journey/session-state';
```

### Step 3: Add body.messages extraction BEFORE streamText

After the sanitization block and before the `streamText()` call:

```typescript
// ── Persist askUser results from previous round trips ──────────────────
const askUserFields = extractAskUserResults(body.messages);
if (Object.keys(askUserFields).length > 0) {
  // Fire-and-forget — do not await, do not block the response
  persistToSupabase(userId, askUserFields).catch(() => {
    // Already handled internally with console.error
  });
}
```

### Step 4: Add tools and stopWhen to streamText

```typescript
const result = streamText({
  model: anthropic(MODELS.CLAUDE_OPUS),
  system: LEAD_AGENT_SYSTEM_PROMPT,
  messages: await convertToModelMessages(sanitizedMessages),
  temperature: 0.3,
  tools: { askUser },
  stopWhen: stepCountIs(15),
  providerOptions: {
    anthropic: {
      thinking: { type: 'adaptive' },
    },
  },
  onFinish: async ({ usage, steps }) => {
    // Logging only — interactive tool results NOT in steps (DISCOVERY.md D9)
    console.log('[journey] stream finished', {
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      steps: steps.length,
    });
  },
});
```

### Step 5: Verify existing code preserved

- Auth check: unchanged
- Body parsing: unchanged
- Sanitization (INCOMPLETE_TOOL_STATES): unchanged
- Response: `result.toUIMessageStreamResponse()` unchanged

## Files to Create

- None

## Files to Modify

- `src/app/api/journey/stream/route.ts` — add tools, stepCountIs, body.messages extraction, onFinish logging

## Contracts

### Provides (for downstream tasks)

- The route now supports askUser tool calls — when the agent calls askUser, the stream will contain tool call parts that the frontend must render
- Step control: up to 15 steps per conversation turn

### Consumes (from upstream tasks)

- Task 1.1: `askUser` tool from `@/lib/ai/tools/ask-user`
- Task 1.2: `extractAskUserResults`, `persistToSupabase` from `@/lib/journey/session-state`

## Acceptance Criteria

- [ ] `tools: { askUser }` present in streamText config
- [ ] `stopWhen: stepCountIs(15)` present
- [ ] `stepCountIs` imported from `ai` (NOT from any other package)
- [ ] Body.messages extraction runs BEFORE streamText (not in onFinish)
- [ ] Supabase persistence is fire-and-forget (no await blocking response)
- [ ] onFinish callback logs usage only
- [ ] Existing auth, parsing, sanitization logic preserved exactly
- [ ] `npm run build` passes

## Testing Protocol

### Build/Lint/Type Checks

- [ ] `npm run build` succeeds — route compiles

## Skills to Read

- `.claude/orchestration-sprint2-onboarding/skills/ai-sdk-interactive-tools/SKILL.md` — tool integration, stepCountIs, onFinish behavior
- `.claude/orchestration-sprint2-onboarding/skills/onboarding-persistence/SKILL.md` — extractAskUserResults, persistToSupabase

## Research Files to Read

- `.claude/orchestration-sprint2-onboarding/research/ai-sdk-tool-implementation.md` — route target code, verified APIs

## Git

- Branch: `aigos-v2`
- Commit message prefix: `Task 2.1:`
