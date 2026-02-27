# Task 1.1: askUser Tool Definition

## Objective

Create the `askUser` interactive tool definition using Vercel AI SDK v6's `tool()` function with a Zod input schema. This is the core mechanism for presenting structured chip-based questions to the user during onboarding.

## Context

This is the first task in Sprint 2. The askUser tool is an "interactive tool" — it has NO `execute` function. The AI SDK waits for the frontend to call `addToolOutput()` with the user's selection before continuing. The route (Task 2.1) will import this tool, the card component (Task 3.1) will render it, and the page (Task 4.2) will wire `addToolOutput`.

## Dependencies

- None (first task)

## Blocked By

- None

## Research Findings

- From `ai-sdk-tool-implementation.md`: `tool()` imported from `ai` package. Interactive tools omit `execute`. Verified at `node_modules/ai/dist/index.d.ts`.
- From DISCOVERY.md D18: Tools without `execute` are "interactive tools" — SDK waits for frontend `addToolOutput()`.
- From DISCOVERY.md D8: Tool output format is structured JSON: `{ fieldName, selectedLabel, selectedIndex }` for single, `{ fieldName, selectedLabels, selectedIndices }` for multi, `{ fieldName, otherText }` for "Other".

## Implementation Plan

### Step 1: Create the tool file

Create `src/lib/ai/tools/ask-user.ts` with:

```typescript
import { tool } from 'ai';
import { z } from 'zod';

export const askUser = tool({
  description: 'Present a structured question to the user with selectable options. Use for categorical questions where predefined choices help guide the user. The user will see interactive chips they can tap to respond.',
  inputSchema: z.object({
    question: z.string().describe('The question to display to the user'),
    fieldName: z.string().describe('The OnboardingState field this answer maps to (e.g., "businessModel", "industry")'),
    options: z.array(
      z.object({
        label: z.string().describe('Short option label shown on the chip'),
        description: z.string().optional().describe('Optional longer description shown below the label'),
      })
    ).min(2).max(6).describe('2-6 option choices. An "Other" option is always added automatically by the frontend.'),
    multiSelect: z.boolean().default(false).describe('If true, user can select multiple options. If false, single selection auto-submits.'),
  }),
  // NO execute function — this is an interactive tool.
  // The frontend renders chips and calls addToolOutput() with the user's selection.
});
```

**IMPORTANT**: Use `inputSchema` per CLAUDE.md and the verified SKILL.md. The `tool()` function from `ai` accepts `inputSchema` for Zod schemas. Use `.max(6)` to give the agent room for dynamic option generation.

### Step 2: Verify build

Run `npm run build` to ensure the file compiles correctly and the tool export works.

## Files to Create

- `src/lib/ai/tools/ask-user.ts` — askUser interactive tool definition

## Files to Modify

- None

## Contracts

### Provides (for downstream tasks)

- **Export**: `askUser` — tool definition compatible with `streamText({ tools: { askUser } })`
- **Schema shape** (for Task 3.1 card component):
  - `question: string`
  - `fieldName: string`
  - `options: Array<{ label: string; description?: string }>`
  - `multiSelect: boolean`

### Consumes (from upstream tasks)

- None

## Acceptance Criteria

- [ ] File exists at `src/lib/ai/tools/ask-user.ts`
- [ ] Exports `askUser` using `tool()` from `ai` package
- [ ] Zod schema: question (required string), fieldName (required string), options (2-6 objects), multiSelect (boolean default false)
- [ ] No `execute` function defined
- [ ] `npm run build` passes

## Testing Protocol

### Build/Lint/Type Checks

- [ ] `npm run build` succeeds — confirms tool definition compiles and is importable

## Skills to Read

- `.claude/orchestration-sprint2-onboarding/skills/ai-sdk-interactive-tools/SKILL.md` — tool definition patterns, interactive tool mechanics

## Research Files to Read

- `.claude/orchestration-sprint2-onboarding/research/ai-sdk-tool-implementation.md` — verified API signatures

## Git

- Branch: `aigos-v2`
- Commit message prefix: `Task 1.1:`
