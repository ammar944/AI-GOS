---
name: ingest-url
description: >
  URL intake — takes a URL, resolves company metadata, writes a prefilled field-catalog payload used as the start of a journey. Agent-collected via web_search + browser tools. TypeScript validates schema + renders review.
version: 0.1.0
---

# ingest-url (bridge)

This is the Claude Code bridge for the `ingest-url` skill. The full implementation lives at `skills/ingest-url/`.

When Claude invokes this skill:

1. Read the full SKILL.md at `skills/ingest-url/SKILL.md`
2. Use the prompts in `skills/ingest-url/references/` to drive collection
3. Run the deterministic tail via `cd skills/ingest-url && npm run orchestrate` (once scripts exist)

**Status**: scaffolded 2026-04-24. Bridge is functional but the underlying skill is a stub.
