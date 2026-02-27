# Sprint 2: Conversational Onboarding — Discovery Document

**Created**: 2026-02-27
**Status**: Complete
**Rounds of Q&A**: 2 (8 questions total)
**Authority**: This document overrides PRD.md, research files, and all other docs.

---

## 1. Frontend UX Decisions

**D1: Chip selection UX — immediate submit or confirm step?**
A: Hybrid with animation. Single-select: tap immediately submits with a ~200ms highlight animation (selected chip glows `--accent-blue`, unselected fade out, then `addToolOutput()` fires). Multi-select: toggle chips freely, "Done" button to submit. No separate confirm step.

**D2: Chip shape — pills or rounded rectangles?**
A: Rounded rectangles (12px border-radius) when descriptions are present (label + description layout). Pills (999px radius) for label-only chips with no descriptions. This matches the Design System Section 5.9.

**D3: "Other" chip styling**
A: Dashed border, transparent background, `--text-tertiary` color. Distinct from regular option chips. Tapping expands inline text input below the chip group.

**D4: Thinking block auto-expand during streaming?**
A: No. Keep collapsed by default per Design System spec. Users expand manually if they want to see reasoning. This avoids jarring auto-expand/collapse behavior.

**D5: Thinking block border color**
A: Change from `--border-default` (current) to `--accent-blue` per Design System Section 5.2 spec.

---

## 2. SDK & API Decisions

**D6: AI SDK v6 API usage — deprecated or new APIs?**
A: Use new v6 APIs exclusively:
- `addToolOutput()` (NOT deprecated `addToolResult()`)
- `stopWhen: stepCountIs(15)` (NOT deprecated `maxSteps`)
- `sendAutomaticallyWhen` with custom combined function

**D7: `sendAutomaticallyWhen` configuration**
A: Combine both predicates in a custom function: check `lastAssistantMessageIsCompleteWithToolCalls` OR `lastAssistantMessageIsCompleteWithApprovalResponses`. This handles askUser (tool calls) AND future approval-based tools (edit blueprint).

**D8: Tool output format — what does `addToolOutput()` send back?**
A: Structured JSON object. For single-select: `{ fieldName, selectedLabel, selectedIndex }`. For multi-select: `{ fieldName, selectedLabels, selectedIndices }`. For "Other": `{ fieldName, otherText }`. The agent receives this as the tool result.

**D9: `onFinish` callback architecture** *(REVISED after Phase 4 research)*
A: For **interactive tools** (no `execute`, like askUser), `streamText.onFinish.steps[N].toolResults` is **empty** because the tool result comes from the client on the NEXT HTTP request. Therefore:
- **Supabase persistence**: Extract askUser results from the **incoming `body.messages`** array on each request. Scan for `tool-askUser` parts with `state: 'output-available'` and extract `input.fieldName` + `output`.
- `streamText.onFinish` is used for **logging/monitoring** only (token usage, step count).
- This is a correction from the original plan which assumed `onFinish.steps` would contain interactive tool results.

---

## 3. Backend & Data Decisions

**D10: "Other" text extraction — frontend or backend?**
A: Backend. The agent receives raw text from `addToolOutput()` and handles extraction. For simple text, the agent interprets directly. For structured extraction (mapping free text to a canonical field value), use `generateObject()` with Sonnet (cheaper than Opus). No frontend extraction step.

**D11: Session persistence model — belt + suspenders** *(REVISED after Phase 4 research)*
A: Both localStorage AND Supabase:
- **localStorage**: Write immediately in frontend after each `addToolOutput()` call. Read on mount for instant hydration. Key: `STORAGE_KEYS.JOURNEY_SESSION`.
- **Supabase**: Extract askUser results from **incoming `body.messages`** at the start of each POST request (scan for `tool-askUser` parts with `state: 'output-available'`). Fetch-then-merge JSONB `metadata` column. This runs before `streamText()`, not in `onFinish`.
- On mount: read localStorage first (fast), then verify against Supabase (authoritative).

**D12: Session model — one per user**
A: One session per user. UNIQUE constraint on `journey_sessions.user_id`. Use upsert pattern. No multiple concurrent sessions.

**D13: Supabase JSONB update pattern**
A: Fetch-then-merge. Read current `metadata`, deep merge new field values, write back. This matches the existing codebase pattern. No raw SQL JSONB operators.

---

## 4. Agent & Prompt Decisions

**D14: Agent architecture — separate onboarding agent?**
A: No. Extend the existing Lead Agent. Same route (`/api/journey/stream`), same system prompt file (`lead-agent-system.ts`). Add onboarding instructions as a new section in the existing prompt. Add `tools: { askUser }` to existing `streamText()` call.

