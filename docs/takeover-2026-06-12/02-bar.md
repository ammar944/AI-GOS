# The 9/10 Bar — the contract (2026-06-12)

Owner: product takeover session. Existing validators matter only where they serve this bar.

## The one test that matters — "The Buyer Test"
A media buyer who pays for this opens the report and can build the campaigns **same day** without
rebuilding the skeleton: budgets reconcile, audiences are enterable into an ads manager, angle copy is
paste-ready, and every number is either traced, measured, derived-with-visible-math, or explicitly the
client's own input. If they have to re-derive the plan, we failed regardless of how good the research is.

## True north restated
The media plan is the end product. Every research section earns its place by feeding it. The deliverable
shape is the SaasLaunch 13-page deck: cover → campaign overview (budget cascade tiles) → phases →
audiences → angles → creative framework → funnel ideation → sales process → competitor marketing →
competitor reviews → current-funnel suggestions → KPIs. The current `paidMediaPlanBodySchema` already
maps ~1:1 to these pages; what must change is fill quality, numeric discipline, rendering, and trust surface.

## The bar, by dimension

### 1. Insight quality
Every section answers: *what would a $400/hr strategist say that a junior wouldn't?*
At least one named tension and one falsifiable bet (proves-wrong-if) per section. Generic SaaS advice
("invest in onboarding") never ships as a finding.

### 2. Research trust — the Four Provenance States
Every number on a client surface is in exactly one state, and the state is visually encoded, never
inlined as prose graffiti:
1. **Measured** — a tool returned it (SpyFu, ad libraries); labeled with the instrument.
2. **Sourced** — a live URL contains it; the URL is item-level, not an index page.
3. **Client-supplied** — it came from the brief; labeled as such, never laundered into "public estimate".
4. **Derived** — computed from 1–3 with the formula visible (budget cascade, sums, ceilings).
A number in none of these states does not render. There is no fifth state called
"asserted with a [unverified] tag".

### 3. Evidence handling
- Markers never render in prose. Marker semantics become typography (footnote chip → appendix ledger).
- If the verifier drops evidence rows, the dependent prose is regenerated or the whole block collapses
  to one honest gap card. Empty-table-plus-confident-prose may not ship.
- Quotes: verbatim, attributed, permalinked at item level. A quote without a permalink renders as a
  "pattern" not a quote, and never in ad copy.
- The review layer may REMOVE and RELABEL only. It may not add, rewrite, or re-source content.
  Anything the review layer writes that contains a number/quote absent from the verified body is a bug.

### 4. Media-plan usefulness (the Buyer Test, itemized)
- **One budget cascade**: monthly budget → phase budgets → daily spend → per-audience/day. All sums
  reconcile exactly; enforced in code, not by the model.
- **Audience specs a buyer can enter**: platform, targeting (keywords w/ volumes where measured;
  firmographic filters; lookalike/seed definition), daily budget, and the evidence chip behind each.
- **≥4 paste-ready angles**: primary text + supporting line + the buyer insight it taps, in the buyer's
  verbatim language from VoC where available.
- **Creative framework slots filled** (PST 1–3 with actual problem/solution/transformation; objections
  with the actual objection), never bare archetype labels.
- **Funnel paths with prove-metrics**; KPI cards with definitions and measurement method (no invented
  numeric targets — agency doctrine).
- **No empty verdict rows**: a channel verdict without a recommendation does not render. A projections
  table without projections does not render — it renders as the assumptions panel it actually is.

### 5. Agency-template fit
The paid-media artifact renders as the deck, page-shaped, in deck order. Sections the data can't fill
(sales process assets not supplied) render as the agency renders them: a clean ask, not an apologetic table.

### 6. Visual hierarchy
First screen = decision memo: the verdict, the 3 numbers that matter, the bet, the binding constraint,
the budget split donut. Cards/tiles over paragraphs everywhere on the main surface; no paragraph over
~4 lines outside the appendix. Numbers as stat callouts, never buried mid-sentence.

### 7. Report structure (IA)
1. **Executive decision memo** (1 screen)
2. **Paid media plan** (the deck — the product)
3. **Evidence appendix** (the six research sections, demoted to evidence role)
4. **Trust drawer** (sources, verification ledger, dropped rows, methodology)
"To sharpen this" (max 3 asks, each tied to what it unlocks) lives at the end of the memo —
never scattered "can you confirm our own assumption" questions.

### 8. Readability
Zero internal vocabulary client-visible. Greppable deny-list: `blockGap`, `prepass`, `corpus`,
`verifiedCount`, `displayable`, `quarantine`, `containment`, `liveness`, `in this pass`, `fan-out`,
`keyword_volume`, `web_search`, `keyword_trends`, `tool budget`, `section badge`, `evidence gap:` (as a
value), `[unverified]`, `[verified`. This is a CI check, not a hope.

### 9. Client-facing polish
No truncated cells; no empty columns; no "UNKNOWN" chip beside an asserted value; no raw URLs in prose;
one price per fact per artifact; consistent number formatting; observedAt only when real.

### 10. What ships first / appendix / never
- **First**: decision memo, then the deck.
- **Appendix**: research sections, verification ledger, sources, dropped evidence, client questions.
- **Never ships**: invented quotes/numbers (incl. by the review layer); gap-strings as data values;
  contradictory duplicate facts; provenance mislabels; non-reconciling math; success chrome
  ("6/6 Done") over needs_review content; recommendations addressed to our own pipeline tools.

## Scoring rubric for self-judgment (Phase 6)
- 9/10 = Buyer Test passes + zero never-ship violations + first screen is the memo + deck renders.
- Each never-ship violation found in a fresh run: −1.
- Buyer cannot reconstruct campaigns without re-deriving: capped at 6.
- Internal vocabulary on any client surface: capped at 7.
