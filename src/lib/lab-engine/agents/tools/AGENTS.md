# AGENTS.md - src/lib/lab-engine/agents/tools

## Purpose

- Owns live research tools used by in-process lab sections: ad libraries, keyword/SEO probes, pagespeed, reviews, web fetch/search, and related normalization.

## Ownership

- Each tool module owns its provider call, input validation, output normalization, error context, and tests.
- Tool registry wiring is owned by the parent agents folder.

## Local Contracts

- Tool output is evidence, not prose. Preserve source URLs, query params, provider names, and timestamps where available.
- Do not fabricate results for empty or failed provider responses.
- External API retries must be bounded and throw the final error with provider/status context.
- Avoid logging secrets, API keys, cookies, or direct personal contact/payment data.

## Work Guidance

- Keep provider-specific parsing isolated.
- Prefer typed normalized outputs over ad hoc strings.
- Make cost/rate-limit behavior explicit when adding paid provider calls.

## Verification

- Run targeted tests for the changed tool and `npm run test:run -- src/lib/lab-engine/agents` when behavior affects section execution.

## Child DOX Index

- No child `AGENTS.md` files yet.
