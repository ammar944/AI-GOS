# Research: Supabase JSONB Persistence + localStorage Sync

**Created**: 2026-02-27
**Scope**: Session state architecture for Sprint 2 conversational onboarding
**Status**: Complete

---

## 1. Existing Codebase Patterns

### 1.1 journey_sessions Table (Already Created)

The migration at `supabase/migrations/20260227_create_journey_sessions_table.sql` defines:

```sql
create table if not exists journey_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,                    -- Clerk user ID
  phase text default 'setup',              -- 'setup' | 'onboarding' | 'complete'
  messages jsonb default '[]'::jsonb,      -- Full message history
  metadata jsonb default '{}'::jsonb,      -- OnboardingState goes HERE
  created_at timestamptz default now(),
  updated_at timestamptz default now()     -- Auto-updated by trigger
);

-- Index for fast user lookups
create index if not exists idx_journey_sessions_user_id on journey_sessions(user_id);

-- Auto-update trigger on updated_at
```

**Key point**: `metadata` is a JSONB column defaulting to `'{}'`. This is where the `OnboardingState` (all 22 fields + phase + completion percentage) will be stored. The table already exists and has been applied.

### 1.2 TypeScript Types (`src/lib/supabase/types.ts`)

The `journey_sessions` table is already typed:

```typescript
journey_sessions: {
  Row: {
    id: string;
    user_id: string;
    phase: string;
    messages: Json;    // Json = string | number | boolean | null | { [key: string]: Json } | Json[]
    metadata: Json;    // OnboardingState will live here
    created_at: string;
    updated_at: string;
  };
  Insert: { ... };  // id, phase, messages, metadata all optional (have defaults)
  Update: { ... };  // All fields optional
};
```

### 1.3 Supabase Client Patterns

**Server-side admin client** (`src/lib/supabase/server.ts`):
- `createAdminClient()` uses `SUPABASE_SERVICE_ROLE_KEY` — bypasses RLS
- This is the pattern for journey_sessions (per DISCOVERY.md D8: "Service role + Clerk ID")
- Auth is handled by Clerk `auth()`, Supabase is DB-only

**Usage in existing actions** (`src/lib/actions/onboarding.ts`):
```typescript
const supabase = createAdminClient();
const { data, error } = await supabase
  .from('user_profiles')
  .upsert({ id: userId, onboarding_data: mergedData }, { onConflict: 'id' })
  .select()
  .single();
```

This fetch-then-merge pattern is used throughout the codebase for JSONB updates.

### 1.4 Existing localStorage Patterns (`src/lib/storage/local-storage.ts`)

The codebase has a well-established localStorage utility:

```typescript
// isBrowser guard
const isBrowser = typeof window !== "undefined";

// Generic typed get/set/remove
function getItem<T>(key: string): T | null { ... }
function setItem<T>(key: string, value: T): boolean { ... }

// Namespaced keys
export const STORAGE_KEYS = {
  ONBOARDING_DATA: "aigog_onboarding_data",
  STRATEGIC_BLUEPRINT: "aigog_strategic_blueprint",
  // ...
} as const;
```

**Pattern to follow**: Add a new key like `JOURNEY_SESSION: "aigog_journey_session"` and typed getter/setter functions.

### 1.5 Existing Journey Route (`src/app/api/journey/stream/route.ts`)

Current route uses `streamText` without tools or persistence:

```typescript
const result = streamText({
  model: anthropic(MODELS.CLAUDE_OPUS),
  system: LEAD_AGENT_SYSTEM_PROMPT,
  messages: await convertToModelMessages(sanitizedMessages),
  temperature: 0.3,
  providerOptions: { anthropic: { thinking: { type: 'adaptive' } } },
});
return result.toUIMessageStreamResponse();
```

**Sprint 2 will add**: `tools`, `maxSteps: 15`, and `onFinish` callback for persistence.

### 1.6 Existing Chat Agent onFinish Pattern (`src/app/api/chat/agent/route.ts`)

The chat agent already uses `onFinish` for persistence — this is the reference pattern:

