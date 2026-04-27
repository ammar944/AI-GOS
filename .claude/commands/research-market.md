---
description: Invoke the research-market skill
argument-hint: <input-spec>
---

# /research-market

Market and category research — fans out subagents to collect TAM signals, category maturity, timing, and competitive intensity. Agent collects. TypeScript validates and renders.

## Arguments

```
/research-market <input-spec>
```

Replace `<input-spec>` with:

- A path to a sealed JSON payload matching `skills/research-market/schemas/input.ts`

URL-only input must go through `/ingest-url`, brief review, and brief locking
before `/research-market` runs.

## Workflow

When invoked, Claude should:

1. Read `skills/research-market/SKILL.md` for the full behavior spec
2. Read `skills/research-market/references/collector.md` for the main agent prompt
3. Collect via native tools, fan out to subagents as specified
4. Run the deterministic tail: `cd skills/research-market && npm run orchestrate <run_id>`
5. Surface the HTML report path back to the user

## Status

Scaffolded 2026-04-24. Underlying skill is a stub — behavior must be implemented before this command produces real output.
