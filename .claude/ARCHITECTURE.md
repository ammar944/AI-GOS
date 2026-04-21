# ARCHITECTURE.md

AIGOS generates strategic marketing blueprints. Users enter a URL, review auto-extracted fields, step through a research pipeline that produces 6 research sections, a media plan, and ad scripts.

**Stack**: Next.js 15, Vercel AI SDK v6, Anthropic Claude, Supabase (DB + realtime), Clerk auth, Railway worker.

## Commands

```bash
npm run dev          # Next.js dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npm run test:run     # Vitest single run
npm run test:run -- src/lib/ai/__tests__/research.test.ts  # Single file
```

## Research Worker (required for research to work)

Terminal 1: `npm run dev` — Next.js app.
Terminal 2: `cd research-worker && npm run dev` — worker on `:3001` (separate process, cannot import from `src/lib/`).

`.env.local` needs `RAILWAY_WORKER_URL=http://localhost:3001` and `RAILWAY_API_KEY=dev-secret`. Without `RAILWAY_WORKER_URL`, all research dispatches silently fail.

## Environment Variables

Required in `.env.local`:

- `ANTHROPIC_API_KEY`, `GROQ_API_KEY`, `SEARCHAPI_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`

Optional: `PERPLEXITY_API_KEY`, `FOREPLAY_API_KEY`, `FIRECRAWL_API_KEY`, `SPYFU_API_KEY`, `RAILWAY_WORKER_URL`, `RAILWAY_API_KEY`.

## Journey Flow

The journey is **URL-form driven**: user enters URL → fields auto-prefill → user reviews in UnifiedFieldReview → submit dispatches research. Chat is a post-research refinement sidebar scoped to editing already-rendered cards.

1. Enter URL → system auto-prefills onboarding fields.
2. User reviews/edits prefilled fields in a form (UnifiedFieldReview).
3. Submit → dispatches `identityResolution` (silent), then `industryMarket`.
4. Workspace shows research cards arriving via Supabase realtime.
5. User approves each section → next section dispatches automatically.
6. After all 6 sections: guided prompt to generate Media Plan.
7. After media plan: guided prompt to generate Scripts.
8. Results saved to profile.

**Research dispatch**: Button clicks → `POST /api/journey/dispatch` → Railway worker → writes results to Supabase → realtime pushes to frontend.

**Chat sidebar**: post-research editing/refinement only (`editCard`, `updateField`). Chat input disabled during active research. Does NOT trigger research dispatch.

**Pipeline order**: `identityResolution → industryMarket → icpValidation → competitors → offerAnalysis → keywordIntel → crossAnalysis → mediaPlan`

**Runners** (`research-worker/src/runners/`): industry, icp, competitors, offer, keywords, synthesize, media-plan, ad-scripts, meeting-extract. Each runner: primary → repair → rescue phases with fallback models.

## Key Files

| What | Where |
|------|-------|
| Journey page | `src/app/journey/page.tsx` |
| Journey chat | `src/app/api/journey/stream/route.ts` |
| Research dispatch | `src/app/api/journey/dispatch/route.ts` |
| Dispatch client | `src/lib/journey/dispatch-client.ts` |
| Research realtime | `src/lib/journey/research-realtime.ts` |
| Card taxonomy | `src/lib/workspace/card-taxonomy.ts` |
| Field catalog | `src/lib/journey/field-catalog.ts` |
| Context builder | `src/lib/journey/context-string.ts` |
| Worker entry | `research-worker/src/index.ts` |
| Identity resolver | `research-worker/src/identity/resolve-identity.ts` |
| Meeting intel | `src/lib/meeting-intel/` |

## Profiles & Scripts

- Profiles auto-created during journey. Detail page: `/profiles/[id]` with tabs: Overview, Research, Scripts, Assets.
- Scripts generated via `research-worker/src/runners/ad-scripts.ts` (2-pass: draft → humanize with 43-point audit). Accessed only through the profile Scripts tab.
- Profile AI insights compile intelligence from each research section.

## Conventions

- **Imports**: `@/*` maps to `./src/*` — always absolute.
- **Auth**: Clerk. `auth()` in API routes, middleware in `src/middleware.ts`.
- **UI**: shadcn/ui (new-york) + Radix + Tailwind CSS v4. `cn()` for conditional classes.
- **Files**: kebab-case. Named exports (not default). Props suffixed with `Props`.
- **Zod**: Runtime validation for all AI outputs and API inputs. Schemas colocated.
- **State**: localStorage via `src/lib/storage/local-storage.ts`. Supabase for persistent data.

## Critical Gotchas (full)

- **id vs run_id**: Frontend passes `run_id`. Query `.eq('run_id', id)`, use `session.id` for FKs.
- **Field sync**: new onboarding fields must sync across 6 places — `field-catalog.ts`, `JOURNEY_FIELD_GROUPS`, `PROFILE_FIELD_GROUPS`, Supabase migration, worker `parse-context.ts`, identity card JSONB.
- **Railway worker boundary**: cannot import from `src/lib/`. Schemas/types live in both places.
- **Pre-existing TS errors**: openrouter tests and chat blueprint tests have known errors — ignore them.
- **Deploy**: Vercel. Long routes need `export const maxDuration = 300` (Pro tier). Worker deploys separately via `cd research-worker && railway up`.

## AI SDK v6 quick reference (details in `.claude/rules/ai-sdk-patterns.md`)

- All AI calls use `@ai-sdk/anthropic` and `@ai-sdk/perplexity`. Never OpenRouter.
- `toUIMessageStreamResponse()` needs `DefaultChatTransport`. Mismatch = silent failure.
- Tool definitions: `inputSchema` not `parameters`, `maxOutputTokens` not `maxTokens`.
- Sanitize incomplete tool parts before `convertToModelMessages()` — throws `MissingToolResultsError` otherwise.
- Remove `.min()/.max()` from Zod numbers in `generateObject()` schemas — Anthropic API rejects. Use `.describe()`.
