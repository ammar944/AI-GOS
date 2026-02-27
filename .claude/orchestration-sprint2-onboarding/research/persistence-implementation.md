# Persistence Implementation Guide

**Created**: 2026-02-27
**Scope**: Exact implementation code for session state, localStorage, Supabase persistence, and frontend hydration
**Status**: Complete
**Verified against**: AI SDK v6.0.73, existing codebase patterns, DISCOVERY.md decisions

---

## 1. OnboardingState Interface

File: `src/lib/journey/session-state.ts`

### 1.1 V1-to-V2 Field Mapping

The V1 onboarding wizard (`src/lib/onboarding/types.ts`) has 9 steps with ~40+ fields across nested interfaces (`BusinessBasicsData`, `ICPData`, `ProductOfferData`, etc.). The V2 conversational onboarding flattens these into 8 required + 14 optional top-level fields. Mapping:

| V2 Field (flat) | V1 Source (nested) | Type |
|---|---|---|
| **Required (8)** | | |
| `businessModel` | _New_ (V1 had no explicit business model field) | `string` |
| `industry` | `icp.industryVertical` | `string` |
| `icpDescription` | `icp.primaryIcpDescription` | `string` |
| `productDescription` | `productOffer.productDescription` | `string` |
| `competitors` | `marketCompetition.topCompetitors` (was string, now array) | `string[]` |
| `offerPricing` | `productOffer.pricingModel` (was enum array, now descriptive string) | `string` |
| `marketingChannels` | `icp.bestClientSources` (was enum array, now string array) | `string[]` |
| `goals` | _New_ (V1 had `budgetTargets.targetCpl` etc., but no high-level goal) | `string` |
| **Optional (14)** | | |
| `companyName` | `businessBasics.businessName` | `string` |
| `companyUrl` | `businessBasics.websiteUrl` | `string` |
| `monthlyBudget` | `budgetTargets.monthlyAdBudget` (was number, now string) | `string` |
| `teamSize` | _New_ (V1 had `icp.companySize` for ICP, not own team) | `string` |
| `currentCac` | `budgetTargets.targetCac` (was number, now string) | `string` |
| `conversionRate` | _New_ | `string` |
| `averageDealSize` | _New_ (V1 had `productOffer.offerPrice` per tier) | `string` |
| `salesCycleLength` | `customerJourney.salesCycleLength` (was enum, now string) | `string` |
| `topPerformingChannel` | _New_ (V1 had multi-select `bestClientSources`) | `string` |
| `mainPainPoint` | _New_ (extracted from ICP/journey context) | `string` |
| `uniqueSellingProp` | `productOffer.valueProp` | `string` |
| `targetGeography` | `icp.geography` | `string` |
| `previousAdSpend` | _New_ | `string` |
| `timelineUrgency` | `budgetTargets.campaignDuration` (was enum, now string) | `string` |

### 1.2 Full Interface

```typescript
// src/lib/journey/session-state.ts

/**
 * Flat onboarding state collected via conversational askUser tool.
 * Stored in localStorage (immediate) and Supabase journey_sessions.metadata (durable).
 * All data fields are optional because they're populated incrementally.
 */
export interface OnboardingState {
  // -- Required fields (8) -- progress bar tracks these ---------------------
  businessModel?: string;        // B2B SaaS, B2C, Marketplace, Agency, etc.
  industry?: string;             // Industry/vertical
  icpDescription?: string;       // Ideal customer profile description
  productDescription?: string;   // What the product/service does
  competitors?: string[];        // List of competitor names
  offerPricing?: string;         // Pricing model description
  marketingChannels?: string[];  // Current/desired marketing channels
  goals?: string;                // Primary marketing/growth goal

  // -- Optional fields (14) ------------------------------------------------
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

  // -- Meta -----------------------------------------------------------------
  phase: 'onboarding' | 'confirming' | 'complete';
  requiredFieldsCompleted: number;  // 0-8
  completionPercent: number;        // 0-100
  lastUpdated: string;              // ISO 8601 timestamp
}

/**
 * Default empty state for initialization.
 */
export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  phase: 'onboarding',
  requiredFieldsCompleted: 0,
  completionPercent: 0,
  lastUpdated: new Date().toISOString(),
};
```

