# Copy everything below this line and paste into Claude Code
# ─────────────────────────────────────────────────────────

Think hard about this task. You are executing Sprint 3 of the Egoos (AI-GOS) chat agent upgrade. Sprints 1-2 are complete (tools, cards, agent route), and Sprint 2.5 migrated the layout to the 340px Figma AI-inspired design. We now have the narrow chat panel, model selector in input, no mode header, blueprint toolbar, and all 8 tools working.

**CRITICAL PRIORITY**: The chat agent must work SEAMLESSLY with the full blueprint document. Every existing feature must be preserved and polished. This is NOT just about adding new features — it's about making the whole experience feel cohesive and production-ready.

## Step 0 — Read All Context Files

1. `@CLAUDE.md` — Project conventions, commands, tech stack
2. `@.claude/sprints/SPRINT-3-POLISH.md` — **THIS IS YOUR SPRINT. Read every line.**
3. `@EGOOS-AGENT-UI-SPEC.md` — UI spec (Figma AI-inspired 340px layout)
4. `@EGOOS-CHAT-AGENT-V2.html` — V2 HTML preview (340px chat, inline artifacts, model selector)

Then read ALL existing code to understand the full integration surface:

5. `@src/components/chat/agent-chat.tsx` — Main chat (660 lines, handles all tool rendering, edit approval, blueprint updates)
6. `@src/components/chat/chat-input.tsx` — Current input
7. `@src/components/chat/message-bubble.tsx` — Current messages
8. `@src/components/chat/tool-loading-indicator.tsx` — Current loading
9. `@src/components/chat/quick-suggestions.tsx` — Current suggestions
10. `@src/components/chat/voice-input-button.tsx` — Voice input (MUST PRESERVE)
11. `@src/components/chat/voice-transcript-preview.tsx` — Voice preview (MUST PRESERVE)
12. `@src/components/chat/edit-approval-card.tsx` — Edit approval flow (MUST PRESERVE)
13. `@src/components/chat/edit-diff-view.tsx` — Diff rendering (MUST PRESERVE)
14. `@src/components/chat/view-in-blueprint-button.tsx` — "View in blueprint" nav (MUST PRESERVE)
15. `@src/components/chat/slash-command-palette.tsx` — Slash commands
16. `@src/components/chat/thinking-block.tsx` — Thinking blocks
17. `@src/components/chat/deep-research-card.tsx` — Research card
18. `@src/components/chat/generate-section-card.tsx` — Section generation with approval
19. `@src/components/chat/comparison-table-card.tsx` — Comparison tables
20. `@src/components/chat/analysis-score-card.tsx` — Score cards
21. `@src/components/chat/research-result-card.tsx` — Web research results
22. `@src/components/chat/index.ts` — Chat barrel exports
23. `@src/components/layout/two-column-layout.tsx` — Layout (should be 340px after Sprint 2.5)
24. `@src/app/generate/_components/blueprint-review-view.tsx` — Page wrapper
25. `@src/components/strategic-research/blueprint-document.tsx` — Blueprint document component
26. `@src/components/strategic-research/section-nav.tsx` — Section nav with Approve All / Continue
27. `@src/components/strategic-research/review.tsx` — Review component
28. `@src/lib/ai/chat-tools/index.ts` — Tools barrel + createChatTools factory
29. `@src/hooks/use-edit-history.ts` — Edit undo/redo hook
30. `@src/app/api/chat/agent/route.ts` — Agent route (281 lines)
31. `@src/app/globals.css` — CSS variables and animations

## Step 1 — Plan

Enter plan mode. Investigate thoroughly:

### Layout Verification (Sprint 2.5 should have done this)
- Verify chat panel is 340px (not 440px)
- Verify no mode selector header (removed in 2.5)
- Verify blueprint toolbar exists with Document|Outline|History tabs
- Verify all cards fit within 340px without overflow
- If ANY of the above are missing, fix them FIRST before proceeding

### Existing Features Audit
Check that ALL of these still work after your changes:
- [ ] Voice input button in chat input
- [ ] Voice transcript preview
- [ ] Edit approval flow (approve/reject individual edits)
- [ ] Edit diff rendering (red/green diff view)
- [ ] "View in blueprint" button that scrolls to the edited section
- [ ] Blueprint document: Approve All button in section nav
- [ ] Blueprint document: Continue button
- [ ] Blueprint document: Undo Approve All
- [ ] Edit history (undo/redo)
- [ ] Thinking blocks (collapsible)
- [ ] All 8 tool result cards render correctly
- [ ] generateSection approval flow (approve → applies to blueprint)
- [ ] Quick suggestions on empty chat
- [ ] Blueprint edit context (highlights edited sections in document)

### New Features
- Visualization tool + chart card
- Streaming UX improvements (research progress, streaming cursor)
- Contextual follow-up suggestions after each AI response
- Conversation persistence (Supabase)
- Mobile responsiveness pass

