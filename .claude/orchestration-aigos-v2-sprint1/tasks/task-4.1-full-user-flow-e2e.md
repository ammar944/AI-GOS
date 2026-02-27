# Task 4.1: Full User Flow E2E

## Objective

Comprehensive Playwright end-to-end test of the complete /journey chat experience. Every visual element, interaction pattern, and streaming behavior is verified against the design system specification.

## Context

Phase 4 testing task. This is the primary acceptance test for Sprint 1. All implementation is complete (Phases 1-3). The dev server is running at localhost:3000. This task exercises the entire user journey: page load, welcome message, typing, streaming response, follow-up conversation, and all visual/interaction details.

All browser testing uses the Playwright MCP tool connected to the running dev server. The tester must be authenticated via Clerk (navigate to /sign-in first if needed, or use an existing session).

## Dependencies

- Phase 1 complete (fonts, tokens, system prompt, model constant, Supabase table)
- Phase 2 complete (all journey UI components built)
- Phase 3 complete (API route streaming, journey page wired, sessions persisted)
- Dev server running at localhost:3000

## Blocked By

- Phase 3 (all tasks including 3.R regression)

## Implementation Plan

This task is a test plan, not an implementation task. Execute the following test protocol using Playwright MCP.

### Test Group 1: Page Load and Initial State

