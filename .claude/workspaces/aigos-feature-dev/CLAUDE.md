# AIGOS Feature Dev Workspace — Layer 0

This workspace applies Jake Van Clief's ICM (Interpreted Context Methodology) to AIGOS feature development. A "feature" is any half-day+ piece of work.

## The Five Stages

Every feature flows through five stages. Each stage has its own `CONTEXT.md` (Layer 2). Do not skip stages.

1. **01-discover** — What is the ask? What's in scope? What's NOT in scope? Who owns each affected surface?
2. **02-plan** — Atoms (small concrete tasks), model assignments, budgets, verification criteria.
3. **03-build** — Execute the atoms. One atom = one subagent dispatch with a stated budget.
4. **04-verify** — Build, tests, manual check, spec match (per `.claude/rules/verification.md`).
5. **05-ship** — PR, deploy, monitor, document.

## Canonical Sources

- Root `CLAUDE.md` — project conventions and architecture.
- `.claude/rules/verification.md` — verification gate (MANDATORY).
- `.claude/rules/exploration-budget.md` — every subagent dispatch MUST state a time + tool-call cap.
- `.claude/rules/bug-triage.md` — production bug Step Zero.
- `.claude/rules/model-selection.md` — Haiku/Sonnet/Opus assignment.
- `.claude/rules/context-management.md` — when to `/clear` and `/compact`.
- `.claude/rules/ai-sdk-patterns.md` — Vercel AI SDK v6 gotchas.
- `.claude/rules/learned-patterns.md` — bug-fix patterns learned over time.

## Do-NOT-Load

These paths are almost always noise for feature work. Do not load them unless the feature explicitly touches them:
- `node_modules/**`
- `.next/**`
- `research-worker/node_modules/**`
- `*.lock`
- `.claude/usage-data/**`

## Skill Wrapping Rule

Skills (e.g. `/design`, `/review`, `/qa`) bypass this pipeline. If a skill is needed on a half-day+ task, 01-discover's output MUST define the scope BEFORE the skill is invoked. Never invoke a skill directly on week+ work.
