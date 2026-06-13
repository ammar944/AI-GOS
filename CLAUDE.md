# CLAUDE.md

> **Architecture map: read [`docs/source-map.md`](docs/source-map.md) first.** It is the verified, path-accurate map of the whole research pipeline (research-v3 page → worker corpus → in-process lab-engine sections → Audit Reader → profile).

## DOX Contract

- Root `AGENTS.md` is the binding DOX rail for this repository.
- Before editing, read the applicable `AGENTS.md` chain from the repo root to every target path.
- After meaningful edits, perform the DOX closeout pass described in root `AGENTS.md`.

## Operating Defaults

- **Default model is Opus.** Don't be afraid to spend tokens on judgment, planning, and review. Use Sonnet for medium tasks, Haiku only for genuinely tiny mechanical work (rename, list, format).
- **Trust the modern tooling.** Use `TodoWrite` for multi-step work in-session, plan mode for genuinely large asks, skills (via `Skill` tool) for specialized triggers, and the `Agent` tool for parallel/independent subwork. Don't run a classification ritual before every reply.
- **Production bugs first hit infra:** run `.claude/rules/bug-triage.md` Step Zero before opening source.
- **Paid APIs (Firecrawl, Perplexity, SearchAPI) never loop without an abort condition.**
- `/clear` between unrelated features. Compact around 70% with a feature focus.
- If a request is genuinely ambiguous, state one assumption and proceed.

Load-bearing rules live in `.claude/rules/`: `ai-sdk-patterns.md`, `verification.md`, `security.md`, `bug-triage.md`, `hooks-and-automation.md`, `learned-patterns.md`, `context-management.md`. Read them when their topic is in scope.

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

## Research Worker (required for corpus, identity, and meeting extraction)
```bash
# Terminal 1: Next.js app
npm run dev
# Terminal 2: Research worker (separate process, cannot import from src/lib/)
cd research-worker && npm run dev  # starts on :3001
```
Add to `.env.local`: `RAILWAY_WORKER_URL=http://localhost:3001` and `RAILWAY_API_KEY=dev-secret`.
The six positioning sections run in-process through `src/lib/lab-engine/`. Without `RAILWAY_WORKER_URL`, worker-backed corpus, identity, and meeting dispatches fail.

## Environment Variables
Expected for the current v3 audit path with live lab tools:
```
DEEPSEEK_API_KEY, PERPLEXITY_API_KEY, BRAVE_SEARCH_API_KEY, SEARCHAPI_KEY,
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
CLERK_SECRET_KEY, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
```
Also used by adjacent worker/tools paths: `ANTHROPIC_API_KEY`, `GROQ_API_KEY`, `FOREPLAY_API_KEY`, `FIRECRAWL_API_KEY`, `SPYFU_API_KEY`, `RAILWAY_WORKER_URL`, `RAILWAY_API_KEY`

## research-v2 env knobs + capabilities

The lab engine reads exactly **three** behavior knobs. Verified against code 2026-05-29:

- `LAB_ENGINE_PROVIDER` — section model provider (`src/lib/lab-engine/ai/models.ts`). Default `anthropic` when unset; live runs set `deepseek-direct`.
- `LAB_VERIFIER_MAX_UNSUPPORTED` — verifier hard-fail ceiling for unsupported load-bearing claims (`src/lib/lab-engine/agents/verification/evidence-support.ts`, `getMaxUnsupportedAllowed`). Default `Infinity` (unset/empty/invalid) = commit-with-honest-badge, never hard-fail. Set a non-negative integer to fail the section above that many unsupported claims.
- `LAB_ENGINE_LIVE_TOOLS` — live research tools toggle (`src/lib/research-v2/lab-section-job.ts`). Default tools-on; only the literal string `'false'` disables them.

The six positioning sections run **in-process** in `src/lib/lab-engine/` (DeepSeek section agents + live research tools). The `research-worker/src/competitors/` directory is a legacy copy — do not touch it.

These rollout flags are **legacy** — zero live `process.env` reads in `src/` or `research-worker/src/`, safe to ignore:

- `ENABLE_POSITIONING_ORCHESTRATOR`
- `NEXT_PUBLIC_ARTIFACT_UI_V2`
- `NEXT_PUBLIC_ENABLE_PARALLEL_SECTIONS`
- `ORCHESTRATOR_CONCURRENCY`
- `MANAGED_AGENTS_*` (webhook secret, positioning-enabled flag, custom-tool retry ceiling, app domain)

API keys / endpoints still read by the v3 path and adjacent tools: `DEEPSEEK_API_KEY`, `BRAVE_SEARCH_API_KEY`, `SEARCHAPI_KEY`, `PERPLEXITY_API_KEY`, `RESEARCH_DEEP_PROGRAM_MODEL`, `RAILWAY_WORKER_URL`, `RAILWAY_API_KEY`.

Diff frontend vs worker reality with one grep:
- `GET /api/research-v2/_capabilities` — Next.js mirror, fetches worker `/capabilities` (1.5s timeout)
- `GET /capabilities` on the Railway worker — own env + package version for worker-backed corpus/identity/meeting health

## Architecture

AIGOS generates strategic marketing blueprints. Users enter a URL, review auto-extracted fields, then step through a research pipeline that produces: 6 positioning sections and a media plan.

