# PRIMER.md

## Current Focus
Sprint C: Fix-Then-Wow. Design doc approved at `~/.gstack/projects/ammar944-AI-GOS/ammar-redesign-v2-command-center-design-20260319-203617.md`.

## What Was Just Done
- **Sprint C.1 DONE**: Committed 59 uncommitted files in 2 logical commits (gstack tooling + UI/design elevation pass)
- **Sprint C.2 DONE**: Pipeline reorder + intelligence chain
  - Reordered: Market → ICP → Offer → Competitors → Keywords → Synthesis → Media Plan
  - Generalized intelligence enrichment in dispatch route — every runner now gets prior research results from Supabase (not just mediaPlan)
  - Updated system prompt: trigger conditions, execution order, prefill exception all reflect new order
  - TypeScript passes (only pre-existing test errors)

## What's Left (Sprint C.2 remaining)
- Required field enforcement (geography, budget) in onboarding wizard — needs Zod validation
- Continue button loading state during AI extraction

## Sprint C.3: Hyper-Agent Visual Experience (not started)
- Design the research activity feed using Refero → Magic UI → UI/UX Pro Max workflow
- Worker emits granular status events
- Frontend renders live activity stream
- Integrate with Supabase realtime

## Active Files
- `src/lib/workspace/pipeline.ts` — pipeline order (reordered)
- `src/app/api/journey/dispatch/route.ts` — intelligence chain (generalized)
- `src/lib/ai/prompts/lead-agent-system.ts` — system prompt (updated order + triggers)

## Key Architecture Decision
**Sequential intelligence chain**: Each research runner now receives all completed upstream research results via the dispatch route. The pipeline order determines what's "upstream." This means the competitor runner now has ICP + offer context, which should fix the "wrong competitors" problem Gilles flagged.

## Open Blockers
- None for current sprint

## What To Verify Next
- Run a real client through the full journey to confirm the new order works
- Verify that ICP runner receives market data, offer runner receives market+ICP, competitors receive all three
- Check that the Supabase `research_results` JSONB keys match the pipeline section names
