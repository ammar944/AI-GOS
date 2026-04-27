---
name: ingest-docs
description: >
  User-uploaded business document intake — parses PDFs and DOCX files the user provides, extracts structured business-profile fields into reusable context.
version: 0.1.0
---

# ingest-docs (bridge)

This is the Claude Code bridge for the `ingest-docs` skill. The full implementation lives at `skills/ingest-docs/`.

When Claude invokes this skill:

1. Read the full SKILL.md at `skills/ingest-docs/SKILL.md`
2. Use the prompts in `skills/ingest-docs/references/` to drive collection
3. Run the deterministic tail via `cd skills/ingest-docs && npm run orchestrate` (once scripts exist)

**Status**: scaffolded 2026-04-24. Bridge is functional but the underlying skill is a stub.
