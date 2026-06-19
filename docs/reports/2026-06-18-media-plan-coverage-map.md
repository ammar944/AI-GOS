# Media Plan — Template→Pipeline Coverage Map (2026-06-18)

> **What this is.** The backward-design spine the 2026-06-18 handoff asked for: every cell of SaaSLaunch's **Paid Media Plan deck** (the Growth Playbook's `Media Plan` slot — see CONTEXT.md:107) mapped to the research Section that feeds it, the `paid-media-plan.ts` schema field that holds it, and an honest coverage status. Built by reading all 8 lab-engine schemas + the paid-media synthesis seam directly (`run-section.ts`).
>
> **Glossary anchoring.** The PDF deck = the **`Media Plan` slot of the Growth Playbook**. The **Media-Plan SOP** (CONTEXT.md:111: channel-by-ACV, per-platform minimums Meta $3k/Google $5k/LinkedIn $5k, budget-split %, projected-results table w/ 20% margin) is the *logic/rubric*. The deck is produced by the terminal **`positioningPaidMediaPlan` Section**, which re-synthesizes the 6 supplier Sections (Market, BuyerICP, Competitor, VoC, Demand, Offer) + **GTM Brief** + **Media Plan Setup** onboarding (`salesProcessDocs`, `salesLoomUrl`, `creativeCapacity`, `leadListAvailable`).
>
> **Source:** workflow `media-plan-coverage-map` (wf_be91d274-30b) — 8 schema/synth extractors → high-effort synthesis.

## Headline

The pipeline can structurally reach **~34 of ~78 template cells** from research (BuyerICP audiences, VoC angles/hooks, Offer channel/CAC feasibility, Competitor data cells, Market context), but **only ~11 are genuinely grounded today** — and the two highest-stakes pages (**Audience Types** and the **Projected-Results exhibit**) are exactly where it is weakest: BuyerICP can silently ship empty via rollup-padding (b0d12b45), and the projected count/CAC numbers carry **no row-level evidence** and ride hardcoded platform CPC/CVR defaults.

The deeper problem is **architectural, not coverage**: 10 array blocks force rows via `.min(N)` and only **6 carry an evidencePack**, so 4 synthesized blocks (`funnelIdeation`, `kpis`, `crossSectionInsight`, `projectedResults`) manufacture confident positional placeholders over zero input. The real fix is a **buyer-eval gate that lets the TEMPLATED spine pad but forbids any SYNTHESIZED cell from shipping confident content while its upstream supplier is empty** — plus **16 onboarding-input** cells and **7 team-asset** cells the autonomous pipeline can never own and must template/attach.

## Tallies (~78 cells)

| Class | Count | Meaning |
|---|---|---|
| Research-fillable | 34 | The pipeline's job — BuyerICP/VoC/Offer/Competitor/Market |
| Onboarding-input | 16 | Budget, platform, client lead-list, CVR chain — from the GTM Brief / Media Plan Setup; pipeline can never derive |
| Team-asset | 7 | SaaSLaunch standing playbook — Sales Process docs, Loom, creative SOP counts; attach, never generate |
| Templated boilerplate | ~21 | Phase labels, KPI labels, positional copy — the copy-paste spine |
| **— of which genuinely grounded today** | **~11** | source-bound / code-traceable |
| **— missing or broken** | **4** | no schema field, or template wants more rows than floors guarantee |

---

## Full per-page coverage map

**Status legend (used in every row):**
- ✅ grounded — code-computed or source-bound (sourceUrl / evidencePack.status=grounded / arithmetic-traceable)
- ⚠️ partial — source-anchored but interpretive, OR forced row that *can* carry an evidencePack but may ship status:gap
- 🔴 fabrication-risk — `.min(N)`-forced row with a static positional default + no evidencePack, ships confident over thin input
- 🧩 team-asset — SaaSLaunch standing playbook (SOP counts, Sales Process docs, Loom); pipeline can NEVER fill from research
- 👤 onboarding — budget / platform / client list / CVR chain; pipeline can NEVER derive, must be supplied by the brief
- ❌ missing — no schema field, or template wants more rows than schema floors guarantee

