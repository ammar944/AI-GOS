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
- `source_gaps`: topics searched where category-safe evidence was unavailable.
- `rejected_competitor_matches`: retained audit trail for filtered product-name leakage.
