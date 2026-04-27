---
name: research-voc
description: >
  Voice-of-customer mining — collects reviews, Reddit, HN, and publication signal. Extracts verbatim customer language with source_url and retrieved_at.
version: 0.1.0
---

# research-voc (bridge)

This is the Claude Code bridge for the `research-voc` skill. The full implementation lives at `skills/research-voc/`.

When Claude invokes this skill:

1. Read the full SKILL.md at `skills/research-voc/SKILL.md`
2. Use the prompts in `skills/research-voc/references/` to drive collection
3. Run the deterministic tail via `cd skills/research-voc && npm run orchestrate` (once scripts exist)

**Status**: scaffolded 2026-04-24. Bridge is functional but the underlying skill is a stub.
