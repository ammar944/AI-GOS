# Gap-to-8 Session Findings — 2026-06-18

**Objective:** Drive AI-GOS research product from ~7–7.5 toward a *proven* 8/10 media-buyer deliverable — clean sections, no hallucinated claims, no padded counts, no internal/debug bloat, a spendable Paid Media capstone.
**Posture:** Ultracode (dynamic multi-agent workflows, xhigh effort).
**Branch:** `refactor/architecture-deepening`. **Baseline HEAD at session start:** `15e29f82`. **HEAD after this session's code:** `76b87455`.
**Honest verdict:** Code shipped + offline-verified + committed (Wave 1 `21fa507c`, Wave 2 `76b87455`). Live Ramp run `b0d12b45` complete → **deterministic floor HARD-FAIL → still below 8, realistic ≈ 6.5–7** (§5). Demand (the worst section) + Offer CAC fixes proved out live; two structural blockers remain (BuyerICP fan-out starvation; VoC depth).

---

## 1. Method

Three phases, each a deterministic workflow with adversarial verification, then I (orchestrator) reconciled/reviewed between phases:

- **Phase 0 — diagnose:** 5 read-only agents in parallel (value / code-path / reader-cleanliness / proof-harness / cross-section), cross-checked against my own ground-truth `jq` probes of the fresh dumps.
- **Phase 1 Wave 1 — implement (parallel):** 6 disjoint-file TDD workstreams (none touching `run-section.ts`).
- **Phase 1 Wave 2 — implement (serial):** 5 `run-section.ts` depth fixes, single serial owner, TDD, then full diff review.
- **Proof:** offline gates → live confirmed-HEAD runs → buyer-eval → judge → 3-subject sweep.

The prior 4-agent audit (`2026-06-18-production-readiness-audit.md`) **predated commit `04111ab5`** and was stale; Phase 0 re-diagnosed against current HEAD to avoid re-implementing landed fixes.

---

## 2. Phase 0 — per-section diagnosis (media-buyer value-read)

| Section | Score (pre) | Buyable | Dominant defect | Priority |
|---|---|---|---|---|
| Market & Category | 7 | yes | empty TAM (`marketSize.signals:[]`, bottomUpTam 4/4 evidence-gap) | A |
| Buyer ICP | 6 | yes | self-contradicting `evidenceGap:true` + "personaReality is empty" while 3 personas promoted | C |
| Competitor | 6 | yes | 0 verified competitor creatives (acquisition depth — out of scope this round) | — |
| Voice of Customer | 5 | no | StrategicInsightPanel rendered `evidence gap:` placeholders as a bold hero; self-contradicting shortfall note | D/G |
| Demand & Intent | 4 | **no** | keyword_discovery returned educational SEO junk (`opportunity cost`, `california secretary of state`), not commercial demand | B |
| Offer Diagnostic | 5 | yes | fabricated `$4,200 / 40% CAC overshoot` asserted as fact; CTA-strip jargon leak | E |
| Paid Media (capstone) | 7 | yes | gap rows showed confident `$/day` not probe budget; feasibilityAudit computed but never rendered | F |
| Executive synthesis | 5 | no | fact-ledger contamination (`$13B` valuation→acv; `$100`→monthly-budget winner; unsupported 40%) | E |

**Root-cause catches my own probing surfaced (deeper than the agents):**
- **B:** `buildCategoryDemandKeywordTerms` was wrapping the whole prose category `"Financial technology (corporate cards & spend management)"` into unsearchable seeds → SpyFu measured **zero** category demand, so only the educational kombat junk survived. The real fix is **parsing clean commercial head terms**, not "adding seeds."
- **C:** `withNormalizedBuyerICPOutput` already strips the gap when ≥3 personas promote — the contradiction was the **ledger re-injecting it afterward**. So C ≈ the ledger fix; fabricating per-persona triggers/venues would violate the truth floor and was rejected.

---

## 3. Implementation

### Wave 1 — coherence + reader cleanliness — commit `21fa507c`
Six disjoint-file TDD workstreams (RED-first):

- **C-LEDGER** (`buyer-icp-acquisition-ledger.ts`): the report-absent branch no longer fabricates `evidenceGap:true` + "personaReality is empty" when ≥3 named personas already promoted.
- **E-LEDGER** (`synthesis/fact-ledger.ts`, `contradictions.ts`): bind currency tokens to fact context; drop ≥$1B readings from acv/cac/budget facts; prefer a magnitude-plausible winner (kills `$13B→acv` and `$100→budget`).
- **E-THESIS** (`executive-brief.ts`, `verification/numeric-coherence.ts`): thread `isPercent` so a percent claim is only validated by PERCENT evidence — the unsupported `40%` scrubs from the thesis and the section gate (2% tolerance preserved for genuine numbers).
- **E-CTA** (`verification/source-liveness.ts`): rewrote the contradicted-CTA placeholder from internal jargon to clean reader prose reconciling the free-signup finding.
- **PAID-MEDIA RENDERERS** (`paid-media-plan{,-deck}.tsx`): gap-status rows render a test/probe budget label, not confident `$/day`; the computed-but-unrendered `feasibilityAudit` is now surfaced.
- **READER-CLEANLINESS** (`voice-of-customer.tsx`, `strategic-insight-panel.tsx`, `primitives/{gap-note,evidence-chip,decision-card}.tsx`, `executive-brief-card.tsx`, `voice-of-customer-candidates.ts`): suppress the VoC strategic panel when all fields are `evidence gap:` placeholders; route gap-note/title/meta through scrub primitives; drop the stray `$100` conflict row; strip synthesized meta-summary lead-ins from directional quotes.

