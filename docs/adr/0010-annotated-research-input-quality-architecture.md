---
status: accepted
date: 2026-06-07
---

# Annotated ResearchInput (ARI): unified research-quality architecture, DeepSeek-only prod + offline judge

This records how AI-GOS reaches a genuine **9/10** Pre-Pitch Positioning Audit (accurate **and** insightful), and why we rejected building a new evidence store / graph / orchestrator in favour of annotating the object that already flows through the pipeline.

## Context — a verified summarizer, not a thinker, drowning in scattered fixes

Goal: research quality is a real 9/10 — built faithfully from the **Corpus** + **Onboarding**, free of hallucination, with grounded metrics (sales cycle, ACV, pricing), carrying non-obvious strategist reasoning that survives a senior-marketer "I already knew that" sweep. The bar is judged by a strong model (Claude/GPT-5.5), **not** by the deterministic gate going green (see CONTEXT.md "Research quality vocabulary").

Verified current-state (branch `feat/research-quality-truthgate` @ `e0b6bb62`), the disease is **lossy hop-by-hop compression**:

- **Corpus** (`research-worker/src/runners/deep-research-program.ts`) is gated by **counts only** (≥10 URLs, ≥16 evidence items, ≥6/9 buckets). 16 bland paraphrases pass identically to 16 sharp facts. No metric/richness judge.
- **Onboarding** reaches the model as a raw JSON blob with zero strategic framing (`build-prompts.ts:188`); evidence is routed to sections by crude keyword match.
- **Sections** fan out blind to each other (`orchestrate/route.ts`, `Promise.allSettled`). Insight enforcement is regex.
- **Thinker** (the only cross-section component) runs on `deepseek-v4-flash`, reads **compressed** committed artifacts (told to ignore raw evidence at `positioning-cross-section-reasoning/SKILL.md:23`), **self-grades**, **throws-and-drops** its critique on a floor-miss so the rubric scores the *absence* as failure (`strategic-critic.ts`), and is **client-dispatched** (`use-audit-state.ts:313`) so a closed tab skips it entirely.
- **Gates** (`live-quality-gate.ts`) have **no runtime caller** (offline diagnostic only); 5 of 6 measure honesty/plumbing; `projectionSync` is literally `projectionTrust` assigned twice (`:1538`). `verification_tier` is copied into 3 surfaces that drift.
- **Models** (`models.ts`): under `LAB_ENGINE_PROVIDER=deepseek-direct` (prod) with `LAB_REVIEW_MODEL` unset, review + strategy **silently collapse onto flash** — flash grades flash. The Sonnet/Opus tier the T1 spec promised is dormant.

Of ~36 recent commits, ~26 were trust/gate/plumbing; the insight axis got one 5-hour burst then 21 straight trust commits. The product can now *detect* non-insight (knew-that, scored 8/10 live) but its insight *engine* is underpowered and its insight *verifier* is the producer grading itself.

A 4-way design bake-off (evidence-ledger store, threaded dossier, ToolLoopAgent coverage-orchestrator, entity/claim collision graph) was run and adversarially critiqued **against the code**. Every heavy option was ~40% stealth-rewrite and/or fatally flawed: the ledger's concurrent write-back reintroduces the exact trigger-vs-CAS race this branch already fought (`e0b6bb62`/`d86abe54`); the dossier's "await section commit" is impossible because `orchestrate` only awaits an ACK and work runs in Vercel `after()`; the orchestrator control-plane fights that same serverless reality; the collision-graph's best collisions are blocked by `validateNoNewSourceSectionRefs` requiring ≥2 committed-section source refs.

## Decision — annotate the existing object; strong model offline; cheap model in prod

**1. Annotated ResearchInput (ARI).** The run's shared context is the existing `ResearchInput`, annotated with three things and threaded through the seams that already carry it:
- **Provenance** (`user-supplied | tool-measured | source-reported | model-estimated | unknown`, the enum already live at `build-prompts.ts:547`) on every onboarding field and corpus fact.
- **Coverage**: a deterministic map of required strategic inputs (ACV, sales cycle, pricing, competitors, buyer titles, category, motion) → `grounded | thin | missing`, judged by provenance not source-count.
- The cross-section **critique**, carried on the existing capstone artifact.

