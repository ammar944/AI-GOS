# Agentic Loop Patterns (Anthropic Agent SDK + what AI-GOS should adopt)

> **Purpose:** Reference-grade map of how Anthropic (and the Manus team) say to build agent loops, tools, structured outputs, verification, and orchestration — each pattern paired with a concrete AI-GOS application tying it to the lab-engine section runner, the lexical verifier, and the `/orchestrate` fan-out.

## Table of contents
1. [The core loop: gather context → act → verify → repeat](#1-the-core-loop-gather-context--act--verify--repeat)
2. [Workflows vs. agents (start minimal)](#2-workflows-vs-agents-start-minimal)
3. [Tool design](#3-tool-design)
4. [Structured outputs (generateText + Output.object / answer-tool)](#4-structured-outputs-generatetext--outputobject--answer-tool)
5. [Verification: evaluator-optimizer + self-correction](#5-verification-evaluator-optimizer--self-correction)
6. [Orchestrator-worker subagents + context isolation](#6-orchestrator-worker-subagents--context-isolation)
7. [Manus context-engineering lessons](#7-manus-context-engineering-lessons)
8. [Open tensions for AI-GOS](#8-open-tensions-for-ai-gos)

---

## 1. The core loop: gather context → act → verify → repeat

Anthropic's canonical agent loop is **`gather context → take action → verify work → repeat`** ([Building agents with the Claude Agent SDK](https://claude.com/blog/building-agents-with-the-claude-agent-sdk)). Each phase has a job: agents "fetch and update their own contextual information rather than relying solely on initial prompts," "execute tasks using available tools," then "evaluate their own output before proceeding."

At the API level this is the `while stop_reason == "tool_use"` cycle: send tools + message → model returns `stop_reason: "tool_use"` → your code executes the tool → you return a `tool_result` → repeat until `end_turn` ([How tool use works](https://platform.claude.com/docs/en/agents-and-tools/tool-use/how-tool-use-works)). The reliability hinge: "it's crucial for the agents to gain 'ground truth' from the environment at each step (such as tool call results or code execution) to assess its progress" ([Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)).

**AI-GOS application:** Each positioning section runner *is* this loop. `runSectionViaAnswerTool` drives an AI SDK v6 `ToolLoopAgent` whose `stopWhen: [stepCountIs(12), hasSuccessfulAnswerResult]` is the explicit `end_turn` analog — tools fire mid-section (web_search, firecrawl, ad probes), results accumulate as steps, and the final `answer()` call closes the loop (`src/lib/lab-engine/agents/run-section.ts:717`, `section-agent.ts:370-410`). The May-26 "live-in-section-tools" decision (corpus MEMORY) is precisely Anthropic's "gather ground truth at each step" — it killed the synthetic-backfill path where the section invented evidence instead of fetching it.

---

## 2. Workflows vs. agents (start minimal)

Anthropic draws a hard line: **workflows** = "LLMs and tools are orchestrated through predefined code paths"; **agents** = "LLMs dynamically direct their own processes and tool usage." Decision rule: "workflows offer predictability and consistency for well-defined tasks, whereas agents are the better option when flexibility and model-driven decision-making are needed at scale" ([Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)). Strong start-minimal bias: "For many applications, optimizing single LLM calls with retrieval and in-context examples is usually enough" — agents "trade latency and cost for better task performance." Use agents only for "open-ended problems where it's difficult or impossible to predict the required number of steps."

**AI-GOS application:** The pipeline is correctly mixed. Fan-out is a **workflow** (predefined: `/orchestrate` dispatches a fixed set of six sections in bounded waves — `ORCHESTRATOR_CONCURRENCY`, default 3). Inside each section, evidence gathering is an **agent** (step count is unpredictable, so the tool loop is justified). The two read-only sections — `positioningSynthesis` and `positioningPaidMediaPlan` — have **zero tools** (`section-registry.ts`); they are single structured-output calls, which is Anthropic's "single LLM call is usually enough" applied correctly. Audit lens: any section that never benefits from a tool call should be demoted to a workflow node, not run through the agent loop.

---

## 3. Tool design

Anthropic treats tool descriptions as the single highest-leverage lever and the agent-computer interface (ACI) as worth as much investment as a human UI ([Define tools](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools), [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)):

- **Descriptions are decisive.** "Provide extremely detailed descriptions. This is by far the most important factor in tool performance." Aim for "at least 3-4 sentences per tool description"; treat it "like writing a great docstring for a junior developer" — what it does, when to use/not use, every parameter, caveats, what it does *not* return.
- **Minimal, unambiguous toolset.** "If a human engineer can't definitively say which tool should be used in a given situation, an AI agent can't be expected to do better." Avoid "bloated tool sets that cover too much functionality." Use service namespacing (`github_list_prs`) and consolidate related ops under one `action` param.
- **Poka-yoke.** "Change the arguments so that it is harder to make mistakes" — their example: requiring absolute filepaths "eliminated path confusion errors entirely." Tool *responses* should "return only high-signal information."
- **Iterate empirically** in the workbench; "put yourself in the model's shoes."

**AI-GOS application:** Section tool rosters are scoped per section (`getAllowedTools(definition, deps)` → `buildToolMap`, `run-section.ts:3013`), which matches "minimal, unambiguous." `CompetitorLandscape` carries the heaviest roster (web_search, firecrawl, adlibrary, google_ads, meta_ads, reviews — 6 tools, +6 reserved ad lookups); this is the section most exposed to Anthropic's "ambiguous decision point" risk and is the right place to audit tool descriptions first. The orphaned SpyFu/Foreplay tools flagged in the audit are the inverse failure — dead entries in the action space that the model can hallucinate calls to. **Highest-leverage fix:** every tool the runner exposes needs a 3-4 sentence description with explicit "when NOT to use" — currently the lab-engine tools are thin. Note the runner has **no filesystem/bash tool**; everything is web_search/firecrawl/ad/keyword tools (`survey:loop`), so any "read this reference file" affordance must be a real exposed tool, not an assumed capability.

---

## 4. Structured outputs (generateText + Output.object / answer-tool)

Anthropic documents two mechanisms — **strict tool use** (`strict: true`, grammar-constrained sampling guarantees tool inputs match the JSON Schema) and **JSON outputs** (`output_config.format` constrains the final response) — and they compose: "Combine `tool_choice: {"type": "any"}` with strict tool use to guarantee both that one of your tools will be called AND that the tool inputs strictly follow your schema" ([Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)).

The lineage of AI-GOS's answer-tool path is explicit in Anthropic's framing: "if you're writing a regex to extract a decision from model output, that decision should have been a tool call. Parsing free-form text to recover structured intent is a sign the structure belongs in the schema" ([How tool use works](https://platform.claude.com/docs/en/agents-and-tools/tool-use/how-tool-use-works)). Forcing the structured result onto a tool call (rather than a separate free-form generation) is what lets a verifier intercept atomic output.

Critical limitation that justifies a post-hoc verifier: grammar constraints do **not** enforce `minimum`/`maximum`/`multipleOf`, `minLength`/`maxLength`; `enum`/`const` are "stored but not always enforced." The SDKs "automatically transform schemas with unsupported features by removing them" — "your code still enforces all constraints through validation." Output can still violate schema on `stop_reason: "refusal"` or `max_tokens`.

**AI-GOS application:** All six positioning sections route through the answer-tool path (`answerToolSectionIds`, `run-section.ts:721-728`) — the structured artifact rides on the `answer()` tool call, so the verifier teeth and `validateMinimums` business-logic gate can inspect a complete, atomic object. This is *why* the memory note holds: switching to `streamObject` token-streaming "would orphan the fabrication gate," because the verifier needs the whole artifact (e.g. a populated `sources` array) to run. The CLAUDE.md rule "avoid `.min()/.max()` on Zod numbers passed to Anthropic structured-output schemas; use `.describe()`" is the direct codebase consequence of the documented grammar limitation — and `validateMinimums` (e.g. `sources.length >= 3`, market-size triangulation) is exactly the "your code still enforces all constraints" layer Anthropic prescribes (`artifacts/schemas/*.ts`).

---

## 5. Verification: evaluator-optimizer + self-correction

Anthropic ranks verification methods, best → fuzziest ([Claude Agent SDK post](https://claude.com/blog/building-agents-with-the-claude-agent-sdk)):

1. **Rules-based feedback (best).** "The best form of feedback is providing clearly defined rules for an output, then explaining which rules failed and why." Code linting is the exemplar.
2. **Visual feedback** — screenshots/renders.
3. **LLM-as-judge** — a separate model on "fuzzy rules," but "generally not a very robust method" (latency + reliability cost).

The **evaluator-optimizer workflow**: "One LLM call generates a response while another provides evaluation and feedback in a loop." Use it "when we have clear evaluation criteria, and when iterative refinement provides measurable value" ([Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)). The cheapest self-correction primitive is feeding errors back *into* the loop: set `is_error: true` on a `tool_result` so the model reads it and retries ([Define tools](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools)).

**AI-GOS application:** The lexical verifier (`structural-verifier.ts`) is the **rules-based** tier Anthropic ranks highest — it matches claims (URLs exactly; numerics with variants; quotes/text by normalized substring) against the tool-result transcript and corpus, and `evaluateEvidenceSupport` (`evidence-support.ts`) treats unsupported numeric/url claims as load-bearing failures. AI-GOS correctly chose deterministic rules over an LLM grader. The primary → repair loop (max 2 repair attempts, `run-section.ts:3191-3267`) is the **evaluator-optimizer**: a failed verification feeds the specific unsupported-claim issues into `buildRepairPrompt` for the next attempt. Confidence is *replaced* with the grounded ratio `verified / (verified + unsupported)` (`deriveGroundedConfidence`, `run-section.ts:320`) — honest grounding rather than a model-asserted number. **Gaps to close per the audit:** (a) the fabrication gate is advisory-OFF by default (`LAB_VERIFIER_MAX_UNSUPPORTED` defaults to Infinity) — Anthropic's stance argues for making the rule a *required* signal, not opt-in; (b) name the repair ceiling *inside* the repair prompt ("you have at most N attempts; if still unsupported, emit the honest badge and stop"), echoing Cursor's "≤3 linter loops" anti-thrash rule, rather than leaving it only in env config.

---

## 6. Orchestrator-worker subagents + context isolation

**Orchestrator-workers:** "A central LLM dynamically breaks down tasks, delegates them to worker LLMs, and synthesizes their results" — distinct from parallelization because "subtasks aren't pre-defined, but determined by the orchestrator" ([Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)). **Subagents as context isolation:** "Each subagent explores extensively but returns only a condensed, distilled summary of its work (often 1,000-2,000 tokens) to the main agent… the detailed search context remains isolated within sub-agents, while the lead agent focuses on synthesizing and analyzing the results" ([Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)).

**AI-GOS application:** `/orchestrate` is the orchestrator; each section runner is a worker with its own context window. The match is partial: AI-GOS's fan-out is *predefined* (six fixed sections), so it's closer to Anthropic's "parallelization (sectioning)" than to dynamic orchestrator-workers — which is fine, because the section set is known. The isolation principle is the one to enforce: each section runner should receive a **clean, scoped corpus slice**, not the full accumulating transcript, so detailed per-section evidence stays isolated (this also defuses the confirmed VoC bug where the section "ate the subject's own homepage as a pain" — a cross-contamination/grounding failure). The audit's biggest C→B+ lever — **no cross-section synthesis** — is the missing "lead agent synthesizes worker summaries" half of the pattern: `positioningSynthesis` exists as a read-only section but needs the condensed per-section distillations as its input, which is exactly Anthropic's 1-2k-token-summary-back-to-lead shape.

---

## 7. Manus context-engineering lessons

From [Context Engineering for AI Agents: Lessons from Building Manus](https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus) (Yichao 'Peak' Ji), corroborated by the [ZenML case study](https://www.zenml.io/llmops-database/context-engineering-for-production-ai-agents-at-scale). Agents are input-bound (~100:1 input:output ratio), so context discipline dominates cost and latency.

- **Design around the KV-cache.** Cache hit rate is "the single most important metric for a production-stage AI agent" (~$0.30/MTok cached vs $3/MTok uncached on Sonnet — 10×). Keep the prompt prefix byte-stable (no timestamps), make context append-only, use deterministic JSON serialization. **AI-GOS:** the six runners share a corpus prefix; make it byte-identical and timestamp-free, with stable key ordering when serializing `ResearchInput` into the prompt (audit `corpus-to-research-input` and the dispatch envelope). This is the cheapest cost/latency win for the multi-section fan-out.

- **Mask, don't remove tools.** Don't mutate tool defs mid-task — they sit near the front of context, so changing them nukes the cache and orphans references. Constrain availability via logit masking / prefix-grouped names instead. **AI-GOS:** keep one stable tool roster across all section dispatches and gate per-section by state, rather than adding/removing tool defs between sections; this also stops hallucinated calls to the orphaned SpyFu/Foreplay tools.

- **File system as externalized memory.** Offload token-heavy observations to files; keep only a restorable reference (drop a page body, keep its URL). **AI-GOS:** store the full deepResearchProgram corpus once and pass each section a stable handle + only its needed slice, instead of re-inlining the whole corpus into all six prompts — the structural fix for context blowup as section count grows. (Caveat: the runner has no filesystem tool today — `survey:loop` — so "file as memory" here means an externalized store the *runner host* fetches and slices, not on-demand `Read` by the model.)

- **Recite the goal (todo.md trick).** Re-appending the plan into the recent-attention slot fights "lost-in-the-middle" drift over long loops. **AI-GOS:** restate the GTM brief + that section's specific objective at the *end* of each section prompt, not just the top — the lowest-cost grounding lever for the longer single-section loops.

- **Keep the wrong stuff in.** "Leave the wrong turns in the context" — a failed action plus its stack trace shifts the prior away from repeating it. **AI-GOS:** the repair phase should *see* the prior failed attempt + verifier issues, not get a clean re-prompt; verify the runners thread the failure into the repair turn (this is also Anthropic's `is_error`-into-the-loop primitive from §5).

- **Don't get few-shotted.** Uniform repetitive context makes the model mimic its own prior actions. Inject small structured variation. **AI-GOS:** light variation in how each section serializes evidence reduces the copy-the-previous-section rut that drives sections toward sameness.

---

## 8. Open tensions for AI-GOS

- **Start-minimal vs. always-loop.** Anthropic would question any section that runs the agent loop without ever needing a tool. Synthesis/PaidMediaPlan already opt out; audit whether the lighter positioning sections (stub SKILLs: voice-of-customer, demand-intent, offer-diagnostic) genuinely exercise tools or could be cheaper.
- **In-band `is_error` vs. discrete repair pass.** Anthropic prefers returning errors *into* the same loop; AI-GOS's separate repair/rescue phase is a heavier variant. It's defensible (the verifier needs the atomic artifact), but the failed-attempt context must carry forward (Manus lesson 5) or the repair re-prompt loses the learning signal.
- **Rules-based verifier vs. LLM-judge.** AI-GOS correctly chose the lexical rule layer (Anthropic's top tier). Resist adding a model-grader; instead make the existing rule a required gate (flip the advisory-OFF default) and extend it to cross-section synthesis — the named highest-value lever.
- **Progressive disclosure does not transfer.** The SKILL.md files are injected wholesale into the prompt; there is no filesystem/bash runtime, so L1→L2→L3 lazy loading is absent. Treat each SKILL.md as a pre-flattened prompt fragment with a hard token ceiling — port the authoring discipline, not the runtime assumption.
