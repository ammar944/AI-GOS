# Blind Product Review — run d838ed4e (airtable.com), 2026-06-12

Judged from screenshots (`tmp/ui-audit/`), the eight run artifacts (`tmp/run-d838ed4e/`), and nothing else.
No prior judge verdicts were read before scoring.

## Blind score: 4.5 / 10

One line: **a real strategist's brain trapped in a broken trust pipeline and an analyst-console UI.**
The agency deliverable this exists to automate is a 13-page card deck with one budget cascade and zero
paragraphs. AI-GOS currently produces an annotated lab notebook.

## Persona verdicts

### 1. SaaS founder — "Would I pay?" → 5/10
The executive brief's core argument is genuinely worth money: paid conversion blocked not by the $45/seat
offer but by a demo-gate conversion surface mismatched to a solution-aware buyer; a ~2,200-search capture
ceiling on the comparison wedge; activation (35%) as the binding constraint with named stop signals.
That is agency-strategist thinking. But within two minutes of reading I hit: a channel table whose every
row says "Evidence gap: channel recommendation missing." under a confident FIX/KEEP/SCALE/ADD chip;
`(500k [unverified]+ brands)` markers split mid-token in client copy; "Run a bulk keyword_volume probe"
as recommended move #1 (the tool talking to itself); and budget math that does not add up. I'd screenshot
the brief and cancel.

### 2. Media buyer — "Can I act on it?" → 5/10
Real fuel exists: 4 SpyFu keyword rows with volumes + one CPC; competitor platform whitespace (Airtable
0 Google / Notion 0 LinkedIn / Monday 0 Meta); 54 verbatim competitor creatives with ad-library permalinks;
DR-quality angles and creative-framework slots; a budget split that argues with the client's 50/25/25.
Fatal gaps: audiences sum to $634/day vs stated $833/day; phases sum to $20K vs $25K/month;
`projectedResults` contains no projections (kpiCost "unknown", no volumes); `channelSuggestions` is
verdict chips over empty recommendations; no CPC for any non-brand term; `(user-supplied)` stamped on
numbers the model itself derived. I cannot hand this to a junior buyer to build campaigns.

### 3. GTM strategist → 6/10
Cross-section coherence is surprisingly good — the $45/seat premium ↔ demo gate ↔ activation constraint
thread runs through all six sections; named tensions and proves-wrong-if conditions are real strategy
craft. But: TAM "directional only — not computed"; structural-forces prose narrates three forces while the
table holds one (the other two verifier-dropped); two different category windows (6–12 vs 12–18 months)
in one artifact; invented benchmarks then asked back to the client.

### 4. Product designer → 3/10
Wall-of-text executive brief with zero hierarchy; tables that clip text mid-word with empty SOURCE columns;
"UNKNOWN" chips directly beneath "$333/day"; internal methodology as UI headers (DEPTH GATE,
SECOND-ORDER IMPLICATION, NON-OBVIOUS READ, CATEGORY-POWER BET); raw image-CDN URLs with query strings
rendered inline in VoC prose; "6/6 Done ✓" sidebar chrome over content that is wall-to-wall needs_review.
The agency's actual deck is ~100% stat tiles/cards and ~0% prose; AI-GOS renders roughly the inverse.

### 5. Fabrication skeptic → 3/10
The verification machinery is real and unusually transparent (per-claim ledger, liveness checks,
entailment verdicts, honest tiers). But the shipped surface lies in both directions:
- **Fabrications still ship.** The review layer's `upgradedMarkdown` *invents* quotes and numbers that
  exist nowhere in the verified body ("5 tools to 2", "10 hours a week", a "40–60%" benchmark) and quotes
  a different competitor price set than the body ($18/$19/$32/$19 vs $10/$12/$25/$10). "Job-posting"
  intent signals are sourced to the vendor's own marketing pages. `(user-supplied)` provenance is stamped
  on model-derived budget splits. "Grandfathered plans for existing customers" is an invented offer
  commitment in suggested ad copy.
- **Honest content gets vandalized.** Verified prose carries `[unverified]` graffiti; the verifier
  amputated the offer section's best analysis (the 94%-never-convert funnel math) on a false-positive
  "subject-site CTA" check, leaving the same placeholder string pasted into five fields; emptied arrays
  (shareOfVoice.slices=[], publicWeaknesses.items=[], venueMap.venues=[]) sit under prose that still
  asserts the dropped numbers.
Two conflicting confidence numbers per artifact (computedTrust 0.4 vs confidence 0.67 on the media plan).

## What feels premium (protect these)
- The executive brief's argument quality; named tensions; proves-wrong-if stop conditions
- Venue/community table with member counts + as-of dates
- 54 real competitor creatives with platform permalinks; platform-mix whitespace calls
- SpyFu-measured keyword rows explicitly labeled "(SpyFu-estimated)"
- The per-claim verification ledger as a concept (claims → matchedSourceRef → entailment)
- The brief honestly arguing *against* the client's own 50/25/25 split

## What is slop (kill on sight)
1. Raw `[unverified]` / "[N figures in this field are unverified — see section badge]" markers in prose
2. `blockGap` / `sourcingPlan` / `foundCount` / `prepass` / `corpus` machinery rendered to the client
3. "Evidence gap: …" strings sitting in data fields (`verbatimHeroCopy`, `estSpend`, channel recommendations)
4. Tool names in recommendations (keyword_volume, keyword_trends, web_search) — move #1 of a deliverable
   must never be an instruction to the pipeline's own tools
5. Prose-vs-table contradictions (verifier empties the array, leaves the prose)
6. The review layer as a second ungoverned generation pass that rewrites/invents evidence
7. Provenance mislabels: `(user-supplied)` on derived numbers; "public estimate" on client-brief numbers
8. Budget cascade that does not reconcile ($634≠$833/day; $20K≠$25K/mo)
9. Ask-the-client questions for things the tool itself assumed or could research
10. "6/6 Done" success chrome over universally needs_review content
11. Batch-stamped observedAt timestamps; URL-as-title sources; "Supplemental fan-out:" in corpus prose

## Structurally wrong
- **The media plan is rendered as just another section** at the bottom of a research stack. True north:
  the media plan is the product; research sections are its evidence base.
- **The verifier is a graffiti artist + amputator**, not a gate: it stamps markers into prose and empties
  arrays leaving orphan prose, instead of forcing regenerate / suppress / honestly-gap decisions.
- **The review layer (`upgradedMarkdown`) bypasses verification entirely** — a second LLM pass over the
  artifact that invents content after the trust machinery has run. Actively dangerous.
- **Empty-but-chromed blocks ship** (projectedResults without projections, channelSuggestions without
  recommendations, salesProcess gap rendered as a deliverable table).
- **No numeric reconciliation pass** — the agency template's entire integrity is one budget cascade;
  nothing enforces it.

## What's missing from the experience
- A first-screen decision memo (the exec brief IS this content, but buried and unformatted)
- The deck-shaped media plan render (cover → overview tiles → phases → audiences → … → KPIs)
- A "what we measured vs what we assumed" surface instead of inline graffiti
- Exportable client deliverable (the agency ships a deck, not a scroll)
- A single, small, high-value "to sharpen this" ask list (max 3) instead of scattered data requests
