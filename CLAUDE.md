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

### Research-v2 Flow (IMPORTANT — read carefully)

`/research-v2` is the canonical user-facing surface. The `/journey` page route has been deleted.

The flow is **form-driven, not chat-driven**. URL entry → deepResearchProgram corpus → operator-clicked positioning sections → results saved to profile.

**User flow:**
1. Enter company URL or approved business link on `/research-v2`.
2. deepResearchProgram dispatches automatically (corpus + onboarding fields).
3. Corpus completes → workspace opens with the Run section operator control.
4. User clicks Run section → next pending positioning section dispatches.
5. Section completes → Run section control rotates to the next pending section.
6. User clicks through all positioning sections one by one.
7. All results saved to profile.

**Research dispatch**: Button clicks → `POST /api/research-v2/dispatch` (accepts `deepResearchProgram` + all `POSITIONING_SECTION_IDS`) → Railway worker → Anthropic skills/tools/API-backed research → writes results to Supabase → realtime/polling pushes to frontend.

**Vercel AI SDK layer**: Keep `useChat`, `DefaultChatTransport`, UI message streams, and the `/api/journey/stream` workspace chat/edit route. If this becomes a formal AI SDK agent, use AI SDK v6 `ToolLoopAgent` and `createAgentUIStreamResponse` patterns. Chat sidebar is post-research editing only — does NOT trigger research.

**Prompt enforcement phase**: Do not hard schema-force the deep research section cards yet. Validate API inputs, run IDs, dispatch envelopes, persistence shape, and parsable JSON. Prompt-enforce the shared corpus, evidence standards, source coverage, section quality, confidence notes, and source gaps until the prompts stabilize.

**Pipeline order**: `deepResearchProgram → positioningMarketCategory → positioningBuyerICP → positioningCompetitorLandscape → positioningVoiceOfCustomer → positioningDemandIntent → positioningOfferDiagnostic`

**Runners** (in `research-worker/src/runners/`): `runDeepResearchProgram` + 6 positioning runners (`positioningMarketCategory`, `positioningBuyerICP`, `positioningCompetitorLandscape`, `positioningVoiceOfCustomer`, `positioningDemandIntent`, `positioningOfferDiagnostic`). Each runner: primary phase → repair phase → rescue phase with fallback models.

### Key Files
| What | Where |
|------|-------|
| Research-v2 page | `src/app/research-v2/page.tsx` |
| Workspace chat/edit stream | `src/app/api/journey/stream/route.ts` |
| Research dispatch route | `src/app/api/research-v2/dispatch/route.ts` |
| Dispatch helper | `src/lib/journey/server/dispatch-research.ts` |
| Research realtime | `src/lib/journey/research-realtime.ts` |
| Card taxonomy | `src/lib/workspace/card-taxonomy.ts` |
| Field catalog | `src/lib/journey/field-catalog.ts` |
| Context builder | `src/lib/journey/context-string.ts` |
| Worker entry | `research-worker/src/index.ts` |
| Identity resolver | `research-worker/src/identity/resolve-identity.ts` |
| Meeting intel | `src/lib/meeting-intel/` |

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

## gstack (REQUIRED — global install)

**Before doing ANY work, verify gstack is installed:**

```bash
test -d ~/.claude/skills/gstack/bin && echo "GSTACK_OK" || echo "GSTACK_MISSING"
```

If GSTACK_MISSING: STOP. Do not proceed. Tell the user:

> gstack is required for all AI-assisted work in this repo.
> Install it:
> ```bash
> git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
> cd ~/.claude/skills/gstack && ./setup --team
> ```
> Then restart your AI coding tool.

Do not skip skills, ignore gstack errors, or work around missing gstack.

Using gstack skills: After install, skills like /qa, /ship, /review, /investigate,
and /browse are available. Use /browse for all web browsing.
Use ~/.claude/skills/gstack/... for gstack file paths (the global path).