```typescript
onFinish: async ({ text, totalUsage, steps }) => {
  if (!body.conversationId) return;
  try {
    const totalTokens = totalUsage?.totalTokens || 0;
    const toolCalls = steps?.flatMap(s => s.toolCalls || []) || [];

    await fetch(new URL('/api/chat/messages/save', request.url).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: body.conversationId,
        message: {
          role: 'assistant',
          content: text,
          tokensUsed: totalTokens,
          intent: toolCalls.length > 0 ? toolCalls[0].toolName : 'general',
        },
      }),
    });
  } catch (err) {
    console.error('Failed to persist chat message:', err);
  }
},
```

**Key insight**: `onFinish` is fire-and-forget (async but not awaited by the stream). It has access to `text`, `totalUsage`, and `steps` (which contain all `toolCalls` and `toolResults`).

---

## 2. Supabase JSONB Update Patterns

### 2.1 The Problem

The `metadata` JSONB column stores the full `OnboardingState`. After each `askUser` tool response, we need to update one or a few fields without overwriting the entire object.

Supabase's JavaScript client (`.update()`) replaces the entire JSONB column value. There is no built-in partial JSONB merge via the REST API.

### 2.2 Option A: Fetch-Then-Merge (Recommended for This Project)

This is what the codebase already does in `src/lib/actions/onboarding.ts`:

```typescript
// 1. Fetch current metadata
const { data: session } = await supabase
  .from('journey_sessions')
  .select('metadata')
  .eq('user_id', userId)
  .single();

// 2. Shallow merge in JS
const updatedMetadata = {
  ...(session?.metadata as OnboardingState ?? {}),
  ...newFields,  // e.g., { businessModel: 'B2B SaaS', completionPercent: 12.5 }
};

// 3. Write back
await supabase
  .from('journey_sessions')
  .update({ metadata: updatedMetadata })
  .eq('user_id', userId);
```

**Pros**: Simple, uses existing patterns, type-safe in TypeScript, works with supabase-js.
**Cons**: Two round trips (fetch + update), potential race condition if two updates happen concurrently.

**Race condition mitigation**: In this app, only one stream per user runs at a time (the `onFinish` callback), so concurrent writes to the same session are not a real concern.

### 2.3 Option B: PostgreSQL RPC with `||` Operator (Shallow Merge)

Create a server-side function for atomic shallow merge:

```sql
CREATE OR REPLACE FUNCTION merge_journey_metadata(
  p_user_id TEXT,
  p_metadata JSONB
)
RETURNS void AS $$
BEGIN
  UPDATE journey_sessions
  SET metadata = metadata || p_metadata
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;
```

Call from JS:
```typescript
await supabase.rpc('merge_journey_metadata', {
  p_user_id: userId,
  p_metadata: { businessModel: 'B2B SaaS' },
});
```

**Pros**: Atomic, single round trip, no race conditions.
**Cons**: New migration required, `||` only does shallow merge (top-level keys), need to handle upsert separately.

**Important**: The `||` operator does *shallow* merge only. `'{"a": 1, "b": {"x": 1}}' || '{"b": {"y": 2}}'` produces `{"a": 1, "b": {"y": 2}}` (overwrites `b` entirely). For our flat `OnboardingState` shape, shallow merge is sufficient.

### 2.4 Option C: PostgreSQL RPC with `jsonb_set` (Deep Path Update)

For updating a single nested key:

```sql
CREATE OR REPLACE FUNCTION set_journey_metadata_field(
  p_user_id TEXT,
  p_path TEXT[],
  p_value JSONB
)
RETURNS void AS $$
BEGIN
  UPDATE journey_sessions
  SET metadata = jsonb_set(metadata, p_path, p_value, true)
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;
```

**Pros**: Can update deeply nested keys without fetching.
**Cons**: More complex, only one field at a time, over-engineered for our flat state shape.

### 2.5 Recommended Approach

**Use Option A (fetch-then-merge)** for Sprint 2. Reasons:

1. Matches existing codebase patterns exactly (see `onboarding.ts`)
2. No new migrations needed for RPC functions
3. `OnboardingState` is a flat object (no deep nesting) so shallow merge is perfect
4. Race conditions are not a concern (single stream per user)
5. Can be upgraded to RPC later if performance matters
6. Two round trips are negligible compared to the LLM inference time

