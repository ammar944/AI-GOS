---
description: Invoke the chat-refine skill
argument-hint: <input-spec>
---

# /chat-refine

Post-research refinement chat — exposes tools for editing already-rendered cards, deep-diving into specific sections, and regenerating fragments. Does not trigger new research.

## Arguments

```
/chat-refine <input-spec>
```

Replace `<input-spec>` with:

- A URL (e.g. `https://airtable.com/`) — the skill resolves identity and proceeds
- Or a path to a sealed JSON payload matching `skills/chat-refine/references/input-schema.ts`

## Workflow

When invoked, Claude should:

1. Read `skills/chat-refine/SKILL.md` for the full behavior spec
2. Read `skills/chat-refine/references/collector.md` for the main agent prompt
3. Collect via native tools, fan out to subagents as specified
4. Run the deterministic tail: `cd skills/chat-refine && npm run orchestrate <run_id>`
5. Surface the HTML report path back to the user

## Status

Implemented 2026-04-28.
