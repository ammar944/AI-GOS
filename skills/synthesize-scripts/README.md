# synthesize-scripts

Wave 3 AIGOS v3 skill for the `generate-scripts` stage.

## What It Does

Produces a sourced ICM ad script pack from a locked GTM brief and upstream research outputs. It is self-contained: schemas, deterministic matrix planning, claim extraction, quality gates, references, and examples all live in this folder.

## Files

```text
skills/synthesize-scripts/
  SKILL.md
  README.md
  package.json
  tsconfig.json
  schemas/input.ts
  schemas/output.ts
  scripts/validate.ts
  scripts/sanity-check.ts
  scripts/orchestrate.ts
  scripts/build-matrix.ts
  scripts/extract-claims.ts
  scripts/quality-gate.ts
  references/icm-rules.md
  references/copy-rules.md
  references/platform-limits.json
  references/kill-list.json
  example/input.json
  example/output.json
```

## Commands

```bash
cd skills/synthesize-scripts
npm install
npm test
npm run orchestrate -- example
```

`npm test` runs typecheck, schema validation, and deterministic sanity checks.

## Runtime Shape

`scripts/orchestrate.ts <run_dir>` reads `<run_dir>/input.json`, generates `<run_dir>/output.json`, and fails on invalid input, invalid matrix shape, missing provenance, or blocking quality-gate issues.

The current implementation is deterministic and does not call external APIs. It expects upstream research skills to provide sourced claims before this stage runs.
