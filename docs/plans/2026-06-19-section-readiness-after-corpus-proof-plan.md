# Section Readiness After Corpus Proof — Plan & Report

- **Date:** 2026-06-19
- **Branch:** `refactor/architecture-deepening`
- **Mode:** Research & plan only. No code, schema, prompt, skill, or route edits made producing this.
- **Method:** 5 parallel read-only inspection agents (schemas / config+validators / skills / renderers / pipeline plumbing) + direct read of the corpus-backend learnings handoff (`docs/handoffs/2026-06-19-research-corpus-backend-learnings-handoff.md`). All file:line references below come from those reads on this branch.
- **Core question answered:** *After we prove the corpus engine gets real data across 2-3 SaaS businesses, are the section schemas, skills, prompt guidance, validators, and renderers ready to produce 9/10 research?*
- **Status:** Three build-gating decisions RATIFIED 2026-06-19 after an adversarial analyst+challenger panel (all verdicts "holds"). See §9. Plan-only; no code touched.

---

## TL;DR — Verdict

**Are we ready to build sections to 9/10 immediately after corpus proof? NO — but the gap is concentrated, not everywhere.**

The schemas and skills are the **most mature layer** (~7.5/10): mostly source-strict, fabrication-resistant, and 9/10-shaped. The work is in three other places:

1. **Consumption plumbing (the real blocker).** Corpus rows arrive clean with per-row `sourceUrl`, then get **flattened into a JSON blob inside one prompt string**. There is no `PreparedSectionContext`. The durable fact ledger is **write-only on the live path** — across the inspected `src/lib/` modules the only `factStore` calls are `appendFacts` (write); `getFacts()` has no caller outside its definition file and tests. The paid-media writer reasons over a **prose digest with no source URLs**. This is section-agnostic and must be fixed before any single section can hit 9/10.
2. **Commit gates are permissive.** Required-evidence class gates are mostly **shape, not value** (a competitor *name* with no domain passes; a keyword *string* with no volume passes). Every count floor is waived by a presence-only `blockGap`. The evidence-support verifier defaults to `Infinity` (never hard-fails). A thin artifact commits and gets laundered downstream.
3. **Renderer honesty is uneven.** `confidence` is never rendered (a `0.0` section looks identical to `1.0`). The richest honesty data the pipeline produces — `evidenceGapReport`, `acquisitionLedger`, rejected-candidate trail, the top-level `sources[]` list — is rendered by **no renderer**. Partial-empty sections paper over in 3 of 7; the client deck omits empty pages silently.

**Net machinery readiness ≈ 5.5/10.** Schemas/skills sub-layer ≈ 7.5; consumption/gate/renderer-honesty sub-layer ≈ 4.5. **Fixing the shared plumbing is the highest-leverage move — it lifts all seven sections at once and is exactly handoff Phases 1–5.**

### Per-section readiness at a glance

| Section | Current | Target | Status | One-line blocker |
|---|---:|---:|---|---|
| positioningCompetitorLandscape | 7 | 9 | READY_AFTER_CORPUS | Best schema + renderer; gate accepts name-without-domain, ad-evidence non-strict by default |
| positioningBuyerICP | 6 | 9 | NEEDS_PATCH | Strongest value gate, corpus-aware skill — but `segmentLabel` guidance may not reach the model, and the rejection trail is dropped (the live "found 3, shipped 0" case) |
| positioningPaidMediaPlan | 5 | 9 | NEEDS_PATCH | Consume-only (right) but writer reasons over prose-without-URLs; evidence pack is post-hoc, money rows unpacked; deck omits empty pages |
| positioningVoiceOfCustomer | 5 | 9 | NEEDS_PATCH | No strict-vs-directional schema field; class gate checks text only (no permalink, no dedup); explicit commit-anyway override |
| positioningMarketCategory | 5 | 9 | NEEDS_PATCH | Adjacent/forces/maturity rows source-optional; no status-quo-alternatives field; partial-empty papers over |
| positioningDemandIntent | 5 | 9 | NEEDS_PATCH | Bar assumes keyword economics the providers can't reliably supply; no typed comparison/alternatives query; keyword block unguarded in renderer |
| positioningOfferDiagnostic | 5 | 9 | NEEDS_PATCH | Missing offer-wedge / pricing / outcome fields; proof + red-flag sources not rendered; partial-empty papers over |

No section is `BLOCKED` (schema/skill fundamentally cannot produce useful research). No section is `READY_NOW` (every one needs the shared plumbing first). Five are `NEEDS_PATCH`; Competitor Landscape is `READY_AFTER_CORPUS` with a small gate patch.

---

## 0. How to read this report

"Readiness" here means: **given a corpus that reliably delivers the right rows, will the current schema → skill → validator → renderer machinery turn them into 9/10 output?** It is not "does the section produce 9/10 today" (it provably doesn't — the Ramp run `df18dd1f` shipped 0 BuyerICP personas, 0 VoC success language, 1 OfferDiagnostic proof point). It is "is the machinery the right shape to consume good corpus."

The single most important finding, stated once: **the machinery is honesty-instrumented but not corpus-fed.** Every layer was hardened against *fabrication* (Iron Laws, source-strict schemas, gap escapes, nav-garbage scrubbing). Almost no layer was built to *consume a pre-supplied, normalized, citation-addressable corpus*. The skills still narrate a "go fetch it yourself" workflow; the runtime quietly hands them a corpus as inlined JSON. The two layers are not aligned, and that seam is exactly where the Ramp run found real data yet shipped empty.

---

## 1. Target GTM Output Spec — the 9/10 bar (north star)

This is the "have a really good idea what our research looks like" artifact. The brief's per-section 9/10 bars are strong; the one addition this report makes is **recalibrating each bar against what the acquisition providers can provably deliver** (from the handoff's probe section). A 9/10 section is source-backed where providers can deliver, an honest instrumented gap where they can't, and **never** laundered.

**Provider reality that constrains the bar (from handoff probes):**

