# Task 1.2: OnboardingState Interface + Persistence Helpers

## Objective

Create the session state interface and server-side persistence functions for the onboarding flow. This defines the data model for all collected fields and provides helpers to extract askUser results from incoming messages and persist them to Supabase.

## Context

The onboarding collects 8 required fields and up to 14 optional fields through conversation. State is persisted in two places: Supabase (authoritative, server-side) and localStorage (fast hydration, client-side — Task 1.3). This task creates the interface and Supabase persistence. The route (Task 2.1) calls `extractAskUserResults()` and `persistToSupabase()` on each request.

## Dependencies

- None

## Blocked By

- None

## Research Findings

- From `persistence-implementation.md`: OnboardingState interface with 8 required + 14 optional + 4 meta fields. Fetch-then-merge JSONB pattern. `createAdminClient()` from existing Supabase utils.
- From DISCOVERY.md D9 (REVISED): Interactive tool results are NOT in `onFinish.steps`. Extract from incoming `body.messages` — scan for `tool-askUser` parts with `state: 'output-available'`.
- From DISCOVERY.md D11 (REVISED): Supabase extraction runs at START of POST request (before `streamText()`), not in `onFinish`.
- From DISCOVERY.md D12: One session per user. UNIQUE on `user_id`. Upsert pattern.
- From DISCOVERY.md D13: Fetch-then-merge. Read current metadata, deep merge, write back.
- From DISCOVERY.md D22: Supabase write failure → silent fail with console.error. Do NOT block conversation.

## Implementation Plan

### Step 1: Check existing Supabase client pattern

Read `src/lib/supabase/` to find how `createAdminClient()` or similar is used. Follow existing patterns.

### Step 2: Create the file

Create `src/lib/journey/session-state.ts`:

```typescript
import type { UIMessage } from 'ai';

// ── OnboardingState Interface ──────────────────────────────────────────────

export interface OnboardingState {
  // Required fields (8)
  businessModel: string | null;
  industry: string | null;
  icpDescription: string | null;
  productDescription: string | null;
  competitors: string | null;
  offerPricing: string | null;
  marketingChannels: string[] | null;  // multi-select → array
  goals: string | null;

  // Optional fields (14)
  companyName: string | null;
  websiteUrl: string | null;
  teamSize: string | null;
  monthlyBudget: string | null;
  currentCac: string | null;
  targetCpa: string | null;
  topPerformingChannel: string | null;
  biggestMarketingChallenge: string | null;
  buyerPersonaTitle: string | null;
  salesCycleLength: string | null;
  avgDealSize: string | null;
  primaryKpi: string | null;
  geographicFocus: string | null;
  seasonalityPattern: string | null;

  // Meta
  phase: 'onboarding' | 'confirming' | 'complete';
  requiredFieldsCompleted: number;  // 0-8
  completionPercent: number;        // 0-100
  lastUpdated: string; // ISO 8601
}

const REQUIRED_FIELDS: (keyof OnboardingState)[] = [
  'businessModel', 'industry', 'icpDescription', 'productDescription',
  'competitors', 'offerPricing', 'marketingChannels', 'goals',
];
```

### Step 3: calculateCompletion function

Returns an object with both the count and percentage:

