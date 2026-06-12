# Implementation Strategy — smallest serious intervention (2026-06-12)

Principle (from the trace): **code owns the numbers, the model owns the words, the client surface
owns neither's bookkeeping.** Every fix below moves one inversion back to that rule. No broad cleanup;
every change traces to a bar dimension and a cited root cause.

Ordering follows the mandate: (1) make bad output impossible → (2) readability → (3) actionable media
plan → (4) agency workflow fit → (5) remove sludge → (6) premium first screen.

## W0 — Green baseline
Fix the 5 failing Wave-6 tests (run-lab-section route call-shape drift + 1 elsewhere). No behavior
changes; reconcile expectations with the new evidence-pool contract.

## W1 — Verification core stops vandalizing (files: evidence-support.ts, numeric-coherence.ts, source-liveness.ts, run-section.ts call sites)
1. **Delete the inline marker splice + aggregate footnote** (`markNumericToken`/
   `buildAggregateMarkerFootnote`). Markers live only in `verifierSummary.strippedNumericClaims`
   (exact field paths already recorded). Reader may annotate from metadata later; bodies stay clean.
2. **Numeric-coherence false positives**: mask known product-number tokens (Microsoft 365,
   Fortune 500, S&P 500, 24/7 variants); add verifier-verified claim values to the truth index;
   pass researchInput on the clean path like the shortfall path.
3. **Subject-CTA strike narrowed** to claims that actually assert a CTA/gating state; stop pasting
   the same placeholder into multiple fields — one strike, one field, dependent fields keep content.
4. **Emptied blocks lose their prose**: when liveness drops all rows of a block, the block prose is
   replaced by the client gap sentence (no more empty-table-plus-confident-prose).
5. **Bot-hostile 403/429/503** from known review hosts = liveness-unknown (keep row, exclude from
   pass-rate denominator), not dead.
6. **Earned user-supplied**: `redactPaidMediaMoneyFields` honors `user-supplied` only when the token
   matches brief economics; otherwise downgrade to `model-estimated`. (Rewrites the test that pins
   the bug.)
7. **Repair decoupled from the Infinity ceiling**: finite repair trigger (unsupported load-bearing
   claims > 6 → one grounding repair attempt), hard-fail stays Infinity (ARI decision preserved).
8. **Confidence single-writer**: computedTrust always threads into envelope confidence; commit patch
   clamps the flag to it.

## W2 — Media plan numbers become real (files: paid-media-plan.ts, build-prompts.ts) — after W1
1. **Budget cascade validator** (the documented $5 rule, in `validatePaidMediaPlanMinimums`):
   sum(audience dailyBudget) == dailySpend; dailySpend×30 ≈ monthly; phase budgets ≈ monthly with
   overlap tolerance. Violations feed the existing repair loop; unrepairable → numeric siblings
   dropped + provenance 'unknown' (renderer hides the number, the prose split survives).
2. **Projections bridge**: when `kpiCostProvenance:'unknown'` and brief targetCac exists and units
   match, set kpiCostValue from targetCac (provenance user-supplied); existing floor() math runs.
   marginOfErrorPercent only with a count present.
3. **Channel suggestions substantive-row validator** (mirror projectedResults): all-placeholder
   tables fail into repair; placeholder rows never render.
4. **Sales assets reach the model**: add salesProcessDocs/salesLoomUrl to the onboarding strategic
   frame (~10 lines).
5. **creativeStrategy counts single-writer in code** from creativeCapacity/framework slots; never
   model-trusted, never silently defaulted.
6. **Display-string hygiene**: strip trailing provenance parentheticals in normalizers — the enum is
   the only provenance writer.

## W3 — Review layer defanged; brief gets honesty context (files: commit-patch.ts, supabase-run-store.ts, agentic-section-review.ts, executive-brief route/agent, section-profile-persistence.ts)
1. **One line that kills the fabrication surface**: `buildCommitPatch` never substitutes
   `upgradedMarkdown` into the markdown column — review becomes tier + clientQuestions only.
2. removedItems/tierRationale stop feeding profile insights and the contradiction scan; review-prompt
   scaffolding pollution removed.
3. **Executive brief gets tiers**: thread verification_tier + confidence into brief section inputs;
   one prompt rule — decisions resting on needs_review/insufficient sections are marked directional.
4. Surface the already-computed run quality verdict through audit-state (no migration; client
   computes worst tier from per-section tiers it already receives).

## W4 — The deliverable reading experience (frontend only)
1. **DataTable fix**: clamp moves to an inner div (restores table-cell layout, SOURCE column,
   unclips text); default-rendered cells pass through scrubReaderText.
2. **Deck-shaped paid-media renderer** (additive `paid-media-plan-deck.tsx`): 13-page order, stat
   tiles, budget bar, audience cards WITH detail/grounding, creative framework slots, funnels,
   competitor insights, channel verdicts (only substantive), KPI cards. No operator chrome; provenance
   collapses to one assumptions note. Mounted as the default paid-media view in reader + share;
   print stylesheet so Cmd+P → client PDF. Remove dead html2pdf.js dep.
3. **Exec brief is the first screen**: editorial typography (lede + restored heading scale), not the
   14px flattener.
4. **Labels become client language** at call sites; Eyebrow restyled off mono-uppercase per DESIGN
   direction; "Ask the client" → "Open questions" in second person.
5. **Status honesty** (reverses the 2026-06-11 "done is done" decision — see note): per-section tier
   subline ("Complete — needs review"), rollup qualifier ("6/6 · 5 need review"), error→"Failed".
   The mandate's rule — no complete-surface implying quality when the report isn't buyer-ready —
   overrides the earlier decision; flagged prominently in the final report.
6. **Share page**: include + lead with the executive brief, neutral footer (no "Create Your Own"),
   deck view for paid media.
7. **Render-side scrub belt**: markdown-link syntax rewritten in plain-text contexts; gap sentinels →
   GapNote at the known leak points (TAM inputs, estSpend, verbatimHeroCopy); tool tokens added to
   TOOL_NAME_PATTERN + internalJargonPatterns (underscore forms only); `formatUsdValue` 'unknown' →
   'not available'; provenance parentheticals stripped from money strings.

## W5 — Upstream hygiene (worker + research-v2 + tools)
1. Corpus: fan-out joiner → plain space; process-talk style rule + deterministic scrub; guarded parse
   + one retry for fan-out group 2 (fixes empty competitors/pricing topics); source backfill only for
   cited sources.
2. Onboarding: companySize extraction semantics + deterministic guard (usage-claims rejected); hedge
   detector → blank field; Section-7 internal metrics demoted to optional.
3. VoC: enum += capterra/trustpilot/trustradius; generalize the per-review-permalink downgrade to VoC
   quote arrays (index-page quotes relabel as paraphrased patterns); verifier-no_match URLs on quote
   rows get the gap relabel instead of shipping.
4. Demand-intent: subject-domain independence gate on intent signals (mirror VoC); keyword_volume
   exempted from the no-retry rule (bulk expansion allowed).

## Sequencing & verification
W0 → {W1, W3, W4, W5 in parallel (disjoint files)} → W2 (after W1; both touch evidence-support).
Every wave: tsc 0, scoped vitest green + pinned-test updates in the same change, then full
`npm run test:run` + `npm run build` before the proof run.
Phase 6 proof: fresh E2E run (Airtable subject, ~$2), fresh screenshots, self-judged against
`02-bar.md` scoring rubric.
