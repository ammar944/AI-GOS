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

## Testing
- Pre-existing TS errors in openrouter tests and chat blueprint tests are expected — don't try to fix them
- When Vitest tests fail with import errors, check `vitest.config.ts` path aliases match `tsconfig.json`