### Wave 2 — Demand seeds, Market TAM, offer/VoC honesty — commit `76b87455`
Serial `run-section.ts` depth fixes (TDD RED-first):

- **R-B (Demand 4/10 — highest leverage):** `parseCategoryDemandHeads` splits the prose category on parens/`&`/`,`/`;`/`/`/"and", drops over-generic umbrella heads (`financial technology`, `software`…), emits bare/software/alternatives commercial variants per clean head (`corporate cards`, `spend management`). `isCommercialDemandKeyword` filters SpyFu kombat rows to those sharing a category token or a commercial modifier — dropping `opportunity cost` / `california secretary of state` / `mission statement examples`.
- **R-A (Market sizing):** keyword_volume prepass now also runs for Market & Category (reuses the existing candidate-block thread; gate widened at both runner call sites). Sources `marketSize.signals` + bottomUpTam keyword-volume/commercial-intent-share; conversion-rate **and** acv stay honest evidence-gaps → schema keeps `reachableRevenueEstimate` "directional only". **No fabricated TAM.**
- **R-D (VoC):** `buildVoiceOfCustomerShortfallNote` no longer calls directional quotes "verified" and no longer quotes the "6/3" bar once the pack exceeds it; states the real reason (no per-review permalinks).
- **R-E (Offer):** `stripUnattributedOperatorEconomics` relabels a fabricated CAC/LTV money figure (the invented `$4,200 / 40%`) to "operator-reported (actual figure not disclosed)" and neutralizes the derived overshoot percent — scoped to CAC/LTV-cue strings and figures not in the brief economics. Verified Wave 1 did NOT already cover it.
- **R-G:** reader-bound sourceTitle is now "SpyFu monthly search volume" / "SpyFu competitor-gap keywords" — `keyword_volume`/`keyword_discovery` no longer leak into the keyword-table Source column.

### Two correctness catches during diff review (verification, not trust)
- **gap-note over-collapse:** Wave 1's `isReaderPipelineChrome` flagged the legit caveat "…replaced by live **SpyFu** output" as chrome (TOOL_NAME_PATTERN matches `spyfu`) and nuked it to a generic gap sentence. Fixed with a narrower `containsReaderForbiddenChrome` (vendor-brand-free) — SpyFu/Perplexity stay; only snake_case tool IDs collapse. (Caught by a pre-existing `audit-reader-shell` test regressing — root-caused, not scrubbed.)
- **LTV-as-ACV:** Wave 2 sourced the Market TAM `acv` input from `avgLtv`. LTV ≠ ACV (would overstate TAM 3–6×). Changed to an honest evidence-gap.

---

## 4. Offline verification (all green, confirmed HEAD `76b87455`)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm run test:gate` (4 deterministic gate suites) | 99 / 99 |
| `npm run test:run` (full) | **2589 passed**, 1 skipped, 0 failed |
| `npm run build` | success |
| `git diff --check` | clean |

Throwaway files (`CLAUDE-FABLE-5.md`, `scripts/zz-probe-*`, `scripts/zz-drive-e2e-airtable.mjs`, the new `scripts/zz-gap8-section-gates.mjs`) were **excluded** from both feature commits.

---

## 5. Live proof — Ramp E2E COMPLETE (run `b0d12b45`, confirmed HEAD `76b87455`)

**Infra (verified up):** dev `:3000` (`LAB_ENGINE_PROVIDER=deepseek-direct`); worker `:3001` healthy; CDP Chrome `:9223` live Clerk session; preflight READY.

**Run:** `b0d12b45-c4a5-4c1d-9e3a-1fb11668bc44` · corpus 592s · 6 sections + Paid Media 511s · exec brief 60s · all 8 zones committed, exec thesis 48 words, 5/5 fact conflicts resolved. Reader: `http://localhost:3000/research-v3?runId=b0d12b45-c4a5-4c1d-9e3a-1fb11668bc44` (Clerk-authed). Screenshots: `tmp/e2e-grill-ramp/*.png`.

### Verdict: deterministic floor `zz-buyer-eval` = **HARD-FAIL** → run is **below the 8 bar**. Realistic ≈ **6.5–7**.

The 8/10 acceptance requires `zz-buyer-eval` CLEAN *before* a judge score counts; it hard-failed, so the judge was not spent. Prior baseline (stale, pre-fix `d2abf018`): 6.7, `noFabrication:false`, `wouldPay:with-caveats`.

**`zz-buyer-eval` — 16 / 18 checks PASS, 2 hard-fail (`docs/reports/buyer-eval-b0d12b45.md`):**

