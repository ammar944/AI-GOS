---
name: research-keywords
description: >
  Keyword and intent research — identifies high-intent search queries, content gaps, and related keywords. No fabricated volumes; every number sourced.
version: 0.1.0
---

# research-keywords (bridge)

This is the Claude Code bridge for the `research-keywords` skill. The full implementation lives at `skills/research-keywords/`.

When Claude invokes this skill:

1. Read the full SKILL.md at `skills/research-keywords/SKILL.md`
2. Use the prompts in `skills/research-keywords/references/` to drive collection
3. Run the deterministic tail via `cd skills/research-keywords && npm run orchestrate` (once scripts exist)

**Status**: scaffolded 2026-04-24. Bridge is functional but the underlying skill is a stub.
