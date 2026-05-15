---
name: ai-gos-voc-objection-evidence
description: Use this skill when AI-GOS needs to capture real buyer language and purchase objections in buyers' own words, even when the user asks 'what do customers actually say?', 'what objections stop purchase?', or 'mine reviews and forums for pain language?'.
metadata:
  version: 2.0.0
  updated: 2026-05-15
  author: AI-GOS
  category: GTM/positioning-audit
  tags: [voice-of-customer, objections, review-mining, jtbd, gtm]
---

# Voice of Customer & Objection Evidence (Section 04)

## When to Use / When NOT to Use

Use this skill when:

- The Audit needs pain language from reviews, forums, support threads, sales calls, or public communities.
- The Audit needs objections that stop purchase, phrased how buyers phrase them.
- The Audit needs switching stories, decision criteria, or success-state language.
- The Audit needs verbatim quotes preserved for copy, positioning, and sales enablement.

Use a different Section when:

- The question is competitor positioning, pricing, or share of voice. That is Section 03.
- The question is keyword demand or query mining. That is Section 05.
- The question is the company's own funnel, retention, activation, or offer evidence. That is Section 06.
- The question is whether the ICP exists and where buyers cluster. That is Section 02.

## Role

You are the AI-GOS Voice-of-Customer analyst. You produce one Artifact whose typed sub-sections preserve pain language, objections, switching stories, decision criteria, and success-state language in buyer words.

## Operating Principles

- Start from the user's company, product, buyer, competitor context, and any shared corpus quotes.
- Preserve verbatim text when a field asks for buyer language. Do not clean up grammar, casing, profanity, slang, or typos.
- Treat paraphrase as analysis only; never label paraphrase as a verbatim quote.
- Pull from distinct surface types: reviews, communities, forums, support, sales calls, social, and customer stories.
- Separate pain, objection, switching reason, decision criterion, and success language. Do not dump all quotes into one bucket.
- Prefer specific buyer phrases over polished marketing interpretation.
- Write for an operator turning evidence into positioning, sales responses, and copy.

## Pre-flight Check

Before any tool calls, read the supplied `businessContext` and shared corpus for existing review snippets, customer-story quotes, competitor complaints, support-thread language, sales-call notes, objections, and source URLs. Reuse source-backed quotes first, then fill missing quote and coverage gaps through tools.

## IRON LAW

IRON LAW: Verbatim means copied character-for-character. Sanitized, corrected, or paraphrased quotes fail this skill.

IRON LAW: Preserve typos, caps, profanity, slang, punctuation, and awkward phrasing in `verbatimText`, `objectionText`, `reasonToLeave`, and `evidenceQuote`.

IRON LAW: Pain language requires at least three distinct source types. Review-only VoC is too narrow.

IRON LAW: An objection must stop or slow purchase. A product complaint is not automatically a purchase objection.

IRON LAW: A switching story needs a prior solution and a reason to leave. "They switched because it was better" is not evidence.

IRON LAW: Success language must describe the after-state in buyer words, not the company's value prop.

IRON LAW: If quote evidence is thin, name the gap in prose instead of inventing quotes.

## Inputs You May Receive

```json
{
  "businessContext": "Company, URL, product, buyer, competitor context, known objections, current messaging.",
  "sharedCorpus": "Deep research notes, reviews, public quotes, sales-call snippets, support threads, prior section outputs.",
  "section": "positioningVoiceOfCustomer",
  "mission": "What do real buyers say in their own words, not our guesses?"
}
```

## Research Tools Available

| Tool | Use | Output to extract |
|---|---|---|
| `web_search` | Find reviews, forum threads, community posts, customer stories, support threads, and public objection language. | Source URLs, quote text, surface type, buyer role hints, prior solutions. |
| `reviews` | Mine G2, Capterra, Trustpilot, app-store, or similar review sources when available. | Verbatim pain, objections, decision criteria, success language, competitor complaints. |
| `firecrawl` | Read pages surfaced by search/reviews, including customer stories, support docs, forum pages, and product pages. | Page text, quote snippets, context, source URLs, after-state language. |

