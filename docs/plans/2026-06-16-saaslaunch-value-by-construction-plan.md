# SaaSLaunch Paid-Media Plan — Value by Construction

- Status: ACTIVE (Wave 1 implemented this session; Waves 2–6 proposed)
- Date: 2026-06-16
- Branch: `refactor/architecture-deepening`
- Owner: Ammar
- Related: `docs/reports/2026-06-16-research-quality-fixes-report.md`, ADR-0010 (ARI), `docs/source-map.md`
- Fulfillment rubric: `SaaSLaunch_Paid_Media_Plan_TEMPLATE` (13-slide deck) — used as a coverage rubric, **not** a UI target.

## Direction (approved)

The product is **artifact-first, not deck-first**. The SaaSLaunch template is the agency's fulfillment promise; we treat it as a **coverage rubric** for the existing `positioningPaidMediaPlan` artifact and the Audit Reader. We make the artifact genuinely valuable first, and prove that value deterministically. PDF/export/design is a later, separate concern.

The plan deliberately **does not** introduce:

- a launch / no-launch decision framework,
- a 14-day test framework,
- a runtime judge lock (no user ever waits on a judge),
- a reloop UX.

The plan **keeps** what already works: GTM onboarding, the corpus (`deepResearchProgram`), the six positioning sections, and the current `paidMediaPlanBodySchema` artifact structure. Nothing in this plan rewrites the AI SDK harness, the `src/lib/media-plan/*` surface, or the anti-fabrication rules.

## Core thesis: value by construction

A plan reads as valuable only when the evidence underneath it is real. Today the pipeline can produce an honestly *degraded* paid-media plan (good — see the 2026-06-16 fixes), but degraded because the **upstream** BuyerICP and Voice-of-Customer sections acquire too little grounded evidence (run `c9bc2056`: BuyerICP `insufficient`, VoC `insufficient` with two extracts from one source). The paid-media artifact is "only as good as the degraded upstream sections."

So value is built bottom-up, in this order:

1. **Acquire** enough grounded upstream evidence (BuyerICP personas/triggers/firmographics, VoC customer language).
2. **Compose** the paid-media artifact from that evidence, with every synthesized row traced to a real upstream section.
3. **Prove** coverage and honesty deterministically, offline, so regressions are caught before a client ever sees the output.

This plan sequences those three concerns and starts with (3) — the proof tool — because we cannot trust acquisition or composition improvements without a fulfillment yardstick that an offline run can grade.

## The 13-slide rubric → artifact mapping

The template's 12 content slides (slide 1 is the cover) map to `paidMediaPlanBodySchema` fields. Each slot carries a **tag** that determines how it is graded:

| # | Fulfillment slot | Body key | Tag |
|---|---|---|---|
| 1 | Campaign Overview | `campaignOverview` | templated |
| 2 | Campaign Phases | `campaignPhases` | templated |
| 3 | Audience Types | `audienceTypes` | synthesized |
| 4 | Angles to Test | `anglesToTest` | synthesized |
| 5 | Creative Strategy | `creativeStrategy` | templated |
| 6 | Creative Framework | `creativeFramework` | synthesized |
| 7 | Funnel Ideation | `funnelIdeation` | templated |
| 8 | Sales Process | `salesProcess` | static_asset |
| 9 | Competitor Insights — Marketing | `competitorMarketingInsights` | synthesized |
| 10 | Competitor Insights — Reviews | `competitorReviewInsights` | synthesized |
| 11 | Current Funnel / Channel Suggestions | `channelSuggestions` | synthesized |
| 12 | KPIs & Success Metrics | `kpis` (+ `projectedResults`) | templated |

Tag semantics:

