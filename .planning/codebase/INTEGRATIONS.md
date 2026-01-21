# External Integrations

**Analysis Date:** 2026-01-21

## APIs & External Services

**AI/LLM Models (OpenRouter):**
- Perplexity Sonar Pro - Real-time web search with citations
  - SDK: `@supabase/openrouter` (internal wrapper)
  - Environment: `OPENROUTER_API_KEY`
  - Client: `createOpenRouterClient()` in `src/lib/openrouter/client.ts`
  - Features: Web search, citations, structured search results
  - Cost: ~$3.00/$15.00 per 1M tokens (input/output)

- Perplexity Deep Research - Multi-step research with reasoning
  - Same SDK as Sonar Pro
  - Model ID: `perplexity/sonar-deep-research`
  - Used by: Strategic blueprint and research pipelines
  - Cost: ~$2.00/$8.00 per 1M tokens

- OpenAI o3-mini - STEM reasoning
  - Model ID: `openai/o3-mini`
  - Cost: ~$1.10/$4.40 per 1M tokens
  - Used by: Reasoning-heavy research tasks

- Google Gemini 2.5-flash - Fast reasoning
  - Model ID: `google/gemini-2.5-flash`
  - Cost: ~$0.30/$2.50 per 1M tokens
  - Features: 1M context window

- Google Gemini 2.0-flash - Fast extraction
  - Model ID: `google/gemini-2.0-flash-001`
  - Cost: ~$0.075/$0.30 per 1M tokens
  - Used by: Simple extraction and summarization

- OpenAI GPT-4o - Balanced capability
  - Model ID: `openai/gpt-4o`
  - Cost: ~$2.50/$10.00 per 1M tokens

- Anthropic Claude Sonnet - Synthesis and writing
  - Model ID: `anthropic/claude-sonnet-4`
  - Cost: ~$3.00/$15.00 per 1M tokens

- Anthropic Claude Opus - Deep reasoning
  - Model ID: `anthropic/claude-opus-4`
  - Cost: ~$15.00/$75.00 per 1M tokens

- OpenAI Embeddings (text-embedding-3-small) - Vector embeddings
  - Model ID: `openai/text-embedding-3-small`
  - Cost: ~$0.02 per 1M tokens
  - Used by: RAG (Retrieval-Augmented Generation) in v1.4

**Search/Research:**
- SearchAPI / SEARCHAPI_KEY - Web search capabilities
  - Environment variable: `SEARCHAPI_KEY`
  - Required in: `src/lib/env.ts`
  - Used for: Supplementary search in research pipelines

**OpenRouter API Details:**
- Base URL: `https://openrouter.ai/api/v1`
- Endpoints:
  - `/chat/completions` - Chat completion and streaming
  - `/embeddings` - Text embeddings
- Authentication: Bearer token via `OPENROUTER_API_KEY`
- Features:
  - OpenAI-compatible API format
  - Streaming support (Server-Sent Events)
  - JSON mode (response_format: json_object)
  - Reasoning parameters (effort, max_tokens, include)
  - Citation support (Perplexity models)
  - Timeout handling with exponential backoff
  - Cost estimation built-in

## Data Storage

**Databases:**
- PostgreSQL (via Supabase)
  - Connection: Supabase backend
  - Client: `@supabase/supabase-js` (v2.87.1)
  - Environment: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - Server-only key: `SUPABASE_SERVICE_ROLE_KEY`
  - Usage: User profiles, blueprints, conversations, messages

**File Storage:**
- Supabase Storage (inferred from available SDK methods)
  - Used via: `supabase.storage` API
  - Not directly used in current codebase exploration, but SDK supports it

**Caching:**
- None detected - stateless request handling
- Potential in-memory caching via OpenRouter responses (cost optimization)

## Authentication & Identity

**Auth Provider:**
- Supabase Authentication
  - SDK: `@supabase/ssr` (v0.8.0) for server-side rendering
  - Client factory: `createBrowserClient()` in `src/lib/supabase/client.ts`
  - Server factory: `createServerClient()` in `src/lib/supabase/server.ts`
  - Features:
    - OAuth support (inferred from callback route)
    - Session management with cookies
    - User authentication via code exchange
  - Callback route: `src/app/auth/callback/route.ts`
  - Implementation: OAuth code → session exchange pattern

**Session Management:**
- Cookie-based sessions (Next.js middleware)
- Middleware: `src/middleware.ts`
- Function: `updateSession()` from `@/lib/supabase/middleware`
- Automatic session refresh via cookies