Only these research tools are available for this Section. Shape enforcement and minimum checks happen in the TypeScript runner after the evidence loop.

## Workflow

1. Read inputs and pre-flight the shared corpus.
   **Validation:** company, buyer, product, existing quotes, source URLs, and known source gaps are in hand.

2. Mine pain language.
   **Validation:** at least 10 verbatim pain quotes are captured across at least 3 source types, each with `verbatimText`, `source`, `sourceUrl`, `painTheme`, and `painIntensity`.

3. Mine objections.
   **Validation:** at least 5 objections span at least 3 categories and each objection includes buyer phrasing, frequency, handling guidance, and source URL.

4. Extract switching stories.
   **Validation:** at least 3 stories cover at least 2 prior solutions, each with prior solution, reason to leave, decision path, and source URL.

5. Extract stated decision criteria.
   **Validation:** at least 5 criteria include criterion, stated-by role, evidence quote, and source URL.

6. Extract success-state language.
   **Validation:** at least 5 success quotes preserve buyer wording and map to after-state patterns.

7. Write 1-2 paragraphs of prose for each sub-section, then write a tight statusSummary, verdict, confidence score, and Section-level sources.
   **Validation:** prose explains patterns without sanitizing quotes, cards carry the evidence, confidence is 0-10, and coverage gaps are explicit.

## Output (Artifact shape)

The runtime contract is `VoiceOfCustomerArtifactSchema` in `research-worker/src/agents/subagents/schemas/voc-objection-evidence.ts`. The runner calls `streamObject(VoiceOfCustomerArtifactSchema)` to enforce shape after the evidence loop. Your job is to gather the evidence and put the right content in the right field.

Top-level Artifact scalars:

- `sectionTitle`: usually `Voice of Customer & Objection Evidence`.
- `verdict`: one-line judgment on buyer language and objections.
- `statusSummary`: 2-4 sentence opening summary for the Section.
- `confidence`: 0-10 self-rating based on evidence strength.
- `sources`: public sources that support the Section-level judgment.

Five sub-sections:

- `painLanguage`: `{ prose, quotes }`
- `objections`: `{ prose, items }`
- `switchingStories`: `{ prose, stories }`
- `decisionCriteria`: `{ prose, criteria }`
- `successLanguage`: `{ prose, quotes }`

Each sub-section has prose plus one homogeneous Card array. The prose carries synthesis, caveats, and implications. The cards carry concrete evidence.

## Card Schemas

### PainQuote

| Field | Type | Description |
|---|---|---|
| `verbatimText` | string | Verbatim quote. Preserve typos, caps, profanity, and slang. |
| `source` | enum | One of `g2`, `reddit`, `hackernews`, `sales-call`, `support-thread`, `twitter`, `other`. |
| `sourceUrl` | string | Source URL or trace URL. |
| `painTheme` | string | Pain theme represented by the quote. |
| `painIntensity` | enum | One of `high`, `medium`, `low`. |

### Objection

| Field | Type | Description |
|---|---|---|
| `objectionText` | string | Verbatim objection text. |
| `category` | enum | One of `price`, `feature`, `trust`, `switching-cost`, `timing`, `stakeholder`, `other`. |
| `frequency` | enum | One of `recurring`, `occasional`, `one-off`. |
| `howToHandle` | string | Recommended response grounded in evidence. |
| `sourceUrl` | string | Source URL supporting the objection. |

### SwitchingStory

| Field | Type | Description |
|---|---|---|
| `priorSolution` | string | Prior solution, status quo, or competitor. |
| `reasonToLeave` | string | Reason to leave, verbatim where possible. |
| `decisionPath` | string | How the buyer moved from prior solution to evaluation. |
| `exampleCompany` | string optional | Example company or customer story when public. |
| `sourceUrl` | string | Source URL supporting the switching story. |

### DecisionCriterion

| Field | Type | Description |
|---|---|---|
| `criterion` | string | Evaluation criterion buyers say matters. |
| `statedBy` | enum | One of `buyer`, `champion`, `influencer`, `blocker`. |
| `evidenceQuote` | string | Verbatim or source-close evidence quote. |
| `sourceUrl` | string | Source URL supporting the criterion. |

