# Final Section Schema — a context-engineering redesign

**Date:** 2026-06-19 · **Branch:** `refactor/architecture-deepening` · **Status:** DRAFT for approval (no code changed)
**Grounded in:** the live offline harness deck (`tmp/zz-full-run/harness-ramp-37be5efb` + `…-e5e2b9b3` + `…-da0e1794`), the 7 current section schemas, and the verifier trace. Every claim below is pulled from a real artifact.

---

## 0. The thesis in one line

**The output schema is the model's instruction set — you get the data shape you ask for.** Today's schemas ask for a live, re-verifiable URL on every load-bearing row. The data we actually acquire is mostly *not* that shape. So the model either fabricates a URL, launders a gap into a required string, or the verifier strips the row and the block blanks. **Stop shipping half-empty sections = redesign the contract so honest, tier-labelled, populated output is the only valid shape.**

### The proof it's the schema, not the data

`positioningMarketCategory`, one run, two blocks of the **same epistemic class** (analyst inference about the category):

| Block | Schema demands | Offline outcome |
|---|---|---|
| `categoryMaturity.supportingSignals` | sourceUrl **optional** | **Shipped, rich** — "Core features … are now table stakes across Brex, Airbase, BILL, Ramp." |
| `structuralForces.forces` | sourceUrl **required** + liveness re-check | **Blanked** — 2 real forces dropped `containment-mismatch`, block → boilerplate |

Same content, same model, same run. The only difference is the schema slot. That is the entire disease.

---

## 1. The type of data we are actually getting

Across all 7 sections the acquired evidence is consistently **five types**. This is the empirical foundation the schema must model.

| # | Data type | What it is | Abundance | Real example (verbatim from the deck) | Today's fate |
|---|---|---|---|---|---|
| 1 | **`strategic_inference`** | Analyst synthesis grounded in the evidence below it | **Plentiful** — and the highest-value content | *"Ramp's ICP is not a company size; it is a moment of operational pain… intercept the finance leader at the exact moment their manual processes break."* | **Survives only** in un-gated blocks (`strategicInsight`, `keyFindings` w/ `basis:assumption`). Elsewhere stripped as "uncited." |
| 2 | **`directional_signal`** | Real source, weaker provenance: review-listing pages w/o permalinks, 3rd-party listicle copy, corpus excerpts, case-study champions | **Plentiful** — the bulk of acquired evidence | VoC: 53 real review quotes rejected `insufficient_independent_domains`; Competitor `verbatimHeroCopy` from a Stampli listicle | **Mostly deleted** by binary verifier / domain floors |
| 3 | **`hard_evidence`** | Live URL + verbatim quote/number on the page | **Scarce** (~10–20% of rows) but gold | SpyFu: `best business bank accounts` 5,300/mo, $19.59 CPC; Ramp ad-library capture "Automate the busywork"; the one G2 permalinked quote | Survives — but a single re-fetch miss nukes it |
| 4 | **`operator_input`** | Numbers from the brief | **Some** | `$25k/mo` budget, `$4,200` CAC, ACV `$1k–$10k` | **Laundered** into required evidence strings, or **stripped** (Market ACV → evidence-gap) |
| 5 | **`acquisition_gap`** | Genuine voids — no tool wired | **Plentiful in specific blocks** | Demand `questionMining` (PAA/Reddit), Competitor `shareOfVoice`, Market conversion-rate/TAM inputs | Honest in **one** place (`bottomUpTam`); everywhere else **identical boilerplate to stripped data** |

**The headline:** the two most abundant types — inference and directional signal — are exactly the two the current schema has no first-class home for. So the richest data we get is the data we throw away.

---

## 2. The four structural failures (identical in all 7 sections)

1. **Every leaf field is `.min(1)` with no gap state → sentinel-stuffing.** A real gap gets crammed into a required string: `monthlyPrice: "evidence gap: no public list price found"`, `estSpend: "evidence gap… operator reports $25k/month"`, `verbatimQuote: "Paraphrased pattern (no per-review permalink): …"`. The schema forces the model to *misrepresent the shape of what it has.*

2. **No per-row evidence tier → the verifier can only delete, never downgrade.** The 4-value `basis` enum (`measured|sourced|benchmark|assumption`) **already exists** — but only on `keyFindings`. Everywhere else a tool-measured ad capture and an analyst-derived axis are validated by the identical `.min(1)` contract and stripped by the identical binary liveness gate.

3. **Hard count-floors that blank the whole block.** `personas≥3`, `clusters≥4`, `forces≥1`, `keywords≥5`… When the verifier strips rows below floor, `installBlockGapsForEmptiedBlocks` overwrites the *entire* block (prose included) with one boilerplate string and sets `requiredCount = the rows it just deleted`. (`hasBlockGap()` is presence-only, so "escaping" the floor *is* blanking.)

