# START HERE — Ad Engine + I1–I6 QA Sweep handoff (for a fresh execution session)

**Authored by HQ (Claude) 2026-06-02, after a 12-agent research workflow + live SearchAPI probe + 2 design consults + a Codex xhigh plan review (9 P1s folded in).**

## Where to work
- **Worktree (system of record):** `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire` · branch `feat/v2-lab-section-wire` · HEAD `98c033c5`. NOT the main `/Users/ammar/Dev-Projects/AI-GOS` checkout (it's on a different branch).
- All edits + commits happen in that worktree.

## What this is
Make competitor ad creatives appear in CompetitorLandscape (SearchAPI Google/Meta/LinkedIn + Foreplay, deduped, displayable) and clear six live-QA findings (I1–I6). The ad *tool* is already proven healthy by a live probe — zero-ads is upstream (seeding + engine breadth), not the tool.

## Read in this order
1. `docs/superpowers/plans/2026-06-02-ad-engine-and-qa-sweep.md` — **the plan (v2, Codex-reviewed)**. Has the verified code map (use those paths — several v1 refs were stale), the centralization mandate for `run-section.ts`, and per-task steps/gates.
2. `docs/2026-06-02-ad-engine-and-qa-research-synthesis.md` — findings + §7 live-probe results.
3. `docs/2026-06-02-qa-next-research-list.md` — the original I1–I6 handoff.
4. Memory: `project_ad_engine_probe_finding_2026_06_02.md`.

## Execution model (user's choice)
- Execute **via the Workflow tool**, **phase by phase** (Phases 0→5). Not subagent-driven-development.
- **Serialize all `run-section.ts` writes** — one workflow stage touches it at a time; it has primary/repair/rescue ad-probe sites that must change together (see the plan's centralization mandate).
- **Gate every phase:** `npx tsc --noEmit` clean vs baseline · `npm run lint` 0 err (≤67 warn) · `npm run test:run` ≥ baseline · `npm run build` 0. Build in isolation if `next dev` shares `.next`.
- Capture the baseline (Task 0.0) before any edit.

## Cost-gated / user-gated steps (do NOT auto-run without the user)
- **Phase 0** Foreplay sandbox probe — bounded (≤6 paid Foreplay calls). Reuse the proven `scripts/zero-ads-probe.ts` pattern (uncommitted; left in the worktree). Authored, not yet run.
- **Phase 5** live E2E (~$2). The real definition of done.
- **Phase 2 (I3 DESIGN.md amendment)** — **PRE-APPROVED by the user 2026-06-02** (header→text-2 11px, faint hairline rows, optional ≤960px wide tables). Execute Phase 2 without stopping to re-ask.

## Decisions already locked (do not relitigate)
- Seeding = onboarding-typed competitors only (NO second post-model probe). The real model-side bug is `buildCompetitorSeedHints` reading the empty `competitorAds` (Phase 3).
- Resurrect full engine: LinkedIn as a registered tool (port from worker, structured gaps); **Foreplay as a DIRECT prepass service call** (not a registered tool — avoids the budget wrapper), via the rich `src/lib/foreplay/service.ts`.
- Foreplay + SearchAPI combined + displayable + deduped (3 dedup layers must stay in sync).
- Gate teeth behind `LAB_AD_EVIDENCE_STRICT` (default off → on after live proof).

## Definition of done
Behaviorally proven on the Phase 5 live E2E (creatives across ≥2 platforms, LinkedIn populated, Foreplay video renders, gate flags genuine empties), not unit-green. Push/deploy stays user-gated.
