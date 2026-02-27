# Task 3.R: Phase 3 Regression

## Objective

Full regression test of the integrated journey page. Verify the streaming API route, page orchestrator, and all Phase 2 components work together end-to-end. Confirm existing v1 pages (dashboard, generate) are unaffected. This is the final gate before Phase 3 is marked complete.

## Context

Regression gate for Phase 3. All implementation tasks (3.1, 3.2) must be complete. This task validates the full vertical slice: user navigates to `/journey`, sees a welcome message, types a message, sees streaming AI response with typing indicator and streaming cursor, and the conversation continues naturally. Additionally, v1 pages must not regress.

## Dependencies

- Task 3.1 (Streaming API Route) — complete
- Task 3.2 (Journey Page Orchestrator) — complete
- All Phase 1 and Phase 2 tasks — complete

## Blocked By

- Tasks 3.1, 3.2

## Testing Protocol

### 1. Build/Lint/Type Checks

- [ ] `npm run build` succeeds with zero new errors
- [ ] `npm run lint` passes with zero new warnings
- [ ] No new TypeScript errors introduced (pre-existing errors in test files are acceptable per CLAUDE.md)

### 2. File Existence Verification

- [ ] `src/app/api/journey/stream/route.ts` exists
- [ ] `src/app/journey/page.tsx` exists
- [ ] All 6 Phase 2 component files still exist in `src/components/journey/`:
  - [ ] `journey-layout.tsx`
  - [ ] `journey-header.tsx`
  - [ ] `chat-message.tsx`
  - [ ] `chat-input.tsx`
  - [ ] `streaming-cursor.tsx`
  - [ ] `typing-indicator.tsx`
- [ ] `src/lib/ai/prompts/lead-agent-system.ts` exists (Phase 1)
- [ ] `src/lib/ai/providers.ts` contains `MODELS.CLAUDE_OPUS` (Phase 1)

### 3. Import Chain Verification

Verify the full import chain compiles without errors:

```typescript
// Route imports
import { anthropic, MODELS } from '@/lib/ai/providers';
import { LEAD_AGENT_SYSTEM_PROMPT } from '@/lib/ai/prompts/lead-agent-system';

// Page imports
import { JourneyLayout } from '@/components/journey/journey-layout';
import { JourneyHeader } from '@/components/journey/journey-header';
import { ChatMessage } from '@/components/journey/chat-message';
import { JourneyChatInput } from '@/components/journey/chat-input';
import { TypingIndicator } from '@/components/journey/typing-indicator';
import { StreamingCursor } from '@/components/journey/streaming-cursor';
import { LEAD_AGENT_WELCOME_MESSAGE } from '@/lib/ai/prompts/lead-agent-system';
```

All of the above should resolve without errors during `npm run build`.

### 4. API Route Verification

Test the streaming API route directly:

```bash
# Unauthenticated request should return 401
curl -s -o /dev/null -w "%{http_code}" \
  -X POST http://localhost:3000/api/journey/stream \
  -H "Content-Type: application/json" \
  -d '{"messages":[]}'
# Expected: 401

# Missing messages should return 400 (when authenticated)
# This must be tested via browser or Playwright since Clerk auth is cookie-based
```

- [ ] Unauthenticated POST returns 401 JSON response
- [ ] POST with missing/invalid `messages` returns 400 JSON response
- [ ] Authenticated POST with valid messages returns streaming response
- [ ] Response headers indicate SSE/streaming content type
- [ ] No server-side errors in terminal logs during streaming

### 5. Playwright: Journey Page End-to-End Flow

Full user flow test with Playwright:

