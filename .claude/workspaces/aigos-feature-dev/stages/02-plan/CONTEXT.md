# Stage 02 — Plan

## Inputs

- `notes/<feature-slug>.md` from 01-discover (all six questions answered).

## Process

Decompose the feature into **atoms**. An atom is:

- **One concrete task** (e.g. "add `run_id` column to `research_runs` table", not "fix the research flow").
- **Owned by one model tier** (Haiku / Sonnet / Opus per `.claude/rules/model-selection.md`).
- **Budgeted** — time cap and tool-call cap per `.claude/rules/exploration-budget.md`.
- **Verifiable** — a specific check that says "this atom is done".

Write the plan as a table in `notes/<feature-slug>.md` under a `## Plan` heading:

| # | Atom | Model | Budget | Verification |
|---|------|-------|--------|--------------|
| 1 | ... | Haiku | 5m / 30 calls | `tsc` clean |
| 2 | ... | Sonnet | 15m / 50 calls | Vitest passes |

## Checkpoints

- [ ] Every atom names exactly one file or one narrow surface.
- [ ] Every atom has a model assignment and a budget.
- [ ] Every atom has a verification criterion.
- [ ] Cross-cutting atoms (touching 5+ files) are assigned to Opus.
- [ ] Plan covers the success criteria from 01-discover — nothing more.

## Audit

Record:
- Total atom count
- Estimated total time
- Which atoms are dependencies of which (if any)

## Outputs

- Plan table in `notes/<feature-slug>.md`.
- Handoff to `stages/03-build/`.

## Forbidden

- Writing code. (Planning only.)
- Atoms that say "refactor X" without naming the specific change.
- Atoms without a verification criterion.
