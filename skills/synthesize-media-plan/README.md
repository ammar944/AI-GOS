# synthesize-media-plan

Sourced media-plan synthesis for AIGOS v3 Wave 3. The skill receives a locked GTM brief plus required upstream research outputs and returns a strict `generate-media-plan` JSON artifact.

## Contract

- Input schema: `schemas/input.ts`
- Output schema: `schemas/output.ts`
- Deterministic gates: `scripts/validate.ts`, `scripts/sanity-check.ts`, `scripts/validate-budget-gates.ts`, `scripts/validate-removed-fields.ts`, `scripts/validate-snapshot.ts`
- References: `references/block-prompts.md`, `references/guardrails.md`, `references/rules.md`

## Local Verification

```bash
npm install
npm run check
npm run validate
npm run sanity-check example/output.json
npm run orchestrate -- example
```

`npm run orchestrate -- example` validates `example/input.json` and `example/output.json`, rewrites the final output deterministically, and runs every local gate.