```typescript
// Navigate to /journey (must be authenticated)
await page.goto('/journey');

// ── Welcome State ────────────────────────────────────────────────────
// Welcome message should be visible
await expect(page.getByText('Good to meet you.')).toBeVisible();
await expect(page.getByText('Tell me about your business...')).toBeVisible();

// Screenshot: Welcome state
await page.screenshot({ path: 'journey-welcome.png', fullPage: true });

// ── Header ───────────────────────────────────────────────────────────
// Logo should be visible
await expect(page.getByText('AI-GOS')).toBeVisible();

// ── Send Message ─────────────────────────────────────────────────────
// Type in the input
const input = page.locator('textarea');
await input.fill('We sell AI-powered call routing software for enterprise contact centers.');
await input.press('Enter');

// User message should appear
await expect(page.getByText('AI-powered call routing software')).toBeVisible();

// Screenshot: Message sent, waiting for response
await page.screenshot({ path: 'journey-submitted.png', fullPage: true });

// ── Streaming Response ───────────────────────────────────────────────
// Wait for AI response to start (assistant message appears)
// The response text will vary, so wait for any new content to appear
await page.waitForSelector('[data-role="assistant"]', { timeout: 30000 });
// Or if no data-role attribute, wait for the typing indicator to appear and disappear
// await page.waitForTimeout(2000); // Allow streaming to begin

// Screenshot: Streaming in progress
await page.screenshot({ path: 'journey-streaming.png', fullPage: true });

// Wait for streaming to complete (input becomes enabled again)
// The input should be re-enabled once status returns to 'ready'
await page.waitForFunction(() => {
  const textarea = document.querySelector('textarea');
  return textarea && !textarea.disabled;
}, { timeout: 60000 });

// Screenshot: Response complete
await page.screenshot({ path: 'journey-complete.png', fullPage: true });

// ── Layout Verification ──────────────────────────────────────────────
// Verify centered layout (max-width 720px)
// The chat panel should be horizontally centered
```

- [ ] `/journey` loads successfully (200 response)
- [ ] Welcome message is visible in the DOM
- [ ] "AI-GOS" logo header is visible
- [ ] Input field accepts text
- [ ] Pressing Enter sends the message
- [ ] User message bubble appears (right-aligned)
- [ ] AI response streams in (left-aligned with avatar)
- [ ] Streaming cursor is visible during streaming
- [ ] Typing indicator appears before first token arrives
- [ ] Input is re-enabled after response completes
- [ ] Auto-scroll keeps new content visible
- [ ] No JavaScript errors in console

### 6. Playwright: V1 Page Regression

Existing pages must still work:

```typescript
// Dashboard
await page.goto('/dashboard');
await expect(page).toHaveURL(/dashboard/);
// Should render without errors

// Generate page
await page.goto('/generate');
await expect(page).toHaveURL(/generate/);
// Should render without errors
```

- [ ] `/dashboard` renders correctly — no visual regressions
- [ ] `/generate` renders correctly — no visual regressions
- [ ] No new console errors on v1 pages
- [ ] No import side effects from journey components affecting v1 pages

### 7. Streaming UX Quality

Verify the streaming UX feels correct:

- [ ] Typing indicator (bouncing dots) appears ONLY when `status === 'submitted'`
- [ ] Typing indicator disappears when first token arrives
- [ ] Streaming cursor (blinking caret) appears during `status === 'streaming'`
- [ ] Streaming cursor disappears when response completes (`status === 'ready'`)
- [ ] Typing indicator and streaming cursor are never visible simultaneously
- [ ] Response text appears incrementally (not all-at-once)

### 8. Error Handling

- [ ] If API key is missing/invalid, error banner appears (red background, descriptive text)
- [ ] If network disconnects mid-stream, error is handled gracefully (no crash, error shown)
- [ ] After an error, user can attempt to send another message (recovery works)

### 9. Mobile Responsiveness (Optional, not blocking)

- [ ] Page renders acceptably on mobile viewport (375px width)
- [ ] Input field is usable on mobile
- [ ] Messages don't overflow horizontally

### 10. Screenshots

Capture the following screenshots for review:

- [ ] `journey-welcome.png` — Welcome state with welcome message and empty input
- [ ] `journey-submitted.png` — After sending first message, before AI responds
- [ ] `journey-streaming.png` — During AI streaming response
- [ ] `journey-complete.png` — After AI response completes, ready for next input

## Acceptance Criteria

- [ ] All checks in sections 1-8 pass
- [ ] 2 new files created (route + page)
- [ ] 6 Phase 2 component files still intact
- [ ] 2 Phase 1 foundation files still intact (prompt + providers)
- [ ] No TypeScript errors (beyond pre-existing test file errors)
- [ ] No visual regressions on v1 pages (/dashboard, /generate)
- [ ] Full streaming round-trip works: user sends message → AI streams response → user can send follow-up
- [ ] AI response reflects lead agent persona (warm, direct, asks smart questions)
- [ ] 4 screenshots captured documenting each state

## Post-Regression Notes

Once this regression passes:
- Phase 3 is complete
- The `/journey` page is a working conversational AI experience
- Sprint 1 scope is: welcome message + freeform conversation + streaming UX
- NOT in Sprint 1: tools, session persistence, phase transitions, blueprint generation

## Git

- Branch: `aigos-v2`
- Commit message prefix: `Task 3.R:`
