# Task 1.4: Model Constant + Provider Update

## Objective

Add `claude-opus-4-6` to the MODELS constant and MODEL_COSTS in `providers.ts`. This makes the Opus model available as a named constant for the journey API route.

## Context

Phase 1 foundational task. The existing `providers.ts` has an `anthropic` provider instance and model constants for Sonnet and Haiku, but no Opus. The journey route needs `MODELS.CLAUDE_OPUS` to reference the correct model ID.

## Dependencies

- None

## Blocked By

- None

## Research Findings

- From `existing-codebase.md`: `MODELS` constant has `CLAUDE_SONNET` and `CLAUDE_HAIKU` but no Opus.
- From DISCOVERY.md D2: Model `claude-opus-4-6` (no date suffix). Adaptive thinking: `thinking: { type: "adaptive" }`.
- From `claude-developer-platform` skill: Opus 4.6 pricing is $5.00/1M input, $25.00/1M output.

## Implementation Plan

### Step 1: Read current providers.ts

Read `src/lib/ai/providers.ts` to understand the exact structure of `MODELS` and `MODEL_COSTS`.

### Step 2: Add CLAUDE_OPUS to MODELS

Add to the `MODELS` object:

```typescript
export const MODELS = {
  // ...existing entries...
  CLAUDE_OPUS: 'claude-opus-4-6',
} as const;
```

### Step 3: Add cost entry

Add to `MODEL_COSTS` (or equivalent cost tracking object):

```typescript
'claude-opus-4-6': {
  inputCostPer1M: 5.0,
  outputCostPer1M: 25.0,
},
```

### Step 4: Verify existing entries unchanged

Ensure all existing model constants and costs remain exactly as they were.

## Files to Modify

- `src/lib/ai/providers.ts` — Add CLAUDE_OPUS to MODELS, add cost entry

## Contracts

### Provides (for downstream tasks)

- `MODELS.CLAUDE_OPUS` = `'claude-opus-4-6'` — used by Task 3.1 (API route)
- Cost entry for `claude-opus-4-6` — used by existing cost tracking

### Consumes (from upstream tasks)

- None

## Acceptance Criteria

- [ ] `MODELS.CLAUDE_OPUS` equals `'claude-opus-4-6'`
- [ ] Cost entry exists with correct pricing ($5/$25 per 1M)
- [ ] Existing model constants unchanged
- [ ] Build succeeds

## Testing Protocol

### Build/Lint/Type Checks

- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes

## Skills to Read

- `claude-developer-platform` — Model IDs and pricing

## Research Files to Read

- `.claude/orchestration-aigos-v2-sprint1/research/existing-codebase.md` — Current providers.ts structure

## Git

- Branch: `aigos-v2`
- Commit message prefix: `Task 1.4:`
