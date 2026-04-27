# research-keywords

Demand-intent keyword research for the AIGOS v3 `research-demand-intent` stage.

This skill takes a sealed locked GTM brief plus the required `ingest-identity` output and returns a sourced demand-intent research card: high-intent query clusters, paid keyword opportunities, content gaps, negative keywords, excluded terms, provider coverage, and source gaps.

It is self-contained and does not import from the app, worker, root libs, or sibling skills.

## Running standalone

```bash
cd skills/research-keywords
npm install
npm run check
npm run validate
npm run sanity-check example/output.json
npm run orchestrate -- example
```

## Contract

- Input schema: `schemas/input.ts`
- Output schema: `schemas/output.ts`
- Normalizer: `scripts/normalize-keywords.ts`
- Provider gates: `scripts/provider-gates.ts`
- Collection rules: `references/rules.md`
- Runtime prompt: `references/collector.md`

Facts must be sourced with `source_url` and `retrieved_at`. Unknown or unavailable metric values are omitted and explained in `source_gaps`; never emit fake volume, CPC, competition, confidence, priority scores, recommended budgets, or placeholder text.

## Legacy paths inspected

- `research-worker/src/runners/keywords.ts`
- `research-worker/src/skills/keyword-campaign-skill.ts`
- `research-worker/src/schemas/gtm/research-sections.ts`
- `research-worker/src/schemas/gtm/gtm-run.ts`
