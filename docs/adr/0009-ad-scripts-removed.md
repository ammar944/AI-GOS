---
status: accepted
date: 2026-05-27
---

# Ad-scripts removed; the Audit is 6 positioning Sections + the paid media plan

The v3 Audit deliverable is the six-Section Pre-Pitch Positioning Audit plus the 7th `positioningPaidMediaPlan` synthesis Section (ADR-0005). Ad-script generation — a separate downstream feature — is removed entirely. This records what is deleted, what is deliberately kept, and why carrying scripts as dormant code was rejected.

## Context — ad-scripts is a downstream feature, not part of the Audit

`research-worker/src/scripts/` runs a 2-pass ICM pipeline (draft → humanize with a 43-point audit) that was only ever reachable from the profile Scripts tab. It is orthogonal to the positioning Audit and the paid media plan, carries its own worker stage, API routes, components, and a `script_packs` table, and is unmaintained on the v3 path. v3's scope (the consolidated scope plan + ADR-0005) is the Audit + media plan; scripts are out.

## Decision — delete the ad-scripts feature whole; keep Assets and the media plan

Remove every ad-scripts unit and the surgical references into shared code, in one integration arc (Phase 1 of the onboarding integration plan):

**Deleted units:** `research-worker/src/scripts/` (pipeline, stages, refs, `__tests__`); `src/app/api/scripts/`; `src/app/api/profiles/[id]/script-packs/`; `src/components/scripts/`; `src/components/workspace/scripts-phase.tsx`; `src/lib/scripts/`.

**Surgical edits (worker):** drop `runScriptPipeline` + `writeScriptPackUpdate` + the `/api/scripts` route from `research-worker/src/index.ts`; drop `writeScriptPackUpdate` from `research-worker/src/supabase.ts`; drop `AD_SCRIPTS_ADVISOR_SYSTEM` + the `'ad-scripts'` branch from `research-worker/src/planning/opus-planner.ts` — **KEEP the `'media-plan'` branch**.

**Surgical edits (frontend):** strip the `scripts` member from `src/lib/workspace/types.ts`, `pipeline.ts`, `artifact-canvas.tsx` (union/state/meta + the post-media-plan "Generate Scripts" CTA); remove the scripts tab state + CTA + `ScriptsPhaseContent` branch in `src/components/research/research-document.tsx`; retitle script-flavored copy in `src/components/assets/asset-style-refs.tsx` + `asset-proof-points.tsx`.

**Kept (deliberately):**
- The profile **Assets** tab — `StyleRefsTab` is relocated out of `components/scripts` and the profile tab id renamed to `assets` (Scripts tab dropped).
- The **media plan** — `getStrategicPlan`'s `'media-plan'` branch has no external `'ad-scripts'` callers (verified), so deleting scripts leaves it intact.
- The `script_packs` DB table is **left inert** (no migration drop) — removing the table is a separate, reversible DB change with no code value here.

## Considered alternatives

- **Keep ad-scripts behind a flag / the profile tab.** Rejected: it is a whole unmaintained pipeline + worker stage + table; carrying it dormant is maintenance and review burden on every worker/orchestrate change for a feature v3 does not ship.
- **Drop the `script_packs` table in the same arc.** Rejected (for now): an inert table is harmless; a destructive schema change belongs in its own reviewed migration, not bundled into a code-removal arc.

## Consequences

- The profile detail page loses its Scripts tab and keeps Assets; no user-facing script generation remains anywhere (verified in Phase 5 E2E).
- `getStrategicPlan` keeps `'media-plan'`; media-plan output is unaffected (claim 4 of the Codex adversarial review, confirmed).
- Every deleted module's barrel/registry references and `__tests__/*` must be removed in the same diff — orphan tests emit `TS2307` and silently fail the gate (`.claude/rules/learned-patterns.md`).
- Worker build after this arc = its known baseline (root tsconfig excludes the worker; capture separately).

## References
- Plan: `docs/2026-05-27-v3-onboarding-integration-plan.md` (Phase 1)
- Related: ADR-0005 (the paid media plan Section that remains), ADR-0006 (managed-agents runtime deletion — adjacent teardown), ADR-0008 (unified onboarding — same arc)