### 2.6 Upsert Pattern for Session Creation

The first message should create the session if it doesn't exist:

```typescript
const { data, error } = await supabase
  .from('journey_sessions')
  .upsert({
    user_id: userId,
    phase: 'onboarding',
    metadata: onboardingState,
    messages: messageHistory,
  }, {
    onConflict: 'user_id',  // Requires unique index on user_id
  })
  .select()
  .single();
```

**Note**: The current schema has an index but not a *unique* constraint on `user_id`. A unique constraint should be added to support upsert:

```sql
ALTER TABLE journey_sessions ADD CONSTRAINT journey_sessions_user_id_unique UNIQUE (user_id);
```

Alternatively, fetch first and decide to insert or update:

```typescript
// Check if session exists
const { data: existing } = await supabase
  .from('journey_sessions')
  .select('id, metadata')
  .eq('user_id', userId)
  .maybeSingle();

if (existing) {
  // Update
  await supabase
    .from('journey_sessions')
    .update({ metadata: { ...existing.metadata, ...newFields } })
    .eq('id', existing.id);
} else {
  // Insert
  await supabase
    .from('journey_sessions')
    .insert({ user_id: userId, metadata: newFields });
}
```

---

## 3. Vercel AI SDK `streamText` `onFinish` Callback

### 3.1 Callback Signature

The `onFinish` callback on `streamText` fires when the entire generation (all steps) is complete:

```typescript
streamText({
  model: ...,
  tools: ...,
  maxSteps: 15,
  onFinish: async ({
    text,           // string — final generated text from the LAST step
    toolCalls,      // ToolCall[] — tool calls from the LAST step only
    toolResults,    // ToolResult[] — tool results from the LAST step only
    finishReason,   // 'stop' | 'length' | 'tool-calls' | 'error' | 'other'
    usage,          // { promptTokens, completionTokens, totalTokens } — LAST step
    totalUsage,     // { promptTokens, completionTokens, totalTokens } — ALL steps
    steps,          // StepResult[] — ALL steps, each with text, toolCalls, toolResults, usage
  }) => {
    // Fire-and-forget — runs after stream is consumed
    // Can be async — exceptions are caught and logged
  },
});
```

### 3.2 The `steps` Array — Where Tool Results Live

The `steps` array is the most important parameter for extracting structured data from tool calls:

```typescript
steps.forEach((step, index) => {
  // step.text — text generated in this step
  // step.toolCalls — array of { toolCallId, toolName, args }
  // step.toolResults — array of { toolCallId, toolName, args, result }
  // step.finishReason — why this step ended
  // step.usage — token usage for this step
});
```

### 3.3 Extracting askUser Results from `onFinish`

For Sprint 2, the `askUser` tool will be called multiple times across steps. To extract collected onboarding fields:

```typescript
onFinish: async ({ steps }) => {
  // Collect all askUser tool results across ALL steps
  const askUserResults = steps
    .flatMap(step => step.toolResults || [])
    .filter(result => result.toolName === 'askUser');

  // Build OnboardingState from tool results
  const fieldsCollected: Record<string, unknown> = {};
  for (const result of askUserResults) {
    const { fieldName } = result.args;  // e.g., 'businessModel'
    const { value } = result.result;    // e.g., 'B2B SaaS'
    fieldsCollected[fieldName] = value;
  }

  // Merge into Supabase
  await persistOnboardingState(userId, fieldsCollected);
};
```

### 3.4 `onStepFinish` Callback (Alternative)

For per-step persistence (more granular but more complex):

```typescript
streamText({
  onStepFinish: async ({ toolCalls, toolResults, stepNumber }) => {
    // Fires after EACH step completes
    const askUserResults = toolResults?.filter(r => r.toolName === 'askUser') || [];
    if (askUserResults.length > 0) {
      // Persist this field immediately to Supabase
      await persistOnboardingField(userId, askUserResults[0].args.fieldName, askUserResults[0].result.value);
    }
  },
});
```

### 3.5 Critical Caveat: `onFinish` and Multi-Step

When using `maxSteps > 1`, a single `streamText` call can invoke tools, get results, and generate more text across multiple steps. The `onFinish` callback fires **once** at the very end, with ALL steps available in the `steps` array.

