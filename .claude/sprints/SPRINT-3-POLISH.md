# Sprint 3 — Polish: Visualizations, Streaming UX, Mobile, Persistence

## Context

Sprints 1-2 are complete. We have the new layout, redesigned input/messages, and 8 tools with rich inline cards. Now we polish the experience: add the visualization tool, improve streaming/loading UX, make mobile responsive, add follow-up suggestions, and persist conversations.

**Read these files first:**
- `@CLAUDE.md` — project conventions
- `@EGOOS-AGENT-UI-SPEC.md` — UI specification
- `@EGOOS-CHAT-AGENT-V2.html` — target preview
- `@src/components/chat/agent-chat.tsx` — current chat component (post Sprint 1-2)
- `@src/components/chat/tool-loading-indicator.tsx` — current loading indicator to redesign
- `@src/components/chat/quick-suggestions.tsx` — current suggestions to upgrade

## Objective

Add the visualization tool with inline Recharts rendering, redesign the streaming/loading experience with phase progress, upgrade quick suggestions to contextual follow-ups, ensure mobile responsiveness, and add conversation persistence to Supabase.

## Orchestration Plan — Parallel Subagents

### Subagent A — Visualization Tool + Chart Card (worktree isolation)

**Files to create:**
- `src/lib/ai/chat-tools/create-visualization.ts`
- `src/components/chat/visualization-card.tsx`

**`create-visualization.ts` specification:**
```typescript
name: 'createVisualization'
description: 'Generate chart data for visual display. Supports bar charts (competitor comparison), radar charts (score dimensions), and timeline charts (campaign phasing).'

inputSchema: z.object({
  type: z.enum(['bar', 'radar', 'timeline']).describe('Chart type'),
  title: z.string().describe('Chart title'),
  dataSource: z.string().describe('What blueprint data to visualize'),
})
```
Execute: Extract relevant data from blueprint → Transform into Recharts-compatible format → Return `{ type, title, data: [...], config: { colors, labels } }`. Pure data transformation, no API call needed.

**`visualization-card.tsx` specification:**
- Container: same card styling as other cards (12px radius, border-default, shadow-card)
- 14px padding all around
- Title: 12px/600, text-primary
- Chart area: Render a `<ResponsiveContainer>` from Recharts
  - Bar chart: `<BarChart>` with gradient fills matching accent colors, 80px height, labels below bars
  - Radar chart: `<RadarChart>` for score dimension visualizations
  - Use existing Recharts dependency (already in project)
- Animate bars/areas on mount
- Props: `data: VisualizationResult`

**Update `@src/lib/ai/chat-tools/index.ts`:** Add `createVisualization` to `createChatTools()`.
**Update `@src/components/chat/agent-chat.tsx`:** Render `<VisualizationCard>` for `createVisualization` tool results.

### Subagent B — Streaming & Loading UX Redesign (worktree isolation)

**Files to modify:**
- `@src/components/chat/tool-loading-indicator.tsx` — Complete redesign

**Files to create:**
- `src/components/chat/research-progress-card.tsx` — Live progress for deep research

**`tool-loading-indicator.tsx` redesign:**
- Current: Simple spinner + text
- New: Contextual card showing which tool is running
  - Container: `padding: 10px 12px; border-radius: 10px; background: var(--bg-hover); border: 1px solid var(--border-subtle)`
  - Left: 24px icon with spinning animation (2s linear infinite), colored by tool type
  - Right: Tool name (12px/500, secondary) + description (12px, tertiary)
  - Tool-specific messages: "Searching blueprint..." / "Proposing edits..." / "Researching 5 sub-queries..." / "Comparing competitors..." / "Scoring section..."
  - Props: `toolName: string`, `args?: Record<string, unknown>`

**`research-progress-card.tsx`:**
- Used ONLY during deep research streaming (before full results arrive)
- Shows live progress phases: Decomposing → Researching (3/5 complete) → Synthesizing
- Each phase: status dot (done/active/pending) + label + optional count
- Active phase has pulsing blue dot animation
- Transitions to `DeepResearchCard` when research completes
- Props: `phases: { name: string, status: string, count?: string }[]`

**Streaming text improvements in `@src/components/chat/message-bubble.tsx`:**
- Add the `streaming-cursor` class (2px blue bar, blink animation) at the end of streaming text
- Add `stream-content-enter` animation (opacity 0→1, translateY 2→0, 0.15s) on new text chunks
- These CSS classes already exist in `@src/app/globals.css` — just apply them

