# AIGOS — Seven-Section Honest-Ceiling Build Plan

> **Executor:** Codex. **HQ:** Claude (this plan is the spec; the diff comes back for review).
> **Branch:** `refactor/architecture-deepening` @ `0b45a432`.
> **Frozen corpus:** `/Users/ammar/Dev-Projects/AI-GOS/tmp/grill/ramp-post-p0/deepResearchProgram.json`
> **Committed deck:** `/Users/ammar/Dev-Projects/AI-GOS/tmp/zz-full-run/harness-ramp-2e3adf77/`
> **Harness:** `/Users/ammar/Dev-Projects/AI-GOS/scripts/zz-full-run-harness.ts` (~$1/paid run, one at a time, NO loops).

---

## 1. Executive Summary

### Current state — 2 of 7 sections carry real value

Against the frozen Ramp corpus, the live deck is **6/7 committed-with-bodies + 1 hard-failed**, and the overall gate is **BLOCKED** (2 PaidMedia `audienceTypes[0]` `token-not-in-ledger-quote` violations). So it is not a clean 7/7 — even the 6 committed sections do not pass the deterministic liar-catcher as-is.

Verified per-section reads (offline value-read against the actual artifacts, not self-reported confidence):

| Section | Score | One-line verdict |
|---|---|---|
| **Offer Diagnostic** | 8 | Reference implementation. Refuses to fake the diagnosis. Loses 9 on the all-`unknown` `channelTruth` table. |
| **Demand & Intent** | 7.5 | One excellent tool-measured block (19 SpyFu rows) + three honest gaps. Visually penalized by a `0.4` section confidence. |
| **Buyer & ICP** | 5.5 | Structurally complete + honest but reads as a hedged low-confidence draft, not a usable ICP. |
| **Paid Media Plan** | 5 | Best-in-class strategy, provenance-hollow: 15/16 enumerated rows bind to nothing. |
| **Market & Category** | 3 | Content is a 6; defeatist self-framing (`conf` hard-pinned `0.3`, "treat as unproven") drags it to 3. |
| **Voice of Customer** | 2 | 12 real extracts laundered into apology by two stacked kill-switches; `retrievalSummary` claims "1 domain" while quotes span 4. |
| **Competitor Landscape** | 0 | Gate-FAILED, no body. Bare competitor homepages in `competitor.url` harvested as load-bearing URL claims; armed gate (MAX_UNSUPPORTED=0) can't trace them → hard-fail. |

### QA / verification state — GREEN baseline

- **tsc:** fully clean. `npx tsc --noEmit` emits **0** `error TS` lines total (0 even before the allowed openrouter/chat-blueprint filter).
- **Scoped tests:** `run-lab-section/__tests__/route.test.ts` (16) + `run-section-corpus-only.test.ts` (28) → **44/44 green**, ~1.77s. Logged stderr (provider-preflight-failed, starved-VoC auto-rescue, budget-cascade-repair) are expected in-test diagnostics.
- **Tree:** clean on tracked files. Only untracked scratch/docs remain.
- Full ~2754-test suite NOT run in the gate (runs separately) — but is the **commit gate** for every section below.

### The honest target — each section at its data-supported ceiling, ZERO laundering

This is **NOT a blind 9 everywhere.** Several sections are verifier-capped below 9 by irreducible data limits, and we ship them at their honest ceiling rather than laundering a number. Stated honestly per the adversarial verdicts:

| Section | Honest ceiling | Why not 9 |
|---|---|---|
| Demand & Intent | **9** | Decision-first headline + 19 tool-measured rows + strongest non-obvious read. Achievable. |
| Offer Diagnostic | **8** | Per-channel CAC is structurally unacquirable from public sources (operator-only). No schema fills it. |
| Paid Media Plan | **8** | Capped THIS run by the Competitor upstream failure → competitor insights must render as honest amber gaps, not bound rows. |
| Market & Category | **8** | Generic-shelf keyword volumes are live-tool-fragile (not in frozen corpus); 9 unsupported rows must be cleaned first. |
| Voice of Customer | **8** | `decisionCriteria` genuinely unacquirable from public reviews; per-review permalinks absent → directional tier caps below "fully verified". |
| Competitor Landscape | **8** | Negative-space SOV insight is corpus-snapshot-thin; complaint breadth is 2 Brex G2 quotes. |
| Buyer & ICP | **7.5** | `containmentPassRate 0`, `claimSupportShare 0.45`, `honestEmptyCore true`, conf-cap 0.4. Reordering lifts the read but the verifier containment over-strictness is out-of-scope for this plan. |

**Governing principle (from `feedback_value_not_evals`):** an honest 8 with amber-labeled gaps beats a laundered 9. Every number must trace to a real ledger row or an honest operator-input flag. The bar is the offline Claude **value-read** (Section 5), not a scrubbable scorer.

---

## 2. Build Order

Weakest-but-most-fixable first; the section whose fix unblocks the most downstream value goes early; PaidMedia LAST because it consumes the others. **One paid harness run at a time (~$1), no loops, abort condition mandatory.**

| # | Section | Start score → ceiling | Why this slot |
|---|---|---|---|
| **0** | **Cross-cutting Phase 1** | — | Zero-risk keystone. Adaptive-envelope + confidence-semantics split. Done before any rescope so every section inherits the display/provenance scaffolding. |
| **1** | **Competitor Landscape** | 0 → 8 | Biggest delta, and it's a **gate-vs-field-contract collision, not data scarcity** — a surgical claim-extractor fix. Unblocks PaidMedia's competitor rows. Do first. |
| **2** | **Voice of Customer** | 2 → 8 | Pure framing + floor-relaxation. Data already acquired (12 extracts, 4 objections). Two kill-switches to demote to badges. Unblocks PaidMedia's VoC re-attribution. |
| **3** | **Market & Category** | 3 → 8 | Self-presentation fix + one real-evidence floor reconcile ($13B valuation → 2nd trajectory signal). Content already a 6. |
| **4** | **Buyer & ICP** | 5.5 → 7.5 | Reorder to lead with triggers/boundary + floor relaxation. Honest ceiling 7.5 (verifier containment out-of-scope). |
| **5** | **Offer Diagnostic** | 8 → 8 (with honest-8 reframe) | Already strong. The `channelTruth` upgrade must use the REAL Demand intent mix, not the overclaimed "zero non-branded demand" thesis. |
| **6** | **Demand & Intent** | 7.5 → 9 | Display + provenance + skill reframe; commits cleanly today. The clean 9 of the deck. |
| **7** | **Paid Media Plan** | 5 → 8 | LAST. Consumes Demand (binder fix), VoC (re-attribution), Competitor (honest gap). Can only score once upstreams land. |

**Rationale for "Competitor first despite score 0":** its failure is a one-line gate contract bug that also starves PaidMedia. Fixing it returns the most value per edit and removes a hard blocker. Demand (the easy 9) is deferred to #6 so its binder/intent data is final before PaidMedia (#7) consumes it.

---

## 3. Cross-Cutting Phase 1 — the zero-risk keystone

Done ONCE, before any section rescope. Two pieces, both ~80% already built.

### 3a. Adaptive-envelope schema adoption

`src/lib/lab-engine/artifacts/schemas/strategic-insight.ts` and `src/lib/lab-engine/agents/verification/downgrade-coverage.ts` already carry the `evidenceTier` / `coverage` / `blockGap` envelope used per-block. Phase 1 makes that envelope the **shared, deterministically-backfilled** vocabulary every section renders against:

- **Tier backfill is code, never model-authored.** Reuse the BuyerICP §4.7 pilot reconciler pattern: rows whose `sourceUrl` is a third-party listicle → `tier=reported`; own-domain/subject rows → `tier=primary`; model-derived → `inferred`. The model never writes a tier.
- **`blockGap` escape is honored uniformly.** Every per-block floor below carries a `hasBlockGap` escape so an honest gap commits the section instead of hard-failing it.
- **No required field is added anywhere in Phase 1.** Every new field follows the existing `.nullable().transform(v=>v??undefined).optional()` pattern already in these files (TS strict, no `any`). `.strict()` objects accept new known-optional keys; frozen artifacts re-parse unchanged.

### 3b. Confidence-semantics split: `groundingConfidence` (internal) vs `valueReadiness` (reader-facing)

The single highest-leverage display fix in the deck. Today a fully-grounded block (Demand `keywordDemand`, `claimSupportShare=1.0`, `readiness='rich'`) is headlined with a `0.4` section-level `computedTrust` and reads as "40% confident" — which **undersells the one block that is excellent**. Market is pinned to `0.3` and writes a defeatist "treat as unproven" verdict over a 6-grade body.

The split:

- **`groundingConfidence`** — the internal gate signal: `claimSupportShare`, `livenessPassRate`, `unsupportedCount`. Drives the deterministic liar-catcher. NEVER the headline number.
- **`valueReadiness`** — reader-facing, derived from per-block `coverage.readiness` (`rich` / `adequate` / `gap`). Surfaced as per-block badges so a fully-grounded block is not visually punished by honest sibling gaps.

