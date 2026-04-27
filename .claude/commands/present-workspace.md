---
description: Invoke the present-workspace skill
argument-hint: <input-spec>
---

# /present-workspace

Workspace presentation — takes skill outputs and renders them into journey workspace cards. No collection, no validation; purely a renderer.

## Arguments

```
/present-workspace <input-spec>
```

Replace `<input-spec>` with:

- A URL (e.g. `https://airtable.com/`) — the skill resolves identity and proceeds
- Or a path to a sealed JSON payload matching `skills/present-workspace/references/input-schema.ts`

## Workflow

When invoked, Claude should:

1. Read `skills/present-workspace/SKILL.md` for the full behavior spec
2. Read `skills/present-workspace/references/collector.md` for the main agent prompt
3. Collect via native tools, fan out to subagents as specified
4. Run the deterministic tail: `cd skills/present-workspace && npm run orchestrate <run_id>`
5. Surface the HTML report path back to the user

## Status

Scaffolded 2026-04-24. Underlying skill is a stub — behavior must be implemented before this command produces real output.