---

## 2. calculateCompletion()

```typescript
// src/lib/journey/session-state.ts (continued)

/**
 * The 8 required fields that drive the progress bar.
 * Must match the askUser fieldName values used in the agent system prompt.
 */
const REQUIRED_FIELDS: (keyof OnboardingState)[] = [
  'businessModel',
  'industry',
  'icpDescription',
  'productDescription',
  'competitors',
  'offerPricing',
  'marketingChannels',
  'goals',
];

/**
 * Calculate completion percentage from populated required fields.
 * Returns both the count and percentage for the progress bar.
 */
export function calculateCompletion(state: Partial<OnboardingState>): {
  requiredFieldsCompleted: number;
  completionPercent: number;
} {
  const completed = REQUIRED_FIELDS.filter((field) => {
    const val = state[field];
    if (val === undefined || val === null) return false;
    if (typeof val === 'string') return val.trim() !== '';
    if (Array.isArray(val)) return val.length > 0;
    return true;
  }).length;

  return {
    requiredFieldsCompleted: completed,
    completionPercent: Math.round((completed / REQUIRED_FIELDS.length) * 100),
  };
}
```

---

## 3. localStorage Helpers

These follow the exact patterns in `/Users/ammar/Dev-Projects/AI-GOS-main/src/lib/storage/local-storage.ts`. The existing file uses `STORAGE_KEYS` constants, typed `getItem<T>` / `setItem<T>` / `removeItem` generics, and an `isBrowser` guard.

### 3.1 STORAGE_KEYS Addition

Add to `src/lib/storage/local-storage.ts`:

```typescript
// In STORAGE_KEYS object (line ~10-16)
export const STORAGE_KEYS = {
  ONBOARDING_DATA: "aigog_onboarding_data",
  STRATEGIC_BLUEPRINT: "aigog_strategic_blueprint",
  GENERATION_STATE: "aigog_generation_state",
  MEDIA_PLAN: "aigog_media_plan",
  AD_COPY: "aigog_ad_copy",
  JOURNEY_SESSION: "aigog_journey_session",  // <-- ADD THIS
} as const;
```

### 3.2 Import and Helper Functions

Add at the bottom of `src/lib/storage/local-storage.ts`, after the existing utility functions:

```typescript
import type { OnboardingState } from '@/lib/journey/session-state';

// =============================================================================
// Journey Session (V2 Conversational Onboarding)
// =============================================================================

/**
 * Get the current journey session state from localStorage.
 * Returns null if not found or on server side.
 */
export function getJourneySession(): OnboardingState | null {
  return getItem<OnboardingState>(STORAGE_KEYS.JOURNEY_SESSION);
}

/**
 * Save the full journey session state to localStorage.
 */
export function setJourneySession(state: OnboardingState): boolean {
  return setItem(STORAGE_KEYS.JOURNEY_SESSION, state);
}

/**
 * Update a single field in the journey session state.
 * Reads current state, merges the field, recalculates completion, and writes back.
 * Returns the updated state, or null if the write failed.
 */
export function updateJourneyField(
  fieldName: string,
  value: unknown
): OnboardingState | null {
  // Import calculateCompletion inline to avoid circular dependency
  // (session-state.ts does not import from local-storage.ts)
  const { calculateCompletion } = require('@/lib/journey/session-state');

  const current = getJourneySession() || {
    phase: 'onboarding' as const,
    requiredFieldsCompleted: 0,
    completionPercent: 0,
    lastUpdated: new Date().toISOString(),
  };

  const updated: OnboardingState = {
    ...current,
    [fieldName]: value,
    lastUpdated: new Date().toISOString(),
  };

  // Recalculate completion
  const { requiredFieldsCompleted, completionPercent } = calculateCompletion(updated);
  updated.requiredFieldsCompleted = requiredFieldsCompleted;
  updated.completionPercent = completionPercent;

  const success = setJourneySession(updated);
  return success ? updated : null;
}

/**
 * Clear the journey session from localStorage.
 */
export function clearJourneySession(): boolean {
  return removeItem(STORAGE_KEYS.JOURNEY_SESSION);
}
```