### Page 1 — Cover  *(Supplier: gtmBrief + onboarding, NOT research)*
| Template cell | Source | Schema field | Status | Notes |
|---|---|---|---|---|
| Title "Paid Media Plan — {Company}" | gtmBrief | `sectionTitle` | 🔴 | `.min(1)` model-authored; no company-name binding, model fills. |
| Platform line ("Meta Advertising") | onboarding | `campaignOverview.platform` | 👤 | Hard-defaults to **'Meta Ads'** (paid-media-plan.ts:753) — MISBRANDS a non-Meta plan. Real value = onboarding.distributionChannels (threaded as channelHint, not into this field). |
| Phase label ("Phase 1 & 2") | onboarding/template | `campaignOverview.phaseCount` | ⚠️ | `z.number()` no provenance; should mirror campaignPhases length. |
| Monthly budget | onboarding | `campaignOverview.monthlyBudget` | 👤 | Honest 'Budget not provided' gap fallback; display `.min(1)` can ship over unknown provenance (obs 38131). |
| Prepared-by footer | static | — (render) | 🧩 | Standing agency footer; attach at render. |

### Page 2 — Campaign Overview  *(Supplier: onboarding economics + template, NOT research)*
| Template cell | Source | Schema field | Status | Notes |
|---|---|---|---|---|
| Campaign overview prose | synthesis | `campaignOverview.prose` | 🔴 | `.min(1)`; NOT in EVIDENCE_PACK_ROW_TYPES → never anchor-checked. Static fallback. |
| Monthly budget tile | onboarding | `monthlyBudget/Value/Provenance` | 👤 | Value dropped to undefined on unknown provenance (honest); provenance chip enum-snapped ✅. |
| Daily spend tile | onboarding | `dailySpend/Value/Provenance` | 👤 | Derived monthly/30, provenance 'derived' ✅. |
| # months | onboarding/template | `totalMonths` | 🔴 | static default **4**. |
| # phases | template | `phaseCount` | 🔴 | static default **2**. |
| Primary KPI | onboarding/template | `primaryKpi` | 🔴 | `.min(1)`, static default 'MQLs / Signups', no evidencePack. |

### Page 3 — Campaign Phases  *(Supplier: onboarding budget + fixed phase copy, TEMPLATED)*
| Template cell | Source | Schema field | Status | Notes |
|---|---|---|---|---|
| Phase rows (1–3) | template | `campaignPhases` (`.min(1).max(3)`) | 🔴 | `.min(1)` FORCES ≥1 phase; NOT in EVIDENCE_PACK_ROW_TYPES. |
| Per-phase name / months label | template | `phaseName` / `monthsLabel` | 🔴 | static positional 'Phase 1 - Testing', 'Months 1-2'. |
| Per-phase budget | onboarding | `monthlyBudget/Value/Provenance` | 👤 | display forced; value honest-dropped; cascade guard phase≤monthly. |
| Per-phase bullets (4–5) | template | `bullets` | 🔴 | static generic bullets. |

### Page 4 — Audience Types ⭐ *(highest-stakes synthesized page. Supplier: BuyerICP→audiences + onboarding budget split)*
| Template cell | Source | Schema field | Status | Notes |
|---|---|---|---|---|
| Audience rows (1–4) | BuyerICP | `audienceTypes` (`.min(1).max(4)`) | ⚠️ | `.min(1)` FORCES ≥1; IS in EVIDENCE_PACK_ROW_TYPES → post-commit token-anchor; forced row w/ no upstream match ships status:'gap'. |
| Audience slot / archetype | template | `slot / archetype` | 🔴 | static positional 'Broad Prospecting'/'High Intent'/'AI Optimized'. |
| Interest-stack contents (01) | BuyerICP | `firmographicCuts[]` | ⚠️ | Each cut has REQUIRED isHttpUrl sourceUrl ✅ at source; BUT row-level evidence-pointer LOSS at PaidMedia boundary (memory 38101). |
| ABM ICP list (02, named champions) | BuyerICP | `personaReality.personas[]` | ⚠️ | Strongest source cell: name/title/company + REQUIRED sourceUrl + liar-catcher. PARTIAL: persona-laundering (G2 shared-listing URLs), **empty-commit rollup-padding can ship 0 personas (b0d12b45)**. |
| Per-audience daily budget | onboarding | `dailyBudget/Value/Provenance` | ⚠️ | arithmetic split of user budget; largest-remainder repair, provenance 'derived'; cascade ±$5. |
| Audience targeting detail | BuyerICP | `detail` | 🔴 | `.min(1)` forced; default 'Evidence gap...' → status:gap. |
| Audience grounding label | synthesis | `grounding` | 🔴 | FREE TEXT, defaults literal 'UNVERIFIED' — trust evidencePack.status not this. |
| Source attribution | synthesis | `sourceSection` (.catch('unattributed')) | ✅ | honest attribution fallback. |

