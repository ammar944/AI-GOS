# V3 Research Schema Elevation & Onboarding UX — Implementation Prompt

> Paste this entire block into Claude Code on branch `aigos-v2`.

---

## Prompt

I need you to plan and implement the V3 research schema elevation for AI-GOS. This is the main focus now.

### What We're Building

During onboarding, the user answers questions conversationally. As trigger conditions are met, research sections fire ONE BY ONE in front of the user — they see each section generating live, review the research card when it completes, approve or request revision, then the conversation continues and the next section fires when ready. This progressive reveal is already wired (research cards stream inline, right panel tracks progress). What's broken is the **output quality** — the schemas are severely regressed from V1.

### The Audit (READ THIS FIRST)

Read `docs/research-section-audit.md` — it's a 1200-line document covering:
- **Part 1**: V2 section mapping (7 sections, tools, MCPs, schemas)
- **Part 2**: V1 → V2 schema comparison with field-by-field regression analysis
- **Part 3**: V3 elevation strategy with per-section plans and token budgets
- **Part 4**: Current onboarding UX map with improvement recommendations

Key findings:
- 4 CRITICAL regressions: ICP (15% coverage), Competitor (30%), Keywords (30%), Media Plan (5%)
- V2 has MORE tools than V1 (8 betaZodTool wrappers) but produces LESS output
- Runners underutilize tools (e.g., ICP runner uses only web_search despite 9 available tools)
- Total token budget needs to go from 56K → 100K across all sections
- V1's rich schemas were designed for batch generation; V2's flat schemas were designed for streaming — V3 must bridge both

### Current Architecture

```
Lead Agent (Claude Opus 4.6, Vercel AI SDK streamText)
  → generateResearch tool (inline agentic loop, NOT Railway dispatch)
    → Anthropic SDK generateText + betaZodTools per runner
    → Streams chunks to frontend via SSE data parts
    → Persists to Supabase journey_sessions.research_results JSONB
```

Key files:
- `src/lib/ai/tools/generate-research.ts` — generateResearch tool definition
- `src/lib/ai/sections/` — section runners (each uses Anthropic SDK + tools)
- `src/lib/journey/schemas/*.ts` — V2 Zod schemas (8 files)
- `src/lib/ai/skills/*/SKILL.md` — runner skill prompts
- `research-worker/src/runners/*.ts` — Railway worker runners (reference implementation)
- `src/components/journey/research-cards/*.tsx` — frontend cards rendering research output
- `src/lib/ai/prompts/lead-agent-system.ts` — system prompt with 6-phase flow + trigger rules

V1 schemas for comparison:
- `src/lib/ai/schemas/*.ts` — V1 structured output types
- `src/lib/strategic-blueprint/output-types.ts` — V1 TypeScript types (~870 lines)
- `src/lib/media-plan/schemas.ts` — V1 media plan (10-section, ~100+ fields)

### What I Need You To Do

Use `/superpowers:brainstorming` first to explore the approach, then `/superpowers:writing-plans` to create the sprint plan.

#### Sprint 1: Schema Restoration & Elevation (Zod schemas + runner prompts)

For each of the 7 sections:
1. **Upgrade the Zod schema** in `src/lib/journey/schemas/*.ts` — restore V1 depth + add V3 enhancements per the audit's per-section plan
2. **Upgrade the runner SKILL.md** — update prompts to produce the richer output and USE more available tools
3. **Upgrade the section runner** — wire additional betaZodTools, increase token budgets
4. **Update the frontend card** — render the restored/new fields

Use the V3 pattern from the audit: streaming-friendly base + rich `detailed` nested object:
```typescript
type V3SectionOutput<TBase, TDetailed> = TBase & {
  detailed?: TDetailed  // Populated after streaming, before persist
}
```

Priority order (from audit):
- Tier 1 MUST RESTORE: ICP psychographics/sensitivity, Synthesis adHooks/angles, Competitor threatAssessment, Media Plan full structure
- Tier 2 SHOULD RESTORE: ICP segmentSizing/triggers, Competitor funnelBreakdown/whiteSpace, Keyword strategicRecommendations
- Tier 3 NICE TO HAVE: Industry macroRisks, Competitor reviewData, Keyword seoAudit

Token budget targets:
| Section | Current | Target |
|---------|---------|--------|
| Industry | 8K | 12K |
| Competitor | 8K | 16K |
| ICP | 8K | 16K |
| Offer | 8K | 10K |
| Synthesis | 10K | 16K |
| Keywords | 4K | 10K |
| Media Plan | 10K | 20K |

#### Sprint 2: Onboarding UX Refinements

Based on the audit's Part 4 recommendations:
1. Move budget collection to Phase 1 (currently Phase 6 — blocks mediaPlan until the very end)
2. Fire `industryResearch` after just businessModel + ICP description (2 fields, not 8)
3. Progressive prefill injection — don't make user review ALL fields before chat starts
4. Add time estimate ("~10 min to complete strategy")
5. Detect volunteered information and skip redundant questions

#### Sprint 3: New SDK Feature Integration

1. **Citations API** — auto-cite web search sources across all runners
2. **Extended Thinking** — enable for ICP + Synthesis runners (deepest analytical sections)
3. **Batch API** — implement "refresh research" feature with 50% cost savings
4. **Token counting** — pre-dispatch validation to route to cheaper models when feasible

### Research Before Planning

Before writing the plan, investigate:
1. Current state of `src/lib/ai/sections/` — how runners are structured, what tools they have
2. Current state of each schema in `src/lib/journey/schemas/*.ts` — exact field counts
3. Current frontend cards — what fields they render, what's hardcoded vs dynamic
4. The V1 schemas — exact field structures to restore
5. Current onboarding flow in practice — trace the trigger chain from `lead-agent-system.ts`
6. Available betaZodTools and which runners actually use them
7. Vercel AI SDK v6 + Anthropic SDK latest features for structured output

### Constraints

- Branch: `aigos-v2`
- All AI calls use `@ai-sdk/anthropic` and `@ai-sdk/perplexity` directly (never OpenRouter)
- betaZodTool wrappers are the MCP pattern (serverless Next.js, no subprocess MCPs)
- Research sections fire sequentially from the user's perspective (not parallel) — progressive reveal UX
- Lead agent stays on Vercel AI SDK (`streamText` + `toUIMessageStreamResponse()`)
- Sub-agent runners use Anthropic SDK directly (`generateText` + `betaZodTools`)
- Tests: Vitest with jsdom. Run `npm run test:run` after changes.
- Build: `npm run build` must pass.
