# research-offer

Wave 1 implementation for the AIGOS v3 `research-offer-funnel` stage.

The skill produces a strict, sourced offer diagnostic for a locked GTM brief. It covers offer path, public value props, proof, pricing signals, packaging notes, public objections, and source gaps. It does not score the offer, generate copy, recommend actions, or analyze ad creatives.

## Run Locally

```bash
npm install
npm run check
npm run validate
npm run sanity-check example/output.json
```

`npm run validate` checks `example/input.json` and `example/output.json` when no path is provided. Passing a path validates that file as an output fixture.

## Contract

- Input schema: `schemas/input.ts`
- Output schema: `schemas/output.ts`
- Runtime rules: `references/rules.md`
- Collector prompt: `references/collector.md`

This folder is self-contained by design. Do not import from the app, worker, root libraries, or another skill.