### Page 5 — Creative Strategy  *(Supplier: TEAM-ASSET SOP counts + onboarding creativeCapacity, NOT research)*
| Template cell | Source | Schema field | Status | Notes |
|---|---|---|---|---|
| Creative strategy prose | synthesis | `creativeStrategy.prose` | 🔴 | `.min(1)`, NOT anchor-checked; static fallback. |
| Static/video/total per-audience counts | team-asset | `staticCount/videoCount/totalPerAudience` | 🧩 | **SINGLE-WRITER**: deriveCreativeCounts ALWAYS overwrites model — SOP constants (lean 3/1, standard 5/3, high 8/5) keyed by brief creativeCapacity. NOT research. |
| Angle types in mix | VoC/Offer | angle enum | ⚠️ | classification rides on synthesized framework. |

### Page 6 — Angles to Test ⭐ *(synthesized upgrade #1. Supplier: VoC→angles/hooks primary, + Demand/Market/Competitor)*
| Template cell | Source | Schema field | Status | Notes |
|---|---|---|---|---|
| Angle rows (2–6) | VoC | `anglesToTest` (`.min(2).max(6)`) | ⚠️ | `.min(2)` FORCES ≥2 even on thin input; IS in EVIDENCE_PACK_ROW_TYPES (anchored to VoC/positioning). |
| Angle shortName / type | synthesis | `shortName` / `angleType` | 🔴 | static 'Angle N' / default 'REVIEW'. |
| Angle description (the copy/hook) | VoC | `description` | 🔴 | `.min(1)` forced; default 'Evidence gap...'. Real grounding = VoC verbatim pain quotes (✅ at source: `painLanguage.quotes[].verbatimText` + REQUIRED sourceUrl). Degrades to gap when VoC empty. |

### Page 7 — Creative Framework (filled) ⭐ *(synthesized upgrade #2. Supplier: Offer + VoC + Market)*
| Template cell | Source | Schema field | Status | Notes |
|---|---|---|---|---|
| Creative slots (3–12) | VoC/Offer | `creativeFramework` (`.min(3).max(12)`) | ⚠️ | `.min(3)` FORCES ≥3; IS in EVIDENCE_PACK_ROW_TYPES. |
| Slot label (PST 1-3, Objection, USP, Before/After) | template | `label` | 🔴 | static positional labels. |
| **Hook copy (the literal headline)** | VoC/Offer | `hook` | 🔴 | `.min(1)` forces a hook; default 'Evidence gap...'; model-authored. |
| Before/After 'After' state | VoC | `successLanguage.quotes[]` | ⚠️ | After-state verbatim grounded at VoC ✅ but block gappable. |
| Objection rebuttal (PST Solution) | VoC | `objections.items[].howToHandle` | 🔴 | howToHandle is synthesized advice with NO sourceUrl; labeled 'Directional, not independently-confirmed'. |
| USP sentence | Market/Offer | Market categoryPowerBet / Offer proofPoints | ⚠️ | Offer proofPoints ✅ have sourceUrl; Market USP is confident uncited synthesis 🔴. |

