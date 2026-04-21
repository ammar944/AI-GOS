---
name: onboarding-persistence
description: Session state persistence for conversational onboarding. Use when implementing localStorage + Supabase belt-and-suspenders persistence, OnboardingState management, or progress calculation.
---

## OnboardingState Interface

File: `src/lib/journey/session-state.ts`

```typescript
export interface OnboardingState {
  // Required fields (8) — progress bar tracks these
  businessModel?: string;
  industry?: string;
  icpDescription?: string;
  productDescription?: string;
  competitors?: string[];
  offerPricing?: string;
  marketingChannels?: string[];
  goals?: string;

  // Optional fields (14)
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

  // Meta fields
  phase: 'onboarding' | 'confirming' | 'complete';
  requiredFieldsCompleted: number;  // 0–8
  completionPercent: number;        // 0–100
  lastUpdated: string;              // ISO 8601
}

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  phase: 'onboarding',
  requiredFieldsCompleted: 0,
  completionPercent: 0,
  lastUpdated: new Date().toISOString(),
};
```

## calculateCompletion()

```typescript
const REQUIRED_FIELDS: (keyof OnboardingState)[] = [
  'businessModel', 'industry', 'icpDescription', 'productDescription',
  'competitors', 'offerPricing', 'marketingChannels', 'goals',
];

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

## localStorage Helpers

### 1. Add key to `src/lib/storage/local-storage.ts`

```typescript
export const STORAGE_KEYS = {
  ONBOARDING_DATA: "aigog_onboarding_data",
  STRATEGIC_BLUEPRINT: "aigog_strategic_blueprint",
  GENERATION_STATE: "aigog_generation_state",
  MEDIA_PLAN: "aigog_media_plan",
  AD_COPY: "aigog_ad_copy",
  JOURNEY_SESSION: "aigog_journey_session",  // ADD
} as const;
```

### 2. Add import and typed helpers (after existing functions)

Import at top of `local-storage.ts` — dependency is one-way, no circular risk:
```typescript
import { calculateCompletion } from '@/lib/journey/session-state';
import type { OnboardingState } from '@/lib/journey/session-state';
```

```typescript
export function getJourneySession(): OnboardingState | null {
  return getItem<OnboardingState>(STORAGE_KEYS.JOURNEY_SESSION);
}

export function setJourneySession(state: OnboardingState): boolean {
  return setItem(STORAGE_KEYS.JOURNEY_SESSION, state);
}

export function updateJourneyField(
  fieldName: string,
  value: unknown,
): OnboardingState | null {
  const current = getJourneySession() ?? {
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
  return setJourneySession(updated) ? updated : null;
}
```

## Supabase Persistence (D9 REVISED, D11 REVISED)

**Critical**: For interactive tools (no `execute`), `onFinish.steps[N].toolResults` is EMPTY on the request that streams the tool call. The user's selection arrives in `body.messages` on the NEXT HTTP request as a `tool-askUser` part with `state: 'output-available'`.

**Therefore**: Extract askUser results from incoming `body.messages` at the START of the POST handler (before `streamText()`), NOT from `onFinish`. Use `extractAskUserResults()` from `session-state.ts`, then call `persistToSupabase()`.

### Extraction at start of POST handler

```typescript
// In src/app/api/journey/stream/route.ts — at the top of POST handler
import { extractAskUserResults, persistToSupabase } from '@/lib/journey/session-state';

const body = await req.json();
const messages: UIMessage[] = body.messages;

// Extract completed askUser results from previous round trip
const askUserFields = extractAskUserResults(messages);
if (Object.keys(askUserFields).length > 0) {
  // Fire-and-forget — D22: never block the conversation
  persistToSupabase(userId, askUserFields).catch((err) => {
    console.error('[Journey] Supabase persistence failed:', err);
  });
}

// Then proceed with streamText()...
```

## UNIQUE Constraint Migration

File: `supabase/migrations/20260228_add_journey_sessions_unique_user_id.sql`

```sql
-- Required for .upsert({ onConflict: 'user_id' }) — D12: one session per user
DROP INDEX IF EXISTS idx_journey_sessions_user_id;
ALTER TABLE journey_sessions
  ADD CONSTRAINT journey_sessions_user_id_unique UNIQUE (user_id);
```

> If duplicate `user_id` rows exist in production, clean them first:
> `DELETE FROM journey_sessions a USING journey_sessions b WHERE a.id > b.id AND a.user_id = b.user_id;`

## Frontend Hydration Pattern

In `src/app/journey/page.tsx` — `useEffect` + `useState` avoids SSR hydration mismatch:

```typescript
const [onboardingState, setOnboardingState] = useState<Partial<OnboardingState>>({});
const [completionPercent, setCompletionPercent] = useState(0);

// Read localStorage only on client (never during SSR)
useEffect(() => {
  const stored = getJourneySession();
  if (stored) {
    setOnboardingState(stored);
    setCompletionPercent(stored.completionPercent ?? 0);
  }
}, []);

// After addToolOutput, update state immediately (belt)
const handleAskUserResponse = useCallback(
  (toolCallId: string, fieldName: string, output: Record<string, unknown>) => {
    const value = output.selectedLabels ?? output.selectedLabel ?? output.otherText;
    const updated = updateJourneyField(fieldName, value);
    if (updated) {
      setOnboardingState(updated);
      setCompletionPercent(updated.completionPercent);
    }
    addToolOutput({ tool: 'askUser', toolCallId, output: JSON.stringify(output) });
  },
  [addToolOutput],
);
```

Pass `completionPercent` to `<JourneyHeader completionPercent={completionPercent} />`.

## addToolOutput Output Shape (D8)

```typescript
// Single-select
{ fieldName: 'businessModel', selectedLabel: 'B2B SaaS', selectedIndex: 2 }

// Multi-select
{ fieldName: 'marketingChannels', selectedLabels: ['Google Ads', 'LinkedIn Ads'], selectedIndices: [0, 3] }

// "Other" free text
{ fieldName: 'businessModel', otherText: 'Hybrid marketplace + SaaS' }
```

Always `JSON.stringify()` before passing to `addToolOutput({ tool: 'askUser', toolCallId, output })`.
