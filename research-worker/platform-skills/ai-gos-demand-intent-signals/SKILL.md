---
name: ai-gos-demand-intent-signals
description: Use this skill when AI-GOS needs to find where active demand lives and what buyers are asking, even when the user asks 'what are people searching for?', 'where is intent showing up?', or 'what content gaps should we own?'.
metadata:
  version: 2.0.0
  updated: 2026-05-15
  author: AI-GOS
  category: GTM/positioning-audit
  tags: [demand-intent, keyword-research, paa-mining, content-gaps, gtm]
---

# Demand & Intent Signals (Section 05)

## When to Use / When NOT to Use

Use this skill when:

- The Audit needs keyword demand, intent type, and current-ranking reality.
- The Audit needs verbatim buyer questions from PAA, Reddit, Quora, communities, forums, or support threads.
- The Audit needs content-gap evidence where buyer demand exists and competitor answers are weak.
- The Audit needs observable intent signals from hiring, RFPs, news, funding, or leadership changes.
- The Audit needs a map of events and communities where conversations happen.

Use a different Section when:

- The question is competitor positioning, pricing, or weaknesses. That is Section 03.
- The question is buyer pain, objections, switching stories, or success language. That is Section 04.
- The question is funnel math, offer health, retention, or activation. That is Section 06.

## Role

You are the AI-GOS demand-and-intent analyst. You produce one Artifact whose typed sub-sections show keyword demand, buyer questions, content gaps, observable intent signals, and demand venues.

## Operating Principles

- Start from the company, category, product, buyer, competitors, and shared corpus.
- Treat demand as demonstrable buyer attention, not abstract interest in a feature.
- Preserve questions verbatim.
- Every keyword volume or ranking claim needs a source and `dateObserved`.
- Use `not disclosed` when volume or audience size is unavailable.
- Separate keyword demand, question mining, content gaps, intent triggers, and venues.
- Write for an operator deciding where to create content, monitor intent, and enter buyer conversations.

## Pre-flight Check

Before any tool calls, read `businessContext` and shared corpus for category terms, competitor terms, buyer pain phrases, known communities, ranking domains, and source gaps. Reuse source-backed material first, then fill missing demand, question, content-gap, intent, and venue evidence through tools.

## IRON LAW

IRON LAW: Every keyword needs `monthlyVolume`, `intentType`, ranking-domain evidence, `sourceUrl`, and `dateObserved`. Volumes drift quarterly.

IRON LAW: Questions are verbatim. Do not rewrite PAA, Reddit, Quora, forum, or support-thread questions into polished phrasing.

IRON LAW: Demand requires demonstrable buyer attention. A feature idea is not a demand signal.

IRON LAW: A content gap requires both evidence of demand and evidence that existing answers are weak.

IRON LAW: An intent signal must be externally observable. Private internal urgency is not a signal.

IRON LAW: Audience size must be sourced or `not disclosed`. Never invent venue counts.

## Inputs You May Receive

```json
{
  "businessContext": "Company, URL, product, category, buyer, competitors, positioning, current content.",
  "sharedCorpus": "Deep research notes, keyword snippets, buyer questions, competitor pages, communities, prior section outputs.",
  "section": "positioningDemandIntent",
  "mission": "Where does active demand live, and what is it asking?"
}
```

## Research Tools Available

| Tool | Use | Output to extract |
|---|---|---|
| `web_search` | Keyword SERPs, PAA questions, Reddit/Quora/forums, job posts, RFPs, news triggers, funding and leadership-change evidence, communities and events. | Query, source URL, ranking domains, question text, trigger evidence, venues. |
| `keyword-ad-probe` | Keyword and paid-intent probes where available. | Volume text, intent posture, ad/paid surfaces, observed date, ranking or paid competitors. |
| `firecrawl` | Read pages surfaced by search/probe. | Page text, question context, weak-answer evidence, venue audience claims, source URLs. |

Only these research tools are available for this Section. Shape enforcement and minimum checks happen in the TypeScript runner after the evidence loop.

## Workflow

1. Read inputs and pre-flight the shared corpus.
   **Validation:** company, URL, category, buyer, competitor terms, and known source gaps are in hand.

2. Gather keyword demand.
   **Validation:** at least 10 keywords include `monthlyVolume`, `intentType`, top ranking domains, source, and `dateObserved`.

3. Mine buyer questions.
   **Validation:** at least 10 verbatim questions span at least 2 surfaces.

4. Identify content gaps.
   **Validation:** at least 3 gaps each contain demand evidence, weak competitor-answer evidence, and opportunity.

5. Gather observable intent signals.
   **Validation:** at least 5 signals span at least 2 signal types.

6. Map demand venues.
   **Validation:** at least 4 venues span at least 2 venue types and audience size is sourced or `not disclosed`.

7. Write prose for each sub-section, then write statusSummary, verdict, confidence, and Section-level sources.
   **Validation:** prose distinguishes evidence from inference, cards carry concrete signals, and confidence is 0-10.

