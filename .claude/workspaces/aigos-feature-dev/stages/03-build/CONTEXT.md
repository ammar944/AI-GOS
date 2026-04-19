# Stage 03 — Build

## Inputs

- Plan table from 02-plan.

## Process

Execute atoms in dependency order. For each atom:

1. State the atom's budget in the dispatch prompt (time + tool-call cap + output format).
2. Dispatch to the assigned model tier.
3. On completion, run the atom's verification criterion.
4. If verification fails, STOP — do not dispatch the next atom. Log the failure in the audit section and decide: fix and retry, or bounce back to 02-plan.

## Checkpoints

- [ ] Every atom was dispatched with a stated budget.
- [ ] No atom silently ran over its budget.
- [ ] Every atom's verification passed before the next started.
- [ ] `/clear` or `/compact` between unrelated atoms if context is filling up.

## Audit

Record per atom:
- Actual time taken
- Actual tool-call count
- Verification pass/fail
- Any patterns worth adding to `.claude/rules/learned-patterns.md`

## Outputs

- Code changes on disk.
- Updated notes file with per-atom audit entries.
- Handoff to `stages/04-verify/`.

## Forbidden

- Dispatching subagents without a budget.
- Skipping verification between atoms.
- "Just one more thing" additions outside the 02-plan atoms. (Add them to a new feature or go back to 01-discover.)
