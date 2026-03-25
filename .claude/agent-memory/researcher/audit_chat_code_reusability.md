---
name: Chat Code Reusability Audit
description: Comprehensive analysis of existing chat components, hooks, and patterns that can be reused vs rebuilt for a unified chat system
type: reference
---

# Chat Code Reusability Audit — COMPLETE

## Executive Summary

The codebase has **two separate chat implementations**:
1. **Old chat agent** (`/api/chat/agent`, `src/components/chat/`) — Groq-based, blueprint-focused, legacy
2. **New journey chat** (`/api/journey/stream`, `src/components/workspace/right-rail.tsx`) — Claude Opus, strategy-focused, current

**VERDICT**: ~40% of components CAN be reused as-is, ~40% need modification, ~20% must be rebuilt.

---

## Component Analysis

### ✅ REUSABLE AS-IS

#### 1. **ChatInput** (`src/components/chat/chat-input.tsx`) 
**Status**: Reuse with minimal changes (props only)

**What it does:**
- Auto-expanding textarea (min 20px, max 100px)
- Slash command palette (`/research`, `/edit`, `/compare`, `/analyze`, `/visualize`)
- Voice input integration (handles transcript insertion at cursor)
- Send/Stop buttons with loading state
- Focus styling (blue accent on focus)
- Model selector badge (currently disabled placeholder)

**Exports:**
```typescript
interface ChatInputProps {
  onSubmit: (message: string) => void;
  isLoading: boolean;
  onStop?: () => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
}
```

**Reuse**: YES — Use as-is in new chat system. Only change:
- Update `SLASH_COMMANDS` constant to match new agent's capabilities
- Adjust placeholder text per context

---

#### 2. **ThinkingBlock** (`src/components/chat/thinking-block.tsx`)
**Status**: Reuse as-is

**What it does:**
- Collapsible card with blue left border
- "Thinking for Xs" / "Thought for Xs" label with elapsed time tracking
- Auto-open while streaming, auto-close when done (unless user toggled)
- Pulsing chevron icon while streaming, static when done
- Framer Motion animations

**State machine:**
```
streaming -> [auto-open] -> done -> [auto-close if user hasn't toggled]
```

**No props or behavioral changes needed.** Drop directly into new chat.

---

#### 3. **VoiceInputButton** (`src/components/chat/voice-input-button.tsx`)
**Status**: Reuse as-is

**Exports:**
```typescript
interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  onRecordingChange: (isRecording: boolean) => void;
  stopRecordingRef?: React.MutableRefObject<(() => void) | null>;
  disabled?: boolean;
  compact?: boolean;
}
```

Used by both ChatInput and RightRail — no changes needed.

---

#### 4. **useChatShortcuts** (`src/hooks/use-chat-shortcuts.ts`)
**Status**: Reuse as-is

**Keyboard shortcuts:**
- `Cmd/Ctrl + /` — toggle help dialog
- `Escape` — stop streaming or close help
- `Cmd/Ctrl + K` — focus input + open slash palette
- `Cmd/Ctrl + Z` — undo (if canUndo)
- `Cmd/Ctrl + Shift + Z` — redo (if canRedo)
- `Y` / `N` — approve/reject pending approval (only when NOT typing)
- `/` — focus input

**Features:**
- Platform detection (`isMac()` checks userAgent)
- Safe during SSR (defaults to false)
- Guards against firing while typing in input

**Reuse**: YES — Directly applicable to new unified chat.

---

#### 5. **renderWithSubscripts** utility
**Location**: `src/components/strategic-research/citations.ts`
**Status**: Already imported by both chat components

Used for rendering citation markers like `[1]`, `[2]` in blue. Both `ChatMessage` and `MessageBubble` use it.

---

### 🟡 NEEDS MODIFICATION

#### 1. **MessageBubble** (`src/components/chat/message-bubble.tsx`)
**Status**: Refactor for unified use

**Current behavior:**
- Complex markdown rendering (headers, bold, code blocks, lists, links, citations)
- Inline formatting with regex parsing
- Diff code block highlighting (for edit proposals)
- Confidence badges (high/medium/low with color-coded tooltips)
- Source indicators with quality metrics and relevance bars
- Streaming cursor animation
- Type badges (Edit Proposal, Explanation)

**Issues for reuse:**
- Expects `SourceQuality` interface with `avgRelevance`, `sourceCount`, `highQualitySources`, `explanation`
- Expects `SourceReference[]` with `section`, `fieldPath`, `similarity`
- **Problem**: These types are specific to blueprint chat. New journey chat doesn't use them yet.