4. **`acquisition_gap` and stripped-data render identically.** "We never found this" and "we found it and threw it away" both produce *"Public sources for this block could not be independently verified."* The reader — and the downstream Paid Media supply map — cannot tell a real market void from a tooling failure.

**Plus the run-level amplifier** (OfferDiagnostic's exact death): the binary evidence-gate at `LAB_VERIFIER_MAX_UNSUPPORTED=0` throws away the **entire populated section** — including un-gated inference blocks — when 2 claims can't be re-grounded. `evidence-gate: 2 unsupported load-bearing claims exceed max 0` → zero artifact.

---

## 3. The context-engineering principles applied

| Principle | Why it applies here |
|---|---|
| **The schema is the prompt.** Structured output steers generation. | A schema requiring `sourceUrls: url[]` on every finding *instructs* the model "no finding without a URL" → it fabricates one or collapses to `basis:assumption` with empty sources. Give inference a tier with no URL and the good content comes out honestly. |
| **Model what you receive, not what you wish you received.** | The ideal deck (3 personas, computed TAM, ≥1 source/block) is not the distribution the tools deliver. Encode the real five-type distribution. |
| **Separate evidence from inference.** | Strategy *is* inference. Gating it as if it needed a citation is a category error — it's our most valuable output and the least protected. |
| **Verify by downgrade, not delete.** | A re-fetch that fails to re-read a real page is *absence of confirmation*, not *evidence of falsity*. The schema must hold an `unconfirmed` state so the verifier can demote instead of destroy. |
| **Completeness = honest coverage, not N rows.** | A coverage manifest ("sought X, found M at tier T, K not acquired") is a truthful done-signal; a hard count is a brittle proxy that blanks under stripping. |
| **One source of truth.** | VoC's contradiction (4 domains *and* 1 domain in one artifact) is two counters over two pools. Compute coverage once. |

---

## 4. The final schema (drafted)

A shared **envelope + primitives** in `strategic-insight.ts` (the existing shared module), adopted by all 7 sections. Builds directly on primitives that already exist: `basis` enum, `acquisitionSufficiencySchema` (already has a `sufficient|partial|insufficient` tier), `strategicInsightSchema` (already first-class), `evidenceBlockGapSchema`.

### 4.1 Evidence tier — the core new primitive

```ts
export const evidenceTierSchema = z.enum([
  "hard_evidence",       // live URL + verbatim quote/number on the page; the ONLY tier re-fetch-gated
  "directional_signal",  // real source, weaker provenance; kept + labelled, never auto-stripped
  "strategic_inference", // analyst synthesis; NO citation required; validated on reasoning
  "operator_input",      // value from the operator brief; labelled as input, never a finding
]);
export type EvidenceTier = z.infer<typeof evidenceTierSchema>;
```

### 4.2 The evidence-meta mixin (every block row gets this)

```ts
export const evidenceSourceSchema = z.object({
  url: z.string().url(),
  quote: z.string().min(1),               // verbatim supporting text
  retrievedVia: z.string().min(1),        // firecrawl | spyfu | searchapi | review-scraper | corpus | ad-library
});

// Written by the VERIFIER after authoring — never by the model.
export const rowVerificationSchema = z.object({
  reach: z.enum(["contained", "uncontained", "unreachable", "not_checked"]),
  //  contained   = re-fetch confirmed the claim on the page
  //  uncontained = re-fetch succeeded, text lacked the claim (JS-render OR genuine mismatch)
  //  unreachable = re-fetch failed/redirected/empty shell — NOT evidence of falsity
  outcome: z.enum(["verified", "downgraded", "refuted"]),
  method: z.string().min(1),
  note: z.string().optional(),
}).optional();

export const evidenceMetaSchema = z.object({
  tier: evidenceTierSchema,
  source: evidenceSourceSchema.nullable(),   // required for hard/directional; null for inference/operator
  derivedFrom: z.string().min(1).optional(), // required for strategic_inference: what it reasons from
  verification: rowVerificationSchema,
});

// Wrap any section-specific row payload. One refinement enforces tier↔source.
export function withEvidenceMeta<T extends z.ZodRawShape>(payload: z.ZodObject<T>) {
  return payload.merge(evidenceMetaSchema).superRefine((row, ctx) => {
    const needsSource = row.tier === "hard_evidence" || row.tier === "directional_signal";
    if (needsSource && row.source === null)
      ctx.addIssue({ code: "custom", message: `${row.tier} requires source {url, quote}` });
    if (row.tier === "strategic_inference" && !row.derivedFrom)
      ctx.addIssue({ code: "custom", message: "strategic_inference requires derivedFrom" });
    if (row.tier === "operator_input" && row.source !== null)
      ctx.addIssue({ code: "custom", message: "operator_input must not carry a source" });
  });
}
```

### 4.3 First-class gap + stripped states (no more identical boilerplate)

```ts
export const acquisitionGapSchema = z.object({
  whatWasSought: z.string().min(1),
  reason: z.enum(["no_tool_wired", "tool_returned_empty", "not_applicable"]),
  surfacesQueried: z.array(z.string()).default([]),
  sourcingPlan: z.array(z.string().min(1)).min(1),
});

// Verifier-written: what was removed and WHY, so the reader sees the loss.
export const strippedRowSchema = z.object({
  summary: z.string().min(1),           // what the row claimed
  originalTier: evidenceTierSchema,
  droppedReason: z.string().min(1),     // containment-mismatch | http-404 | unreachable
  sourceUrl: z.string().optional(),
});
```

### 4.4 The coverage block (replaces count-floor + blockGap)

```ts
export const blockCoverageSchema = z.object({
  byTier: z.object({
    hard_evidence: z.number().int().nonnegative(),
    directional_signal: z.number().int().nonnegative(),
    strategic_inference: z.number().int().nonnegative(),
    operator_input: z.number().int().nonnegative(),
  }),
  acquisitionGaps: z.array(acquisitionGapSchema).default([]),
  strippedByVerifier: z.array(strippedRowSchema).default([]),  // verifier-written
  readiness: z.enum(["rich", "adequate", "thin", "gap"]),      // honest self-report
});

export function coverageBlock<T extends z.ZodRawShape>(rowPayload: z.ZodObject<T>) {
  return z.object({
    prose: z.string().min(1),
    rows: z.array(withEvidenceMeta(rowPayload)),   // MAY be empty when coverage explains why
    coverage: blockCoverageSchema,
  });
}
```

> **"Complete" = `coverage` reconciles with `rows` honestly** (tiers sum to row count; gaps + stripped explain the shortfall). NOT `rows.length >= N`. A block of 3 `strategic_inference` rows is valid and complete. A block of 0 rows with `readiness:"gap"` + a real `sourcingPlan` is valid and complete.

### 4.5 The section envelope

```ts
export const coverageManifestSchema = z.object({
  atomsByTier: z.object({ /* same 4 keys, rolled up across blocks */ }),
  blocksRich: z.number().int().nonnegative(),
  blocksThinOrGap: z.number().int().nonnegative(),
  notAttempted: z.array(z.string()),     // block ids with no acquisition wired (honest)
  strippedTotal: z.number().int().nonnegative(),
});

export const finalSectionEnvelopeSchema = z.object({
  sectionTitle: z.string().min(1),
  verdict: z.string().min(1),                // derived from coverage — NEVER blanked to "evidence gap: narrative removed"
  statusSummary: z.string().min(1),
  strategicInsight: strategicInsightSchema,  // ALWAYS present, ungated — inference is first-class
  blocks: z.object({ /* section-specific coverageBlock(...) per block */ }),
  coverageManifest: coverageManifestSchema,
  confidence: z.number().min(0).max(1),      // = f(hard-evidence share). Transparent. NOT penalised for honest gaps.
  readerGuidance: z.string().min(1),         // "trust X (hard); treat Y as directional; Z not acquired"
  needs_review: z.boolean(),                 // TRUE only when acquisition-gap DOMINATES — not when inference does
});
```

### 4.6 The verifier contract change (enabled by the schema)

The schema is necessary but not sufficient — the verifier must use it:

1. **Only `hard_evidence` rows go through source-liveness containment.** `strategic_inference`, `directional_signal`, and `operator_input` are never sent through containment / provenance / numeric-coherence gates.
2. **Re-fetch through the same renderer that acquired the data** (Firecrawl / cached markdown), not plain Node `fetch`. (Root cause of the 0.2 containment pass rate.)
3. **`unreachable` → downgrade, not delete.** Redirect / empty shell / JS-wall → `outcome:"downgraded"`, tier `hard → directional`, **keep the row**, record in `coverage.strippedByVerifier`. Never rewrite the URL to `evidence-gap-N.invalid`.
4. **`uncontained` but reachable → downgrade to directional**, not refuted — unless an affirmative contradiction is found.
5. **Only an affirmative contradictory fetch → `refuted` → remove.**
6. **Run-level evidence gate counts only `refuted` `hard_evidence` rows** toward the unsupported ceiling. Never zero a section for inference or for `unreachable`.

### 4.7 Per-section block → dominant-tier mapping (derived from the offline deck)

This is what each section *actually* produces, and therefore the tier each block should declare by default:

| Section | Block | Dominant tier(s) offline |
|---|---|---|
| **Competitor** | competitorSet | directional (+ some hard) · positioningTaxonomy → inference · pricingReality → **acquisition_gap** · shareOfVoice → acquisition_gap · publicWeaknesses → directional (+scarce hard) · narrativeArcs → inference · adPresence/adEvidence → **hard** |
| **VoC** | painLanguage → hard+directional · objections/switching → directional · decisionCriteria/successLanguage → acquisition_gap · strategicInsight/fourForces → **inference** |
| **Market** | keyFindings → hard+directional · strategicInsight/categoryPowerBet/categoryMaturity → **inference** · marketSize.signals/adjacentCategories/structuralForces → directional+inference (today wrongly gated as hard) · bottomUpTam → acquisition_gap (the template) |
| **Demand** | keywordDemand → **hard** (19 rows) · strategicInsight/contentGaps → inference · questionMining/intentSignals/venueMap → **acquisition_gap** (no tool) · orderedMoves rationale → operator_input |
| **PaidMedia** | campaignOverview/phases → hard+operator · audienceTypes/angles/creative/channels → **inference** (today marked unsupported) · crossSectionInsight → inference · salesProcess → acquisition_gap · budget splits → derived (exempt from containment) |
| **BuyerICP** | strategicInsight/keyFindings → **inference** · personaReality → hard+directional (the promoted champion lives here) · buyingContext/awareness → inference+directional · firmographicCuts → directional · clusters → acquisition_gap-or-stripped |
| **Offer** | strategicInsight/orderedMoves/singleBindingConstraint → **inference** · offerMarketFit/funnelDiagnosis/channelTruth/retentionHealth → hard+directional · redFlags → inference |

The lesson the table makes obvious: **inference is the modal tier in 6 of 7 sections, and it currently has a first-class home in none of the array blocks.**

---

## 5. Migration plan (surgical, leverage-ordered, builds on existing primitives)

> Touches all 7 schema files + the verifier. Get approval before executing. Each phase is independently shippable and harness-verifiable.

**Phase 1 — Primitives (shared module, no behaviour change yet).** Add §4.1–4.5 to `strategic-insight.ts`. Pure additions; nothing consumes them. `tsc` green, no section changes. *Verify: build + existing tests pass.*

**Phase 2 — Verifier downgrade-not-delete + same-renderer re-fetch (§4.6).** The single highest-leverage change. Route the liveness re-fetch through Firecrawl/cached markdown; convert `containment-mismatch` + `unreachable` from row-drop to tier-downgrade; stop the `evidence-gap-N.invalid` rewrite. *Verify: re-run BuyerICP harness — containment pass rate up, Lauren Feeney survives as `directional`, no `.invalid` URL.*

**Phase 3 — One pilot section end-to-end: BuyerICP.** Convert its blocks to `coverageBlock(...)`, add per-row `tier`, replace the `personas≥3` floor with coverage. Prove a populated, honest BuyerICP against the harness. *Verify: harness ships ≥1 grounded persona + honest coverage, confidence reflects tier mix, no boilerplate clusters.*

**Phase 4 — Roll the pattern to the other 6.** Mechanical once the pilot is proven; each section's block→tier map is in §4.7. Fold `basis`→`tier`, drop count-floors → coverage, split gap/stripped. *Verify: full 7-section harness deck — no block blanks that holds real data; OfferDiagnostic commits (gate counts only refuted-hard).*

**Phase 5 — Wire the genuine acquisition gaps (separate track).** PAA reader, Reddit/forum miner, venue discovery, sourced conversion-rate, operator-ACV passthrough. These blocks are *honestly* empty today; this is net-new acquisition, not a schema fix. Lowest priority — the schema already makes their emptiness honest.

---

## 6. What success looks like

- Re-run `scripts/zz-full-run-harness.ts` on the new contract.
- **Expected:** every block that held real data is populated (tier-labelled), not blanked. The promoted champion ships. Inference-heavy sections (PaidMedia, BuyerICP, Market) read as confident-with-honest-tiers, not `needs_review`. `acquisition_gap` blocks (Demand question-mining, Competitor SOV) render as clearly-labelled "not acquired — here's the sourcing plan," visibly distinct from stripped data.
- **Confidence becomes a transparent function of the tier mix** (hard-evidence share), not a penalty for honesty. A thin-but-honest section reads as *low-confidence-populated*, never empty.
- The deck stops lying about the shape of what it found — which is the whole point.
