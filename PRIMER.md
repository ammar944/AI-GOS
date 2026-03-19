# PRIMER.md

## Current Focus
Sprint C: Fix-Then-Wow — all sprints COMPLETE.

## What Was Just Done (2026-03-19 session)

### Sprint C.1: Protect + Verify ✅
- Committed 59 uncommitted files in 2 logical commits
- gstack tooling setup (`592b8c61`)
- UI/design elevation pass — sidebar, right-rail chat, artifact cards, theme system (`f10c7d35`)

### Sprint C.2: Pipeline Reorder + Intelligence Chain ✅
- **Reordered pipeline**: Market → ICP → Offer → Competitors → Keywords → Synthesis → Media Plan (`fe9d66eb`)
- **Intelligence chain**: Generalized enrichment in dispatch route — every runner now gets prior research results from Supabase (not just mediaPlan). Each step is informed by all completed upstream sections.
- Updated system prompt: trigger conditions, execution order, prefill exception
- Required field enforcement (geography, budget) verified already working
- TypeScript passes (only pre-existing test errors)

### Sprint C.3: Hyper-Agent Visual ✅
- **Pipeline progress tracker**: Visual bar showing all 7 steps with active step glowing, completed steps in emerald (`8d14417b`)
- **Enriched activity messages**: Fallback messages now reference the intelligence chain (e.g., "Loading ICP, offer, and market context" for competitors)
- Display-only — zero impact on research generation speed

## Architecture Changes

### Intelligence Chain (NEW — dispatch route)
Each research runner now receives all completed upstream research results via the dispatch route. Pipeline order determines what's "upstream":
```
industryMarket (gets: nothing — first step)
icpValidation  (gets: market results)
offerAnalysis  (gets: market + ICP results)
competitors    (gets: market + ICP + offer results)
keywordIntel   (gets: all above)
crossAnalysis  (gets: all above)
mediaPlan      (gets: all above — was already enriched)
```

### Pipeline Order (CHANGED)
Old: Market → Competitors → ICP → Offer → Keywords → Synthesis → Media Plan
New: Market → ICP → Offer → Competitors → Keywords → Synthesis → Media Plan

## Next Steps
1. **Test with real client** — run a non-SaaS-Launch client through the full journey to verify intelligence chain improves competitor accuracy
2. **Verify pipeline order in practice** — confirm ICP/Offer runners receive and use prior market data
3. **Consider further hyper-agent enhancements** — worker could emit richer progress events (URLs being crawled, data point counts) to replace fallback messages with real data
4. **Light mode / color palette** — lower priority Gilles feedback item
5. **Creatives, campaigns, reporting** — Phase 2 (future sprints, not now)

## Active Files
- `src/lib/workspace/pipeline.ts` — pipeline order
- `src/app/api/journey/dispatch/route.ts` — intelligence chain
- `src/lib/ai/prompts/lead-agent-system.ts` — system prompt
- `src/components/workspace/research-activity-log.tsx` — pipeline progress tracker
- `src/components/workspace/artifact-canvas.tsx` — activity log integration

## Design Doc
`~/.gstack/projects/ammar944-AI-GOS/ammar-redesign-v2-command-center-design-20260319-203617.md`
