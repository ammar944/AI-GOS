---
name: synthesize-scripts
description: >
  Ad script synthesis — generates ICM-structured 60/30/10 ad scripts from research and positioning inputs.
version: 0.1.0
---

# synthesize-scripts (bridge)

This is the Claude Code bridge for the `synthesize-scripts` skill. The full implementation lives at `skills/synthesize-scripts/`.

When Claude invokes this skill:

1. Read the full SKILL.md at `skills/synthesize-scripts/SKILL.md`
2. Use the prompts in `skills/synthesize-scripts/references/` to drive collection
3. Run the deterministic tail via `cd skills/synthesize-scripts && npm run orchestrate` (once scripts exist)

**Status**: scaffolded 2026-04-24. Bridge is functional but the underlying skill is a stub.
