# Takeover Final Report — 2026-06-12

## The verdict up front
**Final score: 5/10.** Blind score before changes: 4.5/10. Bar: 9/10. Not cleared, and I'm not
going to dress that up. The slop classes I targeted are measurably dead in committed output, but the
fresh proof run could not finish: 2 of 6 sections hard-died on schema rejects mid-run, so the run
never produced a media plan or an executive brief — and per my own rubric, a run that doesn't hand
the buyer the product cannot score above 6 regardless of how clean the parts are.

## 1. Blind product score before changes: 4.5/10
Five-persona blind review of run d838ed4e (`01-blind-review.md`): real strategist-grade thinking
(demo-gate argument, competitor-alternative arbitrage, named stop signals) wrapped in trust
vandalism — `[unverified]` mid-token in client copy, verdict chips over "Evidence gap: channel
recommendation missing.", a budget cascade off by 24% ($634≠$833/day), a projections table with no
projections, invented quotes/prices in the review layer, "6/6 Done ✓" over universally
needs_review content.

## 2. The bar (`02-bar.md`)
The Buyer Test: a paying media buyer builds the campaigns same-day without re-deriving the skeleton.
Four provenance states only; markers become typography, never prose; IA = memo → deck → appendix →
trust drawer; greppable internal-vocabulary deny-list; explicit never-ship list. Scoring: never-ship
violation −1 each; no buildable plan caps at 6; internal vocab on client surface caps at 7.

## 3. What the agency materials taught
The SaasLaunch deliverable (13-page template + RovR deck) is ~100% stat tiles, ~0% paragraphs, ONE
budget cascade, agency boilerplate around synthesized slots. The live schema already mapped ~1:1 to
the deck — the gap was fill quality, numeric discipline, and last-mile rendering. Agency doctrine
adopted: never guess spend, no client-specific KPI targets, "fill in the blanks — never ship a
template."

## 4. Root causes found (all code-verified; `03-root-causes.md` + `trace-full.json`)
Unifying law: **where code owns the numbers and the model owns the words (the competitor-ad path),
quality is high; every defect inverts that ownership.** Headlines: the verifier mutated persisted
prose; the post-commit review REPLACED canonical markdown with unverified regeneration from a
24k-truncated view (the fabricated quotes/prices); the budget cascade existed only as prompt text;
'user-supplied' provenance was verifier-immune; a CSS clamp-on-td bug merged table cells (the empty
SOURCE column); tiers shipped to the client payload with zero UI consumers; corpus fan-out group 2
died silently (empty competitor/pricing topics).

## 5. What changed (9 commits on refactor/architecture-deepening, every commit gated tsc 0 / suite green / build 0)
- **W1**: marker-splicing deleted (metadata-only); false-positive strikes fixed (Microsoft 365 etc.);
  CTA strike narrowed; bot-hostile 403s ≠ dead; emptied blocks lose their prose; earned
  'user-supplied'; finite repair trigger; confidence = computedTrust; VoC index-page quotes
  relabeled paraphrased; fabricated quote URLs relabeled; demand-intent independence gate.
- **W2**: budget cascade validated + reconciled in code (non-reconciling numbers cannot commit);
  projections bridge (target CAC → floor(budget/CAC)); channel-suggestion substantive floor; sales
  assets reach the prompt; creative counts single-writer.
- **W3**: review fabrication surface dead (upgradedMarkdown never replaces markdown);
  removedItems/tierRationale quarantined; exec brief sees tiers + 'directional' rule; share snapshot
  carries the brief; run quality verdict surfaced.
- **W4**: DataTable cell-merge fixed; scrub belt; gap sentinels → client sentences; 13-page client
  DECK renderer as default paid-media view + print-to-PDF; memo typography; editorial labels;
  tier-honest status ("Complete — needs review" — deliberately reverses the 2026-06-11 "done is
  done" call); share page led by the brief, neutral footer.
- **W5**: corpus joiner/process-talk/fan-out-retry/source-padding/dedupe; onboarding companySize +
  hedge guards, Section-7 fields optional; VoC source enum widened.
- **Shakedown** (mid-proof-run): keyFindings basis alias-snap; TAM sourced-without-URL → evidence-gap
  snap.

## 6. Fresh run + proof (run f3993043, airtable.com)
- Corpus completed in 5.9 min — and the W5 fan-out fix visibly worked: competitors + pricing
  prefilled the brief (both shipped EMPTY in the old run).
- GTM brief filled and submitted (driver hung on a label locator; I took over via testid-scoped
  filler — inputs match the old run's economics for comparability).
- **4 of 6 sections committed; VoC and MarketCategory hard-failed** on schema rejects
  (off-enum `keyFindings.basis`; TAM input 'sourced' without URL). Both snaps are now in code,
  but the reruns were not executed (user call: stop fixing, judge now). No paid media, no brief.
- Measured slop on the 4 committed bodies vs the old run:
  `[unverified]` markers **0** (was dozens) · aggregate footnotes **0** · process-talk **0** ·
  "evidence gap:" value-strings **3** (was ~14; all TAM inputs, now rendered as client GapNotes) ·
  tool tokens **7** (all inside blockGap sourcingPlans — data-layer only; UI translates).
- Tier honesty now reaches the reader: BuyerICP/Competitor insufficient, DemandIntent/Offer
  needs_review — and the UI now says so instead of green "Complete".

## 7. Final score: 5/10 — and why
The product is not deliverable from the fresh run, so the Buyer Test fails at the first hurdle:
there is nothing to hand a buyer. That caps everything. What earns the +0.5 over blind: on the
sections that DID commit, the never-ship classes are gone from the client surface, the numbers that
remain are typed honestly, and the run no longer lies about its own quality. The deliverable's
binding constraint has **moved**: from "slop ships confidently" to "sections die on contract rejects
before the deliverable exists." That is progress — honest failure beats confident fabrication — but
it is not a 9/10 product. It isn't even a complete product today.

## 8. What still blocks 9/10 (in priority order)
1. **Contract robustness is THE blocker.** Every `z.enum`/required-field in a body schema is a
   section-killer under model drift. The two snaps I shipped are instances; the class fix is a
   decode-boundary policy: snap-don't-reject for every closed enum + required-text field (or a
   Zod-issue-driven repair pass at the answer-tool parse boundary). Until then, every fresh run is
   a coin flip on completion.
2. **Completion reliability under fan-out** (VoC failed again under parallel load, consistent with
   the known contention pattern; solo reruns work but are operator labor).
3. The proof run needs to finish end-to-end on clean code: rerun VoC + MarketCategory (one command
   each — `node scripts/zz-e2e-rerun-zone.mjs <zone>`), paid media + brief auto-fire, then judge the
   deck against the Buyer Test with fresh screenshots.
4. SpyFu depth (non-brand volumes/CPCs still one-shot), VoC permalinks (honest-but-unpermalinked),
   branded PDF/PPTX export beyond print CSS, lean/high creative-capacity policy numbers (3/1, 8/5)
   need a product owner's sign-off.

## 9. Where everything lives
- Branch `refactor/architecture-deepening`, 9 takeover commits, working tree clean, all gates green.
- Docs: `01-blind-review.md` · `02-bar.md` · `03-root-causes.md` · `04-implementation-strategy.md` ·
  `trace-full.json` (line-cited findings) · this report.
- Runs: d838ed4e (old product, judged blind) · f3993043 (new code, 4/6 committed + 2 fixed-but-not-rerun).
