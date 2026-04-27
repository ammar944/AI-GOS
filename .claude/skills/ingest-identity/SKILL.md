---
name: ingest-identity
description: >
  Identity resolution — given raw company data, resolves the canonical identity card: who they are, what they do, core keywords, negative keywords.
version: 0.1.0
---

# ingest-identity (bridge)

This is the Claude Code bridge for the `ingest-identity` skill. The full implementation lives at `skills/ingest-identity/`.

When Claude invokes this skill:

1. Read the full SKILL.md at `skills/ingest-identity/SKILL.md`
2. Use the prompts in `skills/ingest-identity/references/` to drive collection
3. Run the deterministic tail via `cd skills/ingest-identity && npm run orchestrate` (once scripts exist)

**Status**: scaffolded 2026-04-24. Bridge is functional but the underlying skill is a stub.