**Solution**: 
- Extract markdown rendering (`renderContent`, `renderTextContent`, `renderCodeBlock`) into `@/lib/ui/markdown-renderer.ts`
- Keep MessageBubble but make source/confidence props optional (already is)
- Create a lightweight version for journey chat that skips the source/confidence rendering

---

#### 2. **ChatMessage** (`src/components/chat/chat-message.tsx`)
**Status**: Simpler alternative to MessageBubble, can coexist

**Current behavior:**
- Simpler markdown rendering than MessageBubble
- User bubble vs assistant with different avatars
- Edit proposal / explanation badges
- Sources + related factors sections
- Confidence indicators

**Key difference**: Uses different styling (light/dark mode aware with Tailwind classes) vs MessageBubble's CSS variables.

**Verdict**: Keep both. ChatMessage is lighter for journey chat, MessageBubble is richer for blueprint chat.

---

#### 3. **useChatPersistence** (`src/hooks/use-chat-persistence.ts`)
**Status**: Can be reused, but needs schema update

**What it does:**
- Loads/saves conversations to Supabase
- Debounced saves (2s)
- Conversation list fetching
- Delete conversations
- Auto-extract title from first user message

**Current schema** (from Supabase types):
```typescript
interface ChatConversation {
  id: string;
  userId: string;
  blueprintId: string;
  title: string;
  messages: UIMessage[];
  createdAt: string;
  updatedAt: string;
}
```

**Reusability**: YES, but needs adaptation:
- New journey chat may NOT need `blueprintId` (use `sessionId` instead)
- May need a different table or schema
- Current implementation is solid — just needs parameter swaps

---

### ❌ MUST REBUILD

#### 1. **RightRail** (`src/components/workspace/right-rail.tsx`)
**Status**: Component-specific, don't reuse

**Why**: This is a full chat UI component tightly coupled to workspace context:
- Uses `useWorkspace()` to access section cards, update cards
- Implements edit approval/rejection with `pendingEdits` state
- Has section-specific system prompt injection via `DefaultChatTransport` body
- Manages local messages + remote messages merge
- Has deep research toggle specific to workspace

