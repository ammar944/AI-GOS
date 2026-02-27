# Task 2.R: Phase 2 Regression

## Objective

Verify backend changes work end-to-end — the route accepts tool calls, the system prompt produces correct agent behavior, and no regressions.

## Context

Phase 2 modified the route (adding askUser tool, stepCountIs, body.messages extraction) and the system prompt (onboarding instructions). This regression verifies the backend is functional.

## Dependencies

- Tasks 2.1, 2.2 — all must be complete

## Blocked By

- Tasks 2.1, 2.2

## Testing Protocol

### Build/Lint/Type Checks

- [ ] `npm run build` passes — all routes compile, no type errors
- [ ] `npm run lint` passes

### Browser Test (Playwright MCP)

- [ ] Start dev server: `npm run dev`
- [ ] Navigate to `http://localhost:3000/journey`
- [ ] Welcome message appears (updated text, no "dig in while we talk")
- [ ] Type "My company is Acme Corp, we sell B2B HR software" and send
- [ ] Wait for agent response — agent should respond conversationally
- [ ] Agent should use askUser tool within first 1-3 exchanges
- [ ] If askUser tool call appears in the stream (check Network tab for `tool-askUser` parts in SSE), backend is working
- [ ] Even if the card doesn't render yet (Task 4.1), the tool call data should be in the stream

### Verification Notes

- The askUser card component hasn't been wired yet (that's Phase 3-4), so the tool parts may render as the default loading indicator or nothing. That's expected. The backend is verified by checking:
  1. The SSE stream contains `tool-askUser` type parts
  2. The agent's behavior follows onboarding instructions (asks about business model first)
  3. No errors in the browser console or server logs

## Git

- Branch: `aigos-v2`
- Commit message prefix: `Task 2.R:`
