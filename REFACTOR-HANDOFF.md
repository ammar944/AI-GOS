# REFACTOR: 7-Runner Pipeline → Agent Loop
## Branch: `refactor/agent-loop-v1`
## Created: 2026-04-22

---

## CONTEXT

This is a **complete rewrite** of the AI-GOS research orchestration layer.
The infrastructure (Railway, Supabase, Next.js) stays. Only the Express
worker’s 7-runner pipeline is replaced with a single Opus 4-7 agent loop.

Previous branch: `redesign/v2-command-center` (stashed work preserved)
Origin branch: `main` (commit `8d742be6`)

---

## 5 COMPOUNDING TAXES (from `DEEP-ARCHITECTURE-FAILURE-REPORT-2026-04-22.md`)

| # | Tax | Location | Impact |
|---|-----|----------|--------|
| 1 | **Model downgrade** | `src/lib/ai/models.ts` — Opus declared, `ai-sdk` never configured to use it | All runners use Sonnet 3.7 or Haiku instead of Opus 4-7 |
| 2 | **Prompt bloat** | `src/lib/prompts/research/competitors.ts` — 10KB+, 18 negative guardrails | 40-50% tokens wasted on “DO NOT” instead of “DO” |
| 3 | **Blind pipeline** | `src/lib/research/wiki-layer.ts` writes wiki but NO runner reads it; `src/lib/ai/runners/intelligence.ts` on Haiku gets flat string | 30% context loss per stage; wiki = write-only DB |
| 4 | **Unvalidated partials** | `src/components/research-sandbox.tsx` line ~776 treats `partial/error` response as `complete` | UI renders garbage/intel data that never passed verification |
| 5 | **Dead evals** | 9 eval files in `src/lib/evals/*` — zero wired to CI | No regression safety net; output quality untested |

---

## TARGET ARCHITECTURE (SIMPLE)

```
┌─────────┐     POST /api/research/stream     ┌─────────────────┐
│ Next.js │ ───────────────────────────────────▶│ Railway Express │
│  (UI)   │           { query, sections[] }   │   (worker)      │
└─────────┘                                   └────────┬────────┘
     ▲                                                  │
     │  streamText() + thinking + tool calls           │
     │  One Opus 4-7 loop                              │
     │  + tools: web_search, firecrawl,              │
     │    spyfu, adLibrary, sonar                     │
     │                                                  ▼
     │                                         ┌─────────────────┐
     │                                         │  Script Pipeline │
     │  + terminal tool:                       │  (gets full      │
     │    submitResearchReport(schema)          │   structured    │
     │                                         │   output)        │
     │                                         └────────┬────────┘
     │                                                  ▼
     │                                         ┌─────────────────┐
     │                                         │  Supabase DB     │
     │                                         └────────┬────────┘
     │                                                  ▼
     │                                         ┌─────────────────┐
     └─────────────────────────────────────────│  Frontend Cards │
                                              │  (parse schema) │
                                              └─────────────────┘
```

### KEY INVARIANTS
- **One model call per research session** — Opus 4-7 with thinking enabled
- **Model sees ALL sections** — one coherent plan across competitors, ICP, offer, keywords, media
- **Terminal schema validates ONCE** at the end — no `partial == complete` bug
- **Full structured output** preserved for script pipeline
- **Streaming reasoning** visible in chat UI (`<ThinkingBlock>`)
- **Same host, same DB, same frontend** — only orchestration code changes

---

## FILES TO CREATE / MODIFY

### NEW FILES (create)
1. `src/lib/ai/agent-loop.ts` — Core agent loop with `streamText()`, tool definitions
2. `src/lib/ai/tools/index.ts` — Tool registry (web_search, firecrawl, spyfu, adLibrary, sonar)
3. `src/lib/ai/terminal-schema.ts` — Zod schema for `submitResearchReport()` output
4. `src/lib/ai/prompts/agent-system.ts` — Single system prompt (replacing 7 prompt files)
5. `src/app/api/research/stream/route.ts` — Streaming route handler

### MODIFY FILES
1. `src/lib/ai/models.ts` — Ensure Opus 4-7 is actually callable (not just declared)
2. `src/lib/ai/runners/index.ts` — Deprecate runner registry, redirect to agent loop
3. `src/components/research-sandbox.tsx` — Fix line ~776: validate terminal schema before marking complete
4. `src/lib/research/wiki-layer.ts` — Remove OR repurpose as vector context cache (read+write)
5. `src/lib/evals/*` — Wire at least ONE eval to CI (GitHub Actions)

