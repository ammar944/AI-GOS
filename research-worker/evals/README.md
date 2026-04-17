# Research Pipeline Eval Harness (Phase 0.1)

Regression detection for the research pipeline. Captures snapshots of known-good
runs and diffs future runs against them to catch silent quality drift.

## Layout

```
evals/
  golden/
    urls.json                   # seed URLs with expected categories
    <slug>/
      metadata.json             # runId, snapshot date, pipeline commit
      sections/
        industryMarket.json
        icpValidation.json
        competitors.json
        ... (one per section)
      cards/
        opportunityIntel.json
        whiteSpaceGapIntel.json
        offerStatementIntel.json
        strategicSynthesisIntel.json
  snapshot.ts                   # capture a run into golden/<slug>/ from Supabase
  diff.ts                       # compare a live run against a golden snapshot
  run-eval.ts                   # CLI — runs the full golden set, reports pass/fail
```

## Adding a URL to the golden set

1. Run the pipeline through to completion in prod or staging for the URL.
2. Grab the `run_id` from the `journey_sessions` row.
3. Capture the snapshot:
   ```bash
   cd research-worker
   npm run eval:snapshot -- --slug fellow-ai --run-id <run_id> --user-id <user_id>
   ```
4. Commit the generated `golden/fellow-ai/` directory.

## Running the eval

```bash
npm run eval:research
```

Reports per-URL:
- Field-level recall vs. snapshot (target: ≥ 90%)
- Citation count per card (target: ≥ 3)
- Fabrication flags (target: 0)
- Sections that regressed to `status=error` or `status=gated` from previously `complete`

Exit code non-zero on any hard regression.

## Gotchas

- **No live pipeline run**: this harness reads existing Supabase data. To trigger
  a fresh run for baseline measurement, use `baseline-run.ts` (Phase 0.5) which
  dispatches real research and costs real API credits.
- **Snapshots are point-in-time**: captured output reflects the pipeline version
  at that moment. Update snapshots intentionally after approved quality shifts.
- **Missing sections are soft failures**: if a section was never captured (e.g.,
  `mediaPlan` for an incomplete run), the diff skips it rather than failing.
