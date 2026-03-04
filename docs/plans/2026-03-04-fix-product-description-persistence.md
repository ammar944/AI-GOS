# Fix productDescription Persistence Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `productDescription` persist to localStorage and count toward the 8/8 completion by routing it through `askUser` instead of asking it as open conversational text.

**Architecture:** The system prompt currently marks `productDescription` as "open text" — the agent asks it conversationally and the user replies as a plain user message. This bypasses `handleAskUserResponse` entirely, so the field is never saved. The fix: tell the agent to use `askUser` with dynamic product archetypes + the existing "Other" chip (which already shows a free-text input and submits via the same `handleAskUserResponse` path). Zero frontend changes needed.

**Tech Stack:** System prompt only (`src/lib/ai/prompts/lead-agent-system.ts`). One file, one paragraph change.

---

## Task 1: Update System Prompt — Route productDescription through askUser

**Files:**
- Modify: `src/lib/ai/prompts/lead-agent-system.ts` (line 135)

**Step 1: Read the current instruction**

Open `src/lib/ai/prompts/lead-agent-system.ts` and find this exact line (currently line 135):

```
4. **productDescription** — open text. Ask them to describe what they sell in their own words. Push back if they're vague.
```

**Step 2: Replace it**

Replace that line with:

```
4. **productDescription** — askUser: generate 3–4 product archetypes based on their businessModel + industry. E.g., for a B2B SaaS agency → "Paid media management & strategy", "Performance marketing retainer", "Growth-as-a-service / fractional CMO", "SaaS / software product". Always include an "Other" option — the user can type their exact description there. The chip labels should be short (3–6 words); don't make them generic. Never ask this as a plain text question.
```

**Step 3: Run build**

```bash
npm run build
```
Expected: exits 0, no new TypeScript errors.

**Step 4: Commit**

```bash
git add src/lib/ai/prompts/lead-agent-system.ts
git commit -m "fix: productDescription via askUser — persists to localStorage, counts toward 8/8"
```

---

## Task 2: Verify with Playwright E2E

**Goal:** Confirm `productDescription` now persists (Client Dossier shows 8/8, Company Intel panel fills the Product field).

**Step 1: Navigate to /journey**

Start a fresh session. If a resume prompt appears, click "Start Fresh".

**Step 2: Run through onboarding**

Use the ScaleWorks persona again. For each `askUser` question, click a chip or "Other" + type.

For `productDescription`, the agent should now show chips like "Paid media management", "Performance marketing retainer", etc. Click one (or click "Other" and type a custom description).

**Step 3: Verify persistence**

After submitting the `productDescription` chip:
- Check the browser console: `JSON.parse(localStorage.getItem('aigos_session'))` — `productDescription` should be non-null
- Check the Client Dossier counter in the UI — should increment to the appropriate count

**Step 4: Run to completion**

Complete all 8 fields and reach the confirmation step. Verify:
- Client Dossier shows 8/8
- The confirmation `askUser` appears
- Clicking "Looks good" triggers the completion flow

**Step 5: Report pass/fail**

Report exactly what the productDescription chip options were and whether the field persisted.

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/lib/ai/prompts/lead-agent-system.ts` | Route `productDescription` through `askUser` with dynamic archetypes instead of open conversational text |

## Non-Goals

- No frontend changes — `askUser` already handles "Other" with free-text input
- No changes to `handleAskUserResponse` — it already extracts `otherText` correctly
- No changes to `session-state.ts` — `productDescription` is already a required field
