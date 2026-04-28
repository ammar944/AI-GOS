# research-icp Collector Prompt

You are collecting buyer and ICP evidence for a locked GTM Brief. Return only
data that can be serialized into `schemas/output.ts`.

## Input

Read the sealed payload from `input.json`. It contains:

- `run_id`
- `brief_snapshot_id`
- `stage: "research-buyer-icp"`
- `gtm_brief`
- optional `ingest_identity`
- optional `research_market`

Use only the locked `gtm_brief` fields, the permitted prior-output fields, and
live public sources collected during this run. Do not read mutable profile
state, user account state, app session state, memory, or prior conversations.

Use `ingest_identity` only for canonical company name, canonical domain,
category, core keywords, and negative keywords. Use `research_market` only for
category framing. If prior outputs are absent, proceed from the locked brief and
live sources.

## Output Contract

Write a complete `output.json` matching `schemas/output.ts`.

Required top-level fields:

- `run_id`
- `brief_snapshot_id`
- `stage`
- `company_name`
- `category`
- `persona_anchors`
- `awareness_stages`
- `job_titles`
- `search_intent`
- `buying_committee_notes`
- `exclusions`
- `generated_at`

The schema requires at least one `persona_anchors[]`, `awareness_stages[]`,
`job_titles[]`, and `search_intent[]` entry. Do not satisfy those floors with
guesses. If a required floor cannot be sourced after collection, stop and report
the source gap instead of emitting a fabricated valid artifact.

## Collection Plan

Run the research as parallel lanes when possible:

- **Persona lane** - customer stories, product pages, docs, case studies, role
  pages, careers pages, and integration pages that reveal buyer or user groups
- **Awareness lane** - pages showing ordinary workflow friction, named pain,
  category/solution evaluation, named product evaluation, pricing, migration,
  admin, security, or procurement readiness
- **Title lane** - customer quotes, job posts, customer stories, docs, careers
  pages, partner pages, and implementation pages that name concrete roles
- **Intent lane** - source-backed query patterns tied to documented problems,
  category terms, implementation workflows, pricing pages, comparison pages, or
  named alternatives
- **Committee lane** - enterprise, pricing, admin, security, procurement,
  integration, onboarding, and rollout sources that show buying stakeholders
- **Exclusion lane** - negative keywords, unrelated same-name entities,
  unsupported segments, and category boundaries that prevent false positives

Every factual claim must include `source_url` and `retrieved_at`. Prefer direct
company sources and named customer stories. Use third-party pages only when
they clarify titles, alternatives, comparisons, or exclusions and do not
contradict first-party evidence.

## Persona Anchors map to `persona_anchors`

Create persona anchors as role-family groups, not fictional named personas.

Each persona anchor needs:

- `persona_name`: a plain role-group label grounded in evidence
- `role_family`: department or function, such as Engineering, Product, RevOps,
  Security, Finance, Operations, Marketing, Customer Success, or Founder
- `seniority`: include only when the source supports it
- `company_context`: sourced context about team type, scale, workflow,
  operating model, segment, or adoption context
- `pains`: sourced problems, friction, manual work, risk, delays, visibility
  gaps, compliance needs, or coordination failures
- `triggers`: sourced events that create urgency, such as growth, migration,
  new leadership, tool consolidation, launch cycles, compliance review,
  workflow breakdown, customer volume, or planning moments
- `objections`: sourced barriers, migration effort, admin requirements,
  security/procurement needs, pricing/package concerns, adoption risks, feature
  gaps, or incumbent lock-in
- `current_alternatives`: sourced incumbent tools, manual workflows,
  spreadsheets, internal systems, agencies, point solutions, or status quo
  workarounds

Do not invent demographic traits, psychographics, motivations, personality
labels, or persona priority ranks.

## Awareness Evidence maps to `awareness_stages`

Collect evidence for any of these stages that can be sourced:

- `unaware`: the source shows the problem embedded in normal work before the
  buyer names the category
- `problem_aware`: the source names a pain, risk, workflow breakdown, or
  unmet need
- `solution_aware`: the source shows category, workflow, or solution-class
  evaluation
- `product_aware`: the source shows evaluation of the named product, its
  customer proof, docs, features, integrations, comparisons, or alternatives
- `most_aware`: the source shows readiness details such as pricing, security,
  enterprise features, admin controls, migration, procurement, or rollout

For each stage, write `message_implication` as a short derived implication from
the evidence inside that same stage object. It can synthesize what the sourced
evidence means for messaging, but it must not introduce new factual claims.

## Job Titles map to `job_titles`

Collect concrete job titles from public sources. Good sources include customer
stories, quoted speaker titles, docs that name admin or owner roles, careers
pages, partner pages, integration setup docs, and implementation guides.

Set `buying_role` to one of:

- `economic_buyer`
- `champion`
- `user`
- `technical_evaluator`
- `procurement`
- `influencer`

Use the least speculative label. If a source only proves usage, label the role
as `user`. If a source proves configuration or evaluation but not budget
ownership, use `technical_evaluator` or `champion`, not `economic_buyer`.

## Search Intent maps to `search_intent`

Create query patterns from collected evidence, not from generic keyword ideas.
Each row must map to one intent:

- `problem`
- `solution`
- `category`
- `competitor`
- `implementation`
- `pricing`

The `source_url` should justify why the query pattern exists. Examples:

- a pricing page can justify a pricing query pattern
- an integration doc can justify an implementation query pattern
- a customer story can justify a problem or solution query pattern
- an alternatives or comparison page can justify a competitor query pattern
- a product/category page can justify a category query pattern

`likely_persona` must match a `persona_name` when possible. If a query is
broader than one persona, use the closest sourced role group.

## Buying Committee maps to `buying_committee_notes`

Collect notes only when the source shows buying, rollout, governance, adoption,
approval, security, procurement, admin, implementation, or expansion context.
Useful sources include pricing pages, enterprise pages, security pages, admin
docs, integration permissions, onboarding docs, customer stories, and migration
guides.

Do not turn every user role into a buying committee member. The note must show
why the stakeholder matters to purchase, approval, rollout, or adoption.

## Exclusions map to `exclusions`

Record sourced reasons to exclude:

- unrelated entities with the same or similar name
- results matching `ingest_identity.negative_keywords`
- broad markets that do not match the locked category
- job titles or departments unsupported by evidence
- customer segments that the product explicitly does not serve
- competitor, investor, academic, or media meanings that pollute search results

When in doubt, put ambiguity in `exclusions` with source evidence instead of
silently smoothing it over.

## Final Validation

Before returning output, run:

```bash
cd skills/research-icp
npm run validate -- <path-to-output.json>
npm run sanity-check -- <path-to-output.json>
```

For fixture verification, run:

```bash
cd skills/research-icp
npm test
```
