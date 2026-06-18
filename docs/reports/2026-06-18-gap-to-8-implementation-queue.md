# Gap-to-8 Implementation Queue — reconciled from Phase 0 diagnosis (2026-06-18)

**Baseline:** HEAD `15e29f82` (docs); load-bearing code `04111ab5` (live-path rewire). The prior 4-agent audit (`2026-06-18-production-readiness-audit.md`) PREDATES `04111ab5` and is stale.
**Method:** Phase 0 read-only fan-out (5 agents: value / code-path / reader / proof / cross-section, workflow `wf_afef3796`), reconciled + cross-checked against fresh solo dumps (`tmp/zz-section-out/positioning{BuyerICP,VoiceOfCustomer,DemandIntent}.json`, today 12:09–12:13) and the stale full run `d2abf018` (`tmp/grill/ramp-current-status/*`).

## Per-section value-read (current, media-buyer bar)

| Section | Score | Buyable | Dominant gap | Priority |
|---|---|---|---|---|
| Market & Category | 7 | yes | empty TAM (`marketSize.signals:[]`, bottomUpTam 4/4 evidence-gap) | A |
| Buyer ICP | 6 | yes | self-contradicting `evidenceGap:true` + "personaReality is empty" while 3 personas promoted; triggers/venues 0 | C |
| Competitor | 6 | yes | 0 verified competitor creatives (acquisition depth, not in this queue) | — |
| Voice of Customer | 5 | no | StrategicInsightPanel renders `evidence gap:` placeholders as a bold hero; self-contradicting shortfall note | D/G |
| Demand & Intent | 4 | no | keyword_discovery returns educational SEO junk (opportunity cost, california secretary of state), not commercial demand | B |
| Offer Diagnostic | 5 | yes | fabricated $4,200/40% CAC overshoot asserted as fact; CTA-strip jargon leak in whyBinding | E |
| Paid Media (capstone) | 7 | yes | gap rows show confident $/day not probe budget; feasibilityAudit computed but never rendered | F |
| Executive synthesis | 5 | no | fact-ledger contamination ($13B valuation→acv, $100→monthly-budget winner, unsupported 40%) | E |

## Serialization rule
`src/lib/lab-engine/agents/run-section.ts` (13,137 lines) is touched by A, B, C, D, E, G → **one serial owner (Wave 2)**. Everything else is disjoint-file → **Wave 1 parallel**.

---

## WAVE 1 — disjoint files, parallel, TDD RED-first (none touch run-section.ts)

### W1 · C-LEDGER — `src/lib/lab-engine/agents/buyer-icp-acquisition-ledger.ts`
Defect: P0b branch (`~245-251`) sets `evidenceGap:true` + summary *"…no named buyer cleared the grounding bar, so personaReality is empty…"* even when `groundedPersonaCount >= BUYER_ICP_PROMOTED_PERSONA_FLOOR` (3). Fresh dump: 3 personas promoted yet flagged empty.
Fix: when `groundedPersonaCount >= floor`, attach `acquisitionLedger`+`sufficiency` as **diagnostic only** — do NOT set `evidenceGap:true`, do NOT use the "personaReality is empty" summary; write an honest sufficient summary. Set `evidenceGap:true` only when `groundedPersonaCount < floor`.
RED test: synth body, 3 grounded personas, `evidenceGapReport:null` → after `withBuyerICPAcquisitionLedger`: `evidenceGap !== true`, `reason !== 'insufficient_named_buyer_personas'`, no "personaReality is empty"; still passes `validateBuyerICPMinimums` + schema parse. Gate **C1**.

