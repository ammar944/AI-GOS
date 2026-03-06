# Claude Code Execution Prompt: Thinking Blocks Sprint

> Paste this entire prompt into a new Claude Code session on branch `aigos-v2`.
> This is the smallest sprint — estimated 1-2 hours. Can run independently of other sprints.

---

## Execution Prompt

```
We are executing the Thinking Blocks Sprint for AI-GOS V2.

**Plan file:** `docs/plans/2026-03-04-sprint-thinking-blocks.md`
**Branch:** `aigos-v2`
**Goal:** Surface Claude's reasoning to the user in the chat UI. The thinking blocks are already generated and already in the stream — they're just hidden because `ThinkingBlock` mounts with `defaultOpen = false`. Fix the auto-open/auto-close behavior, wire streaming state correctly, add a collapsible toggle, and handle legacy `agent-chat.tsx` reasoning parts.

---

## Required Skills — invoke ALL of these in order:

**Step 1: Start with execution skill**
Use the `superpowers:executing-plans` skill to load and execute the plan at `docs/plans/2026-03-04-sprint-thinking-blocks.md`.

**Step 2: Use subagent-driven development**
Use the `superpowers:subagent-driven-development` skill throughout execution. This sprint has 7 tasks, each touching a different aspect of the thinking block UI.

**Step 3: Dispatch parallel agents where possible**
Use the `superpowers:dispatching-parallel-agents` skill:
- Tasks 1 and 2 can run in parallel (Task 1 modifies `thinking-block.tsx`, Task 2 is read-only verification of the route + chat-message pipeline)
- Task 3 (chat-message.tsx refactor) depends on Task 2 verification completing
- Task 4 (`agent-chat.tsx` reasoning handler) is independent of Tasks 1-3 — run in parallel with Task 3
- Task 5 (pulse animation) depends on Task 1 completing
- Tasks 6 and 7 are sequential at the end

**Step 4: Agent team QC after Task 1 (the core fix)**
After Task 1 completes (`defaultOpen` fix + `useEffect` auto-open/close), spawn a QC team:
- `code-reviewer` — verify the `userToggledRef` pattern is correct (ref, not state) and doesn't cause infinite re-render loops
- `tester` — run `npm run test:run` and `npm run build`

**Step 5: Full QC team before branch finish**
Spawn an agent team:
- `code-reviewer` — reviews `thinking-block.tsx` diff for correctness
- `researcher` — reads `src/app/api/journey/stream/route.ts` lines 123-137 and `src/components/journey/chat-message.tsx` lines 619-628 to confirm the end-to-end stream → render pipeline is intact
- `tester` — runs full build

**Step 6: Finish the branch**
Use the `superpowers:finishing-a-development-branch` skill to complete the sprint, create a PR, and write a summary.

---

## Critical Context

**The core insight from the audit:**
The thinking blocks are ALREADY flowing through the entire pipeline correctly:
1. Route: `providerOptions: { anthropic: { thinking: { type: 'enabled', budgetTokens: 5000 } } }` ✅
2. Stream: `toUIMessageStreamResponse()` passes `sendReasoning: true` by default ✅
3. Frontend: `chat-message.tsx:619-628` handles `part.type === 'reasoning'` ✅
4. Component: `ThinkingBlock` renders with timer and streaming state ✅

The ONLY bug is: `ThinkingBlock` line 17 → `defaultOpen = false`. Content is in the DOM, just collapsed.

**What must NOT change:**
- `src/app/api/journey/stream/route.ts` — no changes to streaming setup
- The existing timer logic in `thinking-block.tsx` lines 28-45 — already correct
- The `part.type === 'reasoning'` handler in `chat-message.tsx:619-628` — already correct

**Key files:**
- `src/components/chat/thinking-block.tsx` — PRIMARY target
- `src/components/journey/chat-message.tsx` — verification + minor refactor only
- `src/components/chat/agent-chat.tsx` — read first, then add reasoning part handler if needed

**Test commands:**
- `npm run build` (primary verification — no unit tests for animation logic)
- Manual browser smoke test after build: start journey, send a message, verify thinking block appears expanded during streaming and collapses when done

**Commit after every task. Never batch multiple tasks into one commit.**
```
