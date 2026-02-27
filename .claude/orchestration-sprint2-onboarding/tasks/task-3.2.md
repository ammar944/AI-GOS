# Task 3.2: ThinkingBlock Enhancement

## Objective

Add live timer, streaming state awareness, and blue accent border to the existing ThinkingBlock component. The component should show "Thinking for X.Xs" while reasoning streams, freeze to "Thought for X.Xs" when done, and display an `--accent-blue` left border.

## Context

The current ThinkingBlock (`src/components/chat/thinking-block.tsx`) accepts `content`, `durationMs?`, and `defaultOpen?`. It has a collapsible toggle with Framer Motion but no awareness of streaming state. The `durationMs` prop is unused — nobody passes it. The border is `--border-default` (subtle gray).

This task enhances the component. Task 4.1 will update `chat-message.tsx` to pass the `state` prop from `ReasoningUIPart`.

## Dependencies

- None

## Blocked By

- None (can run parallel with all Phase 3 tasks)

## Research Findings

- From `thinking-block-streaming.md`: `ReasoningUIPart` has `state?: 'streaming' | 'done'`. Timer must be client-side (no server-side duration data). Self-managed timer inside component using `useRef(Date.now())` + `setInterval(100ms)`.
- From DISCOVERY.md D4: Keep collapsed by default. No auto-expand during streaming.
- From DISCOVERY.md D5: Border color changes from `--border-default` to `--accent-blue`.
- From DISCOVERY.md D19: Client-side timer only. `useRef` start time, `setInterval` while streaming, freeze on done.

## Implementation Plan

### Step 1: Read current component

Read `src/components/chat/thinking-block.tsx`. Understand existing structure: props, state, AnimatePresence pattern, border styling, label formatting.

### Step 2: Update props interface

```typescript
interface ThinkingBlockProps {
  content: string;
  state?: 'streaming' | 'done';  // NEW: from ReasoningUIPart.state
  defaultOpen?: boolean;
}
// REMOVE durationMs prop — timer is self-managed
```

### Step 3: Add self-managed timer

```typescript
const startTimeRef = useRef<number>(Date.now());
const [elapsed, setElapsed] = useState(0);
const frozenElapsedRef = useRef<number | null>(null);

useEffect(() => {
  if (state === 'streaming') {
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTimeRef.current);
    }, 100);
    return () => clearInterval(interval);
  } else if (state === 'done' && frozenElapsedRef.current === null) {
    // Freeze the elapsed time when transitioning to done
    frozenElapsedRef.current = Date.now() - startTimeRef.current;
    setElapsed(frozenElapsedRef.current);
  }
}, [state]);
```

### Step 4: Update label text

```typescript
const label = (() => {
  if (state === 'streaming') {
    return `Thinking for ${(elapsed / 1000).toFixed(1)}s`;
  }
  if (state === 'done') {
    const finalElapsed = frozenElapsedRef.current ?? elapsed;
    return `Thought for ${(finalElapsed / 1000).toFixed(1)}s`;
  }
  // No state (historical message) — show plain label
  return 'Thinking';
})();
```

### Step 5: Change border color

Replace:
```css
border-left: 2px solid var(--border-default, rgba(255, 255, 255, 0.12))
```

With:
```css
border-left: 2px solid var(--accent-blue, rgb(54, 94, 255))
```

### Step 6: Verify existing behavior preserved

- Collapsed by default (`defaultOpen` prop)
- Chevron rotation animation
- AnimatePresence height animation
- Italic text style in `--text-tertiary`
- Content grows during streaming (React re-renders handle this)

## Files to Create

- None

## Files to Modify

- `src/components/chat/thinking-block.tsx` — update props, add timer, change border color, update label

## Contracts

### Provides (for downstream tasks)

- Updated `ThinkingBlock` component that accepts `state?: 'streaming' | 'done'`
- Self-managed timer (no external timing needed)
- Blue accent border per design system

### Consumes (from upstream tasks)

- None (self-contained enhancement)

## Acceptance Criteria

- [ ] Timer counts up during streaming (updates every 100ms)
- [ ] Timer freezes when state transitions to 'done'
- [ ] Label: "Thinking for X.Xs" while streaming, "Thought for X.Xs" when done
- [ ] Historical messages (no state prop) show "Thinking" without duration
- [ ] Border color is `--accent-blue` (`rgb(54, 94, 255)`)
- [ ] Collapsed by default, expands on click (unchanged behavior)
- [ ] Chevron rotation animation preserved
- [ ] Content text style preserved (italic, `--text-tertiary`)
- [ ] `durationMs` prop removed
- [ ] `npm run build` passes

## Testing Protocol

### Build/Lint/Type Checks

- [ ] `npm run build` succeeds

## Skills to Read

- None (research file covers everything)

## Research Files to Read

- `.claude/orchestration-sprint2-onboarding/research/thinking-block-streaming.md` — full implementation guide

## Git

- Branch: `aigos-v2`
- Commit message prefix: `Task 3.2:`
