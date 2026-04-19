# scripts/ — Layer 0 (Module Contract)

The script pipeline. Single ICM-shaped implementation that turns research context into 15 platform-grouped ad scripts.

## Entry point

`pipeline.ts` exports `runScriptPipeline(input: PipelineInput) → DynamicCreativePackage`.

The worker calls this from `research-worker/src/index.ts` `/api/scripts` handler. The output is written to the `script_packs` Supabase table; the Next.js frontend reads it via realtime.

## Three-stage architecture

```
Stage A — Plan        (deterministic, 0 AI tokens)
  ↓ ScriptPlan[15]   (matrix: angle × platform × framework × tier)
  ↓ ExtractedClaim[] (citable, source-attributed claims menu)

Stage B — Write       (one generateObject() call per awareness level)
  ↓ 5 calls × 3 scripts = 15 raw scripts

Stage C — Quality Gate (deterministic, 0 AI tokens)
  ↓ AssembledScript[] (sanitized, deduped, dash-stripped, scored)

DynamicCreativePackage  (frontend-ready bundle: scripts + variants + creative sets)
```

## Frontend contract

The output `DynamicCreativePackage` shape is consumed by `src/components/scripts/**`. **Do not change its shape.** If you need to evolve the output, coordinate with the frontend in a separate feature.

## Module rules

- All shared sub-types (`ProofPoint`, `StyleReference`, `BrandVoiceNotes`, `PipelineInput`) live in `types.ts`.
- Post-processing utilities (`sanitizeScript`, `dedupScripts`, `getProofSubset`, `detectUsedProofPoints`) live in `utils/post-process.ts`. They are pure — no AI, no I/O.
- Stage modules (`stages/01-plan`, `stages/02-claims`, `stages/03-write`, `stages/05-quality-gate`) own their own logic. Cross-stage state is passed as function arguments — no shared mutable state.
- Tests live in `__tests__/` and target stage modules + post-process utilities directly.

## Do-NOT-Load

When working in this module, do not load these — they are out of scope and waste context:

- `node_modules/**`, `research-worker/node_modules/**`, `.next/**`, `*.lock`
- `src/components/scripts/**` (frontend — see frontend contract above)
- `research-worker/src/runners/{industry,icp,competitors,offer,keywords,synthesize,media-plan,meeting-extract}.ts`
- Any other research-worker runner — they share no code with this module

## Common pitfalls

- The pipeline is **synchronous per level** by design. Cross-level dedup tracking (`usedAnglesAndHooks`, `usedProofPoints`) requires sequential execution. Do not parallelize across awareness levels.
- The planner is **deterministic** — same input produces same matrix. The seed is derived from input content, not `Date.now()`. Do not reintroduce wall-clock seeds.
- Stage B (creative-writer) is the only AI call site. Quality gate is mechanical — never call AI from `quality-gate.ts`.
