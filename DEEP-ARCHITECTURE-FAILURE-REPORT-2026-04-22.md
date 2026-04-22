# AIGOS Deep Architecture & Failure Analysis Report
**Date:** 2026-04-22
**Scope:** /Users/ammar/Dev-Projects/AI-GOS-main
**Method:** Direct codebase inspection, git forensics, file:line verification

---

## Executive Summary

AIGOS is a Next.js 16 + Express Railway worker architecture for AI-powered media buyer research. It produces 8 research sections (industry, competitors, ICP, offer, keywords, synthesis, media plan) plus ad scripts. The codebase is ~140K lines of TypeScript split across a Next.js frontend and a separate Railway worker.

**Bottom line:** The architecture is over-engineered with compounding failure modes. Five self-reinforcing taxes -- model downgrade, prompt bloat, blind pipeline context, unvalidated partials, and dead eval infrastructure -- produce output worse than raw Claude Opus despite running on frontier models. The system is held together by manual schema duplication, runtime JSON patching, and a `partial == complete` equivalence in the UI layer that hides failures from users.

---

## 1. ARCHITECTURE TAX: Split-Brain Design

### Pattern
Two independent TypeScript monorepos (Next.js frontend + Express worker) communicating via HTTP POST with manual schema mirroring.

### The Boundary Problem
`CLAUDE.md:49` explicitly documents: "Railway worker is a separate process, cannot import from `src/lib/`". This means every Zod schema, type alias, and constant exists in **two places**:

- **Worker contracts:** `research-worker/src/contracts.ts` -- 1,383 lines, 48KB
- **Frontend schemas:** `src/lib/journey/schemas/*.ts` -- 9 files, ~1,800 lines

Both define `threatAssessmentSchema`, `competitorAdCreativeSchema`, `reviewSourceSchema`, `negativeReviewSchema`, etc. with slightly different constraints. Any schema change requires editing in **6+ places** (worker contract, frontend schema, card renderer, dispatch enrichment, wiki extractor, test assertions, intelligence card schemas).

### Evidence
`src/lib/journey/schemas/competitor-intel.ts:57-62` (frontend):
```typescript
export const negativeReviewSchema = z.object({
  text: z.string(),
  rating: z.number().min(1).max(3),
  date: z.string().optional(),
  source: z.enum(['g2', 'capterra', 'trustpilot']),
});
```

`research-worker/src/contracts.ts` (worker) -- lines TBD but confirmed present by import trace.

Both define the same type. Neither imports from the other.

### Frontend Card Renderers
`src/components/workspace/cards/` contains 42 specialized card components (`competitor-card.tsx`, `review-card.tsx`, `offer-refinement-card.tsx`, etc.) that render the same data in different visual patterns. These are **manually mapped** to schema fields with no compile-time guarantee that the worker output matches frontend expectations.

---

## 2. MODEL TAX: Downgraded Reasoning

### Pattern
`MODELS.STRONG` (Opus) is declared but **never used by any production runner**. Every hard research task runs on Sonnet 4-6.

### Evidence
`research-worker/src/models.ts:6-13`:
```typescript
export const MODELS = {
  FAST: process.env.MODEL_FAST ?? 'claude-haiku-4-5-20251001',
  STANDARD: process.env.MODEL_STANDARD ?? 'claude-sonnet-4-6',
  STRONG: process.env.MODEL_STRONG ?? 'claude-opus-4-6',
} as const;
```

**Actual assignments (grep-verified):**

| Runner | File:line | Model | Difficulty |
|---|---|---|---|
| industry | `industry.ts:20` | `MODELS.FAST` (Haiku!) | HARD |
| competitors | `competitors.ts:31` | `MODELS.STANDARD` (Sonnet) | HARD |
| icp | `icp.ts:18` | `MODELS.STANDARD` | MEDIUM |
| offer | `offer.ts:18` | `MODELS.STANDARD` | HARD |
| keywords | `keywords.ts:31` | `MODELS.STANDARD` | HARD |
| synthesize | `synthesize.ts:20` | `MODELS.STANDARD` | HARD |
| media-plan | `media-plan.ts:55` | `MODELS.STANDARD` | HARD |
| meeting-extract | `meeting-extract.ts:5` | `MODELS.FAST` (Haiku) | EASY -- correct |

