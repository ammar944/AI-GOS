# Task 5.2: Edge Case E2E Tests — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Test all non-happy-path scenarios via Playwright MCP — "Other" selection, multi-select, free text while chips pending, localStorage persistence, thinking block interactions, page reload resilience, and rapid clicking.

**Architecture:** Each test runs via Playwright MCP against `http://localhost:3000/journey`. Tests are sequential (each depends on conversation state from previous). Screenshots captured as evidence for every edge case.

**Tech Stack:** Playwright MCP (browser automation), DevTools evaluation (localStorage inspection), screenshots for evidence

---

## Prerequisites

- Dev server running at `http://localhost:3000`
- Task 5.1 (happy path) completed successfully
- `npm run build` passes

---

### Task 1: Setup — Clear State and Start Fresh Session

**Step 1: Clear localStorage and navigate**

Using Playwright MCP:
1. Navigate to `http://localhost:3000/journey`
2. Run `browser_evaluate`: `localStorage.removeItem('aigog_journey_session')`
3. Reload page
4. Screenshot: `edge-case-1-fresh-start.png`

**Step 2: Verify clean state**

Run `browser_evaluate`: `localStorage.getItem('aigog_journey_session')`
Expected: `null`

**Step 3: Send initial company info**

Type and send: "I run a B2B SaaS company called TestEdge that sells project management tools to mid-market companies. Our website is testedge.com"

Wait for agent to respond with first askUser chip card.

Screenshot: `edge-case-1-first-chips.png`

---

### Task 2: "Other" Selection (DISCOVERY D3)

**Context:** When askUser chips appear, test the "Other" chip workflow: click → text input appears → type custom → submit → agent acknowledges.

**Step 1: Identify "Other" chip**

Take a snapshot (`browser_snapshot`) to find the "Other" chip element. It should have dashed border styling and be the last chip in the group.

**Step 2: Click "Other" chip**

Click the "Other" chip using `browser_click`.

**Step 3: Verify text input appears**

Take snapshot. Verify:
- Text input is visible below chip group
- Input is auto-focused
- "Other" chip is visually distinct (dashed border)

Screenshot: `edge-case-2-other-input.png`

**Step 4: Type custom answer**

Using `browser_type` or `browser_fill_form`, type: "Custom niche industry not listed"

Screenshot: `edge-case-2-other-typed.png`

**Step 5: Submit via Enter**

Press Enter key using `browser_press_key`.

**Step 6: Verify submission**

Take snapshot. Verify:
- Card becomes disabled (chips non-interactive)
- "Other" chip shows as selected with the typed text visible
- Agent responds acknowledging the custom input

Screenshot: `edge-case-2-other-submitted.png`

---

### Task 3: Multi-Select Toggle (Marketing Channels)

**Context:** Continue conversation until a multi-select question appears (marketing channels). Test toggle behavior, "Done" button, and submission.

**Step 1: Continue conversation to reach multi-select question**

Continue answering agent questions by clicking chips (pick whatever reasonable option) until the marketing channels question appears. This is a multi-select question (`multiSelect: true`).

If agent asks questions before marketing channels, click reasonable options to progress.

Screenshot when multi-select appears: `edge-case-3-multiselect-appears.png`

**Step 2: Toggle first chip**

Take snapshot, find a channel chip (e.g., "Google Ads"). Click it.

Verify: Chip toggles to selected state (blue highlight).

**Step 3: Toggle second chip**

Click another chip (e.g., "LinkedIn Ads").

Verify: Both chips now selected.

Screenshot: `edge-case-3-two-selected.png`

**Step 4: Deselect first chip**

Click "Google Ads" again.

Verify: Chip toggles back to unselected. Only "LinkedIn Ads" remains selected.

**Step 5: Re-select and submit**

Click "Google Ads" again (both selected now).

Verify: "Done" button is visible with count (e.g., "Done (2)").

Click "Done" button.

Screenshot: `edge-case-3-done-submitted.png`

**Step 6: Verify submission**

Take snapshot. Verify:
- Card becomes disabled
- Selected chips highlighted
- Agent acknowledges selected channels

---

### Task 4: Thinking Block Interaction (DISCOVERY D4, D5)

**Context:** During any agent response, verify thinking block behavior: collapsed by default, expandable, timer, blue border.

**Step 1: Observe thinking block during next response**

After the multi-select submission, the agent will respond. During or after streaming, take a snapshot to find thinking block elements.

**Step 2: Verify collapsed by default**

Take snapshot. Find thinking block.
Verify: Block is collapsed (content not visible, just header "Thinking for X.Xs" or "Thought for X.Xs").

Screenshot: `edge-case-4-thinking-collapsed.png`

**Step 3: Expand thinking block**

Click the thinking block header/chevron.

Verify:
- Block expands showing reasoning text
- Blue left border visible (`--accent-blue`)
- Label shows "Thought for X.Xs" (frozen timer since streaming is done)

Screenshot: `edge-case-4-thinking-expanded.png`

**Step 4: Collapse thinking block**

Click header again.

Verify: Block collapses back.

**Step 5: Verify blue border**

Run `browser_evaluate` to check computed border style:
```javascript
const block = document.querySelector('[data-testid="thinking-block"]') || document.querySelector('.thinking-block');
if (block) {
  const style = getComputedStyle(block);
  return { borderLeft: style.borderLeft, borderLeftColor: style.borderLeftColor };
}
```