### Page 8 — Competitor Insights: Reviews (3 complaints)  *(Supplier: VoC + Competitor)*
| Template cell | Source | Schema field | Status | Notes |
|---|---|---|---|---|
| Complaint rows ("EXACTLY 3") | Competitor/VoC | `competitorReviewInsights` (NO `.min`) | ⚠️ | **Count is PROMPT-ONLY, NOT schema-enforced** — thin input yields <3, NOT fabricated. IS in EVIDENCE_PACK_ROW_TYPES. |
| Verbatim complaint | VoC/Competitor | `complaint` | ⚠️ | grounded from VoC painLanguage / Competitor publicWeaknesses.verbatimQuote (REQUIRED sourceUrl ✅); fallback gap string. |
| How-we-leverage | synthesis | `howWeLeverage` | 🔴 | synthesized ad-leverage, no source; fallback gap string. |
| Source attribution | synthesis | restampVocSourceSection | ✅ | anti-laundering: VoC rows re-stamped 'unattributed' when VoC declared gap (3b568ea0). |
| **Template wants 3, schema floors 0–1** | — | — | ❌ | If render forces 3, rows 2–3 are plan-writer fabrication on thin runs. |

### Page 9 — Competitor Insights: Marketing (6 cells/competitor)  *(Supplier: Competitor + Market)*
| Template cell | Source | Schema field | Status | Notes |
|---|---|---|---|---|
| Teardown rows ("≥2") | Competitor | `competitorMarketingInsights` (NO array `.min`) | ⚠️ | empty array is schema-legal — softer than other blocks; IS in EVIDENCE_PACK_ROW_TYPES. |
| Cell: competitor name / messaging | Competitor | `competitors[].name / verbatimHeroCopy` | ✅ | per-competitor REQUIRED sourceUrl; heroCopy grounded-but-unverified-verbatim. |
| Cell: positioning | Competitor | `oneLinePositioning` | ⚠️ | model paraphrase. |
| Cell: ad platforms + **est spend** | Competitor | `adPresence.signals[].platforms / estSpend` | 🔴 | platforms enum + sourceUrl ✅; **estSpend is a pure model ESTIMATE** — row sourceUrl lends false confidence. |
| Cell: ICP / niche | Competitor/BuyerICP | (no dedicated field) | ❌ | **No competitor-attributed ICP in any schema** — plan writer fabricates (37505: 3/6 Slide-10 cells have no upstream home). |
| Cell: angles tested | Competitor | `narrativeArcs.arcs[]` / adEvidence | ⚠️ | villain/hero/transformationClaim synthesis over a sourceUrl. |
| Cell: offer / guarantee | Competitor | `pricingReality.dataPoints[]` | ✅ | diversity-gated + reporter-attribution; no-fabricated-pricing enforced. Coarse fallback `pricingPosition` ⚠️. |

### Page 10 — Funnel Ideation  *(Supplier: Offer + BuyerICP + brief)*
| Template cell | Source | Schema field | Status | Notes |
|---|---|---|---|---|
| Funnel paths (1–3) | Offer/BuyerICP | `funnelIdeation` (`.min(1).max(3)`) | 🔴 | `.min(1)` FORCES ≥1; **NOT in EVIDENCE_PACK_ROW_TYPES** → no anchor-check at all. |
| Rank | template | `rank` | 🔴 | static '1 - PRIMARY' — reads confident even when fully synthesized. |
| Name / description / whatItProves | Offer | `funnelIdeation.*` | 🔴 | all `.min(1)`, model-authored, no provenance. Offer funnelDiagnosis.breaks have sourceUrl ✅ but that grounding does NOT flow into this cell. |

### Page 11 — Sales Process (4 SOP docs + Loom)  *(Supplier: TEAM-ASSET — pipeline can NEVER produce from research)*
| Template cell | Source | Schema field | Status | Notes |
|---|---|---|---|---|
| Asset rows (1–4) | team-asset | `salesProcess` (`.min(1).max(4)`) | 🧩 | `.min(1)` forced BUT normalizeSalesProcessAssets emits ONE HONEST gap object when none supplied — does NOT fabricate. |
| Asset labels (Sales Process Overview, SDR Opt-In, Personalization, Loom) | team-asset | `label/assetType/url/note` | 🧩 | Captured by **Media Plan Setup** (`salesProcessDocs`, `salesLoomUrl`) — attach via brief, not generated. |

