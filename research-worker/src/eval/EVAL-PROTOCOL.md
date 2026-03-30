# Ad Scripting Quality Eval Protocol

## Baseline (pre-changes)
- 12 scripts graded at C average (39/70)
- Source: `docs/baseline-output-saaslaunch-20260322.md`

## Post-Changes Eval Steps
1. Start worker: `cd research-worker && npm run dev`
2. Start app: `npm run dev` (in main directory)
3. Navigate to a profile with completed research
4. Go to Scripts tab, click "Generate New Batch"
5. Wait for all 15 scripts to generate (5 levels x 3 each)
6. Copy the generated scripts to `research-worker/src/eval/fixtures/improved-scripts.json`
7. Run `/grade-scripts` on the improved batch
8. Record scores and compare

## Target Deltas
- Em dash count: from ~25 across batch -> 0
- Angle duplication: from 4 duplicates -> 0
- Proof dimension: from 3/10 avg -> 5+/10 (with proof points added)
- Overall average: from 39/70 -> 48+/70 (C -> B)

## Changes Applied
1. Em dash kill list + sentence rhythm (Pass 1 + Pass 2)
2. ICP monologue extraction (Collier framework triggers)
3. Intelligence fields in trim (positioningMoves, audienceRefinements, etc.)
4. Previous angles context (dedup across levels)
5. Imported platform-specs.md + ad-copy-templates.md refs
6. Proof points pipeline (UI -> generate route -> worker -> prompt)
7. Pass 3 batch diversity validator
8. Diversity flags UI
