---
description: Invoke the research-offer skill
argument-hint: <input-spec>
---

# /research-offer

Offer diagnostic — analyzes an offer's clarity, activation flow, pricing reality, and churn signals from public artifacts. Every claim sourced.

## Arguments

```
/research-offer <input-spec>
```

Replace `<input-spec>` with:

- A URL (e.g. `https://airtable.com/`) — the skill resolves identity and proceeds
- Or a path to a sealed JSON payload matching `skills/research-offer/references/input-schema.ts`

## Workflow

When invoked, Claude should:

1. Read `skills/research-offer/SKILL.md` for the full behavior spec
2. Read `skills/research-offer/references/collector.md` for the main agent prompt
3. Collect via native tools, fan out to subagents as specified
4. Run the deterministic tail: `cd skills/research-offer && npm run check && npm run validate && npm run sanity-check <output.json>`
5. Surface the HTML report path back to the user

## Status

Scaffolded 2026-04-24. Underlying skill is a stub — behavior must be implemented before this command produces real output.
