---
description: Invoke the ingest-fathom skill
argument-hint: <input-spec>
---

# /ingest-fathom

Fathom meeting-call intake — fetches a Fathom recording by ID, extracts speakers, key moments, objections, and decisions into a structured sales-call intelligence block.

## Arguments

```
/ingest-fathom <input-spec>
```

Replace `<input-spec>` with:

- A URL (e.g. `https://airtable.com/`) — the skill resolves identity and proceeds
- Or a path to a sealed JSON payload matching `skills/ingest-fathom/references/input-schema.ts`

## Workflow

When invoked, Claude should:

1. Read `skills/ingest-fathom/SKILL.md` for the full behavior spec
2. Read `skills/ingest-fathom/references/collector.md` for the main agent prompt
3. Collect via native tools, fan out to subagents as specified
4. Run the deterministic tail: `cd skills/ingest-fathom && npm run validate && npm run sanity-check <output.json>`
5. Surface the HTML report path back to the user

## Status

Implemented 2026-04-28
