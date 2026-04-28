# research-voc Collector

## Objective

Collect category voice-of-customer evidence that can inform downstream cross-analysis and positioning without turning into competitor review mining.

## Search Pattern

Start from the locked category, ICP pains, current alternatives, buying triggers, and objections. Use searches shaped like:

- `how do teams handle <category problem>`
- `frustrated with <manual process>`
- `<target customer> workaround for <pain>`
- `<category> implementation pain forum`
- `<category> status quo spreadsheet manual process`
- `<category> objection too expensive hard to adopt`

For `tier: "smb"`, keep the existing community-first source pattern: Reddit, Hacker News, public communities, forums, blog comments, and category-level review pages.

For `tier: "enterprise"`, explicitly mine G2.com, Gartner Peer Insights, and Capterra in addition to Reddit, Hacker News, and community sources.

Do not search for named competitors or the subject company.

## Keep

- raw complaint language
- manual workaround descriptions
- status-quo frustration
- desired outcome language
- objection language
- category-level review-site patterns without excluded product names

## Drop

- any evidence naming an excluded term
- named-product review quotes
- competitor pricing or feature complaints
- ad, positioning, or landing-page claims
- market-size statistics
- paraphrased quotes presented as verbatim

## Output Mapping

- `category_pain_language`: broad pain quotes tied to the category problem.
- `status_quo_frustrations`: complaints about current manual or legacy behavior.
- `workarounds`: observed manual processes or tool chains people use to cope.
- `desired_outcomes`: sourced outcome statements, not recommendations.
- `objection_language`: raw phrases showing adoption doubts.
- `source_gaps`: required non-empty list of topics searched where category-safe evidence was unavailable.
- `rejected_competitor_matches`: retained audit trail for filtered product-name leakage.

## Claim Chain

For each retained VoC item, preserve this chain:
1. exact user language
2. source URL and retrieved_at
3. source type: forum, review_site, community, blog_comment, or search_result
4. category-safe reason
5. excluded terms checked
6. mapped output bucket

Do not write a broad pattern unless at least two retained quotes support it.
If only one strong quote exists, keep the quote but avoid naming it a pattern.
