# ingest-fathom

Fathom meeting ingestion for the AIGOS v3 `enrich-brief` stage.

This skill validates sourced sales-call intelligence extracted from a Fathom recording. It emits a meeting evidence block for downstream brief and research skills. It is self-contained and does not import from the app, worker, root libraries, or other skills.

## Running standalone

```bash
cd skills/ingest-fathom
npm install
npm run check
npm run validate
npm run sanity-check example/output.json
```

## Contract

- Input schema: `schemas/input.ts`
- Output schema: `schemas/output.ts`
- Collection prompt: `references/collector.md`
- Deterministic rules: `references/rules.md`

Every factual claim must carry `source_url` and `retrieved_at`. Transcript facts require speaker-attributed quote evidence where the schema marks `evidence` as required. Missing facts should be omitted or represented by empty arrays, never placeholders.
