# AIGOS Output Quality Audit — Advisory Report & Pivot Plan

**Date**: 2026-04-22
**Author session**: strategic advisory + codebase audit
**Classification for follow-on work**: full pivot is `week+` (multi-session, route via `.claude/workspaces/aigos-feature-dev/stages/01-discover/CONTEXT.md`). First POC is `half-day` (scope: one runner + eval harness seed).
**Hand-off purpose**: grounds a new session in the evidence so it doesn't re-audit the codebase from zero.

---

## 1. Thesis (one line)

AIGOS output is worse than raw Opus because five compounding taxes — downgraded models, bloated prompts, rigid inter-stage schemas, an unused wiki layer, and no eval harness — are throttling a frontier model with Software-1.0 scaffolding. The fix is not a new model; it's the terminal-schema agent-loop pattern Anthropic ships in `claude-cookbooks`.

---

## 2. What was investigated and how

Four parallel sub-agent audits + one external best-practices pass. Each with stated budgets per `.claude/rules/exploration-budget.md`.

| Audit | Scope | Budget used |
|---|---|---|
| Models & routing | Every `generateObject`/`streamText` callsite, model strings, fallbacks, thinking mode | 5 min / 25 tool calls |
| Prompts & guardrails | Every runner system prompt — token count, positive-vs-negative instruction ratio | 6 min / 30 tool calls |
| Orchestration & context flow | 8-runner pipeline, wiki layer, schemas, draft→humanize handoff | 6 min / 30 tool calls |
| Reliability & observability | Evals, traces, error surfacing, feedback loop, retry | 5 min / 25 tool calls |
| External research | Karpathy, YC/Gary Tan, Bret Taylor, Anthropic "Building Effective Agents", Harvey, Decagon | 10 min / 20 web calls |
| Cookbook recipes | `github.com/anthropics/claude-cookbooks` top-level layout, canonical agent loop, terminal-schema pattern | 8 min / 15 fetches |
| Agent-loop readiness | Existing `streamText`+tools routes, context builders, wiki.ts, cascade | 6 min / 30 tool calls |

Every finding below is cited to file paths. Where a quote is verbatim, that's marked; paraphrases are flagged.

---

## 3. Evidence — the five taxes, with file:line references

### 3.1 Model tax

- `research-worker/src/runners/models.ts` defines three tiers: `FAST` (Haiku 4-5), `STANDARD` (Sonnet 4-6), `STRONG` (Opus 4-6). `STRONG` is **declared but unused in any runner**.
- Hard-synthesis runners all use `MODELS.STANDARD` (Sonnet 4-6): `industry.ts`, `icp.ts`, `competitors.ts`, `offer.ts`, `keywords.ts`, `synthesize.ts`, `media-plan.ts`. Mapping verified by model-audit subagent — see callsite table below.
- `meeting-extract.ts` correctly uses `MODELS.FAST` (Haiku 4-5-20251001). This is the only runner with an appropriate model choice.
- Chat sidebar at `src/app/api/journey/stream/route.ts` uses `claude-opus-4-6`. The route comment claims "Claude Opus 4.6 with adaptive thinking" but **no `thinking` parameter is passed** — `CLAUDE.md` says adaptive thinking is the default, and reality contradicts that.
- No reference to `claude-opus-4-7` in codebase. You are a full model generation behind.
- `research-worker/src/tools/sonar-research.ts` uses Perplexity `sonar` / `sonar-pro` at lines 214, 480, 684 for competitor disambiguation and discovery. Sonar is a citation-grounded web-search model, not a reasoning model. Reasoning is being outsourced to the retrieval layer.

**Callsite table (from model-audit subagent)**:

