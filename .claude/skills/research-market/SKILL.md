---
name: research-market
description: >
  Market and category research — fans out subagents to collect TAM signals, category maturity, timing, and competitive intensity. Agent collects. TypeScript validates and renders.
version: 0.1.0
---

# research-market (bridge)

This is the Claude Code bridge for the `research-market` skill. The full implementation lives at `skills/research-market/`.

When Claude invokes this skill:

1. Read the full SKILL.md at `skills/research-market/SKILL.md`
2. Use the prompts in `skills/research-market/references/` to drive collection
3. Run the deterministic tail via `cd skills/research-market && npm run orchestrate` (once scripts exist)

**Status**: scaffolded 2026-04-24. Bridge is functional but the underlying skill is a stub.
