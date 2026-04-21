# Sprint 2: Conversational Onboarding — PRD

**Created**: 2026-02-27
**Status**: Draft
**Source**: User brain dump + AI-GOS v2 PRD Section 4.2 + Roadmap Sprint 2 + Design System

---

## 1. Vision

Replace the V1 9-step form wizard with a conversational onboarding experience. The Lead Agent (Claude Opus 4.6) asks ~7-9 smart questions through natural chat, using a structured `askUser` tool to present tappable option chips for categorical questions and open text for nuanced ones. Users complete onboarding in under 5 minutes through conversation — no forms.

This is Sprint 2 of the AI-GOS v2 roadmap. Sprint 1 established the foundation: `/journey` page with centered chat, streaming via `streamText` + `toUIMessageStreamResponse()`, adaptive thinking, and the Lead Agent persona. Sprint 2 adds the intelligence layer: structured question-asking, field tracking, session persistence, and a polished thinking block.

## 2. Core Features

### 2.1 askUser Tool
- Backend tool definition using Vercel AI SDK `tool()` with Zod schema
- Parameters: `question`, `options` (2-4 with label/description), `multiSelect`, `fieldName`
- Does NOT use `needsApproval` — uses direct `addToolResult()` pattern
- Frontend renders interactive chip cards inline in chat stream
- "Other" option always present — expands text input
- Multi-select: toggle chips + "Done" button
- Single-select: tap immediately submits
- After submission: chips become static/disabled, selected chips highlighted

### 2.2 Lead Agent System Prompt Extension
- Add onboarding field tracking rules to existing `LEAD_AGENT_SYSTEM_PROMPT`
- Define when to use `askUser` (categorical) vs. free text (nuanced)
- Dynamic option generation based on prior answers
- Pushback instructions for vague answers
- Skip handling with gap acknowledgment
- Field completion tracking → summary → confirmation flow

### 2.3 Onboarding Question Flow (7-9 turns)
8 required fields collected via structured conversation:
1. Business model (askUser: B2B SaaS / B2C / Marketplace / Other)
2. Industry (askUser: dynamic options from Q1)
3. ICP description (askUser: dynamic from industry)
4. Product description (open text)
5. Competitors (askUser: name them / not sure / no direct)
6. Offer & pricing (askUser: monthly / one-time / usage / other)
7. Marketing channels (askUser multi-select: Google Ads / Meta / LinkedIn / None yet)
8. Goals (askUser: more leads / lower CAC / scale / launching)

14 optional fields collected opportunistically as natural follow-ups.

### 2.4 Session State Management
- `OnboardingState` interface tracking all 22 fields + phase + completion percentage
- Primary storage: Supabase `journey_sessions.metadata` JSONB
- Mirror: localStorage for instant hydration on reload
- Sync: write Supabase after each askUser response, read localStorage on mount
- "Other" free-text extraction via `generateObject()` with Sonnet (not Opus)

### 2.5 Thinking Block Enhancement
- Collapsible (collapsed by default, chevron toggle)
- 2px left border accent in `--accent-blue` (currently uses `--border-default`)
- Timer: "Thinking for X.Xs"
- Italic reasoning text in `--text-tertiary`
- Streaming: show content as it arrives

### 2.6 Progress Indicator
- Thin 2px progress bar below journey header
- Width = required field completion (0/8 → 8/8)
- `--accent-blue` fill color
- No step labels — pure visual indicator

### 2.7 Completion Flow
- Agent detects all 8 required fields populated
- Generates summary of all collected data
- askUser confirmation: "Looks good, let's go" / "I want to change something"
- "Looks good" → `phase: 'complete'`, transition to Sprint 3 generation
- "Change something" → agent asks which field, re-collects

## 3. User Flow

### Flow 1: Happy Path Onboarding
1. User lands on `/journey` → sees welcome message (existing)
2. User shares company name/URL
3. Agent calls `askUser` → business model chips appear inline
4. User taps "B2B SaaS" → selection sent as tool result → agent acknowledges
5. Agent calls `askUser` → industry chips (dynamic, based on B2B SaaS context)
6. Continue through ~8 questions with mix of askUser + open text
7. After all required fields: agent shows summary → "Looks good" / "Change"
8. User confirms → phase complete, progress bar at 100%

