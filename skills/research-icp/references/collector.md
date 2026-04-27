# Collector prompt - research-icp

You are collecting buyer ICP evidence for the AIGOS `research-buyer-icp` stage. Return only data that maps to `schemas/output.ts`.

Every collection instruction maps to one output key.

## Input handling maps to `run_id`, `brief_snapshot_id`, `company_name`, `category`

Read the sealed input. Use the locked GTM brief fields as context. If `ingest_identity` is present, use only canonical company name, canonical domain, category, core keywords, and negative keywords. Do not import facts from memory or prior accounts.

## Persona anchor discovery maps to `persona_anchors`

Find externally visible buyer/user groups. For each persona anchor, collect:

- `persona_name`: plain role group name.
- `role_family`: department or function.
- `seniority`: only if the source supports it.
- `company_context`: sourced context about company type, team shape, scale, or workflow.
- `pains`: sourced problems or friction points.
- `triggers`: sourced events that create buying or evaluation urgency.
- `objections`: sourced barriers, admin requirements, migration concerns, pricing concerns, or adoption limits.
- `current_alternatives`: sourced existing tools, workflows, or status quo alternatives.

## Awareness-stage evidence search maps to `awareness_stages`

Collect evidence for all five stages when possible:

- `unaware`: public evidence that a team may have the problem embedded in normal work.
- `problem_aware`: evidence of named pain or workflow breakdown.
- `solution_aware`: evidence that the buyer searches for a category or workflow solution.
- `product_aware`: evidence that the buyer compares or evaluates the named product.
- `most_aware`: evidence of pricing, enterprise, security, migration, or adoption readiness.

For each stage, write `message_implication` as a derived implication from the evidence in that same object. Do not add unsourced factual claims to `message_implication`.

## Job-title sourcing maps to `job_titles`

Collect job titles from public job posts, customer stories, customer quotes, documentation roles, or public profile snippets. Include department, seniority, and buying role only when supported by source context.

## Search-intent inference maps to `search_intent`

Create query patterns from the evidence found. Each row must map to one intent:

- `problem`
- `solution`
- `category`
- `competitor`
- `implementation`
- `pricing`

The source should justify why the query pattern exists, such as a docs page, integration page, pricing page, or public search result.

## Buying-committee notes maps to `buying_committee_notes`

Collect sourced notes about admins, executives, product leaders, engineering leaders, security/procurement, or cross-functional stakeholders. Use notes only when the source shows buying, rollout, governance, adoption, or approval context.

## Exclusions maps to `exclusions`

Record sourced reasons to exclude unrelated entities, irrelevant roles, unsupported segments, or ambiguous same-name results. Respect negative keywords from `ingest_identity`.

## Final validation

Before returning output, run:

```bash
npm run validate
npm run sanity-check example/output.json
```

For a run artifact, replace `example/output.json` with the run output path.