ARI is authored **once at the corpus→input merge** (`corpus-to-research-input.ts`) = single writer. Sections read it **read-only** via AI SDK v6 `experimental_context` (already proven in-repo at `src/lib/ai/tools/research/dispatch.ts:43`); anything a section discovers lands in **its own** Artifact (single writer per section); the Thinker assembles everything read-only. **No concurrent shared-row writes** — the race is gone by construction, not by locks. ARI is per-run (never a module-level singleton) and persisted as JSON (never Markdown).

**2. Provenance fixes the accuracy root-cause.** The verifier/review treat operator-supplied numbers as grounded, not hallucinated — killing the TruthGate false-fail where the user's own ACV was flagged "unsupported."

**3. Coverage replaces count-gating** as the research-quality floor; each gap maps 1:1 to a Coverage item id, which is what makes the offline-judge iterate loop actionable.

**4. Server-owned, evidence-fed, non-dropping Thinker on `deepseek-v4-pro`.** Move the trigger server-side (idempotent via the existing dispatch-zones guard; client trigger kept as fallback); relax its SKILL.md to read raw `corpus.excerpts`; fix throw-and-drop (return `belowFloor:true` + partial critique, deepen once, commit best-effort with the existing `needs_review` badge); route **only** the thinker+critic to pro via a **second `deepseek(PRO_ID)` instance wired to `strategyModel` only** (not the constant flip), with its own `providerOptions` (`thinking:{type:'enabled'}`, `reasoningEffort`).

**5. The strong judge stays offline.** A read-only Claude/Codex skill (`/Users/.agents/skills/ai-gos-research-quality-review`) scores 9/10 against the persisted ARI + gate report and drives the iterate loop. It never runs in prod → DeepSeek-only prod, zero added API cost. The in-prod DeepSeek entailment-judge that failed live is retired.

**6. DeepSeek-safe structured idiom everywhere new.** Answer-tool + Zod-safeParse repair, and the `<tag>{json}</tag>` regex-TAIL parse for thinker/critic/judge. DeepSeek JSON mode is not strict-schema, so provider-native `Output.object` is never the trusted path on DeepSeek.

## Considered alternatives

- **A new typed Evidence Ledger table with section write-back** — rejected: concurrent fan-out write-back is a lost-update race (documented history on this branch); ~40% rewrite. ARI keeps the typed-claim *concept* but makes it single-writer.
- **A threaded dossier with 2-wave awaited fan-out** — rejected: `orchestrate` only awaits an ACK; section work runs in `after()`. Real waves need a status-machine re-dispatch controller = the stealth rewrite.
- **A ToolLoopAgent coverage-orchestrator control plane** — rejected: fights the serverless `after()` reality; the user wants execution coherence (one ordered plan), not a new runtime object.
- **An entity/claim collision graph promoting onboarding/corpus tensions to thinker threads** — rejected: blocked by `validateNoNewSourceSectionRefs`; such collisions can only land as a profile/badge signal without schema surgery.
- **A strong model in the prod request path (Opus/GPT-5.5/gateway)** — rejected: cost + the DeepSeek-only/no-gateway constraint. The strong model is the *judge*, offline.
- **Keep hardening the deterministic gate** — rejected: it measures honesty/structure, not insight, and doesn't even run at runtime. The gate is a floor, not the grade.

## Consequences

- Cheap, incremental, race-free; all changes graft onto compiling v6 seams (`experimental_context`, `stopWhen`, `prepareStep`, the answer-tool path, `required-evidence` predicate, the `strategic-critic` generateText+TAIL, the `LAB_REVIEW_MODEL` channel).
- The insight lift depends on the pro-thinker + structural fixes being **proven by a live run scored by the offline judge** — unit-green never substitutes for working.
- Corpus-source richness (worker re-fetch) is deferred until the cheaper frontend Coverage floor proves insufficient.
- Execution is canonicalised in `docs/2026-06-07-research-quality-ARI-unified-plan.md`; phases are driven via isolated Codex handoffs, each diff-verified and judge-gated, to prevent the scattered-fix drift that motivated this ADR.
