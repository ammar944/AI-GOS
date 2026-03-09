# Journey Onboarding Bugfix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 5 bugs in the journey onboarding flow — blank screen after prefill, missing research streaming, unresponsive buttons, dual ask-user state, missing revision feedback.

**Architecture:** Two independent tracks. Track 1 adds a `mergeExternalFields()` helper to `journey-state.ts` and calls it in `route.ts` to merge `resumeState` into `journeySnap`. Track 2 verifies research streaming, consolidates ask-user card state, and adds revision loading UX.

**Tech Stack:** Next.js, Vercel AI SDK v6, Vitest, React, Framer Motion

---

## Track 1: State & Context (Bugs 1 + 3)

### Task 1: Add `mergeExternalFields` helper with tests

**Files:**
- Modify: `src/lib/ai/journey-state.ts:15-24` (export REQUIRED_FIELDS), add function after line 111
- Test: `src/lib/ai/__tests__/journey-state.test.ts`

**Step 1: Write the failing tests**

Add to `src/lib/ai/__tests__/journey-state.test.ts`:

```typescript
import { parseCollectedFields, mergeExternalFields } from '../journey-state';

// ... existing tests ...

describe('mergeExternalFields', () => {
  it('merges resume fields into empty snapshot', () => {
    const snap = parseCollectedFields([]);
    const merged = mergeExternalFields(snap, {
      websiteUrl: 'https://acme.com',
      businessModel: 'B2B SaaS',
      primaryIcpDescription: 'Dev teams',
    });
    expect(merged.collectedFields.websiteUrl).toBe('https://acme.com');
    expect(merged.collectedFields.businessModel).toBe('B2B SaaS');
    expect(merged.requiredFieldCount).toBe(3);
  });

  it('does not override message-derived fields', () => {
    const messages = [makeAskUserResultMessage('businessModel', 'B2C eCommerce')];
    const snap = parseCollectedFields(messages);
    const merged = mergeExternalFields(snap, {
      businessModel: 'B2B SaaS',
      websiteUrl: 'https://acme.com',
    });
    expect(merged.collectedFields.businessModel).toBe('B2C eCommerce');
    expect(merged.collectedFields.websiteUrl).toBe('https://acme.com');
    expect(merged.requiredFieldCount).toBe(2);
  });

  it('ignores null/undefined/empty-string values', () => {
    const snap = parseCollectedFields([]);
    const merged = mergeExternalFields(snap, {
      websiteUrl: '',
      businessModel: null,
      primaryIcpDescription: undefined,
      productDescription: 'Analytics',
    });
    expect(merged.collectedFields.websiteUrl).toBeUndefined();
    expect(merged.collectedFields.businessModel).toBeUndefined();
    expect(merged.requiredFieldCount).toBe(1);
  });

  it('preserves synthComplete and competitorFastHitsCalledFor', () => {
    const snap = parseCollectedFields([]);
    snap.synthComplete = true;
    snap.competitorFastHitsCalledFor = new Set(['acme.com']);
    const merged = mergeExternalFields(snap, { websiteUrl: 'https://acme.com' });
    expect(merged.synthComplete).toBe(true);
    expect(merged.competitorFastHitsCalledFor.has('acme.com')).toBe(true);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/lib/ai/__tests__/journey-state.test.ts`
Expected: FAIL — `mergeExternalFields` is not exported

**Step 3: Implement `mergeExternalFields`**

In `src/lib/ai/journey-state.ts`, first change line 16 from `const` to `export const`:

```typescript
export const REQUIRED_FIELDS = [
```

Then add after the closing brace of `parseCollectedFields` (after line 111):