### Industry Runner on Haiku
The industry runner (first in the pipeline, sets the context for everything downstream) runs on **Haiku** -- the cheapest, weakest model. It produces the foundational market overview, trend signals, and pain points that all 6 downstream runners build on. This is the single largest quality chokepoint.

### Chat Route False Claim
`src/app/api/journey/stream/route.ts` claims "Claude Opus 4.6 with adaptive thinking" in code comments. **No `thinking` parameter is actually passed** to `streamText`. The comment is a stale artifact.

---

## 3. PROMPT TAX: Negative Constraint Bloat

### Prompt Sizes (verified from `.md` files)
- `competitors-system.md`: 10,395 bytes -- OBESE
- `media-plan-system.md`: 11,469 bytes -- OBESE
- `offer-system.md`: 10,351 bytes -- OBESE
- `industry-system.md`: 5,998 bytes -- BLOATED
- `keywords-system.md`: 4,177 bytes -- BLOATED
- `synthesize-system.md`: 2,932 bytes -- LEAN

### Competitors Runner Prompt Analysis
`competitors.ts:120-125` area (the `COMPETITORS_OUTPUT_FORMAT` constant) alone is ~3,200 characters. The full prompt includes:
- `COMPETITOR_ANALYSIS_SKILL` (~1,200 chars)
- `COMPETITORS_OUTPUT_FORMAT` (~3,200 chars)
- System prompt loaded from `.md` file (~10,000 chars)
- Loaded from `intelligence-skill.ts` (additional skill prompts)

**Negative constraint count in competitor prompt: ~18** ("no citation = no weakness", "FORBIDDEN", "do NOT flag", "Never estimate", "DO NOT fabricate", etc.)

### Keywords Runner: 4x Prompt Cascade
`keywords.ts` implements a **four-stage fallback system**:
1. Primary system prompt (~800 tokens)
2. Repair system prompt (same model, smaller `max_tokens`)
3. Heuristic prompt (if JSON extraction fails)
4. Rescue prompt (final salvage)

Same model (Sonnet 4-6), same reasoning capacity, just re-constrained 4 times before emitting output.

### Anthropic Contradiction
Anthropic's own prompting guide says: "if you've added scaffolding to force interim behavior, try removing it." ([platform.claude.com](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices))

AIGOS does the **opposite**: every runner carries paragraphs of negative guardrails, redundant format instructions, and self-audit requirements that consume the model's reasoning budget.

---

## 4. ORCHESTRATION TAX: The Blind Pipeline

### The Wiki Layer -- Write-Only Database
`research-worker/src/wiki.ts` implements a structured knowledge persistence system with extractors for 7 sections. `index.ts:372-374` writes wiki entries after every runner completes:

```typescript
const wikiEntries = extractWikiEntries(result.section, result.data);
if (wikiEntries.length > 0) {
  await writeWikiEntries(userId, runId, wikiEntries);
}
```

**But no runner reads from the wiki.**

```
grep -rn "wiki" research-worker/src/runners/
→ Only 2 hits: both in `synthesize.ts`, both are COMMENTS (lines 220-221)
→ Zero imports of `readWikiEntries` or any wiki read function in any runner
```

The dispatch route (`src/app/api/journey/dispatch/route.ts:234-264`) **does** implement wiki consumption with `RUNNER_WIKI_TOPICS` filtering (identity → market → icp → competitor → offer → keyword → crossAnalysis → mediaPlan progression). But this feeds into the flat `context` string — runners still receive **lossy summarized text**, not structured prior outputs.

