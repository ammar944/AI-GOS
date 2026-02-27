# Task 1.3: localStorage Extension

## Objective

Add `JOURNEY_SESSION` key and typed get/set/clear helpers to the existing localStorage utility, enabling instant client-side persistence of onboarding state.

## Context

The onboarding uses a "belt + suspenders" persistence model (DISCOVERY.md D11): localStorage for instant hydration and Supabase for authoritative storage. This task extends the existing `src/lib/storage/local-storage.ts` with journey-specific helpers. The page (Task 4.2) will call these after each `addToolOutput()` and on mount for hydration.

## Dependencies

- Task 1.2 — imports `OnboardingState` type from `@/lib/journey/session-state`

## Blocked By

- Task 1.2

## Implementation Plan

### Step 1: Read current file

Read `src/lib/storage/local-storage.ts` to understand existing patterns. Follow the same generic `getItem`/`setItem`/`removeItem` pattern used for other storage keys.

### Step 2: Add JOURNEY_SESSION to STORAGE_KEYS

```typescript
export const STORAGE_KEYS = {
  ONBOARDING_DATA: "aigog_onboarding_data",
  STRATEGIC_BLUEPRINT: "aigog_strategic_blueprint",
  GENERATION_STATE: "aigog_generation_state",
  MEDIA_PLAN: "aigog_media_plan",
  AD_COPY: "aigog_ad_copy",
  JOURNEY_SESSION: "aigog_journey_session",  // NEW
} as const;
```

### Step 3: Add import and helper functions

Add import at top of file:
```typescript
import type { OnboardingState } from "@/lib/journey/session-state";
```

Add functions following existing pattern:
```typescript
// Journey Session (v2 onboarding)
export function getJourneySession(): OnboardingState | null {
  return getItem<OnboardingState>(STORAGE_KEYS.JOURNEY_SESSION);
}

export function setJourneySession(data: OnboardingState): boolean {
  return setItem(STORAGE_KEYS.JOURNEY_SESSION, data);
}

export function clearJourneySession(): boolean {
  return removeItem(STORAGE_KEYS.JOURNEY_SESSION);
}
```

### Step 4: Verify no existing functions are broken

Ensure no changes to existing function signatures or behavior. Only additions.

## Files to Create

- None

## Files to Modify

- `src/lib/storage/local-storage.ts` — add JOURNEY_SESSION key + 3 helper functions

## Contracts

### Provides (for downstream tasks)

- **Function**: `getJourneySession() → OnboardingState | null` — used by page (Task 4.2) for mount hydration
- **Function**: `setJourneySession(data) → boolean` — used by page (Task 4.2) after addToolOutput
- **Function**: `clearJourneySession() → boolean` — available for session reset
- **Constant**: `STORAGE_KEYS.JOURNEY_SESSION` = `"aigog_journey_session"`

### Consumes (from upstream tasks)

- Task 1.2: `OnboardingState` type from `@/lib/journey/session-state`

## Acceptance Criteria

- [ ] `STORAGE_KEYS.JOURNEY_SESSION` exists with value `"aigog_journey_session"`
- [ ] `getJourneySession()`, `setJourneySession()`, `clearJourneySession()` functions exported
- [ ] Functions follow existing pattern (use generic getItem/setItem/removeItem)
- [ ] No changes to existing functions
- [ ] `npm run build` passes

## Testing Protocol

### Build/Lint/Type Checks

- [ ] `npm run build` succeeds

## Skills to Read

- `.claude/orchestration-sprint2-onboarding/skills/onboarding-persistence/SKILL.md` — localStorage section

## Research Files to Read

- None (straightforward extension of existing file)

## Git

- Branch: `aigos-v2`
- Commit message prefix: `Task 1.3:`