```typescript
/**
 * Merge external field values (e.g. from resumeState or prefill) into a
 * snapshot derived from message history. Message-derived fields take priority.
 * Returns a new snapshot with recomputed requiredFieldCount.
 */
export function mergeExternalFields(
  snapshot: JourneyStateSnapshot,
  externalFields: Record<string, unknown>,
): JourneyStateSnapshot {
  const merged = { ...snapshot.collectedFields };
  for (const [key, value] of Object.entries(externalFields)) {
    if (isCollectedValue(value) && !isCollectedValue(merged[key])) {
      merged[key] = value;
    }
  }
  const requiredFieldCount = REQUIRED_FIELDS.filter((f: RequiredField) =>
    isCollectedValue(merged[f]),
  ).length;

  return {
    ...snapshot,
    collectedFields: merged,
    requiredFieldCount,
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/lib/ai/__tests__/journey-state.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/lib/ai/journey-state.ts src/lib/ai/__tests__/journey-state.test.ts
git commit -m "feat: add mergeExternalFields helper to journey-state"
```

---

### Task 2: Wire `mergeExternalFields` into stream route

**Files:**
- Modify: `src/app/api/journey/stream/route.ts:33,178`

**Step 1: Add import**

In `src/app/api/journey/stream/route.ts`, change line 33 from:

```typescript
import { parseCollectedFields } from '@/lib/ai/journey-state';
```

to:

```typescript
import { parseCollectedFields, mergeExternalFields } from '@/lib/ai/journey-state';
```

**Step 2: Merge resumeState into journeySnap**

After line 178 (`const journeySnap = parseCollectedFields(sanitizedMessages);`), add:

```typescript
  // Merge prefill/resume fields that aren't yet visible in message history.
  // Message-derived fields take priority — resumeState only fills gaps.
  if (
    body.resumeState &&
    typeof body.resumeState === 'object' &&
    Object.keys(body.resumeState).length > 0
  ) {
    const merged = mergeExternalFields(journeySnap, body.resumeState as Record<string, unknown>);
    journeySnap.collectedFields = merged.collectedFields;
    journeySnap.requiredFieldCount = merged.requiredFieldCount;
  }
```

Note: `journeySnap` is `const` but its properties are mutable objects. We reassign the object properties, not the binding. If TypeScript complains, change the declaration to `let journeySnap`.

**Step 3: Run existing tests**

Run: `npm run test:run -- src/lib/ai/__tests__/journey-state.test.ts`
Expected: ALL PASS (route.ts has no unit tests — verified via build)

**Step 4: Run build to verify no TS errors**

Run: `npm run build`
Expected: Exits 0 with no type errors in route.ts

**Step 5: Commit**

```bash
git add src/app/api/journey/stream/route.ts
git commit -m "fix: merge resumeState into journeySnap so agent sees prefill fields"
```

---

## Track 2: Streaming & Feedback (Bugs 2 + 4 + 5)

### Task 3: Verify research streaming reaches frontend

**Files:**
- Modify: `src/app/journey/page.tsx:376` (add temporary console.log)

**Step 1: Add diagnostic logging**

In `src/app/journey/page.tsx`, inside the `onData` callback, after line 376 (`if (dataPart.type === 'data-research-chunk') {`), add:

```typescript
        console.log('[research-stream-debug] chunk received:', sectionId, text.slice(0, 40));
```

And after line 391 (`if (dataPart.type === 'data-research-status') {`), add:

```typescript
        console.log('[research-stream-debug] status received:', sectionId, status);
```

**Step 2: Manual test**

Run: `npm run dev`
1. Open browser to `localhost:3000/journey`
2. Enter a website URL, complete prefill review
3. Chat until the agent triggers `generateResearch`
4. Open browser console — check for `[research-stream-debug]` logs

**Expected outcomes:**
- **If logs appear**: Streaming works, the issue is rendering. Proceed to Task 3b (skip).
- **If no logs**: Events don't reach frontend. Proceed to Task 3c (Supabase fallback).

**Step 3: Remove diagnostic logging after verification**

Remove the two `console.log` lines added in Step 1.

**Step 4: Commit (only if code changes were needed)**

If streaming works: no commit needed (remove debug logs).
If streaming doesn't work: commit will happen in Task 3c.

---

### Task 3c (CONDITIONAL): Supabase realtime fallback for research streaming

> Only implement this if Task 3 Step 2 confirms events don't reach frontend.

