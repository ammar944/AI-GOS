# Journey Chat UX Audit

Date: `2026-03-07`
Scope: `src/app/journey/page.tsx`, journey onboarding/prefill/chat components, prompt handoff behavior, and the current post-prefill chat UX shown in the provided screenshot.

## Executive Summary

The journey experience is visually polished, but the user-facing narrative breaks at the exact moment it matters most: after website submission and prefill review.

The current UX makes the system look like it has:

- already done work
- already learned useful things
- already advanced the user into a guided strategy flow

but the screen the user lands on does not acknowledge any of that clearly. Instead, it behaves like a generic chat start state. This creates a strong mental-model mismatch:

- the system knows context
- the user does not know what the system knows
- the UI does not tell the user what happens next

Result: users are likely to feel lost right after the most important trust-building step.

## Overall Verdict

Current state: `Not yet strong enough for a smooth beta-quality onboarding-to-chat handoff`

Why:

- the post-prefill transition is unclear
- progress language is inconsistent
- the first screen after review does not tell users what to do next
- multiple surfaces compete to explain state, but none clearly owns the narrative
- some internal product mechanics are visible in code but not visible in the UX

The biggest issue is not missing functionality. It is missing orientation.

## What The User Expects

After this sequence:

1. user submits website
2. system analyzes site
3. user reviews and confirms findings
4. user clicks the continue CTA

the user expects something like:

- a short acknowledgment of what was saved
- a clear statement of what happens next
- the next specific question
- visible progress through a journey

Instead, the current experience lands in a chat surface that still looks like the user is at the beginning.

## Current Flow

### Actual product flow

1. `WelcomeState` collects website and optional LinkedIn.
2. `/api/journey/prefill` runs structured website/LinkedIn extraction.
3. Results become proposal cards in `JourneyPrefillReview`.
4. User accepts, edits, or skips.
5. UI enters chat mode.
6. No automatic assistant turn is sent after prefill review.
7. The user sees a generic welcome-style assistant message and must decide what to do next.

### User-perceived flow

1. "I gave you my website."
2. "You analyzed it."
3. "I approved your findings."
4. "Now I am on a page that still looks like the start."
5. "I don't know whether to wait, type, or review something."

That gap is the core UX failure.

## Findings

### 1. Critical: Post-prefill handoff is missing

After prefill review, the app does not create an explicit transition into the guided journey. The user is dropped into a chat surface without a receipt, recap, or next step.

Impact:

- high confusion risk
- trust drop after an otherwise promising onboarding step
- users may think the system stalled or reset

Observed behavior:

- accepted prefill values are saved
- the chat screen appears
- the first visible assistant content is still generic
- the user must initiate the next step manually

Why this matters:

The handoff from structured onboarding to guided strategy conversation is the moment that should feel smartest. Right now it feels least intentional.

### 2. Critical: Header and chat state contradict the actual journey state

The header continues to say variants of `Start with your company URL` until there are actual chat messages. That directly conflicts with the fact that the user has already submitted a website and possibly reviewed extracted details.

Impact:

- user feels like the product forgot what just happened
- weakens confidence in saved context
- makes the screen look like a restart instead of continuation

### 3. High: The first assistant message after prefill is not state-aware

The visible assistant message still reads like an opening prompt asking for company name and website URL.

Impact:

- duplicates work in the user's mind
- undermines the value of the prefill review
- creates a false sense that the system has not used the submitted website

This is especially damaging when a profile summary card is also visible, because the screen contains conflicting signals:

- "I know things about your company"
- "Tell me your company name and website"

### 4. High: The UX does not answer "What should I do now?"

After prefill, the screen shows:

- header status
- assistant welcome copy
- profile summary
- composer
- optional right panel

But none of those clearly tells the user the next action.

The missing sentence is something like:

`I saved 4 details from your site. Next I need your ICP so I can start industry research.`

Without that, users are left to infer the flow themselves.

### 5. High: `askUser` chips can appear without visible question text

The `AskUserCard` uses the question as an accessibility label, but does not visibly render the question on the card itself.

Impact:

- options can appear detached from their prompt
- users may not understand what they are answering
- this is especially risky in a streaming chat where tool UI can be separated from surrounding prose

This is a severe comprehension issue in a chat-first onboarding product.

### 6. Medium: Entry-point choices are not consequence-based

The current buttons are:

- `Start journey`
- `Skip to chat`

These labels do not explain what will actually happen.

Likely user interpretations:

- "Skip to chat" could mean skip analysis entirely
- "Start journey" sounds generic, not specifically website-driven

Better labels would explain consequences:

- `Analyze website first`
- `Start without website analysis`

### 7. Medium: The product promises a stronger guided journey than it actually communicates

The welcome surface implies a clean linear story:

- seed context
- verify findings
- watch research stream

But the actual user experience after review does not preserve that same narrative. The app stops explaining the journey at the exact point the user needs reassurance.

### 8. Medium: Progress language is internally inconsistent

Different parts of the system use different definitions of progress and readiness:

- `session-state.ts` tracks 8 required fields
- `journey-state.ts` tracks a different 7-field readiness set
- the lead agent prompt uses a 6-field minimum to move into strategy completion

Impact:

- harder to build a trustworthy progress story in the UI
- progress bar may feel arbitrary
- difficult to explain to users why some things are "ready" and others are not

### 9. Medium: Profile summary is useful, but framed in an internal way

`Client Dossier` is a strong internal product label, but not a great user-facing label for orientation.

Problems:

- sounds internal and static
- does not distinguish confirmed vs inferred
- truncates values without offering clear affordances
- does not help the user understand what still matters next

This component should function as the user's anchor, but right now it is more of a snapshot than a guide.

### 10. Medium: Right rail weakens perceived polish when empty

The screenshot shows a large mostly empty right-side area with only a debug control. Even if this is a development-only issue, it makes the page feel incomplete and amplifies the user's uncertainty.

### 11. Medium: The research timeline explains status but not causality

`ResearchProgress` shows queued/running/complete states, but does not explain:

- why a section is waiting
- what user input unlocks the next section
- how the current question relates to what is being generated

For a "journey" product, status alone is not enough. Users need narrative cause-and-effect.

### 12. Low to Medium: Some copy still sounds administrative instead of outcome-driven

Confusing or low-signal copy includes:

- `Continue with review decisions`
- `Ask me in chat instead`
- `Skip to chat`
- `Stop research`
- `Client Dossier`

These labels are functional, but they do not help users understand the product story.

## Root Causes

### 1. System state is ahead of user state

The system stores:

- proposals
- confirmed fields
- progress
- trigger readiness
- section statuses

But the user sees only fragments of that state. The app is operationally ahead, but experientially behind.

### 2. The transition moment is treated like a render switch, not a product moment

The code changes screen state correctly, but the UX does not treat the handoff as a distinct step that deserves acknowledgment and instruction.

### 3. Too many UI surfaces partially explain state

The current chat experience uses:

- header
- welcome message
- dossier
- right rail
- chat content

But none of them clearly owns:

`where am I, what already happened, what should I do next`

## User Mental Model Breakdown

The likely user questions at the confusing screen are:

- "Did the system actually save what I approved?"
- "Why am I still being treated like I'm starting?"
- "Am I supposed to type something now, or is the AI supposed to continue?"
- "Has research started yet?"
- "What exactly is missing from me?"
- "Is this summary final, inferred, or editable?"

If a user has to ask themselves these questions, the journey narrative is not yet doing its job.

## What Is Working

This audit is not saying the whole experience is broken. Several foundations are strong:

- website submission and structured prefill exist
- prefill review is a good concept
- normalized journey state is a strong architecture choice
- research progression exists and is visible
- the UI styling is polished and credible
- the system has enough internal state to support a very strong guided flow

This is a narrative and orchestration problem, not a "start over" problem.

## Recommendations

### Must-fix design recommendations

1. Add a dedicated post-prefill transition state.

The screen after review should explicitly say:

- what was saved
- what remains
- what happens next

Example:

`Using 4 confirmed details from your site. Next I need to understand your best-fit customer so I can start industry research.`

2. Replace the static welcome message with a state-aware assistant kickoff.

After prefill review, the first assistant message should acknowledge the known context and immediately ask the next highest-value question.

3. Make the header reflect actual stage, not message count.

The header should not say `Start with your company URL` after the URL is already submitted.

4. Render the `askUser` question visibly above the chips.

This should be treated as mandatory for comprehension.

5. Reframe the dossier into a user-facing orientation card.

Suggested direction:

- label it `What I know so far`
- show confirmed vs inferred status
- keep visible next-step guidance nearby

6. Use consequence-based labels for entry choices.

Replace:

- `Start journey`
- `Skip to chat`

With something closer to:

- `Analyze website first`
- `Start without website analysis`

### Strongly recommended product recommendations

7. Unify progress language across the experience.

Choose one product-facing readiness model and use it consistently in:

- progress bar
- chat guidance
- research unlocking
- final completion language

8. Explain why research is waiting.

Queued sections should communicate dependency context, not just status.

9. Preserve provenance after review.

At minimum, the user should still be able to see whether a displayed value came from:

- website
- LinkedIn
- user confirmation

10. Remove dead-feeling empty space.

If the right rail has no user value yet, collapse or hide it until it does.

## Beta Readiness Judgment For Chat UX

Current chat UX readiness: `Needs revision before beta`

Reason:

The problem is not whether the product can generate research.

The problem is whether users can understand the transition from:

- website analysis
- to guided intake
- to research generation

At the moment, that transition is too confusing to trust as a beta-first impression.

## Suggested Next Step

Before implementation, the next research/design phase should focus on a single question:

`What is the ideal user-facing narrative from website submission to first guided chat question?`

That should define:

- stage names
- post-prefill transition copy
- ownership of next-step guidance
- what the user sees immediately after review
- how progress is explained

Once that narrative is set, the implementation work should be much more straightforward and much more coherent.
