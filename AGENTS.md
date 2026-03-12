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
- **AI:** Vercel AI SDK — Anthropic (Opus 4.6 orchestrator, Sonnet 4.6 workers)
- **Research:** Perplexity Sonar Pro via custom tools
- **DB:** Supabase (PostgreSQL + pgvector)
- **Auth:** Clerk
- **UI:** shadcn/ui (new-york, zinc) + SaasLaunch Design Language

## Key Paths

```
src/app/api/journey/     # Conversational journey routes
src/lib/ai/              # AI SDK, sections, skills, tools
src/lib/ai/skills/       # Per-section SKILL.md (Anthropic Skills API)
src/lib/ai/sections/     # Runner, configs, tools
src/lib/ai/tools/        # generate-research, scrape tools
src/components/journey/  # Journey UI
.planning/               # Project state — read STATE.md first
docs/                    # PRD, design specs, audit reports
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

- Lead Agent: `claude-opus-4-6` (orchestrator, synthesis, user-facing)
- Workers: `claude-sonnet-4-6` (research, analysis sub-agents)
- Research: `sonar-pro` (Perplexity — web search)
- Compression: `claude-3-5-haiku` (raw data → structured)

## Anti-Hallucination Rules

- NEVER invent market data, pricing, statistics, or competitor info
- ALL data must come from tool calls (Perplexity, Firecrawl, SpyFu, etc.)
- If a tool returns no data, report it — don't fill in fake numbers
- Tool result reminders after every API response

## V2 PRD Context

The system is pivoting from form-based to conversational AI journey:
- No more forms — 7-9 contextual questions with live background research
- Progressive section generation — user validates each before next
- One unified flow: research → ICP → competitors → media plan
- See `docs/AI-GOS-v2-PRD.docx` and `CLAUDE.md` for full details