- **templated** — the slot's structure is the agency's standard methodology filled with operator economics. Graded for template residue, hollow fill, and honest numbers — not for upstream grounding.
- **synthesized** — the slot must trace to a real upstream positioning section (`sourceSection` + `grounding`). Graded for grounded provenance, non-hollow grounding, and **not** laundering proof from an insufficient upstream section.
- **static_asset** — SaaSLaunch standard assets (sales-process docs + Loom) or operator-supplied assets, or one honest gap object. Graded for fabricated links.

## Execution phases

### Phase 1 — Coverage eval (Wave 1, implemented this session)

An offline, read-only, **advisory** grader that scores the artifact bundle against the 12 fulfillment slots. It grades the **artifact**, never the deck UI. It is a dev/release proof tool: it does not block runtime UX and no user waits on it.

Deliverables (this session):

- `scripts/zz-saaslaunch-coverage-eval.mjs`
- `scripts/zz-saaslaunch-coverage-eval.checks.test.mjs` (wired into `npm run test:gate`)

Per-slot output:

```
{ slot, tag, status: "pass"|"warn"|"fail", evidencePaths, sourceSections, missing, hardFailures }
```

What it catches (see the script for the full list):

- schema-valid but hollow slots,
- template residue (`$[Budget]`, `[X]`, `[industry]`, `[Angle 1 — short name]`, `[link to document]`, `[Primary KPI]`, …),
- bare labels (e.g. `Problem-Solution-Transformation`, `PST 1`, `USP`) with no actual content,
- gap rows counted as full coverage,
- fabricated sales-process links,
- synthesized rows without a legal `sourceSection` / grounding,
- competitor ad-platform/spend claims without a source or an explicit unknown/gap,
- CAC vs customer-CAC unit conflation (coverage-honesty view; the hard numeric floor stays in `zz-buyer-eval.mjs`),
- paid-media reading strong while upstream BuyerICP / VoC are insufficient.

Explicit non-duplication: `zz-buyer-eval.mjs` owns the numeric liar-catchers (budget partition, CAC-unit math, competitor counts, VoC laundering, cascade). The coverage eval is complementary — it grades fulfillment coverage and honest labeling, not the arithmetic.

Advisory wiring: the eval defaults to exit 0 (advisory) and prints a per-slot scorecard. A `--strict` opt-in exits non-zero on hard failures for future promotion. It is **not** wired into the blocking `combineReleaseGate` path; promotion to the release gate's advisory live/value slot is Wave 4+.

#### Phase 1 hardening (2026-06-16)

- **Missing vs insufficient upstream.** `gradeCoverage` now distinguishes a research section that is *absent from the run* (missing) from one that is *present but empty/low-tier* (insufficient). A synthesized row that cites either is a laundering hard-failure; the scorecard reports each set separately. Previously `sectionIsInsufficient(undefined) === false` let an omitted-but-cited upstream dodge the laundering check.
- **Heuristic path correctness.** The fallback sufficiency heuristics read the real nested body paths: `buyerIcpGroundedCount` now reads `personaReality.personas` / `buyingContext.triggers` / `icpExistenceCheck.firmographicCuts` / `clusters.venues` (not only flat legacy keys), and the VoC quote scan recognizes `verbatimText` / `evidenceQuote`. This removed a false-positive (a VoC with real quotes under `verbatimText` was being mislabeled "zero usable quotes"). The eval still defers below-floor-but-nonzero judgments to `verification_tier` / the new `sufficiency` summary — it does not duplicate buyer-eval's numeric floors.
- **Gate atomic-commit boundary.** `package.json` `test:gate` references four `node --test` suites whose impl scripts must land together; documented in `scripts/AGENTS.md` so a clean checkout never half-commits the gate.

### Phase 2 — Upstream acquisition ledgers (Wave 2, contract implemented 2026-06-16)

BuyerICP and Voice-of-Customer need better **source discovery / acquisition**, not better prose. Each carries an acquisition ledger: what sources were searched, what candidates were found, which were promoted, which were rejected and why (count/selection vs quality), plus a sufficiency summary. Use Perplexity/Sonar as a bounded source-discovery path (never as a prose authority); DeepSeek remains the writer/repair provider after tool results are validated. The ledger's sufficiency summary is what the coverage eval's "upstream insufficiency" check reads to decide whether a synthesized paid-media slot is honestly earned.

