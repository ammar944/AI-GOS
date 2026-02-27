# Fix #7: No Multi-Step Progress Streaming

## Problem Summary

Deep Research tool needs 3-step progress (Decompose → Research → Synthesize). Currently tools return atomically — user sees generic loading indicator for ~10-15s, then full result appears.

## Current Architecture

### Deep Research Tool (`src/lib/ai/chat-tools/deep-research.ts`)
- Phases are collected in array (`phases: ResearchPhase[]`)
- Phases marked `status: 'done'` only after completion
- Complete `DeepResearchResult` returned as single object when execute() finishes

### Frontend Display Chain
1. While tool runs → `ToolLoadingIndicator` (generic)
2. Tool completes → `DeepResearchCard` (full result)
3. No intermediate progress updates

### AI SDK v6 Constraint
Tool `execute()` is **async but atomic** — no built-in streaming within tool execution. The entire result must be returned as JSON in `output` field.

## Recommended Approach: Custom SSE Events (Option 3)

Decouple tool execution from progress via SSE callback — matches media-plan pipeline pattern.

### Backend Changes

1. **New type**:
```typescript
export interface ToolProgressEvent {
  phase: string;
  status: 'start' | 'update' | 'complete';
  duration?: number;
  data?: Record<string, unknown>;
}
```

2. **Modify tool signature**:
```typescript
export function createDeepResearchTool(onProgress?: (event: ToolProgressEvent) => void) {
  return tool({
    execute: async (input) => {
      onProgress?.({ phase: 'Decompose', status: 'start' });
      // ... decompose ...
      onProgress?.({ phase: 'Decompose', status: 'complete', duration });
      onProgress?.({ phase: 'Research', status: 'start' });
      // ... research ...
      onProgress?.({ phase: 'Synthesize', status: 'start' });
      // ...
      return finalResult;
    }
  });
}
```

3. **Route emits SSE**:
```typescript
const tools = createChatTools(blueprintId, blueprint, (event) => {
  emit({ type: 'tool-progress', toolName: 'deepResearch', event });
});
```

### Frontend Changes
1. Parse `tool-progress` SSE events
2. Show `ResearchProgressCard` with phase dots during execution
3. Transition to `DeepResearchCard` when tool output received

### Existing Patterns to Follow
- **Media plan pipeline** (`src/lib/media-plan/pipeline.ts`): `onSectionProgress` callback
- **ResearchProgressCard** (`src/components/chat/research-progress-card.tsx`): Phase dots with done/active/pending states
- **SSE emission** (`src/app/api/media-plan/generate/route.ts`): `createSSEMessage` pattern

## Alternative Considered: Vercel AI SDK Data Stream Annotations

AI SDK v6 supports `createDataStream` with custom annotations. However, this requires changing the streaming approach from `streamText().toUIMessageStreamResponse()` to a custom data stream, which is a larger refactor.

## Scope Note

This fix requires tools to be defined in the journey stream route first. If tools aren't added yet (they may be Sprint 2 scope), this fix should document the pattern and wire it when tools are added.
