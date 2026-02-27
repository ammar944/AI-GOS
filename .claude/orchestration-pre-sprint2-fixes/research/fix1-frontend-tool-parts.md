# Fix #1: Frontend Drops Non-Text Parts

## Problem Summary

The `getTextContent()` function in `src/app/journey/page.tsx` (lines 19-24) filters message parts to extract **only text content**, causing tool parts, reasoning parts, and other non-text UI message parts to be completely dropped from display.

## Current Implementation

### Journey Page (src/app/journey/page.tsx, lines 19-24):
```typescript
function getTextContent(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('');
}
```

**Usage at lines 92-98:**
```typescript
<ChatMessage
  key={message.id}
  role={message.role as 'user' | 'assistant'}
  content={getTextContent(message)}  // ← LOSES ALL NON-TEXT PARTS
  isStreaming={isThisMessageStreaming}
/>
```

## What Parts Are Being Filtered Out

Per AI SDK v6 UIMessagePart types:

1. **Text Parts** (`TextUIPart`) - ONLY KEPT
2. **Tool Parts** (`ToolUIPart`) - FILTERED OUT (`type: 'tool-${toolName}'`)
3. **Reasoning Parts** (`ReasoningUIPart`) - FILTERED OUT (`type: 'reasoning'`)
4. **File Parts** (`FileUIPart`) - FILTERED OUT
5. **Source Parts** - FILTERED OUT
6. **Data Parts** - FILTERED OUT

## How v1 Agent Chat Handles It

The `renderMessageParts()` function in agent-chat.tsx (lines 534-829):

1. **Iterates through ALL parts** (not filtering)
2. **Accumulates text** into a buffer
3. **Flushes text before tool parts**
4. **Handles tool parts by state**: input-streaming, input-available, approval-requested, output-available, output-error, output-denied
5. **Tool-specific rendering**: editBlueprint → EditApprovalCard, webResearch → ResearchResultCard, searchBlueprint → Source indicator, deepResearch → DeepResearchCard, etc.

### Tool Name Extraction Pattern
```typescript
const toolName = part.type.replace('tool-', '');
```

### Tool Detection Pattern (from export.ts)
```typescript
if (typeof part.type === 'string' && part.type.startsWith('tool-')) {
  const toolPart = part as unknown as ToolPart;
}
```

## Tool Part States (AI SDK v6)

- `input-streaming` — Tool call being populated
- `input-available` — Full input ready, awaiting execution
- `approval-requested` — Waiting for user approval
- `approval-responded` — User approved/rejected
- `output-available` — Tool executed successfully
- `output-error` — Tool execution failed (use `errorText`, NOT `error.message`)
- `output-denied` — User denied approval

## Correct Approach

1. **Remove `getTextContent()` entirely**
2. **Pass `message.parts` to ChatMessage** instead of flat text string
3. **ChatMessage renders per-part**: text → markdown, tool → card component, reasoning → collapsible block
4. **Reuse patterns from agent-chat.tsx** `renderMessageParts()` function

## Related Files
- `src/app/journey/page.tsx` — Remove getTextContent, pass parts
- `src/components/journey/chat-message.tsx` — Accept parts array, render each type
- `src/components/chat/agent-chat.tsx` — Reference implementation (lines 534-829)
- `src/lib/chat/export.ts` — Correct iteration pattern (lines 267-285)
