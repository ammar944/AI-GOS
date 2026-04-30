# Copy everything below this line and paste into Claude Code
# ─────────────────────────────────────────────────────────

Think hard about this task. You are executing Sprint 2 of a major AI chat agent upgrade for the Egoos (AI-GOS) platform. Sprint 1 (layout, input, messages, route) is already complete.

## Step 0 — Read All Context Files

Before doing ANYTHING, read these files in this exact order:

1. `@CLAUDE.md` — Project conventions, commands, tech stack
2. `@.claude/sprints/SPRINT-2-CORE-TOOLS.md` — **THIS IS YOUR SPRINT. Read every line.**
3. `@EGOOS-AGENT-UI-SPEC.md` — UI spec with card component designs
4. `@EGOOS-CHAT-AGENT-V2.html` — HTML preview showing all card types (read the CSS for exact styling)

Then read the existing code you'll be extending:

5. `@src/lib/ai/chat-tools/index.ts` — Tool factory pattern (add new tools here)
6. `@src/lib/ai/chat-tools/web-research.ts` — Reference: how tools are built
7. `@src/lib/ai/chat-tools/edit-blueprint.ts` — Reference: approval flow pattern
8. `@src/lib/ai/chat-tools/types.ts` — Existing types (add new types here)
9. `@src/app/api/chat/agent/route.ts` — Agent route (add tool descriptions to system prompt)
10. `@src/components/chat/agent-chat.tsx` — Chat component (wire card rendering here)
11. `@src/components/chat/edit-approval-card.tsx` — Reference: existing card pattern
12. `@src/components/chat/research-result-card.tsx` — Reference: existing card pattern
13. `@src/lib/ai/providers.ts` — Model/provider configuration
14. `@src/lib/ai/groq-provider.ts` — Groq provider setup

## Step 1 — Plan

Enter plan mode. Map out:
- How each new tool follows the existing factory pattern (`createXTool()`)
- How tool results flow from backend → frontend rendering
- Which tool results need approval flow vs. immediate display
- Data types for each tool's return value

## Step 2 — Execute with 3 Parallel Subagents

**Subagent A (worktree)** — Deep Research Tool Backend
- Create `src/lib/ai/chat-tools/deep-research.ts`
- Factory: `createDeepResearchTool()`
- Decomposes queries into sub-questions, runs parallel Perplexity searches, synthesizes findings
- Returns: `{ query, phases[], findings[], sources[], totalDuration }`
- Reuse search pattern from `web-research.ts`

**Subagent B (worktree)** — Generate Section + Compare + Analyze Tools Backend
- Create `src/lib/ai/chat-tools/generate-section.ts` — Uses Claude Sonnet for quality writing, returns old/new diff, requires approval
- Create `src/lib/ai/chat-tools/compare-competitors.ts` — Pure data extraction from blueprint, returns structured table
- Create `src/lib/ai/chat-tools/analyze-metrics.ts` — Uses Groq `generateObject()` to score sections, returns dimension scores + recommendations

**Subagent C (worktree)** — All 4 Frontend Card Components
- Create `src/components/chat/deep-research-card.tsx` — Blue theme, progress phases, findings with citations, source chips
- Create `src/components/chat/generate-section-card.tsx` — Amber theme, diff view, approve/reject buttons
- Create `src/components/chat/comparison-table-card.tsx` — Purple theme, full-width table, winner highlighting
- Create `src/components/chat/analysis-score-card.tsx` — Cyan theme, big score number, animated dimension bars

All cards follow exact styling from `@EGOOS-CHAT-AGENT-V2.html` and `@EGOOS-AGENT-UI-SPEC.md`.

## Step 3 — Integration (Main Agent)

1. Update `@src/lib/ai/chat-tools/index.ts` — Import + register all 4 new tools in `createChatTools()`
2. Update `@src/lib/ai/chat-tools/types.ts` — Add `DeepResearchResult`, `ComparisonResult`, `AnalysisResult` types
3. Update `@src/components/chat/agent-chat.tsx` — Detect tool result `toolName` and render the matching card component
4. Update `@src/components/chat/index.ts` — Export new card components
5. Update `@src/app/api/chat/agent/route.ts` — Add tool descriptions to system prompt so the model knows when to use each tool

## Step 4 — Verify

```bash
npm run build
npm run lint
npm run test:run
```

All must pass. If TypeScript errors exist in new files, fix them.

## Key Rules

- Follow EXACT factory pattern from `web-research.ts`: `export function createXTool() { return tool({ ... }) }`
- Use `inputSchema` (not `parameters`) for tool definitions per CLAUDE.md
- Use `maxOutputTokens` (not `maxTokens`) per CLAUDE.md
- Card components: use CSS variables from globals.css, NOT hardcoded hex
- Named exports only, kebab-case files, Props suffix on interfaces
- `@/*` path alias for all imports
- Animate score bars with CSS transition: `width 0→target over 1s ease, 300ms stagger`
