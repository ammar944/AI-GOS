# AGENTS.md — AIGOS Project

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
- **Research:** Separate Railway worker (`research-worker/`) running Anthropic SDK with web search, code execution, uploaded AI-GOS platform skills, and approved external APIs. Dispatched from `/api/research-v2/dispatch`. Async — 202-and-write-back via Supabase realtime.
- **DB:** Supabase (PostgreSQL + pgvector)
- **Auth:** Clerk
- **UI:** shadcn/ui (new-york, zinc) + SaasLaunch Design Language

## Key Paths

```
src/app/research-v2/page.tsx              # Canonical user-facing surface (URL entry + workspace)
src/app/api/journey/stream/route.ts       # Vercel AI SDK workspace chat/edit stream
src/app/api/research-v2/dispatch/route.ts # Research dispatch route (deepResearchProgram + positioning sections)
src/lib/journey/server/dispatch-research.ts # Dispatch helper used by research-v2 route
src/lib/ai/prompts/journey-chat-system.ts # Real current system prompt (JOURNEY_CHAT_SYSTEM_PROMPT)
src/components/journey/                   # Chat UI components, artifact panel, inline cards
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

- **Workspace chat/agent**: Vercel AI SDK v6 in `src/app/api/journey/stream/route.ts`; keep it focused on chat, artifact editing, source explanation, and research observation.
- **Research runners**: Anthropic SDK in `research-worker/src/runners/*.ts`, with native web search/tool access and optional platform skills. Run as detached async jobs on Railway.
- **Identity / structuring**: Haiku for fast structuring inside specific runners (e.g. `resolve-identity.ts`).
- **No Perplexity, no OpenRouter** — all calls are direct Anthropic SDK or `@ai-sdk/anthropic`.

## Anti-Hallucination Rules

- NEVER invent market data, pricing, statistics, or competitor info
- ALL data must come from user-provided context, approved tools/APIs, Anthropic web search, or persisted source artifacts
- If a tool returns no data, report it — don't fill in fake numbers
- Tool result reminders after every API response

## Current Flow (production)

```
src/app/research-v2/page.tsx              [URL entry + central workspace]
  │  POST /api/journey/stream
  ▼
src/app/api/journey/stream/route.ts       [Vercel AI SDK workspace chat/edit stream]
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
src/app/research-v2/page.tsx              [results render in workspace]
```

Pipeline order: `deepResearchProgram → positioningMarketCategory → positioningBuyerICP → positioningCompetitorLandscape → positioningVoiceOfCustomer → positioningDemandIntent → positioningOfferDiagnostic`

> Older orchestration docs describe a "lead agent Q&A while research happens in background" architecture. **That design was never shipped — ignore it.** The chat agent and research are a single tool-calling loop, not two phases.
