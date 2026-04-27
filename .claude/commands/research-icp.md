---
description: Invoke the research-icp skill
argument-hint: <input-spec>
---

# /research-icp

Buyer and ICP research — discovers persona anchors, awareness stages, job titles, pains, and purchase triggers from public sources. Fan-out pattern, sourced output.

## Arguments

```
/research-icp <input-spec>
```

Replace `<input-spec>` with:

- A URL (e.g. `https://airtable.com/`) — the skill resolves identity and proceeds
- Or a path to a sealed JSON payload matching `skills/research-icp/references/input-schema.ts`

## Workflow

When invoked, Claude should:

1. Read `skills/research-icp/SKILL.md` for the full behavior spec
2. Read `skills/research-icp/references/collector.md` for the main agent prompt
3. Collect via native tools, fan out to subagents as specified
4. Run the deterministic tail: `cd skills/research-icp && npm run validate && npm run sanity-check <output.json>`
5. Surface the HTML report path back to the user

## Status

Scaffolded 2026-04-24. Underlying skill is a stub — behavior must be implemented before this command produces real output.
