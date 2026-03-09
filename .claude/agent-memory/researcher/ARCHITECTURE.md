# AI-GOS V2 Architecture Deep Dive

## Entry Points & Core Flows

### 1. Journey Page (Onboarding + Research Phase)
**File**: `/Users/ammar/Dev-Projects/AI-GOS-main/src/app/journey/page.tsx`

**Flow**:
1. User lands on `JourneyPage` (lines 39-44)
2. Wrapped with `ShellProvider` → renders `JourneyPageContent` 
3. Uses `useChat` from `@ai-sdk/react` (line 96)
4. Transport: `DefaultChatTransport` to `/api/journey/stream` (lines 86-93)
5. Automatic resubmit when: tool calls complete OR approvals received (lines 98-100)

**Key State**:
- `messages` — UIMessage[] from useChat
- `onboardingState` — persisted to localStorage, synced to Supabase
- `pendingAskUser` — tracks askUser tool waiting for chip/text response (lines 185-206)
- `hasPendingApproval` — blocks input while tools await approval (lines 208-222)
- `transportBody` — includes `resumeState` when resuming previous sessions (line 90)

**Research Integration**:
- Realtime Supabase subscription (lines 138-178) receives async research results
- When section completes, synthetic message injected with `tool-{toolName}` part (lines 148-156)
- `onAllSectionsComplete` → auto-sends prompt "Okay — looks like the research is all in..." (lines 167-173)

**Tool Responses**:
- `askUser` → handled by `handleAskUserResponse` (lines 262-306)
  - Extracts value from chip selection or text input
  - Updates localStorage immediately
  - Calls `addToolOutput({ tool: 'askUser', toolCallId, output })` to trigger SDK's `sendAutomaticallyWhen`
- Other tools → auto-approved via `sendAutomaticallyWhen` when `lastAssistantMessageIsCompleteWithToolCalls` fires

---

### 2. Lead Agent Endpoint (Server-Side Streaming)
**File**: `/Users/ammar/Dev-Projects/AI-GOS-main/src/app/api/journey/stream/route.ts`

**Pattern**: POST → `streamText()` → `toUIMessageStreamResponse()`

**Key Mechanics**:
1. Auth check (lines 48-54)
2. Sanitize incomplete tool parts (lines 75-100)
   - Strips `input-streaming`, `input-available`, `approval-requested` states
   - Prevents `MissingToolResultsError` in `convertToModelMessages`
3. Per-request intelligence injection (lines 148-179):
   - **Stage 1**: Onboarding phase (normal askUser flow)
   - **Stage 2**: Competitor detection (injects `competitorFastHits` directive)
   - **Strategist Mode**: After synthesis completes (blocks `askUser` + research calls)
4. Tool registration (lines 187-200) — 7 research tools + 3 onboarding tools
5. Streaming response via `toUIMessageStreamResponse()` (line 216)

**System Prompt Augmentation**:
- Base: `LEAD_AGENT_SYSTEM_PROMPT` (imported)
- Stage 2: Competitor directive injected if new competitor mentioned in last user message
- Strategist: Guard rules injected if `journeySnap.synthComplete === true`
- Resume: Context injected if `body.resumeState` provided (lines 139-146)

**Timeout**: `maxDuration = 300` (Vercel Pro only)

**Fire-and-Forget Persistence**:
- `extractAskUserResults()` → `persistToSupabase()` (async, not awaited)
- `extractResearchOutputs()` → `persistResearchToSupabase()` (async, not awaited)
- Failures logged but don't block response (lines 117-136)

---

### 3. Chat Agent (Blueprint Editing, Streaming)
**File**: `/Users/ammar/Dev-Projects/AI-GOS-main/src/components/chat/agent-chat.tsx`

**Flow**:
1. `useChat` with `DefaultChatTransport` to `/api/chat/agent` (lines 142-185)
2. Auto-resubmit: `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses`
3. Message rendering via `renderMessageParts()` (lines 534-846)

**Tool State Machine**:
```
input-streaming → input-available → [approval-requested or output-available] → output-available/error
```

