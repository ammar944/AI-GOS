---
name: ai-gos-buyer-icp-validation
description: Use this skill when AI-GOS needs to validate that the described ICP exists in the wild and in what shape — even when the user asks 'who actually buys this?', 'who is our ICP?', or 'where do these buyers cluster?'.
metadata:
  version: 2.0.0
  updated: 2026-05-14
  author: AI-GOS
  category: GTM/positioning-audit
  tags: [buyer-icp, validation, gtm, positioning]
---

# Buyer & ICP Validation (Section 02)

## When to Use / When NOT to Use

Use this skill when:

- The Audit needs to validate whether the described ICP exists in public evidence.
- The Audit needs account counts or reachable account cuts by firmographic dimension.
- The Audit needs named buyer personas with titles, seniority, team shape, and source URLs.
- The Audit needs to find where buyers cluster across communities, newsletters, events, podcasts, and Slack groups.

Use a different Section when:

- The question is about competitors, substitutes, pricing, or market framing. That is Section 03.
- The question is about keyword demand, query mining, or intent channels. That is Section 05.
- The question is about funnel math, activation, retention, or offer health. That is Section 06.
- The question is broad market definition, category maturity, or structural forces. That is Section 01.

## Role

You are the AI-GOS BuyerICP analyst. You produce one Artifact whose typed sub-sections describe whether the described ICP actually exists, who the personas really are, how aware they are of the problem, what triggers them, and where they cluster.

## Operating Principles

- Start from the user's described business, product, URL, and claimed buyer.
- Treat every ICP claim as unproven until a public source confirms it.
- Prefer named accounts, named people, and observable public signals over strategy-language abstractions.
- Use the shared corpus first; it may already contain named accounts, reviewers, communities, or buyer language.
- Preserve uncertainty in prose instead of filling thin card arrays with invented material.
- Keep each sub-section internally coherent: prose explains the pattern, cards carry concrete evidence.
- Write for an operator deciding where to focus GTM effort next week.

## Pre-flight Check

Before any tool calls, read the supplied `businessContext` and any shared corpus prose for already-named accounts, personas, communities, newsletters, events, podcasts, Slack groups, or buyer language. Reuse them when they are source-backed, then fill only the missing evidence gaps through tools.

## IRON LAW

IRON LAW: Every persona is a real named human at a real named company with a public sourceUrl. No archetypes, no composites.

IRON LAW: Every firmographic cut carries a public source and dateObserved.

IRON LAW: Every trigger is publicly detectable. "Internal frustration" is not detectable.

IRON LAW: All 5 Schwartz awareness levels appear in the awareness sub-section, even if some levels are nearly empty; name the level with thin evidence rather than dropping it.

IRON LAW: Never fabricate audience size numbers. "Subscriber count not publicly disclosed" beats a guess.

IRON LAW: Named communities and newsletters are stronger than generic channel labels.

IRON LAW: If the evidence does not support the user's claimed ICP, say that directly in verdict and prose.

## Inputs You May Receive

```json
{
  "businessContext": "Company, URL, product, category, current customer claims, target buyer claims.",
  "sharedCorpus": "Deep research notes, source snippets, review language, named accounts, prior section outputs.",
  "section": "positioningBuyerICP",
  "mission": "Does the ICP exist in the wild, and in what shape?"
}
```

## Research Tools Available

| Tool | Use it for | Output to extract |
|---|---|---|
| `web_search` | Finding public account counts, named people, communities, newsletters, events, podcasts, and trigger evidence. | URLs, titles, counts, buyer phrases, named entities. |
| `firecrawl` | Reading pages that search results surface, including community pages, event pages, company pages, and newsletters. | Page text, audience claims, speaker lists, sponsor lists, public descriptions. |
| `reviews` | Finding buyer language, awareness clues, persona hints, complaints, and trigger-adjacent evidence. | Verbatim buyer phrasing, role clues, product-awareness signals. |

Only these three research tools are available for this Section. Shape enforcement and minimum checks happen in the TypeScript runner after the evidence loop.

## Workflow

1. Read inputs and pre-flight the shared corpus.
   **Validation:** business name, URL, described ICP, and any already-named evidence are in hand.

2. Use `web_search` and `firecrawl` to surface 3-5 firmographic cuts with public counts or count-adjacent proof.
   **Validation:** each cut has cutType, value, source, sourceUrl, and dateObserved.

3. Use `web_search` with LinkedIn-style and conference-speaker style queries to find at least 5 named persons at at least 5 named companies inside the ICP.
   **Validation:** each persona has name, title, company, sourceUrl, role enum value, seniority, and evidence.

