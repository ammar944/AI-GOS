---
name: present-workspace
description: >
  Workspace presentation — takes skill outputs and renders them into journey workspace cards. No collection, no validation; purely a renderer.
version: 0.1.0
---

# present-workspace (bridge)

This is the Claude Code bridge for the `present-workspace` skill. The full implementation lives at `skills/present-workspace/`.

When Claude invokes this skill:

1. Read the full SKILL.md at `skills/present-workspace/SKILL.md`
2. Use the prompts in `skills/present-workspace/references/` to drive collection
3. Run the deterministic tail via `cd skills/present-workspace && npm run orchestrate` (once scripts exist)

**Status**: scaffolded 2026-04-24. Bridge is functional but the underlying skill is a stub.
