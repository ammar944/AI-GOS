# Sprint 2 — Core Tools: Deep Research, Generate Section, Compare, Analyze

## Context

Sprint 1 is complete. We now have the new two-column layout, redesigned chat input with slash commands, message bubbles with thinking blocks, and the agent route supports maxSteps: 10. Now we add the powerful new tools and their corresponding inline artifact UI cards.

**Read these files first for full context:**
- `@CLAUDE.md` — project conventions and architecture
- `@EGOOS-AGENT-UI-SPEC.md` — UI spec with card designs
- `@EGOOS-CHAT-AGENT-V2.html` — working preview showing all card types
- `@src/lib/ai/chat-tools/index.ts` — current tool factory pattern
- `@src/lib/ai/chat-tools/web-research.ts` — reference for how tools are built
- `@src/lib/ai/chat-tools/edit-blueprint.ts` — reference for approval flow tools
- `@src/lib/ai/chat-tools/types.ts` — existing type definitions
- `@src/app/api/chat/agent/route.ts` — agent route to wire new tools into

## Objective

Add 4 new tools (deep research, generate section, compare competitors, analyze metrics) to the agent backend, plus 4 corresponding rich UI card components that render inline in chat messages.

## Orchestration Plan — Use Parallel Subagents

Think hard about the architecture. The backend tools and frontend cards are independent — build them in parallel.

### Subagent A — Backend: Deep Research Tool (worktree isolation)

**File to create:** `src/lib/ai/chat-tools/deep-research.ts`

**Pattern:** Follow the exact same pattern as `@src/lib/ai/chat-tools/web-research.ts` — export a `createDeepResearchTool()` factory function that returns a Vercel AI SDK `tool()`.

**Tool specification:**
```typescript
name: 'deepResearch'
description: 'Conduct deep multi-step research on a topic with parallel sub-queries, iterative refinement, and cited sources. Use this for complex research questions that need multiple angles of investigation.'

inputSchema: z.object({
  query: z.string().describe('The research question or topic'),
  depth: z.enum(['quick', 'standard', 'deep']).default('standard').describe('Research depth: quick (1 pass), standard (2 passes), deep (3 passes with gap analysis)'),
  focusAreas: z.array(z.string()).optional().describe('Specific angles to investigate'),
})
```

**Execute function logic:**
1. Decompose the query into 3-5 sub-questions using a simple heuristic (split by aspects: market size, key players, pricing, technology, trends)
2. For each sub-question, call the existing Perplexity research function (reuse the pattern from `@src/lib/ai/research/providers.ts` or the searchAPI pattern from `@src/lib/ai/chat-tools/web-research.ts`)
3. Run sub-queries in parallel with `Promise.all()`
4. Combine results into a structured output

**Return type:**
```typescript
{
  query: string,
  phases: { name: string, status: 'done' | 'in-progress', duration: number }[],
  findings: { title: string, content: string, citations: { label: string, url: string }[] }[],
  sources: { domain: string, url: string }[],
  totalDuration: number,
}
```

### Subagent B — Backend: Generate Section, Compare, Analyze Tools (worktree isolation)

**Files to create:**
- `src/lib/ai/chat-tools/generate-section.ts`
- `src/lib/ai/chat-tools/compare-competitors.ts`
- `src/lib/ai/chat-tools/analyze-metrics.ts`

**`generate-section.ts` specification:**
```typescript
name: 'generateSection'
description: 'Generate or rewrite a blueprint section. Produces a complete section draft for user approval before applying.'

inputSchema: z.object({
  section: z.string().describe('Blueprint section key (e.g., competitorAnalysis)'),
  instruction: z.string().describe('What to change, add, or rewrite'),
  style: z.enum(['rewrite', 'expand', 'condense', 'new']).default('rewrite'),
})
```
Execute: Extract current section content from blueprint → Build a prompt for Claude Sonnet (use `@ai-sdk/anthropic` provider from `@src/lib/ai/providers.ts`) to generate the new section → Return the old and new content as a diff. This tool requires approval (use the same approval pattern as `editBlueprint` — set `experimental_toToolResultContent` metadata).

