# Task 2.2: Journey Header (Logo Only)

## Objective

Create a minimal 56px header with the AI-GOS gradient logo. No step indicators — v2 is a pure chat agent experience, not a wizard flow.

## Context

Phase 2 UI component. Minimal top bar for branding. The design system file was shared for visual tokens, NOT for the wizard step pattern.

## Dependencies

- Task 1.1 (fonts) — Instrument Sans for logo
- Task 1.2 (tokens) — `--bg-elevated`, `--border-default`

## Blocked By

- Phase 1 complete

## Research Findings

- From DISCOVERY.md D12: Logo is "AI-GOS" in Instrument Sans 700, 15px, gradient text fill (white → #93c5fd).
- From PRD Section 2.2: 56px height, --bg-elevated background, --border-default bottom border.
- **USER OVERRIDE**: No step indicators. The v2 journey is a conversational AI agent, not a wizard. The design file was shared for visual tokens only.

## Implementation Plan

### Step 1: Create the component

Create `src/components/journey/journey-header.tsx`:

```typescript
import { cn } from '@/lib/utils';

interface JourneyHeaderProps {
  className?: string;
}

export function JourneyHeader({ className }: JourneyHeaderProps) {
  return (
    <header
      className={cn('flex items-center px-6', className)}
      style={{
        height: '56px',
        background: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border-default)',
      }}
    >
      {/* Logo */}
      <div
        className="font-heading font-bold"
        style={{
          fontSize: '15px',
          background: 'linear-gradient(180deg, #ffffff 0%, #93c5fd 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        AI-GOS
      </div>
    </header>
  );
}
```

No 'use client' needed — no hooks, no state, no interactivity. Pure server component.

## Files to Create

- `src/components/journey/journey-header.tsx`

## Contracts

### Provides (for downstream tasks)

```typescript
interface JourneyHeaderProps {
  className?: string;
}
```

- Task 3.2 (Journey Page) renders this at the top

### Consumes (from upstream tasks)

- Task 1.1: `font-heading` class (Instrument Sans)
- Task 1.2: CSS variables `--bg-elevated`, `--border-default`

## Acceptance Criteria

- [ ] Logo renders "AI-GOS" with gradient text (white → #93c5fd)
- [ ] Logo uses Instrument Sans 700 at 15px
- [ ] Header is 56px tall
- [ ] Background: --bg-elevated, border-bottom: --border-default
- [ ] NO step indicators
- [ ] Named export, Props interface
- [ ] Build succeeds

## Testing Protocol

### Build/Lint/Type Checks

- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes

### Visual Verification

- [ ] Logo has gradient text effect
- [ ] Header renders at correct height with correct background

## Git

- Branch: `aigos-v2`
- Commit message prefix: `Task 2.2:`
