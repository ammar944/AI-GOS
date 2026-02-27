# Task 3.1: AskUser Card Component

## Objective

Create the interactive chip selection card that renders inline in chat when the agent calls askUser. This is the core UI component for structured question-and-answer during onboarding.

## Context

When the agent calls the `askUser` tool, the frontend receives a tool part with `toolName === 'askUser'`. This component renders that tool call as tappable option chips. It supports single-select (immediate submit), multi-select (toggle + Done), and "Other" (inline text input). After submission, chips become static/disabled.

The chat-message.tsx file (Task 4.1) will import and render this component. This task only creates the component — wiring happens in Phase 4.

## Dependencies

- Task 1.1 — for schema knowledge (props match tool input shape)

## Blocked By

- Phase 1 complete

## Research Findings

- From `chip-component-implementation.md`: Full component skeleton, state machine, animations, chip styling, accessibility patterns
- From DISCOVERY.md D1: Single-select = tap + 200ms highlight animation + auto-submit. Multi-select = toggle + "Done" button.
- From DISCOVERY.md D2: Rounded rectangles (12px) when descriptions present. Pills (999px) for label-only.
- From DISCOVERY.md D3: "Other" chip = dashed border, transparent bg, `--text-tertiary`. Expands inline text input.
- From DISCOVERY.md D8: Output format — single: `{ fieldName, selectedLabel, selectedIndex }`, multi: `{ fieldName, selectedLabels, selectedIndices }`, other: `{ fieldName, otherText }`

## Implementation Plan

### Step 1: Read existing component patterns

Read `src/components/journey/chat-message.tsx` and `src/components/chat/edit-approval-card.tsx` to understand existing card component patterns (how cards are structured, styled, animated).

### Step 2: Create component file

Create `src/components/journey/ask-user-card.tsx` with:

```typescript
'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

export type AskUserResult =
  | { fieldName: string; selectedLabel: string; selectedIndex: number }
  | { fieldName: string; selectedLabels: string[]; selectedIndices: number[] }
  | { fieldName: string; otherText: string };

interface AskUserCardProps {
  fieldName: string;
  options: Array<{ label: string; description?: string }>;
  multiSelect: boolean;
  onSubmit: (result: AskUserResult) => void;
  disabled?: boolean;
  previousSelection?: AskUserResult;
}

type CardState = 'idle' | 'selecting' | 'other-input' | 'submitted';
```

### Step 3: Implement state machine

- `idle` → user sees chips, none selected
- `selecting` → user has toggled at least one (multi-select only)
- `other-input` → "Other" chip tapped, text input visible
- `submitted` → result sent, all chips disabled

For single-select: `idle` → tap → 200ms animation → auto-submit → `submitted`
For multi-select: `idle` → toggle chips → `selecting` → tap "Done" → `submitted`
For "Other": `idle` → tap "Other" → `other-input` → type + enter/submit → `submitted`

### Step 4: Implement chip rendering

- Check if ANY option has a description → determines shape (rounded rect vs pill)
- Regular chips: `--bg-hover` background, `--border-default` border, `--text-primary` label
- Selected chips: `--accent-blue` border/glow, `--text-primary` label
- "Other" chip: dashed `--border-default` border, transparent bg, `--text-tertiary` label
- Disabled state: reduced opacity, pointer-events none, selected chips keep highlight

### Step 5: Implement animations

Use `motion.button` for chips. On single-select tap:
1. Selected chip scales slightly + border changes to `--accent-blue`
2. Unselected chips fade to 50% opacity
3. After 200ms delay, call `onSubmit()`

### Step 6: Implement "Other" input

When "Other" chip is tapped:
1. Show text input below chip group (AnimatePresence for enter/exit)
2. Auto-focus the input
3. Submit on Enter key or blur (if non-empty)

### Step 7: Implement disabled/previously-selected state

When `disabled` is true or `previousSelection` is provided:
- Render chips as static (no hover, no click)
- Highlight the previously selected chip(s)
- If "Other" was selected, show the text inline

### Step 8: Add accessibility

- `role="radiogroup"` for single-select, `role="group"` for multi-select
- `aria-label` on the chip group
- Each chip: `role="radio"` / `role="checkbox"`, `aria-checked`
- Keyboard: Tab to focus, Enter/Space to select, Arrow keys to navigate

## Files to Create

- `src/components/journey/ask-user-card.tsx`

## Files to Modify

- None

## Contracts

### Provides (for downstream tasks)

- **Component**: `AskUserCard` — renders inline in chat messages for askUser tool parts
- **Type**: `AskUserResult` — structured result type for `addToolOutput`
- **Props**:
  - `fieldName: string` — maps to OnboardingState field
  - `options: Array<{ label: string; description?: string }>` — from tool call args
  - `multiSelect: boolean` — from tool call args
  - `onSubmit: (result: AskUserResult) => void` — callback for chip selection
  - `disabled?: boolean` — true after submission
  - `previousSelection?: AskUserResult` — for rendering answered state from history

### Consumes (from upstream tasks)

- Task 1.1: Schema knowledge (props match askUser tool input shape)
- Design tokens from `globals.css`: `--accent-blue`, `--text-primary`, `--text-tertiary`, `--bg-hover`, `--border-default`

## Acceptance Criteria

- [ ] Single-select: tap immediately submits after 200ms animation
- [ ] Multi-select: toggle chips freely, "Done" button submits
- [ ] "Other" chip expands inline text input
- [ ] Chips disabled after submission, selected chips highlighted
- [ ] Correct border-radius: 12px with descriptions, 999px without
- [ ] Design tokens used: `--accent-blue`, `--text-tertiary`, `--bg-hover`, `--border-default`
- [ ] Keyboard accessible (Tab, Enter, Space, arrow keys)
- [ ] ARIA roles: radiogroup/radio (single), group/checkbox (multi)
- [ ] Handles `disabled` prop and `previousSelection` for history rendering
- [ ] `npm run build` passes

## Testing Protocol

### Build/Lint/Type Checks

- [ ] `npm run build` succeeds

## Skills to Read

- `.claude/orchestration-sprint2-onboarding/skills/chip-card-component/SKILL.md` — props, state machine, chip styling, animations, accessibility

## Research Files to Read

- `.claude/orchestration-sprint2-onboarding/research/chip-component-implementation.md` — full implementation guide with code

## Git

- Branch: `aigos-v2`
- Commit message prefix: `Task 3.1:`
