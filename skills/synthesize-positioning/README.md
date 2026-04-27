# synthesize-positioning

Positioning synthesis for the AIGOS v3 `synthesize-strategy` stage.

This light skill takes a sealed locked GTM brief plus required upstream outputs from `ingest-identity`, `research-icp`, `research-offer`, and `research-cross`. It returns sourced positioning, ranked value props, a narrative arc, status-quo contrast, message angles, and blocked claims. It is self-contained and does not import from the app, worker, root libraries, or sibling skills.

## Running standalone

```bash
cd skills/synthesize-positioning
npm install
npm run check
npm run validate
npm run sanity-check example/output.json
```

## Contract

- Input schema: `schemas/input.ts`
- Output schema: `schemas/output.ts`
- Synthesis rules: `references/rules.md`
- Runtime prompt: `references/collector.md`

Every synthesis object must include `derived_from`. Every evidence item must include `source_url` and `retrieved_at`. Missing evidence is omitted or represented by an allowed empty array, never filled with placeholder text.

## Legacy drops

This skill intentionally does not emit legacy `platformRecommendations`, `readinessScorecard`, launch plans, scores, budgets, scripts, or keyword plans from the old strategic synthesis runner.
