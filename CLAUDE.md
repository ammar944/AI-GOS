# CLAUDE.md

## Session Startup Protocol (MANDATORY)

Before responding to any user message, classify the ask and state the classification in one line. Only then act.

Classification types:
- `quick-question`: pure Q&A, no tools needed. Answer directly.
- `10-min-fix`: one file, obvious change, low ambiguity. Skip discover, jump to implement with a verification check.
- `half-day` / `day` / `week+`: route through `.claude/workspaces/aigos-feature-dev/` starting at `stages/01-discover/CONTEXT.md`. Never skip discover on these.
- `production-bug`: run `.claude/rules/bug-triage.md` Step Zero FIRST. Do not load source until infra clears.
- `skill-invocation`: if the user types `/design`, `/review`, `/ship` etc. on a task larger than 10-min, wrap the skill inside a `/feature` call. Never invoke a skill directly on week+ work without classification.

Rules that apply to every classification:
- Never dispatch an `Explore`, `Task`, or `Agent` subagent without stating a time budget and a max tool-call count up front. See `.claude/rules/exploration-budget.md`.
- Never run a paid API (Firecrawl, Perplexity) in a loop without an abort condition.
- `/clear` between unrelated features. Compact at 70% context with a feature focus.

If the ask is ambiguous, state one assumption and proceed, or ask ONE clarifying question. Never ask more than one.

## Design System
Read DESIGN.md before any visual/UI work. Do not deviate without user approval.

## Commands
```bash
npm run dev          # Next.js dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npm run test:run     # Vitest single run
npm run test:run -- src/lib/ai/__tests__/research.test.ts  # Single file
```

## Research Worker (required for research to work)
```bash
# Terminal 1: Next.js app
npm run dev
# Terminal 2: Research worker (separate process, cannot import from src/lib/)
cd research-worker && npm run dev  # starts on :3001
```
Add to `.env.local`: `RAILWAY_WORKER_URL=http://localhost:3001` and `RAILWAY_API_KEY=dev-secret`.
Without RAILWAY_WORKER_URL, all research dispatches silently fail.

## Environment Variables
Required in `.env.local`:
```
ANTHROPIC_API_KEY, GROQ_API_KEY, SEARCHAPI_KEY,
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
CLERK_SECRET_KEY, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
```
Optional: `PERPLEXITY_API_KEY`, `FOREPLAY_API_KEY`, `FIRECRAWL_API_KEY`, `SPYFU_API_KEY`, `RAILWAY_WORKER_URL`, `RAILWAY_API_KEY`

## Architecture

AIGOS generates strategic marketing blueprints. Users enter a URL, review auto-extracted fields, then step through a research pipeline that produces: 6 research sections, a media plan, and ad scripts.

**Stack**: Next.js 16, Vercel AI SDK v6, Anthropic Claude, Supabase (DB + realtime), Clerk auth, Railway worker.

### Journey Flow (IMPORTANT — read carefully)

`/journey` is the canonical AI product layer for the new workflow. Do not move this flow to a separate `/gtm` runtime. The backend is being swapped behind Journey so the user-facing route can stay stable.

The target Journey flow is **link-entry → deep research → auto-filled context → central Manus/Codex-style workspace → section synthesis/edit-by-chat**.

**User flow:**
1. Enter company URL or approved business link on `/journey`.
2. Prefill/deep research starts without forcing the old extracted-field review gate.
3. The central workspace opens with research-derived context.
4. The deep research worker builds a shared corpus and writes section artifacts to Supabase.
5. Workspace cards hydrate via Supabase polling/realtime.
6. The Vercel AI SDK chat rail edits artifacts, explains sources/gaps, and updates fields through explicit tools.
7. Downstream media plan and scripts run from the saved research/profile context.

**Research dispatch**: Journey route/API → `POST /api/journey/dispatch` → Railway worker → Anthropic skills/tools/API-backed research → writes results to Supabase → realtime/polling pushes to frontend.

**Vercel AI SDK layer**: Keep `useChat`, `DefaultChatTransport`, UI message streams, and the `/api/journey/stream` workspace chat/edit route. If this becomes a formal AI SDK agent, use AI SDK v6 `ToolLoopAgent` and `createAgentUIStreamResponse` patterns. Do not replace the Journey workspace/chat shell with raw worker output.

