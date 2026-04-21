# Task 5.1: Happy Path E2E Test

## Objective

Test the complete onboarding flow from start to finish — all 8 required fields collected, summary presented, confirmation received.

## Context

This is a comprehensive end-to-end test using Playwright MCP to simulate a real user going through the full onboarding flow. The agent should ask for all 8 required fields using a mix of askUser tool calls and open conversation, then present a summary and ask for confirmation.

Note: The agent's exact question sequence is non-deterministic (it's an LLM), so the test should be adaptive — respond to whatever the agent asks rather than expecting a fixed order.

## Dependencies

- All Phase 4 complete

## Blocked By

- Phase 4 complete

## Testing Protocol

### Setup

- [ ] Ensure dev server is running: `npm run dev`
- [ ] Navigate to `http://localhost:3000/journey`

### Welcome and First Exchange

- [ ] Verify welcome message displays (updated text, no "dig in while we talk")
- [ ] Type "I'm the founder of Acme Corp, we make HR software for mid-market companies. Our website is acmecorp.com" and send
- [ ] Wait for agent response (may include thinking block + text + askUser)

### Working Through Questions (adaptive)

For each agent response:
- [ ] If askUser chip card appears: read the question, select an appropriate option by clicking
- [ ] Verify chip highlight animation (200ms blue glow on selected)
- [ ] Verify unselected chips fade after selection
- [ ] Verify agent continues after selection (new response appears)
- [ ] If agent asks an open-ended question (no chips): type a reasonable answer and send

Suggested answers for common questions:
- Business model: "B2B SaaS"
- Industry: Select most relevant option
- ICP: Select mid-market option
- Product description: "We help mid-market HR teams automate onboarding, payroll, and compliance. Think Rippling for the 100-500 employee segment."
- Competitors: "I can name my top 2-3" → then provide "Rippling, Gusto, BambooHR"
- Pricing: "Annual contract"
- Marketing channels: Select "Google Ads" and "LinkedIn Ads" (multi-select)
- Goals: "Generate more qualified leads"

### Progress Tracking

- [ ] After each required field answered, check progress bar in header
- [ ] Progress should increase incrementally (each field = ~12.5%)
- [ ] After all 8 required fields: progress bar should be at 100%

### Thinking Block Verification

- [ ] During agent responses: verify thinking blocks appear with blue left border
- [ ] Verify "Thinking for X.Xs" label while streaming (if visible during response)
- [ ] After response completes: verify "Thought for X.Xs" (frozen timer)
- [ ] Verify collapsed by default, expandable on click
- [ ] Click to expand — verify reasoning text appears

### Completion Flow

- [ ] After all 8 required fields collected, agent should present a summary
- [ ] Summary should be conversational (2-3 paragraphs, not bulleted list)
- [ ] askUser confirmation card should appear: "Looks good, let's go" / "I want to change something"
- [ ] Click "Looks good, let's go"
- [ ] Verify agent acknowledges and wraps up

### Persistence Verification

- [ ] Open DevTools → Application → Local Storage
- [ ] Find key `aigog_journey_session`
- [ ] Verify JSON contains populated fields matching answers given
- [ ] Verify `completionPercent` is 100 (or close)
- [ ] Verify `phase` is 'confirming' or 'complete'

### Screenshot Evidence

- [ ] Screenshot: Welcome message
- [ ] Screenshot: First askUser card with chips
- [ ] Screenshot: After selecting a chip (shows disabled state)
- [ ] Screenshot: Thinking block with blue border and timer
- [ ] Screenshot: Progress bar at ~50%
- [ ] Screenshot: Summary with confirmation card
- [ ] Screenshot: Final completion state

## Git

- Branch: `aigos-v2`
- Commit message prefix: `Task 5.1:`
