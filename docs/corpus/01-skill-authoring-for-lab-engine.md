# Authoring Lab-Engine Skill Modules (Anthropic best practice, adapted to wholesale injection)

Purpose: how to write `SKILL.md` files for the AI-GOS lab-engine, where Anthropic's progressive-disclosure runtime is **absent** — every skill is injected wholesale into a section system prompt and the running model has no filesystem.

## Contents
1. [The constraint that changes everything](#1-the-constraint-that-changes-everything)
2. [What does NOT transfer](#2-what-does-not-transfer-the-runtime-layer)
3. [What DOES transfer](#3-what-does-transfer-the-prompt-craft-layer)
4. [Recommended SKILL.md template for our constraint](#4-recommended-skillmd-template-for-our-constraint)
5. [De-duplication rule (the shared-preamble fix)](#5-de-duplication-rule-the-shared-preamble-fix)
6. [Anti-slop rules](#6-anti-slop-rules)
7. [Authoring checklist](#7-authoring-checklist)

---

## 1. The constraint that changes everything

Anthropic's Agent Skills model is a **filesystem + code-execution runtime feature, not a prompt format**. The docs are explicit: *"This filesystem-based model is what makes progressive disclosure work"* and *"Skills run in a code execution environment where Claude has filesystem access, bash commands, and code execution capabilities"* (https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview, .../best-practices). At startup the model holds only the ~100-token `name`+`description` (Level 1). On a match it `bash`-reads `SKILL.md` into context (Level 2); referenced `reference/*.md` files load on demand via further `Read`/`bash` calls (Level 3). Unread files cost zero tokens because they sit on disk until a tool fetches them.

**AI-GOS does none of this.** The lab-engine loads the entire `SKILL.md` body once per loop attempt and concatenates it onto the section system prompt — `runSectionViaAnswerTool()` appends `skillMd` verbatim after the built instructions (`build-prompts.ts:3067-3080`, survey:loop). The running model's only tools are `web_search`, `firecrawl`, ad-library/keyword probes — **there is no read/bash/file tool** (survey:loop §4). It cannot fetch a reference file mid-loop. Therefore:

- **There are no L2/L3 tiers.** The whole body is paid for upfront on every section run, and a section may run its body 1× primary + up to 2× repair (`answerToolMaxRepairAttempts: 2`, survey:loop §2) — so a bloated body is billed up to three times per section.
- **External `reference/*.md` files would never load.** Anything load-bearing must be inlined.
- **The token budget is a hard ceiling, not "effectively unlimited."** Anthropic's "split overflow into L3 files" advice **inverts** for us: there is no overflow valve. Concision is the only lever.

The thesis in one line: **the body must be self-contained AND maximally concise, because every token loads every run (and may load up to 3× per section).**

---

## 2. What does NOT transfer (the runtime layer)

Strip or rethink these — they are no-ops or actively misleading under wholesale injection (research:anthropic-skills §5):

- **Progressive disclosure / L1→L2→L3 staging.** Dead without a filesystem. Do not write "see `reference/foo.md` for detail" — that file is never read.
- **`name` / `description` as discovery drivers.** Their job is selection from a catalog at startup. Our sections are pre-selected by `SECTION_REGISTRY` routing (section-registry.ts), so the model never "chooses" a skill. Keep `description` only as human-facing metadata; it triggers nothing.
- **Bundled executable scripts ("low freedom = run exactly this script").** The model can't execute a bundled script. Any determinism a script would have enforced must become either (a) a real tool the runner exposes, or (b) explicit inline pseudocode the model follows.
- **`allowed-tools` and other Claude-Code frontmatter** (`disable-model-invocation`, `context: fork`, `paths`, `arguments`, etc.). No-ops here — tool access is governed by `allowedTools` in `SECTION_REGISTRY`, not frontmatter. Strip them.
- **"Add a table of contents to reference files >100 lines" / "keep references one level deep."** Both are about partial-reads of on-disk files. Irrelevant.

---

## 3. What DOES transfer (the prompt-craft layer)

The cognitive content of a research-synthesis skill maps cleanly. These Anthropic rules are pure prompt-craft and apply directly (research:anthropic-skills §1–§5, research:anthropic-agents §2–§4):

- **Assume Claude is already smart; strip what it knows.** *"Default assumption: Claude is already very smart."* The verbose-vs-concise example is ~3× tokens for zero added value. Under our hard ceiling this is the single most important rule. Keep the body well under 500 lines; aim much lower for a single section.
- **Calibrate degrees of freedom.** *"Match the level of specificity to the task's fragility and variability."* A research-analysis skill is **dominantly high freedom** (synthesis, judging source quality, theme extraction — the "code-review checklist" analog) with **low-freedom islands** wherever output must be machine-checkable: the output contract (the exact card/section schema) and the validate→fix→repeat loop. Write prose for the reasoning; write an exact template for the schema.
- **Concrete input/output example pairs.** Anthropic's "Correct vs Incorrect" pattern. The detailed skills already do this (market-category, competitor-landscape, buyer-icp carry linted card examples; survey:skills-schemas §3). One good correct/incorrect pair per non-obvious card beats a paragraph of description.
- **Consistent terminology.** Same word for the same concept across the whole body (and ideally across all 8 skills). POV must be consistent and third-person where it's metadata.
- **Workflows + feedback loops (plan-validate-execute).** Anthropic's no-code "Research synthesis workflow" is the reference design: read sources → identify themes → cross-reference claims → structured summary → verify citations. Pair it with the validator→fix→repeat loop — for us the "validator" is `validateMinimums` plus the lexical verifier (survey:skills-schemas §4, survey:loop §3), and the body should tell the model what those gates check so it self-corrects on the first pass.
- **Evaluation-driven authoring (two-Claude loop).** *Methodology, not runtime — fully transfers.* Author with Claude A, test with a fresh Claude B that runs the section, observe how B navigates the body (skipped guidance, ignored card schema, over-long prose), feed specific failures back. Anthropic requires ≥3 eval scenarios tested across Haiku/Sonnet/Opus before shipping; there is no built-in runner, so a real section run against a known fixture is the eval.
- **Tool descriptions are the highest-leverage lever** (research:anthropic-agents §2). For the tools a section *does* get, the body's "Research Tools Available" table should say what each returns and when to use it in 3–4 sentences — that's where tool-call quality comes from.
- **Goal recitation in the recent-attention slot** (research:manus-context-eng §4). Re-state the section's specific objective + the GTM brief at the **end** of the body, not only the top — it fights lost-in-the-middle on the longer single-section loops at near-zero cost.

---

## 4. Recommended SKILL.md template for our constraint

Order matters: the model reads top-to-bottom and the schema/contract is load-bearing, so put cheap framing first, the contract in the middle, and goal recitation last (recent-attention).

```markdown
---
name: positioning-<section-slug>          # metadata only; triggers nothing here
description: One sentence, third person, what+when. Human-facing only.
---

## Role
One paragraph: who this analyst is and the single question this section answers.

## Operating principles (HIGH freedom)
3–6 bullets of analytical judgment: how to weigh sources, what "good evidence"
means, when to flag a gap vs. assert. Prose, not procedure.

## Inputs you receive
The shape of ResearchInput + corpus excerpts already injected. 4–6 lines.
(Do NOT re-describe the corpus contents — they are in the prompt already.)

## Tools available
Table: tool | what it returns | when to fire it. 3–4 sentences of guidance per
tool. Only list tools this section is actually granted in SECTION_REGISTRY.

## Workflow (plan → gather → draft → self-check)
Numbered, evidence-first sequence ending in: "before emitting, confirm you pass
the minimums below; if not, gather more — do not pad."

## Output contract (LOW freedom — exact)
Name the Zod schema. List required top-level fields and each body sub-section /
card with field names + types. This MUST match the schema 1:1.

## Minimums the validator enforces
The validateMinimums rules for THIS section in plain language (e.g. "≥3 sources;
marketSize.signals needs ≥1 top-down AND ≥1 bottom-up"). So the model self-
corrects on pass one instead of burning a repair attempt.

## Correct vs incorrect (1 pair per non-obvious card)
Linted examples. Show a grounded card and the slop version it must not produce.

## Section objective (RECITED — keep last)
Restate the one question + how the GTM brief frames it. Recent-attention anchor.
```

What is deliberately **absent**: no "Capability Gaps" prose block, no "Budget note", no `allowed-tools`, no references to external files. Capability-gap and budget handling are identical across skills and therefore belong in the shared preamble — see §5.

---

## 5. De-duplication rule (the shared-preamble fix)

**Rule: if a block of prose is byte-identical (or trivially templated) across multiple skills, it does NOT belong in the skill body. It belongs in the shared system preamble built once by `build-prompts.ts`.**

The survey found exactly this duplication. In the original Phase 1 audit, each detailed `SKILL.md` carried a "Capability Gaps" block (~20 lines: tool-failure / rate-limit / evidence-gap handling), and the former stub skills were ~44% boilerplate. As of 2026-06-01, the stubs are enriched and the shared Capability Gaps / budget block is composed in `build-prompts.ts` for tool sections. Keep that split: shared tool-failure policy belongs in the prompt builder; section-specific evidence examples belong in each `SKILL.md`.

The lab-engine already builds a shared instruction frame (`buildAnswerToolInstructions()`, `buildCorpusOnlyBoundary()`, `buildSectionMinimumGuidance()`; survey:loop §1). Capability-gap handling, budget notes, the "no fabrication" iron law, confidence-envelope rules, and the anti-slop list are all section-agnostic and should live there once, not in N skill bodies.

This mirrors Manus's KV-cache discipline (research:manus-context-eng §1): a byte-stable shared prefix maximizes cache reuse across the 6-section fan-out, and identical-prose-per-skill is the opposite of that. **Cross-cutting boilerplate → shared preamble. Section-specific judgment, contract, and examples → skill body.** Nothing else.

A useful authoring test: diff any two skill bodies. Every line that is identical is a candidate for the preamble; every line that differs is the actual value of that skill.

---

## 6. Anti-slop rules

These apply to the skill body itself (so authors don't bloat it) and to the output the skill instructs the model to produce.

For the **author writing the skill**:

- No filler adjectives: forbid "leverage", "seamless", "robust", "game-changing", "powerful", "comprehensive", "cutting-edge" in the body.
- No re-explaining the corpus or ResearchInput — it is already in the prompt; describe only its *shape*.
- No prose that restates a Zod field's type in a sentence when the contract table already lists it.
- No defensive hedging or "as an AI" framing. Third person, declarative.
- No duplicated cross-cutting blocks (see §5).

For the **output the skill enforces** (carry these as explicit body rules, since the model can't read a `STYLE_GUIDE.md`):

- Every numeric and URL claim must trace to a tool result or corpus excerpt — these are the **load-bearing claim kinds the lexical verifier checks** (survey:loop §3). Unsupported load-bearing claims trip the repair loop and lower grounded confidence (confidence = verified / (verified + unsupported)).
- Never state a confidence figure in prose; report it only in the `confidence` field (survey:loop §1).
- Verbatim quotes only — no paraphrased "customer said" without a source.
- No fabricated pricing; only scraped values with source URLs (project rule).
- Bound the repair loop *in the prompt*, Cursor-style: "you have at most N repair attempts; if a claim is still unsupported, emit the honest badge and stop" — don't thrash (research:cursor-lovable).

---

## 7. Authoring checklist

Before a `SKILL.md` ships:

- [ ] Body is self-contained — zero references to external/`reference` files (they never load).
- [ ] No Claude-Code-only frontmatter (`allowed-tools`, `context`, `paths`, etc.) — stripped.
- [ ] No cross-cutting boilerplate (Capability Gaps, Budget note, iron law, anti-slop list) — moved to shared preamble; body diffed against a sibling skill to confirm no identical blocks remain.
- [ ] Output-contract section matches the section's Zod schema 1:1 (field names + types).
- [ ] `validateMinimums` rules for this section stated in plain language so the model self-corrects pass one.
- [ ] Tools table lists only the tools granted in `SECTION_REGISTRY` for this section, each with 3–4 sentences of what-it-returns / when-to-fire.
- [ ] At least one correct/incorrect example pair per non-obvious card type.
- [ ] Section objective recited at the **end** of the body (recent-attention slot).
- [ ] Numeric/URL grounding rule + "no confidence in prose" rule present (verifier alignment).
- [ ] No slop adjectives; declarative third person; assume the model is smart.
- [ ] Length sanity-checked — well under 500 lines, and as short as the contract + examples allow (it loads every run, up to 3× per section).
- [ ] Tested against a real section run with a known fixture (the eval), ideally on more than one model tier, before merge.
```