**Thinking Block Parsing**:
- Extracts `<think>...</think>` blocks from text (lines 78-101)
- Renders via `ThinkingBlock` component (imported)
- Also handles `reasoning` parts from SDK (lines 576-590)

**Edit Approval Flow**:
- `editBlueprint` tool → approval card (lines 631-672)
- User clicks approve → `handleApproveEdit()` (lines 274-318)
- Applies edit to `blueprintRef.current` → records in `useEditHistory` → calls `onBlueprintUpdate()`
- Sends approval via `addToolApprovalResponse({ id, approved: true })`

**Auto-Apply Section Rewrites**:
- `generateSection` tool with `output-available` state (lines 396-436)
- If output differs from current, applies automatically via edit history
- Tracked in `appliedSectionsRef` to prevent duplicates

---

## Message Structure (UIMessage)

```typescript
interface UIMessage {
  id: string;
  role: 'user' | 'assistant';
  content?: string;  // Legacy, not used in V2
  parts: Array<TextPart | ToolPart | ReasoningPart>;
  createdAt: Date;
}

type TextPart = { type: 'text'; text: string }
type ReasoningPart = { type: 'reasoning'; text?: string; state?: 'streaming' | 'done' }
type ToolPart = {
  type: `tool-${toolName}`;
  toolName?: string;
  toolCallId: string;
  state: 'input-streaming' | 'input-available' | 'approval-requested' 
       | 'approval-responded' | 'output-available' | 'output-error' | 'output-denied';
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  errorText?: string;
  approval?: { id?: string };
}
```

---

## Component Hierarchy

### Journey Page (src/app/journey/page.tsx)
```
<ShellProvider>
  <JourneyPageContent>
    <AppShell sidebar={<AppSidebar />}>
      [WelcomeState | ChatContent]
        ├ JourneyChatInput
        ├ ChatMessage (one per message)
        │  ├ ResearchInlineCard (for research inline sections)
        │  ├ AskUserCard (chips for onboarding)
        │  └ ThinkingBlock
        ├ ResearchProgressCard
        ├ ResumePrompt
        └ ProfileCard
```

### Chat Agent (src/components/chat/agent-chat.tsx)
```
<AgentChat>
  ├ Toolbar (undo/redo/export)
  ├ Messages Area
  │  ├ MessageBubble (text)
  │  ├ ThinkingBlock (reasoning)
  │  ├ EditApprovalCard (tool-editBlueprint)
  │  ├ GenerateSectionCard (tool-generateSection)
  │  ├ ResearchResultCard (tool-webResearch)
  │  ├ DeepResearchCard (tool-deepResearch)
  │  ├ ComparisonTableCard (tool-compareCompetitors)
  │  ├ AnalysisScoreCard (tool-analyzeMetrics)
  │  ├ VisualizationCard (tool-createVisualization)
  │  └ BranchIndicator (fork points)
  └ ChatInput
```

---

## Key Differences: Journey vs Chat Agent

| Aspect | Journey | Chat Agent |
|--------|---------|-----------|
| **Entry** | `/app/journey/page.tsx` | Blueprint detail page |
| **API** | `/api/journey/stream` | `/api/chat/agent` |
| **Primary Goal** | Onboarding + research dispatch | Blueprint refinement |
| **Tool Set** | askUser, 7 research tools | searchBlueprint, editBlueprint, etc. |
| **Auto-Submit** | Tool calls + approvals | Approvals only |
| **Research** | Via Railway worker (async) | Inline (synchronous) |
| **Edit History** | None | Full undo/redo with branching |
| **Persistence** | localStorage + Supabase | Supabase conversations table |

---

## Transport & Message Conversion

**Critical Pattern** (from CLAUDE.md):
- `toUIMessageStreamResponse()` requires `DefaultChatTransport` on frontend
- `convertToModelMessages()` is async — **must be awaited**
- **MUST sanitize incomplete tool parts before `convertToModelMessages()`** — it throws `MissingToolResultsError` if tool calls lack results

