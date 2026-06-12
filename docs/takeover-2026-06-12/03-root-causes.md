# Root Causes — code trace, 2026-06-12

Nine tracer agents, every mechanism verified by reading code (full findings with line cites:
`trace-full.json` in this directory). The headline: **the pipeline researches and verifies well in
places, then defeats itself at five seams.** None of these are "missing machinery" — they are wiring
choices that route internal state into the deliverable and route honesty away from the reader.

## RC-A. The trust machinery writes INTO the deliverable
- `redactUnsupportedNumericClaims` splices `[unverified]` into the persisted body string itself
  (`evidence-support.ts:704`), with a boundary check that misses `+ / –` continuations (mid-token
  splices like "500k [unverified]+ brands"), and appends an aggregate footnote pointing to a
  "section badge" that the UI deliberately no longer renders. The reader's compensating regex
  (`reader-text.ts:1`) cannot match the footnote form. Because the splice lands in the committed body,
  every downstream consumer (executive brief input, paid-media research input, share, profile)
  inherits graffiti. The metadata needed to do this right already exists (`StrippedNumericClaim`
  records exact field paths).
- `numeric-coherence.ts` strikes whole sentences on false positives: any bare 3+ digit integer is a
  "magnitude claim" (Microsoft **365**, Fortune **500**), narrative fields are excluded from the truth
  index, and verifier-**verified** claims are never added to it. The clean-commit path passes a
  *smaller* truth universe than the shortfall path (`run-section.ts:7180` omits researchInput) —
  severity inverted.
- The subject-CTA strike pasted the identical placeholder into FIVE fields of the offer section,
  amputating its best analysis (the 94%-never-convert funnel math) because the subject site showed a
  'free' CTA — a check the stripped passage didn't even contradict.
- Liveness drops empty evidence arrays but leave the dependent prose asserting the dropped numbers
  (`source-liveness.ts:514-536` installs a blockGap; nothing touches prose).

## RC-B. Gap bookkeeping is part of the client contract
- `evidenceBlockGapSchema` (foundCount/requiredCount/sourcingPlan) is embedded in nearly every body
  schema; validators *instruct* the model to file blockGaps; code writes them directly
  (`run-section.ts:1046-1195`). There is no internal/external split — body = validator contract =
  DB row = client payload.
- Code deterministically writes `evidence gap: ...` prefixes into VALUE positions (TAM inputs at
  `market-category.ts:94-117`, plus `run-section.ts:4005`, `evidence-support.ts:850-921`); the model
  is prompted to do the same for hero copy/spend fields; the reader renders them raw.
- Paid-media `normalizeChannelSuggestion` substitutes "Evidence gap: channel recommendation missing."
  for any row whose text arrived under an unexpected key, the channel list falls back to a hardcoded
  4-channel array — and `validatePaidMediaPlanMinimums` checks ONLY projectedResults, so a
  100%-placeholder channel table commits with zero repair pressure (`paid-media-plan.ts:844-865`,
  `:1059-1077`).

## RC-C. The review layer is an ungoverned second writer
- `reviewAndUpgradeSection` regenerates the entire client markdown from a 4-line stub + artifact JSON
  truncated to 24,000 chars (`agentic-section-review.ts:18`) — on a 267KB competitor artifact the real
  prices sit at char ~125k, so the model reconstructed pricing from training priors. Its output passes
  **zero** verification.
- `buildCommitPatch` then **replaces the canonical markdown column** with this invention
  (`commit-patch.ts:109-114`), which the share view renders as fallback and the chat-edit surface
  treats as the displayed artifact. Two divergent truths persist per section.
- `removedItems` honesty filtering is logically inverted (claims about never-existing text always
  pass), the review prompt pollutes itself with scaffolding the model then "removes", and these
  phantom removals feed the synthesis contradiction scan and profile insights.

## RC-D. The one number cascade is enforced nowhere, and provenance is model-asserted
- The budget reconciliation rule exists **only as prompt text** (`section-prompt-guidance.ts:140`).
  No validator does arithmetic. The proof script's deterministic cascade (monthly/30, equal split) was
  dropped during productionization.
