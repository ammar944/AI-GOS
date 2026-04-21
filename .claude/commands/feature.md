---
description: Start a day-sized or week+ feature. Wraps skills and enforces the 5-stage feature-dev pipeline.
---

# /feature

Entry point for any `day` or `week+` classification. Also used to wrap `/design`, `/review`, `/ship`, `/qa` when those skills are invoked on larger-than-10-min work (per `CLAUDE.md` skill-invocation rule).

## What this command does

1. Treats the user's ask as the input to **stage 01 (discover)**.
2. Creates a working note at `.claude/workspaces/aigos-feature-dev/stages/01-discover/notes/<feature-slug>.md`.
3. Answers the six scoping questions from `.claude/workspaces/aigos-feature-dev/stages/01-discover/CONTEXT.md` BEFORE reading any source.
4. Updates `.claude/workspaces/aigos-feature-dev/CONTEXT.md` with the active feature + stage.
5. Moves through 02 → 03 → 04 → 05 as each stage's checkpoints pass.

## Arguments

- `<feature-slug>` (required) — kebab-case short name, e.g. `chat-retry`, `profile-scripts-tab`.
- `[wrapped-skill]` (optional) — the skill you want to run AFTER discover sets scope, e.g. `/design`, `/review`.

## Forbidden during `/feature` stage 01

- Reading source files. (Discover is scoping only.)
- Dispatching subagents. (No exploration until scope is fixed.)
- Invoking the wrapped skill before 01 checkpoints pass.

## Gate to leave each stage

Each stage's `CONTEXT.md` lists explicit checkpoints. You MUST satisfy every checkpoint before moving on. If a checkpoint fails, say so and stop — do not advance.

## When NOT to use `/feature`

- `quick-question`, `10-min-fix`, `half-day` — these skip the pipeline. Just answer or implement.
- `production-bug` — run `.claude/rules/bug-triage.md` Step Zero first, not this command.
- `beast-mode` — orthogonal. If the user combined `/beast` with `/feature`, apply both.
