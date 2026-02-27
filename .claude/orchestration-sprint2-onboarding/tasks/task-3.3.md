# Task 3.3: Progress Bar

## Objective

Add a thin 2px progress bar below the journey header showing required field completion percentage (0-100%).

## Context

The existing `JourneyHeader` (`src/components/journey/journey-header.tsx`) is a simple 56px header with gradient "AI-GOS" text and `--bg-elevated` background. This task adds a `completionPercentage` prop and a thin progress bar below the header content.

Task 4.2 will pass the actual `completionPercentage` value from the page's onboarding state.

## Dependencies

- Task 1.2 — OnboardingState for completion calculation concept (but no import needed — just receives a number prop)

## Blocked By

- Phase 1 complete

## Research Findings

- From DISCOVERY.md D21: 2px bar, width = completion %, fill color `--accent-blue`, no step labels, no text, subtle width transition.
- From PHASES.md: "No step labels, no text, pure visual indicator."

## Implementation Plan

### Step 1: Read current header

Read `src/components/journey/journey-header.tsx`. Understand layout, height, background.

### Step 2: Add prop

```typescript
interface JourneyHeaderProps {
  completionPercentage?: number;  // 0-100, default 0
}
```

### Step 3: Add progress bar JSX

After the existing header content (inside the same wrapper or as a sibling), add:

```tsx
{/* Progress bar */}
<div
  style={{
    height: '2px',
    width: '100%',
    backgroundColor: 'var(--border-subtle, rgba(255, 255, 255, 0.06))',
  }}
>
  <div
    style={{
      height: '100%',
      width: `${completionPercentage ?? 0}%`,
      backgroundColor: 'var(--accent-blue, rgb(54, 94, 255))',
      transition: 'width 0.3s ease',
    }}
  />
</div>
```

### Step 4: Handle edge cases

- `completionPercentage` undefined or 0: bar at 0% width (just the background track visible)
- `completionPercentage` = 100: full width fill
- Clamp value between 0-100 for safety

## Files to Create

- None

## Files to Modify

- `src/components/journey/journey-header.tsx` — add `completionPercentage` prop and 2px progress bar

## Contracts

### Provides (for downstream tasks)

- Updated `JourneyHeader` component that accepts `completionPercentage?: number`
- Renders a 2px progress bar below header content

### Consumes (from upstream tasks)

- None (receives a simple number prop)

## Acceptance Criteria

- [ ] 2px bar renders below header
- [ ] Width scales 0-100% based on prop
- [ ] Fill color is `--accent-blue`
- [ ] Background track color is `--border-subtle` or transparent
- [ ] Smooth width transition (0.3s ease)
- [ ] Default to 0% when prop not provided
- [ ] Value clamped between 0-100
- [ ] `npm run build` passes

## Testing Protocol

### Build/Lint/Type Checks

- [ ] `npm run build` succeeds

## Skills to Read

- None (straightforward CSS)

## Research Files to Read

- None

## Git

- Branch: `aigos-v2`
- Commit message prefix: `Task 3.3:`
