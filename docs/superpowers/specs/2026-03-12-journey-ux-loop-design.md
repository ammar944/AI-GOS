# Journey UX Loop Design

## Goal

Make `/journey` feel like one continuous agentic conversation instead of a chat UI bolted onto a hidden orchestration engine.

## What I Validated

The current UX problems are real and explainable from the code:

- Dead air after prefill accept is built into the current flow. The page sends a compact kickoff message and immediately switches to chat, but it hides hidden/realtime messages and only renders the typing indicator for `submitted`, not `streaming`. That creates an idle-looking surface while work is happening underneath.
- Section approvals cause a visual snap. Clicking `Looks Good` closes the artifact panel immediately, filters the approval control message out of chat, and collapses the split layout before the next visible assistant handoff exists.
- Downstream sections are second-class in the UI. `crossAnalysis`, `keywordIntel`, and `mediaPlan` already have artifact renderers, but the page only auto-opens and triggers artifacts for the first four sections.
- The orchestration contract is brittle. Review gating treats `tool-*` parts with `state === "output-available"` as complete even when the tool payload is only `{ "status": "queued" }`.
- The chat transcript is not the true source of truth. Hidden synthetic user messages such as `[SECTION_APPROVED:*]` and `[Research complete:*]` advance the state machine even though the user never sees those messages.
- The app promises “Supabase Realtime” in the prompt, but the client currently polls `/api/journey/session` every 2 seconds.

## UX Principles

These principles come directly from the validated app behavior plus Anthropic's current guidance:

- One visible loop: every state transition that changes the product state must produce a visible UI consequence within the same surface.
- Keep the workflow simple and explicit: Anthropic recommends starting with the simplest workflow that actually works, then composing from there rather than stacking hidden agent behavior.
- Human-in-the-loop checkpoints must feel intentional: review/approval is good, but only if the user can clearly see what is waiting, what changed, and what will happen next.
- Minimize latency on orchestration turns: Anthropic's latency guidance favors smaller prompts, fewer unnecessary tools, prompt caching, and avoiding extra reasoning when the turn is mostly status management.
- Never hide causality: if the app launches research, receives a result, opens an artifact, or advances to the next section, the user should see that cause/effect chain.

## Approaches Considered

### 1. Patch the current hidden orchestration

Add more typing states, more banners, and more artifact triggers while keeping hidden control messages and prompt-patched sequencing.

Pros:

- Smallest code diff
- Fastest to ship

Cons:

- Keeps the core mismatch between visible chat and hidden state machine
- More prompt patches will increase brittleness
- Does not fix the false-complete contract or downstream artifact inconsistency

### 2. Hybrid visible orchestrator plus deterministic section state

Keep `useChat` and the current route, but move sequencing to a typed section-state contract and typed control events instead of hidden pseudo-user messages. Every background transition also renders a visible status card.

Pros:

- Fixes the causal UX problem without a full rewrite
- Preserves existing AI SDK transport and most components
- Lets us improve latency and orchestration in parallel

Cons:

- Requires touching both page state and backend orchestration
- Needs test rewrites because current tests encode some broken behavior

### 3. Full event-driven rewrite

Move orchestration into a dedicated reducer/service layer, add real backend event streaming, and rebuild the journey shell around it.

Pros:

- Cleanest long-term architecture
- Best foundation for a Manus-like journey

Cons:

- Too much scope for the current recovery effort
- Higher regression risk

## Recommendation

Choose Approach 2.

It is the smallest change that fixes the actual product problem instead of cosmetically masking it. The key move is to stop treating hidden chat messages as the orchestration bus and replace them with typed journey events plus a visible section-state timeline.

## Target Experience

### 1. Prefill Handoff

When prefill is accepted:

- The chat should immediately show a visible assistant kickoff card: `Profile accepted. Launching Market Overview.`
- The artifact/progress lane should switch to `dispatching` and then `running` within the same surface.
- A typing/status indicator should remain visible during both `submitted` and `streaming`.
- The user should never land on a blank-looking chat state.