### Page 12 — Channel & Current-Funnel Suggestions  *(Supplier: Offer + brief)*
| Template cell | Source | Schema field | Status | Notes |
|---|---|---|---|---|
| Channel cards (1–6) | Offer | `channelSuggestions` (`.min(1).max(6)`) | ⚠️ | `.min(1)` forces ≥1; IS in EVIDENCE_PACK_ROW_TYPES (added after obs 37694). |
| Channel name | template | `channel` | 🔴 | static positional 'Website'/'Content / Organic'/etc. |
| Recommendation | Offer | `recommendation` | 🔴 | `.min(1)` w/ alias key-drift recovery, fallback gap (d838ed4e shipped 100%-placeholder). Offer channelTruth.channels have sourceUrl ✅ at source. |
| Verdict (FIX/REWORK/KEEP) | Offer | `verdict` (.catch('REVIEW')) | ✅ | enum-snapped honest. |
| **Client's own ads/website/SEO audit** | brief | — (G2/G3) | ❌ | Never audited as a schema object — relies on Offer channelTruth + brief free-text. |

### Page 13 — KPIs & Success Metrics  *(Supplier: brief + template)*
| Template cell | Source | Schema field | Status | Notes |
|---|---|---|---|---|
| KPI rows (2–5) | template/brief | `kpis` (`.min(2).max(5)`) | 🔴 | `.min(2)` FORCES ≥2; **NOT in EVIDENCE_PACK_ROW_TYPES**. static positional. |
| metric / role / definition | template | `kpiSchema.*` | 🔴 | all `.min(1)`, fallback 'Evidence gap...'. |

### Cross-cutting — Projected Results table ⚠️ *(the most load-bearing numbers. Code-computed from onboarding CPC/CVR + brief targets + budget)*
| Template cell | Source | Schema field | Status | Notes |
|---|---|---|---|---|
| Projection rows | synthesis | `projectedResults` (`.min(1)`) | 🔴 | `.min(1)` FORCES ≥1; synthesizeProjectedResultsFromPhases backfills 1 row/budgeted phase; **NOT in EVIDENCE_PACK_ROW_TYPES** — zero row-level grounding on headline numbers (obs 37694). |
| targetIcp column | synthesis | `targetIcp` | 🔴 | synthesized rows hardcode 'See audience types (slots 01-03)' — static pointer. |
| **Projected count ±20%** | code | `projectedCountValue / marginOfErrorPercent / countBasis` | ⚠️→🔴 | floor(budget/kpiCost) or floor(budget/CPC)×CVR; provenance 'derived'; **CPC table HARDCODED** (linkedin 10/google 4/meta 1.5, DEFAULT 2.5), ±20% is SOP constant. HONEST: count OMITTED when kpiCost unknown. |
| KPI cost | onboarding | `kpiCostValue / kpiCostProvenance` | ⚠️ | substitutes brief targetCac as GOAL ref; NEVER back-solves count from it ✅. |
| CPC / clicks / blended CVR | onboarding/code | `cpcValue / projectedClicks / blendedCvrPercent` | 🔴 | CPC from hardcoded STATED_DEFAULT_CPC table labeled 'derived'; CVR from onboarding cvrChain. |
| Implied / customer CAC + band | code | `impliedCacValue / customerCacBandLow/High` | ⚠️ | forward-chain, provenance 'derived'; trial→paid undisclosed surfaces a SENSITIVITY BAND (DEFAULT 10–25%) labeled 'confirm with client' ✅. |

### Cross-cutting — Feasibility Audit (optional)  *(Supplier: Demand keyword volume)*
| `feasibilityAudit` (`.optional()`) | Demand | — | ⚠️ | **The ONE block absent rather than fabricated** when no measured volume ✅. BUT passed through RAW/unnormalized — model-authored volumes + CPC/CTR/CVR ranges survive with only shape validation. |