### W2 · E-LEDGER — `src/lib/lab-engine/agents/synthesis/fact-ledger.ts` + `contradictions.ts`
Defects: (a) `addTextReadings` (`493`) accepts any `$` token leaf-wide → $13B valuation contaminates `acv`; (b) `readingUnitClassForFact` (`173`) classes all monthly-budget currency as currency-monthly w/o requiring monthly/spend context; (c) `winnerForFact` (`872`) / `deterministicWinnerForFact` (`283`) have no magnitude guard → monthly-budget winner = $100 beats $25K/mo brief.
Fix: (1) bind currency tokens to the fact's sentence context (a value classes as `acv` only with ACV/contract context, `currency-monthly` only with monthly/spend); (2) magnitude ceiling — drop readings `>= $1B` from acv/cac/budget facts; (3) inject the onboarding brief budget ($25K/mo) as a brief-supplied reading and prefer a brief-sourced, magnitude-plausible winner over a stray $100.
RED test: readings incl $13B + $100 + $25000/mo → `acv` winner has no `>=$1B` reading; budget winner == 25000. Gates **E1, E3**. NON-GOAL: no global hard-fail validator.

### W3 · E-THESIS — `src/lib/lab-engine/agents/executive-brief.ts` + `verification/numeric-coherence.ts`
Defect: thesis (`734`) model-authored, `scrubFieldNumbers`(`893`)/`numericTokenAllowed`(`867`) keep a token within 2% of *any* pooled value → unsupported **40%** CAC-overshoot survives (some pooled value ≈40).
Fix: thread `isPercent` — a percent token may only be validated against PERCENT evidence, never a non-percent pooled number. The unsupported 40% then scrubs from the thesis. Keep the 2% guard for legitimate numbers.
RED test: thesis "inflates CAC by 40%" with no 40% in percent-evidence pool → scrubbed. NON-GOAL: don't weaken legitimate-number guard.

### W4 · E-CTA-PLACEHOLDER — `src/lib/lab-engine/agents/verification/source-liveness.ts`
Defect: `contradictedSubjectCtaPlaceholder` (`1122-1123`) = "Evidence gap: subject-site CTA claim removed because fetched subject pages showed a free/signup path." → leaks `CTA`/`fetched subject pages` into reader `whyBinding`.
Fix: rewrite to clean reader prose, no internal jargon, that ALSO reconciles the contradiction: e.g. *"This company offers a free, self-serve signup, so a pricing-gate constraint does not bind here."*
RED test: placeholder contains none of `CTA|fetched|prepass|evidence gap:`; reads as a clean sentence. Gates **E2, G1**.

### W5 · RENDERERS — reader cleanliness + paid-media gap framing + VoC panel
Files: `paid-media-plan-deck.tsx`, `paid-media-plan.tsx`, `voice-of-customer.tsx`, `strategic-insight-panel.tsx`, `demand-intent.tsx`, `primitives/gap-note.tsx`, `primitives/evidence-chip.tsx`, `primitives/decision-card.tsx`, `executive-brief-card.tsx`, `voice-of-customer-candidates.ts`.
- **F:** when `evidencePack.status==='gap'`, render budget as test/probe language (not confident `money(dailyBudget)`); render `body.feasibilityAudit.verdicts` (matched keywords / volume basis / budget provenance) — computed but never shown.
- **D/G:** `voice-of-customer.tsx:246` — suppress `StrategicInsightPanel` when every field is an `evidence gap:` placeholder (use `classifyReaderText`; render only `kind==='text'` fields).
- **G:** route raw fields through existing `scrubReaderText`/`clientGapSentence` — `gap-note.tsx` `children`+`howToClose` (`23,42`), `evidence-chip.tsx` `source.title` (`45`), `decision-card.tsx` `meta` (`40`), `demand-intent.tsx` gap summaries; `executive-brief-card.tsx` suppress/scrub the $100 budget conflict row.
- **D:** `voice-of-customer-candidates.ts` — strip synthesized meta-summary prefix ("Customer reviews on … highlight …") from directional quote `verbatimText`, keep only verbatim.
RED tests: renderer tests assert banned terms absent, gap rows show probe language, panel not rendered for all-placeholder input. Gates **G1, G2, G3, F2, F3**.

---

## WAVE 2 — serial, single owner of `run-section.ts` (after Wave 1)

