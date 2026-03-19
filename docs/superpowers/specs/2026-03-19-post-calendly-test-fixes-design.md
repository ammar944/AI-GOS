# Post-Calendly Test Fix Sprint

**Date:** 2026-03-19
**Branch:** redesign/v2-command-center
**Context:** Full Calendly.com research pipeline test revealed 8 issues across bugs, UX, and missing features.

## Background

Ran Calendly.com through the full v2 journey end-to-end (Market → ICP → Offer → Competitors → Keywords → Synthesis → Media Plan). Research quality is strong — the intelligence chain is working (competitors are relevant, ICP informs offer analysis, etc.). But the UI/UX has 8 issues that need fixing before this is client-ready.

## Fix 1: Section Numbering (Bug)

**Problem:** Section headers show old pipeline order numbers. ICP shows "03 · ICP VALIDATION" when it's now step 2 in the pipeline. The research output document also uses old numbering ("02 — Competitor Intel").

**Root cause:** Section number is likely derived from the section's index in a hardcoded list or from the section key name, not from `SECTION_PIPELINE` order.

**Fix:** Derive section numbers from `SECTION_PIPELINE.indexOf(sectionKey) + 1`. This applies to:
- The `XX · SECTION NAME` header in the artifact canvas
- The research output document section numbering
- Any other place section numbers appear

**Files likely affected:**
- `src/components/workspace/section-header.tsx` or wherever `XX · SECTION_NAME` is rendered
- `src/lib/workspace/card-taxonomy.ts` (research output formatting)
- Possibly the research worker output assembly

## Fix 2: Media Plan Auto-Navigate (Bug)

**Problem:** Clicking "Generate Media Plan" starts generation but doesn't navigate to the Media Plan tab. User has to manually click.

**Root cause:** `navigateToSection('mediaPlan')` is called in `handleGenerateMediaPlan` but may fire before the section state updates, or the tab component doesn't scroll to the new active tab.

**Fix:** Verify `navigateToSection('mediaPlan')` fires after `setSectionPhase('mediaPlan', 'researching')` and that the section tabs component responds to the navigation. If timing issue, add a microtask delay.

**Files affected:**
- `src/components/workspace/workspace-page.tsx` (handleGenerateMediaPlan)
- `src/components/workspace/section-tabs.tsx` (may need to scroll active tab into view)

## Fix 3: "Failed to Save" Error (Bug)

**Problem:** "Failed to save — try viewing anyway" message appears but data IS actually saved in Supabase. Misleading error.

**Root cause:** Either the save endpoint returns a non-200 status on a non-critical path (e.g., metadata update fails but research_results succeeds), or there's a race condition between the save call and the UI state update.

**Fix:** Investigate the actual error response. If the save succeeded for the primary data, don't show an error. If it's a race condition, ensure the save promise resolves before updating UI state.

**Files affected:**
- `src/lib/actions/journey-sessions.ts` (saveResearchDocument)
- Wherever the "Failed to save" message is rendered

## Fix 4: Ad Card Template Variables (Bug)

**Problem:** Ad cards show raw `{{product.name}}` and `{{product.brand}}` instead of actual values. Only affects cards without images.

**Root cause:** The ad data normalization in the worker or card taxonomy isn't resolving template variables from the raw ad library API response. Some ad formats return template strings that need to be replaced with actual competitor data.

**Fix:** In the ad card rendering or card-taxonomy parsing, replace `{{product.name}}` with the competitor's actual name and `{{product.brand}}` with their brand. Fall back to the competitor name if brand is unavailable.

**Files affected:**
- `src/lib/workspace/card-taxonomy.ts` (parseCompetitors ad card creation)
- Or `src/components/workspace/cards/` (ad card renderer)
- Possibly `research-worker/src/tools/adlibrary.ts` (normalization)

## Fix 5: Merge Pill Tabs + Pipeline Tracker (UX)

**Problem:** Two navigation elements showing the same pipeline info — the top pill tabs and the pipeline progress tracker in the activity log area.

**Fix:** Remove the separate `PipelineProgress` component from `research-activity-log.tsx`. Upgrade the existing top pill tabs to show three states:
- **Completed:** green checkmark (already exists)
- **Active/researching:** blue glow + pulse animation
- **Pending:** muted/disabled appearance

The pill tabs already support navigation. This merges both into one element.

**Files affected:**
- `src/components/workspace/research-activity-log.tsx` (remove PipelineProgress)
- `src/components/workspace/section-tabs.tsx` (add active/pending visual states)

## Fix 6: Remove "Looks Good" CTA (UX)

**Problem:** "Looks Good" appears on the synthesis section alongside "Generate Media Plan", and again on the final page. Confusing and redundant.

**Fix:**
- **Synthesis section:** Remove "Looks Good" button. Keep only "Generate Media Plan" as the single CTA. Clicking it auto-approves synthesis (already partially implemented at `workspace-page.tsx:206-211`).
- **Final page (Media Plan):** Replace "Looks Good" with "Save Research" or remove the button entirely if auto-save is working.
- **Chat rail:** If the chat agent sends a "Looks Good" prompt, suppress or rephrase it.

**Files affected:**
- `src/components/workspace/artifact-footer.tsx` (CTA buttons per section)
- `src/components/workspace/media-plan-cta.tsx` (if "Looks Good" appears here)
- `src/components/workspace/right-rail.tsx` (chat CTA wording)

## Fix 7: Sidebar Collapse Button (UX)

**Problem:** The collapse toggle button is in a weird position (top-right of sidebar, disconnected from content).

**Fix:** Move the collapse toggle to be inline with the logo area or at the bottom of the sidebar nav items. Match common SaaS patterns (Linear, Notion) where the collapse is part of the sidebar header.

**Files affected:**
- `src/components/shell/app-sidebar.tsx`

## Fix 8: Ad Carousel Platform + Format Filters (Feature)

**Problem:** No way to filter competitor ads by platform (Meta, LinkedIn, Google) or format (Image, Video). Old v1 had this.

**Fix:** Add a horizontal row of filter pills below the ad carousel header:
- **Platform filters:** All, Meta, LinkedIn, Google (toggle, multi-select)
- **Format filters:** All, Image, Video (toggle, single-select)
- Filter the displayed ad cards based on active filters
- Show count per filter (e.g., "Meta (12)")

**Files affected:**
- `src/components/workspace/cards/` (ad carousel component)
- `src/lib/workspace/card-taxonomy.ts` (ensure platform/format fields are parsed onto ad cards)

## Execution Order

1. Fix 1 (section numbering) — quick, touches few files
2. Fix 5 (merge nav) — removes duplicate code, simplifies UI
3. Fix 6 (remove "Looks Good") — quick CTA changes
4. Fix 2 (media plan auto-navigate) — verify existing code
5. Fix 4 (template variables) — data parsing fix
6. Fix 3 (failed to save) — needs investigation
7. Fix 7 (sidebar collapse) — cosmetic
8. Fix 8 (ad filters) — feature, most code

## Out of Scope (Deferred)

- Wow factor / hyper-agent visual redesign — separate sprint with Refero + Magic UI workflow
- Light mode / color palette — separate design sprint
- Creatives, campaigns, reporting features — Phase 2
