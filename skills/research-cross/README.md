# research-cross

Cross-analysis synthesis for the AIGOS v3 `synthesize-strategy` stage.

This skill reads the locked GTM brief plus seven completed upstream skill outputs and returns a sourced cross-analysis card: overlaps, contradictions, research gaps, high-confidence themes, and readiness blockers.

It is self-contained and does not import from the app, worker, or other skills. It performs no web research and calls no external APIs.

## Running standalone

```bash
cd skills/research-cross
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

Every finding must be derived from at least two upstream skills and every evidence/provenance object must include `source_url` and `retrieved_at`. Missing required upstream outputs fail the run; partial cross-analysis cards are not valid.