## Monitoring & Observability

**Error Tracking:**
- Custom error classes in OpenRouter client:
  - `TimeoutError` - Request timeouts (type: `src/lib/openrouter/client.ts`)
  - `APIError` - API response errors with status code
- Error logging via `console.error()` and `console.warn()`
- Health check endpoint: `src/app/api/health/route.ts` for environment validation

**Logs:**
- Console-based logging in development
- Server-side logging in API routes:
  - OpenRouter errors logged with status and message
  - JSON extraction strategies logged for debugging
  - Retry attempts logged with timing
- No centralized logging service detected

**Monitoring/Analytics:**
- Not detected in current codebase

## CI/CD & Deployment

**Hosting:**
- Vercel (confirmed via `.vercel/project.json`)
- Project ID: `prj_2B1XsfXVF2ylLSvb3toROhHDamOB`
- Organization: `team_mPw8AWisZMCEhXlMq60DOR2T`

**Serverless Function Configuration:**
- Max duration: 300 seconds (5 minutes) for media plan generation
  - Set via `export const maxDuration = 300` in `src/app/api/media-plan/generate/route.ts`
  - Allows multi-stage AI pipeline with retries
  - Requires Vercel Pro tier

**CI Pipeline:**
- Vercel CLI configured
- Automatic deployment on git push (inferred)
- Environment variables managed via Vercel dashboard

**Build Process:**
- Next.js build (`next build`)
- Output: Optimized serverless functions and static assets

## Environment Configuration

**Required Environment Variables:**

**Server-side (private):**
```
OPENROUTER_API_KEY=sk-or-v1-...          # OpenRouter API access
SEARCHAPI_KEY=...                         # Search API credentials
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...  # Supabase admin access (server-only)
```

**Client-side (public):**
```
NEXT_PUBLIC_SUPABASE_URL=https://...supabase.co        # Supabase project
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...       # Supabase anon access
NEXT_PUBLIC_APP_URL=ai-gos.vercel.app                  # App domain (optional)
```

**Secrets Location:**
- Development: `.env.local` (git-ignored)
- Production: Vercel environment variables dashboard
- Vercel OIDC token: `VERCEL_OIDC_TOKEN` (for CI/CD authentication)

**Validation:**
- Endpoint: `src/app/api/health/route.ts`
- Function: `validateEnv()` in `src/lib/env.ts`
- Returns: Missing variables and warnings
- HTTP 503 if required variables missing, 200 if all valid

## Webhooks & Callbacks

**Incoming:**
- Supabase OAuth callback: `src/app/auth/callback/route.ts`
  - Receives `code` parameter from Supabase auth provider
  - Exchanges code for session via `supabase.auth.exchangeCodeForSession()`
  - Redirects to dashboard on success or error page on failure

**Outgoing:**
- None detected in current codebase
- Potential for future integrations via API routes

## Request/Response Patterns

**OpenRouter Client:**
- Base pattern: `OpenRouterClient` class in `src/lib/openrouter/client.ts`
- Methods:
  - `chat()` - Non-streaming chat completion with retry logic
  - `chatStream()` - Streaming chat completion (async generator)
  - `embeddings()` - Text embedding generation
  - `chatJSON()` - Chat with JSON validation and extraction
  - `chatJSONValidated()` - Chat with Zod schema validation

**Error Handling:**
- Exponential backoff: 1s → 2s → 4s... up to 10s
- Jitter added (0-500ms) to prevent thundering herd
- Special handling for 429 (rate limit): 5s-30s backoff
- Retryable: Timeouts, 5xx errors, 429, parse errors
- Non-retryable: 4xx errors (except 429)

**Cost Tracking:**
- Each response includes estimated cost calculation
- Based on token counts and per-model pricing
- Used for monitoring and billing insights

**JSON Extraction:**
- 8-strategy fallback approach:
  1. Direct parse (whole content)
  2. Balanced brace extraction `{...}`
  3. Balanced bracket extraction `[...]`
  4. Markdown code block extraction
  5. Find-first-brace balanced extraction
  6. Find-first-bracket balanced extraction
  7. Repair and retry on unbalanced structures
  8. Greedy extraction with repair

**Stream Processing:**
- SSE (Server-Sent Events) format
- Chunks processed line-by-line
- Delta content extracted from `choices[0].delta.content`
- Handles graceful termination with `[DONE]` marker

---

*Integration audit: 2026-01-21*