- **Firecrawl** delivers: customer pages, pricing pages, case-study pages (with champion names like *Sid Upadhyay*, *Bill Cox* — parser/attribution weak), source-URL proof. Cannot deliver: keyword economics, durable ad-library proof, internal metrics.
- **SearchAPI** delivers: SERP discovery, LinkedIn ad-library records (~13 active for Ramp). Cannot safely deliver alone: quote truth without scrape verification; its domain/entity guard is unsafe (returned wrong Fathom entity).
- **Reviews path (G2/Capterra)** is query-sensitive and brand-disambiguation-dependent (Ramp default query: 0 excerpts; Fathom: 8; ClickUp: 8).
- **Perplexity** delivers source leads/citations, not reliable named external buyers.
- **Apify** is credential-valid and actor-reachable but contaminated (keyword "ramp" → runway/NVIDIA/BiPAP ads) and **not on the `/research-v3` path**. Do not count it as admissible ad evidence yet.

**The recalibration that matters most:** the brief's bars for **Demand Intent** ("volumes/CPC/difficulty") and **Buyer ICP** ("named buyer examples") ask for data the providers cannot reliably supply for every subject. The honest 9/10 bar is:

- Demand Intent 9/10 = **demand formation + buyer language + SERP intent + content gaps, with numeric volume/CPC as a bonus when SpyFu/Trends return it and an honest gap when they don't** — not a populated CPC table.
- Buyer ICP 9/10 = **named champions where case-study pages expose them, source-grounded `segmentLabel` units where they don't** — not a named human in every row.

> **RATIFIED (Option A, 2026-06-19) — bound to three non-negotiables.** The recalibrated bar below is the accepted 9/10 definition, hard-bound so "recalibrate" can never become a euphemism for lowering standards: **(1)** the truth/source standard must be raised to *maximal at the gate AND verifier layers as a precondition* of shipping it — today the schemas are strict but the commit gates are shape-only with an `Infinity` verifier ceiling and presence-only `blockGap` escapes, so "stays maximal" is aspirational until §5 item 4 lands; **(2)** every unavailable data class must surface as a *visible, provable gap* (rendered `confidence` + rejection trail), reversing today's state where a `0.0` section renders identical to `1.0`; **(3)** it ships *only alongside the producer-side acquisition phases continuing* (lossy-bridge fix, VoC permalink recovery, the unsafe SearchAPI entity guard, Firecrawl champion parsing) so "honest gap" never becomes a standing excuse that lets the data layer off the hook. The distinction that settles A vs B: *not requiring a data class the providers cannot supply* (CPC numbers, a named human per row) is **different** from *lowering the source/truth standard* — the schemas already keep volume/CPC `.optional()` while hard-rejecting fabricated economics. Option B (hold the literal bar) would force sections to hard-fail on data that provably does not exist (Blocker B3) while doing nothing about the real blocker. Caveat: this is the *least* load-bearing of the three gating decisions — the blocker is consumption plumbing (B1) + shape gates (B2), not the bar.

| Section | 9/10 bar (recalibrated against provider reality) |
|---|---|
| **Market Category** | A *committed* category call (not generic category prose): where the company sits, what category buyers think they're buying, the adjacent categories they confuse it with, the market frame that creates advantage, a bottom-up TAM with sourced inputs (or honest directional), and structural-force timing. ≥1 independently-researched external figure or an explicit gap. |
| **Buyer ICP** | Real buyer behavior + buying triggers. Named champions where case studies expose them (Firecrawl), source-grounded role/segment units (`segmentLabel`) where names aren't public — each with a live `sourceUrl`. Firmographic cuts, awareness states, reachable venues. No "marketing manager" fluff; the rejection trail must be visible so an empty section is provably honest, not a silent drop. |
| **Competitor Landscape** | The strongest section. Named competitors with **domains**, direct vs status-quo vs DIY split, 2×2 perceptual axes, source-backed pricing rows, public weaknesses with permalinks, observed ad evidence (LinkedIn via SearchAPI) or an honest ad gap, attack/concede call. Strategy is built around this. |
| **Voice of Customer** | Real customer language or nothing. **Strict quotes (per-review permalink) must be schema-distinct from directional quotes (listing-page).** Pain domains, objections, switching stories, decision criteria, success language. Directional rows cannot satisfy strict floors or masquerade as strict evidence. |
| **Demand Intent** | How demand forms and what buyers search before buying: keyword rows (numeric volume/CPC when a tool returns it, honest gap when not), PAA/forum questions, SERP intent, comparison/alternatives queries, content gaps tied to weak competitor answers, independent intent signals. |
| **Offer Diagnostic** | Why the offer converts or doesn't: the single binding constraint, source-backed proof points + customer outcomes, observed funnel breaks (or labeled hypotheses), channel verdicts, retention signals, red flags, the strongest offer wedge. Does not make a weak offer look investable by filling tables. |
| **Paid Media Plan** | Built from **research-useful fact rows only** — no laundering of weak upstream prose. Competitor ad patterns, demand intent, buyer triggers, proof points, with **budget/CAC/projection assumptions cleanly separated from source-backed facts** (provenance-labeled). A complete-but-gapped upstream section cannot ground a recommendation. |