This is a larger task that hooks `useResearchRealtime` into `researchStreaming` state. Since the realtime subscription already exists and detects section completion, the change is to also emit intermediate status updates. **Design this if needed — skip for now.**

---

### Task 4: Fix ask-user card dual state

**Files:**
- Modify: `src/components/journey/ask-user-card.tsx:274-299`
- Test: `src/components/journey/__tests__/ask-user-card.test.tsx`

**Step 1: Write the failing test**

Add to `src/components/journey/__tests__/ask-user-card.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AskUserCard } from '../ask-user-card';

// ... existing framer-motion mock ...

describe('AskUserCard submission state', () => {
  it('disables all chips when isSubmitted is true', () => {
    render(
      <AskUserCard
        toolCallId="ask-1"
        question="Pick one"
        fieldName="businessModel"
        options={[{ label: 'B2B' }, { label: 'B2C' }]}
        multiSelect={false}
        isSubmitted={true}
        selectedIndices={[0]}
        onSubmit={vi.fn()}
      />,
    );

    const chips = screen.getAllByRole('radio');
    for (const chip of chips) {
      expect(chip).toHaveAttribute('aria-disabled', 'true');
    }
  });

  it('syncs cardState to submitted when isSubmitted prop changes to true', () => {
    const { rerender } = render(
      <AskUserCard
        toolCallId="ask-1"
        question="Pick one"
        fieldName="businessModel"
        options={[{ label: 'B2B' }, { label: 'B2C' }]}
        multiSelect={false}
        isSubmitted={false}
        selectedIndices={[]}
        onSubmit={vi.fn()}
      />,
    );

    // Chips should be interactive
    const chips = screen.getAllByRole('radio');
    expect(chips[0]).not.toHaveAttribute('aria-disabled', 'true');

    // Parent marks as submitted
    rerender(
      <AskUserCard
        toolCallId="ask-1"
        question="Pick one"
        fieldName="businessModel"
        options={[{ label: 'B2B' }, { label: 'B2C' }]}
        multiSelect={false}
        isSubmitted={true}
        selectedIndices={[0]}
        onSubmit={vi.fn()}
      />,
    );

    for (const chip of screen.getAllByRole('radio')) {
      expect(chip).toHaveAttribute('aria-disabled', 'true');
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/components/journey/__tests__/ask-user-card.test.tsx`
Expected: May pass or fail depending on current aria-disabled behavior. If it passes, the dual state isn't causing issues in this path — skip to Task 5.

**Step 3: Add useEffect to sync isSubmitted prop into cardState**

In `src/components/journey/ask-user-card.tsx`, after line 289 (`const [focusedIndex, setFocusedIndex] = useState(0);`), add:

```typescript
  // Sync external submission state into internal cardState —
  // prevents divergence between prop and local state.
  useEffect(() => {
    if (isSubmitted && cardState !== 'submitted') {
      setCardState('submitted');
    }
  }, [isSubmitted, cardState]);
```

**Step 4: Run tests**

Run: `npm run test:run -- src/components/journey/__tests__/ask-user-card.test.tsx`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/components/journey/ask-user-card.tsx src/components/journey/__tests__/ask-user-card.test.tsx
git commit -m "fix: sync isSubmitted prop into ask-user card internal state"
```

---

### Task 5: Add revision loading feedback to research card shell

**Files:**
- Modify: `src/components/journey/research-cards/research-card-shell.tsx:22,41,246-251`
- Test: `src/components/journey/__tests__/research-card-shell.test.tsx`

**Step 1: Write the failing test**

Add a new test to `src/components/journey/__tests__/research-card-shell.test.tsx` (create if it doesn't exist with the framer-motion mock from ask-user-card tests):

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import type { HTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ResearchCardShell } from '../research-cards/research-card-shell';
import { BarChart3 } from 'lucide-react';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      variants: _v,
      initial: _i,
      animate: _a,
      exit: _e,
      transition: _t,
      ...props
    }: HTMLAttributes<HTMLDivElement> & Record<string, unknown>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('ResearchCardShell revision feedback', () => {
  it('shows revising indicator after submitting a revision note', () => {
    const onRevision = vi.fn();
    render(
      <ResearchCardShell
        icon={BarChart3}
        label="Industry Research"
        accentColor="blue"
        status="complete"
        onRequestRevision={onRevision}
      >
        <p>Content here</p>
      </ResearchCardShell>,
    );

    // Open revision composer
    fireEvent.click(screen.getByText('Revise'));

    // Type a note
    const textarea = screen.getByPlaceholderText(/narrow the icp/i);
    fireEvent.change(textarea, { target: { value: 'Focus on healthcare only' } });

    // Submit
    fireEvent.click(screen.getByText('Submit revision'));

    // Callback fired
    expect(onRevision).toHaveBeenCalledWith('Focus on healthcare only');

    // Loading indicator visible
    expect(screen.getByText('Revising…')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/components/journey/__tests__/research-card-shell.test.tsx`
