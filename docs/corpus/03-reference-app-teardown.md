# Reference-App Teardown: v0 / Lovable / Cursor / Manus

> Purpose: Distill the agentic loop, artifact/preview UX, and instruction-design patterns of four production agent apps (v0, Lovable, Cursor, Manus) into concrete adoption decisions for the AI-GOS lab-engine section runner. Verifiable-vs-community-sourced is marked throughout.

## Table of Contents

1. [Reading this document](#1-reading-this-document)
2. [v0 (Vercel)](#2-v0-vercel)
3. [Lovable](#3-lovable)
4. [Cursor](#4-cursor)
5. [Manus](#5-manus)
6. [Synthesis: pattern → apps → AI-GOS decision](#6-synthesis-pattern--apps--ai-gos-decision)
7. [The load-bearing constraint](#7-the-load-bearing-constraint-ai-gos-has-no-filesystem-runtime)

---

## 1. Reading this document

Three provenance tiers, marked inline:

- **[verified]** — from official vendor docs/blog posts (cited URLs).
- **[community-sourced]** — leaked/reverse-engineered system prompts (x1xhlol, jujumilk3, doingwith.ai). Indicative, not authoritative; production prompts drift from leaks.
- **[third-party]** — independent teardowns/writeups, lower confidence.

AI-GOS context this maps onto: 6 positioning section runners, each `primary → repair → rescue`, answer-tool path emitting an atomic typed artifact, lexical verifier teeth that flag unsupported numeric/url claims (`structural-verifier.ts`, `evidence-support.ts`), in-process (not browser fan-out), ~$2/run. The runner has NO filesystem and NO `Read`/`bash` tool at run time — only `web_search`, `firecrawl`, ad-library, keyword, and `pagespeed` tools. That constraint governs which patterns transfer (see §7).

---

## 2. v0 (Vercel)

### Agentic loop

"Agentic Mode": coordinated agents handling planning → research → code generation → debugging, auto-selecting models per step. **[verified]** (https://v0.app/docs/agentic-features)

- **Plan / research** — embeddings + keyword matching detect intent and inject a *dynamic system prompt* (detecting "AI SDK" injects version-specific docs). A read-only, hand-curated, LLM-optimized code-sample filesystem is searchable by the model. Real-time web search fires when current info is needed; results render inline with clickable source links. **[verified]** (https://vercel.com/blog/how-we-made-v0-an-effective-coding-agent)
- **Generate → render** — code streams into a live preview pane.
- **Iterate / self-heal** — v0 can open the app it built, use it, critique, debug, send screenshots of what it sees; "Fix with v0" feeds error logs back; it remembers prior actions in-conversation. **[verified]**

### Artifact / preview UX

The non-obvious part: v0 does **not** dump raw model tokens into the preview. It runs a streaming-interception pipeline so the *first* render is correct. **[verified]** (both Vercel blog posts above + https://vercel.com/blog/v0-composite-model-family)

- **"LLM Suspense"** — streaming find/replace on the token stream as it flows; invalid icon imports are swapped for the nearest valid match from a vector DB "within 100 milliseconds" mid-stream.
- **Autofixers** — deterministic + model-driven repairs running "in under 250 milliseconds and only when needed" (wrapping React Query in providers, completing `package.json`, repairing JSX/TS).
- **Composite model** — frontier base model + a custom RFT-trained `vercel-autofixer-01` that fixes errors mid-stream and in a final pass, plus a linter on final output. Claimed effect: error-free generation ~58–65% (raw) → ~94% (v0-1.5-md).
- Every agent step (tool execution, web-search citation, browser screenshot) renders as its own **visible typed card**; the thread is the progress UI. Always interruptible (Stop button).
- AI SDK primitive that backs live artifacts: **Data Parts written-by-ID** — `writer.write({ type: 'data-weather', id, data })`, re-written by the same `id` to update in place; tool parts stream `input-streaming → input-available → output-available`. **[verified]** (https://vercel.com/blog/ai-sdk-5)

### Instruction-design patterns **[community-sourced]**

From the widely-circulated leaked v0 prompt (~15 instructions validated by leakers; treat as approximate). (https://www.doingwith.ai/articles/exploring-the-v0-dev-system-prompt, https://github.com/yours-flow/leaked-prompts)

- **Mandatory `<Thinking/>` before responding** — plan-before-emit enforced at the prompt level.
- **Self-contained, complete artifacts** — "ALWAYS writes COMPLETE code snippets… NEVER writes partial code snippets or comments for the user to fill in."
- **Structured artifact envelope** — code fences carry typed metadata: `` ```tsx project="Name" file="path" type="react" `` — machine-parseable, not free text.
- **Opinionated constrained defaults** — Lucide icons, shadcn/ui, "DOES NOT use indigo or blue unless specified," responsive + a11y baseline.
- **Bounded refusals** — fixed refusal string.

### What AI-GOS adopts

1. **Stream typed partial section artifacts via Data Parts written-by-ID.** Don't fight the atomic-output model (the verifier teeth couple to final output; switching to `streamObject` token-streaming orphans the fabrication gate). Instead emit a `data-section` part keyed by section id, re-written in place: `skeleton → partial → verified`. This is v0's exact live-preview primitive and sidesteps the architecture fork.
2. **v0-style suspense/autofix pass before render.** AI-GOS's analog of icon-vector-DB repair: a deterministic post-stream pass (target <250ms) that renders the honest badge inline mid-render rather than only at commit, so the user sees a corrected/badged card on first render.
3. **Dynamic per-section-intent prompt injection** — v0 injects version-specific docs via embeddings. Adopt the read-only curated-corpus search idea so each positioning runner pulls section-specific evidence standards/examples instead of carrying everything. After the synthesis capstone shipped, the remaining gap is not "no synthesis" but making the section summaries and shared corpus more compact, deterministic, and citation-friendly.

NOT adopted: single-file/inline-everything constraint and React-specific rules (AI-GOS artifacts are typed research data, not JSX); full multi-agent coordinator (bounded-concurrency orchestrator is the right altitude).

---

## 3. Lovable

### Agentic loop

Goal+context → change plan → patches across layers (frontend/API/data/integrations) → rebuild → deploy-to-preview → feedback. Design principle: **each step must be verifiable and reversible.** **[third-party]** (https://system-design.space/en/chapter/lovable-startup-architecture/, https://docs.lovable.dev/tips-tricks/best-practice)

### Artifact / preview UX

Split-pane: chat left, **live iframe preview right**; code changes render in preview immediately. The tight visible feedback loop is the product. Stack is hard-constrained (React/Vite/Tailwind/TS + Supabase only), enforced *in the system prompt* so the model refuses out-of-stack requests rather than hallucinating Vue/Next/Python. **[third-party]**

### Instruction-design patterns **[community-sourced]**

From the leaked Lovable agent prompt. (https://github.com/x1xhlol/system-prompts-and-models-of-ai-tools/blob/main/Lovable/Agent%20Prompt.txt)

- **Cardinal Rule: "NEVER read files already in 'useful-context'"** — don't re-read what's in context.
- **Tool batching** — "invoke all relevant tools simultaneously… NEVER make sequential tool calls when they can be combined."
- **Analyze debug output before acting** — `read-console-logs` / `read-network-requests` tools; read before changing.
- **Mode gating via action words** — defaults to discuss/plan; only implements on explicit action verbs (separates "think" from "do").
- **Output discipline** — "fewer than 2 lines of text" unless asked; communicate action before performing; conclude concisely; "if unsure about scope, ask for clarification rather than guessing."

### What AI-GOS adopts

1. **Restate-the-ask before fan-out.** AI-GOS already gates fan-out behind the GTM Brief Review form. Add Lovable's restate move to the orchestrator: a one-line "here is the positioning question each section answers, derived from your brief" echo before dispatching. Cheap anti-misalignment.
2. **Tool batching in section runners.** Batch independent SearchAPI/fetch lookups in a single step (relevant to the flagged CompetitorLandscape latency watch).
3. **Fixed conclude-contract per SKILL.md** — borrow "communicate action; conclude concisely; cite sources." Formalize the numbered-sources footer (already shipped) as a prompt-level required output block: confidence note + source-gap note + numbered sources.

NOT adopted: hard single-stack refusal (AI-GOS sections are not codegen); chat-first interaction (AI-GOS is form-driven by design).

---

## 4. Cursor

### Agentic loop

research → plan → edit → run → verify → iterate. Turns are short and tool-heavy; iteration continues "until all tests pass." Context gathering is **pull-on-demand** (grep + semantic search; the agent finds context rather than being hand-fed). **[verified]** (https://cursor.com/blog/agent-best-practices)

- **Plan Mode is a first-class artifact, not a chat turn.** Agent clarifies → researches → emits an *editable Markdown plan with file paths and code references* → user edits inline → "build from plan when ready." Plans persist to `.cursor/plans/`. Operational rule: when a build goes wrong, **don't patch via follow-up prompts — revert, refine the plan, re-run.** The plan is the unit of correction. **[verified]** (https://cursor.com/blog/plan-mode, https://cursor.com/docs/agent/plan-mode)
- **Verification via external signals** — typed languages + linters give "clear signals for whether changes are correct"; write tests first, confirm they fail, instruct the agent NOT to modify them, iterate to green. Warning: "AI-generated code can look right while being subtly wrong." **[verified]**

### Artifact / preview UX

Edits are applied to files (never dumped to chat); generated code "must be run immediately." Diff review + Bugbot is the human gate. Sub-30s turns. **[verified]** / **[community-sourced]** for the chat-output rule.

### Instruction-design patterns **[community-sourced]**

Cursor agent prompt (Claude 3.7). (https://github.com/jujumilk3/leaked-system-prompts/blob/main/cursor-ide-agent-claude-sonnet-3.7_20250309.md)

- "NEVER output code to the USER… use one of the code edit tools."
- "Always group together edits to the same file in a single edit file tool call."
- **Bounded self-repair: "Do not loop more than 3 times on fixing linter errors on the same file."** — anti-thrash circuit breaker.
- "Before calling each tool, first explain to the USER why" but "NEVER refer to tool names when speaking to the USER."
- Ambient context (open files, cursor position, recent edits, linter errors) injected automatically.

### What AI-GOS adopts

1. **Bounded self-repair ceiling, named in the prompt.** AI-GOS half-has this via env config (`answerToolMaxRepairAttempts=2`, `LAB_VERIFIER_MAX_UNSUPPORTED`). Make the ceiling explicit *inside* the repair-phase prompt: "you have at most N repair attempts; if still unsupported, emit the honest-badge and stop." Prevents thrash.
2. **Plan-as-correction-surface for re-runs.** `rerun-section` should feed a *brief delta*, not free-text chat. The brief is the plan; corrections edit the brief, then re-fan-out (matches the "journey is form-driven" rule).
3. **External-signal verification as required, not advisory.** Cursor treats types/linters/tests as ground truth. The C→A+ audit flagged the AI-GOS fabrication gate as advisory-OFF by default. Adopt Cursor's stance: the verifier is a signal the runner must pass or honestly badge.

NOT adopted: ambient-IDE-context injection (no editor surface); "never name tools to the user" (AI-GOS *wants* visible tool cards, per v0 §2).

---

## 5. Manus

Primary source: "Context Engineering for AI Agents: Lessons from Building Manus," Yichao 'Peak' Ji (Manus co-founder). **[verified]** (https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus). Architecture corroboration **[third-party]**: https://www.zenml.io/llmops-database/context-engineering-for-production-ai-agents-at-scale

### Agentic loop

select action → execute → observe → append both to context → repeat. Typical task ~50 tool calls; production spans hundreds of turns. **Input:output token ratio ~100:1** — agents are overwhelmingly input-bound, which is why cache discipline dominates cost. Functional multi-agent split: executor + planner + knowledge-management agent.

### Artifact / context UX (the six lessons)

1. **Design around the KV-cache.** Cache hit rate is "the single most important metric for a production-stage AI agent." Claude Sonnet: cached ~$0.30/MTok vs $3/MTok uncached (10x). Keep the prompt prefix byte-stable (no timestamps in system prompt), make context append-only, deterministic JSON serialization.
2. **Mask, don't remove (stable tool space).** Don't add/remove tools mid-task — tool defs sit near context front; mutating them nukes the cache and orphans references. Constrain per-state via logit masking / response prefill; use consistent name prefixes (`browser_`, `shell_`).
3. **Filesystem as externalized memory.** Offload token-heavy observations to files; keep only a restorable reference in context (drop a page body, keep its URL). Lossless-by-reference because "you can't reliably predict which observation might become critical ten steps later."
4. **Recite goals (todo.md trick).** Continuously rewrite a `todo.md`, checking items off — pushes the plan into the model's recent attention span, fighting lost-in-the-middle.
5. **Keep the wrong stuff in.** "Leave the wrong turns in the context." A failed action + stack trace shifts the prior away from repeating it; erasing errors deletes the learning signal.
6. **Don't get few-shotted.** Uniform repetitive context makes the model mimic its prior actions; inject small structured variation.

### What AI-GOS adopts

1. **Recite the section goal + brief in the recent-attention slot.** Each runner re-states the GTM brief + that section's specific objective at the *end* of its prompt, not just the top. Highest-leverage, near-zero-cost grounding fix; documented cure for lost-in-the-middle drift.
2. **Cache-stable, timestamp-free, deterministic shared-corpus prefix.** The 6 runners share a corpus prefix; make it byte-identical and append-only with deterministic JSON. Directly attacks the 100:1 input-bound economics of the multi-section fan-out. Audit `corpus-to-research-input` and the dispatch envelope for per-call timestamps / nondeterministic key ordering.
3. **Keep failed attempts in context across primary→repair→rescue.** The repair phase should *see* the prior failure + error, not get a clean re-prompt. Verify the runners thread the failed attempt + reason into the repair turn rather than discarding it.
4. **Mask, don't mutate the tool roster.** The direct `spyfu` tool is still absent, but SpyFu itself is funded and exposed through Demand Intent's `keyword_volume` tool; Foreplay remains orphaned. Keep one stable roster across all section dispatches and gate per-section rather than adding/removing tool defs — protects cache coherence, stops hallucinated calls to absent tools.

NOT adopted: filesystem-as-memory (lesson 3) — AI-GOS has no run-time filesystem (see §7). The pass-references-not-inline idea transfers conceptually (store corpus once, pass a slice), but not the literal `cat`/`grep`/`glob` mechanism.

---

## 6. Synthesis: pattern → apps → AI-GOS decision

| Pattern | v0 | Lovable | Cursor | Manus | AI-GOS decision |
|---|---|---|---|---|---|
| Plan/restate before generate | ✓ (`<Thinking/>`) | ✓ (discuss-mode) | ✓ (Plan Mode artifact) | ✓ (todo.md recite) | **ADOPT** — orchestrator restates brief-derived section question before fan-out; brief is the plan/correction surface |
| Plan is the correction surface (re-plan, don't patch) | — | ✓ (reversible) | ✓ (revert + refine) | — | **ADOPT** — `rerun-section` consumes brief delta, not chat nudge |
| Live partial artifact streaming (written-by-ID) | ✓ (Data Parts) | ✓ (iframe) | — | — | **ADOPT** — `data-section` part keyed by id, `skeleton→partial→verified`; keeps verifier on final output |
| In-stream correction / autofix before render | ✓ (LLM Suspense, <250ms) | — | — | — | **ADOPT** — deterministic pass renders honest-badge inline on first render |
| Every tool call = visible typed card + inline citation | ✓ | ✓ (console/network) | partial | — | **ADOPT** — SearchAPI/fetch/ad-probe as status cards with clickable sources (matches no-fabricated-pricing rule) |
| Bounded self-repair ceiling, named in prompt | — | — | ✓ (≤3 loops) | — | **ADOPT** — make `answerToolMaxRepairAttempts` explicit in repair prompt + honest-badge fallback |
| Verification via external signal, required not advisory | ✓ (linter) | ✓ (rebuild/preview) | ✓ (types/tests) | ✓ (ground truth) | **ADOPT** — flip fabrication gate from advisory-OFF to required-or-badge |
| Tool-result grounding ("cite only fetched sources") | ✓ | ✓ | ✓ | ✓ | **ADOPT** — Cardinal Rule in each SKILL.md; pairs with verifier teeth (fixes VoC homepage-as-pain loss) |
| Tool batching (parallel independent calls) | — | ✓ | — | — | **ADOPT** — batch independent lookups per step (CompetitorLandscape latency) |
| Stable/masked tool roster (no mid-task mutation) | — | — | — | ✓ | **ADOPT** — one roster, gate per-section; keep funded SpyFu behind `keyword_volume`, retire truly orphaned defs such as Foreplay |
| Cache-stable, timestamp-free deterministic prefix | — | — | — | ✓ | **ADOPT** — byte-identical shared-corpus prefix across 6 runners |
| Goal recitation in recent-attention slot | — | — | — | ✓ | **ADOPT** — re-state brief + section objective at prompt end |
| Keep failed attempts/errors in context | — | (analyze first) | (linter errors) | ✓ | **ADOPT** — thread failure into repair turn |
| Dynamic per-intent prompt injection | ✓ (embeddings) | — | (ambient) | — | **CONSIDER** — section-scoped corpus search (cross-section synthesis lever) |
| Context-noise hygiene / fresh scope | — | ✓ (don't re-read) | ✓ (fresh session) | ✓ (externalize) | **ADOPT** — each runner gets a clean scoped corpus slice, not full transcript |
| Hard single-stack refusal | — | ✓ | — | — | **REJECT** — sections aren't codegen |
| Filesystem-as-memory / progressive disclosure | ✓ (read-only corpus) | — | ✓ (`.cursor/plans/`) | ✓ (sandbox VM) | **REJECT (runtime)** — no run-time filesystem; see §7 |
| Multi-agent coordinator | ✓ | — | (multi-agent judging) | ✓ | **REJECT** — bounded-concurrency orchestrator is right altitude |

---

## 7. The load-bearing constraint: AI-GOS has no filesystem runtime

The single most important transfer warning. Three of these apps (v0 read-only corpus, Cursor `.cursor/plans/`, Manus sandbox VM) lean on a **code-execution environment with filesystem + bash**. AI-GOS section runners do not: the model has only `web_search`, `firecrawl`, ad-library, keyword, `pagespeed`, and the `answer` tool — no `Read`, no `bash`, no on-demand file fetch.

Consequences for what transfers:

- **Progressive disclosure / "effectively unlimited bundled content" does NOT transfer.** Anthropic's Skills L1→L2→L3 staging is a filesystem + code-execution feature ("This filesystem-based model is what makes progressive disclosure work" — https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview). If a SKILL.md references external `reference/*.md`, nothing will auto-load it. Anything load-bearing must be **pre-flattened/inlined** into the injected prompt, and the token budget is a hard ceiling, not "unlimited." (Survey confirms: AI-GOS injects the SKILL.md body once per loop attempt, `build-prompts.ts:3067-3080`; there is no dynamic file load.)
- **Manus lesson 3 (filesystem-as-memory) reduces to a concept, not a mechanism.** "Store corpus once, pass a slice" transfers; `cat`/`grep`/`glob` retrieval does not.
- **"Low-freedom = run exactly this script" guardrails degrade.** With no script execution, determinism must come from either (a) a real tool the runner exposes, or (b) explicit inline pseudocode — not a bundled script.
- **What DOES transfer is the prompt-craft + methodology layer:** plan-before-emit, restate-the-ask, bounded repair ceilings, tool-result grounding, goal recitation, cache-stable deterministic prefixes, keep-errors-in-context, visible tool cards, and written-by-ID partial streaming. These are the adoptions in §6 and are filesystem-independent.

Net: treat each injected SKILL.md as a curated, pre-flattened prompt fragment. Port the authoring discipline and the analytical body; assume the progressive-disclosure runtime is absent and budget context accordingly.
