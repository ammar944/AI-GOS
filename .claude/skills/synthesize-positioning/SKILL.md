---
name: synthesize-positioning
description: >
  Positioning synthesis — transforms research inputs into a positioning statement with villain and hero and transformation arc. Facts-in, narrative-out.
version: 0.1.0
---

# synthesize-positioning (bridge)

This is the Claude Code bridge for the `synthesize-positioning` skill. The full implementation lives at `skills/synthesize-positioning/`.

When Claude invokes this skill:

1. Read the full SKILL.md at `skills/synthesize-positioning/SKILL.md`
2. Use the prompts in `skills/synthesize-positioning/references/` to drive collection
3. Run the deterministic tail via `cd skills/synthesize-positioning && npm run orchestrate` (once scripts exist)

**Status**: scaffolded 2026-04-24. Bridge is functional but the underlying skill is a stub.