**On adding an external GTM skill (the user's steer):** the right role for a marketplace GTM skill is to *enrich this target spec* — not to be the fix. The corpus handoff is explicit: *"Do not patch prompts as the main fix."* A better skill defines the bar; the corpus contract is what's broken. **Caveat (live-proven in this repo):** never paste a third-party skill's concrete exemplar content (named companies, personas, numbers) into our SKILL.md — exemplar content leaks cross-subject even with inline "this is fictional" warnings (the reason all 7 skills had their worked exemplars deleted on 2026-06-12). Adapt the *criteria/structure*, not the *content*. Standard MCP hygiene applies: an unverified marketplace skill does not go straight into the lab engine.

---

## 2. Readiness Table

Statuses: **BLOCKED** (schema/skill cannot produce useful research even with good corpus) · **NEEDS_PATCH** (mostly usable, must change before 9/10) · **READY_AFTER_CORPUS** (structure good once corpus rows exist) · **READY_NOW** (no blocking changes).

> Note: `READY_AFTER_CORPUS` and `READY_NOW` both still presuppose the shared Phase 0 plumbing (§5 items 1–4 / B1). No section — including Competitor Landscape — can hit 9/10 until the consumption layer is rebuilt; `READY_AFTER_CORPUS` means "the section's own schema/skill structure needs no blocking change," not "needs nothing."

| Section | Cur | Tgt | Corpus data needed | Schema gaps | Skill gaps | Validator gaps | Renderer gaps | Must change before build? |
|---|--:|--:|---|---|---|---|---|---|
| **Market Category** | 5 | 9 | Category/buyer-language evidence rows; competitor-boundary proof; keyword-volume inputs for TAM; market-signal sources | Adjacent/forces/maturity `sourceUrl` **optional**; no typed **status-quo / category-alternatives** field; TAM caveats source-free | "Go-fetch" voiced; no "consume pre-supplied rows" block | Class gate = `prose` text only (shape); count floors `blockGap`-escapable; `sources≥3` is the only hard floor | No whole-section honest collapse; **partial-empty papers over** (empty signal/force grids render confident); `adjacentCategories` sliced to 4; `sources[]`/`confidence` dropped | YES (plumbing + source-tighten + alternatives field + skill consume + renderer gap-guard) |
| **Buyer ICP** | 6 | 9 | Case-study champion leads (Firecrawl), firmographic-cut sources, trigger evidence, venue URLs; segment evidence pages | `pains`/`objections` not here (live in VoC) — fine; buying-committee structure is PARTIAL | **Closest to corpus-aware** (champion-lead prepass) — but only that narrow path; generic example `segmentLabel` strings risk literal copy | **Strongest value gate** (live `sourceUrl` + grounding per persona). But `segmentLabel` guidance **may not reach the model** (build-prompts wiring gap) | **Rejection trail dropped** (`evidenceGapReport`/`acquisitionLedger`/`rejectedPersonaLabels` rendered nowhere); `isRenderableVenue` silently filters venues; partial-empty papers over | YES (plumbing + wire guidance→prompt + surface rejection trail + fix promotion gate) |
| **Competitor Landscape** | 7 | 9 | Competitor domains, pricing pages, LinkedIn ads (SearchAPI), public-weakness permalinks | `comparison queries` not here (lives in Demand) — fine; review/customer **positive** proof has no field | "Go-fetch" voiced; largest tool contract | **Class gate requires only a `name`, not a domain**; ad-evidence gate **non-strict by default** (raw samples pass); `sources≥5` waived by any `blockGap` | **Most gap-honest renderer**; advertiser-resolution `confidence`, `quarantined/returned` counts collapsed; `sources[]` dropped | YES, but smallest patch (plumbing + require domain at gate + default ad-strict) |
| **Voice of Customer** | 5 | 9 | Per-review permalinks (strict) vs listing pages (directional); pain/objection/switching/criteria/success quotes | **No strict-vs-directional tier field** (distinction enforced only upstream in synthesis); no admission-metadata on the quote row | "Go-fetch/extract" voiced; acquisition-ledger framing present | Class gate = `verbatimText` presence only (**no permalink, no dedup**); **explicit commit-anyway override** (`evidenceGap+report → ok:true` despite errors); `downgradeUnpermalinked` covers 3 of 5 blocks | Most defensive for all-empty; but `evidenceGapReport`/`acquisitionLedger`/`retrievalSummary` dropped; switching/criteria blocks unguarded | YES (plumbing + Phase-3 admission tiers in schema + permalink recovery + dedup-before-count) |
| **Demand Intent** | 5 | 9 | SERP/keyword discovery (have), volume/CPC **only when SpyFu/Trends return it**, questions, intent signals from independent venues | No typed **comparison / alternatives query**; buyer-language carried only inside question text | "Go-discover" voiced; `keyword_discovery` now wired into a prepass | Class gate = `keyword` string only (shape); provenance gate good ("not disclosed" rejected, no fabricated economics); count floors `blockGap`-escapable | **Keyword block has no empty-state gap-guard** (other 4 blocks do); `sources[]`/`confidence` dropped | YES (plumbing + recalibrate bar to provider reality + typed alternatives query + renderer keyword gap-guard) |
| **Offer Diagnostic** | 5 | 9 | Proof points + customer outcomes (case studies), pricing/friction pages, funnel/channel evidence, retention signals | **Missing**: offer-wedge/USP, pricing/friction, customer-outcome, forward-funnel ideation fields | Strong anti-overconfidence (hypotheses not findings); "go-fetch" voiced | Class gate = `channelName`/`metric` string (shape); good distinctness checks; auto-softens nearly every floor to a committed gap | **Proof-point + red-flag `sourceUrl` not rendered** (the most accusatory content has no clickable evidence); partial-empty papers over | YES (plumbing + add wedge/pricing/outcome fields + render proof sources + renderer gap-guard) |
| **Paid Media Plan** | 5 | 9 | Research-useful fact rows from all 6 sections + operator economics (budget/CAC/CVR) | Non-`.strict()` body; `demand`/`buyer-trigger`/`proof-point` only PARTIAL typed | **Only consume-only skill (right model)** — but reads upstream **prose digest, not fact rows** | `requiredEvidenceClasses = []` (no class gate); validator lean (2 substantive-row floors + budget cascade) | Analyst view = provenance leader; **deck silently omits empty pages + filters gap rows** (highest paper-over risk) | YES (plumbing + feed fact rows not prose + gate on upstream sufficiency + deck honest-gap pages) |

---

## 3. Per-section readiness detail

### 3.1 Market Category — `5/10` → 9 · NEEDS_PATCH

- **Corpus data needed:** category/buyer-language evidence rows with sources, competitor/category boundary proof, keyword-volume inputs for the bottom-up TAM, market-signal sources with dates.
- **Schema (`market-category.ts`):** Expresses category definition, adjacent categories, market forces, maturity, bottom-up TAM (typed inputs: keyword-volume/commercial-intent-share/conversion-rate/acv), and a `categoryPowerBet` wedge — all YES. **Gaps:** only `marketSizeSignalSchema` (`sourceUrl` required) and sourced TAM inputs force a URL; `adjacentCategories`, `structuralForces`, `maturitySignals` are **source-optional**. No typed **status-quo / category-alternatives** field (what buyers buy instead). `bottomUpTam.caveats` are plain strings (source-free). The TAM cross-validation (estimate within 2× of computed, or exact `"directional only — not computed"`) is genuine numeric-coherence value enforcement — keep it.
- **Skill (v3.1.0-lab):** Strong Iron Laws ("Do not ship a market call whose only numbers are echoed from the operator brief"). But fetch-voiced: assumes the model calls `keyword_volume`/`web_search`, not that rows are pre-supplied.
- **Validator:** `marketCategory_name` class gate passes on a single non-empty `categoryDefinition.prose` string — pure shape. `sources≥3` is the only non-`blockGap`-escapable floor.
- **Renderer:** No whole-section honest-unavailable collapse (unlike buyer/VoC/demand/offer). **Partial-empty papers over** — empty signal/force/maturity grids render with no GapNote, so a thin category reads as confident and complete. `adjacentCategories` sliced to first 4; top-level `sources[]` and `confidence` dropped.
- **Must change:** require sources on the load-bearing rows; add a status-quo-alternatives field; align skill to consume rows; add per-block + whole-section gap-guards to the renderer.

### 3.2 Buyer ICP — `6/10` → 9 · NEEDS_PATCH (canonical regression case)

- **Corpus data needed:** case-study champion leads (Firecrawl exposes names; parser/attribution needs work), firmographic-cut sources, trigger evidence with URLs, venue URLs, segment-evidence pages.
- **Schema (`buyer-icp.ts` + constants):** **Strongest value enforcement of any section** — `personaSchema.sourceUrl` required and http-validated; grounding via `isValidGroundedBuyerUnit` (live URL + named-human OR sourced `segmentLabel`). Firmographic cuts + venues force URLs. Rich `evidenceGapReport` with `acquisitionLedger[]` (per-row `promotionStatus`/`rejectionReason`).
- **Skill (v3.2.0-lab):** The **closest to corpus-aware** — Move 2 says "when the prepass hands you case-study champion LEADS, promote at least three as personas" (a consume-the-rows instruction). But it generalizes only to that one narrow path. Note the two generic illustrative `segmentLabel` strings ("VP of Finance at mid-market SaaS…") are strict-checked against the cited page — a model copying them literally would fail the gate.
- **Validator:** Genuine VALUE gate (mandatory per-persona live URL + grounding). This strictness is correct, and is also the documented reason real champions got dropped ("found 3, shipped 0").
- **Renderer:** Best-in-class for the **all-empty** case (one quiet honest GapNote). But **the rejection trail is dropped** — `evidenceGapReport`, `acquisitionLedger`, `rejectedPersonaLabels`, `foundNamedPersonaCount` are rendered by no renderer. So when the section drops real candidates, the reader sees the empty outcome but never the evidence that the gap is honest vs a silent failure. `isRenderableVenue` silently filters venues. Partial-empty (0 personas + 3 cuts) papers over — the thesis card still prints "Who pays" from cuts.
- **Must change:** (1) verify the `segmentLabel` guidance actually reaches the model via `build-prompts.ts` (memory flags it may not); (2) surface the rejection trail in the renderer so honest gaps are provable; (3) commit + wire the consumption plumbing. **Correction (live-rechecked 2026-06-19):** the grounded-buyer-unit promotion gate has *already* been rewritten to accept a sourced `segmentLabel` (names optional) and is wired to the live path — but the file is **untracked/uncommitted**, and the live Ramp run `df18dd1f` *still* ships 0 personas (`foundNamedPersonaCount: 1`, confidence `0.125`). So the residual blocker is **not** gate over-strictness; it is the uncommitted consumption plumbing + the guidance-not-reaching-model wiring gap + the invisible rejection trail. This is the best regression test for whether the corpus→section path works at all.

### 3.3 Competitor Landscape — `7/10` → 9 · READY_AFTER_CORPUS (smallest patch)

- **Corpus data needed:** competitor domains, pricing pages, LinkedIn ad records (SearchAPI ~13 for Ramp), public-weakness permalinks.
- **Schema (`competitor-landscape.ts`):** **Airtight** — every structured evidence row forces a `sourceUrl` (competitors require both `url` and `sourceUrl`; axes, pricing, SoV, weaknesses, narrative, ad signals all required). Richest sub-section set (8 blocks). Single-writer clamp caps "N verified" narrative claims to captured creative count.
- **Skill (v3.1.0-lab):** Good Iron Laws ("If ad tools return no live evidence, do not turn silence into 'no ads'"). Largest tool contract; fetch-voiced.
- **Validator:** **The misalignment** — `hasCompetitor` passes on a single competitor `name` with **no domain/URL required at the class gate**, and no validator anywhere requires a competitor domain. The ad-evidence gate (`hasAdEvidenceOrGap`) is **non-strict by default** — raw unverified samples or any nested gap array pass; only `LAB_AD_EVIDENCE_STRICT="true"` requires `verifiedCount>0`. `sources≥5` is waived by any `blockGap` in the body.
- **Renderer:** **Most gap-honest of the set** — per-block GapNotes for empty ads/weaknesses, diagnostics surfacing `dataGaps`/`sourceErrors` as sentences, `BasisChip` reading "gap" at `verifiedCount===0`. Drops advertiser-resolution `confidence` and the quarantined/returned-count distinction.
- **Must change (small):** require a domain at the competitor class gate; default ad-evidence to strict (or gate displayable on verified). Then this is the section that proves the corpus→section pipeline on the cleanest data.

### 3.4 Voice of Customer — `5/10` → 9 · NEEDS_PATCH

- **Corpus data needed:** per-review permalinks (strict tier) vs listing-page quotes (directional tier); pain/objection/switching/criteria/success language. Handoff Phase 3 is dedicated to this (permalink recovery, anchor indexing, admission tiers).
- **Schema (`voice-of-customer.ts`):** Every quote/row forces a `sourceUrl`; rich acquisition ledger. **Gap:** there is **no schema field distinguishing strict (`per_review_permalink`) from directional (`listing_page`) quotes** — the brief's hard requirement ("directional rows cannot masquerade as strict evidence") is enforced only upstream in synthesis, not by the row's own type. The handoff proposes a `VoiceOfCustomerAdmission` tier object — that belongs on the row.
- **Skill (v3.2.0-lab):** Strongest anti-fabrication language ("Pain quotes are LOAD-BEARING… NEVER present the subject's own marketing copy as buyer pain"). Acquisition-ledger framing ("a discovery answer is a lead, never a quote").
- **Validator:** `voc_quote_or_gap` class gate checks `verbatimText` presence only — **no `sourceUrl`, no dedup** (a duplicate quote counts toward the floor). Distinct-source (≥3) is enforced only in the persistence validator and only when quotes exist. **The clearest commit-anyway override:** `if errors>0 && evidenceGap===true && evidenceGapReport → return {ok:true, errors:[]}`. `downgradeUnpermalinkedVocQuotes` covers only 3 of 5 blocks.
- **Renderer:** Most defensive for empties; but `evidenceGapReport`/`acquisitionLedger`/`retrievalSummary` are dropped, and switching/criteria blocks have no empty-state guard.
- **Must change:** add the admission-tier field to the quote schema (strict vs directional); strict floors counted on permalink rows only; permalink recovery before listing-page admission; dedup-before-count at the class gate; extend downgrade to all 5 blocks.

### 3.5 Demand Intent — `5/10` → 9 · NEEDS_PATCH (bar recalibration)

- **Corpus data needed:** SERP/keyword discovery (providers have this), numeric volume/CPC/difficulty **only when SpyFu/Trends return it**, PAA/forum questions, intent signals from independent venues. The recalibration: do **not** make a populated CPC table the 9/10 bar — providers can't reliably supply it.
- **Schema (`demand-intent.ts`):** Expresses keywords (volume/CPC/difficulty all optional + provenance-gated), questions (with `surface`), SERP intent (`intentType` + `top3RankingDomains`), venues, content gaps. **Gap:** no typed **comparison / alternatives query** field (expressible as a commercial-intent keyword but not distinguished); buyer-language only inside question text. `contentGaps` is the one source-free row type.
- **Skill (v3.1.0-lab):** Heavy provenance honesty ("ONLY label 'SpyFu-estimated' when the tool returned data… Never write 'not disclosed'"). `keyword_discovery` is now wired into a deterministic prepass (the older "registered but not wired" note is stale).
- **Validator:** `demand_signal_or_gap` class gate = single `keyword` string (shape). Provenance gate is good ("not disclosed" hard-rejected; no model-estimated economics). Diversity quotas were deliberately removed (they "were only ever satisfied by inventing rows"). Count floors `blockGap`-escapable; `sources≥5` hard.
- **Renderer:** Strongest per-block gap handling for 4 of 5 blocks — but **`keywordDemand` has no empty-state guard**, so a no-keyword section renders an empty chart + 0-row table with no note.
- **Must change:** recalibrate the bar to provider reality; add a typed comparison/alternatives query; add the keyword-block renderer gap-guard.

### 3.6 Offer Diagnostic — `5/10` → 9 · NEEDS_PATCH

- **Corpus data needed:** proof points + customer outcomes (case studies), pricing/friction pages, funnel/channel evidence, retention signals (where public).
- **Schema (`offer-diagnostic.ts`):** Expresses proof points (`reportedBy` company-own/external + confidence), funnel breaks, channel verdicts, retention signals, red flags, `singleBindingConstraint`. **Gaps (per memory 37506):** missing offer-wedge/USP, pricing/friction, customer-outcome, and forward-funnel-ideation fields. Proof points, funnel, channels, retention force `sourceUrl`; `redFlags` are source-free (internal contradiction analysis — by design).
- **Skill (v3.1.0-lab):** Strongest anti-overconfidence language ("Causal claims must be framed as testable hypotheses unless fetched evidence supports them"; "expose the single binding constraint, not distribute blame evenly"). Smallest tool set (`web_search`, `firecrawl`, `pagespeed`).
- **Validator:** `offer_axis` class gate = single `channelName`/`metric` string (shape). Good distinctness checks. Two auto-soften paths convert nearly every count floor to a committed honest gap.
- **Renderer:** **`redFlags` and proof points render no `sourceUrl`** — the most accusatory content ("claimed X conflicts with Y") has no clickable evidence. Has an honest-unavailable collapse, but **partial-empty papers over** (0 proof points + some red flags renders confident empty grids).
- **Must change:** add offer-wedge/pricing/outcome fields; render proof + red-flag sources; add per-block gap-guards.

### 3.7 Paid Media Plan — `5/10` → 9 · NEEDS_PATCH

- **Corpus data needed:** research-useful **fact rows** from all 6 upstream sections + operator economics (budget, CAC, trials, CVR chain, creative capacity, sales assets).
- **Schema (`paid-media-plan.ts`):** The only **non-`.strict()`** body. Best money-provenance handling (every money field split into display + `*Value` + `*Provenance` enum; projected results computed deterministically, never by the model; CAC bridge with sensitivity bands). Has real schema-level `.min()` array floors (the only section that does). The deterministic `evidencePack` (built post-commit, ≥2 anchor-token overlap, verbatim excerpts) is the source-binding mechanism.
- **Skill (v3.3.0-lab):** **The only genuinely consume-only skill** — reads `committedPositioningArtifacts`, single tool (`keyword_ad_probe`). Laundering guard present ("Never launder a confident audience/angle off an insufficient or missing upstream section"). This is the template the other six should follow.
- **Plumbing (the real problem):** the writer **reasons over `buildUpstreamFindingsDigest` — a prose digest of verdicts/persona-names/pains/quotes with NO source URLs.** The strict `withPaidMediaEvidencePack` is a **post-hoc annotation applied after writing**, not a fact-pack the writer composes from — and it **excludes the budget/CAC/projected-results rows entirely**. `requiredEvidenceClasses = []`: no class gate.
- **Renderer:** Analyst view is the provenance-honesty leader (per-row "Unverified — section-level citation only" pills, provenance labels). **The client deck papers over the most** — empty pages silently omitted, gap channel recommendations filtered out, no whole-deck honest state.
- **Must change:** feed the writer fact rows (not prose) gated on upstream `sufficiency.tier`; bring money rows into a provenance discipline; make the deck render honest-gap pages instead of omitting them.

---

## 4. Cross-cutting checks (the brief's questions, answered)

- **Do schemas allow empty arrays while still sounding complete?** Yes. Every positioning section waives its count floors via a **presence-only `blockGap`** (`block.blockGap !== undefined`); the gap schema only needs a one-sentence summary with `requiredCount ≥ 1`. A section can commit "complete" with every evidence array empty as long as gaps are declared and the `sources` floor (3 or 5, itself `blockGap`-waivable in Competitor/VoC) is met. Paid Media is the exception (real `.min()` floors).
- **Do skills ask for "strategic prose" before evidence exists?** No — the opposite. All 7 skills are aggressively grounded-first with Iron Laws and gap-over-fabricate steering. The risk is not premature prose; it's that 6 of 7 narrate a "go fetch it yourself" workflow and don't tell the model a corpus is pre-supplied.
- **Do validators enforce value floors or just parse shape?** Mixed. **Class gates (`required-evidence.ts`) are mostly shape** (non-empty string) — except BuyerICP (genuine live-URL + grounding). **Persistence validators enforce more value** (per-persona URL, distinct-source counts, numeric coherence, "not disclosed" rejection) — but only on rows that exist, and every count is `blockGap`-escapable. The global evidence-support verifier defaults to `Infinity` (never hard-fails unsupported load-bearing claims).
- **Do renderers hide missing evidence?** Partially. All-empty is honest in 4 of 7 (buyer/VoC/demand/offer). **Partial-empty papers over in market/buyer/offer.** The **client deck papers over the most** (omits empty pages). **`confidence` is invisible everywhere** (a `0.0` section looks like `1.0`). The richest honesty data (`evidenceGapReport`, `acquisitionLedger`, rejection trail, top-level `sources[]`) is rendered by **no renderer**.
- **Do prompts force confident recommendations from weak data?** No, at the skill level. The laundering happens at the **plumbing** level: paid media reasons over upstream prose, and the `Infinity` verifier ceiling + `blockGap` escapes let thin artifacts commit and flow downstream.
- **Are required-evidence gates aligned with the future corpus rows?** Partially misaligned, permissively. Competitor domains: not enforced. VoC permalinks: not at the class gate. Keyword economics: gap-escapable. **BuyerICP URLs: well aligned** (the model the others should follow).
- **Can each section consume normalized corpus rows cleanly?** Data-wise yes — corpus rows are clean per-row with `sourceUrl` end-to-end (`corpus-to-research-input.ts`). **Consumption-wise no** — they're flattened into a JSON blob inside the prompt string, not handed as an addressable, citation-enforced evidence set, and the skills don't tell the model they exist.
- **Does `build-prompts.ts` need to switch from artifact prose to fact rows?** **Yes — this is the central change.** Today it serializes ResearchInput as JSON + a 48 KB tool transcript, and feeds paid media a prose digest with no URLs. It must hand sections addressable fact rows with per-row sources.
- **Does `run-section.ts` need `PreparedSectionContext` before writing?** **Yes.** No such type exists today; evidence is acquired live by a model tool-loop then transcribed. Handoff Phase 4 splits `prepareSectionContext` (deterministic acquisition/admission → typed rows) from `runSection` (skill executor over prepared rows).
- **Does paid media need a stricter upstream fact pack?** **Yes.** The deterministic `evidencePack` exists but is a post-hoc annotation excluding money rows; the writer must compose from fact rows gated on upstream sufficiency, not from prose.
- **Is the fact ledger usable?** It's **write-only on the inspected path** — in `src/lib/`, the only `factStore` calls found are `appendFacts` (`run-section.ts`); `ResearchFactStore.getFacts()` has no caller outside its definition file and tests. Facts are written as-found (good for durability) but never read back by any writer. (Executor: grep-confirm `getFacts` usages before relying on this — a wrong assumption here silently no-ops the highest-leverage plumbing item.) Wiring the read side is a prerequisite for sections consuming a ledger.

---

## 5. What must change before 9/10

Ordered by leverage. Items 1–4 are **shared plumbing** (lift all seven sections at once) and map directly to the handoff's phases. Items 5–7 are per-section.

1. **Build the coverage preflight (handoff Phase 1).** A deterministic `ResearchSectionCoverage` object answering "do we have enough raw data to generate this section?" — before any model call. CLI proof first (`scripts/zz-research-coverage-map.mjs` over the dumped bundle). This turns the core question into a testable artifact.
2. **Introduce `PreparedSectionContext` and split acquisition from writing (handoff Phase 4).** `prepareSectionContext` does deterministic acquisition/admission → typed `corpusRows`/`factRows`/`coverageRows`; `runSection` becomes a skill executor over prepared rows and stops calling arbitrary tools while writing.
3. **Switch `build-prompts.ts` from prose to addressable fact rows.** Hand sections an addressable, citation-enforced evidence set (and **wire the fact-ledger read side** — `getFacts()`). Replace the paid-media prose digest with fact rows. Align the 6 "go-fetch" skills with an `Inputs`/"consume pre-normalized rows" block like Paid Media's (criteria only — no exemplar content).
4. **Tighten the commit gates from shape to value.** Require competitor domains at the class gate; require a `sourceUrl` (not just text) where a corpus will supply one; make `blockGap` escapes require a real `foundCount`/`requiredCount` accounting that the renderer surfaces; decide a finite `LAB_VERIFIER_MAX_UNSUPPORTED` for the live path; dedup VoC quotes before counting.
5. **VoC admission tiers (handoff Phase 3).** Add the strict-vs-directional tier field to the quote schema; permalink recovery before listing-page admission; strict floors counted on permalink rows only; extend `downgradeUnpermalinkedVocQuotes` to all 5 blocks.
6. **Paid-media de-laundering (handoff Phase 5).** Writer composes from fact rows gated on upstream `sufficiency.tier`; bring money rows under provenance discipline; deck renders honest-gap pages instead of omitting them.
7. **Renderer honesty pass.** Render `confidence` as a header badge; render the top-level `sources[]` list; surface the rejection trail (`evidenceGapReport`/`acquisitionLedger`); add partial-empty per-block gap-guards to market/buyer/offer and the demand keyword block; render proof + red-flag sources in Offer.

Per-section schema additions (small): status-quo/category-alternatives field (Market); typed comparison/alternatives query (Demand); offer-wedge/pricing/outcome fields (Offer); VoC admission tier (VoC). Note the dormant Anthropic-decoder hazard: `confidence: z.number().min(0).max(1)` is on all 7 output schemas — inert under DeepSeek, but remove the `.min/.max` if the provider ever flips back to Anthropic.

---

## 6. Build Readiness Checklist

### Before Section Build
- [ ] Corpus proof complete across Ramp, Fathom, and a third SaaS
- [ ] Normalized corpus rows defined (handoff Phase 2 contracts + tables)
- [ ] Coverage report maps rows to section requirements (`ResearchSectionCoverage`, handoff Phase 1)
- [ ] Section readiness report complete (this doc)
- [ ] Schema changes identified (§5 per-section additions)
- [ ] Skill changes identified (add `Inputs`/consume-rows block to the 6 fetch-voiced skills; criteria-only, no exemplar content)
- [ ] Renderer changes identified (§5 item 7)
- [ ] Validator changes identified (§5 item 4)

### Section Build Order (recommended)

**Phase 0 — shared plumbing first (section-agnostic, blocks everything):** coverage preflight → `PreparedSectionContext` → fact-row prompt assembly + ledger read → gate tightening.

Then validate the corpus→section contract on a **validation triad** — sequential, each run to the §6 acceptance bar before the next — before committing the remainder:
- [ ] **Competitor Landscape** (cleanest data + best-positioned schema/renderer — proves the happy path)
- [ ] **Buyer ICP** (the canonical "found 3, shipped 0" regression — proves the named/segment grounding seam)
- [ ] **Voice of Customer** (with Phase-3 admission tiers — proves the *second* hard seam the pair misses: the live run had 79 acquisition-ledger rows yet shipped ~0 admitted strict quotes, the strict-vs-directional admission failure that Competitor + Buyer ICP leave untested)

Then the rest:
- [ ] Market Category
- [ ] Demand Intent (with recalibrated bar)
- [ ] Offer Diagnostic
- [ ] **Paid Media Plan last** (it consumes all six; build it once they ship fact rows)

> **Why a triad, not a pair (refined after adversarial review, 2026-06-19):** the original pair (Competitor + Buyer ICP) covers the happy path and the named/segment grounding seam, but **VoC is a distinct, equally-hard consumption-seam stressor** — the same "found a lot, admitted almost nothing" failure mode as Buyer ICP, but through the strict-vs-directional admission tier (its own handoff Phase 3, plus the explicit commit-anyway override), which the pair leaves untested. Run all three before the easier Market/Demand/Offer patches.
>
> **Alternative (the brief's order):** Competitor → Market → Buyer → VoC → Demand → Offer → Paid Media ("strongest-first single file"). The triad variant is preferred because (a) shared plumbing must precede any section regardless, and (b) proving the contract on the cleanest section plus *both* hard seams before the middle three de-risks it earliest. Paid Media stays last in both orders (it depends on the six).

### Per-Section Acceptance
- [ ] Section consumes normalized corpus rows (addressable, not a JSON blob)
- [ ] Section rejects weak/gap rows as evidence (shape→value gate)
- [ ] Section schema expresses source-backed data (every corpus-suppliable row forces a `sourceUrl`)
- [ ] Section skill asks for concrete synthesis **over** the supplied rows (consume, not re-research)
- [ ] Renderer shows source-backed insights clearly + surfaces the gap/rejection trail + renders `confidence`
- [ ] Tests prove empty/weak data does **not** become confident prose (and a partial-empty section shows per-block gaps, not confident empty grids)

---

## 7. Exact files likely to need changes

**Shared plumbing (highest leverage):**
- `src/lib/research-v2/corpus-to-research-input.ts` — normalized rows preserved (not flattened)
- `src/lib/lab-engine/agents/run-section.ts` — `PreparedSectionContext`, split `prepareSectionContext` from writer
- `src/lib/lab-engine/agents/build-prompts.ts` — fact rows not prose; replace `buildUpstreamFindingsDigest`; align skill inputs
- `src/lib/lab-engine/evidence/research-fact.ts` — wire the `getFacts()` read side
- `src/lib/research-v2/lab-section-dispatch.ts`, `lab-section-job.ts` — thread prepared context
- `src/lib/lab-engine/sections/required-evidence.ts` — shape→value gates (competitor domain; sourceUrl; dedup)
- `src/lib/lab-engine/agents/verification/evidence-support.ts` — decide finite `LAB_VERIFIER_MAX_UNSUPPORTED` for live path

**Per-section schema/skill:**
- `src/lib/lab-engine/artifacts/schemas/{market-category,demand-intent,offer-diagnostic,voice-of-customer}.ts` — §5 additions
- `src/lib/lab-engine/artifacts/schemas/paid-media-plan.ts` + `src/lib/lab-engine/agents/paid-media-evidence-pack.ts` + `src/lib/research-v2/committed-positioning-artifacts.ts` — de-launder (handoff Phase 5)
- `src/lib/lab-engine/agents/voice-of-customer-candidates.ts`, `voice-of-customer-acquisition-ledger.ts`, `agents/tools/reviews.ts`, `agents/verification/quote-admission.ts` — admission tiers (handoff Phase 3)
- `src/lib/lab-engine/skills/positioning-{market-category,competitor-landscape,buyer-icp,voice-of-customer,demand-intent,offer-diagnostic}/SKILL.md` — add `Inputs`/consume-rows block (criteria only)

**Renderers (honesty pass):**
- `src/components/research-v2/section-renderers/{market-category,buyer-icp,offer-diagnostic,demand-intent}.tsx` — partial-empty gap-guards
- `src/components/research-v2/section-renderers/{buyer-icp,voice-of-customer}.tsx` — surface rejection trail
- `src/components/research-v2/section-renderers/paid-media-plan-deck.tsx` — honest-gap pages, stop omitting
- a shared confidence/sources header primitive consumed by all renderers

---

## 8. Blockers

- **B1 — Consumption contract (hard blocker, shared).** No `PreparedSectionContext`; corpus reaches the model as a JSON blob; fact ledger write-only. No section can hit 9/10 until this is rebuilt. This is the whole reason the Ramp run found data and shipped empty.
- **B2 — Shape-only commit gates + `Infinity` verifier ceiling.** Thin artifacts commit and launder downstream. Must move to value gates before any section is trustworthy.
- **B3 — Provider can't supply parts of the brief's bar.** Keyword economics (volume/CPC) and named external buyers are not reliably available. The bar must be recalibrated to "source-backed where deliverable, honest gap where not." Treating these as required floors would make sections hard-fail on data that provably doesn't exist.
- **B4 — Paid-media laundering (depends on B1).** Until upstream sections emit fact rows and paid media consumes them (not prose), the deck launders weak upstream artifacts. Build paid media last.
- **B5 — Apify not admissible / not on `/research-v3`.** Do not count Apify ad rows as evidence until a bounded probe proves entity-safe rows survive filtering on the live app path.

---

## 9. "Are we ready to build sections after corpus proof?" — by section

**Overall: NO (machinery ≈ 5.5/10).** Ready to *start* once Phase 0 plumbing lands; not ready to hit 9/10 on the current consumption/gate/renderer layer.

| Section | Ready to build to 9/10 right after corpus proof? | Score | Status |
|---|---|--:|---|
| Competitor Landscape | Almost — needs Phase 0 + a small gate patch | 7 | READY_AFTER_CORPUS |
| Buyer ICP | No — Phase 0 + wiring + rejection-trail surfacing | 6 | NEEDS_PATCH |
| Paid Media Plan | No — Phase 0 + de-launder; build last | 5 | NEEDS_PATCH |
| Voice of Customer | No — Phase 0 + admission tiers (Phase 3) | 5 | NEEDS_PATCH |
| Market Category | No — Phase 0 + source-tighten + alternatives field | 5 | NEEDS_PATCH |
| Demand Intent | No — Phase 0 + bar recalibration | 5 | NEEDS_PATCH |
| Offer Diagnostic | No — Phase 0 + schema additions + render sources | 5 | NEEDS_PATCH |

**The one-sentence answer:** the schemas and skills are largely ready (they're honesty-instrumented and 9/10-shaped); the pipeline that feeds and gates them is not — so the highest-leverage build is the shared corpus-consumption plumbing (handoff Phases 1–5), proven first on the validation triad Competitor Landscape (cleanest) → Buyer ICP → Voice of Customer (the two hard seams), with the 9/10 bar recalibrated to what the providers can actually deliver.

---

## Premise challenge & decisions (ratified 2026-06-19)

The three open questions were pressure-tested via an independent-analyst + adversarial-challenger panel (one pair per decision). All three challenger verdicts were **holds** (not flip); the refinements below are folded in above.

- **Premise the report pushes back on:** "good corpus → 9/10 sections" is only true *after* the consumption layer is rebuilt. The corpus proof is necessary but not sufficient; the Ramp run already had a rich corpus (`deepResearchProgram`: 17 sources, 29 evidence rows) and still shipped 0 personas. Don't read corpus-proof-complete as section-build-ready.
- **Decision 1 — build order — RATIFIED (Option A + triad refinement):** plumbing-first, then a validation **triad** (Competitor → Buyer ICP → Voice of Customer, sequential) before the remaining sections; Paid Media last. The refinement over the original pair: VoC is a second hard consumption seam the pair didn't cover. See §6.
- **Decision 2 — the 9/10 bar — RATIFIED (Option A + three binds):** "source-backed where deliverable, honest instrumented gap where not, never laundered," bound to the three non-negotiables in §1 (gate-tightening as a *precondition*, visible gaps, acquisition phases continuing). Note this is the *least* load-bearing of the three decisions — both docs agree the blocker is consumption plumbing (B1) + shape gates (B2), not the bar.
- **Decision 3 — external GTM skill — RATIFIED (Option A): expected value near-zero → default skip.** The frameworks a media buyer would hope to import (buying-committee mapping, intent-tiering, channel-economics) are *already encoded* in the in-house skills (buyer-icp "who signs/blocks/influences"; demand-intent's commercial/informational/navigational/competitor-alternative taxonomy; paid-media's CAC/CVR/budget). The one real spec gap (Offer wedge/pricing/outcome) is a *schema-field* change (§5/§7), not criteria a marketplace skill supplies. If a scan is run at all, it is read-only, criteria-only, strictly after Phase 0, and defaults to skip unless it surfaces something structural absent from §1.
