# Phase 6b: Agency-Style Visual Elevation

## Problem Statement

The research sections still read like a Google Doc wall of text. Nobody at an agency reads 30 bullet points vertically. The data is all there — the presentation kills it.

## Gap Audit (Section by Section)

### Market Overview
**Current**: Stat grid → 6 trend cards → 6 bullet lists (PAIN POINTS, DEMAND DRIVERS, BUYING TRIGGERS, BARRIERS, MESSAGING OPS) all dumped vertically. Messaging Opportunities is 8 long paragraphs.

**Gaps**:
1. **No visual hierarchy between sub-sections** — Pain Points, Demand Drivers, Buying Triggers, Barriers all look identical. A user can't scan and find what they need.
2. **Messaging Opportunities is a wall** — 8 long items with bold titles but zero structure. Should be cards you can scan.
3. **Trend signals are repetitive** — 6 identical "RISING" badges vertically. Should be a compact list/grid, not 6 separate card blocks.
4. **No collapsible sections** — everything is expanded always. Long lists should collapse.

**Fix**:
- Trend signals → compact 2-column grid (badge + title + one-line evidence)
- Bullet lists → add subtle bg container per group with slight left-border color coding
- Messaging Opportunities → card grid (2-col) with bold title card + truncated body, expandable
- Add `<details>` collapsible for lists with 5+ items

### ICP Validation
**Current**: Similar to Market Overview — stat grid + bullet lists.

**Gaps**: Same as Market Overview — no grouping, no visual break between sections.

**Fix**: Same patterns as Market Overview.

### Offer Analysis
**Current**: Stat grid (scores) → Pricing card → Flag cards (wall of text with severity badges) → Strengths/Weaknesses/Opportunities bullet lists → Offer Statements.

**Gaps**:
1. **Flag cards are prose walls** — each flag has a title that IS the entire paragraph. No summary/headline separation.
2. **Offer refinement score card** — the progress bars are good but the "How to reach 8+" recommendation cards below are just text blocks.
3. **Strengths/Weaknesses** are plain bullets — should use visual indicators (green/red/amber dots or icons).

**Fix**:
- Flag cards: First sentence = headline (bold, 14px), rest = expandable detail (13px, collapsed by default)
- Strengths → green left border, Weaknesses → red left border, Opportunities → blue left border
- Offer statements already look decent — keep as-is

### Competitor Intel
**Current**: Tab bar (Overview + individual competitors), overview table, individual competitor cards.

**Gaps**:
1. **Individual competitor view is a vertical dump** — S/W/O lists, Ad Activity, Counter Positioning all stacked with no visual break.
2. **Ad Activity section** inside competitor card is bland — just stats + bullets.

**Fix**:
- Group competitor sub-sections with subtle separators
- Ad Activity → borderless mini-table (Platform | Active Ads | Coverage)

### Keywords
**Current**: Stat row + opportunity table + campaign groups + starting set + competitor gaps + negatives + confidence notes + quick wins. Already the best section.

**Gaps**:
1. **Campaign groups / starting set / competitor gaps** — still using left-border callout style which doesn't fit tabular data. Should use compact tables.
2. **Too many sub-sections visible at once** — confidence notes and quick wins could collapse.

**Fix**: Light — collapse confidence notes and quick wins by default.

### Strategic Synthesis
**Current**: Strategy card (callout) → Insight cards (callouts) → Messaging angles → Lists → Prose.

**Gaps**:
1. **Insight cards are good** but there's no visual distinction between the "big insight" and supporting ones.
2. **Prose sections at bottom** are plain text walls.

**Fix**:
- First insight card gets slightly larger text (16px) as the "lead insight"
- Prose → collapsible with summary first line visible

### Media Plan (WORST SECTION)
**Current**: Strategy snapshot → Budget summary → 5 charts (pie, funnel, CAC, KPI benchmark, phase budget) → Platform cards → Campaign cards → Creative angles → Phases → Risks → KPIs → CAC model → then a MASSIVE prose wall at the bottom.

**Gaps**:
1. **Charts are great** — the 2-column chart grid is the best part of the entire app. Keep as-is.
2. **Below the charts is a waterfall** — platform cards, campaign cards, phase cards, risk cards are all small text items stacked vertically with no grouping or visual break.
3. **The prose wall at bottom** — the "rationale" text is 500+ words of dense paragraph. Completely unreadable.
4. **KPI grid** — already tabular but needs table header styling to look like a real table, not a list.
5. **Validation flags** (the `[Channel Mix & Budget]`, `[Creative System]` items) — these are raw validation output showing as regular bullet points. Should be styled as a collapsible warnings/notes section, not mixed with content.

**Fix**:
- Platform cards → borderless table (Platform | Role | Budget Allocation)
- Campaign cards → borderless table (Campaign | Platform | Objective | Ad Sets)
- Phase cards → timeline-style cards (phase name + duration badge, details collapsible)
- Risk cards → severity-colored left border + collapsible detail
- Validation flags → separate "System Notes" collapsible section at the bottom, styled as muted/dimmed
- Long prose → first 2-3 sentences visible, rest behind "Read more"

## Cross-Cutting Patterns Needed

### 1. Collapsible/Expandable Text
For any text block > 3 lines or list > 5 items. Simple `<details><summary>` or a React state toggle. Default collapsed for supporting content, expanded for primary content.

### 2. Prose Truncation
Long narrative blocks need a "Read more" pattern. Show first ~200 characters + ellipsis, click to expand.

### 3. Visual Section Grouping
Each card group (stats, callouts, lists, prose) needs a subtle visual separator — either a horizontal rule or extra spacing with a zone label.

### 4. 2-Column Layout for Related Lists
Pain Points | Demand Drivers side-by-side. Strengths | Weaknesses side-by-side. Not everything in one column.

### 5. Validation/System Notes Section
Raw validation output (`[Channel Mix & Budget]`, `[Creative System]`, `[Measurement & Guardrails]`) should be collected into a collapsible "System Notes" section at the bottom of Media Plan, not mixed with content.

## Priority Order

1. **Collapsible text/lists** (biggest readability win, applies everywhere)
2. **Prose truncation** (kills the worst walls of text)
3. **2-column list layout** (Market Overview, Offer Analysis)
4. **Platform/Campaign → table conversion** (Media Plan)
5. **Validation flags separation** (Media Plan)
6. **Trend signal compaction** (Market Overview)
7. **Messaging Opportunities → card grid** (Market Overview)

## Design References

- **Parallel.ai** — data-dense research tool, dark mode, tables + collapsible sections
- **GlossGenius** — analytics dashboard with card hierarchy, large KPI numbers, contextual side panel
- **Intercom Reports** — chart cards in 2-col grid, expandable sidebar sections
- **Linear** — minimal chrome, data-dense, collapsible sections

## Implementation Notes

- All changes must work in BOTH workspace mode (live generation) AND document mode (read-only research detail)
- Card components are shared — changes propagate to both views
- Don't break: inline editing, version history, CompetitorTabs, keyword sort
- Use `<details>` HTML element for collapsible — it's accessible, no JS needed, works in SSR
