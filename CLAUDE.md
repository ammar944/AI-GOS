# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Next.js dev server (http://localhost:3000)
npm run build        # Production build
npm run lint         # ESLint (flat config, Next.js rules)
npm test             # Vitest watch mode
npm run test:run     # Vitest single run
npm run test:run -- src/lib/ai/__tests__/research.test.ts  # Single test file
npm run test:coverage  # Coverage report (V8 provider)
```

## Environment Variables

Required in `.env.local`:
```
ANTHROPIC_API_KEY=         # Claude models via Vercel AI SDK
SEARCHAPI_KEY=             # Web search for research
NEXT_PUBLIC_SUPABASE_URL=  # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Supabase publishable key
CLERK_SECRET_KEY=          # Clerk auth (server)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=  # Clerk auth (client)
```

Optional:
```
PERPLEXITY_API_KEY=   # Perplexity Sonar Pro for research
FOREPLAY_API_KEY=     # Creative intelligence enrichment
FIRECRAWL_API_KEY=    # Pricing page scraping
SPYFU_API_KEY=        # Keyword intelligence
```

## Architecture

**AI-GOS** is a strategic marketing blueprint generator. Users complete an onboarding wizard, then the system runs a multi-phase AI pipeline to produce a comprehensive paid media strategy document.

### Core Pipeline (Strategic Blueprint Generation)

Three-phase pipeline orchestrated in `src/lib/ai/generator.ts`, streamed via SSE from `src/app/api/strategic-blueprint/generate/route.ts`:

1. **Phase 1** (parallel): Industry/Market + Competitors research via Perplexity Sonar Pro
2. **Phase 2** (parallel): ICP + Offer analysis via Sonar Pro, then deterministic reconciliation
3. **Phase 3**: Cross-analysis synthesis via Claude Sonnet

Enrichment runs in parallel with Phases 2/3: Firecrawl pricing scraping, Ad Library creative analysis, SpyFu keyword intelligence, SEO audit (cheerio + PageSpeed API).

### AI SDK Integration (Vercel AI SDK v6)

All AI calls use `@ai-sdk/anthropic` and `@ai-sdk/perplexity` directly (NOT OpenRouter). Key patterns:

- **Research**: `generateObject()` with Zod schemas for structured output
- **Chat**: `streamText()` + `toUIMessageStreamResponse()` for streaming tool-calling agent
- **Onboarding suggestions**: `streamObject()` + `toTextStreamResponse()` on backend, `experimental_useObject` on frontend
- **Transport matching**: `toUIMessageStreamResponse()` requires `DefaultChatTransport`; `toTextStreamResponse()` requires `TextStreamChatTransport`
- **Tool definitions**: Use `inputSchema` (not `parameters`), `maxOutputTokens` (not `maxTokens`)
- **Message conversion**: `convertToModelMessages(messages)` is async and throws `MissingToolResultsError` if tool calls lack results — sanitize incomplete tool parts before converting

Provider config: `src/lib/ai/providers.ts` (model constants, cost tracking, section-to-model mapping)

### Chat Agent

Tool-calling agent at `src/app/api/chat/agent/route.ts` using `streamText` with 4 tools defined in `src/lib/ai/chat-tools/`:
- `searchBlueprint` — query blueprint sections
- `editBlueprint` — propose edits (requires user approval)
- `explainBlueprint` — explain scores/recommendations with evidence
- `webResearch` — live web search for market data

Frontend: `src/components/chat/agent-chat.tsx` using `useChat` from `@ai-sdk/react`.

Tool part types use `part.type = "tool-${TOOL_NAME}"` format. States flow: `input-streaming` → `input-available` → `approval-requested` → `approval-responded` → `output-available` | `output-error`.

### Onboarding Auto-Fill

Per-step AI suggestions: `src/app/api/onboarding/suggest/route.ts` routes to Perplexity (market data) or Claude (analysis) per step. Schemas in `src/lib/company-intel/step-schemas.ts`.

Bulk research: `src/app/api/onboarding/research/route.ts` streams structured company intel.

### Media Plan Pipeline

Separate 10-section pipeline in `src/lib/media-plan/pipeline/` with phased execution (research → synthesis → validation). Route at `src/app/api/media-plan/generate/route.ts` with 300s timeout for Vercel Pro.

## Key Conventions

- **Path alias**: `@/*` maps to `./src/*` — always use absolute imports
- **Auth**: Clerk (`@clerk/nextjs`) — middleware in `src/middleware.ts`, `auth()` in API routes
- **UI**: shadcn/ui (new-york style, zinc base) + Radix primitives + Tailwind CSS v4
- **Styling**: Use `cn()` from `@/lib/utils` for conditional classes. CVA for component variants. CSS variables for theme colors.
- **Files**: kebab-case for all files/directories. Components as named exports (not default). Props interfaces suffixed with `Props`.
- **State**: Browser localStorage via `src/lib/storage/local-storage.ts` with STORAGE_KEYS namespace. Supabase for persistent data.
- **Zod**: Runtime validation for all AI outputs and API inputs. Schemas in `schemas.ts` files colocated with features.
- **SSE streaming**: Backend emits typed events (`section-start`, `content`, `section-end`, `error`). Frontend must match event names exactly.
- **Section name mapping**: Generator uses short names (e.g. `industryMarket`), frontend expects full keys (e.g. `industryMarketOverview`). Mapping in route.ts `GENERATOR_TO_SECTION`.

## Testing

Vitest with jsdom environment. Config in `vitest.config.ts`. Tests colocated in `__tests__/` directories next to source. Test utilities in `src/test/factories/` and `src/test/mocks/`.

Pre-existing TS errors exist in some test files (openrouter tests, chat blueprint tests) — these are not related to main application code.

## Deployment

Vercel hosting with serverless functions. Long-running routes use `export const maxDuration = 300` (requires Pro tier). Automatic deploy on push to main.
