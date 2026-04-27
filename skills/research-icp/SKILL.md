---
name: research-icp
description: Use when running AIGOS buyer ICP research, persona anchor discovery, awareness-stage evidence collection, job-title sourcing, buying-committee mapping, or search-intent research for a locked GTM brief. The agent collects sourced facts and then runs deterministic TypeScript validation from this skill folder.
---

# Section 05 - Buyer ICP Research

## Trigger
`@research-icp { "run_id": "...", "brief_snapshot_id": "...", "stage": "research-buyer-icp", "gtm_brief": { ... } }`

## What it does
Takes a sealed locked GTM brief and returns a sourced ICP research card for `research-buyer-icp`: persona anchors, awareness stages, job titles, search intent, buying-committee notes, and exclusions. Every factual claim carries `source_url` and `retrieved_at`. Unsourceable fields are omitted or emitted as empty arrays.

## Boundaries
This skill does not resolve company identity, size the market, research competitors, mine broad Voice of Customer, generate positioning, create media plans, write scripts, render UI, or persist data. Adjacent skills own those jobs:

- `ingest-identity`: canonical company, domain, category, core keywords, negative keywords.
- `research-market`: category framing and market context.
- `research-competitor`: competitor landscape, pricing, reviews, ads, and share of voice.
- `research-voc`: category-scoped customer language.
- `research-cross`, `synthesize-positioning`, `synthesize-media-plan`: downstream synthesis.

## Workflow
1. Parse the input against `schemas/input.ts`.
2. Read `references/rules.md` and `references/collector.md`.
3. Use public sources to collect evidence for each output key.
4. Respect `ingest_identity.negative_keywords`; exclude unrelated same-name entities.
5. Write a JSON object matching `schemas/output.ts`.
6. Run `npm run validate`.
7. Run `npm run sanity-check <output.json>`.
8. Return the validated JSON to the caller.

## Tools
- `web_search`: find public sources, job posts, docs, customer pages, integrations, and search-result evidence.
- `browser_navigate` and `browser_snapshot`: inspect source pages when available.
- `Bash(npm run validate)` and `Bash(npm run sanity-check <output.json>)`: deterministic gates.
- File write tools: write only inside the run directory or this skill folder when updating fixtures.

## Hard constraints
1. Facts only. No recommendations, campaign plans, positioning rewrites, or creative ideas.
2. No LLM scores, confidence percentages, TAM estimates, persona importance scores, or fabricated metrics.
3. Every factual claim must include `source_url` and `retrieved_at`.
4. If a value cannot be sourced, omit it or use an empty array. Never write `unknown`, `TBD`, `n/a`, scaffold text, or placeholders.
5. Keep this skill self-contained. Do not import from `src/`, `research-worker/`, root `lib/`, or another skill.
6. Use prior `ingest-identity` output only for canonical company name, domain, category, core keywords, and negative keywords.
7. Use prior `research-market` output only for category framing. The skill must still work without it.
8. External fetch or search failures must throw with provider, query, status, and run id.

## Output
The output schema is `researchIcpOutputSchema` in `schemas/output.ts`.

Top-level fields:

- `run_id`
- `brief_snapshot_id`
- `stage: "research-buyer-icp"`
- `company_name`
- `category`
- `persona_anchors`
- `awareness_stages`
- `job_titles`
- `search_intent`
- `buying_committee_notes`
- `exclusions`
- `generated_at`

Every factual nested object uses the shared source primitive:

```ts
{
  source_url: string;
  retrieved_at: string;
}
```

## Verification gate
Before declaring the skill output usable:

```bash
npm run check
npm run validate
npm run sanity-check example/output.json
```

All commands must pass without `ALLOW_SUSPECT=1`.
