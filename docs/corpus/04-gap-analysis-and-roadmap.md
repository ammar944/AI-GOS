# Gap Analysis + Roadmap to the Best-in-Class Bar

> Purpose: an honest, head-of-product comparison of the AI-GOS lab-engine *as it ships today* against the best-practice bar set by Anthropic's agent/skills guidance and the reference apps (v0, Cursor, Lovable, Manus). Each gap is scored on impact and effort, cited to `file:line` (codebase) or source URL (research), and given a recommended move tied to the existing research-quality Pass-2 plan (`docs/2026-05-29-research-quality-pass2-execution-plan.md`, P1.1/P1.2/P1.3/P1.4/P2).

> Citations to lab-engine code reference the worktree of record: `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire`. Community-sourced (leaked-prompt) claims are marked **[community-sourced]**.

> **2026-06-01 refresh:** Phase 1 is shipped. `P1.1` added `positioningSynthesis`; `P1.2` enriched the three former stubs and deleted the legacy `0N-*.ts` skill strings; `P1.3` added funded SpyFu keyword volume through `keyword_volume`; `P1.4` added VoC provenance/self-source hardening; corpus G1 shared-preamble dedup and G6 goal recitation are in code. The old `src/lib/ai/prompts/positioning-skills/index.ts` line anchors drifted after synthesis landed; current anchors are `POSITIONING_SECTION_IDS` at `:12-19`, `PAID_MEDIA_PLAN_SECTION_ID` at `:23`, and `POSITIONING_SYNTHESIS_SECTION_ID` at `:27-34`.

## Table of Contents