## Step 2 — Execute with Parallel Subagents

**Subagent A (worktree)** — Visualization Tool + Chart Card
- Create `src/lib/ai/chat-tools/create-visualization.ts`:
  - Extracts data from blueprint sections, transforms to Recharts format
  - Supports bar charts and radar charts
  - Input: chartType, dataSource (section name), optional customData
- Create `src/components/chat/visualization-card.tsx`:
  - Inline Recharts rendering within 340px card width
  - `<ResponsiveContainer>` wrapper for all charts
  - Dark theme colors matching design tokens
- Register in `src/lib/ai/chat-tools/index.ts`
- Install Recharts if not present: `npm install recharts`

**Subagent B (worktree)** — Streaming UX + Follow-Up Suggestions
- Redesign `src/components/chat/tool-loading-indicator.tsx`:
  - Contextual card per tool type (colored icon + tool name + description)
  - Different loading UI for deepResearch (show phases progress) vs other tools
- Create `src/components/chat/research-progress-card.tsx`:
  - Live progress visualization during deep research phases
  - Status dots: done (green), active (blue pulse), pending (gray)
- Update `src/components/chat/message-bubble.tsx`:
  - Add streaming cursor (`.streaming-cursor` class — 2px blue blinking bar)
  - Smooth content entrance animation
- Redesign `src/components/chat/quick-suggestions.tsx` → `follow-up-suggestions.tsx`:
  - Contextual chips after EVERY AI response based on last tool used
  - After deepResearch: "Update blueprint with findings", "Research deeper", "Compare competitors"
  - After editBlueprint/generateSection: "Approve and continue", "Modify the edit", "Explain this change"
  - After analyzeMetrics: "Fix weakest dimension", "Rewrite section", "Compare to competitor"
  - Default: "Summarize insights", "What should I improve?", "Generate ad hooks"
  - Show 2-3 quick suggestions at chat start too (empty state)
  - Staggered fadeUp animation (100ms delay per chip)

**Subagent C (worktree)** — Conversation Persistence
- Create `src/lib/chat/persistence.ts`:
  - Check existing Supabase client pattern in codebase first
  - Schema: conversations table with `id, user_id, blueprint_id, messages (jsonb), title, created_at, updated_at`
  - Functions: `saveConversation`, `loadConversation`, `listConversations`, `deleteConversation`
  - Auto-title generation from first user message
- Auto-save debounced (2s) on every new message
- Auto-load on mount if conversationId URL param provided

## Step 3 — Integration & Feature Verification (Main Agent)

After all subagents complete:

1. Wire visualization tool into `agent-chat.tsx` tool result rendering
2. Wire research progress card — show during deepResearch streaming, replace with full card on complete
3. Wire follow-up suggestions after each AI message, pass `onSelect` → `sendMessage()`
4. Wire persistence — load on mount, save on message changes
5. Update agent route system prompt to include `/visualize` command docs

### CRITICAL: Feature Preservation Checklist

After integration, manually verify in code that these paths still work:

- [ ] `voice-input-button.tsx` is rendered in `chat-input.tsx` and connected
- [ ] `voice-transcript-preview.tsx` renders when voice input is active
- [ ] `edit-approval-card.tsx` renders for editBlueprint tool results with approval-requested state
- [ ] `generate-section-card.tsx` renders with approve/reject for section generation
- [ ] `edit-diff-view.tsx` shows red/green diff in edit cards
- [ ] `view-in-blueprint-button.tsx` renders after approved edits and scrolls to section
- [ ] `useEditHistory()` undo/redo still connected in agent-chat.tsx
- [ ] `BlueprintEditProvider` context highlights edited sections in document
- [ ] Section nav "Approve All" button still works in blueprint document
- [ ] Section nav "Continue" button still works
- [ ] Section nav "Undo Approve All" still works
- [ ] All cards fit within 340px without horizontal overflow
- [ ] Comparison tables have `overflow-x: auto` wrapper
- [ ] Thinking blocks still collapsible
- [ ] Research card citations still clickable/hoverable

## Step 4 — Verify

```bash
npm run build
npm run lint
npm run test:run
```

All three must pass. Fix any issues.

## Key Rules

- **PRESERVE ALL EXISTING FUNCTIONALITY** — this is the #1 priority
- Use existing Supabase client pattern from codebase (don't create a new client setup)
- Recharts: use `<ResponsiveContainer>` wrapper for all charts
- CSS animations for streaming cursor already exist in `globals.css` — just apply classes
- Follow-up suggestions: must be buttons that trigger `sendMessage()` from useChat
- Persistence: use `auth()` from `@clerk/nextjs/server` for user_id in API routes
- 340px chat width — verify all components fit, no overflow
- All styling via CSS variables, cn() utility, named exports, kebab-case files
- Voice input, edit approval, blueprint integration are NON-NEGOTIABLE features