### 2. Section Review Loop

For every reviewable section:

- Launch section
- Show visible running state
- Open the artifact automatically when the final result is truly complete
- Keep the artifact open through approval until the next visible handoff is rendered
- After approval, show a visible transition card before any layout change

### 3. Downstream Section Parity

`crossAnalysis`, `keywordIntel`, and future `mediaPlan` must follow the same open/view path as the first four sections:

- inline summary card
- `Open full analysis`
- artifact/panel rendering
- consistent progress state

### 4. Strategy Mode Transition

After keyword intelligence completes:

- show a visible “research loop complete” state
- shift from research/status language to strategist guidance
- stop emitting onboarding-style hidden wake-ups

## Technical Design

### A. Section Status Contract

Create a single canonical section status model shared by page orchestration, review gates, and artifacts:

- `idle`
- `dispatching`
- `queued`
- `running`
- `ready_for_review`
- `approved`
- `needs_changes`
- `complete`
- `error`

Rules:

- `ready_for_review` only exists when the persisted research result payload is actually complete
- `queued` is never treated as complete
- downstream sections use the same status contract

### B. Typed Journey Events

Replace bracketed hidden pseudo-user messages with typed events:

- `prefill_accepted`
- `section_dispatched`
- `section_result_received`
- `section_review_requested`
- `section_approved`
- `section_revision_requested`
- `strategy_mode_entered`

These events should not masquerade as user chat messages. They can still trigger assistant follow-up turns, but that trigger should be passed to the API as structured control data, not as synthetic transcript text.

### C. Visible Status Layer

Add a small, first-class status card/message type for orchestration events:

- “Launching Competitor Intel”
- “Competitor Intel is running”
- “Competitor Intel is ready for review”
- “Offer Analysis approved. Launching Strategy Synthesis”

This is the missing bridge between action and outcome.

### D. Honest Transport Model

Either:

- implement true Supabase realtime subscriptions, or
- keep polling but stop describing it as realtime and make the polling state visible

The first recovery milestone does not require websocket subscriptions, but it does require honest UI status and deterministic polling behavior.

### E. Prompt Simplification

The lead prompt should focus on tone, user-facing reasoning, and research policy. It should not carry the full sequencing state machine.

Move these decisions out of prompt patches and into code:

- whether a section is actually reviewable
- whether the next section may launch
- whether a hidden wake-up should happen
- whether strategist mode is ready

Also split model behavior by turn type:

- orchestration/status turns: no heavy thinking, compact prompt, fast acknowledgement
- strategist turns: richer reasoning budget allowed

## Files Likely Affected

- `src/app/journey/page.tsx`
- `src/app/api/journey/stream/route.ts`
- `src/lib/ai/journey-review-gates.ts`
- `src/lib/journey/chat-auto-send.ts`
- `src/lib/journey/research-realtime.ts`
- `src/lib/journey/journey-section-orchestration.ts`
- `src/lib/ai/prompts/lead-agent-system.ts`
- `src/components/journey/artifact-panel.tsx`
- `src/components/journey/research-inline-card.tsx`
- `src/components/journey/chat-message.tsx`

New likely files:

- `src/lib/journey/journey-events.ts`
- `src/lib/journey/journey-section-status.ts`
- `src/components/journey/journey-status-card.tsx`

## Success Criteria

- No blank/dead state after prefill accept or section approval
- No section is reviewable until its final artifact payload is actually complete
- Clicking `Looks Good` always produces an immediate visible transition message
- `crossAnalysis` and `keywordIntel` open through the same artifact flow as earlier sections
- The visible transcript and the orchestration state no longer disagree
- Median “user action -> visible acknowledgement” time is under 300ms even when research dispatch takes longer
- The journey can be understood from the visible UI alone, without reading hidden logs

## External References

- Anthropic, [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
- Anthropic Docs, [Reduce latency](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/reduce-latency)