**`compare-competitors.ts` specification:**
```typescript
name: 'compareCompetitors'
description: 'Generate a structured comparison matrix across competitors. Extracts data from the blueprint competitor section.'

inputSchema: z.object({
  competitors: z.array(z.string()).describe('Competitor names to compare'),
  dimensions: z.array(z.string()).optional().describe('Comparison dimensions').default(['pricing', 'features', 'weaknesses', 'target audience']),
})
```
Execute: Extract competitor data from `blueprint.competitorAnalysis` → Build comparison rows → Return structured table data. Pure data extraction, no API call needed.

**`analyze-metrics.ts` specification:**
```typescript
name: 'analyzeMetrics'
description: 'Score and analyze any blueprint section for quality. Returns dimension scores with specific improvement recommendations.'

inputSchema: z.object({
  section: z.string().describe('Blueprint section key to analyze'),
  focusArea: z.string().optional().describe('Specific aspect to focus analysis on'),
})
```
Execute: Extract section content → Use Groq to score across 5 dimensions (specificity, data backing, actionability, pain depth, TAM clarity) on a 1-10 scale → Return scores + recommendations. Use `generateObject()` with a Zod schema for structured output.

### Subagent C — Frontend: Rich Artifact Cards (worktree isolation)

**Files to create:**
- `src/components/chat/deep-research-card.tsx`
- `src/components/chat/generate-section-card.tsx`
- `src/components/chat/comparison-table-card.tsx`
- `src/components/chat/analysis-score-card.tsx`

**Design reference:** See `@EGOOS-CHAT-AGENT-V2.html` and `@EGOOS-AGENT-UI-SPEC.md` for exact styling.

**`deep-research-card.tsx`:**
- Header: Blue tint `rgba(54,94,255,0.04)`, "DEEP RESEARCH" label (12px/600 uppercase, accent-blue) + source count + duration
- Progress section: Vertical step list (Decomposed → Researched → Synthesized) with status dots (done=green, active=blue pulsing, pending=gray)
- Findings section: Array of finding items in `var(--bg-hover)` pills with title (12px/600 primary) + content (12.5px secondary) + inline citation markers
- Citations: Inline `<span>` markers, 16px square, `border-radius: 4px`, `background: rgba(54,94,255,0.12)`, `color: var(--accent-blue)`, `font-size: 9px`, `font-weight: 700`, hover: scale 1.1 + darker background
- Sources footer: Row of chips with favicon placeholder (12px square) + domain name (10.5px tertiary)
- Container: `border-radius: 12px`, `border: 1px solid var(--border-default)`, `box-shadow: var(--shadow-card)`
- Props: `data: DeepResearchResult`, `isStreaming?: boolean`

**`generate-section-card.tsx`:**
- Reuse the existing `@src/components/chat/edit-approval-card.tsx` pattern but with enhanced diff view
- Show section name + instruction in header
- Diff view with red (removed) and green (added) lines, mono font
- Approve/Reject buttons with Y/N keyboard hints
- Props match existing edit approval pattern

**`comparison-table-card.tsx`:**
- Header: Purple tint `rgba(167,139,250,0.04)`, "COMPETITOR COMPARISON" label
- Full-width table: `border-collapse: collapse`
- Headers: 10.5px uppercase, tertiary, `var(--bg-base)` background
- Cells: 12px secondary, `border-bottom: 1px solid var(--border-subtle)`
- Winner cells: `color: var(--accent-green); font-weight: 600`
- Props: `data: { headers: string[], rows: Record<string, string>[], winnerPerColumn?: Record<string, string> }`