**D15: Resume from mid-onboarding?**
A: Defer to Sprint 3. In Sprint 2, persist session state (localStorage + Supabase) but do NOT implement resume logic. If user returns, they start a fresh conversation. The persisted state is available for Sprint 3 to implement smart resume.

---

## 5. Scope Exclusions

**D16: What is explicitly NOT in Sprint 2 scope?**
A: All of the following are deferred:
- No voice input (Sprint 3+)
- No background research during onboarding (PRD Section 4.2.3 defers to post-onboarding)
- No research activity ticker (no research = no ticker)
- No URL scraping (store URLs in metadata for Sprint 3)
- No two-column layout (stays centered chat)
- No separate onboarding agent or route
- No v1 regressions (all existing pages must work)
- No session resume logic (persist state, don't resume)

---

## 6. Inferred Decisions (from research + PRD, not explicitly asked)

**D17: Multi-step flow mechanics**
Each `addToolOutput()` call triggers a new server round trip. `stepCountIs(15)` gives headroom for ~8 questions + follow-ups + summary. Each client→server round = 1 step.

**D18: Tool definition pattern**
askUser tool has NO `execute` function. Tools without `execute` are "interactive tools" — the AI SDK waits for the frontend to call `addToolOutput()` before continuing. This is the correct pattern for user-facing tools.

**D19: Thinking block timer implementation**
Client-side only. No server-side duration data. Self-managed timer inside ThinkingBlock component: `useRef(Date.now())` on mount, `setInterval(100ms)` while `state === 'streaming'`, freeze when `state === 'done'`. Historical messages (no state) show "Thinking" without duration.

**D20: Reasoning part streaming**
AI SDK streams reasoning as `ReasoningUIPart { type: 'reasoning', text: string, state?: 'streaming' | 'done' }`. The `text` property grows incrementally (SDK mutates in place + calls `write()` for re-render). No special streaming logic needed — React re-renders handle it. Must pass `state` from part to ThinkingBlock component (currently missing in `chat-message.tsx`).

**D21: Progress bar specification**
Thin 2px bar below journey header. Width = required field completion (0/8 → 8/8 = 0% → 100%). Fill color: `--accent-blue`. No step labels, no animation (or subtle width transition). Pure visual indicator.

**D22: Error handling strategy**
- **Supabase write failure**: Silent fail with console.error. localStorage is the fallback. Do NOT block the conversation or show user-facing errors for persistence failures. The conversation itself is the source of truth — fields can be re-extracted from message history in Sprint 3 if persistence fails.
- **addToolOutput failure**: If the SDK call fails, show a toast/inline error and allow the user to re-tap. This should be extremely rare.
- **Agent tool call malformed**: If askUser args are malformed (missing options, bad schema), render a fallback text message instead of crashing. Log the error.
- **Network disconnection mid-stream**: Existing `useChat` error handling applies. No special handling needed for Sprint 2.

**D23: Free text instead of chip tap**
If the user types free text in the chat input while an askUser tool call is pending (chips visible), the free text is sent as a new user message (not as a tool result). The AI SDK handles this: the pending tool call stays pending until `addToolOutput()` is called. The agent will see the free text message and can respond conversationally, but the askUser tool result is still needed. The agent should acknowledge the free text and guide the user to tap a chip or select "Other."

**D24: Testing strategy**
- `npm run build` must pass (catches type errors, import issues)
- `npm run lint` must pass
- Manual Playwright e2e testing via MCP: navigate to `/journey`, complete full onboarding flow, verify chips render, verify selections submit, verify thinking block has timer, verify progress bar fills
- No unit tests for Sprint 2 (component behavior is best tested via e2e)
- Regression: verify `/dashboard`, `/strategy`, `/chat` pages still load

---

## 7. File Manifest (from PRD, confirmed by research)

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `src/lib/ai/tools/ask-user.ts` | CREATE | askUser tool definition with Zod inputSchema |
| 2 | `src/lib/journey/session-state.ts` | CREATE | OnboardingState interface + persistence helpers |
| 3 | `src/components/journey/ask-user-card.tsx` | CREATE | Interactive chip card component |
| 4 | `src/lib/ai/prompts/lead-agent-system.ts` | EXTEND | Onboarding instructions + field tracking |
| 5 | `src/components/chat/thinking-block.tsx` | EXTEND | Timer + state prop + border color |
| 6 | `src/app/api/journey/stream/route.ts` | MODIFY | Add tools + stopWhen + onFinish persistence |
| 7 | `src/app/journey/page.tsx` | MODIFY | Wire addToolOutput + session hydration |
| 8 | `src/components/journey/chat-message.tsx` | MODIFY | askUser rendering + pass state to ThinkingBlock |
| 9 | `src/components/journey/journey-header.tsx` | MODIFY | Progress bar |
| 10 | `src/lib/storage/local-storage.ts` | EXTEND | JOURNEY_SESSION key + typed helpers |
