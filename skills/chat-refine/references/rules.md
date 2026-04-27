# Rules — chat-refine

Load-bearing constraints extracted from team feedback + MEMORY.md.

## Hard constraints

### [CONSTRAINT] Post-research-only scope
Chat is a **refinement sidebar**. It edits already-rendered cards, deep-dives into specific sections, and regenerates fragments. It does NOT trigger new research dispatches. (The journey is URL-form-driven; chat is post-research editing.)
- *Source: `.claude/ARCHITECTURE.md` Journey Flow, `feedback_journey_is_form_driven.md`*

### [CONSTRAINT] Stop after 3 failures
If any tool (QA check, browser action, generation) fails 3 times in a row, stop and ask the user what to do. Do not retry infinitely.
- *Source: `feedback_flow_corrections.md`, user direct quote: "If you fail like three times, then you can stop."*

### [CONSTRAINT] Tool-call message sanitization
Before calling `convertToModelMessages()`, sanitize incomplete tool parts — messages with tool calls lacking results cause `MissingToolResultsError`. This is load-bearing for AI SDK v6.
- *Source: `.claude/rules/learned-patterns.md`, `.claude/rules/ai-sdk-patterns.md`*

## Sanity gates

- **[FAIL]** if chat-refine is invoked before any research runner has produced output — there's nothing to refine
- **[WARN]** if chat attempts to dispatch research (tool-call pattern mismatch) — route user to `/ingest-url` instead

## Tools (scoped)

Chat-refine bundles what was previously `src/lib/ai/chat-tools/*` (14 tools). Expected tool set (one file per tool in `references/tools/`):
- `deep-research.ts`, `deep-dive.ts` — follow-up targeted research
- `search-blueprint.ts`, `query-blueprint.ts` — card queries
- `generate-section.ts`, `edit-blueprint.ts` — inline editing
- `compare-competitors.ts`, `create-visualization.ts`, `analyze-metrics.ts` — analytical tools

## Cross-cutting

- `toUIMessageStreamResponse()` requires `DefaultChatTransport` on frontend. Mismatching = silent failure.
- Tool definitions use `inputSchema` (not `parameters`) and `maxOutputTokens` (not `maxTokens`) per AI SDK v6.