**`analysis-score-card.tsx`:**
- Header: Cyan tint `rgba(80,248,228,0.03)`, section name + big score (24px mono bold)
- Score bars: Label (90px) → Track (6px height, `var(--bg-hover)`) → Fill (colored, animated width) → Value (mono 11px)
- Colors per index: `[accent-blue, accent-cyan, accent-green, accent-amber, accent-purple]`
- Bar animation: width from 0 → target over 1s ease, 300ms stagger delay per bar
- Props: `data: { section: string, overallScore: number, dimensions: { name: string, score: number }[], recommendations: string[] }`

### Main Agent — Integration & Wiring

After subagents complete:

1. **Update `@src/lib/ai/chat-tools/index.ts`:**
   - Import all new tool factories
   - Add them to the `createChatTools()` return object:
     ```typescript
     deepResearch: createDeepResearchTool(),
     generateSection: createGenerateSectionTool(blueprint),
     compareCompetitors: createCompareCompetitorsTool(blueprint),
     analyzeMetrics: createAnalyzeMetricsTool(blueprint),
     ```

2. **Update `@src/lib/ai/chat-tools/types.ts`:**
   - Add types for `DeepResearchResult`, `ComparisonResult`, `AnalysisResult`

3. **Update `@src/components/chat/agent-chat.tsx`:**
   - Import new card components
   - In the message rendering logic, detect tool result parts by `toolName` and render the appropriate card:
     - `deepResearch` → `<DeepResearchCard data={result} />`
     - `generateSection` → `<GenerateSectionCard data={result} />`
     - `compareCompetitors` → `<ComparisonTableCard data={result} />`
     - `analyzeMetrics` → `<AnalysisScoreCard data={result} />`

4. **Update `@src/components/chat/index.ts`:**
   - Export all new card components

5. **Update the agent route system prompt** in `@src/app/api/chat/agent/route.ts`:
   - Add descriptions of new tools to the system prompt so the model knows when to use them:
     ```
     ## Available Tools
     - searchBlueprint: Search specific sections of the blueprint
     - editBlueprint: Propose edits to blueprint fields (requires user approval)
     - explainBlueprint: Explain scores, recommendations, and reasoning
     - webResearch: Search the web for current market data
     - deepResearch: Multi-step research with parallel queries and citations (use for complex research)
     - generateSection: Rewrite or generate entire blueprint sections (requires approval)
     - compareCompetitors: Generate comparison tables from blueprint competitor data
     - analyzeMetrics: Score any section's quality with dimension breakdowns
     ```

6. **Verify:**
   - `npm run build` — no TypeScript errors
   - `npm run lint` — passes
   - `npm run test:run` — existing tests pass

## Success Criteria

- [ ] `/research` triggers `deepResearch` tool → renders `DeepResearchCard` inline
- [ ] `/edit` triggers `generateSection` or `editBlueprint` → renders diff card with approve/reject
- [ ] `/compare` triggers `compareCompetitors` → renders comparison table card
- [ ] `/analyze` triggers `analyzeMetrics` → renders score card with animated bars
- [ ] All 4 new tools are registered in `createChatTools()`
- [ ] Tool results render as rich cards, not plain text
- [ ] Citation markers are clickable/hoverable
- [ ] Score bars animate on card entrance
- [ ] `npm run build` succeeds
- [ ] `npm run test:run` passes

## Files Summary

### Create
- `src/lib/ai/chat-tools/deep-research.ts`
- `src/lib/ai/chat-tools/generate-section.ts`
- `src/lib/ai/chat-tools/compare-competitors.ts`
- `src/lib/ai/chat-tools/analyze-metrics.ts`
- `src/components/chat/deep-research-card.tsx`
- `src/components/chat/generate-section-card.tsx`
- `src/components/chat/comparison-table-card.tsx`
- `src/components/chat/analysis-score-card.tsx`

### Modify
- `src/lib/ai/chat-tools/index.ts`
- `src/lib/ai/chat-tools/types.ts`
- `src/components/chat/agent-chat.tsx`
- `src/components/chat/index.ts`
- `src/app/api/chat/agent/route.ts`
