# CLAUDE.md

## Commands
```bash
npm run build        # ALWAYS run after changes
npm run lint         # ALWAYS run after changes
npm run test:run     # Vitest single run
npm run dev          # Dev server localhost:3000
```

## Critical Rules
- **Vercel AI SDK v6**: Use `inputSchema` (NOT `parameters`), `maxOutputTokens` (NOT `maxTokens`)
- **Imports**: `@/*` → `./src/*` — always absolute
- **Components**: Named exports only. Props suffixed `Props`. kebab-case files.
- **Styling**: `cn()` from `@/lib/utils`, CSS variables, Tailwind v4
- **Auth**: Clerk — `auth()` in routes, middleware at `src/middleware.ts`
- **AI providers**: `@ai-sdk/anthropic` + `@ai-sdk/perplexity` — NEVER OpenRouter
- **Streaming**: `toUIMessageStreamResponse()` needs `DefaultChatTransport`
- Sanitize incomplete tool parts before `convertToModelMessages()` — throws `MissingToolResultsError`

## Architecture
Journey agent: `src/app/api/journey/stream/route.ts` (Opus 4.6, adaptive thinking). Tools: `askUser`, `runResearch`. Frontend: `src/app/journey/page.tsx` with `useChat`. Three-panel shell: `src/components/shell/`.

Sprint prompts: `.claude/battleship-sprint-prompts.md`
