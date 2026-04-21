# Meta-Harness (Lee et al., 2026)

Paper: "Meta-Harness: Filesystem-grounded LLM harness search." Yoonho Lee, Omar Khattab, Chelsea Finn. Stanford + MIT. arXiv:2603.28052v1, March 2026. State-of-the-art on TerminalBench-2 (48.9%, surpassing ForgeCode 47.6%) and MATH (up from 15.6 → 88.0 avg on some models via harness alone). Full paper mirrored as `raw/meta-harness-lee-2026.pdf` and `raw/meta-harness-lee-2026.txt`.

## Sources
- [[raw/meta-harness-lee-2026.pdf]] (primary)
- [[raw/meta-harness-lee-2026.txt]] (text extraction, for grep)

## The one-sentence claim

A coding agent (Claude Code Opus-4.6) given **unstructured filesystem access to all prior candidate source code, execution traces, and scores** can out-evolve prior code-search methods (OpenEvolve, GEPA) by an order of magnitude because raw traces — not summaries — are what enable causal reasoning over failures.

## What "harness" means here

The harness is the executable program wrapping the LLM: retrieval policy, memory, tool-calling, orchestration, prompt construction. The model is fixed; the harness changes. Harness choice alone causes up to 6× performance swings at constant compute on MATH (Table 1). Therefore the harness is where the leverage is.

## Method in one paragraph

Meta-Harness maintains a directory per candidate: source, scores, execution traces. On each iteration, a Claude Code proposer is handed the skill file + directory path and told to produce the next candidate. It reads what it wants — median 82 files/iter, 41% source / 40% traces / 19% scores — and writes a new candidate. Budget: 10MTok/iter (vs 2K-26K for OpenEvolve/GEPA; Table 1). The outer loop is Algorithm 1; it is deliberately thin (propose → validate → evaluate → persist).

## The ablation that matters

Without execution traces (source + scores only), median accuracy collapses to 34.6. With traces, 50.0. The paper positions this as the central finding: "raw execution traces are the critical feedback ingredient." Prior methods compressed (OpenEvolve's scalar program DB, GEPA's fixed critique format) — anticipating what info the proposer needs. Meta-Harness refuses the compression; the proposer reads whatever it wants, whenever.

## The TerminalBench-2 trajectory (Section 5 + Appendix B.3)

Seven iterations. Iterations 1-2 bundled structural fixes with prompt edits → regression. Iteration 3, the proposer explicitly diagnosed the confound from traces: prompt edits were the hidden variable, not the structural changes. Iterations 4-6 still fragile. Iteration 7 won by being **purely additive** — prepend an environment snapshot (pwd, `/app` listing, language + package manager versions, memory) to the initial prompt. No control flow modification. Proposer's verbatim hypothesis: "Injecting an environment snapshot before the first LLM turn will reduce wasted exploration episodes by 3-5 turns on dependency-heavy tasks." +1.3 points absolute over Terminus-KIRA baseline.

The paper draws the lesson explicitly: "Modifications to prompts and completion flow are high risk, even when the local hypothesis sounds reasonable." See [[wiki/concepts/additive-over-mutation.md]].

## Practical implementation tips (Appendix D)

Six engineering lessons:

1. The skill text is the highest-leverage knob — iterate on it before turning up iteration count.
2. Start with a baseline + a hard search set (examples the baseline gets wrong). Saturated baselines have nothing to optimize.
3. Log everything in machine-queryable format (JSON, hierarchical, consistent names).
4. A small CLI over the log directory (Pareto frontier, top-k, diff between runs) saves the proposer tokens on navigation.
5. Lightweight validation test (import, instantiate, call methods on tiny examples) filters malformed candidates cheaply.
6. Evaluator lives outside the proposer.

## Related
- [[wiki/concepts/harness-engineering.md]]
- [[wiki/concepts/filesystem-as-feedback-channel.md]]
- [[wiki/concepts/additive-over-mutation.md]]
- [[wiki/techniques/harness-search-loop.md]]
- [[wiki/tools/claude-code.md]] (the proposer model)

## Application to AIGOS

See the synthesis delivered 2026-04-20 and the `learned-patterns.md` updates of the same date. Short version: our `.claude/` rules + CLAUDE.md are a manually-authored harness; the paper's lessons (traces-not-summaries, additive-over-mutation, env snapshot as preamble) apply directly even though we are not running the outer-loop search.
