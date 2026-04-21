# Task 2.5: Streaming Cursor + Typing Indicator

## Objective

Create two small components: (1) streaming cursor — an inline blinking caret appended during AI response streaming, and (2) typing indicator — 3 bouncing dots shown while waiting for the first token.

## Context

Phase 2 UI component. These are visual feedback elements for the streaming UX. The streaming cursor CSS already exists in globals.css (`.streaming-cursor`). The typing indicator is a new Framer Motion component.

## Dependencies

- Task 1.2 (tokens) — uses `--accent-blue`, `--text-tertiary`

## Blocked By

- Phase 1 complete

## Research Findings

- From PRD Section 2.4: Streaming cursor: inline block, 2px wide, 14px tall, --accent-blue, blink 0.8s step-end. Typing indicator: 3 dots, 5px circles, bouncing, staggered delay 0s/0.15s/0.3s.
- From `existing-codebase.md`: `.streaming-cursor` CSS already exists in globals.css. Existing `typing-indicator.tsx` uses Framer Motion opacity animation — v2 wants bouncing (translateY) instead.
- From `existing-codebase.md`: Framer Motion presets in `@/lib/motion`.

## Implementation Plan

### Step 1: Create streaming cursor component

Create `src/components/journey/streaming-cursor.tsx`:

```typescript
interface StreamingCursorProps {
  className?: string;
}

export function StreamingCursor({ className }: StreamingCursorProps) {
  return (
    <span
      className={`streaming-cursor ${className || ''}`}
      aria-hidden="true"
    />
  );
}
```

This is intentionally simple — a thin wrapper around the existing CSS class. No 'use client' needed (no hooks or state). The CSS in globals.css handles all animation:

```css
.streaming-cursor {
  display: inline-block;
  width: 2px;
  height: 14px;
  margin-left: 1px;
  vertical-align: text-bottom;
  background: var(--accent-blue, rgb(54, 94, 255));
  border-radius: 1px;
  animation: streaming-cursor-blink 0.8s step-end infinite;
}
```

### Step 2: Create typing indicator component

Create `src/components/journey/typing-indicator.tsx`:

```typescript
'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TypingIndicatorProps {
  className?: string;
}

export function TypingIndicator({ className }: TypingIndicatorProps) {
  return (
    <div className={cn('flex items-center gap-1 py-2', className)}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          animate={{
            y: [0, -6, 0],
          }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.15,
            ease: 'easeInOut',
          }}
          className="rounded-full"
          style={{
            width: '5px',
            height: '5px',
            background: 'var(--text-tertiary)',
          }}
        />
      ))}
    </div>
  );
}
```

The bouncing animation uses translateY (via Framer Motion `y` prop) with staggered delays. Each dot bounces up 6px and back down over 0.6s.

## Files to Create

- `src/components/journey/streaming-cursor.tsx`
- `src/components/journey/typing-indicator.tsx`

## Contracts

### Provides (for downstream tasks)

```typescript
// StreamingCursor — no props required, just className
interface StreamingCursorProps {
  className?: string;
}

// TypingIndicator
interface TypingIndicatorProps {
  className?: string;
}
```

- Task 2.3 (Chat Message) may use `StreamingCursor` inline
- Task 3.2 (Journey Page) shows `TypingIndicator` when `status === 'submitted'`

### Consumes (from upstream tasks)

- Task 1.2: CSS variables `--accent-blue`, `--text-tertiary`
- globals.css: `.streaming-cursor` keyframes (already exist)

## Acceptance Criteria

- [ ] Streaming cursor renders as 2px x 14px blinking blue block
- [ ] Streaming cursor blinks at 0.8s step-end
- [ ] Typing indicator shows 3 dots at 5px diameter
- [ ] Dots bounce with staggered timing (0s, 0.15s, 0.3s)
- [ ] Dots use --text-tertiary color
- [ ] Named exports for both components
- [ ] Props interfaces defined
- [ ] Build succeeds

## Testing Protocol

### Build/Lint/Type Checks

- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes

### Visual Verification

- [ ] Streaming cursor blinks smoothly
- [ ] Typing indicator dots bounce in sequence

## Skills to Read

- None specific

## Research Files to Read

- `.claude/orchestration-aigos-v2-sprint1/research/chat-ui-components.md` — Animation specs

## Git

- Branch: `aigos-v2`
- Commit message prefix: `Task 2.5:`
