# Task 2.3: Chat Message Component

## Objective

Create the v2 chat message component with user bubble (right-aligned) and AI message (left-aligned with gradient avatar). Supports streaming cursor during active generation.

## Context

Phase 2 UI component. This renders individual messages in the /journey chat. The design follows the existing v1 `message-bubble.tsx` pattern closely but is a new component in the `journey/` directory.

## Dependencies

- Task 1.2 (tokens) — uses `--bg-hover`, `--text-primary`, `--text-secondary`, `--accent-blue`, `--border-default`

## Blocked By

- Phase 1 complete

## Research Findings

- From PRD Section 2.4: User bubble: right-aligned, max-width 85%, --bg-hover bg, 14px radius with bottom-right notch (14px 14px 4px 14px). AI message: left-aligned with 24px gradient avatar (--accent-blue → #006fff), no bubble, --text-secondary body.
- From `existing-codebase.md`: Existing `message-bubble.tsx` uses exact same styling. Pattern: inline `style` for CSS vars, Tailwind for layout.
- From `chat-ui-components.md`: Streaming cursor is a `<span className="streaming-cursor" />` appended to the last text block during streaming. CSS already exists in globals.css.

## Implementation Plan

### Step 1: Create the component

Create `src/components/journey/chat-message.tsx`:

```typescript
'use client';

import { cn } from '@/lib/utils';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  className?: string;
}

export function ChatMessage({
  role,
  content,
  isStreaming = false,
  className,
}: ChatMessageProps) {
  if (role === 'user') {
    return <UserMessage content={content} className={className} />;
  }
  return (
    <AssistantMessage
      content={content}
      isStreaming={isStreaming}
      className={className}
    />
  );
}
```

### Step 2: Implement UserMessage

```typescript
function UserMessage({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn('flex justify-end mb-4', className)}>
      <div
        className="px-4 py-2.5 max-w-[85%]"
        style={{
          background: 'var(--bg-hover)',
          border: '1px solid var(--border-default)',
          borderRadius: '14px 14px 4px 14px',
          color: 'var(--text-primary)',
          fontSize: '13.5px',
          lineHeight: '1.65',
        }}
      >
        {content}
      </div>
    </div>
  );
}
```

### Step 3: Implement AssistantMessage

```typescript
function AssistantMessage({
  content,
  isStreaming,
  className,
}: {
  content: string;
  isStreaming: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex gap-3 mb-4', className)}>
      {/* Gradient Avatar */}
      <div
        className="flex-shrink-0 flex items-center justify-center rounded-full"
        style={{
          width: '24px',
          height: '24px',
          background: 'linear-gradient(135deg, var(--accent-blue), #006fff)',
        }}
      >
        <span style={{ fontSize: '10px', color: '#ffffff' }}>AI</span>
      </div>

      {/* Message Content */}
      <div
        className="flex-1 min-w-0"
        style={{
          fontSize: '13.5px',
          lineHeight: '1.65',
          color: 'var(--text-secondary)',
        }}
      >
        {renderMarkdown(content)}
        {isStreaming && <span className="streaming-cursor" aria-hidden="true" />}
      </div>
    </div>
  );
}
```

### Step 4: Basic markdown rendering

Implement a simple `renderMarkdown` function that handles:
- Bold: `**text**` → `<strong>`
- Italic: `*text*` → `<em>`
- Code inline: `` `code` `` → `<code>`
- Line breaks: `\n\n` → paragraph breaks
- Lists: `- item` → `<li>`

Keep it simple — no heavy markdown library for Sprint 1. Can upgrade later.

```typescript
function renderMarkdown(text: string) {
  // Split into paragraphs
  const paragraphs = text.split('\n\n');
  return paragraphs.map((p, i) => (
    <p key={i} className={i > 0 ? 'mt-3' : ''}>
      {formatInline(p)}
    </p>
  ));
}

function formatInline(text: string) {
  // Basic bold, italic, code replacements
  // Use dangerouslySetInnerHTML or React nodes
  // Keep simple for Sprint 1
}
```

**Alternative**: Use the existing markdown rendering approach from `message-bubble.tsx`. Check if there's a shared markdown utility.

## Files to Create

- `src/components/journey/chat-message.tsx`

## Contracts

### Provides (for downstream tasks)

```typescript
interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  className?: string;
}
```

- Task 3.2 (Journey Page) renders this for each message in the chat

### Consumes (from upstream tasks)

- Task 1.2: CSS variables `--bg-hover`, `--text-primary`, `--text-secondary`, `--accent-blue`, `--border-default`
- globals.css: `.streaming-cursor` CSS class (already exists)

## Acceptance Criteria

- [ ] User messages right-aligned with bubble (14px 14px 4px 14px radius)
- [ ] User messages max-width 85%, --bg-hover background
- [ ] AI messages left-aligned with 24px gradient avatar
- [ ] AI messages have no bubble, --text-secondary color
- [ ] Streaming cursor appears when `isStreaming=true`
- [ ] Streaming cursor disappears when `isStreaming=false`
- [ ] Basic markdown rendering (bold, italic, code, paragraphs)
- [ ] Named export, Props interface
- [ ] Build succeeds

## Testing Protocol

### Build/Lint/Type Checks

- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes

### Visual Verification

- [ ] User message renders right-aligned with correct styling
- [ ] AI message renders left-aligned with gradient avatar
- [ ] Streaming cursor blinks at 0.8s step-end

## Skills to Read

- None specific

## Research Files to Read

- `.claude/orchestration-aigos-v2-sprint1/research/existing-codebase.md` — Message bubble patterns
- `.claude/orchestration-aigos-v2-sprint1/research/chat-ui-components.md` — Streaming cursor pattern

## Git

- Branch: `aigos-v2`
- Commit message prefix: `Task 2.3:`
