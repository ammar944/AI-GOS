---
name: research-cross
description: >
  Cross-section synthesis — reads outputs of other research skills (ingested as input fixtures) and produces a unified insights brief. No new collection.
version: 0.1.0
---

# research-cross (bridge)

This is the Claude Code bridge for the `research-cross` skill. The full implementation lives at `skills/research-cross/`.

When Claude invokes this skill:

1. Read the full SKILL.md at `skills/research-cross/SKILL.md`
2. Use the prompts in `skills/research-cross/references/` to drive collection
3. Run the deterministic tail via `cd skills/research-cross && npm run orchestrate` (once scripts exist)

**Status**: scaffolded 2026-04-24. Bridge is functional but the underlying skill is a stub.