### 3.3 Avoiding Circular Dependency -- Alternative Pattern

The `require()` call above is a pragmatic solution but not ideal for ESM/Next.js. A cleaner approach is to keep `calculateCompletion` in `session-state.ts` and NOT import from `local-storage.ts` into `session-state.ts`. Since the dependency is one-way (`local-storage.ts` -> `session-state.ts`), there is no circular dependency. Use a normal import:

```typescript
// At the top of local-storage.ts
import { calculateCompletion } from '@/lib/journey/session-state';
import type { OnboardingState } from '@/lib/journey/session-state';
```

Then `updateJourneyField` becomes:

```typescript
export function updateJourneyField(
  fieldName: string,
  value: unknown
): OnboardingState | null {
  const current = getJourneySession() || {
    phase: 'onboarding' as const,
    requiredFieldsCompleted: 0,
    completionPercent: 0,
    lastUpdated: new Date().toISOString(),
  };

  const updated: OnboardingState = {
    ...current,
    [fieldName]: value,
    lastUpdated: new Date().toISOString(),
  };

  const { requiredFieldsCompleted, completionPercent } = calculateCompletion(updated);
  updated.requiredFieldsCompleted = requiredFieldsCompleted;
  updated.completionPercent = completionPercent;

  const success = setJourneySession(updated);
  return success ? updated : null;
}
```

**Recommended**: Use the normal import approach. The dependency graph is `local-storage.ts` -> `session-state.ts`, no cycle.

---

## 4. Supabase Persistence -- `onFinish` Callback

### 4.1 Auth Pattern

The existing journey route at `src/app/api/journey/stream/route.ts` already extracts `userId` from Clerk at the top of the POST handler:

