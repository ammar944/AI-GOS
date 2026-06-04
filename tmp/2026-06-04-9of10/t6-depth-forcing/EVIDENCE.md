# T6 Depth-Forcing Skills Evidence

Date: 2026-06-04
Branch: feat/research-quality-truthgate
Scope: shared GTM Strategic Standard preamble + schema-gated strategic verdict fields

## Code Changes

- Added a shared `GTM Strategic Standard` preamble and inject it ahead of every lab skill loaded through `loadLabSkill`.
- Added a common `strategicInsight` schema with `strategicVerdict`, `nonObviousRead`, `secondOrderImplication`, and `keyTension`.
- Added section-specific strategic fields:
  - Market Category: `categoryPowerBet`.
  - Competitor Landscape: `whereToAttackVsConcede` and `incumbentBlindSpot`.
  - Voice of Customer: `fourForcesBalanceVerdict`.
  - Demand Intent: sequenced `orderedMoves` and `provesWrongIf`.
  - Offer Diagnostic: `singleBindingConstraint`, sequenced `orderedMoves`, and `provesWrongIf`.
- Updated section SKILL output shapes and prompt minimums so the model must produce strategic judgment, not just framework summaries.
- Added validation that rejects generic strategic filler, repeated strategic fields, and restatements of `verdict` / `statusSummary`.
- Preserved the VoC honest evidence-gap path by allowing `strategicInsight` and `fourForcesBalanceVerdict` in the committed gap body.
- Added Audit Reader strategic insight panels and renderer coverage for new fields while preserving legacy-artifact compatibility.

## Verification

- Targeted T6 suite passed: 16 files, 140 tests.
- Final full suite after the validator fix passed: `pnpm run test:run`
  - 177 files passed
  - 1507 tests passed
  - 1 skipped
- `pnpm exec tsc --noEmit` passed after the validator fix.
- `pnpm run build` passed.
- `pnpm run lint` passed with 0 errors and 32 existing warnings.

## QA

- Read-only QA first pass: NO-GO because the first validator only rejected narrow "This section summarizes" filler and could still accept generic/repeated strategic fills.
- Fix applied: strategic validators now reject broad generic filler, duplicate strategic fields, and near-restated verdict/status-summary text; `provesWrongIf.window` accepts concise windows like `Q1` and `14d`.
- Read-only QA re-review: GO. QA confirmed generic/repeated fills and verdict-summary restatements are rejected, and concise falsifiability windows pass.

## Remaining Gate

- Live section run is still pending; this is a code-gate pass only.
