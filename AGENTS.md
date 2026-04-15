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
- **AI:** Vercel AI SDK v6 — `streamText` with `claude-opus-4-6` (adaptive thinking) for the Journey chat agent
- **Research:** Separate Railway worker (`research-worker/`) running Anthropic SDK with native `web_search` tool. Dispatched as tool calls from the Journey chat agent via `/api/journey/dispatch`. Async — 202-and-write-back via Supabase realtime.
- **DB:** Supabase (PostgreSQL + pgvector)
- **Auth:** Clerk
- **UI:** shadcn/ui (new-york, zinc) + SaasLaunch Design Language

## Key Paths

```
src/app/journey/page.tsx                  # Chat UI entry (useChat + DefaultChatTransport)
src/app/api/journey/stream/route.ts       # streamText loop — Opus 4.6 + adaptive thinking
src/app/api/journey/dispatch/route.ts     # Bridges research tools to the Railway worker
src/lib/ai/prompts/journey-chat-system.ts # Real current system prompt (JOURNEY_CHAT_SYSTEM_PROMPT)
src/lib/ai/tools/research/                # Tool wrappers that POST to /api/journey/dispatch
src/components/journey/                   # Chat UI components, artifact panel, inline cards
research-worker/src/index.ts              # Express :3001, /run endpoint
research-worker/src/runner.ts             # Anthropic streaming + tool loop
research-worker/src/runners/              # industry, competitors, icp, offer, synthesize, keywords, media-plan
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

## Models

- **Journey chat agent**: `claude-opus-4-6` with adaptive thinking — single user-facing tool-calling loop in `src/app/api/journey/stream/route.ts`. There is NO separate "lead agent" process; the chat IS the agent.
- **Research runners**: Anthropic SDK in `research-worker/src/runners/*.ts`, each with native `web_search` tool. Run as detached async jobs on Railway.
- **Identity / structuring**: Haiku for fast structuring inside specific runners (e.g. `resolve-identity.ts`).
- **No Perplexity, no OpenRouter** — all calls are direct Anthropic SDK or `@ai-sdk/anthropic`.

## Anti-Hallucination Rules

- NEVER invent market data, pricing, statistics, or competitor info
- ALL data must come from tool calls (Perplexity, Firecrawl, SpyFu, etc.)
- If a tool returns no data, report it — don't fill in fake numbers
- Tool result reminders after every API response

## Current Flow (production)

```
src/app/journey/page.tsx                  [chat UI]
  │  POST /api/journey/stream
  ▼
src/app/api/journey/stream/route.ts       [Opus 4.6 streamText, tool-calling loop]
  │  (research tool call)
  ▼
src/app/api/journey/dispatch/route.ts     [enriches with prior results]
  │  POST RAILWAY_WORKER_URL/run
  ▼
research-worker/src/index.ts              [Express, returns 202, runs detached]
  │  writeResearchResult()
  ▼
Supabase journey_sessions.research_results
  │  realtime subscription
  ▼
src/app/journey/page.tsx                  [results render in artifact panel]
```

Pipeline order: `identityResolution → industryMarket → icpValidation → competitors → offerAnalysis → keywordIntel → crossAnalysis → mediaPlan`

> Older orchestration docs describe a "lead agent Q&A while research happens in background" architecture. **That design was never shipped — ignore it.** The chat agent and research are a single tool-calling loop, not two phases.
