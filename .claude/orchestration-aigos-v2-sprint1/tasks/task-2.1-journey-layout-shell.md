# Task 2.1: Journey Layout Shell

## Objective

Create an adaptive layout component that transitions between centered chat (phase='setup') and two-column layout (phase='review'). Sprint 1 only renders centered mode.

## Context

Phase 2 UI component. This is the structural shell for the entire /journey page. It handles the layout transition that happens when the user progresses from onboarding to review phase. For Sprint 1, only 'setup' mode is active (centered chat at max-width 720px).

## Dependencies

- Task 1.2 (tokens mapped) — uses `--bg-base`, `--border-default`

## Blocked By

- Phase 1 complete

## Research Findings

- From DISCOVERY.md D14: CSS transition with phase-driven state. Centered chat (max-width 720px) for phase='setup'. Two-column (440px chat + flex-1 blueprint) for phase='review'. Transition via CSS `transition: all 0.3s ease`.
- From `existing-codebase.md`: Existing TwoColumnLayout uses Framer Motion. Journey layout should use CSS transitions instead (simpler, per DISCOVERY.md).
- From `existing-codebase.md`: Components use named exports, Props interfaces, 'use client' directive, `cn()` utility.

## Implementation Plan

### Step 1: Create the component file

Create `src/components/journey/journey-layout.tsx`:

```typescript
'use client';

import { cn } from '@/lib/utils';

interface JourneyLayoutProps {
  phase: 'setup' | 'review';
  chatContent: React.ReactNode;
  blueprintContent?: React.ReactNode;
  className?: string;
}

export function JourneyLayout({
  phase,
  chatContent,
  blueprintContent,
  className,
}: JourneyLayoutProps) {
  const isCentered = phase === 'setup';

  return (
    <div
      className={cn('flex h-full w-full', className)}
      style={{
        background: 'var(--bg-base)',
        transition: 'all 0.3s ease',
      }}
    >
      {/* Chat Panel */}
      <div
        className="flex flex-col h-full"
        style={{
          width: isCentered ? '100%' : '440px',
          maxWidth: isCentered ? '720px' : '440px',
          margin: isCentered ? '0 auto' : '0',
          transition: 'all 0.3s ease',
        }}
      >
        {chatContent}
      </div>

      {/* Blueprint Panel (hidden in setup phase) */}
      {!isCentered && blueprintContent && (
        <div
          className="flex-1 h-full overflow-y-auto"
          style={{
            borderLeft: '1px solid var(--border-default)',
            background: 'var(--bg-elevated)',
            transition: 'all 0.3s ease',
          }}
        >
          {blueprintContent}
        </div>
      )}
    </div>
  );
}
```

### Step 2: Ensure proper height management

The layout must fill the full viewport height minus the header (56px). The parent page will set `height: calc(100vh - 56px)` or equivalent.

### Step 3: Test both phase states

Even though Sprint 1 only uses 'setup', verify 'review' mode renders the two-column layout correctly (for future-proofing).

## Files to Create

- `src/components/journey/journey-layout.tsx`

## Contracts

### Provides (for downstream tasks)

```typescript
interface JourneyLayoutProps {
  phase: 'setup' | 'review';
  chatContent: React.ReactNode;
  blueprintContent?: React.ReactNode;
  className?: string;
}
```

- Task 3.2 (Journey Page) wraps chat content in this layout with `phase='setup'`

### Consumes (from upstream tasks)

- Task 1.2: CSS variables `--bg-base`, `--border-default`, `--bg-elevated`

## Acceptance Criteria

- [ ] `phase='setup'` renders centered column at max-width 720px
- [ ] `phase='review'` renders two-column layout (440px + flex-1)
- [ ] CSS transition animates between layouts smoothly (0.3s ease)
- [ ] Named export `JourneyLayout`
- [ ] Props interface `JourneyLayoutProps`
- [ ] `'use client'` directive at top
- [ ] Uses `cn()` utility from `@/lib/utils`
- [ ] CSS variables via `style` prop (follows codebase pattern)
- [ ] Build succeeds

## Testing Protocol

### Build/Lint/Type Checks

- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes

### Visual Verification

- [ ] Component renders centered layout in 'setup' phase
- [ ] Component renders two-column in 'review' phase (manual test)

## Skills to Read

- None specific

## Research Files to Read

- `.claude/orchestration-aigos-v2-sprint1/research/existing-codebase.md` — Layout patterns, component conventions
- `.claude/orchestration-aigos-v2-sprint1/DISCOVERY.md` — D14 layout transition

## Git

- Branch: `aigos-v2`
- Commit message prefix: `Task 2.1:`
