# Fix #3: No Approval Flow UI

## Problem Summary

Journey page has no approval flow. Edit proposals need `approval-requested → approval-responded` state machine. Complete pattern exists in v1 `agent-chat.tsx`.

## V1 Approval Flow Architecture

### Backend: Tool Definition with `needsApproval: true`
```typescript
// src/lib/ai/chat-tools/edit-blueprint.ts
export function createEditBlueprintTool(blueprint) {
  return tool({
    description: '...',
    inputSchema: z.object({ section, fieldPath, newValue, explanation }),
    needsApproval: true,  // <-- Triggers approval flow
    execute: async ({ section, fieldPath, newValue, explanation }) => {
      return { section, fieldPath, oldValue, newValue, explanation, diffPreview };
    },
  });
}
```

### State Machine
```
input-streaming → input-available → approval-requested → approval-responded → output-available | output-error | output-denied
```

### Frontend Hook Integration (agent-chat.tsx lines 155-185)
```typescript
const { messages, sendMessage, addToolApprovalResponse, status, setMessages } = useChat({
  transport,
  sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
  onError: (err) => {
    if (err?.message?.includes('Tool result is missing')) {
      // Strip incomplete tool parts
    }
  },
});
```

### Pending Approval Detection (lines 217-227)
```typescript
const hasPendingApproval = messages.some(
  (msg) => msg.role === 'assistant' &&
    msg.parts.some((part) => typeof part === 'object' && 'state' in part &&
      (part as Record<string, unknown>).state === 'approval-requested')
);
```

### Approval Handlers (lines 274-326)
1. Apply edit locally to `blueprintRef` (optimistic update)
2. Record in undo/redo history
3. Call `addToolApprovalResponse({ id: approvalId, approved: true/false })`

### Auto-Resubmit
`sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses` auto-continues conversation after all approvals responded.

## What Journey Page Needs

1. **Destructure `addToolApprovalResponse` from useChat**
2. **Add `sendAutomaticallyWhen` to useChat config**
3. **Detect pending approvals** to block input during approval
4. **Render approval cards** in message parts (EditApprovalCard component)
5. **Handle approve/reject** via `addToolApprovalResponse({ id, approved })`
6. **Error handling** for MissingToolResultsError

## Key API Contract
```typescript
addToolApprovalResponse({ id: approvalId, approved: true });
// SDK: transitions tool from approval-requested → approval-responded
// If approved: runs execute(), transitions to output-available
// If rejected: transitions to output-denied
// sendAutomaticallyWhen triggers auto-resubmit
```

## Existing Components (ready to import)
- `EditApprovalCard` — approve/reject UI with diff view
- `EditDiffView` — word-level diff visualization
- `ViewInBlueprintButton` — navigate to edited field
- `ToolLoadingIndicator` — tool progress state

## Critical Notes
- Approval ID fallback: `toolPart.approval?.id ?? ${message.id}-${partIndex}`
- Message sanitization already in journey route (lines 37-63)
- Must block chat input while approval pending