**Stack**: Next.js 16, Vercel AI SDK v6, Anthropic Claude / DeepSeek (provider-agnostic via AI SDK v6; positioning sections run DeepSeek by default), Supabase (DB + realtime), Clerk auth, in-process lab engine for sections, Railway worker for corpus/identity/meeting.

### Research-v3 / research-v2 Flow (IMPORTANT — read carefully)

`/research-v3` is the canonical live front-door runner (Audit Reader). The `/research-v2` **page** route has been deleted; only its `/api/research-v2/*` backend routes remain — the shared backend that `/research-v3` calls. The `/journey` page route has also been deleted.

The flow is **form-driven, not chat-driven**. URL entry → deepResearchProgram corpus → operator-clicked positioning sections → results saved to profile.

**User flow:**
1. Enter company URL or approved business link on `/research-v3`.
2. deepResearchProgram dispatches automatically (corpus + onboarding fields).
3. Corpus completes → GTM Brief Review form opens for the user to confirm/edit auto-prefilled fields.
4. User submits the brief → orchestrator fans out all six positioning sections via `POST /api/research-v2/orchestrate`.
5. Sections fan out and commit as drafts in parallel (`Promise.allSettled` over all six).
6. Audit Reader renders typed cards per section as each commits; live per-section phase (Compiling context → Reading sources → Drafting → Validating → Committed) + tool/source activity.
7. All results saved to profile.

Fan-out is the canonical flow. The old per-section "Run section" operator click was replaced when `/api/research-v2/orchestrate` landed; do not reintroduce sequential single-section dispatch unless explicitly asked.

**Research dispatch**: Form submit → `POST /api/research-v2/orchestrate` (multi-section fan-out) OR `POST /api/research-v2/dispatch` (single-section, used by `/api/research-v2/rerun-section` and corpus) → in-process lab engine (DeepSeek section agents + Brave `web_search`) for sections; Railway worker for corpus/identity/meeting → writes results to Supabase → realtime/polling pushes to frontend.

**Vercel AI SDK layer**: Keep `useChat`, `DefaultChatTransport`, UI message streams, and the `/api/research-v2/chat` workspace strategist route. The chat sidebar can draft/revise the `strategyBrief` artifact and trigger scoped refinement reruns; it does not replace the initial URL/corpus/onboarding fan-out flow.

**Verifier/repair phase**: Lab sections use structured schemas, minimum validators, the structural verifier, required-evidence gates, and evidence-support repair. Validate API inputs, run IDs, dispatch envelopes, persistence shape, and parsable JSON; do not accept unsupported load-bearing claims as clean output.

**Pipeline order**: `deepResearchProgram → positioningMarketCategory → positioningBuyerICP → positioningCompetitorLandscape → positioningVoiceOfCustomer → positioningDemandIntent → positioningOfferDiagnostic → positioningPaidMediaPlan`

**Lab section agents** (in `src/lib/lab-engine/agents/run-section.ts`): six positioning sections plus `positioningPaidMediaPlan`, using the answer-tool path, structural verifier, required-evidence gates, and evidence-support repair.

**Worker runners** (in `research-worker/src/runners/`): `runDeepResearchProgram`, product identity resolution, and meeting extraction. The worker no longer owns positioning section execution.

### Key Files
| What | Where |
|------|-------|
| Research-v3 page | `src/app/research-v3/page.tsx` |
| Research-v3 page (canonical surface) | `src/app/research-v3/page.tsx` |
| Workspace chat/edit route | `src/app/api/research-v2/chat/route.ts` |
| Research dispatch route | `src/app/api/research-v2/dispatch/route.ts` |
| Orchestrate route | `src/app/api/research-v2/orchestrate/route.ts` |
| Lab section route | `src/app/api/research-v2/run-lab-section/route.ts` |
| Dispatch helper | `src/lib/journey/server/dispatch-research.ts` |
| Lab section agents | `src/lib/lab-engine/agents/` |
| Lab artifact schemas | `src/lib/lab-engine/artifacts/schemas/` |
| Lab research tools | `src/lib/lab-engine/agents/tools/` |
| Research realtime | `src/lib/journey/research-realtime.ts` |
| Card taxonomy | `src/lib/workspace/card-taxonomy.ts` |
| Field catalog | `src/lib/journey/field-catalog.ts` |
| Research input builder | `src/lib/research-v2/corpus-to-research-input.ts` |
| Worker entry | `research-worker/src/index.ts` |
| Identity resolver | `research-worker/src/identity/resolve-identity.ts` |
| Meeting intel | `src/lib/meeting-intel/` |

### Profiles & Scripts
- Profiles auto-created during journey. Detail page: `/profiles/[id]` with tabs: Overview, Research, Assets.
- Ad scripts were removed per ADR-0009. The current Audit deliverable is six positioning sections plus `positioningPaidMediaPlan`; there is no live `/api/scripts` path or profile Scripts tab.
- Profile AI insights compile intelligence from each research section.

## AI SDK Patterns (Vercel AI SDK v6)

IMPORTANT — these cause silent bugs if wrong:
- Use first-party AI SDK provider packages already in the repo (`@ai-sdk/anthropic`, `@ai-sdk/deepseek`, `@ai-sdk/perplexity`, and `@ai-sdk/openai-compatible` for Ollama-compatible DeepSeek). Never OpenRouter.
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
- **Railway worker boundary**: Cannot import from `src/lib/`. Worker-backed corpus/identity/meeting code stays in `research-worker/`; current section schemas live solely in `src/lib/lab-engine/artifacts/schemas/`.
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
