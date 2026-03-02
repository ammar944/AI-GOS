# Sprint 3 — Research Sub-Agents + MCP Integration

> **Written**: 2026-03-03
> **Status**: ✅ COMPLETE — E2E validated via Playwright (2026-03-03)
> **Branch**: `aigos-v2`
> **Context**: This replaces the old SPRINT-3-POLISH.md which was pre-battleship pivot.

---

## What's Done (Sprints 1 & 2)

- **Sprint 1**: Foundation — Vercel AI SDK, streaming route, system prompt, fonts/tokens, Supabase `journey_sessions` table
- **Sprint 2**: Conversational onboarding — `askUser` tool, chip/pill UI, 8-question flow, localStorage + Supabase persistence, session resume
- **Battleship pivot**: Three-panel command center (AppShell), ContextPanel, ProgressTracker, ResearchSections, progressive reveal, UI elevation across 20+ components

**Already built that maps to later sprints:**
- `runResearch` tool + `research.ts` (1600 lines, all 5 research functions) — being replaced by sub-agents
- `ResearchInlineCard`, `ResearchSections`, `ProgressTracker` — UI exists, needs live data
- Media plan pipeline (10 sections in `src/lib/media-plan/`) — Sprint 5
- `journey_sessions` Supabase table — Sprint 6
- Session resume flow (localStorage) — Sprint 6

---

## Vision (Battleship Architecture)

**The media buying battleship** — a three-panel command center where Claude guides the user through a strategic research journey. The experience feels like talking to a senior media strategist with access to live market data.

```
Lead Agent (Claude Opus 4.6 — Vercel AI SDK)
  Streams conversation to frontend via toUIMessageStreamResponse()
    │
    ├── askUser tool           → interactive onboarding chips
    ├── researchIndustry       → Opus 4.6 sub-agent [perplexitySearch]
    ├── researchCompetitors    → Opus 4.6 sub-agent [perplexitySearch, adLibrary, spyFu, pageSpeed]
    ├── researchICP            → Opus 4.6 sub-agent [perplexitySearch]
    ├── researchOffer          → Opus 4.6 sub-agent [perplexitySearch, firecrawl]
    └── synthesizeResearch     → Opus 4.6 sub-agent [pure synthesis, no tools]
```

**Key architecture decisions (locked):**
- Lead agent: **Vercel AI SDK** — keeps frontend streaming working (`useChat`, `toUIMessageStreamResponse`)
- Sub-agents: **Anthropic SDK directly** (`client.beta.messages.stream()` + `.finalMessage()`) — better control, no UI streaming needed
- MCP tools: **`betaZodTool` wrappers** around existing API clients (Firecrawl, SpyFu, AdLibrary, PageSpeed)
- All sub-agents: **Claude Opus 4.6** with adaptive thinking
- Execution: **Sequential** — industry → competitors → ICP → offer → synthesize (shows progressive inline cards)

---

## Sprint 3 Tasks

### T3.0 — Fix right sidebar (5 min)

**File**: `src/app/journey/page.tsx` lines 338-344

**Bug**: Right panel gated behind `journeyPhase >= 2` — only shows after first research fires.

**Fix**: Remove the condition. Always pass `<ContextPanel>` regardless of phase.

```typescript
// REMOVE THIS:
rightPanel={
  journeyPhase >= 2 ? <ContextPanel ... /> : undefined
}

// REPLACE WITH:
rightPanel={<ContextPanel ... />}
```

---

### T3.1 — Build shared `perplexitySearch` tool

**File to create**: `src/lib/ai/tools/perplexity-search.ts`

Wraps Perplexity Sonar Pro as a `betaZodTool` for Anthropic SDK sub-agents.

```typescript
// Input
{ query: string, context?: string }

// Output
{ results: string, sources: { url: string, title: string }[] }
```

Uses `@ai-sdk/perplexity` under the hood (already installed). Returns raw text + sources. Each sub-agent uses this to do web research then synthesizes results itself.

---

### T3.2 — Build 4 MCP tool wrappers

**Directory**: `src/lib/ai/tools/mcp/`

Each is a `betaZodTool` wrapping existing client code:

| File | Wraps | Used by |
|------|-------|---------|
| `firecrawl-tool.ts` | `src/lib/firecrawl/client.ts` | Offer sub-agent |
| `spyfu-tool.ts` | SpyFu API | Competitor sub-agent |
| `ad-library-tool.ts` | `src/lib/ad-library/` | Competitor sub-agent |
| `pagespeed-tool.ts` | PageSpeed Insights API | Competitor sub-agent |

**SpyFu note**: Client code may need to be built. Check if `SPYFU_API_KEY` is wired in env.

---

### T3.3 — Build 5 research tools (replace `runResearch`)

**Directory**: `src/lib/ai/tools/research/`

Each tool's `execute()` uses Anthropic SDK `toolRunner` to spawn a Claude Opus 4.6 sub-agent:

```typescript
// Pattern for each tool
export const researchIndustry = tool({
  description: '...',
  inputSchema: z.object({ context: z.string() }),
  execute: async ({ context }) => {
    const client = new Anthropic()
    const result = await client.beta.messages.toolRunner({
      model: 'claude-opus-4-6',
      thinking: { type: 'adaptive' },
      max_tokens: 8000,
      tools: [perplexitySearch], // betaZodTool
      system: INDUSTRY_RESEARCHER_PROMPT,
      messages: [{ role: 'user', content: context }],
    })
    // Parse result into existing Zod schema (IndustryMarketResult)
    return result
  }
})
```