### Subagent C — Follow-Up Suggestions Upgrade (worktree isolation)

**Files to modify:**
- `@src/components/chat/quick-suggestions.tsx` — Redesign into contextual follow-ups

**New behavior:**
- Rename component to `FollowUpSuggestions` (update import in agent-chat.tsx)
- Show 2-3 contextual suggestions AFTER each AI response (not just at the start)
- Suggestions generated from the last assistant message content — parse key topics/entities
- Styling: Flex-wrap row of chips
  - `padding: 6px 11px; border-radius: 8px; font-size: 11.5px`
  - `color: var(--text-tertiary); background: var(--bg-base); border: 1px solid var(--border-subtle)`
  - Hover: `border-color: var(--accent-blue); color: var(--accent-blue); background: rgba(54,94,255,0.05)`
- Each chip is a button that sends the suggestion text as a new message
- Add entrance animation: staggered fadeUp with 100ms delay per chip
- Props: `suggestions: string[]`, `onSelect: (text: string) => void`
- Generate suggestions based on last message's tool results:
  - After deep research: ["Update blueprint with findings", "Research deeper on [topic]", "Compare top competitors"]
  - After edit proposal: ["Approve and continue", "Modify the edit", "Explain this change"]
  - After analysis: ["Fix the weakest dimension", "Rewrite this section", "Compare to competitor"]

### Subagent D — Conversation Persistence (worktree isolation)

**Files to create:**
- `src/lib/chat/persistence.ts` — Supabase conversation storage

**Specification:**
- Save conversations to Supabase table `chat_conversations`:
  ```sql
  id: uuid (PK)
  user_id: text (from Clerk auth)
  blueprint_id: text
  messages: jsonb (array of UIMessage)
  created_at: timestamptz
  updated_at: timestamptz
  title: text (auto-generated from first user message, truncated to 60 chars)
  ```
- Functions:
  - `saveConversation(userId, blueprintId, messages)` — upsert
  - `loadConversation(conversationId)` — fetch
  - `listConversations(userId, blueprintId)` — list all for a blueprint
  - `deleteConversation(conversationId)` — soft delete
- Auto-save on every new message (debounced 2 seconds)
- Load existing conversation on mount if `conversationId` prop provided

**Update `@src/components/chat/agent-chat.tsx`:**
- On mount: if `conversationId` exists, load messages from Supabase
- After each message exchange: save to Supabase (debounced)
- Add conversation title display in chat header

### Main Agent — Integration & Mobile

After subagents complete:

1. **Wire visualization tool** into the tools index and agent-chat rendering
2. **Wire research progress card** into the streaming pipeline — show it when `deepResearch` tool is in-progress, replace with full card when done
3. **Mobile responsiveness pass** on `@src/components/layout/two-column-layout.tsx`:
   - Below 1024px: blueprint full width
   - Floating chat button: `position: absolute; bottom: 16px; left: 16px; z-index: 20; 48px circle; var(--accent-blue) background`
   - Chat overlay: `position: absolute; inset: 0; z-index: 20; background: var(--bg-surface)`
   - Close button in overlay header
4. **Verify all cards render correctly at 340px width** — no overflow, tables scroll horizontally if needed
5. Run `npm run build` and `npm run test:run`

## Success Criteria

- [ ] `/visualize` produces inline Recharts rendering
- [ ] Tool loading shows contextual indicator with tool name and animation
- [ ] Deep research shows live progress phases while running
- [ ] Follow-up suggestions appear after every AI response
- [ ] Suggestions are contextual to the tool used
- [ ] Conversations persist to Supabase
- [ ] Conversations load on page revisit
- [ ] Mobile: chat overlay works with floating button
- [ ] All cards fit within 340px without overflow
- [ ] `npm run build` succeeds
- [ ] `npm run test:run` passes

## Files Summary

### Create
- `src/lib/ai/chat-tools/create-visualization.ts`
- `src/components/chat/visualization-card.tsx`
- `src/components/chat/research-progress-card.tsx`
- `src/lib/chat/persistence.ts`

### Modify
- `src/components/chat/tool-loading-indicator.tsx`
- `src/components/chat/quick-suggestions.tsx` → rename to follow-up-suggestions.tsx
- `src/components/chat/agent-chat.tsx`
- `src/components/chat/message-bubble.tsx`
- `src/components/chat/index.ts`
- `src/lib/ai/chat-tools/index.ts`
- `src/components/layout/two-column-layout.tsx` (mobile pass)
