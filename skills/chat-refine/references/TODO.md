# references/

Loaded-on-demand material for this skill. Per Anthropic conventions, keep references **one level deep from SKILL.md** (no nested references across files).

Expected contents:

- `input-schema.ts` — Zod schema for the user's input payload
- `output-schema.ts` — Zod schema for the agent's typed output (every field must carry `source_url` + `retrieved_at`)
- `collector.md` — main agent prompt template
- `subagent-*.md` — per-subagent prompt templates (if this skill fans out)
- `rules.md` — hard constraints referenced from SKILL.md

Delete this file once contents exist.