- Money provenance is a model-asserted string; `redactPaidMediaMoneyFields` **immunizes** anything
  labeled `user-supplied` even when the claim verifier graded the number unsupported
  (`evidence-support.ts:1032-1039`) — a test pins this bug shape as desired behavior.
- `projectedResults` math exists (`floor(budget/kpiCost)`) but is starved: the prompt invites
  `kpiCostProvenance:'unknown'`, nothing bridges the brief's target CAC into `kpiCostValue`, and the
  feasibility machinery is wired only into the executive brief, not the section.
- `salesProcess` can never be filled: onboarding captures `salesProcessDocs`/`salesLoomUrl` but
  `buildOnboardingStrategicFrame` omits them, so the model never sees supplied assets.
- `creativeStrategy` counts: model free-invents; normalizer silently invents 5/3/8 when absent.

## RC-E. The reading layer is a JSON projection with success chrome
- Every heading routes through mono-uppercase `Eyebrow`/`MonoBadge` primitives carrying schema field
  names (NON-OBVIOUS READ, SECOND-ORDER IMPLICATION) — analyst console idiom.
- `DataTable` puts Tailwind `line-clamp` on the `<td>` itself, destroying `display:table-cell`; CSS
  table fixup merges adjacent cells into one anonymous cell → stacked/clipped text and the EMPTY
  SOURCE column (`data-table.tsx:148-174`). Default-rendered cells bypass `scrubReaderText`, so
  `[unverified]` prints raw in tables.
- The executive brief — the product's best content — renders through a typography flattener that
  forces all headings to 14px (`response.tsx:24-41`).
- "6/6 Done"/"Complete" derive from job lifecycle only; `verification_tier` ships in the audit-state
  payload with **zero** UI consumers (deliberate 2026-06-11 decision); `error→'Needs review'` while
  insufficient→'Complete' inverts severity.
- The paid-media renderer **drops** the highest-value fields (audienceTypes detail/grounding,
  creativeStrategy counts, feasibilityAudit) and renders the rest as operator tables in scrambled
  order. No deck/PDF/export path exists anywhere (html2pdf.js is a dead dep; the only print CSS
  targets a legacy route).
- The share page — the only client-sendable surface — has no executive brief, renders "Ask the
  client" to the client, and carries "Generated with AIGOS / Create Your Own" self-promotion.

## RC-F. Upstream quality ceilings (smaller, real)
- Corpus: "Supplemental fan-out:" is a hardcoded joiner (`deep-research-program.ts:1186-1206`);
  'in this pass' is prompt-induced with no scrub; 13/23 sources are citation padding that satisfies
  the minimum-sources check; fan-out group 2 (competitors/pricing) dies silently on a throwing parse
  (`:1850`) — which is why the corpus ships empty competitor/pricing topics.
- Onboarding: companySize has no extraction semantics (usage claims land in it); hedge sentences pass
  the non-answer filter; 21 required form fields are structurally unfillable by prefill.
- VoC: index-page URLs pass the loose permalink check; the strict per-review-permalink downgrade runs
  ONLY for the competitor section; the source enum lacks capterra/trustpilot/trustradius (model is
  instructed to write 'other'); fabricated URLs detected by the verifier (no_match) still ship.
- SpyFu: one-shot measurement (the no-retry prompt rule blocks the bulk expansion the section itself
  plans); homepage-only provenance is by design (W5 verifier bridge).
- Demand-intent intent signals have no subject-domain independence gate (VoC has one in two places).
- Source-liveness probes with a bot UA, so G2/Capterra/Trustpilot 403 honest rows into drops.
- Confidence: three divergent numbers per artifact; computedTrust only reaches the envelope when a
  shortfall object exists (`run-section.ts:2523-2536`).
- Repair never triggers: the repair threshold is coupled to the hard-fail ceiling, which defaults to
  Infinity — so a section with 18/48 unsupported claims commits on attempt one with zero grounding
  repair (`run-section.ts:2743-2762`).

## What is genuinely good (the template to copy)
The competitor-ad path is single-writer code-owned end to end: permalinks from structured APIs, the
model cannot degrade them (`withNormalizedCompetitorAdEvidence` replaces the block wholesale), a
reserved tool budget guarantees coverage, identity is code-resolved. **Where code owns the numbers and
the model owns the words, quality is high. Every defect above is a place where that ownership is
inverted.**
