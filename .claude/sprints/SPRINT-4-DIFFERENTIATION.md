# Sprint 4 — Differentiation: Branching, Citations, Export, Keyboard Shortcuts

## Context

Sprints 1-3 are complete. The agent has the new layout, 9 tools with rich inline cards, polished streaming UX, follow-up suggestions, visualization rendering, and conversation persistence. Now we add the features that make Egoos truly differentiated: conversation branching, inline citations with hover cards, export capabilities, and comprehensive keyboard shortcuts.

**Read these files first:**
- `@CLAUDE.md` — project conventions
- `@EGOOS-AGENT-UI-SPEC.md` — UI specification
- `@src/components/chat/agent-chat.tsx` — main chat component (post Sprint 1-3)
- `@src/components/chat/deep-research-card.tsx` — has citation markers to enhance
- `@src/lib/chat/persistence.ts` — conversation storage (post Sprint 3)

## Objective

Add conversation branching (explore alternative strategies), inline citation hover cards, chat export (PDF/Markdown), and keyboard shortcuts for power users. This sprint makes Egoos feel like a premium, professional-grade tool.

## Orchestration Plan — Parallel Subagents

### Subagent A — Conversation Branching (worktree isolation)

**Files to create:**
- `src/lib/chat/branching.ts` — Branch state management
- `src/components/chat/branch-indicator.tsx` — Visual branch point markers

**`branching.ts` specification:**
- Data model:
  ```typescript
  interface ConversationBranch {
    id: string;
    parentMessageId: string; // message where branch was created
    messages: UIMessage[];    // messages in this branch
    label?: string;           // user-assigned label
    createdAt: Date;
  }

  interface BranchState {
    mainThread: UIMessage[];
    branches: ConversationBranch[];
    activeBranchId: string | null; // null = main thread
  }
  ```
- Functions:
  - `createBranch(fromMessageId, label?)` — fork from a specific message
  - `switchBranch(branchId | null)` — switch between branches (null = main)
  - `deleteBranch(branchId)` — remove a branch
  - `getBranchMessages(state)` — returns messages for current active branch
- Store branch state alongside conversation in Supabase persistence (extend the schema)

**`branch-indicator.tsx` specification:**
- Shows at branch points in the message list
- Small indicator: "Branch: Strategy A" / "Branch: Strategy B" with colored dot
- Click to switch branches
- "New branch" button on hover over any AI message
- Styling: `font-size: 11px; color: var(--text-tertiary); background: var(--bg-hover); border-radius: 6px; padding: 3px 8px`
- Branch dot colors: cycle through `[accent-blue, accent-purple, accent-cyan, accent-amber]`
- Props: `branches: ConversationBranch[]`, `activeBranch: string | null`, `onSwitch: (id) => void`, `onCreate: () => void`

**Update `@src/components/chat/agent-chat.tsx`:**
- Integrate branch state management
- Show branch indicator at fork points
- "Branch from here" option on right-click / long-press on AI messages

### Subagent B — Inline Citations with Hover Cards (worktree isolation)

**Files to create:**
- `src/components/chat/citation-hover-card.tsx` — Popover on citation hover

**Files to modify:**
- `@src/components/chat/deep-research-card.tsx` — Wire citations to hover cards

**`citation-hover-card.tsx` specification:**
- Triggered when hovering over a `.citation-inline` marker in any card
- Popover appears above the citation marker
- Content: Source title (13px/600), domain with favicon (11px, tertiary), snippet/description (12px, secondary), link icon
- Container: `border-radius: 10px; background: var(--bg-elevated); border: 1px solid var(--border-default); box-shadow: var(--shadow-elevated); padding: 12px; max-width: 280px`
- Arrow pointing down toward the citation marker
- Use Radix `HoverCard` or `Popover` primitive (already available via shadcn)
- Animate: fade in 0.15s
- Props: `source: { title: string, domain: string, url: string, snippet?: string }`, `children: React.ReactNode` (the citation marker)

**Update citation markers in deep-research-card:**
- Wrap each `.citation-inline` span with `<CitationHoverCard source={...}>` component
- Map citation numbers to source data from the research result

### Subagent C — Export Chat (worktree isolation)

**Files to create:**
- `src/lib/chat/export.ts` — Export conversation to Markdown or PDF
- `src/components/chat/export-menu.tsx` — Export dropdown in chat header

**`export.ts` specification:**
- `exportToMarkdown(messages, metadata)` → returns formatted markdown string:
  ```markdown
  # Egoos Blueprint Chat — [Blueprint Title]
  *Exported [date]*

  ---

  **You:** [user message]

  **Egoos Agent:** [assistant message]

  ### Deep Research: [topic]
  [formatted research findings with citations]

  ### Edit Proposal: [section]
  [diff block]

  ---
  [sources list]
  ```