### Cross-cutting — Cross-Section Insight (strategic intro)  *(Supplier: all 6)*
| `crossSectionInsight` (`.min(1)`; sourceSections `.min(2)`) | all 6 | — | 🔴 | `.min(1)` FORCES ≥1; NOT in EVIDENCE_PACK_ROW_TYPES. When no insight cites ≥2 sections the normalizer **force-appends 'gtmBrief' as a synthetic 2nd leg** — manufactures two-source attribution. |

### Section envelope
| Title/verdict/statusSummary/confidence | synthesis | `*` | 🔴 | `.min(1)` forced, confidence self-reported, no per-claim evidence. |
| Sources list | borrowed | `sources` (`.min(1)`) | ⚠️ | Plan does ZERO fresh research; backfills up to 12 sources from research INPUT — borrowed upstream citations, url-validated. |

---

## Template needs with NO schema home (additions required)

1. **Page 9 — Competitor-Marketing ICP/niche cell (per competitor).** No schema field attributes an ICP to a specific competitor (BuyerICP produces the *audited company's* ICP, not the competitor's). claude-mem 37505: 3 of 6 Slide-10 cells have no upstream home → plan writer fabricates competitor ICP/angles/offer.
2. **Page 8 — guaranteed 3 competitor-review complaint rows.** Template wants EXACTLY 3 but `competitorReviewInsights` has no `.length`/`.min` (count is prompt-only) and upstream `publicWeaknesses` floor is ≥1. On thin runs rows 2–3 are plan-writer fabrication.
3. **Page 12 — client's own ads/website/SEO audit as a structured object (Gaps G2/G3).** The most client-specific "current funnel audit" page has the weakest structured backing — relies on Offer `channelTruth` (about acquisition channels generally) + brief free-text.
4. **Page 9 — competitor ad platforms + estimated spend (Gap G1).** `estSpend` is a required string but a pure model estimate riding the row's `sourceUrl` for false confidence; no spend-measurement tool exists.

## Schema richness the template does NOT consume (candidate dead-weight or future rows)

- `buyerICPBodySchema.awarenessDistribution` (Eugene Schwartz ladder + budget-allocation %) — candidate future "funnel-stage audience split" row.
- `buyerICPBodySchema.buyingContext.triggers[]` + `demandIntentBodySchema.intentSignals.items[]` — in-market triggers + third-party intent → candidate "intent/retargeting audience" row.
- `buyerICPBodySchema.clusters.venues[]` + `demandIntent.venueMap.venues[]` + `contentGaps` — named off-platform venues → a sponsorship/community/"Other Ad Platforms" line item.
- `marketCategoryBodySchema.bottomUpTam` + `marketSize.signals[]` — sizing produced but no cell consumes it (only feeds the evidence pack as a backing source).
- `demandIntent.orderedMoves` / `provesWrongIf`, `offer.singleBindingConstraint` / `orderedMoves`, all sections' `strategicInsight` — rich strategist output, dead-weight *for the media plan specifically*.

## Ranked gaps

