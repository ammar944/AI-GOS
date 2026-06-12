# Takeover Final Report — 2026-06-12 (final)

## Verdict
**Final score: 5.5/10** (blind baseline 4.5/10; bar 9/10 — not cleared).
The fresh proof run now completes end-to-end (8/8 sections + executive brief) on the new code, the
trust-vandalism and fabrication classes are measurably dead, and the UI stopped lying about quality.
But the deliverable still fails the Buyer Test: the memo blocked itself, per-audience budgets were
dropped by the reconciler, projections carry no counts, and the first screen renders internal
process language. Honest, complete, and clean — but not yet a plan a buyer can run.

## 1. Blind score before changes: 4.5/10
(`01-blind-review.md`) — strategist-grade thinking wrapped in trust vandalism: `[unverified]`
mid-token in client copy, all-placeholder channel verdicts, a budget cascade off by 24%, invented
quotes/prices in the review layer, "6/6 Done ✓" over universally needs_review content.

## 2. The bar (`02-bar.md`)
Buyer Test: a paying media buyer builds the campaigns same-day without re-deriving the skeleton.
Four provenance states; markers as typography never prose; memo → deck → appendix → trust drawer;
internal-vocabulary deny-list; never-ship list. Rubric: no buildable plan caps at 6; internal vocab
client-facing caps at 7; −1 per never-ship violation.

## 3. Agency grounding
The SaasLaunch deck (13 template pages, read page-by-page) is ~100% stat tiles, one budget cascade,
agency boilerplate around synthesized slots. Live schema already mapped ~1:1; the gap was fill
quality, numeric discipline, last-mile rendering. Doctrine adopted as code: never guess spend, no
client-specific KPI targets, never ship a template.

## 4. Root causes (all code-verified; `03-root-causes.md`, line cites in `trace-full.json`)
One law: **where code owns the numbers and the model owns the words, quality is high; every defect
inverts that ownership.** Verifier mutated persisted prose; review layer REPLACED canonical markdown
with unverified regeneration (the fabricated quotes/prices); budget cascade prompt-text-only;
'user-supplied' verifier-immune; DataTable clamp-on-td merged cells; tiers shipped with zero UI
consumers; corpus fan-out group 2 died silently. Proven during the proof run: **every single section
failure was a hard contract boundary** — basis enum, TAM required-URL, sources floor, funnelIdeation
ceiling, channelSuggestions ceiling, projectedResults floor, sourceSections floor, and a key-drift
placeholder (model writes recommendations under `detail`/`rationale`).

## 5. What changed (13 commits on refactor/architecture-deepening, every one gated tsc 0 / tests green / build 0)
- **W1** verification core: marker splicing deleted; false-positive strikes masked; CTA strike
  narrowed; bot-hostile 403 ≠ dead; emptied blocks lose their prose; earned 'user-supplied'; finite
  repair trigger; confidence = computedTrust; VoC quote honesty; demand-intent independence gate.
- **W2** media-plan math: cascade validated + reconciled in code; CAC→projections bridge; channel
  substantive floor + drift telemetry; sales assets reach the prompt; creative counts code-owned.
- **W3** review defanged: upgradedMarkdown never replaces markdown; removedItems quarantined; brief
  sees tiers; share snapshot carries the brief; run verdict surfaced.
- **W4** reading layer: DataTable fix; scrub belt; 13-page client deck as default paid-media view +
  print CSS; memo typography; editorial labels; tier-honest status (reverses "done is done");
  share page led by the brief.
- **W5** upstream: corpus fan-out retry (fixed empty competitor/pricing topics — visibly worked:
  both prefilled the brief this run); onboarding guards; VoC source enum.
- **Shakedown (proof-run, 5 commits)**: basis alias-snap; TAM sourced-without-URL snap; paid-media
  sources backfill; array-bounds class snap (truncate overshoot / synthesize undershoot); channel
  key-drift aliases.

## 6. Fresh run + proof (run f3993043, airtable.com — COMPLETE)
- Corpus 5.9 min; brief prefilled with real competitors/pricing (W5 fix).
- Six sections + paid media + executive brief all committed. Two section failures and four
  paid-media failures were fixed mid-run — all the same contract-kill class, confirming the #1 blocker.
- **Measured on the final artifacts** (greps + math, not vibes):
  `[unverified]` markers 0 · footnotes 0 · process-talk 0 · tool tokens in paid-media 0 ·
  provenance parentheticals 0 · channel table 3 substantive recommendations (was 4× placeholder) ·
  creative counts code-derived 5/3/8 (was invented 9/6/5) · cascade: $833×30≈$25,000 ✓, and the
  model's non-reconciling audience split was DROPPED to honest unknown rather than shipped broken.
- **Status honesty live** (screenshot `tmp/ui-audit-final/08-below-memo.jpeg`): "6/6 Done ·
  6 of 6 need review", every section "Complete — needs review" with amber dots.
- Screenshots: `tmp/ui-audit-final/` (07/08 = the blocked memo + honest rail; 13:50 peek shows the
  live tier rail mid-run).

## 7. Why 5.5 and not more
- **Buyer Test fails (caps at 6):** the memo blocked itself ("5 critical synthesis contradictions
  unresolved" — the gate working as designed, but no decision memo shipped); per-audience budgets
  were dropped by the reconciler (honest, but the buyer must re-derive the split); projections have
  no counts (the CAC bridge's KPI-unit pattern didn't match "Qualified Business-plan trial").
- **Internal vocabulary on the first screen (caps at 7):** the blocked memo renders repair
  instructions ("Resolve contradiction 1: Remove or relabel the inherited statement…") as "The
  Three Moves", and the fact-reconciliation appendix dumps a raw ledger onto the client surface.
- **Cold-load rehydrate bug:** fresh page loads briefly show stale "Queued" chrome before settling.
- Credit over blind: completion, dead slop classes, honest tiers, the deck, code-owned math.

## 8. What blocks 9/10 (priority order)
1. **Decode-boundary policy: snap-don't-reject for EVERY closed enum, required field, and array
   bound in body schemas.** Eight instances fixed by hand across two days; make it a policy, not
   whack-a-mole. This is the single highest-leverage change.
2. **Blocked-memo UX**: when the contradiction gate fires, render a client-language coverage note +
   auto-run the reconciliation pass (the resolution machinery exists; it currently just refuses),
   never repair instructions as "moves". Hide the raw fact ledger behind the trust drawer.
3. **Cascade repair before drop**: give the repair loop one shot at fixing a non-reconciling
   audience split before the reconciler hides the numbers (needs the attempt-index flag W2 scoped out).
4. **CAC bridge unit matching**: accept trial/demo/MQL units (or map primaryKpi → unit class) so
   projections get counts.
5. Cold-load rehydrate status; SpyFu bulk expansion; VoC permalinks; branded PDF/PPTX export;
   capacity policy numbers (3/1, 8/5) need product sign-off.
6. Smaller, observed on the final screenshots: deck UGC card renders empty when every framework
   slot classifies as static (split heuristic needs a fallback); share-link creation 404s for this
   run ("Session not found" — /api/share session lookup vs this run's session shape).

## 9. Where everything lives
Branch `refactor/architecture-deepening` — 13 takeover commits, tree clean, gates green.
Docs: this directory. Runs: d838ed4e (old, judged blind) · f3993043 (new, complete, judged here).
Services left running: tmux aigos-dev / aigos-worker, automation Chrome on :9223.