**Implemented this session (contract layer):**

- Shared `acquisitionSufficiencyFieldSchema` in `strategic-insight.ts` (`tier` sufficient/partial/insufficient + `candidatesFound`/`promoted`/`rejected` counts + `rationale`), attached optionally to both the BuyerICP and VoC `evidenceGapReport`.
- BuyerICP gains an `acquisitionLedger` (searched source / candidate / promotion status / rejection reason) mirroring VoC's existing ledger shape. VoC already had the ledger; it now also carries the sufficiency summary.
- The coverage eval reads `evidenceGapReport.sufficiency.tier` as an **additional** insufficiency trip-wire (never an escape hatch — a self-reported `sufficient` cannot clear a real floor).
- The BuyerICP, VoC, and paid-media SKILL.md files encode the ledger contract, the Perplexity-discovery / DeepSeek-writer division, and (paid-media) the SaaSLaunch 12-slot fulfillment contract + upstream-sufficiency Iron Law.

**Deferred (runtime population, needs live E2E — not offline-gate-verifiable):** wiring the existing bounded discovery wrappers (`buyer-persona-acquisition.ts`, `voice-of-customer-class-acquisition.ts`) to deterministically populate the ledger + sufficiency at section commit. The schema + skills make the section agent *able and instructed* to emit them; deterministic population from the discovery wrappers is the next slice.

### Phase 3 — Sparse interpretation (Wave 3, proposed)

Formalize honest degraded composition when upstream is thin (the 2026-06-16 BuyerICP/VoC normalization started this). A sparse upstream must produce explicit block gaps, never fanned-out reuse, and the paid-media composer must not present a confident slot on a gapped upstream.

### Phase 4 — Paid-media evidence pack (Wave 4, proposed)

Every synthesized paid-media row carries a traceable evidence pointer to the exact upstream row(s) it was composed from, so coverage can be verified end-to-end and the eval can be promoted from advisory to a release-gate input.

### Phase 5 — Schema tightening (Wave 5, proposed)

Tighten provenance/grounding so fabrication is structurally harder: re-examine `sourceSection`'s `.catch("unattributed")` escape, enforce non-hollow `grounding`, and make competitor spend provenance an explicit enum (source-reported / tool-measured / unknown) instead of a free-form string.

### Phase 6 — PDF / export / design (later)

Only after artifact value is proven. The deck is a rendering of a trustworthy artifact, not the product.

## Assumptions

- The persisted artifact shape is `paidMediaPlanBodySchema` (`src/lib/lab-engine/artifacts/schemas/paid-media-plan.ts`); the eval reads `data.body` per section, mirroring `zz-dump-run-sections.mjs`.
- Offline grading reads a dumped bundle (`<zone>.json` + `_manifest.json`) or Supabase read-only, the same dual-mode loader as `zz-buyer-eval.mjs`.
- `npm run test:gate` runs `node --test` `.mjs` gate tests; vitest only globs `src/**`.

## Non-goals (this plan)

- No deck / PDF / export build.
- No AI SDK harness rewrite.
- No changes to `src/lib/media-plan/*`.
- No loosening of anti-fabrication rules; the eval never fabricates rows to pass.
- No runtime judge, no reloop UX, no launch/no-launch or 14-day-test framework.

## Verification gates

- `npm run test:gate`
- `npm run test:run -- scripts` new gate test (via `node --test`) plus the paid-media schema/renderer and live-quality-gate vitest files.
- `git diff --check`
- Repo-wide lint/build is currently blocked by pre-existing dirty-tree noise (`scripts/zz-claim-source-verifier.ts` `no-explicit-any`, `tmp/e2e-chrome-profile`); the touched surface is covered by focused tests.
