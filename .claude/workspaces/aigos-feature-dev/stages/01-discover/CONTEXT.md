# Stage 01 — Discover

**Entry point for every half-day+ feature.** Do not skip.

## Inputs

- The user's raw ask (one paragraph or less).
- Root `CLAUDE.md` — project conventions.
- Any linked tickets, screenshots, or prior work the user mentions.

## Process

Answer these six questions, in order, in a note at `notes/<feature-slug>.md`:

1. **Ask, in one sentence.** Rewrite the user's request precisely. No adjectives.
2. **Success criteria.** What's observably true when this is done? (list 2–5 bullets)
3. **In scope.** Which files, routes, or surfaces will change?
4. **Out of scope.** What looks related but is NOT part of this feature? Name it explicitly.
5. **Do-NOT-Load.** Which directories or files should subagents avoid? (in addition to workspace Layer 0 defaults)
6. **Size classification.** half-day / day / week+. Justify in one line.

## Checkpoints (must pass to leave 01)

- [ ] Ask is one sentence, no ambiguity.
- [ ] Out-of-scope list has at least one item. (If nothing is out of scope, you have not thought hard enough.)
- [ ] Size classification matches the work, not the ask. (A "quick rename" across 12 files is day-sized.)
- [ ] No source files have been read yet. Discover is a planning stage.

## Audit

Record in `notes/<feature-slug>.md`:
- Timestamp of discover completion
- Any assumptions made (flag them explicitly)
- One-line rationale for the size classification

## Outputs

- `notes/<feature-slug>.md` with the six answers above.
- Handoff to `stages/02-plan/` with the feature slug.

## Forbidden in this stage

- Reading source files. (You're scoping, not implementing.)
- Dispatching subagents. (No exploration until scope is fixed.)
- Invoking skills. (They bypass the pipeline.)