This is a **display rule, not a commit rule.** It changes nothing about what commits. It is the keystone because every section's "honest self-presentation" fix in Sections 4.x depends on it: VoC, Market, and BuyerICP all lose points primarily to apologetic framing that the split removes.

**Phase 1 verification:** tsc clean; frozen artifacts re-parse against the widened schemas; renderer shows per-block readiness badges; no section's commit/gate behavior changes. Run the full suite before committing Phase 1.

---

## 4. Per-Section Build Spec

Each spec folds in the adversarial verifier's corrections. Where the original plan overclaimed the data, the corrected, defensible framing is the spec.

> **[PHASE 0 EMPIRICAL CORRECTIONS — supersede the readiness-verdict's P5 alarms, each ground-truthed against the committed `harness-ramp-2e3adf77` deck + `tmp/grill/ramp-fresh` corpus on 2026-06-21]**
> - **§4.1 exclusion key — CORRECTED:** the claim-extractor key is `body.competitorSet.competitors.url`, NOT `...competitors.N.url` (the walker is index-less; a `[N]` segment never fires). Fixed inline in §4.1. The deck-ledger gate's `dereferenceLocator` is a separate convention that DOES need `[N]` — don't cross them.
> - **§4.3 "$13B fabrication trap" — FALSE ALARM, NOT a trap.** The March-2025 $13B valuation **IS** in the frozen corpus (`ramp-fresh/deepResearchProgram.json`, 4 hits) and is backed by **24 `corpus_excerpt` ledger facts** at `https://ramp.com/blog/behind-the-valuation-march-2025` (quote: "Ramp reported a valuation of $13 billion in March 2025"); the committed Market body already cites it. Promoting it into a `marketSize.signals` funding-flow row is **grounded, not fabrication.** The real (surviving) caveat: the reconciler MUST be **ledger/verifier-gated** (promote ONLY when the fact is actually present, so it stays honest on subjects that lack it) AND **located where the verifier verdict is available** (run-section / evidence-support), NOT inside the pure-Zod `market-category.ts` schema validator (which has no `EntailmentVerdict` access).
> - **§4.2 VoC counters — plan line-refs are ACCURATE** (the verdict's were not). Real kill-switch = `voice-of-customer-synthesis.ts:585` (`insufficient_independent_domains`); the schema's correct registrable counter is `:600` (`getRegistrableDomain`). Note a SECOND, secondary floor: schema `painSourceCount` (`:509-510`) keys off the **raw-hostname** helper `getSourceKey` (`:354`, strips only `www`, keeps sub-domains). Reconcile BOTH to `getRegistrableDomain` so a 3-distinct-domain pain pack (Ramp's trustpilot/g2/trustradius) never trips an apology.
> - **CROSS-CUTTING — the deterministic floor is the per-section verifier, not a new ledger gate.** A naive all-7-section deck-ledger gate FALSE-POSITIVES: Demand's 19 SpyFu `keywordDemand` rows are **0% ledger-backed** (the ledger holds no `keyword_volume` facts), so it would wrongly cap the deck's best section. The Phase-0 value-read gate (`scripts/zz-value-read.mjs`) instead reuses each section's own source-aware `verification.{verifiedCount,unsupportedCount,claims}` — see §5.

---

### 4.1 — Competitor Landscape (0 → 8) · `plan-needs-revision` · ceiling **8**

**Current read.** Gate-FAILED, only `positioningCompetitorLandscape.error.json`. Error: 8 unsupported load-bearing URL claims (`brex.com`, `airbase.com`, `bill.com`, `spendesk.com`, `navan.com`, `coupa.com`, `tipalti.com`, `ramp.com`). The model put each competitor **bare homepage** into the required `competitor.url` field; the claim-extractor harvests every `https` in the body as a load-bearing URL claim; the armed gate (MAX_UNSUPPORTED=0) can't trace a never-fetched homepage to a fetched source → hard-fail. **Gate-vs-field collision, not scarcity** — the same body committed fine in the frozen corpus run (gate at Infinity) where every competitor carried a CORRECT `sourceUrl` (`brex.com/spend-trends`, `stampli.com/blog`, `precoro.com/blog`) and only the display `url` was the homepage.

**Lead block + real evidence.**
1. **`competitorSet` with per-competitor DIFFERENTIATION** — 8 competitors, each with real `competitorType` and substantive `oneLinePositioning`, each pinned to a real fetched `sourceUrl`: Brex = "built for startups, venture-debt-friendly underwriting"; Navan = "travel + cards + expense, strongest when travel is primary"; Coupa = "enterprise procurement, powerful but complex"; Tipalti = "end-to-end AP for enterprises". Corroborated by the corpus `competitors` topic (6 rows, real URLs).
2. **`whereToAttackVsConcede` / `incumbentBlindSpot`** — attack the no-verified-ads lane + "enterprise-is-more-complex"; concede travel to Navan, mature procurement to Coupa/Concur.
3. **`adEvidence` / `shareOfVoice`** — the negative-space read: Ramp 6 verified product creatives vs NO competitor running a coherent verified campaign (Airbase = hiring posts, BILL = blank, Brex/Rho quarantined). **Prose correction:** say "no verified Expensify campaign observed," NOT "Expensify zero" — the committed `advertiserGroups` has a malformed `Expense` group (name-split bug), no Expensify-named group.

**Honest acquisition gaps.**
- `pricingReality.dataPoints` exact $/mo per competitor — **genuine gap.** Category hides list pricing; only Expensify publishes tiers. KEEP the evidenced packaging-pattern prose (interchange + SaaS sub, no per-card fee, quote-on-request); `blockGap` the exact numbers. NO fabricated dollar amounts (the frozen run already encodes "Custom-quoted; no public list price").
- `adPresence.signals` competitor spend — **genuine gap.** Ad libraries don't expose spend; no SpyFu/spend tool wired. `blockGap`; Ramp's own verified creatives still render.
- **`publicWeaknesses` — CORRECTED, NOT a blanket gap.** The verifier found the frozen grill artifact's `publicWeaknesses.items` contains **2 REAL Brex G2 complaint quotes with verified per-survey permalinks** (`g2.com/survey_responses/11384772`, `/6519853`), both in the 54 committed sources, NOT verifier-downgraded. **Commit the 2 real Brex quotes; `blockGap` ONLY the Airbase/BILL placeholders that genuinely lack permalinks.** The original "blanket blockGap, only 3 Trustpilot praise rows" read was wrong — it looked only at `corpus.intelligenceTopics.voice_of_customer` and missed the section's own live G2 fetch.

**Schema / floor / skill changes.**
- **`claim-extractor.ts` (the core fix) — SCOPE BY `fieldPath`, NOT `fieldName`.** The original plan proposed a blanket `DISPLAY_URL_FIELD_NAMES` set keyed on `fieldName==='url'` — **UNSAFE.** 7+ other sections have real citation `url` fields (`voice-of-customer.ts:303`, `offer-diagnostic.ts:162`, `paid-media-plan.ts:93`, `buyer-icp.ts:475`, `market-category.ts:264`, `demand-intent.ts:179`, `strategic-insight.ts:562`). The exclusion MUST be `fieldPath`-scoped (`body.competitorSet.competitors.url`) so only the competitor display homepage is exempted; `sourceUrl`/`evidenceUrl` stay load-bearing. **[P0-VERIFIED CORRECTION]** The key is `body.competitorSet.competitors.url` — **NOT** `...competitors.N.url`. `claim-extractor.ts`'s `walkValue` is **index-less**: it recurses into arrays with `fieldPath` UNCHANGED ("array indices elided"), so a `[N]` segment never matches and the exclusion would silently never fire. Confirmed against the live walker + `selfAuthoredLabelPaths` (whose entries `body.structuralForces.forces.name` etc. are likewise index-less over arrays). (Do NOT confuse this with the deck-ledger gate's `dereferenceLocator`, which is a DIFFERENT convention and REQUIRES the `[N]` index.) Precedent exists: `claim-extractor.ts:255` `selfAuthoredLabelPaths.has(fieldPath)` is the established field-path-exclusion template, and `:271` already has one URL-pattern `continue`. Pin with the named test.
- `competitor-landscape.ts`: additive comment that `competitor.url` is navigation, `sourceUrl` is the citation. Keep `url` as `z.string().min(1)`. Extend the §4.7 tier reconciler (listicle `sourceUrl` → `reported`, own-domain → `primary`).
- **Floor:** no numeric minimum changes (corpus run clears `competitors>=3`, `axes>=2`). The fix is the **gate contract** (display URLs exempt from load-bearing-URL claims). Ensure `pricingReality`/`publicWeaknesses`/`adPresence` honor their `hasBlockGap` escapes.
- **SKILL.md:** lead with competitor SET + differentiation, NOT ad evidence. URL-discipline iron law: bare homepage in `url` (navigation), fetched page in `sourceUrl`; never invent a homepage as a citation. Negative-space ad rule; pricing-pattern-not-numbers rule; `publicWeaknesses` requires a real complaint quote + source URL or a `blockGap`.

**Visualization.** DIFFERENTIATION MAP hero: 8 competitor cards (name, type chip, one-line why-buyers-pick-them, source-pinned citation badge) + a perceptual map (Point-Solution↔Unified-Platform × Card-Led↔Software-Led + Startup-native↔Enterprise-procurement) plotting Ramp vs the set. Attack/Concede two-column callout. Ad Reality strip: Ramp 6 verified creatives next to a labeled "No competitor runs a verified campaign" panel.

**Gap degradation.** Each block → a GapNote card, never empty/fabricated. `pricingReality` → "Pricing is gated" GapNote with the evidenced pattern + reason "category publishes no list prices" + the sourced rows. `publicWeaknesses` → renders the 2 real Brex quotes + a GapNote ONLY for the un-permalinked rivals. `adPresence` competitor signals → "Spend not observable" GapNote while subject creatives still render. Tier badge (`primary`/`reported`/`inferred`) per row.

**Honest ceiling 8.** `leadGrounded` true, `fabricationRisk` low, `additiveSafe` true. `gapsHonest` was flagged **false** ONLY because of the `publicWeaknesses` overclaim — corrected above. Frozen run committed at `conf 0.4` / `needs_review` / `honestEmptyCore true` even when green; the negative-space SOV insight is corpus-snapshot-thin and complaint breadth is 2 Brex quotes. An honest 8 with the real G2 quotes surfaced beats a laundered 9 that buries them.

**Files.**
- `/Users/ammar/Dev-Projects/AI-GOS/src/lib/lab-engine/agents/verification/claim-extractor.ts`
- `/Users/ammar/Dev-Projects/AI-GOS/src/lib/lab-engine/agents/verification/__tests__/evidence-support.test.ts`
- `/Users/ammar/Dev-Projects/AI-GOS/src/lib/lab-engine/artifacts/schemas/competitor-landscape.ts`
- `/Users/ammar/Dev-Projects/AI-GOS/src/lib/lab-engine/artifacts/schemas/__tests__/competitor-landscape.test.ts`
- `/Users/ammar/Dev-Projects/AI-GOS/src/lib/lab-engine/skills/positioning-competitor-landscape/SKILL.md`
- `/Users/ammar/Dev-Projects/AI-GOS/src/components/research-v2/section-renderers/competitor-landscape.tsx`
- `/Users/ammar/Dev-Projects/AI-GOS/src/components/research-v2/section-renderers/__tests__/competitor-landscape.test.tsx`

---

### 4.2 — Voice of Customer (2 → 8) · `plan-solid` · ceiling **8**

**Current read.** Scores 2 NOT because data is missing but because acquired data is **laundered into apology.** The artifact holds real verbatim pain quotes, 4 labeled objections with `sourceUrl`s (Sage Intacct sync gap, policy-copy friction, ERP non-connection, daily-limit friction), and 2 setup/switching stories. Yet `strategicVerdict` = "evidence gap…" and `retrievalSummary` = "Found 1 independent domains; need at least 3" — **FALSE on its own data.** Two stacked kill-switches: (1) `voice-of-customer-synthesis.ts:585` domain counter undercounts a multi-domain pack to 1 and dumps the run into `evidenceGap`; (2) `run-section.ts:1726` stamps ANY review-sourced pack "directional… not independently confirmed VoC" purely because snippets lack a per-review permalink, overwriting `verdict` + all four forces + `strategicInsight` + every block prose with "evidence gap:" boilerplate.

**Lead block + real evidence — with the verifier's count correction.**
1. **`painLanguage` — 6 quotes across 3 distinct domains** (trustpilot, g2, trustradius). **CORRECTION:** the plan's "12 quotes across 4 domains" is the cross-block SUM (pain 6 + objections 4 + switching 2; capterra only appears in switching). De-conflate before building: `painLanguage = 6/3`, total-extracts = `12/4`. The lead-with-`painLanguage` framing is still valid (6/3 is a real lead). Lead with the 3 strongest: onboarding/success-manager friction, global/bank-link gaps, ERP non-connection.
2. **`objections` — the 4 labeled, sourced objections as a battle card** (objectionText + category + frequency + how-to-handle an AE/copywriter lifts Monday morning). Strongest fully-acquired block; the current `howToHandle` is boilerplate ("Probe this directional signal…") and must become real answers.
3. **`fourForcesVerdict`** — JTBD Push/Pull/Anxiety/Habit grounded in the quotes, replacing the "evidence gap" boilerplate. **Badge as derived inference, not verbatim VoC** — "Ramp pain lives at the EDGES of its ICP" is the planner's synthesis layered on the quotes; grounded and supportable, but must render as a derived read, not buyer-stated language.

**Honest acquisition gaps.**
- `decisionCriteria` — **genuine gap.** No "we chose Ramp because X" quotes; reviews express pain/praise, not decision logic. Lives in win/loss calls and buyer interviews. `blockGap` with a concrete sourcingPlan (win/loss calls, G2 what-made-you-choose). Never fabricate.
- `switchingStories` displacement — the 2 committed stories are setup-friction quotes wrapped in **invented `priorSolution` scaffolding** (`run-section.ts:2052` emits "Current workflow evidenced by a directional capterra.com extract"). **Drop the synthetic scaffolding; relabel the block "setup-and-adoption friction"** (which IS in the data) using the real `reasonToLeave` quote.
- `successLanguage` — currently empty (`foundCount 0`). The plan tiers it "directional (carvable)" on the theory the after-state pool was suppressed by the same domain bug. **Treat as a MAYBE, not a guaranteed carve** — re-run the offline harness post-fix to confirm it populates before promising it in the deck.

**Schema / floor / skill changes (all additive, no required field).**
- `voice-of-customer-floors.ts`: keep `VOC_MIN_DOMAINS=3` as the QUALITY tier; the fix is in the COUNTER, not the constant. Optionally add `VOC_DIRECTIONAL_MIN_QUOTES = 6` so the directional-vs-verified line is an explicit named tier.
- `voice-of-customer.ts`: add optional block-level `confidenceTier z.enum(['verified','directional'])` on `painLanguage`/`objections` so the renderer badges a block directional WITHOUT overwriting strategic prose; add optional `permalinkResolved z.boolean()` per row so "has a permalink" is a per-row badge, not a section kill-switch.
- **Floor change (the heart of the fix):** (a) **fix the domain counter** to count distinct registrable domains of the PROMOTED quotes via `getRegistrableDomain` (the schema validator at `:600` already counts correctly; only the synthesis ledger path miscounts) so a genuine multi-domain pack commits as a real VoC section. (b) **demote the permalink rule** from a section-wide `evidenceGap` trigger to a per-row/per-block `confidenceTier` directional BADGE — quotes/objections/four-forces still render; the section just carries an honest review-sourced tier label. Keep the existing guards armed (`checkVoiceOfCustomerSelfSourcing` subject-domain exclusion `:608`, single-source-majority `:627`).
- **SKILL.md:** Iron Law — NEVER write "evidence gap:" into `strategicVerdict`/`nonObviousRead`/any fourForces field when `painLanguage.quotes >= VOC_MIN_QUOTES`; a directional tier means the QUOTES are review-sourced, not that the INSIGHT is absent. Objection BATTLE CARD reframe (category + frequency + lift-verbatim how-to-handle). Switching-story honesty (label setup-and-adoption friction; drop invented `priorSolution`). Final Check: does the section LEAD with the strongest buyer language or with an apology?

**Visualization.** Two-zone VoC card. ZONE 1 Pain-and-Objection Battle Card: ranked pain pills (theme + intensity + verbatim blockquote + clickable domain `sourceUrl` chip) → Objection table (Objection / Category / Frequency / How to Handle), each row a small "directional · review-sourced" tier badge where permalink is unresolved. ZONE 2 JTBD Four-Forces 2×2 with grounded one-liners + balance-verdict strip.

**Gap degradation — per-BLOCK, never whole-section.** `decisionCriteria` → compact muted/dashed GapNote with the real sourcingPlan. `switchingStories` → setup-and-adoption-friction sub-card using the real `reasonToLeave` quote. A directional tier on `painLanguage` → a small amber "directional · review-sourced" badge on the card header; the quotes and objections STILL render full-strength.

**Honest ceiling 8.** `leadGrounded` true, `fabricationRisk` low, `additiveSafe` true, `gapsHonest` true. A true 9 needs `decisionCriteria` (unacquirable from reviews) and per-review permalinks (the directional badge the plan itself keeps caps below "fully verified"). An honest, well-rendered 8 — 4 battle-card objections + 6 pain quotes + grounded four-forces — beats a laundered 9.

**Files.**
- `/Users/ammar/Dev-Projects/AI-GOS/src/lib/lab-engine/agents/voice-of-customer-synthesis.ts`
- `/Users/ammar/Dev-Projects/AI-GOS/src/lib/lab-engine/agents/run-section.ts`
- `/Users/ammar/Dev-Projects/AI-GOS/src/lib/lab-engine/artifacts/schemas/voice-of-customer.ts`
- `/Users/ammar/Dev-Projects/AI-GOS/src/lib/lab-engine/artifacts/voice-of-customer-floors.ts`
- `/Users/ammar/Dev-Projects/AI-GOS/src/lib/lab-engine/skills/positioning-voice-of-customer/SKILL.md`
- `/Users/ammar/Dev-Projects/AI-GOS/src/lib/lab-engine/agents/__tests__/voice-of-customer-directional-promotion.test.ts`
- `/Users/ammar/Dev-Projects/AI-GOS/src/lib/lab-engine/artifacts/schemas/__tests__/voice-of-customer.test.ts`

---

### 4.3 — Market & Category (3 → 8) · `plan-solid` · ceiling **8**

**Current read.** The artifact is NOT thin (4 keyFindings, a non-obvious `strategicInsight`, a `categoryPowerBet`, 4 adjacent categories, structuralForces, "growing" maturity with 5 signals). It scores 3 because of **how it frames its own evidence**: `confidence` hard-pinned `0.3`, a defeatist verdict ("treat the gapped findings as unproven"), 9 of 33 verification claims unsupported, a `marketSize` `blockGap` (1 of 2 required trajectory signals), and the ONE differentiating insight (branded "ramp" 27,200/mo vs generic "spend management" 440/mo = category-weakness, not brand-strength) **buried inside `strategicInsight.nonObviousRead`** instead of leading. A skeptical operator reads "unproven" first and discounts the whole section.

**Lead block + real evidence.**
1. **Branded-vs-generic search asymmetry** — "Ramp owns its name (27,200/mo) but not its category (spend management 440/mo) — an 80x gap; growth is brand-driven, the category shelf is undefended and buy-able." The exact "branded dominance = category WEAKNESS" framing already exists in `strategicInsight.nonObviousRead`; **elevate it to lead.** **CAVEAT (verifier):** generic-shelf volumes (spend management 440, corporate cards 480, spend management software 180) are **NOT in the frozen corpus** — 0 frozen keyword rows; they exist only in the run OUTPUT from a live `keyword_volume` call that may not fire under fan-out contention. The degradation-to-branded-only path is **essential, not optional**; do NOT present the 80x gap as corpus-grounded.
2. **`categoryDefinition` consensus** — HARD-grounded: the frozen corpus `market_category` topic has 5 sources converging on the identical "spend management" frame (Exbo 90, Trustpilot 85, Contrary 88, ramp.com 95, About Us 95). "Own the existing one before Brex does."
3. **`adjacentCategories` as a paid-media interception map** — 4 shelves (corporate cards/Brex, AP automation/Tipalti, T&E/Navan, procurement/Coupa), all sourced to real listicles, each with its disambiguating signal.

**Honest acquisition gaps.**
- `bottomUpTam` reachable-revenue dollar figure — **permanent gap.** `acv` null, `companySize` null, no analyst TAM in corpus. Correctly "directional only — not computed." Turn it into a precise acquisition CTA, not a hole.
- **Second trajectory signal — AUTHORING MISS, not unacquirable.** Schema requires ≥2 `signalTypes`; the run emitted 1 (search-trend) then `blockGap`'d. The **$13B March-2025 valuation IS in the corpus** ("valuation of $13 billion in March 2025", 2 url hits), verifier-supported (`entailmentVerdict supported`), already cited in `categoryMaturity.supportingSignals`. Promote it into a `funding-flow` `signals[]` row → the block clears the ≥2 floor with REAL evidence.
- Generic-shelf keyword volumes — acquirable but **live-tool-fragile.** If absent, the branded-only signal still supports "brand-driven growth"; degrade with a labeled directional caveat, not a `blockGap`.

**Schema / floor / skill changes (all additive).**
- `market-category.ts`: optional `confidenceBasis` (explain a 0.3-vs-0.7 number); optional `categoryVerdict z.enum(['own-existing-shelf','create-new-category','defend-current-frame'])` (a typed renderable CALL); optional `tamGapPosture` narrative.
- **Floor (real-evidence reconcile, NOT bar-lowering):** `marketSize.signals` rule (`market-category.ts:652`, `marketSignalCount < 2 && !hasBlockGap`) → accept `(signals.length>=2) OR (signals.length>=1 hard_evidence search-trend AND body carries >=1 verifier-supported funding/valuation numeric)`. The reconciler promotes the already-cited, already-supported $13B valuation into a `funding-flow` signal. **Gate the reconciler on `verifier-supported` status** so it never admits fabrication. Net: `blockGap` stops firing, confidence can rise to ~0.6, verdict stops saying "unproven."
- **SKILL.md:** lead with the search-asymmetry read (not the TAM gap); Iron Law against a defeatist verdict / low-pinned confidence when only one sub-block has an honest gap; convert the directional TAM into a 2-input acquisition CTA; promote any verifier-supported valuation into `marketSize.signals`; name adjacent shelves with the exact buyer/source label ("Procurement", not "Procurement and AP suites").

**Required cleanup before the 9-attempt is even on the table (verifier).** 9 verifier-flagged unsupported rows still ship: the 4.2% derived intent share and 40% media split (model-derived, **genuinely unsupportable → DEMOTE to directional, never promote under a higher confidence**), three `sourceAttribution` forces incl. AI-layer, the "Procurement and AP suites" entity, the Wikipedia self-cite. **NOTE:** "70,000 customers" IS in the frozen corpus ("70,000 companies use its platform") — that row is **re-sourceable**, not just demotable (the verifier flag is an entailment miss).

**Visualization.** Two-panel category view. LEFT "The Shelf": branded-vs-generic bar chart (ramp 27,200 dominating; generic terms thin) + headline "Ramp owns its name, not its category — the shelf is undefended." RIGHT "The Interception Map": 4 adjacent categories as a quadrant, each cell with its disambiguating redirect signal. Top ribbon: typed `categoryVerdict` chip ("OWN EXISTING SHELF: spend management") + maturity badge ("GROWING — frame unsettled"). Tier dot per data point.

**Gap degradation.** `marketSize` TAM → dashed "acquire this" CTA tile naming the 2 missing inputs (operator ACV + analyst TAM) and what they unlock. Generic volumes absent → LEFT chart degrades to branded-only with caption "Generic-shelf volumes unavailable this run; branded-vs-branded still shows brand-driven growth" — **the lead insight survives.** Funding signal un-promotable → maturity badge keeps rendering from supported signals; a single "second trajectory signal pending" GapNote chip, never a 0.3 pin.

**Honest ceiling 8.** `leadGrounded` true, `fabricationRisk` low, `additiveSafe` true, `gapsHonest` true, `achievable9` **false**. Capped under 9 by (a) live-tool-fragile generic volumes that don't reproduce from the frozen corpus, and (b) the 9 unsupported rows that must be cleaned first. An honest 8 beats a laundered 9.

**Files.**
- `/Users/ammar/Dev-Projects/AI-GOS/src/lib/lab-engine/artifacts/schemas/market-category.ts`
- `/Users/ammar/Dev-Projects/AI-GOS/src/lib/lab-engine/skills/positioning-market-category/SKILL.md`
- `/Users/ammar/Dev-Projects/AI-GOS/src/lib/lab-engine/artifacts/schemas/__tests__/` (market-category minimum/floor tests — update for the relaxed ≥2-signal rule + new optional fields)

---

### 4.4 — Buyer & ICP (5.5 → 7.5) · `plan-needs-revision` · ceiling **7.5**

**Current read.** Structurally complete and honest but reads as a hedged low-confidence draft, not a usable ICP. `containmentPassRate 0` (all 8 URLs failed re-fetch containment), `claimSupportShare 0.45`, `honestEmptyCore true`, confidence capped `0.4`. EVERY load-bearing row (all 3 lead triggers, both personas, geography cut) carries `verification.outcome='downgraded'` — the evidence is real in the corpus; the downgrade is a containment-strictness artifact.

**Lead block + real evidence.**
1. **`buyingContext.triggers`** — the Monday-morning-actionable spine: new finance leader within 90 days; funding/headcount inflection at 50/100/200; competitor-dissatisfaction window from 9 "Ramp alternatives" pages. Corpus confirms ("fast-growing startups", 70,000 companies, $13B, "finance leaders—CFOs" from Contrary, 49 "Ramp alternatives/competitors" hits). All 3 carry `outcome='downgraded'` (uncontained re-fetch) — evidence is real; renderer must show the downgrade honestly.
2. **`icpExistenceCheck`** — the 30-second yes/no boundary: finance-function-bearing companies in technology/ecommerce/professional services; disqualify ERP/Coupa-mature enterprises, pre-revenue solos, no-card-program firms.
3. **`strategicInsight`** — the interchange-vs-savings paradox (Ramp's revenue grows with spend but its pitch is "save money") + the onboarding-detractor GTM risk (scaling paid acquisition ahead of CS capacity manufactures Trustpilot detractors on the exact review sites Ramp leans on for proof). Both fully corpus-grounded, both non-obvious.

**Honest acquisition gaps.**
- `clusters.venues` — **genuine gap.** No community/newsletter/conference/podcast/Slack names anywhere in the frozen corpus; no venue-discovery tool wired for this block. Default to LinkedIn job-title + Google keyword filters (the honest media-buyer fallback). `blockGap` with sourcingPlan.
- `icpExistenceCheck.firmographicCuts` precise employee band — **real gap.** The 10–2,000 band is an unsourced interpolation, verifier-flagged in `strippedNumericClaims` (4 entries). Keep the industry + geography cuts (grounded); `blockGap` the employee precision.

**Schema / floor / skill changes — with the verifier's FILE CORRECTION.**
- `buyer-icp.ts`: optional `icpScorecard { qualifies: string[]; disqualifies: string[]; thirtySecondTest }`; optional `painWeight z.enum(['high','medium','low'])` on `triggerSchema`; optional `verifierDowngradeNote` on `personaReality.coverage`.
- **FLOOR-CHANGE FILE MISATTRIBUTION — CORRECTED.** The plan said to relax the `2<3` self-label inside `validateBuyerICPMinimums` / `buyer-icp.ts`. That validator is **already quality-aware at `>=1` grounded persona** ("Floor 1, quality-aware (was 3)") and does NOT contain the 3-persona gate. The actual `validatorGradePersonaCount < 3` self-label that injects `evidenceGap` and drives the hedged 0.4 read lives in **`run-section.ts` (~line 7442, `injectPersonaGap`)** and the `requiredNamedPersonaCount=3` floor in **`buyer-icp-acquisition-ledger.ts:268` (`BUYER_ICP_PROMOTED_PERSONA_FLOOR`)**. The relaxation (a verifier-downgraded grounded persona counts toward `sufficiency.tier='partial'` and does NOT force `evidenceGap=true` when ≥1 hard-grounded `segmentLabel` persona exists) is pure (removes a gap-injection branch, adds no hard-fail) — but it must edit **`run-section.ts` + `buyer-icp-acquisition-ledger.ts`**, which the original `filesToEdit` omitted. Add both.
- **`icpScorecard` authoring guard (verifier).** The `thirtySecondTest` must NOT restate the "10-2000 ppl" band the verifier stripped, or it re-launders the exact number. SKILL.md must **explicitly forbid the employee-band numeric in the scorecard** (keep industry + geography + function only), not just "cite corpus."
- **SKILL.md:** reframe the job from "prove 3 grounded personas" to "hand a 30-second yes/no ICP boundary + a ranked set of buying triggers." Promote triggers to Move 1; weight by pain; tie each to a detection signal (job posts, funding announcements, "[competitor] alternative" search volume). Author `icpScorecard.thirtySecondTest` (function + industry + geography, NO employee numeric). Keep a verifier-downgraded live champion as a `directional_signal` persona WITH a `verifierDowngradeNote` instead of letting it read as unreliable.

**Visualization.** Two-column "ICP Boundary Card" (green Qualifies checklist / red Disqualifies checklist, each sourced). Horizontal "Buying-Trigger Timeline" ranked by pain-weight (chip + detection signal + window immediate/weeks/quarters). Personas as small grounded-evidence chips, each tier-badged (`hard_evidence` solid / `directional_signal` outlined + "verified live, re-fetch partial" tooltip).

**Gap degradation.** `clusters.venues` → labeled GapNote ("Reachable communities — not yet acquired… Default targeting: LinkedIn job-title + Google keywords… Sourcing plan: CFO-community Slack search, FP&A conference search"). Firmographic precision → inline `blockGap` chip on the `firmographicCuts` table ("precise floor/ceiling unverified — industry+geography grounded, employee band is a directional read"). A downgraded persona → outlined chip with the `verifierDowngradeNote`, never silently disappearing.

**Honest ceiling 7.5 (NOT 9).** `leadGrounded` true, `fabricationRisk` low, `additiveSafe` true, `gapsHonest` true, `achievable9` **false**. 9 is not reachable from this artifact: `containmentPassRate 0`, `honestEmptyCore true`, conf-cap 0.4, every load-bearing row downgraded. The verifier containment over-strictness is **explicitly out-of-scope** for this plan; without that upstream fix the section reads honest-but-thin after reordering. The interchange-paradox + onboarding-detractor reads are real and lift the read to a defensible 7.5. An honest 7.5 beats a laundered 9.

**Files.**
- `/Users/ammar/Dev-Projects/AI-GOS/src/lib/lab-engine/artifacts/schemas/buyer-icp.ts`
- `/Users/ammar/Dev-Projects/AI-GOS/src/lib/lab-engine/agents/run-section.ts` *(injectPersonaGap ~L7442 — added per verifier)*
- `/Users/ammar/Dev-Projects/AI-GOS/src/lib/lab-engine/agents/buyer-icp-acquisition-ledger.ts` *(BUYER_ICP_PROMOTED_PERSONA_FLOOR:268 — added per verifier)*
- `/Users/ammar/Dev-Projects/AI-GOS/src/lib/lab-engine/skills/positioning-buyer-icp/SKILL.md`
- `/Users/ammar/Dev-Projects/AI-GOS/src/lib/lab-engine/artifacts/schemas/__tests__`
- `/Users/ammar/Dev-Projects/AI-GOS/src/lib/lab-engine/agents/verification/grounded-buyer-unit.ts`

---

### 4.5 — Offer Diagnostic (8 → honest 8) · `plan-needs-revision` · ceiling **8**

**Current read.** The reference implementation: all five count-block floors met with real rows, 0 `blockGap` escapes, `confidence 0.947`, 18/18 claims verified, 0 unsupported. Names ONE binding constraint (trial-to-paid via onboarding) grounded in a real verbatim Trustpilot quote ("the onboarding is terrible… success manager… could only meet with us twice"), exposes interchange-revenue-masks-churn, labels every operator economic (`4200` CAC, `3000` target, `18000` LTV, `25K/mo` split) as `user_asserted`. Loses the 9 in one place a media buyer notices instantly: `channelTruth` is a pure gap — 3 channels all `hasWorked='unknown'`, sourced only to `ramp.com`, zero performance data.

**Lead block + real evidence.** `singleBindingConstraint` = trial-to-paid via onboarding; `provesWrongIf` = {trial-to-paid conversion, above 20%, most recent two quarters}; `funnelDiagnosis.breaks`; `redFlags.items` (4, all `strategic_inference`, incl. the 3.2x claim flagged amber). The binding-constraint quote is corpus-real (grep confirms "onboarding is terrible" ×2 + "could only meet with us twice" ×2).

**Honest acquisition gaps.**
- Per-channel CPL / lead-to-trial / trial-to-paid / CAC-by-channel — **structurally unacquirable from public sources** (operator ad-platform exports only). Keep as `acquisitionGap` with reason `operator_input_required`. **NEVER fabricate per-channel CAC.** No schema change fills this.
- Measured retention / churn / NRR — no public source for a private company; operator-input or third-party benchmark only. Honest thin block.
- Independent ROI studies / named case studies — not in this frozen corpus (`caseStudiesUrl` null); honest gap. The proof architecture being nearly all company-owned IS the insight.

**THE CORRECTION THAT GOVERNS THIS SECTION (verifier — do not skip).** The original 8→9 thesis asserted "every category/problem-aware term returns ZERO SpyFu volume" and paid-search demand is "~99% BRANDED" and "demand-CREATION is the only lever." **This is FALSE and contradicts the pipeline's own Demand artifact**, which carries **13 commercial keywords WITH real SpyFu volume** (corporate cards 480/$8.58, spend management 440/$5.76, spend management software 180/$8.09, best business bank accounts 5,300/$19.59, best business credit card 2,800/$19.24, venmo for business 6,000, + 7 more). Non-branded commercial demand is abundant and at HIGHER CPC than branded ($1.15). Also: "ramp alternatives 32/mo COMMERCIAL difficulty 34" is a **factual mislabel** — the row is `intentType NAVIGATIONAL`. **Shipping the "zero non-branded / creation-is-the-only-lever" framing as the lead slide would be a fabrication.**

**The TRUE, defensible read (the honest-8 reframe).** Single branded term "ramp" at 27,200/mo dwarfs any single non-branded term, and branded CPC ($1.15) is far cheaper than commercial CPCs ($5.76–$19.59), so a chunk of the 60% Google spend likely chases branded demand organic already owns top-3. That is an honest 8-grade insight. The SKILL.md directive MUST force the model to read the **real intent mix** (4 navigational / 13 commercial / 2 informational), or it will launder the same overclaim.

**Schema / floor / skill changes (all additive).**
- `offer-diagnostic.ts`: optional `demandSignal { keyword, monthlyVolume, cpc, intentType, brandedShare }` on `channelEvidenceSchema` (lets a channel row carry a real Demand SpyFu fact); optional `benchmark { stageLabel, typicalRange, excellentRange, sourceUrl }` on `funnelBreakSchema` (cite the published B2B SaaS conversion band so `provesWrongIf 20%` is contextualized, not asserted). Both `.strict()`-safe: a `.nullable().optional()` field inside a strict object is additive (strict only rejects UNKNOWN keys; the frozen artifact still validates).
- **Floor (clarification, admits MORE honest bodies):** a `channelTruth` row is COMPLETE when it carries EITHER (a) an operator/sourced performance metric, OR (b) a Demand-derived `demandSignal` (real SpyFu volume/CPC/intent), OR (c) an explicit `coverage.acquisitionGap` with reason `operator_input_required`. Keep `channels>=3`. Per-channel CAC is NEVER a commit-floor data point (structurally unacquirable); the BRANDED-DEMAND read becomes the required substance. The cross-section wire precedent (`demandIntentEvidenceGapArtifact`, `run-section.ts:4551/8889+/11750+`) is the known pattern — not new infra.
- **SKILL.md (rewritten to the honest read):** Move 4 Channel truth — when Demand rows are supplied as Prepared evidence, USE the **real intent mix** to characterize each channel's demand reality; state that branded CPC is cheaper than commercial and a chunk of Google spend likely intercepts branded demand organic already owns — **do NOT assert non-branded demand is zero.** Iron Law: distinguish DEMAND evidence (publicly acquirable: volume, CPC, intent mix, branded share) from PERFORMANCE evidence (operator-only: CAC, CPL, conversion by channel); mark per-channel CAC `operator_input_required`, never invent it. Move 3 Funnel diagnosis — attach the published B2B SaaS stage benchmark to each break. Final Check — did `channelTruth` say something a media buyer can act on Monday, or just mark everything unknown?

**Visualization.** BINDING-CONSTRAINT HERO + FUNNEL-LEAK STRIP. Top: a bold card naming the one binding constraint with the verbatim Trustpilot quote as a blockquote + the falsifier as a chip. Below: a horizontal funnel strip (Visit → Trial → Activation → Paid), each break a node colored by `evidenceTier` with its benchmark band as a faint range bar behind the node. Right rail: a `channelTruth` demand-vs-performance split panel — each channel shows operator budget % on the left and the real Demand-derived read on the right (branded vs commercial mix, CPC), with a "PERFORMANCE = operator-input" badge where per-channel CAC would go. Bottom: ordered-moves DAG (move 4 hangs off move 1). Proof points / red flags as a two-column real / unsubstantiated table (3.2x flagged amber).

**Gap degradation.** `channelTruth` with no `demandSignal` AND no operator data → a single GapNote ("Channel performance is operator-only; no public source for per-channel CAC. Supply ad-platform exports… Branded-demand context unavailable: Demand keyword rows not supplied to this run"). `funnelBreak.benchmark` absent → the range bar hides (no fabricated band). A proof point without a source → renders in the unsubstantiated column.

**Honest ceiling 8.** `leadGrounded` true, `fabricationRisk` **medium** (the overclaim risk above — neutralized by the reframe), `additiveSafe` true, `gapsHonest` true, `achievable9` **false**. Mechanics (schema additivity, gap honesty, wire pattern, lead grounding) are SOLID; the single real defect was the 9/10 PROSE THESIS overclaiming the SpyFu data. With the honest reframe (branded single-term dominance + branded-CPC-cheaper-than-commercial), the section is a strong 8. Per-channel CAC remains an irreducible operator-only gap no schema change fills.

**Files.**
- `/Users/ammar/Dev-Projects/AI-GOS/src/lib/lab-engine/artifacts/schemas/offer-diagnostic.ts`
- `/Users/ammar/Dev-Projects/AI-GOS/src/lib/lab-engine/skills/positioning-offer-diagnostic/SKILL.md`
- `/Users/ammar/Dev-Projects/AI-GOS/src/lib/lab-engine/agents/run-section.ts`
- `/Users/ammar/Dev-Projects/AI-GOS/src/lib/lab-engine/artifacts/schemas/__tests__/offer-diagnostic.test.ts`

---

### 4.6 — Demand & Intent (7.5 → 9) · `plan-solid` · ceiling **9** (the clean 9 of the deck)

**Current read.** Genuinely strong on ONE block, honestly empty on three. `keywordDemand` carries 19 hard-evidence SpyFu rows with real volume/CPC/difficulty/intent (every plan-named keyword verified to exist with matching numbers). `strategicInsight` is best-in-class: the capture-vs-creation call, the branded-to-non-branded ratio (27,200 vs ~1,100), and the non-obvious "venmo for business = competing against a mental model not a competitor" read. Three blocks (`questionMining`, `intentSignals`, `venueMap`) are HONEST gaps (`foundCount 0`, clean `blockGap`s, sourcing plans) — proven real against the corpus (demand_intent topic = 1 homepage row; recent_events empty; zero PAA/Reddit/Quora/funding/venue data). Scores 7.5 for two reasons: (1) the section-level `confidence 0.4` (computedTrust override) + `needs_review=true` make a fully-grounded `claimSupportShare=1.0` block visually read as "40% confident"; (2) the `$3,000 CAC` / `$25K/mo budget` are harness-brief, not corpus (correctly labeled but the only economics anchoring the math).

**Lead block + real evidence.**
1. **`keywordDemand`** — lead with the branded-vs-non-branded split + the two named clusters. Category-capture: spend management 440/$5.76, corporate cards 480/$8.58, spend management software 180/$8.09. Demand-creation: best business bank accounts 5,300/$19.59, best business credit card 2,800/$19.24, venmo for business 6,000, best banks 11,900. Branded numerator: ramp 27,200/navigational/$1.15.
2. **`strategicInsight`** — the capture-vs-creation verdict + the "venmo for business = mental-model competitor" read.
3. **`orderedMoves`** — capture-first-then-create with dependencies + a `provesWrongIf` kill-criterion.

**MINOR precision fix (verifier).** Do not group `ramp` 27,200 alongside the CPC-bearing CATEGORY terms — ramp's `cpcValue` is 1.15 and `intentType=navigational` (branded/destination, NOT category demand). It is the branded NUMERATOR of the 27,200:~1,100 ratio. Imprecise grouping, not invented data — fix the grouping in the lead prose and chart.

**Honest acquisition gaps (all proven real).** `questionMining` (0 PAA/Reddit/Quora rows), `intentSignals` (recent_events empty; no job-board/funding/RFP data; Ramp's own valuation independence-gate-blocked), `venueMap` (no venue/community/newsletter/event rows; audience sizes can't be invented — named targets AFP/CFO Leadership Council/CFO Brew WITHOUT fabricated counts). `SERP top3RankingDomains` (tool returned empty) — inline chip, not a block gap.

**Schema / floor / skill changes (display + provenance + reframe — NO gate loosening).**
- `demand-intent.ts`: optional `economicsProvenance z.enum(['tool-measured','operator-brief','model-estimated'])` on `keywordSignalSchema` (badge each row's number source — 19/19 are tool-measured). Expose the EXISTING per-block `coverage.readiness` to the renderer (prefer this over a new `displayConfidence` field). Optional `operatorEconomics { targetCac, monthlyBudget, googleAllocation, provenance:'operator-brief' }` on the body so the conversion-math claims are STRUCTURALLY tagged, not just prose-tagged.
- **No commit-floor change.** Every block already has a `blockGap` escape; `keywordDemand >=5` satisfied by 19. The only "floor-shaped" change is the **display rule from Phase 1**: stop letting `computedTrust 0.4` be the headline when the lead block is `readiness='rich'` with `claimSupportShare=1.0`.
- **`decode-fallbacks.ts` enum inventory (verifier caveat):** adding `economicsProvenance` + updating `demand-intent.test.tsx` fixtures MUST happen in the same change or the structural verifier/contract test breaks. (Note: `decode-fallbacks.ts:48` references `demandVenues.venues` but the live schema uses `venueMap.venues` — a pre-existing path-drift, unrelated to this plan; do not "fix" it here.)
- **SKILL.md:** reframe from "map five demand surfaces" to "deliver the capture-vs-creation CALL first, then evidence it." Iron Law: when anchoring conversion math on operator CAC/budget, populate `body.operatorEconomics` (`provenance=operator-brief`) AND state "operator-reported" in the same prose sentence AND cite at least one tool-measured SpyFu CPC in the conversion sentence. Demand-creation guidance: name the mental model you displace (codify the venmo-for-business win). Lead-with-readiness: open keyFindings/verdict on the `rich`/`adequate` block, never a gap surface.

**Visualization.** Two-cluster keyword demand map hero: a grouped bar/dot chart splitting the 19 keywords into (A) Category-capture and (B) Demand-creation, dual-encoded by `monthlyVolume` (length) and `cpc` (color heat $5.76→$19.59), with a vertical divider labeling the ~1,100/mo capturable pie vs the 15,000+/mo creation surface. Tier dot + SpyFu source chip per row. Decision banner above: "Capture the small pie, create the big one" + the 27,200:~1,100 ratio. Extend the existing `KeywordVolumeChart`.

**Gap degradation.** `questionMining`/`intentSignals`/`venueMap` each → the existing GapNote primitive (`demand-intent.tsx:347-440`): `blockGap.summary` + a "How to close" list from `sourcingPlan`, NOT a red error and NOT five carpet-bombed retry panels (`isDemandIntentHonestlyUnavailable` guards the all-empty case). Per-subsection readiness badge (`rich` green / `adequate` amber / `gap` grey) so the reader sees ONE surface fully evidenced and three honestly pending — a credible roadmap, not a hole. `SERP top3RankingDomains` → inline "organic position not yet checked" chip on the keyword table.

**Honest ceiling 9.** `leadGrounded` true, `fabricationRisk` low, `additiveSafe` true, `gapsHonest` true, `achievable9` **true**. The work is display + provenance + skill reframe, NOT gate loosening — the section commits cleanly today. A decision-first headline backed by 19 tool-measured rows with the strongest non-obvious read in the deck + three honestly-costed gap blocks. Durable risk (Phase-5 acquisition concern, not a flaw here): 9 leans on ONE acquired block, so a future thin-keyword subject collapses — handled by the niche sweep (Section 6).

**Files.**
- `/Users/ammar/Dev-Projects/AI-GOS/src/lib/lab-engine/artifacts/schemas/demand-intent.ts`
- `/Users/ammar/Dev-Projects/AI-GOS/src/components/research-v2/section-renderers/demand-intent.tsx`
- `/Users/ammar/Dev-Projects/AI-GOS/src/components/research-v2/section-renderers/__tests__/demand-intent.test.tsx`
- `/Users/ammar/Dev-Projects/AI-GOS/src/lib/lab-engine/skills/positioning-demand-intent/SKILL.md`
- `/Users/ammar/Dev-Projects/AI-GOS/src/components/research-v2/primitives/gap-note.tsx`

---

### 4.7 — Paid Media Plan (5 → 8) · `plan-solid` · ceiling **8** · BUILD LAST

**Current read.** Provenance-hollow despite best-in-class strategy. **15 of 16 ENUMERATED rows** have `evidencePack status=gap` with empty refs (1 grounded = the BuyerICP LinkedIn firmographic audience). **COUNT CORRECTION (verifier):** the plan said "19 of 20" — actual is 15/16; `crossSectionInsight` is a separate unbound LIST, not a 20th row with an `evidencePack`. Rows cite real upstream numbers ($5.76/$8.58 CPC, 5,300/mo, 6,000/mo) but bind to nothing. A media buyer cannot trace an audience to the ICP or an angle to a real keyword row.

**Lead block + real evidence.**
1. **`crossSectionInsight` (the spend thesis)** — fuses Market/Demand/Offer/VoC into one tension with blind spot, second-order risk, and a contrarian inversion ("do not expand the surface, fix trial-to-paid first"). Real numbers: 27,200 vs ~1,100 (Demand), $4,200 vs $3,000 CAC (Offer). Lead with it.
2. **`audienceTypes`** — once the keyword binder is fixed, 3 audiences each tied to real firmographic cuts or hard_evidence SpyFu rows (volume + CPC).
3. **`anglesToTest`** — the 3 demand-creation angles tied to the real 5,300/mo and 6,000/mo rows.

**Honest acquisition gaps.**
- `competitorMarketingInsights` + the 1 competitor-sourced angle/creative row — **run-specific gap.** Competitor failed its gate this run; render competitor insights as ONE honest amber GapNote row each. Acquirable in principle (frozen corpus has a rich competitor section) but absent in THIS artifact. **NEVER launder a competitor insight off a missing section.**
- Per-row daily budget provenance — a labeling fix, not a data gap (see schema below).
- `SERP top3RankingDomains` — inherit Demand's honest note; no tool wired this run.

**Schema / floor / skill changes — with the verifier's mechanism correction.**
- **`paid-media-evidence-pack.ts` — THE CORE FIX (~80% of the gap).** ROOT CAUSE verified: `looksLikeNamedRecords` (`:410`) requires `entry.name` OR `entry.competitor`; keyword rows key on `keyword` (no `name`/`competitor`), so `genericArrayCandidates('positioningDemandIntent','keyword')` (`:578`) NEVER enumerates `body.keywordDemand.keywords` and all DemandIntent-cited rows fall to `status=gap`. Fix: a dedicated `demandIntentCandidates` reading `body.keywordDemand.keywords` directly, anchoring on `keyword.keyword`, locator = array index, excerpt = `keyword + monthlyVolume + cpc + intentType`; AND widen `looksLikeNamedRecords` to accept `keyword`/`term` keys. **Keep the anchor-match floor at overlap of 2** (do NOT lower; false-bind risk). Prove the Ramp rows bind with a unit fixture.
- **`run-section.ts` + SKILL.md — VoC re-attribution.** Deterministic post-processor: when a `competitorReviewInsights` row's complaint/`howWeLeverage` token-overlaps a VoC `painLanguage` quote theme, set `sourceSection=positioningVoiceOfCustomer` so the existing VoC enumerator binds it. **Gated on a real token match.** Grounded: VoC committed 12 pain quotes; `competitorReviewInsights[0]` complaint "Onboarding is terrible…" maps VERBATIM to the VoC trustpilot quote.
- **PROVENANCE FIX — MECHANISM CORRECTED (verifier).** The plan said "WIDEN the provenance enum to include `derived`" — but `derived` is **ALREADY** in `paidMediaMoneyProvenanceValues` (`schema:33`) AND the field is `z.string().min(1)` (free string, not a closed enum). **The real fix is `snapMoneyProvenanceForLabel`** stripping legit operator-derived splits to `unknown`; hard-code `dailySpendProvenance`/`dailyBudgetProvenance` to `derived` for computed daily-budget fields so the verifier stops stripping the 12,500/6,250 splits. **Do NOT waste a cycle widening an enum that already contains the value.**
- `paid-media-plan.ts`: optional section rollup `evidenceBinding { groundedRows, gapRows, bindRate, byTier }`, populated deterministically after binding. `.optional()`, additive, no new required field. (`evidencePack.status` is a closed `z.enum(['grounded','gap'])` with `.strict()`; provenance fields are open `z.string().min(1)`.)
- **Floor:** no row-count min change (floors already accept variable-length arrays per the "No filler rows" Iron Law). The fix is a CODE fix in the deterministic binder + the provenance snap, not a schema floor relaxation.
- **SKILL.md:** reframe from "cite the sourceSection name" to "bind every synthesized row to a SPECIFIC upstream ROW (locator + verbatim excerpt)." Iron Law: a row citing `positioningDemandIntent` MUST quote the exact keyword string + volume + CPC; generic section-level citation = a gap. `competitorReviewInsights` rows from buyer reviews MUST set `sourceSection=positioningVoiceOfCustomer` + quote the VoC painTheme verbatim. If Competitor did NOT commit this run, emit competitor insights as ONE honest gap row each — never assert competitor ad spend/messaging without a committed body. Daily-budget figures that are deterministic divisions of the operator monthly budget use `provenance=derived`, never `unknown`.

**Visualization.** Spend Thesis hero (`crossSectionInsight` tension + contrarian inversion as a pull-quote) → a Plan Provenance strip showing the `evidenceBinding` rollup ("14 of 18 rows traced, 9 hard, 3 directional, 2 strategic") → evidence-bound tables: Audience-by-Keyword-Evidence (each audience shows its bound SpyFu keyword + volume + CPC as a clickable spyfu.com chip), Angles-to-Test (angle → bound keyword or VoC quote), Channel Allocation bar with the restored 12,500/6,250 derived splits. Each bound cell renders an Evidence chip linking to the upstream locator + excerpt.

**Gap degradation.** Every block degrades via the EXISTING `evidenceGapCell` renderer (`paid-media-plan.tsx:391`): `status=gap` → "Unverified — {note}" as a GapNote. Extend: (1) `competitorMarketingInsights` when Competitor did not commit → ONE amber GapNote row instead of hollow rows; (2) the Plan Provenance strip → a red banner when `bindRate < 0.5`; (3) SERP-position claims → inline "organic position unconfirmed."

**Honest ceiling 8 (NOT 9 this run).** `leadGrounded` true, `fabricationRisk` low, `additiveSafe` true, `gapsHonest` true, `achievable9` true — but **capped at 8 THIS run by the Competitor upstream failure.** The "every claim traceable / 14 of 18 rows traced" 9-bar is only reachable if the binder fix flips the DemandIntent rows AND the competitor gaps are scored as honest-labeled, not as misses. With competitor insights as amber gaps and the binder fix landing the DemandIntent rows, this is an honest 8.

**Files.**
- `/Users/ammar/Dev-Projects/AI-GOS/src/lib/lab-engine/agents/paid-media-evidence-pack.ts`
- `/Users/ammar/Dev-Projects/AI-GOS/src/lib/lab-engine/artifacts/schemas/paid-media-plan.ts`
- `/Users/ammar/Dev-Projects/AI-GOS/src/lib/lab-engine/agents/run-section.ts`
- `/Users/ammar/Dev-Projects/AI-GOS/src/lib/lab-engine/skills/positioning-paid-media-plan/SKILL.md`
- `/Users/ammar/Dev-Projects/AI-GOS/src/components/research-v2/section-renderers/paid-media-plan.tsx`
- `/Users/ammar/Dev-Projects/AI-GOS/src/lib/lab-engine/agents/__tests__/paid-media-evidence-pack.test.ts`
- `/Users/ammar/Dev-Projects/AI-GOS/src/lib/lab-engine/agents/__tests__/paid-media-evidence-pack-overlap.test.ts` *(verifier: exists, 10.7KB — update in the SAME change)*

---

## 5. The Offline Value-Read Agent — the bar, not an eval

This is the **liar-catcher floor + a value judge**, NOT a scrubbable scorer. It is how we know a section hit its honest ceiling without laundering.

**What it reads.** For each section: the committed artifact JSON (`tmp/zz-full-run/<run>/positioning<Section>.json`) AND the run `ledger.json` (the `factKind` facts: corpus_excerpt / named_champion / voc_quote). It cross-checks every load-bearing claim/number/URL in the artifact against a real ledger row or an explicit honest-gap flag.

**Asymmetric laundering caps (the rule that makes "honest 8 > laundered 9" enforceable).**
- An **honest gap** (a `blockGap` with a real reason + sourcing plan, a row labeled `operator_input_required`, a directional tier badge) is **NEUTRAL** — it does not cap the score. A section that refuses to fake a block is rewarded, not penalized.
- A **laundered or fabricated claim** (a number with no ledger row, a competitor insight off a missing section, an invented `priorSolution`, a `thirtySecondTest` restating a verifier-stripped numeric, the "zero non-branded demand" overclaim) is a **HARD CAP at 4** — regardless of how good the rest of the section reads. One fabrication ceilings the whole section.

**The loop.**
1. Run the harness once (~$1, no loops, abort condition mandatory).
2. Value-read every section artifact + ledger.
3. Emit the **single weakest sentence** per section (the one a skeptical media buyer would distrust first) as the callout.
4. Fix offline against ALL frozen corpora (Section 6) — schema/floor/skill/renderer edits, no paid calls.
5. Re-run the harness ONCE to confirm. No re-run loops.

**Trust calibration (mandatory before the agent is the bar).** The value-read agent MUST reproduce the **known human read** on this Ramp deck — Offer 8, Demand 7.5, BuyerICP 5.5, PaidMedia 5, Market 3, VoC 2, Competitor 0 — before its scores are trusted to gate any other corpus. If it disagrees with the human read on Ramp, the agent is wrong, not the human; fix the agent first.

> **[BUILT — Phase 0, 2026-06-21]** Implemented as `scripts/zz-value-read.mjs` (+ `scripts/zz-value-read.gate.test.mjs`, 14 cases in `npm run test:gate`). GATHER reads `tmp/zz-full-run/<run>/` directly; the deterministic ceiling reuses each section's own source-aware `verification` verdict + `gate.json` + `.error` presence (absent→2, refuted/gate-violation→4, unsupported/unverifiable/thin/no-verifier→7, earned-clean→9); `finalScore = min(llm, ceiling)`. **CALIBRATED** to the human read (maxAbsErr 1.0, meanAbsErr 0.29, full 7/7 coverage). Calibration anchor is run-scoped (`harness-ramp-2e3adf77`); every other run is gated by an absolute `--min-score` bar (default 8). Coverage+range validation blocks the LLM from gaming the gate by dropping a section or emitting an out-of-range score.
>
> **[KNOWN BOUNDARY — what the DETERMINISTIC floor cannot see, surfaced by the Phase-0 red-team]** The floor is honest only for STRUCTURED laundering — numbers, URLs, quoted spans, named-entity fields, and deck-ledger gate violations (what the in-run verifier extracts as claims). It is BLIND to: (a) fabricated analytical PROSE that carries no number/URL/quote (never becomes a claim → `unsupportedCount` unaffected); (b) a real quote attributed to the WRONG company (the verifier's `quote`/`quoteAttribution` match is not URL-scoped); (c) an invented person who passes token-subset substring match; (d) `user_asserted` numbers self-certified by a bare "operator-supplied" prose marker. For (a)–(d) the **calibrated LLM value-read is the only net** (non-deterministic) — it demonstrably catches apology/defeatism/thinness (VoC→2, Market→3), but plausible-reading prose fabrication can still slip. Closing (b)–(d) are real fixes in `structural-verifier.ts` / `claim-extractor.ts` and belong to the section-build phases, NOT Phase 0. **Implication for autonomy:** a floor-relaxing autonomous loop is safe against structured laundering and proven gate violations, but prose-fabrication safety rests on the LLM read — keep a human spot-check on any section whose value jumped without new structured evidence.

---

## 6. Niche-Test Sweep — freeze once, regress free forever

Ramp is a big, well-covered subject. A lead-block ordering tuned to Ramp alone will overfit. Freeze one corpus per archetype ONCE (~$12–16 total) into a **free offline regression set**, then finalize lead-block ordering against the **data-shape distribution**, not Ramp alone.

**Archetypes (one frozen corpus each).**
1. **Tiny vertical SaaS** — thin keyword/review surface; tests gap-degradation honesty.
2. **Developer / API product** — docs-heavy, low review volume; tests VoC/BuyerICP under sparse buyer-voice.
3. **Mid-market horizontal** — moderate everything; the "median" shape.
4. **Sales / marketing tool** — rich ad-library + competitor ads; tests Competitor/PaidMedia binding.
5. **Big well-covered (Ramp)** — the calibration anchor (already frozen).
6. **Enterprise / security** — gated pricing, analyst-heavy; tests Market TAM-gap CTA + pricing `blockGap`.
7. **Non-SaaS control** — out-of-distribution; tests that the engine degrades honestly instead of fabricating.
8. **Adversarial near-zero** — almost no public data; tests that EVERY section degrades to honest gaps and NOTHING fabricates (the laundering hard-cap must fire correctly).

**Process.** Freeze each via the harness once. Thereafter every section change re-runs against the 8 frozen corpora at **$0**. Lead-block ordering is locked only when it holds across the distribution — e.g. Demand's "lead with keywordDemand" must NOT collapse on archetype 1 (thin keywords) without graceful degradation; VoC's "lead with painLanguage" must hold on archetype 2 (sparse reviews) via the directional badge, not an apology.

---

## 7. Risks + the Verification Gate (run after EACH section)

### Per-section verification gate — MANDATORY before any commit

Run, in order, after each section's edits:

1. **`tsc` clean** — `npx tsc --noEmit` emits 0 `error TS` lines (the baseline is fully clean; do not regress it).
2. **Route test** — `npm run test:run -- src/app/api/research-v2/run-lab-section/__tests__/route.test.ts` (dispatch/run-section changes MUST run this — `src/lib`-scoped verification misses `src/app`; this is the lesson from the Phase 0 hidden regression).
3. **Section schema tests** — the section's `artifacts/schemas/__tests__/*.test.ts` (and `section-registry.test.ts` if `allowedTools` changed — it pins each section's EXACT order-sensitive allowedTools array).
4. **Renderer tests** — the section's `section-renderers/__tests__/*.test.tsx`.
5. **Full suite green** — the full ~2754-test suite must pass before commit (the scoped gate is a fast pre-check, NOT the commit gate).

### Cross-cutting risks

- **`.strict()` additive-safety:** every new field is `.nullable().transform(v=>v??undefined).optional()`. Frozen artifacts re-parse (strict only rejects UNKNOWN keys; a new known-optional key is fine). Schema + fixtures + the `decode-fallbacks.ts` enum inventory ship in the SAME change or the structural/contract tests break.
- **Claim-extractor scoping (Competitor):** the URL exclusion MUST be `fieldPath`-scoped, never `fieldName`-scoped — 7+ sections have real citation `url` fields. Pin with the named evidence-support test.
- **BuyerICP floor file:** the relaxation edits `run-section.ts` + `buyer-icp-acquisition-ledger.ts`, NOT `buyer-icp.ts` (already quality-aware). Don't chase the wrong file.
- **PaidMedia provenance:** the fix is `snapMoneyProvenanceForLabel`, NOT widening an enum that already has `derived`.
- **Offer / Market overclaim guards:** the SKILL.md directives must force the model to read the REAL Demand intent mix (Offer) and degrade to branded-only when generic volumes don't fire (Market) — or the same overclaim re-launders.
- **Paid API discipline:** harness runs are ~$1, ONE at a time, abort condition mandatory, NO loops (paid APIs never loop without an abort condition — root project rule).
- **No reordering of the fan-out flow:** these are additive schema/floor/skill/renderer changes within the existing in-process lab engine. Do not reintroduce sequential single-section dispatch or touch the orchestrate fan-out.

### Definition of done (the whole program)

All 7 sections at their VERIFIED honest ceiling against the frozen Ramp deck — Demand 9; Offer / PaidMedia / Market / VoC / Competitor 8; BuyerICP 7.5 — with **zero laundered claims** (the value-read agent's hard-cap-at-4 never fires), the overall gate UNBLOCKED, the full suite green, and the lead-block ordering holding across the 8-archetype frozen regression set.