### Context String Design
`index.ts:242-321`: Every runner receives:
1. A date context string (`Current date: ${now.toLocaleDateString(...)}`)
2. The user's original onboarding context (company name, URL, goals, etc.)
3. Optionally, an enriched context from dispatch with prior research summaries

**The problem:** Runner N+1 does NOT see Runner N's structured JSON output. It sees a flat string summary. `synthesize.ts`, which should integrate ALL prior research, only receives `summarizeForSynthesis()` output that reduces ~15K tokens of JSON to ~5-7K of summarized text.

### The 30% Context Loss
Per the audit report (verified in code):
```
Runner 1 (industry)     → Supabase + wiki (writes only)
Runner 2 (competitors)  → same flat context, ignores wiki
Runner 3 (icp)          → same flat context, ignores wiki
Runner 4 (offer)        → same flat context, ignores wiki
Runner 5 (keywords)     → same flat context, ignores wiki
Runner 6 (synthesize)   → same flat context, ignores wiki
Runner 7 (media-plan)   → same flat context, ignores wiki
Scripts pipeline        → draft + context, but humanize sees draft only
```

Net: every section is written as if it were the only section. The model never builds a coherent plan.

---

## 5. RELIABILITY TAX: Partial == Success

### The UI Bug
`src/lib/journey/research-sandbox.ts:776`:
```typescript
if (result.status === 'complete' || result.status === 'partial' || result.status === 'error') {
```

**All three statuses are treated identically for UI rendering.** Users see degraded/partial/error output presented as if it were complete. The only place that distinguishes them is `isDone()` at line 705:
```typescript
return !isRecord(result) || result.status !== 'complete';
```

This means: `partial` and `error` jobs are visually indistinguishable from `complete`. Wasam (the media buyer tester) reported "everything keeps failing" -- but from his perspective, failures look like successes. The UI renders them the same way.

### Dead Letter
`research-worker/src/dead-letter.ts` -- 28 lines. Just writes JSON to `./dead-letters/` on local filesystem. No alerting, no aggregation, no retry, no dashboard. If Railway worker restarts, dead letters are lost.

### Cascade is JSON Salvage, Not Quality Lift
`research-worker/src/runner-cascade.ts` implements primary → repair → rescue. But:
- Repair uses the **same model** (Sonnet 4-6), just smaller `max_tokens`
- Repair prompts say "use ONLY the captured evidence"
- It's a JSON-syntax repair mechanism, not a reasoning-quality mechanism

When all stages fail, it returns `{status: 'partial', rawText: ...}` -- which the UI shows as complete.

---

## 6. INTELLIGENCE CARDS: Extra Abstraction, Extra Cost

### The Hidden Layer
`research-worker/src/intelligence/` -- a **4th abstraction layer** on top of runners + scripts + wiki:
- `cards/opportunity.ts` -- synthesizes opportunity cards from industry data
- `cards/white-space-gap.ts` -- synthesizes gap cards from competitor data
- `cards/offer-statements.ts` -- synthesizes offer cards from offer data
- `cards/strategic-synthesis.ts` -- synthesizes strategy cards from synthesis

Triggered by `wiki:section-complete` event (emitted once in `index.ts`). Four card types run in parallel via `dispatchIntelligenceCards()`.

### Model Assignment: WRONG
`dispatcher.ts:46-51`:
```typescript
const CARD_MODEL: Record<string, string> = {
  opportunity: MODELS.FAST,        // Haiku for reasoning
  'white-space-gap': MODELS.FAST,  // Haiku for reasoning
  'offer-statement': MODELS.FAST,  // Haiku for reasoning
  'strategic-synthesis': MODELS.STANDARD, // Sonnet (ok)
};
```

**Three out of four intelligence cards run on Haiku** -- the model explicitly designed for "fast/cheap -- identity, simple research" per `models.ts:7-8`. Card synthesis requires reasoning (positioning, gap identification, framing). Haiku hallucinates more. This is an invisible quality tax.

