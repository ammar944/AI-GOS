# AGENTS.md — AIGOS Project

> **Architecture map: read [`docs/source-map.md`](docs/source-map.md) first.** It is the verified, path-accurate map of the whole research pipeline (research-v3 page → worker corpus → in-process lab-engine sections → Audit Reader → profile).

> AI-powered Go-to-Market Operations System. Read CLAUDE.md for full architecture details.

## Commands

```bash
npm run dev          # Next.js dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npm test             # Vitest watch mode
npm run test:run     # Vitest single run
```

## Architecture

- **Framework:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4
- **AI:** Vercel AI SDK v6 for the `/research-v2` workspace chat/agent layer. Preserve `useChat`, `DefaultChatTransport`, UI message streams, and AI SDK tool calls for user-facing chat/edit behavior.
- **Research:** The six positioning sections run IN-PROCESS via the lab engine (`src/lib/lab-engine/`, DeepSeek + live tools). The separate Railway worker (`research-worker/`) runs only the deepResearchProgram corpus, identity resolution, and meeting extraction (Perplexity sonar, ADR-0007), dispatched from `/api/research-v2/dispatch`. Async — 202-and-write-back via Supabase realtime.
- **DB:** Supabase (PostgreSQL + pgvector)
- **Auth:** Clerk
- **UI:** shadcn/ui (new-york, zinc) + SaasLaunch Design Language

## Key Paths

```
src/app/research-v3/page.tsx              # Canonical user-facing surface (Audit Reader)
src/app/api/research-v2/chat/route.ts     # Vercel AI SDK workspace chat/edit route
src/app/api/research-v2/dispatch/route.ts # Research dispatch route (deepResearchProgram + positioning sections)
src/lib/journey/server/dispatch-research.ts # Dispatch helper used by research-v2 route
src/lib/lab-engine/skills/positioning-*/  # Per-section prompt skills (SKILL.md, lab engine)
src/components/research-v2|v3|workspace/  # Audit Reader, typed renderers, chat-thread, workspace cards
research-worker/src/index.ts              # Express :3001, /run endpoint
research-worker/src/runner.ts             # Anthropic streaming + tool loop
research-worker/src/runners/              # runDeepResearchProgram + 6 positioning runners
docs/                                     # PRD, design specs, audit reports
```

## Conventions

- Path alias: `@/*` → `./src/*`
- Named exports only
- kebab-case files
- Zod schemas for all AI output + API input
- `cn()` for conditional classes
- SSE streaming with typed events
- Node.js runtime for AI routes (NOT Edge)

## Current Direction

- `/research-v2` is the canonical user-facing surface. The `/journey` page route has been deleted — do not reference it as a current surface.
- "Manus for GTM" means: deep research saves context, fills onboarding/profile context, then the `/research-v2` workspace synthesizes GTM report sections one by one with a Cursor/Codex-style chat-and-artifact editing loop.
- Keep the Vercel AI SDK architecture for user-facing chat, workspace edits, UI message streams, and future agent loops. If formalizing it, use AI SDK v6 `ToolLoopAgent` / `createAgentUIStreamResponse` patterns rather than replacing the workspace chat with raw worker output.
- Swap the backend behind Journey: the deep research worker gets access to Anthropic skills, tools, web search, code execution, and approved APIs, then writes durable corpus/artifacts back to `journey_sessions.research_results`.
- Do not hard schema-force the deep research section cards yet. Validate inputs, dispatch envelopes, run IDs, persistence shape, and parsable JSON; prompt-enforce evidence standards, section quality, and source coverage until the prompts stabilize.

## Models

- **Workspace chat/agent**: Vercel AI SDK v6 in `src/app/api/research-v2/chat/route.ts`; keep it focused on chat, artifact editing, source explanation, and research observation.
- **Research runners**: Anthropic SDK in `research-worker/src/runners/*.ts`, with native web search/tool access and optional platform skills. Run as detached async jobs on Railway.
- **Identity / structuring**: Haiku for fast structuring inside specific runners (e.g. `resolve-identity.ts`).
- **No OpenRouter** — calls are direct `@ai-sdk/anthropic`, `@ai-sdk/perplexity` (corpus, ADR-0007), or DeepSeek (lab sections).

## Anti-Hallucination Rules

- NEVER invent market data, pricing, statistics, or competitor info
- ALL data must come from user-provided context, approved tools/APIs, Anthropic web search, or persisted source artifacts
- If a tool returns no data, report it — don't fill in fake numbers
- Tool result reminders after every API response

## Current Flow (production)

```
src/app/research-v3/page.tsx              [URL entry + Audit Reader]
  │  POST /api/research-v2/orchestrate (+ /api/research-v2/chat to edit)
  ▼
src/app/api/research-v2/chat/route.ts     [Vercel AI SDK workspace chat/edit route]
  │  (research tool call / operator button click)
  ▼
src/app/api/research-v2/dispatch/route.ts [dispatch via dispatch-research.ts helper]
  │  POST RAILWAY_WORKER_URL/run
  ▼
research-worker/src/index.ts              [Express, returns 202, runs detached skills/tools research]
  │  writeResearchResult()
  ▼
Supabase journey_sessions.research_results
  │  realtime subscription
  ▼
src/app/research-v3/page.tsx              [results render in Audit Reader]
```

Pipeline order: `deepResearchProgram → positioningMarketCategory → positioningBuyerICP → positioningCompetitorLandscape → positioningVoiceOfCustomer → positioningDemandIntent → positioningOfferDiagnostic`

> Older orchestration docs describe a "lead agent Q&A while research happens in background" architecture. **That design was never shipped — ignore it.** The chat agent and research are a single tool-calling loop, not two phases.
