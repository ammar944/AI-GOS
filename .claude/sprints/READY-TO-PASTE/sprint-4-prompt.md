# Copy everything below this line and paste into Claude Code
# ─────────────────────────────────────────────────────────

Think hard about this task. You are executing Sprint 4 — the final sprint of the Egoos AI agent upgrade. Sprints 1-2 built tools and cards, Sprint 2.5 migrated to 340px Figma AI layout, Sprint 3 added visualization, streaming UX, follow-ups, and persistence. We now have the full 340px layout, 9 tools, rich inline cards, follow-up suggestions, and all existing features preserved (voice, inline edits, approve all, continue, undo).

**CRITICAL**: This is the final polish sprint. Everything must work seamlessly. The chat agent must feel like a premium, world-class AI assistant that's deeply integrated with the blueprint document. No broken features, no rough edges.

## Step 0 — Read All Context Files

1. `@CLAUDE.md` — Project conventions
2. `@.claude/sprints/SPRINT-4-DIFFERENTIATION.md` — **THIS IS YOUR SPRINT. Read every line.**
3. `@EGOOS-AGENT-UI-SPEC.md` — UI spec for reference

Then read existing code you'll extend:

4. `@src/components/chat/agent-chat.tsx` — Main chat component (post Sprint 1-3)
5. `@src/components/chat/chat-input.tsx` — Chat input (verify voice button present)
6. `@src/components/chat/deep-research-card.tsx` — Has citation markers to wire up
7. `@src/components/chat/edit-approval-card.tsx` — Edit approval (Y/N shortcuts target)
8. `@src/components/chat/generate-section-card.tsx` — Section generation approval
9. `@src/components/chat/voice-input-button.tsx` — Voice input (must stay working)
10. `@src/components/chat/voice-transcript-preview.tsx` — Voice preview (must stay working)
11. `@src/components/chat/view-in-blueprint-button.tsx` — Blueprint navigation (must stay working)
12. `@src/components/chat/index.ts` — Chat exports
13. `@src/lib/chat/persistence.ts` — Conversation storage (extend for branches)
14. `@src/hooks/use-edit-history.ts` — Edit undo/redo (wire to Cmd+Z)
15. `@src/components/strategic-research/section-nav.tsx` — Approve All / Continue buttons
16. `@src/components/strategic-research/blueprint-document.tsx` — Blueprint doc with edit highlights
17. `@src/components/layout/two-column-layout.tsx` — Layout (should be 340px now)
18. `@src/app/generate/_components/blueprint-review-view.tsx` — Page wrapper

Check for Radix primitives:
19. Run: `ls src/components/ui/` to see which shadcn/Radix components exist

## Step 1 — Plan

Enter plan mode. Investigate:

### Feature Integration Check
Before adding new features, verify ALL existing features work end-to-end:
- [ ] Chat panel is 340px with no separate header
- [ ] Voice input button present and functional
- [ ] Edit approval cards show approve/reject buttons
- [ ] generateSection cards show approve/reject
- [ ] "View in blueprint" button scrolls to correct section
- [ ] Blueprint Approve All / Continue / Undo work
- [ ] Edit history undo/redo works
- [ ] All 9 tool cards render within 340px
- [ ] Follow-up suggestions appear after AI responses
- [ ] Thinking blocks collapsible
- [ ] Slash commands work (/, /research, /edit, /compare, /analyze, /visualize)
- [ ] Streaming cursor visible during AI responses

### New Features to Add
- Conversation branching
- Citation hover cards
- Chat export (markdown/PDF)
- Keyboard shortcuts (including Y/N for approvals, Cmd+Z for undo)

## Step 2 — Execute with 4 Parallel Subagents

**Subagent A (worktree)** — Conversation Branching
- Create `src/lib/chat/branching.ts`:
  - `BranchState`: `{ mainThread: UIMessage[], branches: ConversationBranch[], activeBranchId: string | null }`
  - `createBranch(fromMessageId, label?)` — fork messages up to that point
  - `switchBranch(branchId | null)` — switch active branch
  - `getBranchMessages(state)` — return messages for current branch
  - `deleteBranch(branchId)` — remove a branch
- Create `src/components/chat/branch-indicator.tsx`:
  - Shows at branch points in message list
  - Tabs/pills to switch: "Main" / "Strategy A" / "Strategy B"
  - "Branch from here" button on AI message hover
  - Branch colors cycle: `[accent-blue, accent-purple, accent-cyan, accent-amber]`
- Extend `src/lib/chat/persistence.ts` to store branches

