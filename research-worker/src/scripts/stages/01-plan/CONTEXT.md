# stages/01-plan — Layer 2 (Stage Contract)

Stage A of the script pipeline. Deterministic. Zero AI tokens.

## Inputs

`PlannerInput`:
- `objections: string[]` — top ICP objections, used to assign objection-handling to scripts
- `proofPointCount: number` — how many proof points are available; drives sliding-window proof rotation
- `claimCount: number` — how many extracted claims are available; drives claim assignment
- `hasCompetitorAds: boolean` — informational
- `hasCaseStudies: boolean` — informational

Optional second arg: `seed?: number`. Default seed is content-derived (`deriveSeed(input)` → stable hash). **Never use `Date.now()`** — the planner must be reproducible.

## Process

`buildScriptMatrix(input, seed?)` produces 15 `ScriptPlan` rows by deterministic distribution:

1. 3 scripts per awareness level (5 levels × 3 = 15).
2. Platforms rotated within each level (`meta`, `google`, `linkedin`).
3. Formats rotated within each level (`video`, `static`, `email`).
4. Angles round-robin across all 7; no two scripts in same level share an angle.
5. Frameworks shuffled by seed; distributed across the batch.
6. Sub-segments only assigned to in-market tier (4-way rotation).
7. Objections assigned to ~60% of scripts (objection-first framework always gets one).
8. Proof points assigned via modulo if available.
9. Claims spread across scripts in chunks of 1–3.

`validateMatrixDiversity(plans)` returns a list of violations (empty = good). Used as a sanity check downstream.

## Checkpoints

- [ ] Same input → same matrix (asserted in `__tests__/planner.test.ts`).
- [ ] No two scripts in the same level share an angle or platform.
- [ ] Framework count ≥ 4 distinct.
- [ ] All 15 plans have non-null `awarenessLevel`, `platform`, `format`, `framework`, `angle`.

## Outputs

`ScriptPlan[]` of length 15. Each `ScriptPlan` contains everything Stage B needs to write a single script: angle, platform, format, framework, tier, sub-segment, objection (or null), proof index, claim indices, duration.

## Forbidden

- Calling AI from this stage.
- Using `Date.now()`, `Math.random()`, or any non-deterministic source as the framework seed.
- Mutating the input object.