| Runner | Primary | Fallback | Temp | Task difficulty | Verdict |
|---|---|---|---|---|---|
| industry.ts | sonnet-4-6 | sonnet-4-6 | 0.3-0.4 | HARD | mismatch |
| icp.ts | sonnet-4-6 | — | — | MEDIUM | mismatch |
| competitors.ts | sonnet-4-6 | sonnet-4-6 | 0.3 | HARD | mismatch |
| offer.ts | sonnet-4-6 | — | — | HARD | mismatch |
| keywords.ts | sonnet-4-6 | sonnet-4-6 | 0.3 | HARD | mismatch |
| synthesize.ts | sonnet-4-6 | — | 0.5 | HARD | mismatch |
| media-plan.ts | sonnet-4-6 | — | — | HARD | mismatch |
| meeting-extract.ts | haiku-4-5-20251001 | — | — | EASY | correct |
| journey/stream | opus-4-6 (no thinking) | — | — | MEDIUM | stale + misconfigured |

### 3.2 Prompt tax

System prompt sizes (from prompt-audit subagent):

| Runner | ~tokens | Positive instructions | Negative guardrails | Verdict |
|---|---|---|---|---|
| industry.ts | 710 | 8 | 11 | BLOATED |
| icp.ts | 525 | 7 | 4 | OK |
| competitors.ts | 1025 | 12 | 18 | OBESE |
| offer.ts | 995 | 9 | 16 | OBESE |
| keywords.ts | 862 | 11 | 8 | BLOATED |
| synthesize.ts | 300 | 6 | 4 | LEAN |
| media-plan.ts | 800 | 8 | 12 | BLOATED |

- `competitors.ts` prompt ends with: `"No citation = no weakness. Generic hallucinated claims like 'too complicated'... are FORBIDDEN..."` — this is one rule split into 5 constraint lines. Schema-level validation would enforce the same thing without taxing the model's reasoning budget.
- `keywords.ts` ships **four cascading system prompts**: primary / repair / heuristic / rescue, ~800 tokens each. The model is re-constrained four times before it finishes. Total prompt overhead: ~3,200 tokens before reasoning begins.
- `offer.ts` has three dedicated "do not" sections: `PRICING DATA INTEGRITY`, `RED FLAGS FOR PAID ADS`, `USER-STATED GROUND TRUTH`.
- Anthropic's own prompting guide ([platform.claude.com prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)) says: if you've added scaffolding to force interim behavior, try removing it. AIGOS has the opposite pattern.

### 3.3 Orchestration tax — the biggest and most invisible

- `research-worker/src/index.ts:320-321` shows every runner receives the same flat `context` string. Runner N+1 does **not** see Runner N's structured output.
- `research-worker/src/index.ts:374` calls `writeWikiEntries` but **no runner reads from the wiki**. The wiki layer exists, is populated, and is never consulted by downstream stages. This is the single most expensive invisible failure.
- `runner-cascade.ts:256-290` implements primary/repair/rescue — but repair uses the same `MODELS.STANDARD` (just smaller `max_tokens`), and repair prompts say "use ONLY the captured evidence." It is a JSON-salvage mechanism, not a quality-lift mechanism.
- Schema rigidity scores:
  - `media-plan.ts`: 5/5 — 6 sequential `generateObject` blocks, channel-mix templates, no escape hatch
  - `industry.ts`: 4/5 — `trendSignals` capped 5-8
  - `synthesize.ts`: 4/5 — `platformRecommendations.role` locked to `[primary, secondary, testing, retargeting]` enum
  - `competitors.ts`: 3/5 — `.min(1)` on competitors array
  - `keywords.ts`: 3/5 — difficulty/confidence enums
  - `offer.ts`, `icp.ts`: 1/5 — tool-based, flexible
- Ad-scripts 2-pass severance: `scripts/stages/03-write/creative-writer.ts` — humanize pass receives the draft only, not the full `researchContext`. Nuance lost in the draft is unrecoverable.

**Data loss per stage (flow diagram from orchestration subagent)**:

```
Runner 1 (industry)    -> Supabase + wiki
Runner 2 (competitors) -> same flat context, ignores wiki
Runner 3 (icp)         -> same flat context, ignores wiki
Runner 4 (offer)       -> same flat context, ignores wiki
Runner 5 (keywords)    -> same flat context, ignores wiki
Runner 6 (synthesize)  -> same flat context, ignores wiki
Runner 7 (media-plan)  -> same flat context, ignores wiki   [-30% context vs ideal]
Scripts pipeline       -> draft + context, but humanize sees draft only  [-10%]
```

Net: every section is written as if it were the only section. The user perceives "a plan" but the model never built one.

### 3.4 Reliability / observability tax

- No Langfuse, no Braintrust, no Helicone, no trace platform of any kind. Grep is clean across `src/` and `research-worker/`.
- Eval infrastructure exists as Phase 0.1 shadow at `research-worker/evals/run-eval.ts` but is **not wired to deploy gates**.
- `runner-cascade.ts:330` returns `{status: 'partial', rawText: ...}` when all stages fail.
- `src/lib/journey/research-sandbox.ts:45` treats `'partial'` and `'error'` identically to `'complete'` for UI rendering. **Users see degraded output as if it were correct.** This is the single largest UX credibility hit: "everything keeps failing" because failures look like successes.
- `.claude/ARCHITECTURE.md` documents: without `RAILWAY_WORKER_URL`, dispatches silently fail. No health check or fallback error state.
- `research-worker/src/tools/apify-ads.ts:~180` returns `[]` on failure — caller cannot distinguish "no ads exist" from "tool errored."
- Feedback loop: `latestFeedbackSection` code exists in journey/stream route but is used only to re-prompt the model. Never aggregated, never compared across runs, never fed back into prompt iteration.
- Tests assert schema shape, not semantic quality. No LLM-as-judge, no golden-set scoring, no regression detection between commits.

### 3.5 UX tax

