# Task 5.2: Edge Cases E2E Test

## Objective

Test non-happy-path scenarios — "Other" selection, multi-select behavior, malformed tool calls, localStorage persistence, thinking block interactions.

## Context

This test covers scenarios the happy path doesn't hit: the "Other" chip workflow, multi-select toggle behavior, and various edge cases.

## Dependencies

- Task 5.1 — happy path must work first

## Blocked By

- Task 5.1

## Testing Protocol

### Setup

- [ ] Clear localStorage: DevTools → Application → Local Storage → delete `aigog_journey_session`
- [ ] Navigate to `http://localhost:3000/journey` (fresh session)

### Test 1: "Other" Selection

- [ ] Start conversation with company info
- [ ] When first askUser card appears, click "Other" chip
- [ ] Verify: "Other" chip has dashed border styling (distinct from regular chips)
- [ ] Verify: text input appears below chip group
- [ ] Verify: text input is auto-focused
- [ ] Type "Something custom that isn't in the options"
- [ ] Press Enter (or click submit if there's a button)
- [ ] Verify: card becomes disabled, "Other" chip highlighted with the typed text
- [ ] Verify: agent acknowledges the custom input and continues

### Test 2: Multi-Select (Marketing Channels)

- [ ] Continue conversation until marketing channels question appears
- [ ] Verify: chips show as toggleable (not immediate submit)
- [ ] Click "Google Ads" — verify chip toggles to selected state
- [ ] Click "LinkedIn Ads" — verify both chips now selected
- [ ] Click "Google Ads" again — verify chip toggles back to unselected
- [ ] Re-select "Google Ads"
- [ ] Verify: "Done" button visible
- [ ] Click "Done"
- [ ] Verify: card becomes disabled, selected chips highlighted
- [ ] Verify: agent acknowledges selected channels

### Test 3: Thinking Block Interaction

- [ ] During any agent response, observe thinking block
- [ ] Verify: collapsed by default
- [ ] Click chevron/header — verify block expands with reasoning text
- [ ] Click again — verify block collapses
- [ ] Verify: blue left border (`--accent-blue` color)
- [ ] For a completed thinking block: verify "Thought for X.Xs" label (timer frozen)
- [ ] For a fresh thinking block during streaming: verify "Thinking for X.Xs" (timer counting)

### Test 4: localStorage Persistence

- [ ] Open DevTools → Application → Local Storage
- [ ] Find `aigog_journey_session` key
- [ ] Verify: JSON object contains fields matching selections made
- [ ] Verify: `completionPercent` reflects number of required fields answered
- [ ] Verify: `lastUpdated` is recent ISO timestamp
- [ ] Verify: `phase` is 'onboarding' (not yet complete)

### Test 5: Free Text While Chips Showing

- [ ] When an askUser card is showing chips (waiting for selection)
- [ ] Instead of clicking a chip, type a message in the chat input and send
- [ ] Verify: no crash, no console errors
- [ ] Verify: agent responds to the free text (may ask user to select a chip)
- [ ] Verify: askUser card is still interactive (can still click chips)

### Test 6: Page Reload Resilience

- [ ] After answering a few questions, hard refresh the page (Cmd+R)
- [ ] Verify: page loads without errors
- [ ] Verify: conversation is not preserved (fresh chat — Sprint 2 doesn't resume)
- [ ] Verify: localStorage data still present (not cleared on refresh)
- [ ] Verify: progress bar starts at the hydrated value from localStorage (not 0)

### Test 7: Rapid Clicking

- [ ] When askUser card appears, rapidly click two different chips
- [ ] Verify: only the first click registers (no double submission)
- [ ] Verify: no console errors

## Git

- Branch: `aigos-v2`
- Commit message prefix: `Task 5.2:`