- `exportToPDF(messages, metadata)` → generates PDF using the existing PDF skill pattern or html2canvas + jsPDF
- Handle all message types: text, tool results (research, edits, comparisons, scores, charts)
- Include metadata: blueprint name, date, model used

**`export-menu.tsx` specification:**
- Dropdown button in chat header (next to mode selector)
- Icon: download/share icon, 28px
- Options: "Export as Markdown" / "Export as PDF" / "Copy all messages"
- Use Radix `DropdownMenu` primitive
- Clicking triggers the export function and downloads the file
- Props: `messages: UIMessage[]`, `blueprintTitle?: string`

### Subagent D — Keyboard Shortcuts (worktree isolation)

**Files to create:**
- `src/hooks/use-chat-shortcuts.ts` — Keyboard shortcut hook
- `src/components/chat/shortcuts-help.tsx` — Help overlay showing all shortcuts

**`use-chat-shortcuts.ts`:**
- Register global keyboard shortcuts for the chat panel:
  - `Cmd/Ctrl + K` → Focus input + open slash command palette
  - `Cmd/Ctrl + Enter` → Send message
  - `Escape` → Close slash palette / stop streaming / cancel
  - `Y` → Approve pending edit (when edit card is visible and focused)
  - `N` → Reject pending edit
  - `Cmd/Ctrl + Z` → Undo last approved edit
  - `Cmd/Ctrl + Shift + Z` → Redo
  - `Cmd/Ctrl + /` → Show keyboard shortcuts help
  - `/` (when input not focused) → Focus input with slash
- Use `useEffect` with `keydown` listener
- Clean up on unmount
- Respect focus context: don't trigger when user is typing in input (except Cmd combos)
- Return: `{ showHelp: boolean, setShowHelp: (v: boolean) => void }`

**`shortcuts-help.tsx`:**
- Modal/overlay showing all available shortcuts
- Triggered by `Cmd/Ctrl + /`
- Grid layout: action name (left) + shortcut keys (right)
- `kbd` styling matching input hint bar
- Container: centered modal, `max-width: 400px`, `background: var(--bg-elevated)`, `border-radius: 14px`, `border: 1px solid var(--border-default)`
- Click outside or Escape to close
- Props: `isOpen: boolean`, `onClose: () => void`

### Main Agent — Integration & Accessibility

After subagents complete:

1. **Wire branching** into agent-chat.tsx state management
2. **Wire citation hover cards** into all card components that show citations
3. **Wire export menu** into chat header
4. **Wire keyboard shortcuts** hook into agent-chat.tsx
5. **Accessibility pass:**
   - All buttons have `aria-label`
   - Card sections have `role="region"` with `aria-label`
   - Keyboard navigation works through messages (Tab)
   - Focus trap in slash command palette and shortcuts help modal
   - Screen reader announcements for tool loading states (`aria-live="polite"`)
   - Color contrast: verify all text meets 4.5:1 ratio against backgrounds
6. **Final integration test:**
   - `npm run build`
   - `npm run lint`
   - `npm run test:run`
7. **Manual testing checklist:**
   - Create a branch, switch between branches, delete a branch
   - Hover citations in research results → popover appears
   - Export as Markdown → file downloads with all content
   - All keyboard shortcuts work
   - Tab through chat interface with keyboard only
   - Screen reader announces tool loading states

## Success Criteria

- [ ] Can branch a conversation at any AI message
- [ ] Can switch between branches seamlessly
- [ ] Branch state persists to Supabase
- [ ] Hovering a citation shows a source popover card
- [ ] Export to Markdown produces well-formatted file
- [ ] Export to PDF produces downloadable document
- [ ] All keyboard shortcuts work (Cmd+K, Y/N, Cmd+/, etc.)
- [ ] Shortcuts help overlay shows all available shortcuts
- [ ] All interactive elements have aria-labels
- [ ] Screen reader announces tool loading states
- [ ] `npm run build` succeeds
- [ ] `npm run test:run` passes

## Files Summary

### Create
- `src/lib/chat/branching.ts`
- `src/components/chat/branch-indicator.tsx`
- `src/components/chat/citation-hover-card.tsx`
- `src/lib/chat/export.ts`
- `src/components/chat/export-menu.tsx`
- `src/hooks/use-chat-shortcuts.ts`
- `src/components/chat/shortcuts-help.tsx`

### Modify
- `src/components/chat/agent-chat.tsx`
- `src/components/chat/deep-research-card.tsx`
- `src/components/chat/index.ts`
- `src/lib/chat/persistence.ts` (extend for branches)
