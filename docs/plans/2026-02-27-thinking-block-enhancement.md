# ThinkingBlock Enhancement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add live timer, streaming state awareness, and blue accent border to ThinkingBlock component.

**Architecture:** Single-file modification. Replace `durationMs` prop with `state` prop. Add self-managed client-side timer using `useRef` + `useEffect` + `setInterval(100ms)`. Change border color to `--accent-blue`.

**Tech Stack:** React (useState, useRef, useEffect), Framer Motion (AnimatePresence), CSS variables

---

### Task 1: Update props interface and imports

**Files:**
- Modify: `src/components/chat/thinking-block.tsx:1-11`

**Step 1: Update imports**

Add `useRef, useEffect` to the React import:
```typescript
import { useState, useRef, useEffect } from "react";
```

**Step 2: Replace props interface**

```typescript
interface ThinkingBlockProps {
  content: string;
  state?: 'streaming' | 'done';
  defaultOpen?: boolean;
}
```

Remove `durationMs` from destructuring, add `state`:
```typescript
export function ThinkingBlock({
  content,
  state,
  defaultOpen = false,
}: ThinkingBlockProps) {
```

**Step 3: Verify no consumers pass durationMs**

Confirmed: `agent-chat.tsx:546` and `journey/chat-message.tsx:462` both pass only `content`.

---

### Task 2: Add self-managed timer logic

**Files:**
- Modify: `src/components/chat/thinking-block.tsx:18-23`

**Step 1: Add timer refs and state**

After `const [isOpen, setIsOpen] = useState(defaultOpen);`, add:

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
    frozenElapsedRef.current = Date.now() - startTimeRef.current;
    setElapsed(frozenElapsedRef.current);
  }
}, [state]);
```

**Step 2: Replace label logic**

```typescript
const label = (() => {
  if (state === 'streaming') {
    return `Thinking for ${(elapsed / 1000).toFixed(1)}s`;
  }
  if (state === 'done') {
    const finalElapsed = frozenElapsedRef.current ?? elapsed;
    return `Thought for ${(finalElapsed / 1000).toFixed(1)}s`;
  }
  return 'Thinking';
})();
```

---

### Task 3: Change border color

**Files:**
- Modify: `src/components/chat/thinking-block.tsx:28`

**Step 1: Replace border-left style**

From:
```css
borderLeft: "2px solid var(--border-default, rgba(255, 255, 255, 0.12))"
```

To:
```css
borderLeft: "2px solid var(--accent-blue, rgb(54, 94, 255))"
```

---

### Task 4: Build verification

**Step 1: Run build**

```bash
npm run build
```

Expected: Success (0 errors)

---

## Acceptance Criteria Mapping

| Criterion | Task |
|-----------|------|
| Timer counts up during streaming | Task 2 — setInterval(100ms) while state=streaming |
| Timer freezes when done | Task 2 — frozenElapsedRef captures final elapsed |
| Label: "Thinking for X.Xs" streaming | Task 2 — label IIFE |
| Label: "Thought for X.Xs" done | Task 2 — label IIFE |
| Label: "Thinking" no state | Task 2 — label IIFE fallback |
| Border = --accent-blue | Task 3 |
| Collapsed by default | Unchanged (defaultOpen=false) |
| No auto-expand during streaming | No code added for auto-expand (D4) |
| durationMs removed | Task 1 |
| state prop added | Task 1 |
| npm run build passes | Task 4 |
