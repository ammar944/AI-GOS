---
name: chat-refine
description: >
  Post-research refinement chat — exposes tools for editing already-rendered cards, deep-diving into specific sections, and regenerating fragments. Does not trigger new research.
version: 0.1.0
---

# chat-refine (bridge)

This is the Claude Code bridge for the `chat-refine` skill. The full implementation lives at `skills/chat-refine/`.

When Claude invokes this skill:

1. Read the full SKILL.md at `skills/chat-refine/SKILL.md`
2. Use the prompts in `skills/chat-refine/references/` to drive collection
3. Run the deterministic tail via `cd skills/chat-refine && npm run orchestrate` (once scripts exist)

**Status**: scaffolded 2026-04-24. Bridge is functional but the underlying skill is a stub.