**However**, the top-level `toolCalls` and `toolResults` in `onFinish` only contain data from the **last** step. Always use `steps` to get the full picture.

### 3.6 `onFinish` is Fire-and-Forget

Per the AI SDK docs and community discussions:
- `onFinish` runs after the stream has been fully consumed by the client
- It is async — you can `await` database writes inside it
- Exceptions are caught internally and do not affect the client response
- The stream response has already been sent; this is purely a side-effect hook
- The callback does NOT block the response — the client gets the full stream before `onFinish` runs

### 3.7 Message Persistence via `toUIMessageStreamResponse`

The AI SDK's `toUIMessageStreamResponse` supports an `onFinish` callback that receives `messages` as `UIMessage[]`:

```typescript
return result.toUIMessageStreamResponse({
  onFinish: async ({ messages }) => {
    // messages: UIMessage[] — the complete conversation including the new assistant response
    await saveMessagesToDatabase(userId, messages);
  },
});
```

**Important**: This `onFinish` is on `toUIMessageStreamResponse()`, NOT on `streamText()`. It provides the formatted UI messages. For tool result extraction, use the `streamText` `onFinish` (which has `steps`). You can use BOTH:

```typescript
const result = streamText({
  // ...
  onFinish: async ({ steps }) => {
    // Extract tool results, persist OnboardingState to metadata JSONB
  },
});

return result.toUIMessageStreamResponse({
  onFinish: async ({ messages }) => {
    // Persist full message history to messages JSONB
  },
});
```

---

## 4. localStorage Hydration Patterns for Next.js

### 4.1 The Hydration Problem

Next.js renders components on the server first (SSR/SSG), then "hydrates" on the client. If the initial render depends on localStorage (browser-only API), the server render will differ from client render, causing a hydration mismatch error.

### 4.2 Pattern 1: useEffect + useState (Recommended)

```typescript
'use client';

import { useState, useEffect } from 'react';

function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  // Read from localStorage after hydration
  useEffect(() => {
    try {
      const item = localStorage.getItem(key);
      if (item) setStoredValue(JSON.parse(item));
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
    }
  }, [key]);

  // Write to localStorage
  const setValue = (value: T) => {
    setStoredValue(value);
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error writing localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue];
}
```

**Key**: `useState` initializes with the default value (same on server and client). `useEffect` runs only on the client after hydration, updating state from localStorage. No hydration mismatch.

### 4.3 Pattern 2: isMounted Guard

```typescript
const [isMounted, setIsMounted] = useState(false);

useEffect(() => {
  setIsMounted(true);
}, []);

// Don't render localStorage-dependent UI until mounted
if (!isMounted) return <LoadingSkeleton />;
```

### 4.4 Pattern 3: Lazy Initializer (Careful!)

```typescript
// This CAN cause hydration mismatch if it returns different values server vs client
const [value, setValue] = useState<T>(() => {
  if (typeof window === 'undefined') return initialValue;
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : initialValue;
});
```

**Warning**: The lazy initializer runs during render. If the stored value differs from `initialValue`, the server render (which always uses `initialValue`) will differ from the client render. This causes a hydration mismatch. Only safe if the component is rendered with `dynamic(() => ..., { ssr: false })`.

### 4.5 Recommended Approach for This Project

For the journey page (`src/app/journey/page.tsx`), which is a `'use client'` component:

```typescript
// On mount: read OnboardingState from localStorage for instant display
useEffect(() => {
  const stored = getJourneySession();  // From local-storage.ts
  if (stored) {
    setOnboardingState(stored);
    setCompletionPercent(calculateCompletion(stored));
  }
}, []);

// On askUser response: write to localStorage immediately
const handleAskUserResponse = (fieldName: string, value: unknown) => {
  setOnboardingState(prev => {
    const updated = { ...prev, [fieldName]: value };
    setJourneySession(updated);  // Write to localStorage
    return updated;
  });
};
```

The progress bar and completion percentage should use the React state (populated from localStorage on mount), NOT direct localStorage reads during render.

---

## 5. Belt + Suspenders Persistence Pattern

### 5.1 Architecture Overview

