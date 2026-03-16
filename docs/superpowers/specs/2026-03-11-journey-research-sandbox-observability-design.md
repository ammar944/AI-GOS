# Journey Research Sandbox Observability Design

**Date:** 2026-03-11

## Goal

Add a sandbox-only workflow that runs the first six Journey research sections sequentially on the same backend path as production, then surfaces a unified observability report showing section status, timings, worker logs, token usage, estimated cost, and charting output for `crossAnalysis`.

## Scope

- Sandbox only: `src/app/api/journey/dev/research-sandbox/*` and related UI/helpers
- Sections included:
  - `industryMarket`
  - `competitors`
  - `icpValidation`
  - `offerAnalysis`
  - `crossAnalysis`
  - `keywordIntel`
- Exclude `mediaPlan`
- Keep dispatch on the existing worker route and existing section-by-section contracts

## Architecture

### Sequence orchestration

The sandbox already dispatches one real worker job at a time. We will add a small orchestration layer around that:

- define a canonical sandbox sequence for the first six sections
- derive the next section context from sandbox results plus metadata using the same context builder logic already used for single-section runs
- dispatch each section using the existing sandbox `POST action=run`
- wait for each section to settle before dispatching the next

This keeps the sandbox on the same worker + Supabase path as production.

### Telemetry contract

The dashboard needs more than `status` and `updates`. We will extend worker persistence with optional telemetry:

- runner/model metadata
- token usage
- estimated cost
- section timing
- chart generation summary

Telemetry will be written alongside the existing job status / result payloads so the sandbox UI can render them without introducing a second backend.

### Unified report

The unified report is a derived sandbox view, not a new LLM artifact.

- source: validated sandbox results already stored in `journey_sessions.research_results`
- output: one consolidated dashboard/report card that shows each section’s artifact + telemetry summary
- do not synthesize new content beyond simple deterministic aggregation

## UI

The sandbox page becomes a dual-mode QA surface:

- keep the existing single-section controls
- add a `Run First Six Sections` action
- add a unified observability view with:
  - section-by-section run states
  - elapsed time / completion time
  - token and cost summaries
  - collapsed worker logs
  - chart thumbnails / URLs for synthesis charts
  - a parity note that the run uses the same worker dispatch path as production

## Testing

- helper tests for the first-six sequence and report aggregation
- route tests for the new sandbox action(s)
- UI tests for the unified observability rendering
- worker/app tests for telemetry normalization
- verify no code path bypasses the existing worker dispatch contract

## Non-goals

- no main Journey UX changes
- no media plan orchestration
- no alternate “sandbox-only” research backend
- no prompt-only fixups in place of telemetry / orchestration / validation
