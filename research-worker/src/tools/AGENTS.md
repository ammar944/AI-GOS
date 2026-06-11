# AGENTS.md - research-worker/src/tools

## Purpose

- Owns worker-side provider integrations and normalized tool calls.

## Ownership

- Each tool module owns its provider request, response validation, normalized output, and error context.

## Local Contracts

- Preserve source URLs, provider metadata, and query context in normalized outputs.
- Do not fabricate data when providers return empty responses.
- Paid/external API loops need explicit bounds and abort conditions.
- Do not log secrets or sensitive raw credentials.

## Work Guidance

- Keep provider-specific parsing isolated from runner orchestration.
- Add tests or eval coverage for changed provider behavior when feasible.

## Verification

- Run targeted worker tests and `cd research-worker && npm run build`.

## Child DOX Index

- No child `AGENTS.md` files yet.