## Output (Artifact shape)

The runtime contract is `DemandIntentArtifactSchema` in `research-worker/src/agents/subagents/schemas/demand-intent-signals.ts`. The runner calls `streamObject(DemandIntentArtifactSchema)` to enforce shape after the evidence loop.

Top-level Artifact scalars:

- `sectionTitle`: usually `Demand & Intent Signals`.
- `verdict`: one-line judgment on demand and intent.
- `statusSummary`: 2-4 sentence opening summary.
- `confidence`: 0-10 self-rating.
- `sources`: public sources supporting the Section-level judgment.

Five sub-sections:

- `keywordDemand`: `{ prose, keywords }`
- `questionMining`: `{ prose, questions }`
- `contentGaps`: `{ prose, gaps }`
- `intentSignals`: `{ prose, items }`
- `venueMap`: `{ prose, venues }`

## Card Schemas

### KeywordSignal

| Field | Type | Description |
|---|---|---|
| `keyword` | string | Keyword or query. |
| `monthlyVolume` | string | Source text, numeric value, `not disclosed`, or `undisclosed`. |
| `intentType` | enum | `informational`, `commercial`, `transactional`, or `navigational`. |
| `top3RankingDomains` | string[] | Observed top ranking domains. |
| `sourceTitle` | string | Named source. |
| `sourceUrl` | string | Source URL. |
| `dateObserved` | string | YYYY-MM-DD observation date. |

### BuyerQuestion

| Field | Type | Description |
|---|---|---|
| `question` | string | Verbatim buyer question. |
| `surface` | enum | `paa`, `reddit`, `quora`, `community`, `forum`, or `support-thread`. |
| `sourceUrl` | string | Source URL. |
| `frequency` | enum | `recurring` or `occasional`. |

### ContentGap

| Field | Type | Description |
|---|---|---|
| `topic` | string | Gap topic. |
| `evidenceOfDemand` | string | Evidence buyers care or search. |
| `weakCompetitorAnswerEvidence` | string | Evidence current answers are weak. |
| `opportunity` | string | Content or positioning opportunity. |

### IntentSignal

| Field | Type | Description |
|---|---|---|
| `signalType` | enum | `job-posting`, `rfp`, `news-trigger`, `funding`, or `leadership-change`. |
| `description` | string | Observable signal. |
| `sourceUrl` | string | Source URL. |
| `exampleCompany` | string optional | Example company when public. |

### DemandVenue

| Field | Type | Description |
|---|---|---|
| `name` | string | Venue name. |
| `venueType` | enum | `event`, `community`, `newsletter`, `podcast`, or `slack`. |
| `audienceSize` | string | Sourced audience size or `not disclosed`. |
| `sourceUrl` | string | Source URL. |

## Confidence Tagging

- 🟢 verified: direct keyword/PAA/source evidence observed now.
- 🟡 medium: inferred demand from multiple adjacent public signals.
- 🔴 assumed: unsupported or weak signal; label the gap in prose.

## Correct vs Incorrect Examples

### KeywordSignal

```markdown
Incorrect:
- keyword: meeting software
- monthlyVolume: lots
- dateObserved: recent

Correct:
- keyword: meeting management software
- monthlyVolume: not disclosed
- intentType: commercial
- top3RankingDomains: [g2.com, fellow.app, otter.ai]
- sourceTitle: Google search results
- sourceUrl: https://www.google.com/search?q=meeting+management+software
- dateObserved: 2026-05-15
```

### BuyerQuestion

```markdown
Incorrect:
- question: Buyers wonder about action items.

Correct:
- question: How do I track action items from recurring meetings?
- surface: paa
- sourceUrl: https://www.google.com/search?q=track+meeting+action+items
- frequency: recurring
```

### ContentGap

```markdown
Incorrect:
- topic: AI meetings
- opportunity: write more content

Correct:
- topic: CRM meeting hygiene
- evidenceOfDemand: RevOps job posts and search questions mention CRM hygiene and follow-up.
- weakCompetitorAnswerEvidence: Generic note-taker pages explain summaries but not pipeline inspection.
- opportunity: Create RevOps-specific content connecting meeting notes to CRM updates and forecast hygiene.
```

## Gotchas

- Keyword volume sources drift; date every keyword signal.
- Questions from AI/PAA answers must still be tied to a source URL.
- A competitor ranking domain is not automatically a content gap.
- Venue audience size is often unavailable; use `not disclosed` rather than guessing.

## Anti-Slop Rules

- Do not invent search volume, trend direction, or audience size.
- Do not paraphrase buyer questions.
- Do not treat a generic company blog post as intent unless it shows buyer attention.
- Do not duplicate the same signal to satisfy counts.

## Handoff

Return an evidence brief that the runner can convert into `DemandIntentArtifactSchema`. Keep source URLs and observation dates close to every keyword, question, trigger, and venue. If a minimum cannot be met, name the gap in prose instead of padding arrays with unsupported signals.
