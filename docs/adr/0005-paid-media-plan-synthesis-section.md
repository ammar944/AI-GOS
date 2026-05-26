---
status: accepted
date: 2026-05-26
---

# Paid Media Plan is a new DeepSeek synthesis section, dispatched as a poll-triggered dependent wave

AI-GOS adds a 7th section to the Audit: a **Paid Media Plan** (`positioningPaidMediaPlan`, label "Paid Media Plan"). Unlike the six positioning sections — each of which researches a market question from the corpus — this section does **no positioning research**. It synthesizes the six committed positioning Artifacts plus the frozen GTM brief into a client-ready paid-media plan, mirroring the existing "consumes prior sections" worker skills `ai-gos-gtm-synthesis` and `ai-gos-activation-plan`. The full sub-section structure, schema, SKILL.md shape, and gap analysis live in `docs/2026-05-26-media-plan-v3-structure.md`; this ADR records only the four hard-to-reverse structural decisions.

The early v3 scope pass concluded "media-plan is EXTEND not rebuild" — keep the existing `src/lib/media-plan/` pipeline (Perplexity Sonar Pro research + CAC math + QvC platform scoring + 14-step deterministic budget validation, documented in `docs/media-plan-technical-reference.md`) and only add a trigger button. **This ADR supersedes that stance.** The old pipeline modeled CAC, scored platforms, and ran fresh Perplexity research; the team does none of those. The RovR reference deck is a fully-templated 7-slide spine with only the budget number swapped per client — the real deliverable is that templated spine with the strategic blanks filled in from positioning evidence already in hand. That is synthesis, not research.

## Decisions

1. **New synthesis section, old pipeline deprecated.** `positioningPaidMediaPlan` (tool `save_paid_media_plan_artifact`, artifact key `paidMediaPlanArtifact`, platform-skill `research-worker/platform-skills/ai-gos-paid-media-plan/`) replaces `src/lib/media-plan/`. The old Perplexity+CAC pipeline is deprecated; its physical removal is Phase F's job (kept out of this additive change to avoid colliding with Phases B/C/D/E in flight). Prod is DeepSeek-only — the old pipeline's Perplexity dependency is incompatible with that constraint regardless.

2. **The section lives OUTSIDE the positioning registry.** `positioningPaidMediaPlan` is **not** added to `POSITIONING_SECTION_IDS`. It goes into a sibling const, and a derived `ALL_SECTION_IDS = [...POSITIONING_SECTION_IDS, paidMediaPlan]` feeds only the surfaces that legitimately address all seven sections: `POSITIONING_SECTION_LABELS`, `SECTION_TO_TOOL` (`dispatch-research.ts`), `TYPED_ARTIFACT_KEYS_BY_ZONE` (`positioning-artifact.ts`), the `typed-artifact-renderer.tsx` switch, and `intent-router.ts`. The four **fan-out** surfaces continue to key off the six-only `POSITIONING_SECTION_IDS`: `dispatchLabSectionJobs` (`orchestrate/route.ts`), `seedOrchestration` zones, the `orchestrate-client.ts` `section_run_ids.length(...)` assertion, and `ZoneIdSchema = z.enum(POSITIONING_SECTION_IDS)`. This makes it **structurally impossible** for the media plan to be swept into the parallel wave-1 fan-out.

3. **Dispatched as a poll-triggered dependent wave (Next.js-side).** The media plan must run only after all six lab sections commit, because it reads their Artifacts. The six sections run on the **Next.js lab engine** (`run-lab-section`, `after()`/`waitUntil`), not on the worker — so the component that already observes 6/6 completion is the Next.js-side poll (`use-audit-state`), which drives the reader. When the poll sees 6/6 committed, the client dispatches the single synthesis section through the same lab mechanism. **Hard prerequisite:** the parent-rollup bug (parent stuck `queued` / `children_complete=0`) is fixed first — otherwise the poll never observes 6/6 and the media plan never fires. That fix is P0 in the execution handoff.

4. **Output via `streamObject(PaidMediaPlanArtifactSchema)`, never `Output.object` on the answer tool.** This follows the established section-runner pattern (the "#411 trap" — layering `Output.object` on the answer tool — is prohibited). Top-level meta (`sectionTitle`, `verdict`, `statusSummary`, `confidence`, `sources`) matches the six; cardinality lives in `validatePaidMediaPlanMinimums()`, not in Zod `.min()/.max()` (Anthropic structured-output rejects those — see `.claude/rules/learned-patterns.md`). Schema is mirrored in both `src/lib/managed-agents/schemas/paid-media-plan.ts` and `research-worker/src/agents/subagents/schemas/paid-media-plan.ts` (the worker boundary forbids cross-imports).

## Considered alternatives

- **Extend the existing `src/lib/media-plan/` pipeline (the early "EXTEND not rebuild" stance).** Rejected: it runs fresh Perplexity research and CAC/QvC math the team does not use, depends on Perplexity (incompatible with DeepSeek-only prod), and is a separate SSE pipeline that cannot express "dependent final wave after the six." The non-research assets (templated budget/phase/audience/KPI spine) are salvaged into the new skill's templated sub-sections rather than carried as live code.

- **Add `positioningPaidMediaPlan` to `POSITIONING_SECTION_IDS` and special-case it to "run last" in the orchestrator.** Rejected: every one of the four fan-out call sites would each need its own "skip the media plan in wave 1" guard, and missing any one silently dispatches it early as a wave-1 section with the wrong inputs and no access to the six committed Artifacts. The registry split makes the wrong behavior impossible by construction instead of relying on four correct guards.

- **Model it as a 7th parallel wave in the orchestrator's `getWave(index, concurrency)` math.** Rejected: it is not parallel — it strictly depends on all six. Wave-index math cannot express "wait for the prior set to all commit."

- **Worker-side trigger (worker observes 6/6 and dispatches the media plan).** Rejected for v3: the six lab sections run on the Next.js lab engine, not the worker, so the worker does not observe their completion. Routing a 6/6 signal to the worker would introduce a worker↔Next.js handoff the architecture split (corpus = worker, sections = Next.js) otherwise avoids. Revisit only if the worker gains a lab-section-completion signal.

## Consequences

- A second section-id registry now exists. Any code that means "every renderable section" must use the derived `ALL_SECTION_IDS`; any code that means "the parallel positioning fan-out" must use `POSITIONING_SECTION_IDS`. Conflating them reintroduces the wave-1 dispatch bug. This asymmetry is intentional and is the load-bearing reason for this ADR.

- The Paid Media Plan section is **not** symmetric with the other six despite sharing the `positioning*` prefix (kept only to reuse the registry/state-machine/dispatch-validator conventions). It runs later, synthesizes rather than researches, and — per decision-4 in the scope doc — is allowed **one** bounded client-channel research step for sub-section #11 (Channel & Current-Funnel Suggestions), a scoped allowance distinct from the six sections' bounded in-section tool allowlists. This overrides the structure doc's option-(a) "zero research / #11 advisory" prose; sub-section #7 (Competitor Insights — Reviews) stays pure synthesis. The single research step obeys the existing paid-API abort rules (no unbounded loops).

- Media-plan dispatch is gated on the parent-rollup fix. Until that lands, 6/6 is never observed and this section cannot run — so the rollup fix blocks Phase E end-to-end, not just Phase A.

- The old `src/lib/media-plan/` pipeline remains physically present (and inert for the v3 path) until Phase F removes it with a dead-code trace. `docs/media-plan-technical-reference.md` is documentation of the deprecated system, retained for the Phase F teardown reference only.
