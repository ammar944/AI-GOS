---
name: research-icp
description: >
  Buyer and ICP research — discovers persona anchors, awareness stages, job titles, pains, and purchase triggers from public sources. Fan-out pattern, sourced output.
version: 0.1.0
---

# research-icp (bridge)

This is the Claude Code bridge for the `research-icp` skill. The full implementation lives at `skills/research-icp/`.

When Claude invokes this skill:

1. Read the full SKILL.md at `skills/research-icp/SKILL.md`
2. Use the prompts in `skills/research-icp/references/` to drive collection
3. Run the deterministic tail via `cd skills/research-icp && npm run orchestrate` (once scripts exist)

**Status**: scaffolded 2026-04-24. Bridge is functional but the underlying skill is a stub.