Expected: Blue border color matching `--accent-blue`.

---

### Task 5: localStorage Persistence

**Context:** After answering several questions via chips, verify localStorage contains the session data.

**Step 1: Read localStorage**

Run `browser_evaluate`:
```javascript
JSON.parse(localStorage.getItem('aigog_journey_session') || 'null')
```

**Step 2: Verify structure**

Check the returned JSON:
- Contains fields matching selections made (e.g., `industry`, `marketingChannels`)
- `completionPercent` reflects answered required fields (should be > 0)
- `lastUpdated` is a recent ISO timestamp
- `phase` is `'onboarding'`

Screenshot DevTools (or log output): `edge-case-5-localstorage.png`

**Step 3: Verify completionPercent accuracy**

Count required fields answered so far. Verify `completionPercent` equals `(answeredCount / 8) * 100`.

---

### Task 6: Free Text While Chips Pending (DISCOVERY D23)

**Context:** When askUser chips are showing (waiting for selection), type in the chat input and send free text. Verify no crash, agent handles gracefully, chips remain interactive.

**Step 1: Wait for next askUser chips**

Continue conversation until the next askUser card appears with chips.

Screenshot: `edge-case-6-chips-pending.png`

**Step 2: Type free text in chat input**

Instead of clicking a chip, find the chat input field and type: "Actually, can I change my previous answer?"

Submit the free text message (press Enter or click send).

**Step 3: Verify graceful handling**

Take snapshot. Verify:
- No crash, no console errors
- Agent responds to the free text (may ask user to select a chip)
- The pending askUser card is still visible and interactive (chips still clickable)

Check console: Run `browser_console_messages` to verify no JavaScript errors.

Screenshot: `edge-case-6-freetext-response.png`

**Step 4: Now click a chip**

Click a chip on the still-pending askUser card.

Verify: Selection submits normally, card becomes disabled, conversation continues.

Screenshot: `edge-case-6-chip-after-freetext.png`

---

### Task 7: Page Reload Resilience

**Context:** After answering several questions, hard refresh the page. Verify behavior per DISCOVERY D15 (no resume, but localStorage preserved).

**Step 1: Note current state**

Run `browser_evaluate`:
```javascript
const session = JSON.parse(localStorage.getItem('aigog_journey_session') || 'null');
return { completionPercent: session?.completionPercent, fieldCount: session?.requiredFieldsCompleted };
```

Screenshot: `edge-case-7-before-reload.png`

**Step 2: Hard refresh**

Navigate to `http://localhost:3000/journey` (equivalent to hard refresh).

**Step 3: Verify post-reload state**

Take snapshot. Verify:
- Page loads without errors
- Conversation is NOT preserved (fresh chat — Sprint 2 doesn't resume)
- Welcome message shows again

**Step 4: Verify localStorage survives**

Run `browser_evaluate`:
```javascript
const session = JSON.parse(localStorage.getItem('aigog_journey_session') || 'null');
return { completionPercent: session?.completionPercent, fieldCount: session?.requiredFieldsCompleted, lastUpdated: session?.lastUpdated };
```

Verify: Data still present (not cleared on refresh).

**Step 5: Verify progress bar hydration**

Take snapshot. Verify: Progress bar shows the hydrated value from localStorage (not 0%).

Screenshot: `edge-case-7-after-reload.png`

---

### Task 8: Rapid Clicking

**Context:** When askUser card appears, rapidly click two different chips. Verify only first click registers.

**Step 1: Start a new interaction**

Send a message to trigger a new askUser card (the agent should continue from the fresh session after reload).

Wait for chips to appear.

Screenshot: `edge-case-8-before-rapid.png`

**Step 2: Rapid double-click**

Using `browser_click`, rapidly click the first chip, then immediately click the second chip (minimal delay between clicks).

**Step 3: Verify single registration**

Take snapshot. Verify:
- Only one chip is selected/highlighted (not both)
- Card transitioned to submitted state after first click
- No console errors

Check console: Run `browser_console_messages` for any JavaScript errors.

Screenshot: `edge-case-8-after-rapid.png`

---

### Task 9: Final Verification — Evidence Compilation

**Step 1: Collect all screenshots**

Verify all screenshots were captured:
- `edge-case-1-fresh-start.png`
- `edge-case-1-first-chips.png`
- `edge-case-2-other-input.png`
- `edge-case-2-other-typed.png`
- `edge-case-2-other-submitted.png`
- `edge-case-3-multiselect-appears.png`
- `edge-case-3-two-selected.png`
- `edge-case-3-done-submitted.png`
- `edge-case-4-thinking-collapsed.png`
- `edge-case-4-thinking-expanded.png`
- `edge-case-5-localstorage.png`
- `edge-case-6-chips-pending.png`
- `edge-case-6-freetext-response.png`
- `edge-case-6-chip-after-freetext.png`
- `edge-case-7-before-reload.png`
- `edge-case-7-after-reload.png`
- `edge-case-8-before-rapid.png`
- `edge-case-8-after-rapid.png`

**Step 2: Run final build + lint**

```bash
npm run build
```

Verify: Exit 0, no new errors.

**Step 3: Summarize results**

Create a test results summary mapping each edge case to PASS/FAIL with screenshot evidence.