| # | Cell | Source | Status | Root cause | Fix | Pri |
|---|---|---|---|---|---|---|
| 1 | Audience Types — ABM ICP list + interest-stack | BuyerICP | ⚠️ can silently ship empty | b0d12b45 rollup-padding: corpus `counts_toward_rollup=true` → rollup fires while BuyerICP absent → commits empty → Paid Media synthesizes with 0 buyers. Persona floor never reaches `validateBuyerICPMinimums` on rollup path. | Readiness barrier (allow-list rollup, not count-of-6); make audience evidencePack a HARD gate (status:gap blocks projected-results synth); carry persona sourceUrls THROUGH the PaidMedia boundary (fix 38101). | **P0** |
| 2 | Projected Results — count ±20% + customer CAC | code (onboarding CPC/CVR + hardcoded) | 🔴 fabrication-risk on defaults, NO evidencePack | `projectedResults` NOT in `EVIDENCE_PACK_ROW_TYPES` — the most load-bearing numbers get zero row-level grounding (obs 37694). Rides hardcoded `STATED_DEFAULT_CPC` (meta 1.5/google 4/linkedin 10/default 2.5) + cvrChain; ±20% is an SOP constant. | (a) add `projectedResults` to the evidence pack so each number carries a derivation trace, AND (b) surface CPC source per row ("default 2.5, not measured") + suppress ±20% precision when CPC is a default. | **P0** |
| 3 | Competitor Reviews (3 complaints) + Competitor-Marketing ICP cell | Competitor/VoC | ❌ missing guaranteed rows + ❌ no competitor ICP field | Schema enforces neither; 3/6 Slide-10 cells have no upstream home (37505) → fabricates rows 2–3 + competitor ICP. | Render N≤3 honestly (preferred) OR add competitor-attributed ICP field + raise `publicWeaknesses` floor to ≥3 with blockGap escape. | P1 |
| 4 | Competitor estSpend + client-own-channel audit | Competitor/Offer + brief | 🔴 model-estimate / ❌ unstructured | No tool measures competitor spend; no schema captures client's own ads/site/SEO as an audited object (G1/G2/G3). | Mark estSpend "estimated, not measured"; add a structured `currentFunnelAudit` object or scope cell to "directional". | P1 |
| 5 | All `.min(N)`-forced rows w/ static positional defaults | synthesis seam | 🔴 manufactures-confident | 10 array blocks force rows; only 6 carry evidencePack. `funnelIdeation`/`kpis`/`projectedResults`/`crossSectionInsight`/`campaignPhases` inject confident defaults ("1 - PRIMARY", "MQLs / Signups", synthetic gtmBrief 2nd leg). | Extend evidencePack/gap-marker to the 4 unpacked synthesized blocks so the reader sees status:gap, not a confident placeholder. **This is the buyer-eval gate shape.** | P1 |
| 6 | Page 7 objection rebuttal / USP hook copy | VoC `objections.howToHandle` + Market USP | 🔴 synthesized advice, no source | `howToHandle` is required `.min(1)` synthesized advice with no sourceUrl; Market USP is uncited synthesis. | Bind each filled-framework hook to the VoC quote / Offer proofPoint sourceUrl it executes; mark sourceless rebuttals "strategist suggestion". | P2 |
| 7 | Page 1/2 platform field | onboarding `distributionChannels` | 👤 mis-default risk | `campaignOverview.platform` hard-defaults to "Meta Ads" (paid-media-plan.ts:753); `distributionChannels` threaded as channelHint, not into this field → non-Meta client ships Meta-branded plan. | Wire `distributionChannels` directly into `platform` (single-writer); platform-neutral fallback. | P2 |

## Open decisions (the grilling agenda)

1. **Fixed row count vs honest-N rendering** (the buyer-eval gate shape). Rec: **Hybrid** — TEMPLATED spine may pad with boilerplate; every SYNTHESIZED cell renders honest-N with a visible gap marker, never padded to a template count.
2. **Per-competitor vs aggregate Page 9 + the 3 unhomed cells (ICP/angles/offer).** Rec: **Option 3 short-term** (label "directional — derived from our own ICP/market read, not the competitor's disclosed data") → Option 1 (add competitor-attributed fields) only if the deck genuinely needs them.
3. **How projected-results numbers disclose hardcoded defaults.** Rec: **Options 1 AND 2** — add to evidence pack + surface CPC-source per row and drop false ±20% precision on defaults.
4. **Where team-asset cells get content** (Page 5 counts, Page 11 Sales docs + Loom). Rec: **Option 1** — Media Plan Setup *already* captures `salesProcessDocs`/`salesLoomUrl`; enforce capture, keep the honest gap-row fallback (which already does NOT fabricate). Creative counts stay code-owned SOP constants (already single-writer — correct).
5. **Should the pipeline COMMIT Paid Media when upstream (BuyerICP/VoC) is empty?** Rec: **Option 2 (degrade-and-flag)** — always produce the TEMPLATED spine + a deck-level "synthesized over an empty BuyerICP/VoC" banner with every synthesized cell gapped; the buyer-eval gate FAILS any run where a synthesized cell ships confident content while its supplier is empty.
