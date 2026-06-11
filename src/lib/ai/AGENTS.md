# AGENTS.md - src/lib/ai

## Purpose

- Owns app-level AI provider configuration, AI helpers, prompts, and AI tool wrappers outside the in-process lab engine.

## Ownership

- `providers.ts` owns first-party AI SDK provider setup, models, and costs.
- `prompts/` owns prompt definitions and positioning skill IDs consumed by other domains.
- `tools/` owns AI tool wrappers for dispatch/research helpers.

## Local Contracts

- Use first-party provider packages already in the repo: `@ai-sdk/anthropic`, `@ai-sdk/deepseek`, `@ai-sdk/perplexity`, and `@ai-sdk/openai-compatible` where already established.
- Do not add OpenRouter.
- Preserve Vercel AI SDK v6 message/tool patterns.
- Validate tool inputs and outputs before use.
- Do not invent model capability, pricing, or source data.

## Work Guidance

- Keep model/provider changes centralized.
- When prompt IDs or section IDs change, update lab-engine, research-v2, API routes, renderers, and tests that consume them.

## Verification

- Run `npm run test:run -- src/lib/ai`.
- For dispatch tool changes, also run relevant `src/lib/journey` and `src/app/api/research-v2` tests.

## Child DOX Index

- No child `AGENTS.md` files yet.
