---
name: synthesize-scripts
description: Produce a sourced ICM ad script pack from a locked GTM brief and prior research outputs.
version: 1.0.0
---

# synthesize-scripts

## Contract

Generate the `generate-scripts` stage output for AIGOS v3. The skill consumes a locked GTM brief plus required upstream outputs from `research-voc`, `research-icp`, `research-offer`, and `synthesize-positioning`; optional context can come from `synthesize-media-plan`, `research-competitor`, and `research-keywords`.

The output is a sourced ad script pack with 9 to 15 scripts. Each selected awareness tier gets exactly 3 scripts. Every script has a 60/30/10 logical structure: hook, middle, and CTA.

## Boundaries

- Do not collect new research.
- Do not create positioning from scratch.
- Do not build the media plan.
- Do not write Supabase rows, realtime callbacks, UI files, slash commands, or bridge files.
- Do not import from `src/`, `research-worker/`, root libraries, or another skill.
- Do not copy competitor hooks into finished copy.

## Inputs

Use `schemas/input.ts`. The locked brief must include:

- company and category identity
- ICP pains, triggers, objections, and awareness level
- core promise, key promises, tone, common objections, and forbidden claims
- sourced testimonials, case studies, metrics, claims, and style references
- required upstream outputs with sourced claims

Reject placeholders such as `unknown`, `TBD`, `n/a`, `scaffold`, or `TODO`.

## Workflow

1. Validate `input.json` with `scripts/validate.ts`.
2. Extract sourced claims from the brief and upstream artifacts with `scripts/extract-claims.ts`.
3. Build a deterministic ICM matrix with `scripts/build-matrix.ts`.
4. Write hook, middle, CTA, hook variants, and optional objection lines.
5. Run `scripts/quality-gate.ts`.
6. Validate and sanity-check the final `output.json`.

## Copy Rules

Follow `references/icm-rules.md` and `references/copy-rules.md`.

Hard constraints:

- Every hook, middle line, CTA, hook variant, and objection line must include `derived_from`.
- Every evidence item must include `source_url` and `retrieved_at`.
- Finished copy must not include unsupported proof, fake metrics, invented testimonials, forbidden claims, or copied competitor hooks.
- Quality gate must remove em dashes or fail, flag banned phrases and template openers, detect rule-of-three phrasing, flag corporate filler and chatbot closers, and fail platform character-limit violations.

## Local Commands

```bash
npm run check
npm run validate
npm run sanity-check example/output.json
npm run orchestrate -- example
```

## Inspected Legacy References

Implementation was modeled from these read-only references:

- `research-worker/src/scripts/pipeline.ts`
- `research-worker/src/scripts/types.ts`
- `research-worker/src/scripts/stages/01-plan/planner.ts`
- `research-worker/src/scripts/stages/02-claims/claim-extractor.ts`
- `research-worker/src/scripts/stages/03-write/creative-writer.ts`
- `research-worker/src/scripts/stages/05-quality-gate/quality-gate.ts`
- `src/lib/scripts/schemas.ts`
- `research-worker/src/schemas/gtm/script-pack.ts`

`research-worker/src/schemas/gtm/script-pack.ts` is placeholder-only, so this skill owns the canonical script-pack schema locally.
