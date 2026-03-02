# Model Selection Strategy

Default to the cheapest model that can do the job. Escalate when needed.

## Haiku (cheap, fast — use for 60% of work)
- Reading code and reporting findings
- Simple file edits (rename, move, delete)
- Running tests and reporting results
- Grep/search operations
- Code formatting and linting fixes
- Research subagents

## Sonnet (balanced — use for 30% of work)
- Writing new components and features
- Implementing API routes
- Writing tests
- Bug fixes that require understanding context
- Frontend agents, backend agents, QA agents

## Opus (expensive, powerful — use for 10% of work)
- Multi-file architectural changes
- Complex AI pipeline work (generator, chat agent)
- Security-critical code review
- Cross-cutting refactors that touch 5+ files
- When Sonnet has failed twice on the same task

## In Practice
- Subagents (`researcher.md`): Always Haiku
- Feature agents (`frontend.md`, `backend.md`, `qa.md`): Sonnet
- Lead/Architect decisions: Opus
- Agent Teams orchestrator: Opus (coordinates others)
- Quick fixes and formatting: Haiku