**Sanitization Logic** (route.ts lines 75-100):
```typescript
const INCOMPLETE_TOOL_STATES = new Set([
  'input-streaming',
  'input-available',
  'approval-requested',
]);

const sanitizedMessages = body.messages.map((msg) => ({
  ...msg,
  parts: msg.parts.filter((part) => {
    if (part.type.startsWith('tool-') && part.type !== 'tool-invocation') {
      if (INCOMPLETE_TOOL_STATES.has(part.state)) {
        return false; // Drop incomplete
      }
    }
    return true;
  }),
}))
```

---

## Streaming & Server Sent Events

**Pattern**: Backend uses Vercel AI SDK's `toUIMessageStreamResponse()`, which:
1. Streams `part` events incrementally as model generates
2. Each part is a JSON line (newline-delimited)
3. Frontend `useChat` reconstructs `messages` array in real-time

**Timeline of a Typical Turn**:
1. User sends message
2. `sendMessage({ text: '...' })` → POST to `/api/journey/stream`
3. Backend sanitizes, injects intelligence, calls `streamText()`
4. Model starts streaming back tool calls + text
5. Frontend receives `part` events, reconstructs messages
6. First tool part arrives → `parts` array gets `{ type: 'tool-...', state: 'input-streaming' }`
7. Model finishes tool spec → state becomes `input-available`
8. Frontend checks `sendAutomaticallyWhen()` — if true, SDK auto-completes the tool call
9. Backend receives completed message in next request, tool executes
10. Model streams `output-available` part back with result

---

## Session Persistence

**Journey Session** (localStorage + Supabase):
- `src/lib/storage/local-storage.ts` → `getJourneySession()`, `setJourneySession()`
- Shape: `OnboardingState` with fields like `companyName`, `targetICP`, etc.
- Synced to `journey_sessions` table in Supabase
- Scope: Per user (via Clerk `userId`)

**Chat Conversation** (Supabase only):
- `src/lib/journey/use-chat-persistence.ts` → saves `messages` array
- Scope: Per blueprint + conversation ID
- No local caching

---

## Realtime Research Updates (Journey Only)

**Flow**:
1. Lead agent calls `researchIndustry()` (or others) → dispatches to Railway worker
2. Worker writes `{ status: 'running' }` to `journey_sessions.job_status` before returning 202
3. Frontend runs `useResearchRealtime()` hook (line 138-178)
4. Supabase Realtime subscription listens for `research_results` JSON updates
5. When section completes, hook calls `onSectionComplete()` (line 141-166)
6. `onSectionComplete()` injects synthetic message with `tool-{toolName}, state: 'output-available'`
7. After all 4 sections complete, hook calls `onAllSectionsComplete()` → auto-sends prompt

**Timeout**: Hook monitors for stale research (configurable, ~5-10 mins typically)

---

## Thinking Blocks (Adaptive Reasoning)

**Enable**: `thinking: { type: 'enabled', budgetTokens: 5000 }` in route.ts line 204

**Streaming**:
- Model emits reasoning as text within tags: `<think>...</think>`
- Also emits `reasoning` parts directly (SDK feature)

**Rendering**:
- `parseThinkingBlocks()` extracts `<think>` tags → renders as `ThinkingBlock`
- `reasoning` parts render directly via `ThinkingBlock` component
- `ThinkingBlock` auto-opens on streaming, can be toggled closed

---

## Authentication & Scope

**Journey**:
- Clerk auth check in route (line 48-54)
- Scope: `userId` from Clerk session
- Supabase RLS: user_id = authenticated.uid

**Chat Agent**:
- Same Clerk check
- Scope: `blueprintId` + `userId`
- Supabase RLS: user_id = authenticated.uid + blueprint ownership check

---

## Error Handling

**In useChat Hook** (both journey.tsx and agent-chat.tsx):
```typescript
onError: (err) => {
  if (err?.message?.includes('Tool result is missing')) {
    // MissingToolResultsError — strip last assistant message
    setMessages((prev) => {
      const cleaned = [...prev];
      for (let i = cleaned.length - 1; i >= 0; i--) {
        if (cleaned[i].role === 'assistant') {
          cleaned.splice(i, 1);
          break;
        }
      }
      return cleaned;
    });
  }
}
```

This allows users to retry after a tool call gets orphaned (incomplete parts stranded without results).
