# Pre-Sprint 2 Fixes — Master Plan

## Scope
9 fixes across HIGH/MEDIUM/LOW priority. All touch V2 journey feature.

## File Ownership Map (Prevents Merge Conflicts)

| File | Fixes | Wave |
|------|-------|------|
| `src/app/api/journey/stream/route.ts` | #4 | Wave 1 |
| `src/components/journey/journey-layout.tsx` | #8 | Wave 1 |
| `src/components/journey/chat-input.tsx` | #6 | Wave 1 |
| `src/app/journey/page.tsx` | #1, #3 | Wave 2 |
| `src/components/journey/chat-message.tsx` | #2, #5, #9 | Wave 2 |
| `src/app/api/journey/stream/route.ts` | #7 | Wave 3 |

---

## Wave 1: Independent Fixes (PARALLEL — different files)

### Task 1A: Fix thinking config (Fix #4)
- **File**: `src/app/api/journey/stream/route.ts`
- **Change**: `{ type: 'enabled', budgetTokens: 10000 }` → `{ type: 'adaptive' }`
- **Complexity**: Trivial (1 line)

### Task 1B: Fix chat panel width (Fix #8)
- **File**: `src/components/journey/journey-layout.tsx`
- **Change**: Replace `440px` with `var(--chat-width)` (which is 340px)
- **Complexity**: Trivial (2 values)

### Task 1C: Add slash command infrastructure (Fix #6)
- **File**: `src/components/journey/chat-input.tsx`
- **Changes**:
  1. Import `SlashCommandPalette` from `@/components/chat/slash-command-palette`
  2. Add state: `isSlashPaletteOpen`, `selectedCommandIndex`
  3. Add command detection on input change (`startsWith('/')`)
  4. Add filtered commands via `useMemo`
  5. Add keyboard navigation (ArrowUp/Down, Enter, Escape)
  6. Add command selection handler
  7. Render palette above textarea
- **Complexity**: Medium

---

## Wave 2: Message Rendering Overhaul (SEQUENTIAL — same files)

### Task 2A: Refactor journey page to pass parts (Fix #1)
- **File**: `src/app/journey/page.tsx`
- **Changes**:
  1. Remove `getTextContent()` function
  2. Pass `message.parts` to ChatMessage instead of flat text string
  3. Update ChatMessage usage to pass parts array
  4. Add `addToolApprovalResponse` to useChat destructuring (prep for Fix #3)
  5. Add `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses`
- **Depends on**: Nothing (foundational)

### Task 2B: Overhaul chat-message.tsx (Fixes #2 + #5 + #9)
- **File**: `src/components/journey/chat-message.tsx`
- **Changes**:
  1. Accept `parts: UIMessage['parts']` prop instead of `content: string`
  2. Add part iterator: text → markdown, tool → card, reasoning → ThinkingBlock
  3. Import and render existing v1 card components (DeepResearchCard, EditApprovalCard, ComparisonTableCard, AnalysisScoreCard, VisualizationCard)
  4. Import ToolLoadingIndicator for in-progress states
  5. Import ThinkingBlock for reasoning parts
  6. Add framer-motion fadeUp entrance animation
  7. Handle tool part states (input-streaming, output-available, output-error, etc.)
- **Depends on**: Task 2A (parts must be passed from page)

### Task 2C: Add approval flow UI (Fix #3)
- **File**: `src/app/journey/page.tsx`
- **Changes**:
  1. Detect pending approvals in messages
  2. Block chat input while approval pending
  3. Pass onApprove/onReject handlers to ChatMessage
  4. Wire `addToolApprovalResponse` for approve/reject actions
  5. Handle MissingToolResultsError in onError
- **Depends on**: Task 2A + 2B (parts passing + card rendering)

---

## Wave 3: Progress Streaming (Fix #7)

### Task 3A: Add multi-step progress infrastructure
- **File**: `src/app/api/journey/stream/route.ts` + tool files
- **Changes**:
  1. Define `ToolProgressEvent` type
  2. Add optional `onProgress` callback to deep research tool
  3. Emit progress events during tool execution phases
  4. Frontend: Parse progress events and show ResearchProgressCard
- **Depends on**: Wave 2 complete (tool cards must render)
- **Note**: This fix requires journey tools to be defined. If tools aren't in route yet, create the infrastructure pattern for Sprint 2 to plug into.

---

## Execution Strategy

- **Wave 1**: 3 parallel agents (different files, zero conflict risk)
- **Wave 2**: Sequential within wave, but can run after Wave 1 completes
- **Wave 3**: After Wave 2 completes
- **Verification**: Build check after each wave