```
User taps chip (frontend)
    |
    v
addToolResult() --> sends to backend via stream
    |                     |
    v                     v
localStorage.setItem()   streamText processes tool result
(IMMEDIATE)              |
                         v
                    onFinish fires after stream completes
                         |
                         v
                    Supabase upsert (metadata JSONB)
                    (DURABLE, eventual)
```

**Frontend (belt)**: localStorage write happens immediately when user selects an option. This gives instant hydration on page refresh.

**Backend (suspenders)**: Supabase write happens in `onFinish` after the stream completes. This is the durable store that survives localStorage clears, device switches, etc.

### 5.2 Frontend Write Flow

```typescript
// In journey/page.tsx or a custom hook
const handleToolResult = (toolCallId: string, fieldName: string, value: unknown) => {
  // 1. Update React state immediately
  setOnboardingState(prev => ({ ...prev, [fieldName]: value }));

  // 2. Write to localStorage immediately (belt)
  const currentState = getJourneySession() || {};
  setJourneySession({ ...currentState, [fieldName]: value });

  // 3. Send tool result to backend (triggers next step)
  addToolResult({ toolCallId, result: { fieldName, value } });
};
```

### 5.3 Backend Write Flow

```typescript
// In /api/journey/stream/route.ts
const result = streamText({
  model: anthropic(MODELS.CLAUDE_OPUS),
  system: LEAD_AGENT_SYSTEM_PROMPT,
  messages: await convertToModelMessages(sanitizedMessages),
  tools: { askUser },
  maxSteps: 15,

  // Per-step persistence (optional, more granular)
  onStepFinish: async ({ toolResults }) => {
    const askUserResults = toolResults?.filter(r => r.toolName === 'askUser') || [];
    for (const r of askUserResults) {
      // Could persist per-field here, but onFinish is simpler
    }
  },

  // Final persistence (suspenders)
  onFinish: async ({ steps }) => {
    try {
      const supabase = createAdminClient();

      // Extract all askUser field values from all steps
      const fieldsCollected: Record<string, unknown> = {};
      for (const step of steps) {
        for (const result of (step.toolResults || [])) {
          if (result.toolName === 'askUser') {
            fieldsCollected[result.args.fieldName] = result.result.value;
          }
        }
      }

      if (Object.keys(fieldsCollected).length === 0) return;

      // Fetch-then-merge pattern
      const { data: existing } = await supabase
        .from('journey_sessions')
        .select('metadata')
        .eq('user_id', userId)
        .maybeSingle();

      const mergedMetadata = {
        ...(existing?.metadata as Record<string, unknown> ?? {}),
        ...fieldsCollected,
        lastUpdated: new Date().toISOString(),
      };

      await supabase
        .from('journey_sessions')
        .upsert({
          user_id: userId,
          phase: 'onboarding',
          metadata: mergedMetadata,
        }, { onConflict: 'user_id' })
        .select()
        .single();
    } catch (err) {
      console.error('[Journey] Failed to persist onboarding state:', err);
    }
  },
});

return result.toUIMessageStreamResponse();
```

### 5.4 Hydration on Page Load

```typescript
// In journey/page.tsx
useEffect(() => {
  async function hydrate() {
    // 1. Read localStorage first (instant, available immediately)
    const localState = getJourneySession();
    if (localState) {
      setOnboardingState(localState);
    }

    // 2. Optionally fetch from Supabase for freshest data
    // (Only needed if user might switch devices)
    try {
      const res = await fetch('/api/journey/session');
      if (res.ok) {
        const { metadata } = await res.json();
        if (metadata) {
          // Supabase is source of truth - overwrite local if newer
          setOnboardingState(metadata);
          setJourneySession(metadata);  // Sync localStorage
        }
      }
    } catch {
      // Supabase fetch failed, localStorage data is good enough
    }
  }
  hydrate();
}, []);
```

---

## 6. Sync Conflict Resolution

### 6.1 When Can Conflicts Occur?

| Scenario | Likelihood | Impact |
|----------|-----------|--------|
| User refreshes mid-stream (localStorage has partial, Supabase has older) | Medium | Low |
| User clears browser data | Low | Medium |
| User switches devices | Low | Medium |
| Two tabs open simultaneously | Very Low | Low |
| Backend `onFinish` fails silently | Low | Medium |