Expected: FAIL — "Revising…" text not found

**Step 3: Add revisionPending state**

In `src/components/journey/research-cards/research-card-shell.tsx`:

Add state on line 41 (after `const [revisionNote, setRevisionNote] = useState('');`):

```typescript
  const [revisionPending, setRevisionPending] = useState(false);
```

Replace the submit button's onClick (lines 246-252) from:

```typescript
                          onClick={() => {
                            const note = revisionNote.trim();
                            if (!note) return;
                            onRequestRevision(note);
                            setShowRevisionComposer(false);
                            setRevisionNote('');
                          }}
```

to:

```typescript
                          onClick={() => {
                            const note = revisionNote.trim();
                            if (!note) return;
                            onRequestRevision(note);
                            setShowRevisionComposer(false);
                            setRevisionNote('');
                            setRevisionPending(true);
                          }}
```

Then add the "Revising…" indicator. Find the closing `</div>` of the revision composer block (around line 281, after the Cancel button's parent div closes). After the `{showRevisionComposer && onRequestRevision && (` block closes, add:

```typescript
                  {revisionPending && !showRevisionComposer && (
                    <div
                      className="mt-2 flex items-center gap-2 text-xs font-medium"
                      style={{ color: 'var(--accent-red)' }}
                    >
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Revising…
                    </div>
                  )}
```

Clear `revisionPending` when status changes back to streaming/running. Add a useEffect after the existing state declarations:

```typescript
  // Clear revision pending when the section starts re-running
  useEffect(() => {
    if (status === 'streaming' && revisionPending) {
      setRevisionPending(false);
    }
  }, [status, revisionPending]);
```

**Step 4: Run tests**

Run: `npm run test:run -- src/components/journey/__tests__/research-card-shell.test.tsx`
Expected: ALL PASS

**Step 5: Run build**

Run: `npm run build`
Expected: Exits 0

**Step 6: Commit**

```bash
git add src/components/journey/research-cards/research-card-shell.tsx src/components/journey/__tests__/research-card-shell.test.tsx
git commit -m "fix: show revising indicator after submitting research revision note"
```

---

## Verification

### Task 6: Full verification pass

**Step 1: Run all tests**

Run: `npm run test:run`
Expected: All existing tests pass, no regressions

**Step 2: Run build**

Run: `npm run build`
Expected: Exits 0

**Step 3: Manual smoke test**

Run: `npm run dev`

Test flow:
1. Go to `/journey`
2. Enter a website URL → watch prefill stream → review proposals
3. Click "Use this" on some fields, "Reject" on others
4. Click "Use these details and continue"
5. **Verify**: Chat area shows immediately, agent acknowledges known fields (Bug 1 fixed)
6. **Verify**: Buttons responded visually during review (Bug 3 fixed)
7. Chat until research triggers
8. **Verify**: Research progress shows "running" state with streaming text (Bug 2 — check console)
9. If research card is complete, click "Revise" → type note → submit
10. **Verify**: "Revising…" indicator appears (Bug 5 fixed)

**Step 4: Final commit (if any manual fixes needed)**

```bash
git add -A
git commit -m "fix: journey onboarding bugfix verification pass"
```
