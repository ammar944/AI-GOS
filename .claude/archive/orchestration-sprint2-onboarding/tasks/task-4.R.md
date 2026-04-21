# Task 4.R: Phase 4 Regression

## Objective

Full integration test — verify everything works together: askUser cards render, selections submit, thinking block has timer, progress bar advances.

## Context

Phase 4 wired all components together. This is the first time the full end-to-end flow should work: agent asks question → chips render → user taps → addToolOutput fires → agent continues → next question.

## Dependencies

- Tasks 4.1, 4.2 — all must be complete

## Blocked By

- Tasks 4.1, 4.2

## Testing Protocol

### Build/Lint/Type Checks

- [ ] `npm run build` passes — all routes and components compile, no type errors
- [ ] `npm run lint` passes

### Browser Test (Playwright MCP)

- [ ] Start dev server: `npm run dev`
- [ ] Navigate to `http://localhost:3000/journey`
- [ ] Welcome message appears with updated text (no "dig in while we talk")
- [ ] Type "My company is Acme Corp, we sell B2B HR software" and send
- [ ] Wait for agent response — thinking block should appear with blue border
- [ ] If thinking block visible: verify "Thinking for X.Xs" label (timer counting up)
- [ ] Agent should call askUser tool — verify chip card renders inline
- [ ] Verify chips have correct styling (rounded rectangles with descriptions or pills without)
- [ ] Tap a chip — verify 200ms highlight animation
- [ ] Verify chip submits and agent continues with next question
- [ ] Verify progress bar advances (header shows progress)
- [ ] Continue through 2-3 more questions to verify the flow
- [ ] Open DevTools → Application → Local Storage → verify `aigog_journey_session` key exists and updates
- [ ] No JavaScript errors in browser console
- [ ] No errors in terminal (server logs)

### Edge Cases to Spot-Check

- [ ] If agent sends multiple tool calls, they should render in order
- [ ] Answered askUser cards should show disabled with selection highlighted
- [ ] Thinking block should be collapsed by default, expandable on click

## Git

- Branch: `aigos-v2`
- Commit message prefix: `Task 4.R:`