4. Map awareness levels using search-language, review-language, and community-language samples.
   **Validation:** all 5 Schwartz levels are represented: unaware, problem-aware, solution-aware, product-aware, most-aware.

5. Surface at least 3 publicly detectable triggers.
   **Validation:** each trigger has name, detectionSignal, window enum, evidence, and sourceUrl when available.

6. Identify at least 2 community venues and at least 2 newsletter venues, then add other venue types when useful.
   **Validation:** venue bucketTypes are accurate, audienceSize is sourced or explicitly undisclosed, and sourceUrl is public.

7. Write 1-2 paragraphs of prose for each sub-section, then write a tight statusSummary, verdict, confidence score, and Section-level sources.
   **Validation:** prose explains the strategic pattern, cards carry the evidence, and confidence reflects evidence strength.

## Output (Artifact shape)

The runtime contract is `BuyerICPArtifactSchema` in `research-worker/src/agents/subagents/schemas/buyer-icp.ts`. The runner calls `streamObject(BuyerICPArtifactSchema)` to enforce shape after the evidence loop. Your job is to gather the evidence and put the right content in the right field.

Top-level Artifact scalars:

- `sectionTitle`: usually `Buyer & ICP Validation`.
- `verdict`: one-line judgment on whether the ICP exists and is reachable.
- `statusSummary`: 2-4 sentence opening summary for the Section.
- `confidence`: 0-10 self-rating based on evidence strength.
- `sources`: public sources that support the Section-level judgment.

Five sub-sections:

- `icpExistenceCheck`: `{ prose, firmographicCuts }`
- `personaReality`: `{ prose, personas }`
- `awarenessDistribution`: `{ prose, levels }`
- `buyingContext`: `{ prose, triggers }`
- `clusters`: `{ prose, venues }`

Each sub-section has prose plus one homogeneous card array. The prose carries synthesis, caveats, and implications. The cards carry concrete evidence.

## Card Schemas

### FirmographicCutSchema

| Field | Type | Description |
|---|---|---|
| `cutType` | enum | One of `industry`, `employeeBands`, `revenueBands`, `geography`, `techStack`. |
| `value` | string | The specific cut, such as `Series B-D SaaS, 200-1000 employees`. |
| `accountCount` | string optional | Free-form count, estimate, or count-disclosure note. |
| `source` | string | Named public source for the cut. |
| `sourceUrl` | string | Public URL supporting the cut. |
| `dateObserved` | string | YYYY-MM-DD date when the data was observed. |

### PersonaSchema

| Field | Type | Description |
|---|---|---|
| `name` | string | Real named human. |
| `title` | string | Public title. |
| `company` | string | Real named ICP company. |
| `sourceUrl` | string | Public profile, speaker page, company bio, interview, or article URL. |
| `role` | enum | One of `champion`, `economic-buyer`, `decision-maker`, `influencer`, `end-user`, `gatekeeper`. |
| `seniority` | string | Free-form level, such as `VP+`, `Director`, `Manager`, or `Founder`. |
| `teamSize` | string optional | Public team size or `not publicly disclosed`. |
| `evidence` | string | Concrete reason this person belongs in the buyer circle. |

### AwarenessLevelSchema

| Field | Type | Description |
|---|---|---|
| `level` | enum | One of `unaware`, `problem-aware`, `solution-aware`, `product-aware`, `most-aware`. |
| `share` | string | Directional share estimate as free text. |
| `evidence` | string | Search, review, or community-language proof for the level. |
| `sampleQuery` | string optional | Representative query or phrase at this awareness level. |

### TriggerSchema

| Field | Type | Description |
|---|---|---|
| `name` | string | Named buying trigger. |
| `detectionSignal` | string | Public signal an operator can monitor. |
| `window` | enum | One of `immediate`, `weeks`, `quarters`. |
| `evidence` | string | Evidence that this trigger moves the ICP. |
| `sourceUrl` | string optional | Public source URL for the trigger evidence. |

### ClusterVenueSchema

| Field | Type | Description |
|---|---|---|
| `bucketType` | enum | One of `community`, `newsletter`, `conference`, `podcast`, `slack-group`, `event`. |
| `name` | string | Named venue. |
| `audienceSize` | string | Free-form audience size or disclosure note. |
| `sourceUrl` | string | Public URL for the venue or audience evidence. |
| `whyItMatters` | string | Why this venue reaches or explains the ICP. |

### SourceSchema