```typescript
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

### Step 4: extractAskUserResults function

This scans incoming UIMessage[] for askUser tool parts with completed results:

```typescript
export function extractAskUserResults(messages: UIMessage[]): Record<string, unknown> {
  const results: Record<string, unknown> = {};

  for (const msg of messages) {
    if (msg.role !== 'assistant') continue;
    for (const part of msg.parts) {
      if (
        typeof part === 'object' &&
        'type' in part &&
        (part as Record<string, unknown>).type === 'tool-askUser' &&
        (part as Record<string, unknown>).state === 'output-available'
      ) {
        const input = (part as Record<string, unknown>).input as Record<string, unknown> | undefined;
        const output = (part as Record<string, unknown>).output as Record<string, unknown> | undefined;
        if (input?.fieldName && output) {
          results[input.fieldName as string] = output;
        }
      }
    }
  }

  return results;
}
```

### Step 5: persistToSupabase function

```typescript
export async function persistToSupabase(
  userId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  try {
    // Import admin client (server-side only)
    const { createAdminClient } = await import('@/lib/supabase/server');
    const supabase = createAdminClient();

    // Fetch current metadata
    const { data: existing } = await supabase
      .from('journey_sessions')
      .select('metadata')
      .eq('user_id', userId)
      .single();

    const currentMetadata = (existing?.metadata as Record<string, unknown>) || {};

    // Deep merge
    const merged = { ...currentMetadata, ...fields, lastUpdated: new Date().toISOString() };

    // Upsert
    await supabase
      .from('journey_sessions')
      .upsert(
        { user_id: userId, metadata: merged, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
  } catch (error) {
    // Silent fail — localStorage is the fallback (DISCOVERY.md D22)
    console.error('[journey] Supabase persistence failed:', error);
  }
}
```

### Step 6: createEmptyState helper

```typescript
export function createEmptyState(): OnboardingState {
  return {
    businessModel: null, industry: null, icpDescription: null,
    productDescription: null, competitors: null, offerPricing: null,
    marketingChannels: null, goals: null,
    companyName: null, websiteUrl: null, teamSize: null,
    monthlyBudget: null, currentCac: null, targetCpa: null,
    topPerformingChannel: null, biggestMarketingChallenge: null,
    buyerPersonaTitle: null, salesCycleLength: null,
    avgDealSize: null, primaryKpi: null,
    geographicFocus: null, seasonalityPattern: null,
    phase: 'onboarding',
    requiredFieldsCompleted: 0,
    completionPercent: 0,
    lastUpdated: new Date().toISOString(),
  };
}
```

### Step 7: Verify Supabase admin client exists

Check if `src/lib/supabase/admin.ts` exists with `createAdminClient()`. If not, check what Supabase client pattern the project uses and adapt. The `journey_sessions` table should already exist from Sprint 1.

## Files to Create

- `src/lib/journey/session-state.ts` — OnboardingState interface + persistence helpers

## Files to Modify

- None

## Contracts

### Provides (for downstream tasks)

- **Type**: `OnboardingState` — used by localStorage helpers (Task 1.3), route (Task 2.1), page (Task 4.2)
- **Function**: `calculateCompletion(state) → { requiredFieldsCompleted: number; completionPercent: number }` — used by page (Task 4.2), localStorage helpers (Task 1.3)
- **Function**: `extractAskUserResults(messages) → Record<string, unknown>` — used by route (Task 2.1)
- **Function**: `persistToSupabase(userId, fields) → Promise<void>` — used by route (Task 2.1)
- **Function**: `createEmptyState() → OnboardingState` — used by page (Task 4.2)
- **Constant**: `REQUIRED_FIELDS` — list of 8 required field names

### Consumes (from upstream tasks)

- None

## Acceptance Criteria

- [ ] OnboardingState interface exported with 8 required + 14 optional + 4 meta fields (phase includes 'confirming')
- [ ] calculateCompletion returns `{ requiredFieldsCompleted, completionPercent }` object
- [ ] extractAskUserResults scans UIMessage[] for `tool-askUser` parts with `state: 'output-available'`
- [ ] persistToSupabase uses fetch-then-merge, handles errors silently (console.error only)
- [ ] createEmptyState returns a fully initialized state object
- [ ] `npm run build` passes

## Testing Protocol

### Build/Lint/Type Checks

- [ ] `npm run build` succeeds

## Skills to Read

- `.claude/orchestration-sprint2-onboarding/skills/onboarding-persistence/SKILL.md` — state interface, persistence patterns

## Research Files to Read

- `.claude/orchestration-sprint2-onboarding/research/persistence-implementation.md` — full implementation details
- `.claude/orchestration-sprint2-onboarding/research/ai-sdk-tool-implementation.md` — body.messages extraction pattern

## Git

- Branch: `aigos-v2`
- Commit message prefix: `Task 1.2:`