| Tool | Sub-agent tools | Output schema |
|------|----------------|---------------|
| `researchIndustry` | perplexitySearch | `IndustryMarketResult` (from types.ts) |
| `researchCompetitors` | perplexitySearch, adLibrary, spyFu, pageSpeed | `CompetitorAnalysisResult` |
| `researchICP` | perplexitySearch | `ICPAnalysisResult` |
| `researchOffer` | perplexitySearch, firecrawl | `OfferAnalysisResult` |
| `synthesizeResearch` | none | `CrossAnalysisResult` |

**Reuse existing Zod schemas** from `src/lib/ai/types.ts` — same output contracts, new execution model.

**Sub-agent system prompts**: Extract the research intent from existing `research.ts` functions and turn them into system prompts for each sub-agent.

---

### T3.0 — Fix right sidebar ✅ COMPLETE

Removed `journeyPhase >= 2` gating. `<ContextPanel>` always rendered. Right panel visible from message 1.

---

### T3.1 — Build shared `perplexitySearch` tool ✅ COMPLETE

Created `src/lib/ai/tools/perplexity-search.ts`. Uses `generateText()` from Vercel AI SDK with `perplexity(MODELS.SONAR_PRO)`. Returns `JSON.stringify({ results, sources })`. Note: `maxOutputTokens` (not `maxTokens`) required by AI SDK v6.

---

### T3.2 — Build 4 MCP tool wrappers ✅ COMPLETE

Created `src/lib/ai/tools/mcp/` with 4 files + barrel export:
- `firecrawl-tool.ts` — wraps `createFirecrawlClient().scrape()`
- `ad-library-tool.ts` — wraps `AdLibraryService.fetchAllPlatforms()`
- `spyfu-tool.ts` — wraps `getDomainStats` + `getMostValuableKeywords`
- `pagespeed-tool.ts` — direct `fetch` to PageSpeed Insights v5 API

---

### T3.3 — Build 5 research tools (replace `runResearch`) ✅ COMPLETE

Replaced stubs with real Anthropic SDK sub-agents. Pattern: `client.beta.messages.stream()` + `.finalMessage()`. Note: used `stream()` not `toolRunner` — toolRunner not available in this SDK version.

---

### T3.4 — Update lead agent route ✅ COMPLETE

**File**: `src/app/api/journey/stream/route.ts`

1. Remove `createRunResearchTool` import
2. Add the 5 new individual research tools to `streamText` tools
3. Update system prompt: replace `runResearch` instructions with 5 individual tool descriptions
4. Tell agent order: `researchIndustry` → `researchCompetitors` → `researchICP` → `researchOffer` → `synthesizeResearch`

---

### T3.5 — Delete old dispatcher ✅ COMPLETE

Deleted `src/lib/ai/tools/run-research.ts`. No remaining imports found.

---

### T3.6 — Verify inline card rendering ✅ COMPLETE (with bug fix)

`SECTION_META` keys in `research-inline-card.tsx` were correct. However, discovered that `chat-message.tsx` was still checking `toolName === 'runResearch'` (old name). Fixed by replacing with a `RESEARCH_TOOL_SECTIONS` map covering all 5 new tool names + legacy fallback.

---

### T3.7 — E2E verification ✅ COMPLETE

Playwright E2E test with Metabase as test company:
- Right panel visible from message 1 ✅
- `researchIndustry` fired: agent said "industry research is running" ✅
- `researchICP` + `researchCompetitors` fired in parallel ✅
- `researchOffer` fired after pricing answer ✅
- `synthesizeResearch` completed with real market data (Tableau/Looker/Power BI keywords, $40 CPS math, LinkedIn ring-fence strategy) ✅
- `npm run build` passes ✅

---

## Files Created / Modified (Sprint 3)

```
src/lib/ai/tools/perplexity-search.ts             ✅ created
src/lib/ai/tools/mcp/firecrawl-tool.ts            ✅ created
src/lib/ai/tools/mcp/spyfu-tool.ts                ✅ created
src/lib/ai/tools/mcp/ad-library-tool.ts           ✅ created
src/lib/ai/tools/mcp/pagespeed-tool.ts            ✅ created
src/lib/ai/tools/mcp/index.ts                     ✅ created
src/lib/ai/tools/research/research-industry.ts    ✅ real sub-agent
src/lib/ai/tools/research/research-competitors.ts ✅ real sub-agent
src/lib/ai/tools/research/research-icp.ts         ✅ real sub-agent
src/lib/ai/tools/research/research-offer.ts       ✅ real sub-agent
src/lib/ai/tools/research/synthesize-research.ts  ✅ real sub-agent
src/lib/ai/tools/research/index.ts                ✅ barrel export
src/app/journey/page.tsx                          ✅ right panel fix
src/app/api/journey/stream/route.ts               ✅ 5 new tools, updated prompt
src/lib/ai/prompts/lead-agent-system.ts           ✅ updated
src/components/journey/chat-message.tsx           ✅ inline card tool name fix
src/lib/ai/tools/run-research.ts                  🗑️ deleted
```

---

## What Comes After (Sprint 4+)

- **Sprint 4**: Section generation inline cards, approve/edit/question flow, section streaming
- **Sprint 5**: Media plan pipeline wired into journey (already built at `src/lib/media-plan/`)
- **Sprint 6**: Full Supabase message persistence, DOCX/PDF export
- **Sprint 7**: Real client testing, production deploy
