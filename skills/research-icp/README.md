# research-icp

Buyer ICP research for the AIGOS v3 `research-buyer-icp` stage.

This skill takes a sealed locked GTM brief and returns a sourced ICP research card: persona anchors, awareness stages, job titles, search intent, buying-committee notes, and exclusions. It is self-contained and does not import from the app, worker, or other skills.

## Running standalone

```bash
cd skills/research-icp
npm install
npm run check
npm run validate
npm run sanity-check example/output.json
```

## Contract

- Input schema: `schemas/input.ts`
- Output schema: `schemas/output.ts`
- Collection rules: `references/rules.md`
- Runtime prompt: `references/collector.md`

Facts must be sourced with `source_url` and `retrieved_at`. Unknown values are omitted or emitted as empty arrays, never filled with placeholders.
