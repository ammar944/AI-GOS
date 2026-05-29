# Codex Handoff — FE-2: Re-home section schemas, delete managed-agents/ entirely

> **Executor:** Codex (`-c model_reasoning_effort=xhigh -s workspace-write`). Edit files only — do NOT run git. Claude gates + commits.
> **Worktree:** `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire`. **Runs AFTER FE-1** (which deletes the managed-agents runtime but keeps `schemas/`).
> **Grounded in:** assessment slop item #4 (duplicate schemas; renderers type against the orphaned `managed-agents/schemas/`). Goal: the `managed-agents/` directory ceases to exist.

## CURRENT STATE (verified)
After FE-1, `src/lib/managed-agents/` contains only `schemas/` (7 files). These TYPES are imported (`import type`) by ~8 live files:
- `src/components/research-v2/typed-artifact-renderer.tsx` (6 type imports)
- `src/components/research-v2/section-renderers/{market-category,buyer-icp,competitor-landscape,voice-of-customer,demand-intent,offer-diagnostic}.tsx`
- `src/lib/research-v2/audit-artifact-view.ts`
- plus `section-renderers/__tests__/*` + `fixtures.ts`
The live engine emits `src/lib/lab-engine/artifacts/schemas` shapes; `normalizePickedArtifact` (`src/types/positioning-artifact.ts`) is the tested runtime boundary between engine output and renderer view-model.

## GOAL
Remove the `managed-agents/` directory completely while keeping renderers type-safe and `normalizePickedArtifact` intact. **Two acceptable end-states — pick per evidence, tsc must stay 0 with NO `as any`/`@ts-ignore`:**

- **Preferred (true single-source):** if the `managed-agents/schemas/*` types are structurally compatible with the `lab-engine/artifacts/schemas` equivalents (diff them), repoint the ~8 importers to the lab-engine schemas, delete `managed-agents/schemas/`, keep `normalizePickedArtifact` as the boundary.
- **Safe fallback (pure rehome):** if repointing to lab-engine would require casts or renderer changes (shapes diverge), MOVE `src/lib/managed-agents/schemas/` → `src/lib/research-v2/section-schemas/` unchanged (pure rename), repoint the ~8 import paths to the new location, and leave a one-line `// TODO(consolidate): unify with lab-engine/artifacts/schemas` at the top of each moved file.

Either way: `src/lib/managed-agents/` is fully deleted afterward.

## STEPS
1. Diff `managed-agents/schemas/{market-category,buyer-icp,competitor-landscape,voc-objection-evidence,demand-intent-signals,offer-performance-diagnostic}.ts` against the lab-engine artifact schemas to decide Preferred vs Fallback.
2. Apply the chosen path; repoint ALL importers (incl. `__tests__` + `fixtures.ts`).
3. Delete `src/lib/managed-agents/` (the whole dir — after schemas are rehomed and the FE-1 runtime is already gone).
4. `rg "@/lib/managed-agents" src` → **zero hits.**

## CONSTRAINTS
- tsc 0, lint 0, test:run green. No `as any`/`@ts-ignore`. `normalizePickedArtifact` behavior unchanged.
- Do NOT touch the lab engine schemas' shapes, the worker, or run-section. Do NOT run git.

## VERIFY (Claude re-runs)
```bash
cd /Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire
npx tsc --noEmit && npm run lint && npm run test:run
test -d src/lib/managed-agents && echo "FAIL: dir still exists" || echo "OK: managed-agents/ gone"
rg -l "@/lib/managed-agents" src   # expect: no output
```
## DONE WHEN
`src/lib/managed-agents/` no longer exists; all renderers type-check against the rehomed schemas; gates green; report which path (Preferred/Fallback) was taken and why.
