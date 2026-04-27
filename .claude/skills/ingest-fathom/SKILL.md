---
name: ingest-fathom
description: >
  Fathom meeting-call intake — fetches a Fathom recording by ID, extracts speakers, key moments, objections, and decisions into a structured sales-call intelligence block.
version: 0.1.0
---

# ingest-fathom (bridge)

This is the Claude Code bridge for the `ingest-fathom` skill. The full implementation lives at `skills/ingest-fathom/`.

When Claude invokes this skill:

1. Read the full SKILL.md at `skills/ingest-fathom/SKILL.md`
2. Use the prompts in `skills/ingest-fathom/references/` to drive collection
3. Run the deterministic tail via `cd skills/ingest-fathom && npm run orchestrate` (once scripts exist)

**Status**: scaffolded 2026-04-24. Bridge is functional but the underlying skill is a stub.
