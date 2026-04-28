---
description: Invoke the research-cross skill
argument-hint: <input-spec>
---

# /research-cross

Cross-section synthesis — reads outputs of other research skills (ingested as input fixtures) and produces a unified insights brief. No new collection.

## Arguments

```
/research-cross <input-spec>
```

Replace `<input-spec>` with:

- A URL (e.g. `https://airtable.com/`) — the skill resolves identity and proceeds
- Or a path to a sealed JSON payload matching `skills/research-cross/references/input-schema.ts`

## Workflow

When invoked, Claude should:

1. Read `skills/research-cross/SKILL.md` for the full behavior spec
2. Read `skills/research-cross/references/collector.md` for the main agent prompt
3. Collect via native tools, fan out to subagents as specified
4. Run the deterministic tail: `cd skills/research-cross && npm run validate && npm run sanity-check <output.json>`
5. Surface the HTML report path back to the user

## Status

Scaffolded 2026-04-24. Implemented 2026-04-28.