**Subagent B (worktree)** — Citation Hover Cards + Research Polish
- Create `src/components/chat/citation-hover-card.tsx`:
  - Use Radix `HoverCard` or `Popover` (check what's available)
  - Trigger: hovering `.citation-inline` spans in research cards
  - Content: source title, domain + favicon, snippet, external link
  - Container: `border-radius: 10px; bg-elevated; max-width: 280px`
- Update `src/components/chat/deep-research-card.tsx`:
  - Wrap citation `<span>` with `<CitationHoverCard>`
  - Map citation numbers to source URLs
- Update `src/components/chat/research-result-card.tsx`:
  - Add citation hover support here too if it has inline citations

**Subagent C (worktree)** — Export + Blueprint Integration Verification
- Create `src/lib/chat/export.ts`:
  - `exportToMarkdown(messages, metadata)` → formatted markdown
  - `exportToPDF(messages, metadata)` → PDF generation
  - Handle all tool result types (research, edits, comparisons, scores, charts)
  - Include metadata: blueprint name, date, model, title
- Create `src/components/chat/export-menu.tsx`:
  - Dropdown using Radix `DropdownMenu`
  - Options: Markdown / PDF / Copy All
  - Small icon button, placed in chat area (near input or top)
- **ALSO: Full blueprint integration test** — trace the entire flow:
  1. User asks agent to edit a section
  2. Agent calls editBlueprint tool
  3. Edit approval card renders with approve/reject
  4. User approves → edit applied to blueprint via `applyEdits()`
  5. `onBlueprintUpdate` fires → blueprint document re-renders
  6. "View in blueprint" button scrolls to edited section
  7. Section highlights with AI-enhanced indicator
  8. Undo reverses the edit
  - Fix any broken links in this chain

**Subagent D (worktree)** — Keyboard Shortcuts + Final Polish
- Create `src/hooks/use-chat-shortcuts.ts`:
  - `Cmd/Ctrl + K` → Focus input + open slash palette
  - `Cmd/Ctrl + Enter` → Send message
  - `Escape` → Close slash palette / stop streaming
  - `Y` → Approve pending edit (when edit/section card visible, input NOT focused)
  - `N` → Reject pending edit
  - `Cmd/Ctrl + Z` → Undo last edit (wire to `useEditHistory`)
  - `Cmd/Ctrl + Shift + Z` → Redo
  - `Cmd/Ctrl + /` → Show shortcuts help
  - `/` (input not focused) → Focus input with slash
  - Detect Mac vs Windows for proper modifier key display
  - Respect focus: don't fire Y/N/shortcuts when typing in textarea
- Create `src/components/chat/shortcuts-help.tsx`:
  - Modal using Radix `Dialog`
  - Two-column: action name + `<kbd>` shortcut
  - Close on Escape or backdrop click
- **Final CSS polish pass**:
  - Verify all cards have proper border-radius, shadows, hover states
  - Verify streaming cursor blinks correctly
  - Verify follow-up chips have hover states
  - Verify voice button matches new input design
  - Check dark mode contrast ratios

## Step 3 — Integration & Full System Verification (Main Agent)

After all subagents complete:

1. Wire branching into `agent-chat.tsx`
2. Wire citation hover cards into research/result cards
3. Wire export menu into chat UI
4. Wire keyboard shortcuts hook into `agent-chat.tsx`

### FINAL FEATURE CHECKLIST — Every single one must work:

**Chat Core:**
- [ ] Messages send and stream correctly
- [ ] Streaming cursor visible at end of AI text
- [ ] Thinking blocks render and collapse
- [ ] Follow-up suggestions appear after AI messages
- [ ] Slash commands open palette and trigger tools
- [ ] Voice input captures audio and sends transcript
- [ ] Voice transcript preview shows before sending

**Tool Cards (all 9):**
- [ ] searchBlueprint → shows source section reference
- [ ] editBlueprint → edit approval card with approve/reject/diff
- [ ] explainBlueprint → explanation with evidence
- [ ] webResearch → research result card with sources
- [ ] deepResearch → research card with phases, findings, citations, source chips
- [ ] generateSection → section preview with approve/reject
- [ ] compareCompetitors → comparison table (scrollable if wide)
- [ ] analyzeMetrics → score card with animated bars
- [ ] createVisualization → Recharts chart card

**Blueprint Integration:**
- [ ] Edit approved → blueprint document updates in real-time
- [ ] "View in blueprint" scrolls to correct section
- [ ] AI-enhanced sections highlighted in document
- [ ] Edit undo/redo works (Cmd+Z / Cmd+Shift+Z)
- [ ] Section nav Approve All button works
- [ ] Section nav Continue button works
- [ ] Section nav Undo Approve All works
- [ ] BlueprintEditProvider context connects chat ↔ document

**New Sprint 4 Features:**
- [ ] Branching: create, switch, delete branches
- [ ] Citations: hover shows source popover
- [ ] Export: Markdown and PDF download
- [ ] Keyboard shortcuts: Y/N approve, Cmd+K focus, Cmd+/ help
- [ ] Shortcuts help modal opens and lists all shortcuts

**Layout:**
- [ ] Chat panel is 340px
- [ ] Blueprint takes remaining space (flex-1)
- [ ] All cards fit within 340px, no overflow
- [ ] Mobile: floating FAB, full-screen chat overlay
- [ ] Blueprint toolbar (Document | Outline | History) renders

## Step 4 — Final Verification

```bash
npm run build
npm run lint
npm run test:run
```

All must pass. Then review:
- No TypeScript errors
- No console warnings
- No unused imports
- All barrel exports updated

## Key Rules

- **ZERO REGRESSIONS** — every existing feature must still work after this sprint
- Use existing Radix/shadcn primitives — DON'T install new UI libraries
- Run `ls src/components/ui/` first to see what's available
- Branches stored in same Supabase table (extend schema)
- Export handles ALL tool result types
- Keyboard shortcuts detect Mac/Windows
- Voice input, edit approval, blueprint Approve All, Continue are NON-NEGOTIABLE
- All styling via CSS variables, cn() utility, named exports, kebab-case files
- This is the FINAL sprint — ship quality. Every detail matters.