1. [Scoring conventions](#1-scoring-conventions)
2. [Executive verdict](#2-executive-verdict)
3. [Prioritized gap table](#3-prioritized-gap-table)
4. [Gap detail + recommended moves](#4-gap-detail--recommended-moves)
   - [G1 — Skill-module quality, conciseness, dedup](#g1--skill-module-quality-conciseness-dedup)
   - [G2 — Atomic-vs-streamed artifact fork (fabrication-gate tradeoff)](#g2--atomic-vs-streamed-artifact-fork-fabrication-gate-tradeoff)
   - [G3 — Verifier depth: lexical vs semantic](#g3--verifier-depth-lexical-vs-semantic)
   - [G4 — Cross-section synthesis capstone](#g4--cross-section-synthesis-capstone)
   - [G5 — Context engineering for multi-section runs](#g5--context-engineering-for-multi-section-runs)
   - [G6 — Goal recitation in the recent-attention slot](#g6--goal-recitation-in-the-recent-attention-slot)
   - [G7 — Dead code / progressive-disclosure mirage](#g7--dead-code--progressive-disclosure-mirage)
   - [G8 — Reader content streaming](#g8--reader-content-streaming)
   - [G9 — Eval-driven authoring loop is absent](#g9--eval-driven-authoring-loop-is-absent)
5. [Sequenced roadmap](#5-sequenced-roadmap)

---

## 1. Scoring conventions

- **Impact**: HIGH = moves overall research quality grade (current C+) or is a customer-visible trust failure. MED = quality/UX win inside one section. LOW = hygiene.
- **Effort**: S = <1 day, surgical. M = 1–3 days, one runner/component subsystem. L = multi-day, crosses the worker/frontend boundary or the atomic-output fork.
- "Best-practice bar" = the union of Anthropic agent-building guidance + the four reference apps. We do not need to match v0's component-streaming runtime; we need to match the *principles* (liveness, provenance, grounding, calibrated freedom).

---

## 2. Executive verdict

AI-GOS is **at or above the bar on three axes and materially below on three.**

**At/above bar:** (a) the answer-tool structured-output path is exactly the pattern Anthropic documents — "if you're writing a regex to extract a decision from model output, that decision should have been a tool call" (https://platform.claude.com/docs/en/agents-and-tools/tool-use/how-tool-use-works); (b) the lexical verifier is a *rules-based* check, which Anthropic ranks as the **best** verification tier above LLM-as-judge (https://claude.com/blog/building-agents-with-the-claude-agent-sdk); (c) the live-progress reader (phase chips, query chips, allowlisted activity feed) is genuinely Claude.ai/v0-class on the *liveness-while-waiting* dimension.

**Below bar after Phase 1:** (1) the **fabrication gate is armed but default-OFF** (`run-section.ts:4098-4100`, `LAB_VERIFIER_MAX_UNSUPPORTED` = Infinity), which means the single best trust lever still ships disabled; (2) the **verifier is lexical, not semantic** — it confirms a number/URL/quote *appears* in evidence, not that the evidence *supports the claim*; (3) the **eval-driven authoring loop is still absent**, so future skill changes are not yet measured by fixture-company rubrics.

Phase 1 retired the two largest stale architecture gaps in the original table: former 45-line stubs are now 233/240/234-line section modules, and the cross-section synthesis capstone exists. Phase 2 starts with verifier semantics (`P2.1-JUDGE`), not more P1 rework.

---

## 3. Prioritized gap table

| # | Gap | Evidence | Impact | Effort | Recommended move (Pass-2 tie-in) |
|---|-----|----------|--------|--------|----------------------------------|
| **G1** | **SHIPPED:** former 45-line stub skills now have detailed workflows, card contracts, examples, and confidence guidance; shared tool-gap boilerplate is composed in `build-prompts.ts` | `wc -l`: voice-of-customer 233, demand-intent 240, offer-diagnostic 234; `buildAnswerToolInstructions` injects shared capability-gap guidance at `build-prompts.ts:538-540` | Retired **HIGH** gap | **DONE** | Shipped via **P1.2** (stub enrichment) plus corpus G1 shared-preamble dedup. Keep future skill edits self-contained and concise. |
| **G2** | Fabrication gate armed but default-OFF; verifier teeth are advisory | `run-section.ts:4098-4100` ("Gate is armed but default-OFF: Infinity unless LAB_VERIFIER_MAX_UNSUPPORTED"); `evidence-support.ts:70-82` returns Infinity when unset/invalid | **HIGH** — the single highest-trust lever ships disabled; an unsupported numeric claim commits silently | **S** | Flip the gate to a finite default (e.g. `LAB_VERIFIER_MAX_UNSUPPORTED=2`) and badge the rest honestly. Cursor's stance: verification is *designed-in, not opt-in* (https://cursor.com/blog/agent-best-practices). Maps to `P0.1a` / verifier gate work, not stub-enrichment. |
| **G3** | Verifier is lexical/textual, not semantic — confirms a token *appears*, not that evidence *supports* the claim | `verification/structural-verifier.ts` (URL exact-match, numeric variant search, quote substring); confidence = verified/(verified+unsupported), `evidence-support.ts:89-100` | **HIGH** — lexical matching still cannot judge semantic support | **L** | Add the scoped semantic relevance pass over load-bearing claims. `P1.4` prompt/provenance hardening is shipped; remaining semantic layer maps to **P2.1-JUDGE**. |
| **G4** | **SHIPPED:** cross-section synthesis exists as an additive capstone | `POSITIONING_SYNTHESIS_SECTION_ID` in `index.ts:27-34`; registry entry at `section-registry.ts:264-284`; `run-section.ts:1972-2007` normalizes synthesis provenance | Retired **HIGH** gap | **DONE** | Shipped via **P1.1**. Remaining Phase 2 work should improve verification/reader behavior around the capstone, not re-add the section. |
| **G5** | Shared corpus is re-inlined into all 6 section prompts; no cache-stable append-only prefix | `build-prompts.ts` injects ResearchInput JSON per section (survey §1); corpus excerpts pre-loaded per run | **MED** | **M** | Make the shared-corpus prefix byte-identical + timestamp-free across sections so KV-cache hits (Manus lesson 1: cache hit rate is "the single most important metric," ~10x cost delta). Audit `corpus-to-research-input` + dispatch envelope for nondeterministic key order / per-call timestamps. |
| **G6** | **SHIPPED:** goal recitation sits in the recent-attention slot | `buildSectionObjectiveRecap` at `build-prompts.ts:565-580`; appended after skill body at `run-section.ts:3097-3099` and repair/capstone path at `run-section.ts:3502-3504` | Retired **MED** gap | **DONE** | Shipped before Phase 2. Keep the tail recap when touching prompt assembly. |
| **G7** | **SHIPPED:** dead legacy skill-string modules removed; barrel now keeps IDs/labels only | `rg --files src/lib/ai/prompts/positioning-skills` returns only `index.ts`; `index.ts:9-10` documents the P1.2 deletion | Retired **LOW** gap | **DONE** | Shipped via **P1.2**. Continue using kill-list discipline for future deletions. |
| **G8** | Reader streams *progress events* but not *artifact content*; sections pop in atomically | Survey §1 (artifact-ui): final `streamObject()` emits complete schema once; "no mid-stream artifact content streaming (would orphan verifier)" | **MED** | **L** | Don't break the fork — emit a `data-section` part keyed by section id, re-written in place skeleton→partial→verified (v0/AI-SDK-5 pattern, https://vercel.com/blog/ai-sdk-5). Keep the verifier on final output. See G2 detail below. |
| **G9** | No eval harness; skills authored by hand, not by the two-Claude eval loop | No `evals/` for sections; Anthropic: "Create evaluations BEFORE writing extensive documentation" + "≥3 scenarios, tested with Haiku/Sonnet/Opus" (best-practices doc) | **MED** | **M** | Stand up ≥3 fixture-company eval scenarios per section with an `expected_behavior[]` rubric; run a fresh Claude-B against shipped and future skill edits. Keeps G1 quality measurable instead of vibes-driven. |

---

## 4. Gap detail + recommended moves

### G1 — Skill-module quality, conciseness, dedup

**Status 2026-06-01: SHIPPED.** The three former stubs are no longer 45-line prompts: `voice-of-customer` is 233 lines, `demand-intent` is 240, and `offer-diagnostic` is 234. The legacy `.ts` skill-string corpus was deleted under **P1.2**, and the shared Capability Gaps / budget guidance now lives in `build-prompts.ts` for tool sections instead of being repeated across the six `SKILL.md` files. Section-specific gap examples remain in the relevant skill bodies.

**Bar.** Anthropic: match the body to the task's fragility; the analytical content (synthesis, source-quality judgment, theme extraction) is **high-freedom prose**, but the **output contract is a low-freedom Template** ("ALWAYS use this exact template structure") and the validation step is a checklist the model self-checks against (best-practices doc, #set-appropriate-degrees-of-freedom). The reference design for a research skill is literally Anthropic's no-code "Research synthesis workflow" checklist (read sources → identify themes → cross-reference → structured summary → verify citations).

**Conciseness/dedup.** Two opposing forces remain. (a) Skills must be self-contained because AI-GOS injects them wholesale with **no filesystem at runtime** (research:anthropic-skills, "DOES NOT transfer: progressive disclosure is dead without a filesystem"). (b) Shared boilerplate should stay in prompt builders, not in every skill. The shipped dedup keeps common capability-gap handling in `build-prompts.ts` and leaves evidence-specific examples in the skills.

**Move.** No more Phase 1 work here. Future edits should preserve the split: reusable prompt policy in `build-prompts.ts`, section-specific evidence practice in `SKILL.md`, and tests proving no-tool capstones do not receive tool-gap guidance. **Pass-2 mapping correction:** stub enrichment was **P1.2**, not P1.3; P1.3 is Demand Intent keyword signal.

### G2 — Atomic-vs-streamed artifact fork (fabrication-gate tradeoff)

**Today.** All 6 sections use the answer-tool path: ToolLoopAgent runs the live-research loop, then a single final `streamObject()` emits the complete typed schema, which commits to Supabase atomically; the verifier runs *post-commit* on the complete artifact (survey artifact-ui §1, §4). The memory correctly flags that switching to token-by-token `streamObject` content-streaming "would orphan the fabrication gate" because partial objects can't be validated (missing `sources`, half-filled cards).

**Bar.** v0 proves you do *not* have to choose between liveness and a correct final artifact. Its "LLM Suspense" + autofixer pipeline corrects the stream in-flight so the *first* render is clean, and AI-SDK-5 **Data Parts written-by-ID** are "a first-class way to stream arbitrary, type-safe data… re-written by ID to update in place" (https://vercel.com/blog/ai-sdk-5, https://vercel.com/blog/how-we-made-v0-an-effective-coding-agent). Anthropic's structure-belongs-in-the-schema guidance supports *keeping* the atomic tool output that the verifier wires into.

**The honest tradeoff.** The fork is real and load-bearing. We should **not** dissolve it by token-streaming the artifact — that trades a working trust gate for cosmetic liveness. The win is to **decouple perceived liveness from artifact atomicity**: emit a `data-section` part keyed by section id that the reader re-writes in place (skeleton → "drafting" → "verifying" → verified card) while the underlying artifact still emits once and the verifier still runs on the complete object. This is the v0 primitive applied to typed research data, and it sidesteps the orphaning problem entirely.

**Coupled to G2-prime (the gate flag).** Independent of streaming: the verifier teeth are **armed but default-OFF** (`run-section.ts:4098-4100`). The cheapest remaining trust win in this document is flipping `LAB_VERIFIER_MAX_UNSUPPORTED` to a finite default and rendering the honest badge inline. Cursor's principle: verification is a *required* signal the runner must pass or honestly flag, not opt-in. This is verifier-gate work; P1.4's VoC quote/provenance hardening has already shipped.

### G3 — Verifier depth: lexical vs semantic

**Today.** `structural-verifier.ts` extracts claims (url/numeric/quote/text) and matches them **lexically**: URLs by exact match, numerics by textual variant search (no-decimal, magnitude, monthly alias, bare currency), quotes/text by normalized substring. Confidence is replaced (not augmented) with `deriveGroundedConfidence = verified/(verified+unsupported)` (`evidence-support.ts:84`). This is real teeth on *fabrication of presence* (a number/URL that appears nowhere in evidence).

**The gap it cannot close.** Lexical matching confirms a token *exists* in the evidence corpus; it cannot confirm the evidence *supports the specific claim*. The confirmed VoC loss — the subject's **own homepage** ingested and reported as customer "pain" — passes a lexical gate trivially: the text is present in evidence, it's just the wrong *kind* of evidence. This is a relevance/provenance failure, and it is the exact failure mode Anthropic flags structured-output grammar cannot catch either (enum/value constraints "stored but not always enforced" — https://platform.claude.com/docs/en/build-with-claude/structured-outputs).

**Bar.** Anthropic ranks rules-based feedback above LLM-as-judge but does not pretend lexical rules catch semantics; the recommended escalation is a *scoped* judge on the fuzzy cases only. Cursor/Lovable both ground on tool-result provenance with a hard "cite only from fetched results" rule.

**Move.** Two layers. (1) **Prompt-side Cardinal Rule** per section: "a pain/objection/quote MUST come from a customer-voice source (review, forum, transcript) — never the subject's own marketing copy." Cheap, prevents the specific bug. (2) **Scoped semantic check**: run a single LLM-judge pass *only* over the claims the lexical verifier already flagged as load-bearing, asking "does source X support claim Y?" — bounded cost, avoids the "grade everything" anti-pattern Anthropic warns against. **Pass-2: P1.4 (prompt rule) + P2 (semantic layer).**

### G4 — Cross-section synthesis capstone

**Status 2026-06-01: SHIPPED.** `positioningSynthesis` now reads the six committed positioning artifacts and emits a situation thesis, 2-3 positioning options, one recommended move, and messaging directions. It is explicitly outside `POSITIONING_SECTION_IDS`, so parent completion remains the six research sections while the synthesis capstone is additive. Current anchors: `POSITIONING_SYNTHESIS_SECTION_ID` at `index.ts:27-34`, registry at `section-registry.ts:264-284`.

**Residual watch.** The capstone exists; Phase 2 should improve semantic verification and reader treatment around it. Do not reframe the next phase as "add synthesis" unless this section regresses.

### G5 — Context engineering for multi-section runs

**Today.** The 6 sections fan out with a shared corpus that is **re-inlined into each section prompt** (`build-prompts.ts` injects ResearchInput JSON per attempt; corpus excerpts pre-loaded — survey §1). Sections are context-isolated workers (which Anthropic endorses for orchestrator-worker — https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents). Phase 1 added the two missing high-ROI pieces: a synthesis capstone that reads the committed artifacts, and a tail objective recap for the answer-tool prompt.

**Three Manus levers, ranked by ROI for AI-GOS:**

1. **Goal recitation (G6, S) — shipped.** The section objective + subject URL now sit at the *tail* of the prompt (`build-prompts.ts:565-580`, appended in `run-section.ts:3097-3099`).
2. **Cross-section synthesis (G4, M) — shipped.** The Synthesis runner has `allowedTools: []`, reads committed artifacts, and emits the capstone wedge/options artifact (`section-registry.ts:264-284`).
3. **Cache-stable prefix (M).** Make the shared-corpus prefix byte-identical + timestamp-free + deterministic-key-order across all 6 dispatches so the KV-cache hits. Manus: cache hit rate is "the single most important metric," ~10x token-cost delta; agents are ~100:1 input-bound. At ~$2/run across 6 sections this is a direct cost lever (lesson 1).

**Move.** Audit `corpus-to-research-input` and the dispatch envelope for nondeterministic ordering as part of the cache work. Phase 2 should not reopen the shipped P1.1/G6 scope unless the tests or a live run show regression.

### G6 — Goal recitation in the recent-attention slot

**Status 2026-06-01: SHIPPED.** `buildSectionObjectiveRecap` restates the section title, mission, subject company, and grounding rule at the prompt tail. The answer-tool path appends it after `Skill analyst guidance`, so it lands in the recent-attention window. Keep this tail recap when editing prompt assembly or adding new section types.

### G7 — Dead code / progressive-disclosure mirage

**Status 2026-06-01: SHIPPED.** The 6 `0[1-6]-*.ts` legacy skill-string modules are gone; `rg --files src/lib/ai/prompts/positioning-skills` returns only `index.ts`. The barrel now documents the P1.2 deletion and keeps only IDs/labels used elsewhere (`index.ts:9-10`, `:12-23`, `:27-34`).

**Related conceptual trap:** the Anthropic Skills model's progressive disclosure (L1 metadata → L2 body → L3 reference files, lazy-loaded via `bash`/`Read`) **does not transfer** to AI-GOS because the injected runtime has no filesystem (research:anthropic-skills, "this is the load-bearing constraint"). Do not author skills assuming reference files will be auto-discovered, do not lean on `name`/`description` for discovery (skills are pre-selected and injected wholesale), and convert any "run exactly this script" low-freedom guardrail into either a real runner tool or explicit inline pseudocode — the script-execution path that makes Skills reliable is absent here.

### G8 — Reader content streaming

**Today (strong).** The reader is genuinely good on liveness: phase icons (preparing/searching/drafting/checking/refining/committing), query chips proving tool execution, an allowlisted activity feed with `JSON_HINT` regex + `translateReason()` blocking raw Zod issues from customer view, a first-5s skeleton receipt, a compact run-status bar, mobile section tabs, copy-to-clipboard, and a verification badge (survey artifact-ui §2). This matches the Claude.ai/v0 "something visible always happens" bar.

**Remaining gap.** The reader streams progress events but not partial artifact content; sections still pop in atomically after the complete typed artifact is committed. This is intentional for now: the verifier runs on complete objects. The UX gap is to stream typed `data-section` status/preview parts without weakening the final verifier gate.

**Move.** Promote search/fetch/ad-probe results to live citation cards in the activity feed and later add `data-section` parts keyed by section id, re-written in place skeleton→partial→verified. Keep the final verifier on the complete object.

### G9 — Eval-driven authoring loop is absent

Skills are hand-authored. Anthropic's mandated loop is **evals before docs**: run the model with no skill, log failures, build ≥3 scenarios with an `expected_behavior[]` rubric, write minimal instructions to pass, iterate — and the two-Claude loop (Claude A authors, fresh Claude B tests, observe how B navigates) — tested across Haiku/Sonnet/Opus (best-practices doc, #evaluation-and-iteration). There is no built-in runner; we build our own. Without this, shipped skill quality cannot be measured beyond reviews and live-run anecdotes. Stand up ≥3 fixture-company scenarios per section and use them to regression-test future skill edits and validate the shipped G1 rewrite.

---

## 5. Sequenced roadmap

Ordered by (impact ÷ effort), then by dependency.

**Wave 1 — this week (S, high ROI, no fork risk):**
- **G2-prime:** flip `LAB_VERIFIER_MAX_UNSUPPORTED` to a finite default + render honest badge. (`run-section.ts:4098-4100`)
- **G6 recitation:** **SHIPPED** — keep tail recap intact. (`build-prompts.ts:565-580`)
- **G7 dead-code sweep:** **SHIPPED** — legacy skill-string modules deleted under P1.2.

**Wave 2 — section quality (M):**
- **G1:** **SHIPPED** — stub enrichment was **P1.2**, and shared-preamble dedup has landed.
- **G9 evals:** ≥3 scenarios/section to regression-test shipped and future skill edits.
- **G3 prompt Cardinal Rule:** **SHIPPED in P1.4** — remaining work is semantic judging.

**Wave 3 — the headline quality lever (M–L):**
- **G4 cross-section synthesis:** **SHIPPED in P1.1** — synthesis capstone is registered and live-run proven.
- **G5 cache-stable prefix:** deterministic, timestamp-free shared-corpus prefix.

**Wave 4 — UX + verifier depth (L, after quality is fixed):**
- **G8 data-part reader:** `data-section` part written-by-ID, skeleton→verified, verifier stays on atomic output.
- **G3 semantic layer:** scoped LLM-judge over already-flagged load-bearing claims only. → **P2.1-JUDGE**

**Explicitly NOT doing:** token-streaming the artifact content (orphans the gate — see G2); a full multi-agent "Agentic Mode" coordinator (the bounded-concurrency orchestrator is the right altitude); copying v0's single-file/JSX-specific constraints (irrelevant to typed research data).
