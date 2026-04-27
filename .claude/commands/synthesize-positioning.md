---
description: Invoke the synthesize-positioning skill
argument-hint: <input-spec>
---

# /synthesize-positioning

Positioning synthesis — transforms research inputs into a positioning statement with villain and hero and transformation arc. Facts-in, narrative-out.

## Arguments

```
/synthesize-positioning <input-spec>
```

Replace `<input-spec>` with:

- A URL (e.g. `https://airtable.com/`) — the skill resolves identity and proceeds
- Or a path to a sealed JSON payload matching `skills/synthesize-positioning/references/input-schema.ts`

## Workflow

When invoked, Claude should:

1. Read `skills/synthesize-positioning/SKILL.md` for the full behavior spec
2. Read `skills/synthesize-positioning/references/collector.md` for the main agent prompt
3. Collect via native tools, fan out to subagents as specified
4. Run the deterministic tail: `cd skills/synthesize-positioning && npm run validate && npm run sanity-check <output.json>`
5. Surface the HTML report path back to the user

## Status

Scaffolded 2026-04-24. Underlying skill is a stub — behavior must be implemented before this command produces real output.
