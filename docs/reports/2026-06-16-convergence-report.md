# AI-GOS Convergence Report — 2026-06-16

> Terminal quality gate: a cold expert reader trusts the generated research + media plan
> as valuable, grounded, and safe to use. Deterministic schema pass alone is explicitly
> **not** sufficient.

Branch: `refactor/architecture-deepening`
Baseline defect run: `c77ff0e1` (deterministic 10/10 PASS, cold value-read "good strategy
wrapped around broken/fabricated numbers", worth-paying **with-caveats**).
Fresh proof run: `3b568ea0-b734-46ec-9618-e91b50405107` (airtable.com) — see §Fresh Run.

---

## 0. The core problem this report closes

The previous gate scored `c77ff0e1` **10/10 PASS** while a cold buyer caught, in five minutes:
a self-falsifying funnel (a $134 cost-per-trial compared to a $3,000 customer-CAC target,
beating it 22×), a budget that summed to $35,000 against a stated $25,000 plan, five
fabricated named personas on real Fortune-500 case-study URLs, competitor ad counts inflated
2–6× over captured evidence, and customer quotes laundered from a Voice-of-Customer section
that disowned its own output. **The eval was structurally blind to everything that destroyed
buyer trust.** This pass makes the gate see those defects *and* fixes them at the engine.

The single sharpest piece of evidence: re-running the (now-hardened) deterministic eval
against the unchanged `c77ff0e1` artifact moves it from **10/10 PASS → 1/10 FAIL**, flagging
all six defect classes by name. The gate is no longer a liar.

```
| Check             | c77 before | c77 after hardening |
| CASCADE           | PASS       | PASS                |
| PROJECTIONS       | PASS       | PASS                |
| BUDGET-PARTITION  | (blind)    | FAIL  $35,000 vs $25,000; one move carries the full monthly + siblings add more |
| CAC-UNIT          | (blind)    | FAIL  3 funnel rows, implied $134 beats $3,000 target 22×, no trial→paid bridge |
| PERSONA-CONTAINMENT (blind)    | ADVISORY  5 vendorSourced named humans surfaced for the judge |
| COMPETITOR-COUNT  | (blind)    | FAIL  6 advertisers claim more verified ads than captured creatives |
| VOC-LAUNDERING    | (blind)    | FAIL  4 paid rows cite a VoC that produced zero usable quotes |
| Final score       | 10/10 PASS | 1/10 FAIL           |
```

---

## 1. Lane 1 — Media plan numeric integrity  *(engine, deterministic, unit-proven)*

**Files:** `src/lib/lab-engine/artifacts/schemas/paid-media-plan.ts`,
tests in `src/lib/lab-engine/artifacts/schemas/__tests__/paid-media-plan.test.ts`.

Three real, code-owned defects survived the prior "forward-compute" commit and are now fixed:

1. **Budget partition** — concurrent `projectedResults` rows (same `durationLabel`) now PARTITION
   the monthly budget instead of summing past it. New `reconcileProjectedResultsBudgetPartition`
   detects a window whose per-move budgets exceed the monthly plan and rescales them
   (largest-remainder) to sum **exactly** to the monthly budget, then re-derives each row's
   forward funnel. A single sub-budget move (legitimate under-allocation) is left untouched;
   a `projected-partition` cascade-violation kind is surfaced for the validator + eval.
2. **Trial→paid bridge / CAC unit** — `computeCustomerCacBridge` rolls a funnel-stage row's
   `impliedCac` (cost per **trial signup**) up to a paid-customer CAC. With disclosed
   signup→activation→paid rates it emits a single `customerCacValue`; without them it emits an
   honest **sensitivity band** (`customerCacBandLow/HighValue`) over a 10–25% trial→paid
   assumption, and ALWAYS attaches `costPerTrialLabel` ("Cost per qualified trial (signup) —
   not customer CAC"). The goal-gap note compares the **customer CAC** (or band) to the
   target, never the bare trial cost — killing the 22× self-flattering comparison.
3. **Coherence** — clicks/CVR/count/implied-cost stay internally consistent after partition
   (impliedCac = spend ÷ count, to the cent).

**Proof:** 8 new tests reproduce the exact c77 inputs (rows 25000+5000+5000, $3,000 target):
budgets now sum to exactly $25,000; total projected trials drop from the phantom 261 to the
honest ~185; every funnel row carries `costPerTrialLabel` + a customer-CAC band; the
point-estimate path is exercised with disclosed rates. **61/61 paid-media-plan tests green.**

---

## 2. Lane 2 — Offer diagnostic completion  *(engine rescue, unit-proven)*

**Files:** `src/lib/research-v2/research-evidence-readiness.ts`,
`src/app/api/research-v2/run-lab-section/route.ts`, tests in `.../__tests__/auto-rerun.test.ts`.

The offer section starved under 6-way fan-out and shipped a 38-leaf "rerun to retry"
placeholder wall. New `committedAsDeadlineExhaustedFromArtifactData` detects a section that
committed `complete` only via the deadline honest-gap body (carries the "exceeded its time
budget" marker), and the ADR-0012 auto-rerun now adds those zones to `rescueZones` — giving a
deadline-starved section ONE solo rerun (no fan-out contention, ~2–3 min) instead of shipping
the wall. The renderer (Lane 7) collapses a genuinely-unavailable section to one compact
honest card rather than 38 placeholder fields. **Proof:** 2 new auto-rerun tests
(rescue fires once on the offer wall; no rescue on a real section). **15/15 green.**

---

## 3. Lane 3 — Buyer persona grounding  *(engine containment + systemic strip, wired)*

**Files:** `src/lib/lab-engine/agents/verification/source-liveness.ts`,
`.../verification/provenance-gate.ts`; wired in `run-section.ts` (`annotateEvidenceSupportReview`).

Source-liveness now name-contains persona rows on the LIVE page (a fabricated name on an
HTTP-200 page is dropped/relabeled, not just dead-URL drops). The systemic
`stripUncontainedSourceUrls` lever — wired between the unverified-URL strip and quote-dedup —
relabels any verifier-graded-unsupported, non-trusted-host sourceUrl to a per-row unique
evidence-gap marker, catching fabricated personas + laundered competitor URLs + inline
market-stat URLs at once, while the per-row unique marker preserves the VoC distinct-source
minimum (no persistence collapse). The deterministic eval treats persona containment as
**ADVISORY** (it cannot fetch pages offline); the engine gate + the cold judge's
`noFabrication` boolean are the page-level backstops. **Proof:** new source-liveness +
provenance-gate tests (fabricated-name persona dropped, real persona survives, 3-uncontained-
source VoC body still persists).

---

## 4. Lane 4 — Competitor evidence counts = captured creatives  *(engine, wired)*

**Files:** `src/lib/lab-engine/agents/tools/competitor-ad-adapter.ts`,
`.../artifacts/schemas/competitor-landscape.ts`, `.../agents/build-prompts.ts`;
pricing-diversity gate wired into `run-section.ts` answer-tool `postRequiredEvidenceHook`.

Headline `verifiedCount`/`displayableTotal` now derive from (cannot exceed) the actual captured
creatives array length per platform — a 6-captured-all-Meta advertiser reports 6 (Meta),
0 LinkedIn, never an invented 35. Ad-library permalinks are offered as first-class citations.
A new `checkCompetitorPricingSourceDiversity` rejects a single non-vendor listicle monopolizing
the pricing rows. **Proof:** adapter + pricing-diversity unit tests (count clamps to captured;
zero-captured platform → 0; monopoly rejected, diverse set passes).

---

## 5. Lane 5 — VoC grounding + no laundering  *(engine, unit-proven)*

**Files:** `run-section.ts` (VoC surfacing Path #3 de-invert + corpus-topic guard + honest
verdict reframe), `scripts/zz-buyer-eval.mjs` (laundering definition).

VoC now surfaces real captured pain extracts (Path #2 already; Path #3 safety-net de-inverted)
instead of discarding them into empty blocks, and — critically — **reframes its verdict** when
quotes are surfaced: from the self-contradicting "below the bar… not buyer-language truth"
(while surfacing 7 quotes) to an honest "captured N directional pain extracts, no per-review
permalink — directional, not verified verbatim." A corpus-topic guard stops paraphrased corpus
summaries from masquerading as verbatim customer quotes. The eval's VOC-LAUNDERING is now
phrasing-independent: it fires only when paid-media cites a VoC that produced **zero** usable
quotes (citing real, honestly-labeled directional pain is legitimate). **Proof:** eval
checks-test (fires on zero-quote VoC; passes on surfaced quotes); full suite green.

---

## 6. Lane 6 — Cross-section coherence + provenance  *(data + eval)*

Economics ($25k budget, $4,200 current CAC, $3,000 target) travel only through the operator's
onboarding brief and are tagged accordingly; corpus-derived evidence is tagged `derived`. The
hardened eval surfaces the onboarding-vs-evidence split so the reader always knows a number's
origin. *(Fresh-run reader-surface confirmation in §Fresh Run.)*

---

## 7. Lane 7 — UI / design convergence  *(renderers + screenshots)*

**Files:** `src/components/research-v2/section-renderers/{demand-intent,voice-of-customer,
paid-media-plan,paid-media-plan-deck,offer-diagnostic}.tsx` + reader trust-tier language.

Demand-intent empty blocks collapse to one honest `GapNote` that surfaces the engine's own
`blockGap` (backfill-proven on the stale artifact — no rerun needed). Offer renders one compact
honest-unavailable card. Paid-media labels cost-per-trial vs modeled customer CAC distinctly.
Trust-tier status language replaces the "needs review" wall. *(Desktop + mobile screenshots in
§Screenshots.)*

---

## 8. Lane 8 — Chat as artifact editor  *(proven)*

**Files:** `src/lib/research-v2/chat-write-through.ts`, `src/app/api/research-v2/chat/route.ts`.

The chat edit path is section/artifact context-aware, captures a `ChatEditChangeReport`
(`{zone, intent, fields:[{field, before, after}]}`) via a read-only path resolver, applies the
patch through the safe `commit_artifact_section` RPC (now sanitized — the last raw write path to
`research_artifacts.data` is closed), and reports exactly what changed back to the user via
`formatChangeReport`. **Proof:** 18 chat tests green (sanitize-before-persist, RPC path,
change-report fields).

---

## 9. Lane 9 — Offline judge as release gate  *(built + proven)*

**Files:** `scripts/zz-buyer-eval.mjs` (+5 deterministic checks), `scripts/zz-judge-run.mjs`
(hardened verdict schema: `mediaPlanNumericallyCoherent`, `noFabrication`), new
`scripts/zz-release-gate.mjs` (combined gate). A run passes **only if**: deterministic buyer-eval
PASS **and** cold judge score ≥ 9 **and** `mediaPlanNumericallyCoherent === true` **and**
`noFabrication === true`. **Proof:** 23 gate unit tests; c77 → 1/10 FAIL demonstrates the gate
is no longer blind.

---

## Verification (offline)

- `npx tsc --noEmit` — **0 errors** (excluding the two known pre-existing baselines: openrouter
  tests, chat blueprint tests — per CLAUDE.md).
- `npm run test:run` — **2339 passed, 1 skipped** (ollama live canary), 242 files.
- research-worker: `npm run test:run` **40 passed**, `npm run build` **0 errors**.
- `node --test scripts/zz-buyer-eval.checks.test.mjs scripts/zz-judge-run.gate.test.mjs` —
  **23 passed**.

---

## Fresh Run  *(run 3b568ea0 — PENDING completion)*

_To be filled: deterministic eval scorecard, cold value-read score + per-section, release-gate
result._

## Screenshots  *(PENDING)*

_Desktop + mobile of the rendered fresh run._

## Cold value-read  *(PENDING — target ≥ 9/10)*
