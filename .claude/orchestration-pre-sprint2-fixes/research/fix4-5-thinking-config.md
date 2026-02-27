# Fix #4 & #5: Thinking Config Mismatch + Thinking Blocks Not Displayed

## Fix #4: Thinking Config Mismatch

### Current (WRONG)
```typescript
// src/app/api/journey/stream/route.ts (lines 71-74)
providerOptions: {
  anthropic: {
    thinking: { type: 'enabled', budgetTokens: 10000 },
  },
},
```

### Required (DISCOVERY.md D2)
```typescript
providerOptions: {
  anthropic: {
    thinking: { type: 'adaptive' },
  },
},
```

**DISCOVERY.md D2**: "Model `claude-opus-4-6`. Adaptive thinking: `thinking: { type: 'adaptive' }`. Effort: default high."

### Difference
- `enabled` = fixed budget (always 10K tokens), always runs
- `adaptive` = auto-adjusts budget (0-32K) based on query complexity

## Fix #5: Thinking Blocks Not Displayed

### Problem
Journey page `getTextContent()` filters to only `type: 'text'` parts, discarding all `type: 'reasoning'` parts.

### AI SDK Native Reasoning Parts
With `thinking: { type: 'adaptive' }`, Claude generates **native `ReasoningUIPart`**:
```typescript
type ReasoningUIPart = {
  type: 'reasoning';
  text: string;
  state?: 'streaming' | 'done';
};
```

### V1 Implementation (agent-chat.tsx lines 79-102)
V1 uses XML `<think>` tags parsed from text (because chat agent route uses Groq, not Claude):
```typescript
function parseThinkingBlocks(text: string): Array<{ type: 'text' | 'thinking'; content: string }> {
  const regex = /<think>([\s\S]*?)<\/think>/g;
  // Splits text into text/thinking segments
}
```

### V2 Should Use Native Reasoning
Journey route uses Claude Opus with native thinking → generates `ReasoningUIPart` (not XML tags). So instead of `parseThinkingBlocks()`, simply check for `part.type === 'reasoning'`.

### ThinkingBlock Component (READY)
```typescript
// src/components/chat/thinking-block.tsx — fully implemented
export function ThinkingBlock({ content, durationMs, defaultOpen }: ThinkingBlockProps)
// Collapsible block with left border, chevron toggle, italic gray text
// Exported from src/components/chat/index.ts
```

## Implementation

### Fix #4: One-line change in route.ts
Change `{ type: 'enabled', budgetTokens: 10000 }` → `{ type: 'adaptive' }`

### Fix #5: Handle reasoning parts in message rendering
```typescript
// In the message parts iterator:
if (part.type === 'reasoning') {
  elements.push(<ThinkingBlock key={...} content={part.text} />);
}
```

No need for `parseThinkingBlocks()` — native reasoning parts are already separated.
