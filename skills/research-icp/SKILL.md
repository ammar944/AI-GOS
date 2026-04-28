---
name: research-icp
description: >
  Buyer and ICP research - discovers sourced persona anchors, awareness-stage
  evidence, job titles, buying-committee notes, search intent, objections,
  triggers, and exclusions for a locked GTM Brief. Agent collects. TypeScript
  validates and sanity-checks.
version: 0.1.0
---

# research-icp

## What this skill does

Produces a sourced buyer/ICP artifact for the AIGOS `research-buyer-icp`
stage. The input is a sealed run payload with a locked GTM Brief snapshot and
optional prior outputs from `ingest-identity` and `research-market`. The agent
collects public evidence about who buys or uses the product, what work context
they operate in, what pain creates urgency, what current alternatives exist,
what objections slow adoption, how awareness differs by stage, what job titles
appear in sourced material, what search-intent patterns are defensible, and
which irrelevant segments or same-name entities must be excluded.

The typed JSON is the source of truth. Claude writes `output.json`; the local
TypeScript scripts validate the schema and enforce deterministic integrity
checks.

## Trigger

```
/research-icp <input-spec>
```

Use this skill after the GTM Brief has been reviewed and locked. The correct
input matches `schemas/input.ts` and includes:

- `run_id`
- `brief_snapshot_id`
- `stage: "research-buyer-icp"`
- `gtm_brief`
- optional `ingest_identity`
- optional `research_market`

Defer to adjacent skills when the request is outside buyer/ICP evidence:

- company identity, domain, category, core keywords, and negative keywords
  belong upstream to `ingest-identity`
- category framing, market timing, category maturity, and market-size signals
  belong to `research-market`
- direct competitor lists, pricing, ads, reviews, and share-of-voice belong to
  `research-competitor`
- broad customer-language mining and objection quote banks belong to
  `research-voc`
- offer diagnosis, positioning, media plans, scripts, and strategy belong to
  downstream synthesis skills

## Tools used

- `web_search` for public customer stories, role pages, docs, pricing pages,
  help-center pages, integration docs, job posts, comparison pages, and search
  result evidence
- browser inspection tools when a search result needs direct source
  confirmation
- local shell commands for `npm run check`, `npm run validate`, and
  `npm run sanity-check <output.json>`
- file writes inside the current run directory for `output.json`

## Workflow (ICM runtime sub-stages)

Every invocation follows these stages:

1. **Receive** - parse the sealed payload against `schemas/input.ts`. Treat the
   locked GTM Brief as immutable run context.
2. **Scope** - derive the buyer-research scope from company name, company URL,
   category, product description, target customer, primary ICP, company size,
   job-title hints, buying-committee hints, pain fields, triggers,
   alternatives, awareness level, objections, and optional market framing.
3. **Anchor** - use `ingest_identity` only for canonical company name,
   canonical domain, category, core keywords, and negative keywords. Use
   negative keywords to filter same-name or adjacent-topic false positives.
4. **Collect** - gather public evidence for persona anchors, awareness stages,
   job titles, search intent, buying-committee notes, and exclusions. Every
   factual claim must include `source_url` and `retrieved_at`.
5. **Separate** - keep buyer evidence distinct from market sizing, broad VoC,
   competitor analysis, offer critique, and strategy. If a source supports only
   a market or competitor claim, leave that claim out unless it directly
   explains buyer role, pain, trigger, adoption, evaluation, or exclusion.
6. **Project** - populate the output contract from collected evidence. Required
   arrays with schema floors must contain real sourced evidence; if the run
   cannot source a required floor, stop and report the source gap instead of
   fabricating a valid-looking artifact.
7. **Validate** - run `scripts/validate.ts` and `scripts/sanity-check.ts` from
   this skill folder before returning the output.

## Schema reference

- Input: `schemas/input.ts`
- Output: `schemas/output.ts`
- Collector prompt: `references/collector.md`
- Collection rules: `references/rules.md`
- Fixtures: `example/input.json`, `example/output.json`

## Hard constraints

- Facts only. No recommendations, campaign plans, positioning rewrites,
  creative hooks, budget guidance, or strategy.
- No LLM scores, confidence percentages, persona priority scores, TAM/SAM
  estimates, fabricated metrics, or ranking language.
- Every factual claim must carry `source_url` and `retrieved_at`.
- Do not write placeholders such as `unknown`, `TBD`, `n/a`, empty strings,
  scaffold text, TODO text, or sample filler.
- If optional nested evidence cannot be sourced, omit the field when the schema
  allows it or emit an empty array. Do not invent filler to satisfy shape.
- Use prior `ingest_identity` only for identity anchors and exclusions. Use
  prior `research_market` only for category framing. The skill must still work
  without `research_market`.
- URL-only input is not enough for this skill. It must run on a sealed payload
  matching `schemas/input.ts`.
- Keep the skill portable and self-contained. Do not import from `src/`,
  `research-worker/`, root `lib/`, or another skill.
- External fetch or search failures must be surfaced with provider, query,
  status when available, and run id.

## Output

The primary output is `researchIcpOutputSchema` from `schemas/output.ts`:

- run metadata: `run_id`, `brief_snapshot_id`, `stage`, `generated_at`
- subject context: `company_name`, `category`
- sourced buyer artifact: `persona_anchors`, `awareness_stages`,
  `job_titles`, `search_intent`, `buying_committee_notes`, `exclusions`

`persona_anchors[]` groups public evidence into role-family anchors. Each
anchor includes company context, pains, triggers, objections, and current
alternatives. `awareness_stages[]` maps sourced observations to the five
awareness stages and derives a message implication only from evidence in that
same object. `job_titles[]` records sourced titles with buying role labels.
`search_intent[]` records defensible query patterns tied to source evidence,
not invented keyword ideas. `buying_committee_notes[]` captures sourced
rollout, governance, procurement, security, admin, or approval context.
`exclusions[]` captures sourced reasons to exclude unrelated entities,
unsupported segments, or ambiguous same-name results.

## Verification gate

Before declaring the skill output usable:

```bash
cd skills/research-icp
npm run check
npm run validate
npm run sanity-check <output.json>
```

For fixture verification, use `npm test`, which runs check, validate, and
sanity-check against `example/output.json`. All commands must pass without
`ALLOW_SUSPECT=1`.
