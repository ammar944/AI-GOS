# Card Taxonomy Cut List

> Architect: Ammar | Date: 2026-04-13
> Apply to: `src/lib/workspace/card-taxonomy.ts` in `parseResearchToCards()` per-section parsers

## 01 — Industry Market (`parseIndustryMarket`)

### KEEP
- Opportunities to Exploit (opportunity-card)
- Category Snapshot (stat-grid)
- Pain Points (bullet-list)
- Messaging Opportunities (check-list)

### CONSOLIDATE
- Demand Drivers + Buying Triggers + Barriers to Purchase → merge into ONE card: "Market Dynamics" (bullet-list with sub-headers or grouped items). Currently 3 separate bullet-list cards that overlap.
- All Trend Signals → merge into ONE card: "Trend Signals" (list format). Currently generates 1 card PER trend in a loop (lines 129-139). Fellow.ai produced 5 separate trend cards.

### REMOVE
- Nothing removed outright, but the 3 dynamics cards become 1 and the N trend cards become 1.

---

## 02 — ICP Validation (`parseICPValidation`)

### KEEP
- Audience Refinements to Test (refinement-card)
- ICP Overview (stat-grid)
- Final Verdict (verdict-card)
- Decision Process (prose-card)
- Best Channels (bullet-list)
- Buying Triggers (bullet-list)
- Core Objections (bullet-list)
- Recommendations (check-list)

### REMOVE
- **Entire segments loop (lines 477-514).** This generates 4 cards per segment (segment-card + Channels + Buying Triggers + Objections) that duplicate the main ICP cards above. Fellow.ai got 2 segments × 4 = 8 extra cards of redundant info. Kill the whole `if (segments.length > 0)` block.

---

## 03 — Competitors (`parseCompetitorIntel`)

### KEEP
- Competitor Sources (competitor-sources-card)
- Positioning Moves (positioning-move-card)
- Per-competitor card (competitor-card) — each competitor is genuinely different data
- Per-competitor reviews (review-card) — reviews are per-competitor
- Common Competitor Weaknesses (review-cross-analysis-card)

### CONSOLIDATE
- White-Space Gaps → merge into ONE card: "White-Space Gaps" (list/table format). Currently generates 1 gap-card per gap in a loop (lines 345-357). Should be a single card with all gaps listed.

### REMOVE
- Market Patterns (bullet-list, lines 334-341) — consistently vague/generic. The positioning moves card covers actionable patterns better.

---

## 04 — Offer Analysis (`parseOfferAnalysis`)

### KEEP
- Offer Score (stat-grid)
- Recommendation Rationale (prose-card)
- Pricing Analysis (pricing-card)
- Strengths (bullet-list)
- Weaknesses (bullet-list)
- Recommended Actions (bullet-list)
- Generated Offer Statements (offer-statement-list)
- ICE-scored fixes (ice-table)

### CONSOLIDATE
- Red Flags → merge into ONE card: "Red Flags" (list/table format). Currently generates 1 flag-card per flag in a loop (lines 624-636). Should be a single card listing all flags.

### REMOVE
- Pricing Intelligence (pricing-intelligence, lines 571-581) — merge any useful content into the existing Pricing Analysis card instead. Currently repeats what Pricing Analysis already says.
- Market Fit Assessment (prose-card, lines 618-621) — restates the Recommendation Rationale card.
- Messaging Recommendations (bullet-list, lines 609-614) — overlaps with Cross-Analysis messaging angles and Media Plan messaging.

---

## 05 — Keywords (`parseKeywordIntel`)

### KEEP
- Keyword Gaps to Fill (keyword-gap-card)

### CONSOLIDATE
- Keyword Intelligence (keyword-grid, line 720) — currently dumps the entire raw `data` object as `rawData`. Replace with a structured card showing the top 10-15 keywords by priority score in a table format (keyword, volume, difficulty, CPC, priority). Do NOT pass the entire raw data blob.

---

## 06 — Cross-Analysis / Strategic Synthesis (`parseCrossAnalysis`)

### KEEP
- Media Launch Readiness (readiness-scorecard) — the hero card
- Top Actions (priority-actions)
- Positioning Strategy (strategy-card)
- Planning Context (stat-grid)
- Charts (chart-card) — keep if they render
- Critical Success Factors (check-list)

### CONSOLIDATE
- Key Insights (loop, lines 818-828) → merge into ONE card: "Key Insights" (list format). Currently generates 1 insight-card per insight. Fellow.ai got 5 separate insight cards. One card with all insights listed.
- Messaging Angles (loop, lines 845-855) → merge into ONE card: "Messaging Angles" (list format). Currently generates 1 angle-card per angle. Fellow.ai got 4 separate angle cards.

### REMOVE
- Downstream Sequence (bullet-list, lines 789-795) — internal pipeline info, no user value.
- Strategic Narrative (prose-card, lines 812-815) — long wall of text. Top Actions + Positioning Strategy already summarize the strategy.
- Platform Recommendations (loop, lines 831-842) — fully covered by the Media Plan section. Redundant here.
- Next Steps (check-list, lines 867-873) — overlaps with Top Actions card.

---

## 07 — Media Plan (`parseMediaPlan`)

### NO CHANGES
Media Plan is the deliverable. Cards are structured by block (Channel Mix, Audience, Creative, Measurement, Roadmap) and each entry is genuinely different data. Keep as-is.

---

## Implementation Notes

- **Loop → single card pattern:** When consolidating a loop of individual cards into one card, change the loop to build an array of items, then emit one `makeCard()` with the full array as content. The card renderer will need to handle the list display.
- **Check card renderers:** After removing card types, verify the renderer in `src/components/workspace/cards/` doesn't break on missing types. If a renderer exists for a removed type, it just won't get called — no crash.
- **Estimated reduction:** ~20-25 cards removed from a typical research run.