**What's reusable from it:**
- The message rendering pattern (but simpler than what's shown)
- Edit approval UI pattern
- Transport configuration pattern (injecting context via body)

---

#### 2. **Chat Tools** (`src/lib/ai/chat-tools/`)
**Status**: Domain-specific, reuse only patterns

**Tools implemented:**
- `searchBlueprint` — semantic search across blueprint sections
- `editBlueprint` — propose edits to blueprint fields
- `explainBlueprint` — explain scores/recommendations with evidence
- `webResearch` — live web search
- `deepResearch` — extended research
- `generateSection` — auto-generate blueprint sections
- `compareCompetitors` — compare competitors side-by-side
- `analyzeMetrics` — analyze metrics from blueprint
- `createVisualization` — generate visualizations
- `queryBlueprint` — condensed section summaries
- `deepDive` — full raw section data

**Verdict**: 
- These are **blueprint-specific**. Don't copy them.
- BUT the **pattern** is reusable: factory functions that return betaZodTool objects
- Pattern: `export function createXTool(blueprint) { return { inputSchema: z.object(...), execute: async (input) => {...} } }`

---

#### 3. **API Routes**
**Status**: Both too domain-specific, but patterns are gold

**`/api/chat/agent/route.ts`** (Groq-based, blueprint chat):
- Uses `createChatTools()` factory
- Builds system prompt with compact blueprint index
- Calls tools with blueprint context

**`/api/journey/stream/route.ts`** (Opus-based, strategy chat):
- Builds **per-request system prompt** from collected fields
- Injects Stage 2 directives (competitor detection)
- Injects Strategist Mode guard
- Complex state tracking (research completion, approvals)
- Integrated with research worker dispatch

**Verdict**: 
- Don't copy either route as-is
- **Reuse patterns**: system prompt injection, research state tracking, field collection
- For unified chat: will likely be a **NEW route** that combines patterns from both

---

## Provider Configuration

### **providers.ts** (`src/lib/ai/providers.ts`)
**Status**: Directly reusable

**Perplexity-related exports:**
```typescript
export const perplexity = createPerplexity({
  apiKey: process.env.PERPLEXITY_API_KEY,
});

export const MODELS = {
  SONAR_PRO: 'sonar-pro',
  SONAR_REASONING: 'sonar-reasoning-pro',
  // ... others
} as const;

export const GENERATION_SETTINGS = {
  research: { temperature: 0.3, maxTokens: 8192 },
  reasoning: { temperature: 0.4, maxTokens: 6144 },
  synthesis: { temperature: 0.5, maxTokens: 8192 },
  extraction: { temperature: 0.1, maxTokens: 2048 },
} as const;

export const MODEL_COSTS = { /* cost tracking */ };
export function estimateCost(model, inputTokens, outputTokens): number;
```

**Use directly**: YES. Already imported and available.

---

## Workspace Context & Types

### **WorkspaceContext** (`src/components/workspace/workspace-provider.tsx`)
**Status**: Domain-specific, but context pattern is reusable

**Available actions:**
```typescript
interface WorkspaceActions {
  state: WorkspaceState;
  setSectionPhase(section, phase, error?);
  setCards(section, cards);
  updateCard(cardId, content, editedBy);
  approveCard(cardId);
  approveSection();
  restoreCardVersion(cardId, versionIndex);
  navigateToSection(section);
}
```

**Verdict**: The **card management pattern** is solid, but don't reuse the context directly. For unified chat, may need a simpler context or Redux-style reducer.

---

### **Types** (`src/lib/workspace/types.ts`)
**Status**: Reusable with possible extensions

```typescript
export type SectionKey = 'industryMarket' | 'competitors' | 'icpValidation' | 
  'offerAnalysis' | 'keywordIntel' | 'crossAnalysis' | 'mediaPlan';

export type SectionPhase = 'queued' | 'researching' | 'streaming' | 'review' | 'approved' | 'error';

export interface CardState {
  id: string;
  sectionKey: SectionKey;
  cardType: string;
  label: string;
  content: Record<string, unknown>;
  status: 'draft' | 'edited' | 'approved';
  versions: CardSnapshot[];
}
```

**Reusability**: YES for workspace, but new unified chat may not need `CardState` at all — might just track messages.

---

## Summary Table

| Component | Reusable? | Effort | Notes |
|-----------|-----------|--------|-------|
| ChatInput | ✅ YES | Minimal | Update SLASH_COMMANDS only |
| ThinkingBlock | ✅ YES | None | Use as-is |
| VoiceInputButton | ✅ YES | None | Use as-is |
| useChatShortcuts | ✅ YES | None | Use as-is |
| MessageBubble | 🟡 PARTIAL | Medium | Extract markdown renderer, make source/confidence optional |
| ChatMessage | ✅ YES | Minimal | Already simpler; keep for journey chat |
| useChatPersistence | 🟡 PARTIAL | Medium | Needs schema/table update for new chat |
| RightRail | ❌ NO | High | Too workspace-specific; use as reference only |
| Chat Tools | ❌ NO | N/A | Blueprint-specific; reuse **patterns** only |
| /api/chat/agent | ❌ NO | High | Use patterns, not code |
| /api/journey/stream | ❌ NO | High | Use patterns, not code |
| providers.ts | ✅ YES | None | Use directly |
| WorkspaceContext | ❌ NO | N/A | Too specialized; reference only |
| Types (workspace) | 🟡 PARTIAL | Low | Keep for workspace, may not need for chat |

---

## Key Reusable Patterns

1. **Message rendering with markdown** — Extract to utility, reuse
2. **Voice input + transcript insertion** — Already standalone, reuse
3. **Keyboard shortcuts** — Already standalone, reuse
4. **Tool factory pattern** — Use for creating new tools
5. **System prompt injection via transport body** — Use for context passing
6. **Edit approval state management** — Pattern works, adapt for new chat
7. **Debounced persistence** — Reuse useChatPersistence with schema tweaks
8. **Streaming state tracking** — Pattern works across both chats

---

## Files to Read for Integration

**Priority 1 (Must understand):**
1. `src/components/chat/chat-input.tsx` — Input UI
2. `src/components/chat/thinking-block.tsx` — Thinking visualization
3. `src/hooks/use-chat-shortcuts.ts` — Keyboard handling
4. `src/lib/ai/providers.ts` — Model config

**Priority 2 (Reference patterns):**
1. `src/app/api/journey/stream/route.ts` — System prompt injection, state tracking
2. `src/components/workspace/right-rail.tsx` — Edit approval pattern
3. `src/lib/ai/chat-tools/index.ts` — Tool factory pattern

**Priority 3 (Optional, background):**
1. `src/hooks/use-chat-persistence.ts` — Persistence pattern
2. `src/components/workspace/workspace-provider.tsx` — Card state management
