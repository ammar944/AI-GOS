# AI SDK Patterns (Vercel AI SDK v6)

## Provider Rules
- **Skill bodies** (`skills/*`, `research-worker/src/runners/`, `src/lib/gtm/skills/*`) use `@ai-sdk/anthropic` and `@ai-sdk/perplexity` directly. Evidence-binding + quality required.
- **Orchestrator chat** (`src/lib/ai/orchestrator.ts`, `src/app/api/gtm/runs/[runId]/chat/route.ts`) may use Ollama via `@ai-sdk/openai-compatible` pointed at `OLLAMA_BASE_URL`. Cheap tool-calling brain; skill bodies remain on paid Anthropic+Perplexity.
- **`patch_artifact` tool body** (textual MD edits, no skill re-run) also runs on Ollama. Free edits stay free.
- NEVER use OpenRouter — it was removed in V2.
- Provider config lives in `src/lib/ai/providers.ts`. Ollama exports are net-new alongside `anthropic`/`perplexity`; do not replace.

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
