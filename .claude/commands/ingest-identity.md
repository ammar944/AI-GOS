---
description: Invoke the ingest-identity skill
argument-hint: <input-spec>
---

# /ingest-identity

Identity resolution — given raw company data, resolves the canonical identity card: who they are, what they do, core keywords, negative keywords.

## Arguments

```
/ingest-identity <input-spec>
```

Replace `<input-spec>` with:

- A URL (e.g. `https://airtable.com/`) — the skill resolves identity and proceeds
- Or a path to a sealed JSON payload matching `skills/ingest-identity/references/input-schema.ts`

## Workflow

When invoked, Claude should:

1. Read `skills/ingest-identity/SKILL.md` for the full behavior spec
2. Read `skills/ingest-identity/references/collector.md` for the main agent prompt
3. Collect via native tools, fan out to subagents as specified
4. Run the deterministic tail: `cd skills/ingest-identity && npm run orchestrate <run_id>`
5. Surface the HTML report path back to the user

## Status

Scaffolded 2026-04-24. Underlying skill is a stub — behavior must be implemented before this command produces real output.