1. Navigate to `http://localhost:3000/journey` as an authenticated user
2. Verify the page loads without console errors
3. Verify centered chat layout appears (max-width 720px, horizontally centered)
4. Verify the JourneyHeader renders at the top:
   - Height is 56px
   - Background uses `--bg-elevated` token
   - Bottom border uses `--border-default` token
   - "AI-GOS" logo text is visible in Instrument Sans 700 weight, 15px size
   - Logo has gradient text fill (white to #93c5fd)
   - NO step indicators, progress bars, or wizard elements visible in header
5. Take a screenshot of the initial state

### Test Group 2: Welcome Message

1. Verify the welcome message is visible on page load (no user action needed)
2. Verify the welcome message content matches the persona:
   - "Good to meet you."
   - Contains mention of "paid media strategy"
   - Contains request for "company name and website"
3. Verify the welcome message is styled as an assistant message:
   - Left-aligned
   - 24px gradient avatar circle visible (accent-blue to #006fff gradient)
   - No bubble background (AI messages have transparent background)
   - Text color uses `--text-secondary` token
   - Font size is 13.5px, font family is DM Sans
4. Take a screenshot of the welcome message

### Test Group 3: Chat Input Component

1. Verify the chat input is fixed at the bottom of the chat panel
2. Verify glassmorphism styling:
   - Container has `backdrop-filter: blur(12px)` or equivalent
   - Semi-transparent background
   - Border uses `--border-subtle` token
3. Verify placeholder text is visible in the textarea
4. Verify the send button is disabled/muted when input is empty
5. Click into the textarea:
   - Verify focus glow appears (border changes to `--border-focus`, blue box-shadow visible)
6. Type a message into the textarea:
   - Verify text appears in the input
   - Verify send button transitions to active state (blue glow)
7. Test multi-line input:
   - Press Shift+Enter — verify a newline is added (message is NOT sent)
   - Verify the textarea auto-resizes to accommodate the new line
   - Type additional lines — verify textarea grows up to approximately 120px max height
8. Clear the input and verify send button returns to disabled/muted state

### Test Group 4: Sending a Message and User Bubble

1. Type a test message: "We're a B2B SaaS company called TestCorp. Our website is testcorp.com"
2. Press Enter (without Shift) to send
3. Verify the user message bubble appears:
   - Right-aligned in the chat
   - Max-width 85% of the chat container
   - Background uses `--bg-hover` token
   - Border-radius is `14px 14px 4px 14px` (rounded top-left, top-right, bottom-right; tight bottom-left)
   - Text color and font are correct (DM Sans)
4. Verify the input clears after sending
5. Take a screenshot showing the user bubble

### Test Group 5: Streaming Response

1. After sending the message, verify the typing indicator appears:
   - 3 bouncing dots visible
   - Dots are approximately 5px circles
   - Dots animate with staggered bounce timing
   - Indicator is left-aligned (assistant side)
2. Wait for the streaming response to begin:
   - Verify the typing indicator disappears when streaming starts
   - Verify the streaming cursor appears (2px wide, blue, blinking inline element)
   - Verify text appears progressively (token-by-token streaming visible)
3. During streaming:
   - Verify the streaming cursor is visible at the end of the current text
   - Verify the AI avatar (24px gradient circle) is visible next to the response
   - Verify the response is left-aligned (assistant side)
4. Wait for streaming to complete:
   - Verify the streaming cursor disappears when the response finishes
   - Verify the complete response is readable and coherent
5. Take a screenshot during streaming (if possible) and after completion

### Test Group 6: Markdown Rendering in AI Response

1. Examine the AI response for markdown rendering:
   - If the response contains bold text (**text**), verify it renders as `<strong>` or bold styling
   - If the response contains lists, verify proper list rendering (`<ul>/<ol>` with `<li>` items)
   - If the response contains code blocks, verify:
     - Code renders in JetBrains Mono font
     - Code block has distinct background styling
2. If the first response does not contain markdown, send a follow-up message that would elicit markdown:
   - "Can you list 3 key things you'd want to know about our target market? Use bullet points."
   - Verify the response renders bullet points correctly

### Test Group 7: Follow-up Conversation Flow

1. After the first AI response completes, type a follow-up message:
   - "Our main competitors are CompA and CompB. We target mid-market companies with 50-500 employees."
2. Send the message and verify:
   - The new user bubble appears below the previous messages
   - Conversation flows naturally (previous messages still visible above)
   - Typing indicator appears again
   - New streaming response begins
3. Verify the conversation history is maintained:
   - Welcome message still visible at top
   - First user message visible
   - First AI response visible
   - Second user message visible
   - Second AI response streaming/visible
4. Take a screenshot of the full conversation

### Test Group 8: Auto-Scroll Behavior

1. If the conversation is long enough to exceed viewport:
   - Verify the chat auto-scrolls to show the latest message
   - Verify auto-scroll happens during streaming (content stays visible)
2. If conversation is short, send additional messages to create scroll:
   - Type and send 2-3 more messages
   - Verify each new message triggers auto-scroll to bottom
3. Scroll up manually, then verify:
   - When a new message arrives, the chat scrolls back to the bottom

### Test Group 9: Design System Token Verification

1. Inspect the page for correct design system token usage:
   - Page background uses `--bg-base` token
   - Header background uses `--bg-elevated` token
   - User bubbles use `--bg-hover` token
   - AI text uses `--text-secondary` token
   - Input border uses `--border-subtle` (default) / `--border-focus` (focused)
   - AI avatar gradient uses `--accent-blue` to `#006fff`
   - Send button uses accent blue tones
2. Verify font usage across the page:
   - Body text and messages: DM Sans (400 weight for body, may vary for emphasis)
   - Logo text: Instrument Sans (700 weight)
   - Any code blocks: JetBrains Mono
3. Verify the centered layout:
   - Chat container max-width is 720px
   - Container is horizontally centered on the page

### Test Group 10: Edge Cases

1. Empty message: Click send button (or press Enter) with empty input — verify nothing is sent
2. Whitespace-only message: Type spaces/newlines only, press Enter — verify nothing is sent (or message is trimmed)
3. Long message: Paste or type a very long message (500+ characters) — verify input handles it gracefully, message sends and displays correctly
4. Rapid messages: After AI responds, quickly type and send another message — verify no UI glitches or duplicate messages
5. Check for console errors throughout all interactions — report any JavaScript errors or warnings

## Acceptance Criteria

- [ ] /journey page loads for authenticated users with centered chat layout
- [ ] Welcome message is visible on page load with correct assistant styling
- [ ] Header shows AI-GOS gradient logo at 56px height, NO step indicators
- [ ] User messages appear as right-aligned bubbles with bg-hover background and 14px 14px 4px 14px radius
- [ ] Typing indicator (3 bouncing dots) appears while waiting for AI response
- [ ] Streaming cursor (blue blinking caret) visible during response generation
- [ ] Streaming cursor disappears when response completes
- [ ] AI responses render with left-aligned layout, 24px gradient avatar, markdown support
- [ ] Follow-up messages work — conversation continues naturally with history preserved
- [ ] Chat auto-scrolls on new messages and during streaming
- [ ] Input auto-resizes for multi-line content up to 120px max
- [ ] Enter sends message, Shift+Enter adds newline
- [ ] Glassmorphism input has focus glow (border-focus + blue box-shadow)
- [ ] Send button shows blue glow when text present, disabled/muted when empty
- [ ] Fonts correct: DM Sans (body), Instrument Sans (logo), JetBrains Mono (code blocks)
- [ ] All colors match design system CSS variable tokens
- [ ] Layout is centered at max-width 720px
- [ ] No console errors during the entire flow
- [ ] Edge cases handled gracefully (empty input, long messages, rapid sends)

## Testing Protocol

### Prerequisites

- [ ] Dev server running at localhost:3000
- [ ] Authenticated Clerk session available
- [ ] Playwright MCP tools loaded and ready

### Execution

All testing is performed via Playwright MCP browser automation:

1. **Navigate and authenticate**: Use `browser_navigate` to go to `/journey`. If redirected to sign-in, authenticate first.
2. **Take snapshots**: Use `browser_snapshot` to inspect the accessibility tree and verify element presence.
3. **Take screenshots**: Use `browser_take_screenshot` at each test group for visual evidence.
4. **Interact**: Use `browser_click`, `browser_fill_form`, `browser_press_key`, `browser_type` for user interactions.
5. **Wait for streaming**: Use `browser_wait_for` to wait for streaming responses to complete (wait for streaming cursor to disappear or for response text to stabilize).
6. **Check console**: Use `browser_console_messages` to verify no JavaScript errors.

### Evidence Collection

For each test group, capture:
- A screenshot after the key interaction
- The browser snapshot (accessibility tree) showing element structure
- Console messages log (check for errors)

### Pass/Fail Criteria

- **PASS**: All acceptance criteria met, no console errors, all screenshots show correct visual output
- **FAIL**: Any acceptance criterion not met. Document which criterion failed and the evidence (screenshot, console error, etc.)
- **PARTIAL**: Most criteria met but minor visual discrepancies. Document deviations.

## Skills to Read

- None specific (this is a testing task)

## Research Files to Read

- `.claude/orchestration-aigos-v2-sprint1/DISCOVERY.md` — Design specifications and component behavior
- `.claude/orchestration-aigos-v2-sprint1/PHASES.md` — Phase 4 testing expectations

## Git

- Branch: `aigos-v2`
- Commit message prefix: `Task 4.1:`
- Note: This task may not produce code changes. If issues are found, fixes should be committed with descriptive messages. If all tests pass, commit a test evidence summary or no commit needed.
