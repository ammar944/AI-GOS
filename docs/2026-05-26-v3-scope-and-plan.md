# AI-GOS v3 — Consolidated Scope & Execution Plan

**Date:** 2026-05-26 · Aligned via `/grill-me`. **Branch:** `feat/v2-lab-section-wire`.
Companion docs: media-plan structure `docs/2026-05-26-media-plan-v3-structure.md`; sections spec `docs/research-sections.md`; status `docs/2026-05-25-v2-wire-deepseek-ground-truth.html`. Throwaway UI prototypes: `~/Desktop/aigos-v3-prototypes/{A,B,C}*.html`.

> **⚠️ AMENDED 2026-05-26 — read with `docs/2026-05-26-v3-bg-execution-handoff.md` (the current execution spec). This plan has been re-synced to that spec; the BG handoff remains authoritative if anything conflicts:**
> 1. **Sections use REAL in-section tools — NOT corpus-only.** Decisions #2 and #9 and the old live-tools-disabled anchor are **REVERSED** (ADR-0006). Flip the gate on with each section's registry allowlist; **Phase D** becomes "real-tool sections + delete the synthetic backfill in `corpus-to-research-input.ts` + relax the `ResearchInput` floors," not "enrich the corpus pass." The corpus stays the shared base only. (D2 adPresence + D3 visible-steps still apply.)
> 2. **Client-channel research step = sub-section #11, not #7** (the media-plan structure doc + ADR-0005 govern; #7 is pure synthesis).
> 3. **Prod cutover after D** (real data), before E/F — two-gate model: prod-cutover gate (6 sections) vs teardown gate (full, incl. the 7th).
> 4. **Full proof bar:** ≥3 fresh real URLs at 6/6 + 48h soak + no section >270s (stricter than A2/D1's single-URL bar below).
> 5. **Branch:** `feat/v2-lab-section-wire` → `main` at G; retire `codex/claude-managed-agents-work`. Managed-agents runtime deleted, schemas kept (ADR-0006).
> Everything else below stands.

## Locked decisions (the grill)
1. **Sequencing** — ship T3.7 (front-door flip) FIRST, then layer v3.
2. **Live research** — the corpus remains the shared Railway base, and the 6 sections use bounded real in-section tools through the lab engine's registry allowlists. `LAB_ENGINE_LIVE_TOOLS=false` is the only corpus-only escape hatch.
3. **Media plan** — skill-backed **synthesis** section `positioningPaidMediaPlan` (RovR format); 12 sub-sections (5 templated / 6 synthesized / 1 static) per the structure doc.
4. **Channel data** — media plan adds **one targeted client-channel research step** for sub-section #11 (client's own Google Ads/site/SEO/content); competitor `adPresence` added to Competitor research; everything else in the media plan is synthesis. ("for now.")
5. **Render gate** — verify all 6 lab→renderer field alignments + one fresh real-URL 6/6 render BEFORE the flip.
6. **Progress UX** — sub-section progressive reveal. **6b** Competitor = tab-bar · **6c** media plan = its own terminal page · **6d** audit reader = **per-section paginated view** (tabs + next/prev), clean verdict line.
7. **Teardown** — lean; **KEEP the Railway worker** (it builds the corpus, no timeout limit). Remove `/research-v2` page, orchestrate `draft/deep/managed` branches, old 10-section media-plan pipeline.
8. **Prod** — DeepSeek-only; just make it work. DeepSeek key rotation = later security follow-up, non-blocking.
9. **Execution** — agent-bus **goal + Codex** (xhigh) execution; Claude plans/reviews; **TDD + verification gate per phase**.

**Architecture split (unchanged):** corpus = Railway worker · 6 sections = Next.js lab engine (`after()`/`waitUntil`, maxDuration 300) · media plan = dependent final wave.
**Future (NOT now):** unified chat edits all sections + media plan → keep renderers data-driven/editable.

## Verification gate (every task, per `.claude/rules/verification.md`)
`npx tsc --noEmit` = 0 · `npm run test:run` green · `npm run build` exit 0 · live proof on `:3100`. Worker tasks also: `cd research-worker && npm run build`. Red→green TDD: failing test first.

---

## PHASE A — Ship T3.7 (front-door flip) · *gated, ships first*
Goal: real users hit `/research-v3` and the DeepSeek lab path; Phase A is closed, but its evidence remains the regression floor.
- **A1 [Claude+Codex]** Audit + fix all 6 lab→renderer field alignments (the BuyerICP envelope-flatten bug pattern, for every section). *Verify:* each section's lab `data.body` keys match its renderer destructure; unit test per section.
- **A2 [Claude]** Prove ONE fresh real-URL run (not the seeded fixture) renders 6/6. *Verify:* fresh onboarding → corpus → 6/6 complete + rendered, no error boundary, on `:3100`.
- **A3 [Codex]** Flip `src/app/onboarding/page.tsx` redirect `/research-v2` → `/research-v3`. *Verify:* fresh onboarding lands in `/research-v3` on the lab path. **Depends:** A1, A2 green.

## PHASE B — Audit reader UX (per-section paginated view)
Goal: the revised D6 reader. Prototype A is the visual reference (nav revised to paginated).
- **B1 [Codex]** Rebuild reader as per-section page view: tabs-on-top + next/prev across the 6; media plan is the terminal page. *Verify:* navigate each section as its own view; deep-linkable per section.
- **B2 [Codex]** Competitor Landscape: tab-bar across competitors. *Verify:* switch competitors via tabs.
- **B3 [Codex]** Verdict = clean one-line lead; confidence/sources demoted to subtle inline. *Verify:* visual matches DESIGN.md "lean, not dashboard."
- **B4 [Codex+Claude]** Wire typed sub-section renderers per `research-sections.md` (prototype-A primitives → real renderers). *Verify:* each section's named sub-sections render real content. **Depends:** A1.

## PHASE C — Progress UX (sub-section progressive reveal)
- **C1 [Codex]** Lab engine / worker emit a per-sub-section commit event as each sub-section commits. *Verify:* events observed during a run.
- **C2 [Codex]** Reader renders the sub-section checklist ticking off live + "Wave X of Y · N running/queued/complete" header. *Verify:* live reveal during a real `:3100` run. **Depends:** B1, C1.

## PHASE D — Real-tool sections + anti-fabrication gate (D2 + G1)
- **D1 [Codex+Claude]** Run the 6 sections with bounded real in-section tools on top of the shared corpus base; delete synthetic backfill and relax `ResearchInput` floors so real URLs pass `validateMinimums` without fabricated filler. *Verify:* fresh real URLs → 6/6 with `LAB_ENGINE_LIVE_TOOLS=true`/default live allowlists, no `Synthetic:` strings, no `example.com` URLs, no section >270s, p95 watch-line tracked.
- **D2 [Codex]** Add competitor `adPresence` (ad-platform/spend signals) to Competitor Landscape research + schema (field-sync). *Verify:* competitor artifacts carry `adPresence`.
- **D3 [Codex]** Surface section research as visible steps (query→search→synthesis→validation→commit) feeding Phase C. *Verify:* section runs show steps in UI.

## PHASE E — Paid Media Plan section (`positioningPaidMediaPlan`)
Per `docs/2026-05-26-media-plan-v3-structure.md`.
- **E1 [Codex]** Add the section across the 7 field-sync surfaces (id/registry/enum/labels/SECTION_TO_TOOL/typed-artifact-keys/intent-router) + schema (12 sub-sections, managed-agents convention) + SKILL.md (fill-in-the-blanks, per-claim `sourceSection`). *Verify:* section runs, schema-valid artifact from the 6.
- **E2 [Codex]** Targeted client-channel research step for sub-section #11 (D4). *Verify:* #11 populated from real client-channel data.
- **E3 [Codex]** Brief field additions (G4/G5): `salesProcessDocs[]` + `salesLoomUrl`, SLG/PLG flag, creative capacity, lead-list availability (6-place field-sync each). *Verify:* fields flow brief→worker→artifact.
- **E4 [Codex]** Orchestration: media plan dispatches as a dependent final wave after 6/6 commit (G6). *Verify:* media plan runs only after the 6 complete.
- **E5 [Codex+Claude]** Media-plan renderer = terminal page (prototype C), 12 sub-sections tagged templated/synthesized/static, teaser from the audit. *Verify:* renders per prototype C. **Depends:** B1, E1.

## PHASE F — Teardown (lean) · *after new paths proven*
- **F1 [Codex]** Remove `/research-v2` page, orchestrate `draft/deep/managed` branches, old `src/lib/media-plan/*` heavy pipeline + components + orphan tests. KEEP the worker and managed-agents schemas needed by renderers. *Verify:* tsc 0, tests green, no dangling refs, build 0; worker build no worse than the known baseline. **Depends:** A,B,C,D,E green plus the multi-URL/soak proof gate.

## PHASE G — Prod (DeepSeek-only)
- **G1 [Claude]** Vercel production env (`DEEPSEEK_API_KEY` etc.), promote preview → prod after the Phase D real-data cutover gate; complete final teardown/promotion only after the seventh section, multi-URL proof, and soak gates. *Verify:* prod run completes 6/6 + media plan. Key rotation = tracked follow-up, non-blocking.

---

## Sequencing
A is closed and remains the regression floor. B/C/D/E are parallelizable across Codex tasks (B before C/E-render; D before E-synthesis quality). Prod cutover can follow the Phase D real-data gate; F and final promotion wait for the new surfaces, seventh section, multi-URL proof, and soak gate.
Mirror this board into the agent-bus goal + the ground-truth HTML `§07` task board (per D9).