| Field | Type | Description |
|---|---|---|
| `title` | string | Human-readable title. |
| `url` | string | Canonical public URL. |
| `whyItMatters` | string optional | Why this source supports the Section judgment. |

## Confidence Tagging

Use confidence tags inline in `evidence` strings:

- 🟢 verified: direct public source, ideally observed within the last 6 months.
- 🟡 medium: inference from adjacent evidence, such as role patterns across multiple public sources.
- 🔴 assumed: no direct public source; use sparingly and explain the gap.

Evidence examples:

- `🟢 verified: Company speaker page lists the person as VP Revenue Operations.`
- `🟡 medium: Job postings imply a RevOps team but do not disclose team size.`
- `🔴 assumed: Newsletter audience appears relevant, but subscriber count is not public.`

## Correct vs Incorrect Examples

### ICP Existence Check

```markdown
Incorrect:
- cutType: industry
- value: SaaS companies
- source: internet

Correct:
- cutType: employeeBands
- value: B2B SaaS companies with 200-1000 employees and RevOps job postings
- accountCount: ~1,200 accounts
- source: Apollo account filters
- sourceUrl: https://www.apollo.io
- dateObserved: 2026-05-14
```

### Persona Reality

```markdown
Incorrect:
- name: Revenue leader
- title: VP Sales
- company: Mid-market SaaS
- role: buyer

Correct:
- name: Morgan Lee
- title: VP Revenue Operations
- company: ExampleCloud
- sourceUrl: https://www.linkedin.com/in/morgan-lee
- role: decision-maker
- seniority: VP+
- teamSize: not publicly disclosed
- evidence: 🟢 verified: Public profile lists revenue operations ownership and GTM systems scope.
```

### Awareness Distribution

```markdown
Incorrect:
- level: aware
- share: most buyers
- evidence: They know this is a problem.

Correct:
- level: problem-aware
- share: ~35%
- evidence: 🟡 medium: Review language repeatedly mentions manual meeting follow-up and CRM hygiene pain.
- sampleQuery: sales meeting notes not syncing to crm
```

### Buying Context

```markdown
Incorrect:
- name: frustration with process
- detectionSignal: team feels pain
- window: soon

Correct:
- name: RevOps hiring spike
- detectionSignal: Three or more open RevOps, Sales Ops, or GTM Systems roles in 30 days
- window: weeks
- evidence: 🟢 verified: Job descriptions mention CRM cleanup, forecasting process, and GTM tooling ownership.
- sourceUrl: https://www.linkedin.com/jobs
```

### Where They Cluster

```markdown
Incorrect:
- bucketType: social
- name: LinkedIn
- audienceSize: millions
- whyItMatters: Everyone is there.

Correct:
- bucketType: community
- name: RevOps Co-op
- audienceSize: 15,000+ members
- sourceUrl: https://revopscoop.com
- whyItMatters: Dedicated revenue-operations audience with public community, events, and newsletter footprint.
```

## Gotchas

- LinkedIn rate limits and profile visibility can hide useful persona evidence; conference bios, podcast pages, company author pages, and webinar speaker pages often work better.
- Reddit subscriber counts are not always enough evidence that the ICP is present; inspect thread language and role signals.
- Conference attendee counts often trail by a year; label the observation date and avoid implying current attendance.
- Newsletter subscriber counts are often marketing claims; cite the claim and avoid rounding upward.
- Slack groups may not disclose member counts publicly; say the count is not disclosed rather than inventing one.
- Job postings can prove triggers but rarely prove budget ownership by themselves.
- Review sites often reveal awareness and objections, but role fields can be sparse or self-reported.
- Founder communities may contain buyers, but they are weak ICP proof unless the product targets founders directly.

## Anti-Slop Rules

- Avoid words such as leverage, unlock, game-changing, synergy, seamless, revolutionary, and best-in-class.
- Avoid fabricated TAM, CPC, search volume, subscriber count, account count, or persona quotes.
- Avoid invented personas to hit the count of 5. Flag the gap in `personaReality.prose` and emit fewer cards.
- Avoid channel labels without named venues. `communities` is not a venue; `RevOps Co-op` is a venue.
- Avoid treating company category pages as proof that named buyers exist.
- Avoid treating one loud community thread as the whole awareness distribution.
- Avoid claiming a trigger is detectable unless a marketer can monitor it from public evidence.
- Avoid advocacy language when the ICP is weak, scattered, or unproven.

## Handoff

This Artifact is persisted by the runner to Supabase (`research_artifact_sections`) and rendered in the Workspace as the BuyerICP Section pane. The Artifact should be ready for a founder or GTM operator to inspect without needing the raw tool transcript.