**Prompt enforcement phase**: Do not hard schema-force the deep research section cards yet. Validate API inputs, run IDs, dispatch envelopes, persistence shape, and parsable JSON. Prompt-enforce the shared corpus, evidence standards, source coverage, section quality, confidence notes, and source gaps until the prompts stabilize.

**Pipeline order**: `identityResolution → industryMarket → icpValidation → competitors → offerAnalysis → keywordIntel → crossAnalysis → mediaPlan`

**Runners** (in `research-worker/src/runners/`): industry, icp, competitors, offer, keywords, synthesize, media-plan, ad-scripts, meeting-extract. Each runner: primary phase → repair phase → rescue phase with fallback models.

### Key Files
| What | Where |
|------|-------|
| Journey page | `src/app/journey/page.tsx` |
| Journey workspace chat/edit stream | `src/app/api/journey/stream/route.ts` |
| Research dispatch | `src/app/api/journey/dispatch/route.ts` |
| Dispatch client | `src/lib/journey/dispatch-client.ts` |
| Research realtime | `src/lib/journey/research-realtime.ts` |
| Card taxonomy | `src/lib/workspace/card-taxonomy.ts` |
| Field catalog | `src/lib/journey/field-catalog.ts` |
| Context builder | `src/lib/journey/context-string.ts` |
| Worker entry | `research-worker/src/index.ts` |
| Identity resolver | `research-worker/src/identity/resolve-identity.ts` |
| Meeting intel | `src/lib/meeting-intel/` |
| Current AI-layer decision | `docs/journey-ai-layer-architecture-2026-05-07.md` |

### Profiles & Scripts
- Profiles auto-created during journey. Detail page: `/profiles/[id]` with tabs: Overview, Research, Scripts, Assets.
- Scripts generated via `research-worker/src/runners/ad-scripts.ts` (2-pass: draft → humanize with 43-point audit). Currently accessed only through profile Scripts tab.
- Profile AI insights compile intelligence from each research section.

## AI SDK Patterns (Vercel AI SDK v6)

IMPORTANT — these cause silent bugs if wrong:
- ALL AI calls use `@ai-sdk/anthropic` and `@ai-sdk/perplexity` directly. Never OpenRouter.
- `toUIMessageStreamResponse()` requires `DefaultChatTransport` on frontend. Mismatch = silent failure.
- Tool definitions use `inputSchema` (not `parameters`), `maxOutputTokens` (not `maxTokens`).
- `convertToModelMessages()` throws `MissingToolResultsError` — sanitize incomplete tool parts first.
- New AI SDK v6 structured-output code should use `generateText()` with `Output.object()` rather than adding new `generateObject()` call sites.
- Avoid `.min()/.max()` on Zod numbers passed to Anthropic structured-output schemas; use `.describe()` instead.
- AI SDK v6 agent APIs use `ToolLoopAgent` for multi-step loops and `createAgentUIStreamResponse` for agent-backed UI message streams.

## Conventions
- **Imports**: `@/*` maps to `./src/*` — always absolute
- **Auth**: Clerk. `auth()` in API routes, middleware in `src/middleware.ts`
- **UI**: shadcn/ui (new-york) + Radix + Tailwind CSS v4. `cn()` for conditional classes.
- **Files**: kebab-case. Named exports (not default). Props suffixed with `Props`.
- **Zod**: Runtime validation for all AI outputs and API inputs. Schemas colocated.
- **State**: localStorage via `src/lib/storage/local-storage.ts`. Supabase for persistent data.

## Critical Gotchas
- **id vs run_id**: Frontend passes `run_id`. Query `.eq('run_id', id)`, use `session.id` for FKs.
- **Field sync**: New onboarding fields must sync across 6 places: field-catalog.ts, JOURNEY_FIELD_GROUPS, PROFILE_FIELD_GROUPS, Supabase migration, worker parse-context.ts, identity card JSONB.
- **Railway worker boundary**: Cannot import from `src/lib/`. Schemas/types must exist in both places.
- **Pre-existing TS errors**: openrouter tests and chat blueprint tests have known errors — ignore them.
- **Deploy**: Vercel. Long routes need `export const maxDuration = 300` (Pro tier). Worker deploys separately via `cd research-worker && railway up`.

## Skill routing

When the user's request matches an available skill, invoke it using the Skill tool FIRST:
- Product ideas, brainstorming → office-hours
- Bugs, errors, 500s → investigate
- Ship, deploy, PR → ship
- QA, test the site → qa
- Code review → review
- Design system → design-consultation
- Visual audit → design-review
- Architecture review → plan-eng-review