- **R-A (A):** `buildMarketTamKeywordPrepass` mirroring `buildBrandedKeywordPrepass`; call at both streaming sites when `sectionId==='positioningMarketCategory'`. `keyword_volume` on category/commercial seeds → source bottomUpTam `keyword-volume` + `commercial-intent-share` (commercial/total split); conversion-rate honest gap; acv operator-reported from brief. **ASSUMPTION:** surface a *sourced reachable monthly paid-search spend ceiling* (Σ commercial volume × CPC); compute `reachableRevenueEstimate` only when inputs allow, else keep the honest cap — **no fabricated TAM**. Deadline 20s + abort-threaded.
- **R-B (B):** in `discoverNonBrandedDemandRows`(`9618`)/`buildCategoryDemandKeywordTerms`(`9385`) also seed `keyword_discovery` with category/commercial seeds (derive from `company.category` + universal commercial modifiers: `<category>`, `<category> software`, `<category> alternatives`, `best <category>`, `corporate card`, `expense management`, `AP automation`, …) via the tool's existing `seed` mode. Add a deterministic educational-denylist that DROPS/downgrades generic terms (accounting definitions, `example`, `statement examples`, government/registration like `california secretary of state`, `mission statement`). Require commercial rows in candidate block; enforce `intentType`.
- **R-C (C):** in `withNormalizedBuyerICPOutput` (`~6273`) backfill persona `triggers`/`venues` from case-study candidate evidence where sourced; mark self-sourced `ramp.com` personas `vendorSourced` honestly (don't drop legit case-study champions). Coordinates with W1.
- **R-D (D):** rewrite `buildVoiceOfCustomerShortfallNote` (`1237`): `verified`→`directional`; drop "Our bar is 6 quotes across 3 sites" when `foundPainQuoteCount >= VOC_MIN_QUOTES`; state the real reason (no per-review permalink).
- **R-E (E):** offer gate alongside `stripContradictedSubjectCtaClaims`(`4163`)/`namedEntityStrip`(`4194`) — strip/relabel any CAC/LTV/conversion number NOT in brief operator metrics; the fabricated $4,200 CAC + derived 40% removed or relabeled "operator-reported; actual CAC not disclosed". (Root fix; W3 is defense-in-depth.)
- **R-G (G):** `sourceTitle "SpyFu keyword_volume"`→`"SpyFu monthly search volume"` (`9585`); extend reader scrub (`scrubBodyInternalJargon`) over verdict/statusSummary/blockGap.summary/prose before persistence so `keyword_volume|web_search|prepass|CTA` never persist.

---

## Verification & proof (per `proof` agent overallAcceptance)
Offline: `npx tsc --noEmit` (0) · `npm run test:gate` (4 suites) · `npm run test:run` · `npm run build` · `git diff --check` · per-priority jq gates (A1/A2, B1/B2/B3, C1/C2/C3, D1/D2, E1/E2/E3, F2/F3, G3) on regenerated bundles · `zz-coherence-gate-replay.ts` (0 strikes).
Live (paid, ~$4/run): bring up `LAB_ENGINE_PROVIDER=deepseek-direct npm run dev` + `cd research-worker && npm run dev` + Clerk CDP Chrome → `E2E_SUBJECT={ramp,fathom,plain} node scripts/zz-drive-e2e-airtable.mjs` → `zz-dump-run-sections.mjs` → `zz-buyer-eval.mjs` (CLEAN) → `zz-judge-run.mjs --gate` (≥8, noFabrication, coherent) → per-section `jq '… (.perSection|map(.score)|min) >= 8'`.
**8/10 product bar = all 3 fresh confirmed-HEAD runs ≥8, noFabrication:true, wouldPay:yes, no section <8, clean reader screenshots.** No claim of 8 from unit tests / solo dumps / averages.

## Non-goals (hard)
No touch to review/persist path · no weakened truth floors · no global hard-fail validators for strictness theater · no touch to the verified competitor ad wall mechanism (string scrubs OK) · exclude `CLAUDE-FABLE-5.md` + throwaway `zz-probe-*` from commits.
