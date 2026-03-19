# Post-Calendly Test Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 8 issues found during Calendly.com test run — 4 bugs, 3 UX fixes, 1 feature integration.

**Architecture:** All fixes are isolated, independent changes. Each task produces one atomic commit. No new files needed — all modifications to existing components.

**Tech Stack:** Next.js, React, Tailwind CSS, Framer Motion, Supabase

**Spec:** `docs/superpowers/specs/2026-03-19-post-calendly-test-fixes-design.md`

---

### Task 1: Fix section numbering to match new pipeline order

**Files:**
- Modify: `src/lib/journey/section-meta.ts:8-14` — update `moduleNumber` values

- [ ] **Step 1: Read current section-meta.ts and update moduleNumber values**

Current order has `competitors: '02'` and `icpValidation: '03'`. Update to match the new pipeline:
```
industryMarket:  '01'
icpValidation:   '02'
offerAnalysis:   '03'
competitors:     '04'
keywordIntel:    '05'
crossAnalysis:   '06'
mediaPlan:       '07'
```

- [ ] **Step 2: Check artifact-canvas.tsx for duplicate label map**

`src/components/workspace/artifact-canvas.tsx:24-32` has a hardcoded `SECTION_LABELS` map. Verify it doesn't include numbers. If it does, update to match.

- [ ] **Step 3: Verify TypeScript passes**