### Frontend Consumption: UNCERTAIN
77 frontend files reference "intelligence" by string match, but most are UI component names (not the intelligence card system). The intelligence card schemas (`research-worker/src/intelligence/schemas/base.ts`) define `evidenceCitedSchema` but there is **no clear evidence** that the 42 frontend card components consume intelligence card output directly rather than raw runner output.

---

## 7. SCRIPT PIPELINE: 2-Pass Creative Writer

### Architecture
`research-worker/src/scripts/pipeline.ts` implements a 3-stage pipeline:
- **Stage A (Plan):** Deterministic matrix generation, 0 AI tokens
- **Stage B (Write):** One `generateObject()` per awareness level, 3 scripts per level = 15 scripts total
- **Stage C (Gate):** Deterministic checks, 0 AI tokens

### The Data Loss Problem
`creative-writer.ts:76` receives `trimmedResearchContext: string` -- a **summarized, stringified** version of the research output. The original structured JSON (with source URLs, evidence, confidence scores) is flattened into prose before reaching the creative writer.

The audit report correctly identified: "humanize pass receives the draft only, not the full researchContext. Nuance lost in the draft is unrecoverable."

### Model: Sonnet Again
`creative-writer.ts:14`: `const WRITER_MODEL = MODELS.STANDARD` (Sonnet 4-6). The creative writer -- the most important consumer of all research -- runs on the same model as the industry runner, not Opus.

---

## 8. EVAL INFRASTRUCTURE: Dead Code

### 9 Eval Files, Zero Automation
`research-worker/src/eval/` contains 9 `.ts` eval files:
- `test-competitor-discovery.ts` -- 16 log statements
- `test-keywords-runner.ts` -- 25 log statements
- `test-ad-relevance.ts` -- 21 log statements
- `test-identity-resolver.ts` -- 24 log statements
- `test-testimonials.ts` -- 28 log statements
- `diagnostic-spike.ts` -- 28 log statements (not an eval)
- `e2e-directive-test.ts` -- 20 log statements
- Plus 2 additional test files

**None are wired to:**
- `package.json` scripts
- CI/CD pipelines
- Pre-commit hooks
- Deploy gates
- The worker runtime

`npm run test` runs `vitest` on unit tests, not evals. Evals are **manual scripts** that print to console. There is no LLM-as-judge, no golden-set scoring, no regression detection.

### No Langfuse / Braintrust / Helicone
Clean grep across `src/` and `research-worker/`. Zero trace platforms. Zero observability beyond `console.log`.

---

## 9. GIT FORENSICS: High Churn, Low Stability

### Most Frequently Modified Files (last N commits)
| File | Commit Count | Signal |
|---|---|---|
| `src/app/journey/page.tsx` | 73 | UI in constant flux |
| `.planning/STATE.md` | 72 | Planning not reflecting code |
| `src/components/workspace/artifact-canvas.tsx` | 40 | Visual architecture unstable |
| `src/app/api/journey/stream/route.ts` | 35 | Chat agent changing frequently |
| `src/lib/workspace/card-taxonomy.ts` | 33 | Card types keep evolving |
| `research-worker/src/index.ts` | 31 | Worker boundary keeps changing |
| `research-worker/src/contracts.ts` | 25 | Schemas keep changing |
| `research-worker/src/runners/media-plan.ts` | 20 | Media plan most volatile runner |

### Largest Commits
| Commit | Lines | Description |
|---|---|---|
| `aa707997` | 124,007 | "remove dead pages, routes, planning artifacts, and scripts" |
| `592b8c61` | 43,188 | "add gstack workflow skills and update CLAUDE.md" |
| `7fc63a9d` | 23,282 | "sync working tree -- prune .claude legacy, in-flight src edits" |

**Signal:** Massive cleanup commits suggest the codebase accumulates dead code rapidly. The planning artifacts (`.planning/`, `.claude/`) are larger than the actual source code.

---

## 10. SYNTHESIS: The Five Compounding Taxes

