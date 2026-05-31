# Learned Patterns

> Add non-obvious solutions here as you discover them.
> Format: "When X happens, do Y because Z"
> Prune monthly — remove patterns unused for 4+ weeks.

## AI SDK
- When `MissingToolResultsError` fires, sanitize incomplete tool parts from messages BEFORE calling `convertToModelMessages()` — the function is strict about tool call/result pairing
- When transport mismatches cause silent failures, check: `toUIMessageStreamResponse()` needs `DefaultChatTransport`, `toTextStreamResponse()` needs `TextStreamChatTransport`
- When `maxTokens` doesn't work, use `maxOutputTokens` instead — AI SDK v6 renamed this

## Next.js
- When API routes timeout on Vercel, add `export const maxDuration = 300` (requires Pro tier)
- When SSE events aren't received by frontend, check event name casing — backend and frontend must match exactly

## Anthropic API / generateObject
- When Anthropic rejects a schema with `properties maximum, minimum are not supported`, remove `.min()` / `.max()` from Zod number fields in schemas passed to `generateObject()`. Use `.describe()` to communicate the range to the model, and add post-processing validation for enforcement. `.min()` / `.max()` are fine in contracts/validation schemas that don't go to the API.

## Testing
- Pre-existing TS errors in openrouter tests and chat blueprint tests are expected — don't try to fix them
- When Vitest tests fail with import errors, check `vitest.config.ts` path aliases match `tsconfig.json`
- When changing a section's `allowedTools` in `section-registry.ts`, `section-registry.test.ts` ("Phase D bounded in-section tool contract") pins each section's EXACT allowedTools array (order-sensitive via `toMatchObject`) — update it in the same change, and include `section-registry.test.ts` in your targeted test run (the parity + skill-resolution tests do NOT catch an allowedTools change; only the contract test does). (P1.3, 2026-05-31)
- For a credential-gated feature whose validator hard-rejects a fallback (e.g. demand-intent rejecting "not disclosed"), VERIFY the credential is funded with ONE probe call BEFORE wiring the hard-reject — a present-but-unfunded key would make the section hard-fail. Scrub the key from all probe output (monkeypatch console). (P1.3, 2026-05-31)

## Handoff hygiene
- When writing a handoff that touches `research-worker/`, run `cd research-worker && npm run build` and capture ITS baseline BEFORE writing the doc — the worker has its own pre-existing errors (express/apify missing `@types/*` as of 2026-05-11) that don't show in the frontend `npx tsc` count. Inheriting the frontend baseline as the worker gate produces false "build clean" reports.
- When a kill list deletes a source file that's referenced from a barrel/registry, the kill list MUST explicitly include "remove imports from `index.ts`, remove entries from `TOOL_RUNNERS` map, remove variants from `ToolName` union, and any other registry" as separate sub-items. Deleting the source file alone leaves dangling references and breaks the worker build on next compile (caught in Phase 7 Cluster B — handoff said "edit 2 files," reality needed 4+).
- When deleting components or modules, include their `__tests__/*.test.ts*` files in the kill list. The tsc gate must NOT pass `__tests__/` hits through unconditionally — orphan tests emit `TS2307 cannot find module` once their targets are gone, silently failing the baseline check (Phase 7 needed 2 extra cleanup commits to sweep orphan tests).
- When a handoff specifies file paths, verify each via `find src -name '<basename>'` BEFORE writing the path into the doc. Sketched paths cause execution drift — e.g. Phase 7 handoff said "workspace/dispatch-client.ts" but the only `dispatch-client.ts` lived in `src/lib/`, and Cluster A.3 (deleting an API route) is what orphaned it; the executor had to hunt for the right file and add it as a follow-up commit.
