# AIGOS v3 Migration Tracker

Wave 0 authors specs only. Each row below starts as `Stub`; move it through `Spec'd`, `Implementing`, `Validated`, `Wired`, `Reviewed`, and `Merged` as the skill becomes real. The tracker includes the 13 stub skills only. `research-competitor`, `ingest-identity`, and the partially built `research-market` are tracked outside this stub table.

| Skill | Wave | Status | Hybrid Choice | Owner | Notes |
| --- | ---: | --- | --- | --- | --- |
| `research-icp` | 1 | Validated | light | Codex gpt-5.5 (2026-04-27) | Buyer persona, awareness map, job titles, search intent. Skill-local check/validate/sanity-check pass on Linear fixture. |
| `research-offer` | 1 | Validated | light | Codex gpt-5.5 (2026-04-27) | Offer diagnostic; no funnel implementation in Wave 0. Skill-local gates pass on Linear fixture. |
| `research-cross` | 2 | Validated | light | Codex gpt-5.5 (2026-04-27) | Cross-analysis schema, sourced provenance gates, and no-outside-import sanity checks pass on Linear fixture. |
| `research-keywords` | 2 | Validated | heavy | Codex gpt-5.5 (2026-04-27) | Keyword normalization, provider gates, sourced output validation, and orchestrate pass on Linear fixture. |
| `research-voc` | 2 | Validated | heavy | Codex gpt-5.5 (2026-04-27) | Category VoC schema, competitor exclusion gates, leakage checks, and orchestrate pass on Linear fixture. |
| `synthesize-media-plan` | 3 | Validated | heavy | Codex gpt-5.5 (2026-04-27) | Media-plan schema, removed-field gates, budget gates, snapshot checks, and orchestrate pass on Linear fixture. |
| `synthesize-positioning` | 3 | Validated | light | Codex gpt-5.5 (2026-04-27) | Positioning synthesis schema, forbidden-claim gates, and no-outside-import sanity checks pass on Linear fixture. |
| `synthesize-scripts` | 3 | Validated | heavy | Codex gpt-5.5 (2026-04-27) | ICM matrix, claim extraction, quality gates, sourced script pack, and orchestrate pass on Linear fixture. |
| `chat-refine` | 4 | Spec'd | heavy | Unassigned | Bundles current chat tools as skill references. |
| `ingest-docs` | 4 | Validated | heavy | Codex gpt-5.5 (2026-04-27) | Document input schema, TXT/MD parser path, field catalog normalization, conflict preservation, and no-write gates pass on FieldOps fixture. |
| `ingest-fathom` | 4 | Validated | light | Codex gpt-5.5 (2026-04-27) | Sourced meeting intelligence schema, quote attribution gates, no-inferred-budget checks, and no-write gates pass on Fathom fixture. |
| `ingest-url` | 4 | Validated | heavy | Codex gpt-5.5 (2026-04-27) | URL cleanup, page filtering, field key normalization, sourced prefill output, and no-write gates pass on Linear fixture. |
| `present-workspace` | 4 | Validated | heavy | Codex gpt-5.5 (2026-04-27) | Card mapping, edit overlays, dry-run write receipt, idempotency checks, and mock-only write path pass on workspace fixture. |

## Status Meanings

- `Stub`: folder or slash-command placeholder exists; no executable contract.
- `Spec'd`: Wave 0 spec filled and reviewed.
- `Implementing`: code pass in progress.
- `Validated`: skill-local check, validate, and sanity gates pass on fixture.
- `Wired`: runtime dispatch can call the skill.
- `Reviewed`: human review complete.
- `Merged`: landed into the migration branch.

Research-market gets a finish spec separately because it is partially built, not one of the 13 stub rows.

## Finish-spec work (non-stub)

| Skill | Wave | Status | Hybrid Choice | Owner | Notes |
| --- | ---: | --- | --- | --- | --- |
| `research-market` | 1 | Validated | light | Codex gpt-5.5 (2026-04-27) | Finish/delta complete: SKILL.md rewritten, `stage` literal added, `ingest_identity` required in input, `no_outside_imports` sanity check added, `example/input.json` created. Skill-local gates pass. Legacy projection fields preserved. |
