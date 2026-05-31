# Gap Analysis + Roadmap to the Best-in-Class Bar

> Purpose: an honest, head-of-product comparison of the AI-GOS lab-engine *as it ships today* against the best-practice bar set by Anthropic's agent/skills guidance and the reference apps (v0, Cursor, Lovable, Manus). Each gap is scored on impact and effort, cited to `file:line` (codebase) or source URL (research), and given a recommended move tied to the existing research-quality Pass-2 plan (`docs/2026-05-29-research-quality-audit-C-to-A-plus.md`, P1.2/P1.3/P1.4/P2).

> Citations to lab-engine code reference the worktree of record: `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire`. Community-sourced (leaked-prompt) claims are marked **[community-sourced]**.

## Table of Contents

1. [Scoring conventions](#1-scoring-conventions)
2. [Executive verdict](#2-executive-verdict)
3. [Prioritized gap table](#3-prioritized-gap-table)
4. [Gap detail + recommended moves](#4-gap-detail--recommended-moves)
   - [G1 — Skill-module quality, conciseness, dedup](#g1--skill-module-quality-conciseness-dedup)
   - [G2 — Atomic-vs-streamed artifact fork (fabrication-gate tradeoff)](#g2--atomic-vs-streamed-artifact-fork-fabrication-gate-tradeoff)
   - [G3 — Reader liveness/UX vs v0](#g3--reader-livenessux-vs-v0)
   - [G4 — Verifier depth: lexical vs semantic](#g4--verifier-depth-lexical-vs-semantic)
   - [G5 — Context engineering for multi-section runs](#g5--context-engineering-for-multi-section-runs)
   - [G6 — Dead code / progressive-disclosure mirage](#g6--dead-code--progressive-disclosure-mirage)
   - [G7 — Eval-driven authoring loop is absent](#g7--eval-driven-authoring-loop-is-absent)
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

**Below bar:** (1) **skill modules are bimodal** — three are 250–500 lines of real guidance, three are 45-line stubs (`wc -l` confirmed: voice-of-customer/demand-intent/offer-diagnostic = 45 each), so half the sections run on near-empty instruction; (2) the **fabrication gate is armed but default-OFF** (`run-section.ts:4076`, `LAB_VERIFIER_MAX_UNSUPPORTED` = Infinity), which means the single best trust lever ships disabled; (3) the **verifier is lexical, not semantic** — it confirms a number/URL *appears* in evidence, not that the evidence *supports the claim*, and the confirmed VoC loss (subject's own homepage ingested as customer "pain") is exactly the class of bug a lexical gate cannot catch.

The biggest single C→B+ lever from the existing audit — **no cross-section synthesis** — is a context-engineering gap (G5), not a model gap.

---

## 3. Prioritized gap table

| # | Gap | Evidence | Impact | Effort | Recommended move (Pass-2 tie-in) |
|---|-----|----------|--------|--------|----------------------------------|
| **G1** | 3 of 6 section skills are 45-line stubs; no detailed workflow, card examples, or confidence-tagging guidance | `wc -l` worktree: voice-of-customer/demand-intent/offer-diagnostic = 45 lines each vs market-category 267, competitor-landscape 504, buyer-icp 253 | **HIGH** — half the sections run on near-empty instruction; uneven output quality is structural, not random | **M** | Bring the 3 stubs up to the market-category template (role + workflow + card schemas + correct/incorrect examples). Extract shared boilerplate (Capability Gaps, Anti-Slop) to one included block. Maps to **P1.3 (section quality)**. |
| **G2** | Fabrication gate armed but default-OFF; verifier teeth are advisory | `run-section.ts:4076` ("Gate is armed but default-OFF: Infinity unless LAB_VERIFIER_MAX_UNSUPPORTED"); audit memory: "fabrication gate advisory-OFF by default" | **HIGH** — the single highest-trust lever ships disabled; an unsupported numeric claim commits silently | **S** | Flip the gate to a finite default (e.g. `LAB_VERIFIER_MAX_UNSUPPORTED=2`) and badge the rest honestly. Cursor's stance: verification is *designed-in, not opt-in* (https://cursor.com/blog/agent-best-practices). Maps to **P1.4 (verifier teeth)**. |
| **G3** | Verifier is lexical/textual, not semantic — confirms a token *appears*, not that evidence *supports* the claim | `verification/structural-verifier.ts` (URL exact-match, numeric variant search, quote substring); confidence = verified/(verified+unsupported), `evidence-support.ts:84` | **HIGH** — cannot catch the confirmed VoC homepage-as-pain loss (relevance failure, not presence failure) | **L** | Add a cheap semantic relevance check on load-bearing claims: a single LLM-judge pass *scoped to flagged claims only* (don't grade everything — Anthropic warns LLM-judge is "generally not a very robust method"). Pair with a prompt-level Cardinal Rule: "never assert a pain/objection not present in a customer-voice source." Maps to **P1.4 + P2**. |
| **G4** | No cross-section synthesis; each section runs context-isolated and never reads sibling artifacts | Audit memory: "no cross-section synthesis (biggest C→B+ lever)"; Synthesis section has `allowedTools: none, maxExternalLookups: 0` (section-registry) — reads committed artifacts only, but nothing feeds *findings* between the 6 research sections | **HIGH** — the audit's named #1 quality lever; sections contradict/duplicate without a reconciliation pass | **M** | Externalize each committed section as a reference handle (Manus lesson 3: "drop the content, keep the path" — https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus) and let the Synthesis runner cite cross-section evidence. Maps to **P2 (cross-section synthesis)**. |
| **G5** | Shared corpus is re-inlined into all 6 section prompts; no cache-stable append-only prefix | `build-prompts.ts` injects ResearchInput JSON per section (survey §1); corpus excerpts pre-loaded per run | **MED** | **M** | Make the shared-corpus prefix byte-identical + timestamp-free across sections so KV-cache hits (Manus lesson 1: cache hit rate is "the single most important metric," ~10x cost delta). Audit `corpus-to-research-input` + dispatch envelope for nondeterministic key order / per-call timestamps. |
| **G6** | No goal recitation in the recent-attention slot; brief/objective only at prompt top | `build-prompts.ts` assembly order: header → emphasis → validators → skill body (survey §1); skill body is last, but the GTM brief objective is not re-stated at the tail | **MED** | **S** | Re-append the section's specific objective + brief at the *end* of the prompt (Manus lesson 4: todo.md recitation fights "lost-in-the-middle"). Near-zero cost grounding fix; directly addresses the homepage-as-pain drift. |
| **G7** | 6 dead legacy skill-string modules re-exported but never imported | `src/lib/ai/prompts/positioning-skills/0[1-6]-*.ts` + barrel `index.ts:9–14`; grep confirms only the barrel references them | **LOW** | **S** | Delete the 6 modules + barrel exports. Follow the kill-list discipline in `learned-patterns.md` (remove barrel entries + any registry refs as separate sub-items). Pure hygiene, but cuts confusion for the next author. |
| **G8** | Reader streams *progress events* but not *artifact content*; sections pop in atomically | Survey §1 (artifact-ui): final `streamObject()` emits complete schema once; "no mid-stream artifact content streaming (would orphan verifier)" | **MED** | **L** | Don't break the fork — emit a `data-section` part keyed by section id, re-written in place skeleton→partial→verified (v0/AI-SDK-5 pattern, https://vercel.com/blog/ai-sdk-5). Keep the verifier on final output. See G2 detail below. |
| **G9** | No eval harness; skills authored by hand, not by the two-Claude eval loop | No `evals/` for sections; Anthropic: "Create evaluations BEFORE writing extensive documentation" + "≥3 scenarios, tested with Haiku/Sonnet/Opus" (best-practices doc) | **MED** | **M** | Stand up ≥3 fixture-company eval scenarios per section with an `expected_behavior[]` rubric; run a fresh Claude-B against each stub before/after the G1 rewrite. Prevents G1 from being vibes-driven. |

---

## 4. Gap detail + recommended moves

### G1 — Skill-module quality, conciseness, dedup

**Today.** The 8 SKILL.md files total 1,329 lines, but the distribution is bimodal and damning: market-category (267), competitor-landscape (504), buyer-icp (253) are full templates with card schemas + linted correct/incorrect examples; **voice-of-customer, demand-intent, and offer-diagnostic are 45-line stubs** (`wc -l` verified in worktree). A stub gives the model role + inputs + boilerplate and almost nothing on *how to gather evidence or fill the cards*. Output quality on those three sections is therefore structurally weaker — and VoC (a stub) is the one section with a *confirmed* quality loss.

**Bar.** Anthropic: match the body to the task's fragility; the analytical content (synthesis, source-quality judgment, theme extraction) is **high-freedom prose**, but the **output contract is a low-freedom Template** ("ALWAYS use this exact template structure") and the validation step is a checklist the model self-checks against (best-practices doc, #set-appropriate-degrees-of-freedom). The reference design for a research skill is literally Anthropic's no-code "Research synthesis workflow" checklist (read sources → identify themes → cross-reference → structured summary → verify citations).

**Conciseness/dedup.** Two opposing forces. (a) The stubs are *too thin* — under-instructed. (b) The detailed skills carry duplicated boilerplate (Capability Gaps ~20 lines, Anti-Slop ~15 lines) inline in each file. Because AI-GOS injects skills wholesale with **no filesystem at runtime** (research:anthropic-skills, "DOES NOT transfer: progressive disclosure is dead without a filesystem"), we cannot lazy-load a shared `reference/anti-slop.md` — but we *can* dedup at build time by composing the injected blob from a shared boilerplate constant + the section-specific body. That keeps the per-call token cost down without pretending L2/L3 tiers exist.

**Move.** (1) Raise the 3 stubs to the market-category template depth (workflow + per-card schema + ≥1 correct/incorrect example + confidence-tagging guidance). (2) Factor the two boilerplate blocks into one shared string composed in at build time. (3) Strip Claude-Code-only frontmatter (`allowed-tools` is a no-op when injected wholesale — research:anthropic-skills). **Pass-2: P1.3.**

### G2 — Atomic-vs-streamed artifact fork (fabrication-gate tradeoff)

**Today.** All 6 sections use the answer-tool path: ToolLoopAgent runs the live-research loop, then a single final `streamObject()` emits the complete typed schema, which commits to Supabase atomically; the verifier runs *post-commit* on the complete artifact (survey artifact-ui §1, §4). The memory correctly flags that switching to token-by-token `streamObject` content-streaming "would orphan the fabrication gate" because partial objects can't be validated (missing `sources`, half-filled cards).

**Bar.** v0 proves you do *not* have to choose between liveness and a correct final artifact. Its "LLM Suspense" + autofixer pipeline corrects the stream in-flight so the *first* render is clean, and AI-SDK-5 **Data Parts written-by-ID** are "a first-class way to stream arbitrary, type-safe data… re-written by ID to update in place" (https://vercel.com/blog/ai-sdk-5, https://vercel.com/blog/how-we-made-v0-an-effective-coding-agent). Anthropic's structure-belongs-in-the-schema guidance supports *keeping* the atomic tool output that the verifier wires into.

**The honest tradeoff.** The fork is real and load-bearing. We should **not** dissolve it by token-streaming the artifact — that trades a working trust gate for cosmetic liveness. The win is to **decouple perceived liveness from artifact atomicity**: emit a `data-section` part keyed by section id that the reader re-writes in place (skeleton → "drafting" → "verifying" → verified card) while the underlying artifact still emits once and the verifier still runs on the complete object. This is the v0 primitive applied to typed research data, and it sidesteps the orphaning problem entirely.

**Coupled to G2-prime (the gate flag).** Independent of streaming: the verifier teeth are **armed but default-OFF** (`run-section.ts:4076`). The cheapest trust win in this entire document is flipping `LAB_VERIFIER_MAX_UNSUPPORTED` to a finite default and rendering the honest badge inline. Cursor's principle: verification is a *required* signal the runner must pass or honestly flag, not opt-in. **Pass-2: P1.4 (gate flag, S) + a separate L-effort streaming track for the data-part reader.**

### G3 — Reader liveness/UX vs v0

**Today (strong).** The reader is genuinely good on liveness: phase icons (preparing/searching/drafting/checking/refining/committing), query chips proving tool execution, an allowlisted activity feed with `JSON_HINT` regex + `translateReason()` blocking raw Zod issues from customer view, a first-5s skeleton receipt, a compact run-status bar, mobile section tabs, copy-to-clipboard, and a verification badge (survey artifact-ui §2). This matches the Claude.ai/v0 "something visible always happens" bar.

**Bar gaps.** v0 makes **every tool call a visible, typed card with inline clickable source links** (https://v0.app/docs/agentic-features) — provenance is a first-class artifact, not a footnote. AI-GOS surfaces tool *activity* (a "searching" chip with query terms) but the **sources only appear in the committed footer**, not live and per-claim during the run. Two concrete deltas: (1) no live inline citation as evidence arrives; (2) copy/export is per-section, not whole-audit.

**Move.** Promote the search/fetch/ad-probe results to live citation cards in the activity feed (matches the existing "no fabricated pricing / source URLs" rule and the deduped numbered-sources footer work — make it live). Lower priority than G1/G2 because the liveness floor is already met. **Effort S–M; not a Pass-2 blocker.**

### G4 — Verifier depth: lexical vs semantic

**Today.** `structural-verifier.ts` extracts claims (url/numeric/quote/text) and matches them **lexically**: URLs by exact match, numerics by textual variant search (no-decimal, magnitude, monthly alias, bare currency), quotes/text by normalized substring. Confidence is replaced (not augmented) with `deriveGroundedConfidence = verified/(verified+unsupported)` (`evidence-support.ts:84`). This is real teeth on *fabrication of presence* (a number/URL that appears nowhere in evidence).

**The gap it cannot close.** Lexical matching confirms a token *exists* in the evidence corpus; it cannot confirm the evidence *supports the specific claim*. The confirmed VoC loss — the subject's **own homepage** ingested and reported as customer "pain" — passes a lexical gate trivially: the text is present in evidence, it's just the wrong *kind* of evidence. This is a relevance/provenance failure, and it is the exact failure mode Anthropic flags structured-output grammar cannot catch either (enum/value constraints "stored but not always enforced" — https://platform.claude.com/docs/en/build-with-claude/structured-outputs).

**Bar.** Anthropic ranks rules-based feedback above LLM-as-judge but does not pretend lexical rules catch semantics; the recommended escalation is a *scoped* judge on the fuzzy cases only. Cursor/Lovable both ground on tool-result provenance with a hard "cite only from fetched results" rule.

**Move.** Two layers. (1) **Prompt-side Cardinal Rule** per section: "a pain/objection/quote MUST come from a customer-voice source (review, forum, transcript) — never the subject's own marketing copy." Cheap, prevents the specific bug. (2) **Scoped semantic check**: run a single LLM-judge pass *only* over the claims the lexical verifier already flagged as load-bearing, asking "does source X support claim Y?" — bounded cost, avoids the "grade everything" anti-pattern Anthropic warns against. **Pass-2: P1.4 (prompt rule) + P2 (semantic layer).**

### G5 — Context engineering for multi-section runs

**Today.** The 6 sections fan out with a shared corpus that is **re-inlined into each section prompt** (`build-prompts.ts` injects ResearchInput JSON per attempt; corpus excerpts pre-loaded — survey §1). Sections are context-isolated workers (which Anthropic endorses for orchestrator-worker — https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) but there is **no cross-section feedback** and **no goal recitation in the recent-attention slot**.

**Three Manus levers, ranked by ROI for AI-GOS:**

1. **Goal recitation (G6, S, do first).** Re-append the section objective + GTM brief at the *tail* of the prompt, not just the head. Manus's todo.md trick fights lost-in-the-middle and goal drift on the longer single-section loops (lesson 4). Near-zero cost, directly targets the drift that produced homepage-as-pain.
2. **Cross-section synthesis (G4, M).** The audit's named #1 quality lever. Externalize each committed section as a reference handle and let the Synthesis runner (currently `allowedTools: none`, reads committed artifacts) actually reconcile cross-section findings (Manus lesson 3). This is what turns 6 parallel monologues into one coherent audit.
3. **Cache-stable prefix (M).** Make the shared-corpus prefix byte-identical + timestamp-free + deterministic-key-order across all 6 dispatches so the KV-cache hits. Manus: cache hit rate is "the single most important metric," ~10x token-cost delta; agents are ~100:1 input-bound. At ~$2/run across 6 sections this is a direct cost lever (lesson 1).

**Move.** Do G6 (recitation) this week — it's the cheapest grounding fix in the doc. Schedule cross-section synthesis as the P2 headline. Audit `corpus-to-research-input` and the dispatch envelope for nondeterministic ordering as part of the cache work.

### G6 — Dead code / progressive-disclosure mirage

The 6 `0[1-6]-*.ts` legacy skill-string modules (`src/lib/ai/prompts/positioning-skills/`) are re-exported by the barrel but imported by nothing (survey skills-schemas §5). Delete them and the barrel entries per the `learned-patterns.md` kill-list discipline (remove barrel exports as a separate sub-item; check for orphaned tests).

**Related conceptual trap:** the Anthropic Skills model's progressive disclosure (L1 metadata → L2 body → L3 reference files, lazy-loaded via `bash`/`Read`) **does not transfer** to AI-GOS because the injected runtime has no filesystem (research:anthropic-skills, "this is the load-bearing constraint"). Do not author skills assuming reference files will be auto-discovered, do not lean on `name`/`description` for discovery (skills are pre-selected and injected wholesale), and convert any "run exactly this script" low-freedom guardrail into either a real runner tool or explicit inline pseudocode — the script-execution path that makes Skills reliable is absent here.

### G7 — Eval-driven authoring loop is absent

Skills are hand-authored. Anthropic's mandated loop is **evals before docs**: run the model with no skill, log failures, build ≥3 scenarios with an `expected_behavior[]` rubric, write minimal instructions to pass, iterate — and the two-Claude loop (Claude A authors, fresh Claude B tests, observe how B navigates) — tested across Haiku/Sonnet/Opus (best-practices doc, #evaluation-and-iteration). There is no built-in runner; we build our own. Without this, the G1 stub-rewrite is vibes-driven and we cannot prove the rewrite improved anything. Stand up ≥3 fixture-company scenarios per section and gate the G1 rewrite on a measured before/after.

---

## 5. Sequenced roadmap

Ordered by (impact ÷ effort), then by dependency.

**Wave 1 — this week (S, high ROI, no fork risk):**
- **G2-prime:** flip `LAB_VERIFIER_MAX_UNSUPPORTED` to a finite default + render honest badge. (`run-section.ts:4076`) → **P1.4**
- **G6 recitation:** re-append section objective + brief at prompt tail. (`build-prompts.ts`)
- **G7 dead-code sweep:** delete the 6 legacy skill modules + barrel exports.

**Wave 2 — section quality (M):**
- **G1:** raise the 3 stub skills to template depth + dedup boilerplate at build time. → **P1.3**
- **G9 evals:** ≥3 scenarios/section to gate the G1 rewrite (do alongside, not after).
- **G3 prompt Cardinal Rule:** "customer-voice claims only from customer-voice sources." → **P1.4**

**Wave 3 — the headline quality lever (M–L):**
- **G4 cross-section synthesis:** externalize committed sections as handles; Synthesis runner reconciles. → **P2** (audit's named #1 C→B+ lever)
- **G5 cache-stable prefix:** deterministic, timestamp-free shared-corpus prefix.

**Wave 4 — UX + verifier depth (L, after quality is fixed):**
- **G8 data-part reader:** `data-section` part written-by-ID, skeleton→verified, verifier stays on atomic output.
- **G3 semantic layer:** scoped LLM-judge over already-flagged load-bearing claims only. → **P2**

**Explicitly NOT doing:** token-streaming the artifact content (orphans the gate — see G2); a full multi-agent "Agentic Mode" coordinator (the bounded-concurrency orchestrator is the right altitude); copying v0's single-file/JSX-specific constraints (irrelevant to typed research data).
