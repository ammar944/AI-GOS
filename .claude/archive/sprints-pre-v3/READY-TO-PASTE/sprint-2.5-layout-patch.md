# Copy everything below this line and paste into Claude Code
# ─────────────────────────────────────────────────────────

Think hard about this task. This is a focused layout migration — converting the existing 440px chat panel to a 340px Figma AI-inspired layout. Sprints 1-2 are complete with all tools and cards working. We're ONLY changing the layout and input styling here, not adding new features.

**CRITICAL: Do NOT break any existing functionality.** Voice input, edit approval, thinking blocks, all 8 tool cards, slash commands, blueprint edit context — everything must keep working after this change.

## Step 0 — Read All Context Files

Read these files carefully to understand the target design:

1. `@CLAUDE.md` — Project conventions
2. `@EGOOS-AGENT-UI-SPEC.md` — Updated UI spec with 340px Figma AI layout
3. `@EGOOS-CHAT-AGENT-V2.html` — **THIS IS THE TARGET DESIGN. Read the entire CSS section carefully.** Pay special attention to: `.chat-panel` width, `.input-area`, `.input-container`, `.input-toolbar`, `.model-selector`, `.reasoning-block`, `.files-badge`, `.tool-activity` styles.

Then read the current implementation:

4. `@src/components/layout/two-column-layout.tsx` — Current layout (440px, has mode selector header — BEING CHANGED)
5. `@src/components/chat/agent-chat.tsx` — Main chat component (660 lines — check what depends on layout)
6. `@src/components/chat/chat-input.tsx` — Current input (BEING RESTYLED)
7. `@src/components/chat/slash-command-palette.tsx` — Slash commands (check positioning)
8. `@src/components/chat/message-bubble.tsx` — Messages (check width constraints)
9. `@src/components/chat/thinking-block.tsx` — Thinking blocks (check width)
10. `@src/components/chat/voice-input-button.tsx` — Voice button (MUST KEEP in new input)
11. `@src/components/chat/voice-transcript-preview.tsx` — Voice preview (MUST KEEP)
12. `@src/components/chat/deep-research-card.tsx` — Widest card (check fits 340px)
13. `@src/components/chat/comparison-table-card.tsx` — Table card (needs overflow-x: auto)
14. `@src/components/chat/analysis-score-card.tsx` — Score bars (check width)
15. `@src/components/chat/generate-section-card.tsx` — Section card with approval
16. `@src/components/chat/edit-approval-card.tsx` — Edit card with approval
17. `@src/app/generate/_components/blueprint-review-view.tsx` — Page wrapper
18. `@src/components/strategic-research/blueprint-document.tsx` — Blueprint doc
19. `@src/components/strategic-research/section-nav.tsx` — Section nav (Approve All / Continue)

## Step 1 — Plan

Enter plan mode. Map out EXACTLY what changes in each file:

### Layout Changes (`two-column-layout.tsx`):
- Chat panel width: 440px → **340px**
- **Remove** the mode selector header (Chat | Research | Edit) — modes now via slash commands
- Chat panel background: change to `#090b10` (darker, `--bg-chat` from V2 preview)
- **Add** blueprint toolbar (44px height) with Document | Outline | History tabs
- **Add** section nav dots on right edge of blueprint panel (fixed position)
- Keep minimize/expand behavior (48px icon strip)
- Keep mobile responsive (FAB + overlay)

### Input Restyling (`chat-input.tsx`):
- Container: `border-radius: 12px` (was 14px), `background: var(--bg-input)` or `#0e1017`
- **Move buttons inside container**, below textarea:
  - Left toolbar: Attach (paperclip) + Model selector ("Groq 70B ↓" in mono font)
  - Right toolbar: Stop button (shown during streaming) + Send button
- Voice input button: KEEP but move into the left toolbar area
- Remove separate hint bar below input (model selector replaces it)
- Button sizes: 28px (was 32px)
- Send button: `border-radius: 7px`

