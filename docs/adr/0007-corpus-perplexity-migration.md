---
status: accepted
date: 2026-05-26
---

# Corpus research engine migrates off Anthropic to Perplexity sonar (kept on the Railway worker)

The shared corpus pass (`deepResearchProgram`) is the last load-bearing Anthropic dependency on the v3 lab research path. v3's direction is off-Anthropic (DeepSeek sections, ADR-0006). This records the decision to move the corpus engine to Perplexity sonar, the provider choice, what is kept vs. changed, and the course-purest alternative that was deferred — so the next executor does not re-derive it.

## Context — the corpus is Anthropic-architecture-coupled, not a model pin

`research-worker/src/runners/deep-research-program.ts` is built on the Anthropic SDK's native `client.beta.messages.toolRunner` with Anthropic **hosted** tools (`web_search_20250305`, `code_execution_20250825`) and skills/containers (`enableSkillsBeta`), and hard-checks `ANTHROPIC_API_KEY`. The `RESEARCH_DEEP_PROGRAM_MODEL` env var only swaps *which Anthropic model* runs — it cannot point at another provider. So "corpus off Anthropic" is a **corpus-engine rewrite, not a config change**.

## Decision — Perplexity sonar, worker-resident, wrapped in the course discipline

Rewrite the corpus engine onto **Perplexity sonar** (`@ai-sdk/perplexity`), **kept on the Railway worker** (honoring the parent B–G handoff's locked "keep the Railway corpus path"). The rewrite preserves the existing corpus output contract — `{ corpus: { company, category, researchSummary, sources[], evidence[] }, onboardingFields: {…} }` → `src/lib/research-v2/corpus-to-research-input.ts` → `ResearchInput` — and is wrapped in the AIHero AI SDK v6 course discipline (board §06): bounded lifecycle, structured output, persist-after-validate, **evals-as-gates** (≥6 cited sources / ≥8 evidence excerpts / 0 fabricated URLs), observability.

### Why Perplexity and not DeepSeek (the model question)

- **Perplexity sonar** is citation-native (serves the zero-fabrication standard, `feedback_no_fabricated_pricing`) and is **already a proven worker dependency** — `research-worker/src/competitors/sonar-research.ts` runs `createPerplexity()` + `perplexity('sonar')` today. No new provider plumbing.
- **DeepSeek** has no native web search and is **not a worker dependency** (the DeepSeek engine lives in `src/lib/lab-engine`, which the worker cannot import). Routing the corpus through DeepSeek would require net-new search-tool plumbing in the worker.

## The road not taken — DeepSeek as a unified lab-engine agent (course-purest, deferred)

The AIHero course's "build a research agent" method is an explicit `ToolLoopAgent` loop over your own search tools + `Output.object` + bounded lifecycle + evals, with **no second code path**. The *purest* fit is therefore **DeepSeek run as a lab-engine agent that unifies the corpus and the 6 sections on one loop** — not a managed sonar call. This was considered and **deliberately deferred**: it relocates the corpus out of the worker and reverses the parent handoff's locked "keep the Railway corpus path," a materially larger change. The accepted divergence is that sonar is a managed research call rather than an agentic loop; the rest of the §06 discipline still wraps it. Revisit the unify path if/when the Railway worker corpus path is itself retired.

## Consequences

- **Sequencing:** the corpus rewrite lands first behind its own verification gate (worker build = exactly its 6 baseline errors, no 7th; a live sonar corpus on one URL yields ≥6 real cited sources / ≥8 excerpts; `researchInputSchema` parses) — *then* the ≥3 fresh-URL proof gate. See `docs/2026-05-26-v3-corpus-perplexity-and-proof-gate-handoff.md`.
- **Reverses** the implicit "deepResearchProgram stays on Platform [Anthropic]" note in `research-worker/src/runners/positioning-subagent-runner.ts:4` and ADR-0006's framing of the corpus base.
- **Prod (Phase G)** env now requires `PERPLEXITY_API_KEY` alongside `DEEPSEEK_API_KEY`. Anthropic then remains only in the teardown-slated worker positioning/managed runners; full Anthropic removal from the v3 path is confirmable after this lands.
- **No fabrication regression:** sonar citations populate `corpus.sources` / `corpus.evidence`; the evals-gate rejects thin or fabricated corpora before persist.

## References
- Handoff: `docs/2026-05-26-v3-corpus-perplexity-and-proof-gate-handoff.md`
- Parent: `docs/2026-05-26-v3-bg-execution-handoff.md` (the "keep Railway corpus path" lock this honors)
- Proven sonar pattern: `research-worker/src/competitors/sonar-research.ts`
- Supersedes the corpus-on-Anthropic assumption in ADR-0006 and board §06.