### 6.2 Resolution Strategy: Last-Write-Wins with Supabase as Source of Truth

**Rule 1**: Supabase is the **source of truth** for durable state. localStorage is a fast cache.

**Rule 2**: On page load, prefer Supabase data over localStorage when available:

```typescript
// Hydration priority:
// 1. Show localStorage immediately (avoid blank state)
// 2. Fetch Supabase in background
// 3. If Supabase has data, overwrite localStorage + React state
// 4. If Supabase fetch fails, keep localStorage data
```

**Rule 3**: On each askUser response, write to BOTH localStorage and Supabase. localStorage is synchronous (immediate), Supabase is async (eventual via onFinish).

**Rule 4**: Include a `lastUpdated` timestamp in the metadata. When resolving conflicts, compare timestamps:

```typescript
// In hydration logic
if (supabaseState && localState) {
  const supabaseTime = new Date(supabaseState.lastUpdated || 0).getTime();
  const localTime = new Date(localState.lastUpdated || 0).getTime();

  if (supabaseTime >= localTime) {
    // Supabase is newer or equal — use it
    setOnboardingState(supabaseState);
    setJourneySession(supabaseState);
  } else {
    // localStorage is newer (rare — maybe onFinish failed)
    // Keep local state, attempt to push to Supabase
    setOnboardingState(localState);
    await pushStateToSupabase(localState);
  }
}
```

### 6.3 Edge Case: User Refreshes During Streaming

If the user refreshes while the stream is active:
- `onFinish` may NOT fire (stream was aborted)
- localStorage may have partial data from the last completed tool result
- Supabase has the state from the PREVIOUS completed stream

**Resolution**: On next page load, localStorage has the more recent data. The agent can resume from where it left off because the message history (stored separately) shows which questions were already answered.

### 6.4 Edge Case: localStorage Cleared

If localStorage is cleared (user clears browser data, incognito, etc.):
- Supabase still has the full state
- On page load, fetch from Supabase endpoint, populate localStorage
- Agent continues from where it left off

### 6.5 Practical Simplification

For Sprint 2, a simpler approach is acceptable:

1. **On mount**: Read localStorage. If non-null, use it. If null, fetch from Supabase.
2. **On askUser response**: Write to localStorage immediately.
3. **In onFinish**: Write to Supabase (all fields from this generation turn).
4. **No timestamp comparison** — just last-write-wins with Supabase as the authoritative store.

This is simple, handles 99% of cases, and avoids over-engineering. The conversation history in `messages` JSONB is the real resumption mechanism anyway — OnboardingState is just a structured extraction for the progress bar and downstream pipeline.

---

## 7. OnboardingState Interface Design

### 7.1 Proposed Shape

Based on PRD Section 2.3 (8 required + 14 optional fields):

```typescript
export interface OnboardingState {
  // ── Required fields (8) ───────────────────────────────
  businessModel?: string;           // B2B SaaS, B2C, Marketplace, etc.
  industry?: string;                // Dynamic based on businessModel
  icpDescription?: string;          // ICP text or structured description
  productDescription?: string;      // Open text about the product
  competitors?: string[];           // List of competitor names
  offerPricing?: string;            // Monthly, one-time, usage-based, etc.
  marketingChannels?: string[];     // Google Ads, Meta, LinkedIn, etc.
  goals?: string;                   // More leads, lower CAC, scale, launching

  // ── Optional fields (14) ──────────────────────────────
  companyName?: string;
  companyUrl?: string;
  monthlyBudget?: string;
  teamSize?: string;
  currentCac?: string;
  conversionRate?: string;
  averageDealSize?: string;
  salesCycleLength?: string;
  topPerformingChannel?: string;
  mainPainPoint?: string;
  uniqueSellingProp?: string;
  targetGeography?: string;
  previousAdSpend?: string;
  timelineUrgency?: string;

  // ── Meta ───────────────────────────────────────────────
  phase: 'onboarding' | 'confirming' | 'complete';
  requiredFieldsCompleted: number;  // 0-8
  completionPercent: number;        // 0-100 (requiredFieldsCompleted / 8 * 100)
  lastUpdated: string;              // ISO timestamp
}
```