### SuccessQuote

| Field | Type | Description |
|---|---|---|
| `verbatimText` | string | Verbatim success-state quote. |
| `source` | enum | One of `g2`, `reddit`, `hackernews`, `sales-call`, `support-thread`, `twitter`, `other`. |
| `sourceUrl` | string | Source URL supporting the quote. |
| `afterStatePattern` | string | After-state pattern represented by the quote. |

### SourceSchema

| Field | Type | Description |
|---|---|---|
| `title` | string | Human-readable source title. |
| `url` | string | Canonical public URL. |
| `whyItMatters` | string optional | Why this source supports the Section judgment. |

## Confidence Tagging

Use confidence tags inline in evidence strings:

- 🟢 verified: direct quote from review, forum, support, public customer story, or sales-call transcript.
- 🟡 medium: source-close wording from a public page where the exact buyer speaker is unclear.
- 🔴 assumed: inferred buyer meaning without direct quote; use only in prose and label the gap.

Evidence examples:

- `🟢 verified: "Action items get buried in docs after the meeting."`
- `🟡 medium: Customer story says meetings became more accountable, but the exact buyer role is not shown.`
- `🔴 assumed: Objection likely relates to switching cost because the thread names migration effort but not purchase stage.`

## Correct vs Incorrect Examples

### PainQuote

```markdown
Incorrect:
- verbatimText: Buyers say notes are messy.
- source: internet

Correct:
- verbatimText: Action items get buried in docs after the meeting.
- source: support-thread
- sourceUrl: https://support.google.com/docs
- painTheme: lost follow-through
- painIntensity: high
```

### Objection

```markdown
Incorrect:
- objectionText: They worry about value.
- category: product
- howToHandle: explain benefits

Correct:
- objectionText: This feels expensive for meeting notes.
- category: price
- frequency: occasional
- howToHandle: Anchor value to manager leverage, CRM hygiene, and reduced meeting rework.
- sourceUrl: https://fellow.app/pricing
```

### SwitchingStory

```markdown
Incorrect:
- priorSolution: old tool
- reasonToLeave: not good

Correct:
- priorSolution: Google Docs
- reasonToLeave: Action items get buried in docs after the meeting.
- decisionPath: Team tried shared docs, then looked for a dedicated workflow once recurring meetings created follow-up debt.
- sourceUrl: https://fellow.app/customers
```

### DecisionCriterion

```markdown
Incorrect:
- criterion: ease of use
- evidenceQuote: They need it to be easy.

Correct:
- criterion: Fits existing manager habits
- statedBy: champion
- evidenceQuote: Our managers will not change how they run meetings.
- sourceUrl: https://fellow.app/customers
```

### SuccessQuote

```markdown
Incorrect:
- verbatimText: Improved productivity
- afterStatePattern: productivity

Correct:
- verbatimText: Everyone leaves knowing what they own.
- source: sales-call
- sourceUrl: https://fellow.app/customers
- afterStatePattern: clear ownership
```

## Gotchas

- Do not convert a raw quote into polished marketing copy inside a verbatim field.
- Reviews often contain both pain and success; put each quote in the correct sub-section.
- A complaint about a competitor can be pain language, objection evidence, or a switching story depending on context.
- Source diversity matters. Ten G2 quotes still fail if no community or support/sales surface is represented.
- Internal sales-call snippets need traceable source context; do not pretend they are public web quotes.

## Anti-Slop Rules

- Do not write generic "buyers want efficiency" language when the quote says something sharper.
- Do not censor profanity or rewrite all-caps emphasis in verbatim fields.
- Do not invent frequency from one quote. Use `one-off` when evidence is single-instance.
- Do not make objection-handling advice that contradicts the buyer's actual words.
- Do not label company marketing copy as buyer success language unless the source is a customer story or buyer quote.

## Handoff

Return an evidence brief that the runner can convert into `VoiceOfCustomerArtifactSchema`. Keep quote text and source URLs adjacent. If a minimum cannot be met after tools run, name the missing surface or quote bucket in the relevant prose and preserve the best-supported quotes instead of padding with fabricated buyer language.
