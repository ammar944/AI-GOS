# scripts/ — Layer 1 (Current State)

## Version

`pipelineVersion = '2.1.0-plan-write-gate'` (see `pipeline.ts` metadata block).

This is the only script pipeline. The legacy v1 (`runners/ad-scripts.ts`, `prompts/ad-scripts-pass{1,2}.ts`, `schemas/ad-scripts.ts`) was removed in the `scripts-icm-cleanup` feature on 2026-04-19.

## Layout

```
scripts/
├── CLAUDE.md            ← Layer 0: module contract + Do-NOT-Load
├── CONTEXT.md           ← Layer 1: this file (current state)
├── pipeline.ts          ← entry: runScriptPipeline()
├── types.ts             ← shared input/output types (PipelineInput, ProofPoint, …)
├── utils/
│   └── post-process.ts  ← sanitizeScript, dedupScripts, getProofSubset, detectUsedProofPoints
├── stages/
│   ├── 01-plan/         ← deterministic matrix planner
│   ├── 02-claims/       ← deterministic claim extractor
│   ├── 03-write/        ← single integrated AI creative call per level
│   └── 05-quality-gate/ ← deterministic post-AI gate (auto-fix or flag)
├── refs/                ← runtime-loaded reference data (kill list, char limits)
└── __tests__/           ← planner, claim-extractor, sanitize-scripts, quality-gate
```

Stage numbering preserves intent (no `04-*`; quality gate intentionally numbered 05) — the gap encodes that earlier 6-stage architectures were collapsed back into the 3-stage Plan-Write-Gate.

## What runs in production

Worker route: `POST /api/scripts` → `runScriptPipeline()` → progressive `writeScriptPackUpdate()` after each level → final write with full `DynamicCreativePackage`.

Frontend reads `script_packs` row via Supabase realtime; renders 15 scripts grouped by awareness level.

## Recent changes (2026-04-19)

- **scripts-icm-cleanup**: deleted v1 runner + prompts + schemas, deleted orphan stage dirs (`03-hooks/`, `04-body/`, `06-voice-polish/`), unified shared types into `types.ts`, moved post-processing utils into `utils/post-process.ts`, made the planner reproducible (content-derived seed instead of `Date.now()`), wrote ICM context layers (this file + per-stage CONTEXT.md).

## Tests

Run with `npx vitest run src/scripts` (from `research-worker/`). Coverage:

- `__tests__/planner.test.ts` — 16 tests (matrix shape, diversity rules, determinism)
- `__tests__/claim-extractor.test.ts` — 8 tests (extraction shape, source attribution)
- `__tests__/sanitize-scripts.test.ts` — 21 tests (dash stripping, confidence normalization, dedup fingerprints)
- `__tests__/quality-gate.test.ts` — 14 tests (auto-fix paths, severity classification)

Plus `src/__tests__/proof-rotation.test.ts` (13 tests) which targets the same utility module.