- Form-driven batch pipeline. User fills fields, submits, waits, gets 8 cards in sequence.
- No streaming reveal of reasoning. No autonomy slider. No way to steer mid-run.
- Bret Taylor ([Stratechery, 2025](https://stratechery.com/2025/an-interview-with-sierra-founder-and-ceo-bret-taylor-about-ai-agents-and-tech-history-lessons/)) on AI agents: they should "identify as AI" and set calibrated expectations. Hiding the agent makes users compare the output to finished human work — the wrong bar.

---

## 4. External research — what the people the user named actually say

Verbatim or cited-paraphrase quotes from the external research subagent:

- **Anthropic, "Building Effective Agents" (Dec 2024), verbatim**: "the most successful implementations [used] simple, composable patterns... not complex frameworks or specialized libraries." Start with "the simplest solution possible, and only increasing complexity when needed," which "might mean not building agentic systems at all." ([anthropic.com](https://www.anthropic.com/research/building-effective-agents))
- **Anthropic, same piece**: agentic systems "often trade latency and cost for better task performance."
- **Anthropic prompting best practices**: if you've added scaffolding to force interim behavior, try removing it. ([platform.claude.com](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices))
- **Karpathy, Software 3.0 / Latent Space writeup (paraphrased)**: LLM apps should be Iron Man suits with "autonomy sliders" — partial-autonomy co-pilots, not fully autonomous agents. "There's still a significant gap between a working demo and a reliable product." ([latent.space/p/s3](https://www.latent.space/p/s3))
- **Karpathy, 2025 year-in-review**: "if you can score it, you can improve it iteratively." ([karpathy.bearblog.dev](https://karpathy.bearblog.dev/year-in-review-2025/))
- **Garry Tan, YC Spring 2025 RFS, verbatim**: "YC wants founders who treat AI agents not as features but as the core operating system of brand-new companies and industries." ([x.com/garrytan](https://x.com/garrytan/status/1920153493492674984))
- **Bret Taylor, Stratechery (paraphrased)**: "AI agents are the atomic unit of enterprise software" — most winners will be "vertical specialists with deep domain expertise."

**Pattern the winners share** (Harvey, Sierra, Decagon, Cursor): frontier model + light scaffolding + heavy evals + outcome UX. None of them chain five stateless sub-model calls with rigid Zod schemas between them. Harvey explicitly moved *from* custom orchestration *to* OpenAI Agent SDK + Tool Bundles ([ZenML case study](https://www.zenml.io/llmops-database/scaling-agent-based-architecture-for-legal-ai-assistant)).

**Three patterns AIGOS is violating**:

1. **Scaffolding tax on a frontier model.** Running Opus behind staged prompts with Zod schemas at each seam loses quality relative to one long-context Opus call.
2. **Workflow where an agent loop fits.** Marketing research is open-ended — shape of answer depends on what the web returns. Per Anthropic's taxonomy, this is the wrong side of the workflow/agent line.
3. **Verification gate masquerading as evals.** `npm run build && npm run test:run` is CI, not eval. Harvey runs nightly canary evals with domain-expert rubrics. Without eval, you cannot tell the scaffolding is hurting — you just feel that output is worse than raw Opus.

---

## 5. Cookbook recipes (the actual prescription)

Source: [`github.com/anthropics/claude-cookbooks`](https://github.com/anthropics/claude-cookbooks)

The repo was renamed from `anthropic-cookbook` → `claude-cookbooks`. All paths below are on `main` branch.

**Canonical agent loop** — `tool_use/customer_service_agent.ipynb` and `extended_thinking/extended_thinking_with_tool_use.ipynb`. The loop is:

```python
while response.stop_reason == "tool_use":
    # run the tools Claude called
    # append tool_result messages
    # re-call the model
```

**One-pass research agent (the target pattern)** — `claude_agent_sdk/00_The_one_liner_research_agent.ipynb`. Registry description: "Build a research agent using Claude Code SDK with WebSearch for autonomous research."

**Workflow vs agent distinction (explicit)** — `patterns/agents/basic_workflows.ipynb`, `patterns/agents/evaluator_optimizer.ipynb`, `patterns/agents/orchestrator_workers.ipynb`. Direct lift of Anthropic's "Building Effective Agents" taxonomy.

**Terminal-schema pattern (replaces generateObject)** — `tool_use/extracting_structured_json.ipynb` and `tool_use/tool_use_with_pydantic.ipynb`. Structure moves from gating to terminal: the agent calls a `submit_report` tool when done, whose inputSchema is your typed contract. You keep type safety; you lose the constraint-tax during reasoning.

**Extended thinking composed with tool use** — `extended_thinking/extended_thinking_with_tool_use.ipynb`. Verbatim: "When using extended thinking with tool use, the model will show its thinking before making tool requests... Claude will not output another thinking block until after the next non-`tool_result` `user` turn." Uses `thinking={"type":"enabled","budget_tokens":2000}` in a multi-turn loop.

**Scale-up patterns for many tools** — `tool_use/tool_search_with_embeddings.ipynb`, `tool_use/programmatic_tool_calling_ptc.ipynb` (model writes code that calls tools, reduces token/latency).

**Context-window survival** — `tool_use/automatic-context-compaction.ipynb`, `tool_use/context_engineering/context_engineering_tools.ipynb`.

**Evals** — `misc/building_evals.ipynb`, `tool_evaluation/tool_evaluation.ipynb`, `managed_agents/CMA_prompt_versioning_and_rollback.ipynb`.

**Recipe to read first for over-scaffolded marketing-research teams**: `claude_agent_sdk/00_The_one_liner_research_agent.ipynb`, then `tool_use/customer_service_agent.ipynb`, then `patterns/agents/basic_workflows.ipynb`.

---

## 6. Framework readiness — AIGOS is ~65-70% there

From the agent-loop-readiness subagent. Honest yes/no list with file paths.

**What exists (reusable as-is)**:

| Building block | File(s) | What it gives us |
|---|---|---|
| 11+ AI SDK v6 tool definitions | `src/lib/ai/chat-tools/` (`queryBlueprint`, `deepDive`, `editBlueprint`, `webResearch`, `deepResearch`, etc.) | Pre-built `tool({ inputSchema, execute })` definitions. Zero rewrite. |
| `streamText` with tools wired | `src/app/api/chat/agent/route.ts`, `chat/media-plan-agent/route.ts`, `journey/stream/route.ts` | Correct AI SDK v6 wiring. Single-turn today; needs `stopWhen`/`maxSteps`. |
| Context builders | `src/lib/journey/context-string.ts`, `src/lib/ai/context-builder.ts`, `src/lib/media-plan/context-builder.ts` | Converts journey state to labeled text blocks. Feeds a long-context Opus call unchanged. |
| Karpathy wiki persistence | `research-worker/src/wiki.ts` | Structured section storage; agent can read it as a tool. |
| Cascade loop (proof of multi-attempt tool-calling) | `research-worker/src/runner-cascade.ts:256-290` | Plumbing for tool retries; can be adapted. |
| Zod contracts (schemas) | `research-worker/src/runners/contracts.ts` | Repurposed as terminal-tool `inputSchema`. No rewrite. |

**What must be built**:

1. **The loop.** Add `stopWhen` / `maxSteps` on a `streamText` call so the model can tool-call, see results, continue. ~50 lines in a new route.
2. **Bundled journey-state helper.** Takes `{urlFields, priorResearch, transcript, goal}` → one system-prompt context block. Composition of three existing builders.
3. **Terminal-schema tools.** Wrap each existing Zod contract as a `submit_<section>` tool. Mechanical.
4. **Decision seam.** Flag on `POST /api/journey/dispatch` to route to agent vs worker. ~1 day.
5. **Eval harness.** Braintrust or Langfuse wire-up + 20-URL golden set + LLM-as-judge rubric. **The rate-limiter for the whole pivot.**

**Verdict**: POC is 2 days. Full pivot is 2-3 weeks, gated by eval harness.

---

## 7. Proposed pivot plan (3 weeks)

### Week 1 — POC + eval harness

**Task 1a (half-day, classify `half-day` per Session Startup Protocol)**: Port `competitors.ts` to an agent-loop route.

- New route: `src/app/api/journey/agent-competitors/route.ts`
- Copy `streamText` wiring from `src/app/api/chat/agent/route.ts`
- Tools: reuse `src/lib/ai/chat-tools/webResearch` + call `research-worker/src/tools/sonar-research.ts` as a tool (not as a reasoning step) + read-back tool for `wiki.ts` + **final `submit_competitors_report` tool** whose `inputSchema` is the current `competitorsSchema` from `research-worker/src/runners/contracts.ts`
- System prompt: ≤250 tokens. Goal + quality bar + "call `submit_competitors_report` when done."
- Model: `claude-opus-4-7`. Extended thinking on, `budget_tokens: 8000`.
- Stop conditions: `submit_competitors_report` called OR `maxSteps: 20`
- Keep existing `research-worker/src/runners/competitors.ts` unchanged — this is a parallel path for comparison.

Why competitors first: it's the most over-constrained runner (1,025 tokens, 18 guardrails) and its failure mode is most visible to users. Biggest signal-to-noise for the POC.

**Task 1b (parallel, half-day)**: Seed eval harness.

- Pick Braintrust (sharper gating) or Langfuse (open, cheaper). This is an open decision — see §9.
- 20 real URLs from existing journey runs in Supabase.
- LLM-as-judge rubric with 5 axes: factual grounding, specificity, positioning sharpness, actionability, non-generic language. Opus-as-judge.
- Run current `competitors.ts` pipeline and new agent-loop route on all 20. Score both. Report delta.

**Gate to proceed**: agent-loop route ≥ pipeline on ≥15/20. If not, debug before porting more.

### Week 2 — two more sections + UX surface

**Task 2a**: Port `synthesize.ts` as second section. It has the highest context-loss cost (sees no prior runner output) and lower schema rigidity, so it's the cleanest second test.

**Task 2b**: Port `media-plan.ts` last because it's the most rigid (5/5) and the hardest port. Collapse its 6 sequential `generateObject` blocks into one agent loop that calls `submit_media_plan_report` when done.

**Task 2c**: Surface reasoning in the UI — streaming thinking + tool calls visible to the user. This is a UX file change, not a model change. Karpathy's autonomy-slider pattern.

**Task 2d**: Fix `research-sandbox.ts:45` — stop rendering `partial` as `complete`. Show degraded-state UI + one-click rerun. This alone recovers user trust regardless of the pivot.

### Week 3 — collapse + cleanup

**Task 3a**: Consider collapsing `synthesize` + `media-plan` + `scripts` into ONE long-context agent call with all tools and all terminal schemas. Anthropic doctrine: start simpler. The staged pipeline was designed for model limitations that Opus 4.7 doesn't have.

**Task 3b**: Kill `research-worker/src/runners/competitors.ts`, `synthesize.ts`, `media-plan.ts` after parity confirmed. Keep `runner-cascade.ts` for fallback only.

**Task 3c**: Wire the wiki as read-back for any remaining pipeline runners (industry, icp, offer, keywords) so even un-ported stages stop rebuilding context from scratch.

**Task 3d**: Update `CLAUDE.md`:
- `claude-opus-4-6` → `claude-opus-4-7` everywhere
- Actually pass `thinking` params in stream routes (your rules claim it's default; reality doesn't back it)
- Add: "terminal-schema via `submit_<section>` tool" to `.claude/rules/ai-sdk-patterns.md`

---

## 8. The framework, stated in one paragraph for the next session

Frontier Claude Opus 4.7 call, extended thinking enabled with 8-16k thinking budget, tool set = `web_search` (native Claude) + existing research tools from `src/lib/ai/chat-tools/` + wiki read-back tool + one final `submit_<section>_report` tool per section. System prompt <300 tokens: goal + quality bar + "call submit_<section>_report when done." Loop runs `while stop_reason == "tool_use"` until the model calls the submit tool. Terminal submission is Zod-validated (existing schemas from `contracts.ts`, repurposed). Streams reasoning and tool calls to UI.

That's the whole framework. It's straight out of `claude_agent_sdk/00_The_one_liner_research_agent.ipynb` + `tool_use/customer_service_agent.ipynb` + `tool_use/extracting_structured_json.ipynb`.

---

## 9. Open decisions for the next session

1. **Eval platform**: Braintrust vs Langfuse vs Helicone. Braintrust = sharper for gated evals; Langfuse = open-source, cheaper, self-hostable. Need a 1-hour spike to decide. **Block on this before week 2.**
2. **Model-version confirmation**: repo references `claude-opus-4-6`. System env claims `claude-opus-4-7` is available. Confirm via `/models` API call before starting POC. If 4-7 isn't GA for the account, use 4-6 with `thinking` enabled.
3. **Worker kill strategy**: hard-kill post-parity vs deprecate-then-remove. Worker is a separate Railway deploy; can be kept as a fallback flag for 30 days.
4. **UX scope**: does the pivot include the streaming-reasoning UI change (task 2c)? If yes, week 2 needs a design handoff. If no, defer — doesn't gate the quality win.
5. **Sonar usage**: kill entirely, or keep for citation-grounded web searches only (not reasoning)? Recommendation: keep as a tool the agent can call for citations, never as a reasoning step.
6. **Legacy cascade**: keep `runner-cascade.ts` for un-ported runners during the transition, or rip it out with each port?

---

## 10. First concrete task for the next session

**Do not** jump to implementation until these are done:

1. Read this report end-to-end.
2. Classify the task per Session Startup Protocol in `CLAUDE.md`. The POC is `half-day`. State the classification.
3. Re-read the three cookbook recipes cited in §5: `00_The_one_liner_research_agent.ipynb`, `customer_service_agent.ipynb`, `extracting_structured_json.ipynb`. Read, not skim.
4. State the rewritten verifiable goal per `.claude/rules/verification.md`:

    > "Build an agent-loop route at `src/app/api/journey/agent-competitors/route.ts` that runs Opus 4.7 with extended thinking + web_search + a terminal `submit_competitors_report` tool. Success: on 3 real URLs from the existing journey history, the route produces output rated equal or better than `research-worker/src/runners/competitors.ts` by an Opus-as-judge rubric."

5. State the budget: 4 hours, 80 tool calls, one session.
6. Then implement.

---

## 11. Files worth reading before starting

Priority order:

1. `.claude/ARCHITECTURE.md` — pipeline and gotchas
2. `.claude/rules/verification.md`, `.claude/rules/ai-sdk-patterns.md`, `.claude/rules/exploration-budget.md` — the contracts every session follows
3. `research-worker/src/runners/competitors.ts` — what you're replacing
4. `research-worker/src/runners/contracts.ts` — the schema you'll repurpose as the submit tool's inputSchema
5. `src/app/api/chat/agent/route.ts` — the `streamText`+tools wiring pattern to clone
6. `src/lib/ai/chat-tools/webResearch.ts` (or whichever is closest) — existing tool definition pattern
7. `src/lib/journey/context-string.ts` — context assembly

---

## 12. References (all sources)

### Anthropic
- [Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)
- [Prompt engineering best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
- [`claude-cookbooks` repo](https://github.com/anthropics/claude-cookbooks)
  - `claude_agent_sdk/00_The_one_liner_research_agent.ipynb`
  - `tool_use/customer_service_agent.ipynb`
  - `tool_use/extracting_structured_json.ipynb`
  - `tool_use/tool_use_with_pydantic.ipynb`
  - `extended_thinking/extended_thinking_with_tool_use.ipynb`
  - `patterns/agents/basic_workflows.ipynb`
  - `patterns/agents/evaluator_optimizer.ipynb`
  - `patterns/agents/orchestrator_workers.ipynb`
  - `tool_use/programmatic_tool_calling_ptc.ipynb`
  - `tool_use/automatic-context-compaction.ipynb`
  - `misc/building_evals.ipynb`

### External thinking
- [Karpathy — 2025 Year in Review](https://karpathy.bearblog.dev/year-in-review-2025/)
- [Karpathy — Software 3.0 / YC AI Startup School writeup](https://www.latent.space/p/s3)
- [Garry Tan — YC Spring 2025 RFS tweet](https://x.com/garrytan/status/1920153493492674984)
- [Bret Taylor — Stratechery interview](https://stratechery.com/2025/an-interview-with-sierra-founder-and-ceo-bret-taylor-about-ai-agents-and-tech-history-lessons/)
- [Harvey — Scaling AI Evaluation Through Expertise](https://www.harvey.ai/blog/scaling-ai-evaluation-through-expertise)
- [Harvey case study — ZenML LLMOps DB](https://www.zenml.io/llmops-database/scaling-agent-based-architecture-for-legal-ai-assistant)
- [Decagon — Evaluation engine](https://decagon.ai/resources/evaluation-engine-ai-agents)
- [Decagon — AI Agent Engine (AOPs)](https://decagon.ai/resources/the-ai-agent-engine)

### AIGOS codebase (primary evidence)
- `research-worker/src/runners/*` — all 8 runners (industry, icp, competitors, offer, keywords, synthesize, media-plan, meeting-extract)
- `research-worker/src/runner-cascade.ts`
- `research-worker/src/runners/contracts.ts`
- `research-worker/src/runners/models.ts`
- `research-worker/src/wiki.ts`
- `research-worker/src/index.ts`
- `research-worker/src/tools/sonar-research.ts`
- `research-worker/src/tools/apify-ads.ts`
- `src/app/api/journey/stream/route.ts`
- `src/app/api/chat/agent/route.ts`
- `src/app/api/chat/media-plan-agent/route.ts`
- `src/lib/ai/chat-tools/*`
- `src/lib/journey/context-string.ts`
- `src/lib/journey/research-sandbox.ts`
- `.claude/ARCHITECTURE.md`
- `.claude/rules/*`

---

**End of report.** Next session: start at §10.
