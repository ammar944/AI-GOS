# Task 2.4: Chat Input with Glassmorphism

## Objective

Create a glassmorphism chat input with auto-resize textarea, send button with blue glow, and focus state effects. Fixed at the bottom of the chat panel with gradient fade-in above it.

## Context

Phase 2 UI component. This is the input area at the bottom of the /journey chat. Follows the design system's glassmorphism aesthetic. The existing `chat-input.tsx` in v1 provides the exact pattern to follow.

## Dependencies

- Task 1.2 (tokens) — uses `--bg-input`, `--border-subtle`, `--border-focus`, `--text-primary`, `--accent-blue`, `--accent-blue-glow`

## Blocked By

- Phase 1 complete

## Research Findings

- From PRD Section 2.4: Glassmorphism input container with focus glow. Auto-resize textarea (max 120px). Send button with blue glow. Fixed at bottom with gradient fade-in.
- From `existing-codebase.md`: Existing `chat-input.tsx` uses `autoResize` callback (set height to 'auto' then scrollHeight, max 100px). Submit on Enter, Shift+Enter for newline. Inline styles for CSS vars, Tailwind for layout.
- From `existing-codebase.md`: `.glass` utility class exists in globals.css: `background: oklch(from var(--brand-navy-light) l c h / 0.8); backdrop-filter: blur(12px); border: 1px solid oklch(from var(--brand-blue) l c h / 0.1);`

## Implementation Plan

### Step 1: Create the component

Create `src/components/journey/chat-input.tsx`:

```typescript
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Send } from 'lucide-react';
import { cn } from '@/lib/utils';

interface JourneyChatInputProps {
  onSubmit: (message: string) => void;
  isLoading: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function JourneyChatInput({
  onSubmit,
  isLoading,
  disabled = false,
  placeholder = 'Tell me about your business...',
  className,
}: JourneyChatInputProps) {
  const [input, setInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  useEffect(() => {
    autoResize();
  }, [input, autoResize]);

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || disabled) return;
    onSubmit(trimmed);
    setInput('');
    // Reset height after clearing
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input, isLoading, disabled, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const canSend = input.trim().length > 0 && !isLoading && !disabled;

  return (
    <div className={cn('relative', className)}>
      {/* Gradient fade above input */}
      <div
        className="absolute -top-12 left-0 right-0 h-12 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, transparent, var(--bg-base))',
        }}
      />

      {/* Glassmorphism container */}
      <div
        className="flex items-end gap-2 p-3"
        style={{
          borderRadius: '16px',
          background: 'rgba(10, 13, 20, 0.8)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: `1px solid ${isFocused ? 'var(--border-focus)' : 'var(--border-subtle)'}`,
          boxShadow: isFocused
            ? '0 0 0 3px var(--accent-blue-glow), 0 0 20px rgba(54, 94, 255, 0.1)'
            : 'none',
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        }}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 bg-transparent outline-none resize-none scrollbar-hide text-sm leading-relaxed"
          style={{
            color: 'var(--text-primary)',
            minHeight: '20px',
            maxHeight: '120px',
          }}
        />

        {/* Send button */}
        <button
          onClick={handleSubmit}
          disabled={!canSend}
          className="flex-shrink-0 flex items-center justify-center rounded-full transition-all duration-200"
          style={{
            width: '32px',
            height: '32px',
            background: canSend ? 'var(--accent-blue)' : 'transparent',
            color: canSend ? '#ffffff' : 'var(--text-tertiary)',
            boxShadow: canSend ? '0 0 12px rgba(54, 94, 255, 0.4)' : 'none',
            cursor: canSend ? 'pointer' : 'default',
          }}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
```

### Step 2: Handle loading state

When `isLoading=true`, the send button should be disabled. Optionally show a stop button (not required for Sprint 1).

### Step 3: Gradient fade integration

The gradient fade (`-top-12`) creates a smooth transition from messages to the input area. The parent container must have `overflow: hidden` or the fade must be positioned correctly.

## Files to Create

- `src/components/journey/chat-input.tsx`

## Contracts

### Provides (for downstream tasks)

```typescript
interface JourneyChatInputProps {
  onSubmit: (message: string) => void;
  isLoading: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}
```

- Task 3.2 (Journey Page) renders this at the bottom of the chat area

### Consumes (from upstream tasks)

- Task 1.2: CSS variables `--bg-base`, `--border-subtle`, `--border-focus`, `--text-primary`, `--text-tertiary`, `--accent-blue`, `--accent-blue-glow`

## Acceptance Criteria

- [ ] Glassmorphism container with backdrop blur
- [ ] Auto-resize textarea (min 1 line, max 120px)
- [ ] Enter sends, Shift+Enter adds newline
- [ ] Send button disabled when empty or loading (no glow, muted color)
- [ ] Send button enabled with blue glow when text present
- [ ] Focus state shows blue border + glow
- [ ] Gradient fade above input
- [ ] Input clears after submission
- [ ] Named export, Props interface, 'use client' directive
- [ ] Build succeeds

## Testing Protocol

### Build/Lint/Type Checks

- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes

### Interactive Testing

- [ ] Type text → send button activates (blue glow)
- [ ] Click send → `onSubmit` fires with trimmed text, input clears
- [ ] Enter → sends
- [ ] Shift+Enter → newline (textarea grows)
- [ ] Multi-line → textarea grows up to 120px max
- [ ] Empty input → send button disabled

## Skills to Read

- None specific

## Research Files to Read

- `.claude/orchestration-aigos-v2-sprint1/research/existing-codebase.md` — Existing chat-input.tsx pattern
- `.claude/orchestration-aigos-v2-sprint1/research/chat-ui-components.md` — Auto-resize, glassmorphism

## Git

- Branch: `aigos-v2`
- Commit message prefix: `Task 2.4:`