### DELETE FILES (after verify)
1. `src/lib/prompts/research/competitors.ts` — Bloat, negative guardrails
2. `src/lib/prompts/research/icp.ts` — Same
3. `src/lib/prompts/research/offer.ts` — Same
4. `src/lib/prompts/research/keywords.ts` — Same
5. `src/lib/prompts/research/synthesize.ts` — Same
6. `src/lib/prompts/research/media-plan.ts` — Same
7. `src/lib/ai/runners/competitors.ts` — Replace with agent loop
8. `src/lib/ai/runners/icp.ts` — Same
9. `src/lib/ai/runners/offer.ts` — Same
10. `src/lib/ai/runners/keywords.ts` — Same
11. `src/lib/ai/runners/synthesize.ts` — Same
12. `src/lib/ai/runners/media-plan.ts` — Same
13. `src/lib/ai/runners/intelligence.ts` — Same (Haiku used here!)

---

## IMPLEMENTATION ORDER

### Phase 1: Agent Loop Skeleton (no tools yet)
1. Create `src/lib/ai/agent-loop.ts`
   - Import `streamText` from `ai-sdk`
   - Configure `model: opus` (ensure `src/lib/ai/models.ts` actually wires it)
   - Enable `thinking: { type: 'enabled', budgetTokens: 4000 }`
   - Accept `{ query, sections[], maxSteps: 20 }`
   - Return `AsyncIterable<StreamPart>` (text + tool calls)
2. Create `src/lib/ai/terminal-schema.ts`
   - Zod schema for final `submitResearchReport` output
   - One schema covering ALL sections (competitors, icp, offer, keywords, mediaPlan)
3. Create `src/lib/ai/prompts/agent-system.ts`
   - Single prompt, "DO" oriented (no negative guardrails)
   - Encourage thinking, research, synthesis
   - Define tool usage strategy
4. Create `src/app/api/research/stream/route.ts`
   - POST handler, calls `agentLoop()`, streams back SSE
5. Wire `src/lib/ai/runners/index.ts` to route everything to agent loop

### Phase 2: Tools
1. `src/lib/ai/tools/index.ts` — registry
2. `src/lib/ai/tools/web-search.ts` — web search tool
3. `src/lib/ai/tools/firecrawl.ts` — scrape tool
4. `src/lib/ai/tools/spyfu.ts` — competitor ad intelligence
5. `src/lib/ai/tools/ad-library.ts` — social ad library
6. `src/lib/ai/tools/sonar.ts` — search grounding
7. Agent loop: import tools, pass to `streamText({ tools })`

### Phase 3: Fix Frontend
1. `src/components/research-sandbox.tsx` line ~776
   - Reject `partial`/`error` — only mark `complete` when `submitResearchReport` returns validated terminal schema
2. Add `<ThinkingBlock>` for streaming reasoning

### Phase 4: Eval + CI
1. Pick one eval file from `src/lib/evals/*`
2. Create `.github/workflows/eval.yml`
3. Run eval on PR (or nightly)

### Phase 5: Delete Dead Code
- Remove the 13 files listed above (after all phases pass)

---

## CRITICAL NOTES

### Opus 4-7 Availability
The model constant says Opus but `ai-sdk` config was NOT updated for it. Verify:
```ts
// src/lib/ai/models.ts
import { anthropic } from '@anthropic-ai/sdk';
export const opus = anthropic({ model: 'claude-opus-4-20250514' });
```
Model name string may need updating based on Anthropic's latest release names.

### Thinking Budget
Opus 4-7 thinking costs: `4000` tokens budget is ~$0.50-1.00 extra per call.
Research context window: 200k tokens. One Opus call with thinking is cheaper than
7 Sonnet calls without thinking (see OUTPUT-QUALITY-AUDIT for math).

### Tool Authentication
All tools need env vars. Add to `.env.example`:
```
FIRECRAWL_API_KEY=
SPYFU_API_KEY=
SONAR_API_KEY=
AD_LIBRARY_ACCESS_TOKEN=
```

### Railway Deployment
After merge, Railway auto-deploys main. The new worker has:
- Same `PORT` env var
- Same Supabase connection
- Same `/api/research/stream` route (but SSE protocol stays consistent)
No infra changes needed.

---

## CONTEXT LOSS MITIGATION
The frontend `journeyStore` already has `loadLatestCompanyIntel()` which pulls
from Supabase. If the agent loop writes the terminal schema to Supabase with
the same structure, the frontend WILL render it. NO CHANGES NEEDED on frontend
schema parsing if terminal schema matches existing `company_intel` table shape.

---

## BRANCH STATE
- Clean working tree
- Based on `main` (8d742be6)
- Previous branch (`redesign/v2-command-center`) has stashed UI work if needed

## FILES CREATED ON THIS BRANCH (committed to redesign/)
- `DEEP-ARCHITECTURE-FAILURE-REPORT-2026-04-22.md`
- `OUTPUT-QUALITY-AUDIT-2026-04-22.md`
- `aigos-architecture-diagram.excalidraw`

## SESSION BOUNDARY
New session should start HERE. Load this file first, then resume from Phase 1.