```typescript
import { auth } from '@clerk/nextjs/server';

// Inside POST handler:
const { userId } = await auth();
if (!userId) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

The `userId` (Clerk user ID string) is available in the closure for the `onFinish` callback. No additional auth calls needed inside `onFinish`.

### 4.2 Supabase Client Pattern

From `src/lib/supabase/server.ts`, the `createAdminClient()` function creates a Supabase client using `SUPABASE_SERVICE_ROLE_KEY` that bypasses RLS. This is the correct pattern for journey_sessions (per DISCOVERY.md: "Service role + Clerk user ID").

```typescript
import { createAdminClient } from '@/lib/supabase/server';
```

**Important**: `createAdminClient()` is synchronous (returns the client directly, not a Promise). This differs from `createClient()` which is async (uses `auth().getToken()`).

### 4.3 Field Extraction from Tool Results

The `onFinish` callback receives a `steps` array. Each step has `toolCalls` and `toolResults`. For the `askUser` tool:

- `toolCalls[n].args` contains the tool input: `{ question, fieldName, options, multiSelect }`
- `toolResults[n].result` contains the user's response (what was passed to `addToolOutput`)

Per DISCOVERY.md D8, `addToolOutput` sends structured JSON:
- Single-select: `{ fieldName, selectedLabel, selectedIndex }`
- Multi-select: `{ fieldName, selectedLabels, selectedIndices }`
- Other: `{ fieldName, otherText }`

The `fieldName` is present in BOTH the tool call args AND the tool result. Use `result.args.fieldName` as the canonical field name (it comes from the model's tool call, which was prompted with specific field names).

### 4.4 Complete `onFinish` Implementation

Add to `src/app/api/journey/stream/route.ts`:

```typescript
import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import { auth } from '@clerk/nextjs/server';
import { anthropic, MODELS } from '@/lib/ai/providers';
import { LEAD_AGENT_SYSTEM_PROMPT } from '@/lib/ai/prompts/lead-agent-system';
import { createAdminClient } from '@/lib/supabase/server';
import { calculateCompletion } from '@/lib/journey/session-state';
import type { OnboardingState } from '@/lib/journey/session-state';
// ... askUser tool import (created in separate task)

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) { /* ... existing 401 response ... */ }

  const body = await request.json();
  // ... existing sanitization ...

  const result = streamText({
    model: anthropic(MODELS.CLAUDE_OPUS),
    system: LEAD_AGENT_SYSTEM_PROMPT,
    messages: await convertToModelMessages(sanitizedMessages),
    tools: { askUser },  // Added in Sprint 2
    stopWhen: stepCountIs(15),  // Added in Sprint 2
    temperature: 0.3,
    providerOptions: {
      anthropic: { thinking: { type: 'adaptive' } },
    },

    // ── Persistence: extract askUser results and write to Supabase ────────
    onFinish: async ({ steps }) => {
      try {
        // 1. Collect all askUser tool results across ALL steps
        const fieldsCollected: Record<string, unknown> = {};

        for (const step of steps) {
          if (!step.toolResults) continue;
          for (const toolResult of step.toolResults) {
            if (toolResult.toolName !== 'askUser') continue;

            // fieldName comes from the tool call args (model-specified)
            const fieldName = toolResult.args?.fieldName as string | undefined;
            if (!fieldName) continue;

            // Parse the result (output from addToolOutput)
            const result = toolResult.result as Record<string, unknown> | string;

            if (typeof result === 'string') {
              // Simple string result
              fieldsCollected[fieldName] = result;
            } else if (result && typeof result === 'object') {
              // Structured result from addToolOutput
              if ('selectedLabels' in result) {
                // Multi-select: store as array
                fieldsCollected[fieldName] = result.selectedLabels;
              } else if ('selectedLabel' in result) {
                // Single-select: store as string
                fieldsCollected[fieldName] = result.selectedLabel;
              } else if ('otherText' in result) {
                // "Other" free text
                fieldsCollected[fieldName] = result.otherText;
              } else {
                // Fallback: store the whole result
                fieldsCollected[fieldName] = result;
              }
            }
          }
        }

        // 2. Skip if no fields were collected in this generation turn
        if (Object.keys(fieldsCollected).length === 0) return;

        // 3. Fetch-then-merge pattern (matches src/lib/actions/onboarding.ts)
        const supabase = createAdminClient();

        const { data: existing } = await supabase
          .from('journey_sessions')
          .select('metadata')
          .eq('user_id', userId)
          .maybeSingle();

        // Merge collected fields into existing metadata
        const currentMetadata = (existing?.metadata ?? {}) as Partial<OnboardingState>;
        const merged: Partial<OnboardingState> = {
          ...currentMetadata,
          ...fieldsCollected,
          lastUpdated: new Date().toISOString(),
        };

        // Recalculate completion
        const { requiredFieldsCompleted, completionPercent } = calculateCompletion(merged);
        merged.requiredFieldsCompleted = requiredFieldsCompleted;
        merged.completionPercent = completionPercent;
        merged.phase = completionPercent === 100 ? 'confirming' : 'onboarding';

        // 4. Upsert (requires UNIQUE constraint on user_id -- see Section 5)
        await supabase
          .from('journey_sessions')
          .upsert(
            {
              user_id: userId,
              phase: merged.phase ?? 'onboarding',
              metadata: merged as Record<string, unknown>,
            },
            { onConflict: 'user_id' }
          );

      } catch (err) {
        // Per DISCOVERY.md D22: Silent fail, console.error only.
        // localStorage is the fallback. Do NOT block conversation.
        console.error('[Journey] Failed to persist onboarding state:', err);
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
```

### 4.5 Key Design Decisions Reflected

1. **`createAdminClient()`** -- synchronous, bypasses RLS, matches all existing server-side Supabase usage in `src/lib/actions/`
2. **`maybeSingle()`** -- returns `null` (not error) when no row exists, avoiding PGRST116 errors
3. **`.upsert()` with `onConflict: 'user_id'`** -- creates on first call, updates on subsequent calls. Requires the UNIQUE constraint (Section 5).
4. **Silent fail** -- per DISCOVERY.md D22, persistence failures are logged but never surface to the user
5. **`calculateCompletion()` on server** -- ensures the stored `completionPercent` is always consistent with the actual field data

---

## 5. Migration SQL -- UNIQUE Constraint

### 5.1 Current Schema Analysis

The existing migration at `supabase/migrations/20260227_create_journey_sessions_table.sql` creates:
- `user_id text not null` -- but NO unique constraint
- `create index if not exists idx_journey_sessions_user_id on journey_sessions(user_id)` -- a regular (non-unique) B-tree index

For `.upsert({ ... }, { onConflict: 'user_id' })` to work, PostgreSQL requires either a UNIQUE constraint or a UNIQUE index on `user_id`.

### 5.2 New Migration

Create file: `supabase/migrations/20260228_add_journey_sessions_unique_user_id.sql`

```sql
-- Add UNIQUE constraint on journey_sessions.user_id
-- Required for Supabase .upsert({ onConflict: 'user_id' }) pattern
-- Per DISCOVERY.md D12: One session per user

-- Drop the existing non-unique index first (the unique constraint creates its own index)
DROP INDEX IF EXISTS idx_journey_sessions_user_id;

-- Add unique constraint (implicitly creates a unique index)
ALTER TABLE journey_sessions
  ADD CONSTRAINT journey_sessions_user_id_unique UNIQUE (user_id);

-- Note: If there are duplicate user_id rows in production, this will fail.
-- Clean up duplicates first:
-- DELETE FROM journey_sessions a USING journey_sessions b
-- WHERE a.id > b.id AND a.user_id = b.user_id;
```

### 5.3 TypeScript Types Update

No changes needed to `src/lib/supabase/types.ts`. The `journey_sessions` table types already correctly define `user_id: string` as required in Insert/Update. The UNIQUE constraint is a database-level concern that doesn't affect the TypeScript types.

### 5.4 Migration Pattern Reference

The project's existing migration pattern (from `20260125_create_blueprints_table.sql`):
- Plain SQL files in `supabase/migrations/`
- Naming convention: `YYYYMMDD_description.sql`
- Comments explain purpose
- Uses `IF NOT EXISTS` / `IF EXISTS` guards where possible

---

## 6. Frontend Hydration

### 6.1 Page-Level Hydration in `src/app/journey/page.tsx`

The existing page is a `'use client'` component using `useChat`. Add state + hydration:

```typescript
'use client';

import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useChat } from '@ai-sdk/react';
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from 'ai';
import { getJourneySession, updateJourneyField } from '@/lib/storage/local-storage';
import { calculateCompletion } from '@/lib/journey/session-state';
import type { OnboardingState } from '@/lib/journey/session-state';
// ... other imports unchanged

export default function JourneyPage() {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Onboarding state (for progress bar) ─────────────────────────────────
  const [onboardingState, setOnboardingState] = useState<Partial<OnboardingState>>({});
  const [completionPercent, setCompletionPercent] = useState(0);

  // Hydrate from localStorage on mount (Pattern 1: useEffect + useState)
  useEffect(() => {
    const stored = getJourneySession();
    if (stored) {
      setOnboardingState(stored);
      setCompletionPercent(stored.completionPercent ?? 0);
    }
  }, []);

  // ── Transport ───────────────────────────────────────────────────────────
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/journey/stream',
      }),
    []
  );

  // ── sendAutomaticallyWhen (per DISCOVERY.md D7) ─────────────────────────
  // Combine both predicates: askUser (tool calls) + future approval tools
  const sendAutomatically = useCallback(
    ({ messages }: { messages: Array<{ role: string; parts: unknown[] }> }) =>
      lastAssistantMessageIsCompleteWithToolCalls({ messages }) ||
      lastAssistantMessageIsCompleteWithApprovalResponses({ messages }),
    []
  );

  // ── Chat hook ───────────────────────────────────────────────────────────
  const {
    messages,
    sendMessage,
    addToolOutput,           // <-- New in Sprint 2
    addToolApprovalResponse, // Keep for future
    status,
    error,
    setMessages,
  } = useChat({
    transport,
    sendAutomaticallyWhen: sendAutomatically,  // <-- Changed from Sprint 1
    onError: (err) => {
      console.error('Journey chat error:', err);
      if (err?.message?.includes('Tool result is missing')) {
        setMessages((prev) => {
          const cleaned = [...prev];
          for (let i = cleaned.length - 1; i >= 0; i--) {
            if (cleaned[i].role === 'assistant') {
              cleaned.splice(i, 1);
              break;
            }
          }
          return cleaned;
        });
      }
    },
  });

  // ── Handle askUser chip selection ───────────────────────────────────────
  const handleAskUserResponse = useCallback(
    (toolCallId: string, fieldName: string, output: Record<string, unknown>) => {
      // 1. Write to localStorage immediately (belt)
      const value = output.selectedLabels ?? output.selectedLabel ?? output.otherText;
      const updated = updateJourneyField(fieldName, value);
      if (updated) {
        setOnboardingState(updated);
        setCompletionPercent(updated.completionPercent);
      }

      // 2. Send tool output to backend (triggers next step)
      addToolOutput({
        toolCallId,
        output: JSON.stringify(output),
      });
    },
    [addToolOutput]
  );

  // ... rest of component unchanged, but pass completionPercent to JourneyHeader
  // and pass handleAskUserResponse to ChatMessage for askUser card rendering
```

### 6.2 Hydration Rules (Per DISCOVERY.md D22)

1. **No hydration mismatch**: `useState({})` on server, `useEffect` reads localStorage on client only
2. **No Supabase fetch on mount** (Sprint 2 defers resume logic per D15): localStorage-only hydration
3. **Progress bar reads React state**, NOT direct localStorage during render
4. **Silent failures**: If `getJourneySession()` returns null (first visit, cleared data), start with empty state

### 6.3 Passing State to Child Components

```typescript
// In the JSX return:
<JourneyHeader completionPercent={completionPercent} />

// ChatMessage needs the handler for askUser cards:
<ChatMessage
  key={message.id}
  messageId={message.id}
  role={message.role as 'user' | 'assistant'}
  parts={message.parts}
  isStreaming={isThisMessageStreaming}
  onToolApproval={(approvalId, approved) =>
    addToolApprovalResponse({ id: approvalId, approved })
  }
  onAskUserResponse={handleAskUserResponse}  // <-- New prop
/>
```

---

## 7. Field Extraction from Tool Results -- Detailed

### 7.1 What `addToolOutput` Sends

Per DISCOVERY.md D8, when the user taps a chip, the frontend calls:

```typescript
// Single-select
addToolOutput({
  toolCallId: part.toolCallId,
  output: JSON.stringify({
    fieldName: 'businessModel',
    selectedLabel: 'B2B SaaS',
    selectedIndex: 2,
  }),
});

// Multi-select
addToolOutput({
  toolCallId: part.toolCallId,
  output: JSON.stringify({
    fieldName: 'marketingChannels',
    selectedLabels: ['Google Ads', 'LinkedIn Ads', 'Meta Ads'],
    selectedIndices: [0, 3, 4],
  }),
});

// "Other" free text
addToolOutput({
  toolCallId: part.toolCallId,
  output: JSON.stringify({
    fieldName: 'businessModel',
    otherText: 'Hybrid marketplace + SaaS',
  }),
});
```

### 7.2 What the Server Receives in `onFinish`

The `output` string is received as the tool result. Inside `onFinish({ steps })`:

```typescript
// step.toolResults[n] structure:
{
  toolCallId: 'call_abc123',
  toolName: 'askUser',
  args: {
    question: 'What type of business do you run?',
    fieldName: 'businessModel',
    options: [
      { label: 'B2B SaaS', description: 'Software sold to businesses' },
      { label: 'B2C', description: 'Direct to consumer' },
      // ...
    ],
    multiSelect: false,
  },
  result: '{"fieldName":"businessModel","selectedLabel":"B2B SaaS","selectedIndex":2}'
  // Note: result is a STRING (the JSON.stringify'd output from addToolOutput)
}
```

### 7.3 Parsing Logic

The `result` field is a JSON string (because `addToolOutput` receives a string). Parse it:

```typescript
// Inside the onFinish loop:
for (const toolResult of step.toolResults) {
  if (toolResult.toolName !== 'askUser') continue;

  const fieldName = toolResult.args?.fieldName as string;
  if (!fieldName) continue;

  // toolResult.result is the stringified JSON from addToolOutput
  let parsed: Record<string, unknown>;
  try {
    parsed = typeof toolResult.result === 'string'
      ? JSON.parse(toolResult.result)
      : toolResult.result as Record<string, unknown>;
  } catch {
    console.error('[Journey] Failed to parse tool result:', toolResult.result);
    continue;
  }

  // Extract the actual value based on result shape
  if ('selectedLabels' in parsed && Array.isArray(parsed.selectedLabels)) {
    fieldsCollected[fieldName] = parsed.selectedLabels;
  } else if ('selectedLabel' in parsed && typeof parsed.selectedLabel === 'string') {
    fieldsCollected[fieldName] = parsed.selectedLabel;
  } else if ('otherText' in parsed && typeof parsed.otherText === 'string') {
    fieldsCollected[fieldName] = parsed.otherText;
  } else {
    // Fallback: use the raw parsed object
    fieldsCollected[fieldName] = parsed;
  }
}
```

### 7.4 fieldName-to-OnboardingState Key Mapping

The `fieldName` values in the askUser tool args are the SAME as the `OnboardingState` interface keys. No mapping function is needed -- the field names are used directly as object keys:

```typescript
fieldsCollected[fieldName] = value;
// e.g., fieldsCollected['businessModel'] = 'B2B SaaS'
// This directly maps to OnboardingState.businessModel
```

This works because:
1. The agent system prompt instructs the model to use specific `fieldName` values that match the interface
2. The askUser tool schema has `fieldName: z.string()` which the model fills based on the prompt
3. The interface keys ARE the field names -- no translation layer needed

### 7.5 Type Safety Note

Since `fieldsCollected` is `Record<string, unknown>` and gets spread into a `Partial<OnboardingState>`, TypeScript allows any string key. At runtime, if the model invents an unexpected `fieldName`, it just becomes an extra key in the JSONB -- harmless but ignored by `calculateCompletion()` which only checks known keys.

For stricter validation, add a guard:

```typescript
const VALID_FIELDS = new Set<string>([
  'businessModel', 'industry', 'icpDescription', 'productDescription',
  'competitors', 'offerPricing', 'marketingChannels', 'goals',
  'companyName', 'companyUrl', 'monthlyBudget', 'teamSize',
  'currentCac', 'conversionRate', 'averageDealSize', 'salesCycleLength',
  'topPerformingChannel', 'mainPainPoint', 'uniqueSellingProp',
  'targetGeography', 'previousAdSpend', 'timelineUrgency',
]);

// In the extraction loop:
if (!VALID_FIELDS.has(fieldName)) {
  console.warn(`[Journey] Unknown fieldName from askUser: ${fieldName}`);
  continue;
}
```

---

## 8. Complete File Listing

### 8.1 Files to CREATE

| File | Contents |
|------|----------|
| `src/lib/journey/session-state.ts` | `OnboardingState` interface, `DEFAULT_ONBOARDING_STATE`, `calculateCompletion()`, `REQUIRED_FIELDS` |
| `supabase/migrations/20260228_add_journey_sessions_unique_user_id.sql` | UNIQUE constraint on `user_id` |

### 8.2 Files to MODIFY

| File | Changes |
|------|---------|
| `src/lib/storage/local-storage.ts` | Add `JOURNEY_SESSION` to `STORAGE_KEYS`, add `getJourneySession()`, `setJourneySession()`, `updateJourneyField()`, `clearJourneySession()`, add import of `OnboardingState` and `calculateCompletion` |
| `src/app/api/journey/stream/route.ts` | Add `onFinish` callback, import `createAdminClient`, import `calculateCompletion`, add `tools: { askUser }`, add `stopWhen: stepCountIs(15)` |
| `src/app/journey/page.tsx` | Add onboarding state + hydration `useEffect`, add `handleAskUserResponse` callback, destructure `addToolOutput` from `useChat`, pass `completionPercent` to header, change `sendAutomaticallyWhen` |

### 8.3 Files NOT Modified

| File | Reason |
|------|--------|
| `src/lib/supabase/types.ts` | `journey_sessions` types already exist with correct `metadata: Json` column |
| `src/lib/supabase/server.ts` | `createAdminClient()` already exists and works correctly |

---

## 9. Testing Verification Checklist

1. **`npm run build`** -- confirms all imports resolve and types are correct
2. **Type check**: `OnboardingState` fields match `fieldName` values in the agent system prompt
3. **localStorage round-trip**: `setJourneySession(state)` then `getJourneySession()` returns identical data
4. **calculateCompletion**: Empty state returns 0%, all 8 required fields returns 100%
5. **calculateCompletion edge cases**: `competitors: []` returns incomplete, `competitors: ['Acme']` returns complete
6. **Supabase upsert**: First call creates row, second call updates metadata (verify via Supabase Studio)
7. **onFinish extraction**: Verify `toolResult.result` is parsed correctly (it's a JSON string, not an object)
8. **Hydration**: Page loads with `completionPercent: 0`, `useEffect` updates from localStorage without mismatch
9. **Silent fail**: Supabase connection failure in `onFinish` logs error but does not crash the stream

---

## 10. Data Flow Summary

```
User taps chip in ask-user-card.tsx
    |
    +-- handleAskUserResponse(toolCallId, fieldName, output)
    |     |
    |     +-- updateJourneyField(fieldName, value)  // localStorage WRITE (immediate)
    |     |     |
    |     |     +-- getJourneySession()             // READ current state
    |     |     +-- merge + calculateCompletion()   // recompute progress
    |     |     +-- setJourneySession(updated)      // WRITE merged state
    |     |
    |     +-- setOnboardingState(updated)           // React state update
    |     +-- setCompletionPercent(updated.completionPercent)  // Progress bar
    |     |
    |     +-- addToolOutput({ toolCallId, output }) // SDK sends to server
    |
    v
Server receives tool result in stream
    |
    v
Model processes result, asks next question (or finishes)
    |
    v
onFinish({ steps }) fires after stream completes
    |
    +-- Extract ALL askUser results from steps
    +-- Parse each result (JSON string -> fieldName + value)
    +-- createAdminClient()
    +-- Fetch existing metadata from journey_sessions
    +-- Merge new fields
    +-- calculateCompletion on merged state
    +-- Upsert to journey_sessions.metadata
    +-- console.error on failure (silent, per D22)
```