### 7.2 Completion Calculation

```typescript
const REQUIRED_FIELDS: (keyof OnboardingState)[] = [
  'businessModel', 'industry', 'icpDescription', 'productDescription',
  'competitors', 'offerPricing', 'marketingChannels', 'goals',
];

export function calculateCompletion(state: OnboardingState): {
  requiredFieldsCompleted: number;
  completionPercent: number;
} {
  const completed = REQUIRED_FIELDS.filter(f => {
    const val = state[f];
    if (Array.isArray(val)) return val.length > 0;
    return val !== undefined && val !== null && val !== '';
  }).length;

  return {
    requiredFieldsCompleted: completed,
    completionPercent: Math.round((completed / REQUIRED_FIELDS.length) * 100),
  };
}
```

---

## 8. Implementation Recommendations

### 8.1 File Structure

```
src/lib/journey/
  session-state.ts       # OnboardingState type, calculateCompletion, persistence functions
```

```
src/lib/storage/
  local-storage.ts       # Add JOURNEY_SESSION key + typed getters/setters
```

### 8.2 Key Functions to Create

**`src/lib/journey/session-state.ts`**:
```typescript
// Types
export interface OnboardingState { ... }

// Completion
export function calculateCompletion(state: Partial<OnboardingState>): { ... }

// Supabase persistence (server-side)
export async function persistOnboardingState(userId: string, fields: Partial<OnboardingState>): Promise<void>
export async function fetchOnboardingState(userId: string): Promise<OnboardingState | null>

// localStorage persistence (client-side, call existing patterns)
// -> Add to local-storage.ts: getJourneySession(), setJourneySession()
```

### 8.3 Integration Points

1. **`/api/journey/stream/route.ts`**: Add `onFinish` callback that extracts askUser results from `steps` and calls `persistOnboardingState()`

2. **`/journey/page.tsx`**: Add `useEffect` hydration hook. On mount, read localStorage then optionally fetch Supabase.

3. **`local-storage.ts`**: Add `JOURNEY_SESSION` key and `getJourneySession()`/`setJourneySession()` functions.

4. **Progress bar** (in `journey-header.tsx`): Read `completionPercent` from React state (populated from localStorage/Supabase on mount, updated on each askUser response).

### 8.4 Unique Constraint Migration

Add a migration to support upsert on `user_id`:

```sql
-- Required for .upsert({ ... }, { onConflict: 'user_id' })
ALTER TABLE journey_sessions
  ADD CONSTRAINT journey_sessions_user_id_unique UNIQUE (user_id);
```

This ensures each user has exactly one journey session row, simplifying the persistence logic.

---

## 9. Source References

### Supabase JSONB
- [Supabase: Update data (JS)](https://supabase.com/docs/reference/javascript/update)
- [Supabase: Managing JSON/JSONB](https://supabase.com/docs/guides/database/json)
- [Discussion: Update JSON without replacing](https://github.com/orgs/supabase/discussions/14174)
- [Discussion: How to update JSON field](https://github.com/orgs/supabase/discussions/447)

### Vercel AI SDK
- [AI SDK Core: streamText reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text)
- [AI SDK: Tool Calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
- [AI SDK: Chatbot Message Persistence](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence)
- [Discussion: Accessing steps/toolCalls/toolResults](https://github.com/vercel/ai/discussions/3059)
- [Discussion: Guidance on persisting messages](https://github.com/vercel/ai/discussions/4845)
- [Discussion: onFinish callback (Issue #2993)](https://github.com/vercel/ai/issues/2993)

### Next.js Hydration
- [Next.js: Hydration error docs](https://nextjs.org/docs/messages/react-hydration-error)
- [Discussion: Hydration with localStorage/Redux/Zustand](https://github.com/vercel/next.js/discussions/54350)
- [Fix hydration mismatch errors in Next.js (2026)](https://oneuptime.com/blog/post/2026-01-24-fix-hydration-mismatch-errors-nextjs/view)

### Sync Patterns
- [RxDB: Supabase Replication Plugin](https://rxdb.info/replication-supabase.html)
- [RxDB: Downsides of Offline-First](https://rxdb.info/downsides-of-offline-first.html)
