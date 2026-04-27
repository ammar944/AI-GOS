---
description: Invoke the ingest-docs skill
argument-hint: <input-spec>
---

# /ingest-docs

User-uploaded business document intake — parses PDFs and DOCX files the user provides, extracts structured business-profile fields into reusable context.

## Arguments

```
/ingest-docs <input-spec>
```

Replace `<input-spec>` with:

- A URL (e.g. `https://airtable.com/`) — the skill resolves identity and proceeds
- Or a path to a sealed JSON payload matching `skills/ingest-docs/references/input-schema.ts`

## Workflow

When invoked, Claude should:

1. Read `skills/ingest-docs/SKILL.md` for the full behavior spec
2. Read `skills/ingest-docs/references/collector.md` for the main agent prompt
3. Collect via native tools, fan out to subagents as specified
4. Run the deterministic tail: `cd skills/ingest-docs && npm run orchestrate <run_id>`
5. Surface the HTML report path back to the user

## Status

Scaffolded 2026-04-24. Underlying skill is a stub — behavior must be implemented before this command produces real output.
