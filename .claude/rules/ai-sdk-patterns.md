# AI SDK Patterns (Vercel AI SDK v6)

## Provider Rules
- ALL AI calls use `@ai-sdk/anthropic` and `@ai-sdk/perplexity` directly
- GLM-5.2 agentic research may use OpenRouter (`z-ai/glm-5.2`) via `@ai-sdk/openai-compatible` over `GLM_BASE_URL`/`GLM_MODEL_ID`/`GLM_API_KEY` (see ADR-0012). Other providers remain first-party only.
- Provider config lives in `src/lib/ai/providers.ts`

## Pattern Reference

| Use Case | Function | Notes |
|----------|----------|-------|
| Research (structured) | `generateObject()` | Always use Zod schema |
| Chat (streaming) | `streamText()` | + `toUIMessageStreamResponse()` |
| Onboarding suggestions | `streamObject()` | + `toTextStreamResponse()` |
| Bulk research | `streamObject()` | Streams structured company intel |

## Transport Matching (CRITICAL)
- `toUIMessageStreamResponse()` requires `DefaultChatTransport` on frontend
- `toTextStreamResponse()` requires `TextStreamChatTransport` on frontend
- Mismatching these causes silent failures

## Tool Definitions
- Use `inputSchema` (NOT `parameters`)
- Use `maxOutputTokens` (NOT `maxTokens`)
- Tool part types: `part.type = "tool-${TOOL_NAME}"`
- States: `input-streaming` → `input-available` → `approval-requested` → `approval-responded` → `output-available` | `output-error`

## Message Conversion
- `convertToModelMessages(messages)` is async
- Throws `MissingToolResultsError` if tool calls lack results
- ALWAYS sanitize incomplete tool parts before converting

## Model Config
- Default: `claude-opus-4-6` with `thinking: { type: "adaptive" }`
- Long-running routes: `export const maxDuration = 300` (Vercel Pro)