| Check | Result |
|---|---|
| CASCADE, PROJECTIONS, BUDGET-PARTITION, CAC-UNIT, CHANNELS, ANGLES, CREATIVE, MEMO | ✅ PASS |
| **DENY-LIST** (reader chrome) | ✅ PASS — hits=0, 7 zones + thesis |
| QUOTES, VOC-LAUNDERING, COMPETITOR-COUNT, SECTION-EMPTINESS, TIERS, PERSONA-CONTAINMENT | ✅ PASS |
| **VOC-EMPTY-DESPITE-EVIDENCE** (×2, never-ship) | ❌ acquired 66, only 9 usable, **48 promotable rejected for count/selection**, decision blocks ship empty |
| **PRICING** | ❌ 0 pricing rows across 3 competitor domains |

**Per-priority A–G gates (`scripts/zz-gap8-section-gates.mjs`) — 2 hard-fail:**

| Priority | Gate | Result |
|---|---|---|
| **B (Demand — was the worst, 4/10)** | B1 category-commercial present | ✅ **12 commercial keywords** (`spend management`, `corporate cards`…) |
| **B** | B2 no educational-as-commercial | ✅ **clean** — `opportunity cost` / `california secretary of state` gone |
| **A (Market)** | A2 no fabricated TAM | ✅ honest cap, **2/4 inputs sourced** (was 0/4), no `$` figure |
| **A** | A1 signals populated | ⚠️ `signals=0` (model didn't copy the prepass rows into `marketSize.signals`) |
| **C (BuyerICP)** | C1 evidenceGap reconciled | ✅ honest (gate waived — `personas=0`, evidenceGap honestly set) |
| **D (VoC)** | D1 counts==rows==sources · D2 no-fanning | ✅ 9 quotes / 4 hosts, no fanning |
| **E (Offer/Exec)** | E2 CAC operator-labeled | ✅ **0 unlabeled** — the 40%/$4,200 fix held |
| **E** | E1 no valuation-as-acv | ✅ no ≥$1B in acv |
| **E** | **E3 budget winner not stray** | ❌ **monthly-budget winner = $4.10** — a SpyFu CPC contaminated the fact (context "monthly *searches*" matched the budget cue); real $25K/mo lost |
| **G (reader)** | G1 no banned terms | ✅ 6/7 zones clean · ❌ **CompetitorLandscape leaks `verifiedCount` + `429`** into reader prose (the off-limits ad-wall section) |

### What's proven FIXED on the live run
- ✅ **Demand (B)** — the worst section: 12 commercial keywords, zero educational-as-commercial. The category-parser root-cause fix landed live.
- ✅ **Offer CAC (E2)** — 40%/$4,200 operator-labeled.
- ✅ **Reader DENY-LIST = 0 hits** at section level; VoC honesty (no fanning, honest counts).
- ✅ **Market (A)** — honest cap, 2/4 inputs sourced (was empty), no fabricated TAM.

### The two structural blockers to 8 (neither a coherence bug the waves targeted)
1. **BuyerICP starves to 0 personas under 6-way fan-out** (`personaCount:0`; a solo rerun gets 3 — documented contention, `learned-patterns.md`). Single biggest score cap.
2. **VoC ships shallow** — 48 promotable quotes dropped by selection caps; objections/switching/criteria/success empty. `buyer-eval` treats empty-despite-evidence as never-ship. This is *acquisition depth*, explicitly deferred by the roadmap and now the binding constraint.

### Two narrow real bugs the live run surfaced (in-scope, not yet fixed)
- **E3:** SpyFu CPC ($4.10) harvested as a "monthly budget" reading because its context says "monthly searches" — the W2 magnitude guard didn't catch it on the manifest `winnerForFact` path. Fix: tighten the monthly-budget context cue + apply the magnitude floor on that path.
- **G1:** CompetitorLandscape leaks `verifiedCount` + `429` into reader prose — needs a careful string-only scrub (the eyeball-verified ad wall is otherwise off-limits).

**3-subject sweep (Fathom / Plain): NOT run** — gated on Ramp clearing the floor first; it did not. (Respects "paid APIs never loop without an abort condition.")

---

## 6. Definition of done (product-level 8/10) — NOT yet met

All three fresh confirmed-HEAD runs (Ramp / Fathom / Plain) must satisfy:
`zz-buyer-eval` CLEAN · judge `--gate` exit 0 (≥8, coherent, no fabrication) · `wouldPay:"yes"` · **no section below 8** · clean reader screenshots.

Per the operating bar: **no 8/10 claim from unit tests, solo dumps, or an overall average** — only the live full-run sweep counts.

---

## 7. Provenance
- Implementation queue: `docs/reports/2026-06-18-gap-to-8-implementation-queue.md`
- Phase 0 diagnosis workflow: `wf_afef3796` · Wave 1 workflow: `wf_cfaf6ef4` · Wave 2: serial agent `wave2`
- Commits: `21fa507c` (Wave 1), `76b87455` (Wave 2)
- Stale prior audit (superseded): `docs/reports/2026-06-18-production-readiness-audit.md`