Run: `npx tsc --noEmit 2>&1 | grep -E "section-meta|artifact-canvas"`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/journey/section-meta.ts
git commit -m "fix: section numbering matches new pipeline order (ICP=02, Offer=03, Competitors=04)"
```

---

### Task 2: Fix media plan auto-navigate timing

**Files:**
- Modify: `src/components/workspace/workspace-page.tsx:200-221` — fix navigation timing
- Read: `src/components/workspace/workspace-provider.tsx:183-189` — check navigation guard

- [ ] **Step 1: Read the navigation guard in workspace-provider.tsx**

Check line 185 — `navigateToSection` has a guard that blocks navigation to 'queued' sections. The issue: `navigateToSection('mediaPlan')` fires but mediaPlan may still be 'queued' at that moment.

- [ ] **Step 2: Fix timing in handleGenerateMediaPlan**

Ensure `setSectionPhase('mediaPlan', 'researching')` happens BEFORE `navigateToSection('mediaPlan')`. Current code at lines 213-214 already does this — if the guard is the issue, the state update may not have flushed yet. Fix by calling navigate after a microtask:

```tsx
setSectionPhase('mediaPlan', 'researching');
// Use requestAnimationFrame to ensure state flushes before navigation
requestAnimationFrame(() => navigateToSection('mediaPlan'));
```

Or alternatively, update the navigation guard to also allow 'researching' sections.

- [ ] **Step 3: Verify fix**

Test locally: click "Generate Media Plan" and confirm the tab switches automatically.

- [ ] **Step 4: Commit**

```bash
git add src/components/workspace/workspace-page.tsx
git commit -m "fix: auto-navigate to media plan tab when generation starts"
```

---

### Task 3: Fix "Failed to save" misleading error

**Files:**
- Read: `src/lib/actions/journey-sessions.ts:21-52` — save function
- Read: `src/components/workspace/artifact-footer.tsx:25-40` — error display
- Read: `src/components/workspace/artifact-canvas.tsx` — where saveResearchDocument is called

- [ ] **Step 1: Read the save function and calling code**

Understand when `saveResearchDocument()` returns `{ success: false }` and what triggers `docSaveStatus = 'error'`.

- [ ] **Step 2: Diagnose the actual failure**

Check if:
- The Supabase update is failing for a specific field
- There's a race condition (save called before data is ready)
- The error is transient (network/timing) and the retry succeeds

- [ ] **Step 3: Apply fix based on diagnosis**

Options (choose based on finding):
- If transient: add a retry with 1s delay before showing error
- If partial success: check which fields saved and only error if primary data failed
- If timing: debounce the save call or gate it on data readiness

- [ ] **Step 4: Verify "Failed to save" no longer appears on successful saves**

- [ ] **Step 5: Commit**

```bash
git commit -m "fix: resolve misleading 'Failed to save' error on research document save"
```

---

### Task 4: Fix ad card template variables

**Files:**
- Modify: `src/components/strategic-research/ad-carousel/ad-creative-card.tsx:99-108,241-245`

- [ ] **Step 1: Read ad-creative-card.tsx to see raw template rendering**

Lines 101, 106, 243 render `ad.headline` and `ad.body` as-is.

- [ ] **Step 2: Add template variable resolver**

Create a helper function in the same file:

```tsx
function resolveAdTemplateVars(text: string | undefined, advertiser: string): string | undefined {
  if (!text) return text;
  return text
    .replace(/\{\{product\.name\}\}/gi, advertiser)
    .replace(/\{\{product\.brand\}\}/gi, advertiser)
    .replace(/\{\{product\.[^}]+\}\}/gi, advertiser);
}
```

Apply to all ad text rendering: `resolveAdTemplateVars(ad.headline, ad.advertiser)` and same for `ad.body`.

- [ ] **Step 3: Verify no `{{` appears in rendered cards**

- [ ] **Step 4: Commit**

```bash
git add src/components/strategic-research/ad-carousel/ad-creative-card.tsx
git commit -m "fix: resolve {{product.name}} template variables in ad cards"
```

---

### Task 5: Merge pill tabs + pipeline tracker into one nav

**Files:**
- Modify: `src/components/workspace/research-activity-log.tsx` — remove PipelineProgress
- Modify: `src/components/workspace/section-tabs.tsx:46-52` — add active/pending visual states with glow animation

- [ ] **Step 1: Remove PipelineProgress from research-activity-log.tsx**

Delete the `PipelineProgress` component (lines 95-142), its props, and the render call (line 231-233). Also remove the `completedSections` prop from `ResearchActivityLogProps`.

- [ ] **Step 2: Remove completedSections from artifact-canvas.tsx**

Remove the `completedSections` prop passed to `ResearchActivityLog` in artifact-canvas.tsx.

- [ ] **Step 3: Upgrade section-tabs.tsx with active/pending visual states**

Add a blue glow + pulse animation for the currently researching tab. Read the existing section-tabs code first to understand the current state classes, then add:
- `researching`/`streaming` state: blue border glow with Framer Motion pulse
- `queued` state: muted/disabled text
- Keep existing `approved` (green check) and `review` states

- [ ] **Step 4: Verify TypeScript passes and tabs look correct**

- [ ] **Step 5: Commit**

```bash
git add src/components/workspace/research-activity-log.tsx src/components/workspace/section-tabs.tsx src/components/workspace/artifact-canvas.tsx
git commit -m "feat: merge pipeline tracker into section tabs — single nav with progress states"
```

---

### Task 6: Remove "Looks Good" CTA

**Files:**
- Modify: `src/components/workspace/artifact-footer.tsx:87` — remove or conditionalize "Looks Good"
- Modify: `src/components/workspace/right-rail.tsx:540` — remove chat "Looks Good" button
- Read: `src/components/workspace/artifact-canvas.tsx:305` — understand approval flow

- [ ] **Step 1: Read all three files to understand the CTA flow**

Map: which sections show "Looks Good", what happens when clicked, and what "Generate Media Plan" already does for auto-approval.

- [ ] **Step 2: Remove "Looks Good" from synthesis section footer**

For the `crossAnalysis` section, don't render the approve button in artifact-footer.tsx. The "Generate Media Plan" CTA already auto-approves synthesis (workspace-page.tsx:206-211).

- [ ] **Step 3: Update media plan section footer**

Replace "Looks Good" with "Save Research" on the mediaPlan section, or remove the approve button entirely if auto-save is working.

- [ ] **Step 4: Remove or rephrase chat rail "Looks Good" button**

In right-rail.tsx, remove the "Looks Good" quick-action button or replace with section-appropriate wording.

- [ ] **Step 5: Verify no "Looks Good" text remains in the UI**

Run: `grep -r "Looks good\|Looks Good" src/components/workspace/`

- [ ] **Step 6: Commit**

```bash
git add src/components/workspace/artifact-footer.tsx src/components/workspace/right-rail.tsx
git commit -m "fix: remove ambiguous 'Looks Good' CTA — single clear action per section"
```

---

### Task 7: Fix sidebar collapse button placement

**Files:**
- Modify: `src/components/shell/app-sidebar.tsx:73-84`

- [ ] **Step 1: Read the current sidebar layout**

Understand where the collapse button sits relative to logo and nav items.

- [ ] **Step 2: Move collapse button inline with the logo/header area**

Move the toggle from its current position to be part of the sidebar header row, next to or replacing the logo area on collapse. Follow Linear/Notion pattern: collapse button appears on hover of the sidebar header.

- [ ] **Step 3: Verify expanded and collapsed states look correct**

- [ ] **Step 4: Commit**

```bash
git add src/components/shell/app-sidebar.tsx
git commit -m "fix: sidebar collapse button placement — inline with header"
```

---

### Task 8: Wire ad carousel filters into v2 workspace

**Files:**
- Read: `src/components/strategic-research/ad-carousel/ad-creative-carousel.tsx` — ALREADY HAS FILTERS
- Read: `src/lib/workspace/card-taxonomy.ts` — check how competitor ads are parsed into cards
- Modify: Wherever ads are rendered in the v2 workspace (likely `src/components/workspace/cards/` or card-renderer)

- [ ] **Step 1: Trace how competitor ads flow into the workspace**

The ad carousel with full filter support already exists at `src/components/strategic-research/ad-carousel/`. Check if the v2 workspace uses this component or renders ads differently via card-taxonomy.

- [ ] **Step 2: Connect the existing ad carousel to the workspace**

If the v2 workspace renders ads as generic cards instead of using the carousel component, either:
- Import and use `AdCreativeCarousel` in the competitor section of the workspace
- Or ensure the card-taxonomy ad parsing preserves platform/format fields and add filter pills to the workspace ad rendering

- [ ] **Step 3: Verify filters work — click LinkedIn, only LinkedIn ads show**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: wire ad carousel platform/format filters into v2 workspace"
```

---

## Execution Order

Tasks are independent — execute in this order for optimal flow:
1. Task 1 (section numbers) — 5 min, pure data change
2. Task 5 (merge nav) — 15 min, removes code + adds polish
3. Task 6 (remove Looks Good) — 10 min, string/conditional changes
4. Task 4 (template vars) — 10 min, add resolver function
5. Task 2 (media plan navigate) — 10 min, timing fix
6. Task 3 (failed save) — 15 min, needs investigation
7. Task 7 (sidebar collapse) — 10 min, layout change
8. Task 8 (ad filters) — 15 min, integration work
