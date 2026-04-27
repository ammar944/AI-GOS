---
name: chat-refine
description: >
  Post-research refinement chat — exposes tools for editing already-rendered cards, deep-diving into specific sections, and regenerating fragments. Does not trigger new research.
version: 0.1.0
---

# chat-refine

> **Status**: scaffolded 2026-04-24. **This SKILL.md is a stub.** Replace the TODO sections before this skill is run for real. Canonical shape modelled on `skills/research-competitor/SKILL.md`.

## What this skill does

TODO — one-paragraph summary of the skill's contract: input → output, what the agent does vs. what TypeScript does.

## Trigger

```
/chat-refine <arguments>
```

TODO — describe when Claude should invoke this skill vs. defer to another.

## Tools used

TODO — list the native agent tools this skill is permitted to use. Examples:

- `web_search` — discovery
- `browser_navigate` + `browser_snapshot` — source pages
- `Bash(npx tsx scripts/*)` — deterministic validate/render tail
- `Write(example/**)` + `Write(/tmp/chat-refine-run/**)` — fragment writing

## Workflow (ICM runtime sub-stages)

Every invocation runs these five sub-stages:

1. **Receive** — parse input against `references/input-schema.ts`
2. **Collect** — agent (+ fan-out subagents per `references/subagent-*.md`) gather facts; every field carries `source_url` + `retrieved_at`
3. **Validate** — `scripts/validate.ts` runs Zod, `scripts/sanity-check.ts` runs integrity gates
4. **Render** — `scripts/generate-report.ts` writes HTML + JSON into the run directory
5. **Present** — bridge surfaces the output to the workspace (card or chat message)

## Schema reference

- Input: `references/input-schema.ts`
- Output: `references/output-schema.ts`
- Agent prompts: `references/collector.md`, `references/subagent-*.md`
- Report templates: `assets/report-shell.html`, `assets/styles.css`
- Fixture: `example/input.json`, `example/output.json`

## Hard constraints

- Facts only. No LLM-scored metrics ("7/10" style).
- Every field carries `source_url` + `retrieved_at`. Unsourceable fields are omitted, never hallucinated.
- No recommendations. Insights, not opinions.
- Skill is self-contained: no imports from outside `skills/chat-refine/`.

## Output

TODO — describe what the skill produces: the output JSON shape at a high level, and what the HTML report looks like.