### Flow 2: "Other" Selection
1. User sees business model chips
2. Taps "Other" → text input expands below chips
3. Types "We're a hybrid marketplace for..."
4. Submits → `generateObject()` extracts structured value
5. Agent receives structured result, continues

### Flow 3: Vague Answer Pushback
1. Agent asks about ICP
2. User gives vague answer ("everyone")
3. Agent pushes back: "Can you be more specific? Who's your easiest customer to close?"

### Flow 4: Change After Summary
1. Agent presents summary
2. User taps "I want to change something"
3. Agent asks which field
4. User specifies → agent re-asks that question with askUser
5. Updated field → new summary → re-confirm

## 4. Technical Signals

- **Backend**: Vercel AI SDK `tool()`, `streamText`, `maxSteps: 15`, `generateObject()` for extraction
- **Frontend**: `useChat` hook's `addToolResult()` for askUser responses (NOT `addToolApprovalResponse()`)
- **Storage**: Supabase `journey_sessions` table (exists), localStorage mirror
- **Models**: Opus 4.6 for conversation, Sonnet for "Other" extraction
- **Existing route**: `POST /api/journey/stream` — add `tools` + `maxSteps` params
- **Existing prompt**: `src/lib/ai/prompts/lead-agent-system.ts` — extend, don't replace
- **Existing components**: `thinking-block.tsx`, `chat-message.tsx`, `journey-header.tsx` — extend
- **CSS variables**: Design System tokens already in `globals.css`

## 5. Open Questions

- **Q1**: Should `addToolResult` be called immediately on single-select tap, or should there be a brief animation/feedback delay?
- **Q2**: If the user closes the browser mid-onboarding and returns, should the agent resume from the last answered question or restart?
- **Q3**: Should the "Other" text extraction call happen on the frontend (before sending tool result) or on the backend (agent receives raw text)?
- **Q4**: How should the Supabase write be triggered — in an `onFinish` callback on the stream, or in a separate API call from the frontend?
- **Q5**: Should the thinking block border use `--accent-blue` (Design System spec) or `--border-default` (current implementation)?

## 6. Explicit Constraints

- **No voice input** — deferred to Sprint 3+
- **No background research** — PRD Section 4.2.3 defers research to post-onboarding. Roadmap T2.3 contradicts; follow PRD
- **No research activity ticker** — no research = no ticker
- **No URL scraping** — store URLs in session metadata for Sprint 3, don't scrape
- **No two-column layout** — stays centered chat for all of Sprint 2
- **No separate onboarding agent** — extend Lead Agent, don't create new route
- **No v1 regressions** — all existing pages must continue working

## 7. Success Criteria

- User completes onboarding via conversation in <5 minutes (no forms)
- askUser tool renders as interactive chip cards inline in chat
- Options are context-aware (Q3 options change based on Q1/Q2 answers)
- "Other" option opens free-text input, value extracted to structured field
- Multi-select works for channels question (toggle chips + Done button)
- All 8 required fields collected before completion prompt
- Agent pushes back on vague answers with specific follow-ups
- Session state persists to Supabase + localStorage mirror
- Progress bar reflects field completion percentage
- Agent summarizes all data and asks for confirmation before completing
- Thinking blocks collapsible with timer and streaming content
- All v1 pages unaffected (regression)
- `npm run build` passes
- `npm run lint` passes

## 8. File Manifest

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/ai/tools/ask-user.ts` | CREATE | askUser tool definition |
| `src/lib/journey/session-state.ts` | CREATE | OnboardingState + persistence |
| `src/lib/ai/prompts/lead-agent-system.ts` | EXTEND | Onboarding instructions |
| `src/components/journey/ask-user-card.tsx` | CREATE | Interactive chip component |
| `src/components/chat/thinking-block.tsx` | EXTEND | Collapsible + timer + streaming |
| `src/app/api/journey/stream/route.ts` | MODIFY | Add tools + maxSteps + persistence |
| `src/app/journey/page.tsx` | MODIFY | Wire askUser + session hydration |
| `src/components/journey/chat-message.tsx` | MODIFY | askUser rendering in renderToolPart |
| `src/components/journey/journey-header.tsx` | MODIFY | Progress bar |
