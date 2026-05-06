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
- **AI:** Vercel AI SDK v6 for the `/journey` workspace chat/agent layer. Preserve `useChat`, `DefaultChatTransport`, UI message streams, and AI SDK tool calls for user-facing chat/edit behavior.
- **Research:** Separate Railway worker (`research-worker/`) running Anthropic SDK with web search, code execution, uploaded AI-GOS platform skills, and approved external APIs. Dispatched from `/api/journey/dispatch`. Async — 202-and-write-back via Supabase realtime.
- **DB:** Supabase (PostgreSQL + pgvector)
- **Auth:** Clerk
- **UI:** shadcn/ui (new-york, zinc) + SaasLaunch Design Language

## Key Paths

```
src/app/journey/page.tsx                  # Canonical Journey launcher + workspace entry
src/app/api/journey/stream/route.ts       # Vercel AI SDK workspace chat/edit stream
src/app/api/journey/dispatch/route.ts     # Bridges research tools to the Railway worker
src/lib/ai/prompts/journey-chat-system.ts # Real current system prompt (JOURNEY_CHAT_SYSTEM_PROMPT)
src/lib/ai/tools/research/                # Tool wrappers that POST to /api/journey/dispatch
src/components/journey/                   # Chat UI components, artifact panel, inline cards
research-worker/src/index.ts              # Express :3001, /run endpoint
research-worker/src/runner.ts             # Anthropic streaming + tool loop
research-worker/src/runners/              # industry, competitors, icp, offer, synthesize, keywords, media-plan
docs/                                     # PRD, design specs, audit reports
docs/journey-ai-layer-architecture-2026-05-07.md # Current /journey AI-layer decision
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

- `/journey` is the canonical new AI layer. Do not move this workflow to a new `/gtm` runtime.
- Keep the Vercel AI SDK architecture for user-facing chat, workspace edits, UI message streams, and future agent loops. If formalizing it, use AI SDK v6 `ToolLoopAgent` / `createAgentUIStreamResponse` patterns rather than replacing the workspace chat with raw worker output.
- Swap the backend behind Journey: the deep research worker gets access to Anthropic skills, tools, web search, code execution, and approved APIs, then writes durable corpus/artifacts back to `journey_sessions.research_results`.
- Do not hard schema-force the deep research section cards yet. Validate inputs, dispatch envelopes, run IDs, persistence shape, and parsable JSON; prompt-enforce evidence standards, section quality, and source coverage until the prompts stabilize.

## Models

- **Journey workspace chat/agent**: Vercel AI SDK v6 in `src/app/api/journey/stream/route.ts`; keep it focused on chat, artifact editing, source explanation, and research observation.
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
src/app/journey/page.tsx                  [link entry + central workspace]
  │  POST /api/journey/stream
  ▼
src/app/api/journey/stream/route.ts       [Vercel AI SDK workspace chat/edit stream]
  │  (research tool call)
  ▼
src/app/api/journey/dispatch/route.ts     [enriches with prior results]
  │  POST RAILWAY_WORKER_URL/run
  ▼
research-worker/src/index.ts              [Express, returns 202, runs detached skills/tools research]
  │  writeResearchResult()
  ▼
Supabase journey_sessions.research_results
  │  realtime subscription
  ▼
src/app/journey/page.tsx                  [results render in artifact panel]
```

Pipeline order: `identityResolution → industryMarket → icpValidation → competitors → offerAnalysis → keywordIntel → crossAnalysis → mediaPlan`

> Older orchestration docs describe a "lead agent Q&A while research happens in background" architecture. **That design was never shipped — ignore it.** The chat agent and research are a single tool-calling loop, not two phases.