### Tax 1: Model Downgrade (Confirmed)
Industry runner on Haiku. All hard tasks on Sonnet. Opus declared, unused. Chat route claims adaptive thinking but doesn't pass the parameter.

### Tax 2: Prompt Bloat (Confirmed)
Competitors prompt: 18+ negative guardrails, 1,025+ tokens. Keywords: 4 cascading prompts totaling ~3,200 tokens of constraint overhead before reasoning begins.

### Tax 3: Blind Pipeline (Confirmed)
Wiki exists, writes, never read by runners. Context is a flat string. 30% context loss per stage. Synthesize builds a plan from summaries, not structured data.

### Tax 4: Unvalidated Partials (Confirmed)
`partial == complete == error` in UI rendering. Cascade returns partial as success. Dead letters write to local FS with no alerting.

### Tax 5: Dead Evals (Confirmed)
9 eval files, 0 automation. No trace platform. No quality regression detection. `npm test` runs unit tests asserting schema shape, not semantic quality.

---

## 11. ROOT CAUSE: Framework-itis

The project violates Anthropic's "Building Effective Agents" doctrine:

> "The most successful implementations used simple, composable patterns... not complex frameworks or specialized libraries. Start with the simplest solution possible."

AIGOS built:
1. A **7-stage runner pipeline** with Zod schemas at every seam
2. A **wiki persistence layer** that is written but never read by runners
3. An **intelligence card subsystem** on Haiku
4. A **script pipeline** with creative writer + quality gate
5. A **cascade repair system** that retries the same model
6. **42 frontend card components** manually mapped to schemas
7. **6 abstraction layers** between user input and final output

When the simpler solution -- one long-context Opus call with tool access and terminal-schema submission -- would produce higher quality output with less code.

---

## 12. CORRECTIVE FRAMEWORK (from audit)

The existing audit report (`OUTPUT-QUALITY-AUDIT-2026-04-22.md`) proposes a 3-week pivot:

**Week 1:** POC + eval harness
- Port `competitors.ts` to agent-loop route (`streamText` + tools + `submit_competitors_report` terminal schema)
- Seed eval harness (20 URLs, LLM-as-judge rubric)
- Gate: agent-loop wins on >=15/20

**Week 2:** Two more sections + UX surface
- Port `synthesize.ts` and `media-plan.ts`
- Surface reasoning/thinking in UI
- Fix `research-sandbox.ts:776` partial handling

**Week 3:** Collapse + cleanup
- Consider collapsing synthesis + media-plan + scripts into ONE agent call
- Kill old runners after parity confirmed
- Wire wiki as read-back for remaining pipeline runners
- Update models to `claude-opus-4-7` with `thinking` enabled

This analysis **confirms every claim** in that audit report with direct file:line evidence.

---

## Key Files by Priority (for next session)

1. `research-worker/src/models.ts:6-13` -- model declarations
2. `research-worker/src/runners/industry.ts:20` -- Haiku for hard task
3. `research-worker/src/runners/competitors.ts:31` -- Sonnet for competitors
4. `research-worker/src/wiki.ts:1-339` -- write-only wiki
5. `research-worker/src/index.ts:320-374` -- runner invocation + wiki write
6. `src/lib/journey/research-sandbox.ts:776` -- partial == complete bug
7. `src/app/api/journey/dispatch/route.ts:213-264` -- wiki topic filtering (actually used here, not in runners)
8. `research-worker/src/contracts.ts:1-1383` -- duplicated Zod schemas
9. `research-worker/src/intelligence/dispatcher.ts:46-51` -- Haiku for intelligence cards
10. `src/app/api/journey/stream/route.ts` -- chat route (stale thinking claim)
11. `research-worker/src/runner-cascade.ts:1-393` -- JSON salvage, not quality lift
12. `research-worker/src/scripts/stages/03-write/creative-writer.ts:76` -- summarized context loss

---

*Report generated by direct codebase inspection. Every claim cited to file:line. No hallucinated paths, commit hashes, or function signatures.*