### Card Width Audit:
- All cards must fit within ~308px content width (340px - 32px padding)
- `comparison-table-card.tsx`: Add `overflow-x: auto` wrapper on table
- Score bars in `analysis-score-card.tsx`: Reduce label width if needed
- Research card sources: ensure chip row wraps properly

### CSS Variables to Add (`globals.css`):
```css
--bg-chat: #090b10;
--bg-input: #0e1017;
--chat-width: 340px; /* was 440px */
```

## Step 2 — Execute

This is a focused refactor, NOT a feature sprint. Execute sequentially (no subagents needed):

### 2a. Update CSS Variables
- Add `--bg-chat`, `--bg-input` to `globals.css`
- Update `--chat-width` to 340px if it exists as a variable

### 2b. Update Layout (`two-column-layout.tsx`)
- Change chat width to 340px
- Remove mode selector header entirely
- Update chat panel background color
- Add blueprint toolbar component (simple tab bar: Document | Outline | History — only Document active for now)
- Add section nav dots (right edge, fixed position, track active section)
- Verify mobile breakpoint still works

### 2c. Restyle Input (`chat-input.tsx`)
- Restructure to: textarea on top, toolbar row below (all inside one container)
- Left toolbar: `<VoiceInputButton />` + attach button + `<ModelSelector />` ("Groq 70B ↓")
- Right toolbar: stop button (conditional) + send button
- Match V2 preview CSS exactly: border-radius, padding, colors, sizes
- Keep all existing handlers: `onSubmit`, `onChange`, `onKeyDown`, voice callbacks
- Verify slash command palette still positions correctly above the new input

### 2d. Card Width Fixes
- `comparison-table-card.tsx`: Wrap table in `overflow-x: auto` div
- `analysis-score-card.tsx`: Set `.score-label` to `width: 65px` (was 75-90px) if it overflows
- `deep-research-card.tsx`: Verify source chips wrap, findings don't overflow
- `edit-approval-card.tsx`: Verify diff view doesn't overflow
- `generate-section-card.tsx`: Verify preview doesn't overflow

### 2e. Verify All Existing Features

After all changes, trace these flows in the code:

1. **Chat sends message** → agent-chat.tsx → route.ts → streams back → renders in message-bubble.tsx ✓
2. **Voice input** → voice-input-button.tsx captures → voice-transcript-preview.tsx shows → sends as message ✓
3. **Slash command** → type "/" → palette opens above input → select → fills input → sends ✓
4. **Edit approval** → tool returns approval-requested → edit-approval-card renders → approve/reject → applyEdits → blueprint updates ✓
5. **Generate section** → tool returns → generate-section-card renders → approve → section replaced in blueprint ✓
6. **Deep research** → tool runs → research card renders with phases/findings/sources/citations ✓
7. **Compare competitors** → comparison-table-card renders with scrollable table ✓
8. **Analyze metrics** → analysis-score-card renders with animated bars ✓
9. **Thinking block** → `<think>` tags → thinking-block.tsx renders collapsed ✓
10. **View in blueprint** → click button → scrolls to section in blueprint document ✓
11. **Blueprint Approve All** → section-nav.tsx button → applies all pending edits ✓
12. **Edit undo/redo** → useEditHistory hook → reverses/re-applies edits ✓

## Step 3 — Verify

```bash
npm run build
npm run lint
npm run test:run
```

All three must pass. Then:

- [ ] No TypeScript errors
- [ ] Chat panel visually measures ~340px in dev tools
- [ ] No horizontal overflow on any card
- [ ] Model selector shows "Groq 70B" with down chevron
- [ ] Voice button visible in input toolbar
- [ ] Send button is blue, 28px
- [ ] Slash palette opens above new input correctly
- [ ] Blueprint has full remaining width
- [ ] Mobile FAB and overlay still work

## Key Rules

- **ZERO feature regressions** — this is layout-only
- Match `EGOOS-CHAT-AGENT-V2.html` CSS as closely as possible
- Use `cn()` for all className merging
- Use CSS variables (not hardcoded hex)
- Keep all existing props interfaces and exports
- If you're unsure about a change, DON'T make it — ask in the plan
