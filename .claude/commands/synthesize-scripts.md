---
description: Invoke the synthesize-scripts skill
argument-hint: <input-spec>
---

# /synthesize-scripts

Ad script synthesis — generates ICM-structured 60/30/10 ad scripts from research and positioning inputs.

## Arguments

```
/synthesize-scripts <input-spec>
```

Replace `<input-spec>` with:

- A URL (e.g. `https://airtable.com/`) — the skill resolves identity and proceeds
- Or a path to a sealed JSON payload matching `skills/synthesize-scripts/references/input-schema.ts`

## Workflow

When invoked, Claude should:

1. Read `skills/synthesize-scripts/SKILL.md` for the full behavior spec
2. Read `skills/synthesize-scripts/references/collector.md` for the main agent prompt
3. Collect via native tools, fan out to subagents as specified
4. Run the deterministic tail: `cd skills/synthesize-scripts && npm run orchestrate <run_id>`
5. Surface the HTML report path back to the user

## Status

Scaffolded 2026-04-24. Underlying skill is a stub — behavior must be implemented before this command produces real output.
