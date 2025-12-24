# External Integrations

**Analysis Date:** 2025-12-24

## APIs & External Services

**AI/LLM Provider:**
- OpenRouter - Multi-model LLM gateway
  - SDK/Client: Custom implementation in `src/lib/openrouter/client.ts`
  - Auth: API key in `OPENROUTER_API_KEY` env var
  - Base URL: `https://openrouter.ai/api/v1`
  - Features: OpenAI-compatible API, JSON mode, cost tracking, token counting

**AI Models (via OpenRouter):**
- Google Gemini 2.0 Flash (`google/gemini-2.0-flash-001`) - Data extraction
  - Used in: `src/lib/media-plan/pipeline/extract.ts`
  - Cost: $0.075 input / $0.30 output per 1M tokens

- Perplexity Sonar Pro (`perplexity/sonar-pro`) - Market research with web data
  - Used in: `src/lib/media-plan/pipeline/research.ts`
  - Cost: $1.0 input / $1.0 output per 1M tokens

- OpenAI GPT-4o (`openai/gpt-4o`) - Decision logic
  - Used in: `src/lib/media-plan/pipeline/logic.ts`
  - Cost: $2.5 input / $10.0 output per 1M tokens

- Anthropic Claude 3.5 Sonnet (`anthropic/claude-sonnet-4`) - Synthesis
  - Used in: `src/lib/media-plan/pipeline/synthesize.ts`, `src/lib/strategic-blueprint/pipeline/strategic-blueprint-generator.ts`
  - Cost: $3.0 input / $15.0 output per 1M tokens

## Data Storage

**Databases:**
- Supabase PostgreSQL - Primary data store
  - Connection: via `NEXT_PUBLIC_SUPABASE_URL` env var
  - Client: @supabase/supabase-js v2.87.1
  - Files: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`

**File Storage:**
- Not detected (no Supabase Storage usage found)

**Caching:**
- Browser localStorage - Client-side data persistence
  - Location: `src/lib/storage/local-storage.ts`
  - Keys: `aigog_onboarding_data`, `aigog_strategic_blueprint`, `aigog_media_plan`, `aigog_generation_state`

## Authentication & Identity

**Auth Provider:**
- Supabase Auth - Email/password + OAuth
  - Implementation: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`
  - Middleware: `src/lib/supabase/middleware.ts`, `src/middleware.ts`
  - Token storage: httpOnly cookies via @supabase/ssr
  - Session management: Server-side session refresh

**OAuth Integrations:**
- Google OAuth - Social sign-in
  - Configured via Supabase dashboard
  - Callback: `src/app/auth/callback/route.ts`
  - Actions: `src/app/login/actions.ts`

## Monitoring & Observability

**Error Tracking:**
- Not detected (no Sentry/other integration found)

**Analytics:**
- Not detected

**Logs:**
- Console logging only (stdout/stderr)

## CI/CD & Deployment

**Hosting:**
- Vercel (implied by Next.js patterns)
  - Deployment: automatic on git push (assumed)
  - Environment vars: configured in Vercel dashboard

**CI Pipeline:**
- Not detected (no GitHub Actions workflows found)

## Environment Configuration

**Development:**
- Required env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`
- Secrets location: `.env.local` (gitignored)
- Mock/stub services: None detected

**Production:**
- Secrets management: Vercel environment variables
- Same Supabase project (separate production project recommended)

## Webhooks & Callbacks

**Incoming:**
- `/auth/callback` - `src/app/auth/callback/route.ts`
  - Verification: Supabase code exchange
  - Events: OAuth callback after social login

**Outgoing:**
- None detected

---

*Integration audit: 2025-12-24*
*Update when adding/removing external services*
