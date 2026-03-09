# Journey Chat UX Implementation Design

Date: `2026-03-08`
Source: `docs/2026-03-07-journey-chat-ux-audit-report.md`
Scope: Core handoff fixes plus orientation-card reframe. Excludes the broader progress-model unification work.

## Goal

Fix the onboarding-to-chat narrative break in the Journey experience so that users clearly understand:

- what was learned from their website
- what was saved after review
- what happens next
- what they should do now

## Problems Being Solved

The current implementation has four user-facing failures that create the biggest trust drop:

1. After prefill review, the page still behaves like a generic chat start.
2. The header reflects message count rather than actual journey stage.
3. `askUser` chips can render without visible question text.
4. The orientation surface is useful internally, but not framed as a user-facing guide.

There is also a smaller polish issue where the empty right rail can appear with only debug controls and no user value.

## Product Decisions

### 1. Use a state-driven handoff instead of a new screen

Do not add a separate post-prefill page. Keep the user in the current journey surface and introduce a state-aware handoff layer in the existing chat view.

Why:

- lower implementation risk
- preserves the current architecture
- fixes the problem where it actually occurs
- avoids introducing another mode to maintain

### 2. Replace the generic post-prefill welcome with a handoff kickoff

When the user has completed prefill review or skipped it, and there are still no actual chat messages, the UI should render a state-aware assistant kickoff instead of the generic `LEAD_AGENT_WELCOME_MESSAGE`.

That kickoff must:

- acknowledge how many details were saved
- explain what the next step unlocks
- ask the next best intake question

Example direction:

`I saved 4 details from your site and review. Next I need to understand your best-fit customer so I can unlock the next layer of research. Who is the ideal buyer you want this strategy to target?`

This kickoff is a UX bridge, not a backend orchestration change. It exists to orient the user before the next streamed assistant turn arrives.

### 3. Derive stage from journey state, not message count

The page should stop using `messages.length === 0` as the primary signal for whether the user is still at the start.

The header and pre-chat messaging should instead derive stage from:

- resume prompt visibility
- prefill review visibility
- whether confirmed state exists from website/manual input
- whether the user has entered guided chat but has not yet exchanged messages
- whether intake is in progress
- whether research is running or completed

### 4. Reframe the profile card as orientation

`ProfileCard` should become a more user-facing orientation card rather than an internal-feeling dossier.

Direction:

- rename the headline to `What I know so far`
- keep the compact field summary
- surface a simple confirmed progress signal
- add a short next-step message so the card helps orient the user

This pass should not attempt a full provenance redesign, but should use existing field metadata where helpful for clearer status language.

### 5. Make `askUser` prompts visible

`AskUserCard` must render the question text visibly above the chips. Accessibility labels alone are not sufficient in a chat UI where the surrounding prose may be distant or absent.

### 6. Use consequence-based action labels

The welcome entry point and prefill review actions should use labels that explain what happens next.

Direction:

- `Start journey` -> `Analyze website first`
- `Skip to chat` -> `Start without website analysis`
- `Continue with review decisions` -> `Use these details and continue`
- `Ask me in chat instead` -> `Skip review and answer in chat`
- `Stop research` -> `Stop website analysis`

## Implementation Shape

### `src/app/journey/page.tsx`

Add a small handoff/orientation layer derived from current state:

- detect when the user has entered chat mode through prefill/manual start but has no chat messages yet
- compute a seeded kickoff message based on confirmed fields
- compute stage-aware header label/detail from journey state rather than only from messages
- hide the right rail when it would contain only dev-only UI

This page remains the orchestrator. No new route or major state container is needed.

### `src/components/journey/profile-card.tsx`

Update copy and framing so the card acts like a user-facing anchor:

- `What I know so far`
- concise summary of answered fields
- compact progress indicator
- next-step guidance copy

### `src/components/journey/ask-user-card.tsx`

Render the question visibly at the top of the card.

### `src/components/journey/welcome-state.tsx`

Refresh entry CTAs and loading copy to be more consequence-based and less ambiguous.

### `src/components/journey/journey-prefill-review.tsx`

Refresh action labels so the transition into chat feels intentional and connected to the saved prefill state.

## Data and State Notes

The current state model already contains what this UX needs:

- confirmed fields
- proposed fields
- field metadata
- completion percentage
- review state

No schema or API changes are required for this scope.

## Risks

1. If the handoff copy becomes too opinionated about the next question, it may conflict with what the backend agent asks next.
Mitigation: keep the kickoff focused on orientation and likely next-step guidance, not strict promises about exact tool flow.

2. Reframing the orientation card could accidentally hide useful details.
Mitigation: keep the existing compact field grid and progress bar structure while changing copy and context.

3. Header logic could become harder to reason about if spread across many inline conditionals.
Mitigation: extract small helper functions or a local derived-state block in `page.tsx`.

## Testing Strategy

Add or update focused component/page tests for:

- seeded journey state rendering handoff copy instead of generic welcome copy
- header reflecting seeded journey state before any chat messages exist
- `AskUserCard` rendering the visible question text
- right rail staying hidden when there is no user-facing right-panel content
- orientation card using the new user-facing copy
- updated consequence-based CTA labels

## Out of Scope

This design intentionally does not include:

- full progress/readiness model unification
- dependency-aware narrative in `ResearchProgress`
- deep provenance UX for every field
- backend changes to force an automatic assistant turn after prefill
