---
name: research-offer
description: >
  Offer diagnostic — analyzes an offer's clarity, activation flow, pricing reality, and churn signals from public artifacts. Every claim sourced.
version: 0.1.0
---

# research-offer (bridge)

This is the Claude Code bridge for the `research-offer` skill. The full implementation lives at `skills/research-offer/`.

When Claude invokes this skill:

1. Read the full SKILL.md at `skills/research-offer/SKILL.md`
2. Use the prompts in `skills/research-offer/references/` to drive collection
3. Run the deterministic tail via `cd skills/research-offer && npm run orchestrate` (once scripts exist)

**Status**: scaffolded 2026-04-24. Bridge is functional but the underlying skill is a stub.
