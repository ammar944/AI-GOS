# Wiki Index

Master table of contents. Updated by agents on every ingest.

Last updated: 2026-04-20

## Sources
<!-- One entry per ingested raw document. Format: [[wiki/sources/x.md]] — one-line description -->
- [[wiki/sources/herk-llm-wiki-transcript.md]] — Nate Herk walkthrough of Karpathy's LLM wiki pattern, demoed on 36 YouTube transcripts
- [[wiki/sources/karpathy-noam-no-priors-transcript.md]] — Karpathy on No Priors (Conviction): coding agents, token throughput, auto-research, jaggedness, markdown-for-agents
- [[wiki/sources/meta-harness-lee-2026.md]] — Lee/Khattab/Finn, Stanford+MIT, arXiv 2603.28052v1: filesystem-grounded harness search with Claude Code as proposer; SOTA on TerminalBench-2 and MATH

## Concepts
- [[wiki/concepts/llm-wiki.md]] — Markdown-folder knowledge base with raw / index / synthesis / source-notes layers; no embeddings
- [[wiki/concepts/auto-research.md]] — Arrange once, hit go, walk away — the pattern Karpathy used on nanoGPT
- [[wiki/concepts/token-throughput.md]] — Replacement for FLOPs as personal-productivity metric; the reason to run agents in parallel
- [[wiki/concepts/jaggedness.md]] — PhD + 10-year-old simultaneously; RL-trained tasks sharp, soft tasks flat
- [[wiki/concepts/cognitive-core.md]] — Shared reasoning substrate that should specialize once fine-tuning-without-forgetting matures
- [[wiki/concepts/markdown-for-agents.md]] — Docs are for the router LLM now; humans get translation on demand
- [[wiki/concepts/skill-issue.md]] — Default assumption when agents fail: the setup is wrong, not the model
- [[wiki/concepts/harness-engineering.md]] — The scaffolding around an LLM (retrieval, memory, orchestration, prompts) is the leverage point; up to 6× performance swings at constant model
- [[wiki/concepts/filesystem-as-feedback-channel.md]] — Raw traces beat summaries; ablation shows 34.6 → 50.0 median when the proposer reads unsummarized execution traces
- [[wiki/concepts/additive-over-mutation.md]] — Prepending a preamble or adding a new file beats mutating existing control flow; Meta-Harness TB2 iter 7 won by being purely additive

## Entities
- [[wiki/entities/karpathy.md]] — Andrej Karpathy — independent, ex-OpenAI/Tesla, originator of the LLM-wiki pattern
- [[wiki/entities/nate-herk.md]] — @nateherk on YouTube — demonstrated the LLM-wiki pattern on 36 video transcripts
- [[wiki/entities/peter-steinberg.md]] — Engineer Karpathy names as the canonical multi-agent-parallel practitioner

## Tools
- [[wiki/tools/claude-code.md]] — Anthropic's agentic CLI; the coding agent this repo is configured around
- [[wiki/tools/codex.md]] — OpenAI's coding-agent CLI; Karpathy's pair with Claude for parallel and second-opinion work
- [[wiki/tools/obsidian.md]] — Markdown-vault IDE with graph view; optional but nice for browsing the wiki

## Techniques
- [[wiki/techniques/multi-agent-parallel.md]] — Dispatching multiple agents on independent tasks with explicit budgets
- [[wiki/techniques/wiki-lint-loop.md]] — Periodic health-check over the wiki: orphans, stale refs, imputation candidates
- [[wiki/techniques/harness-search-loop.md]] — Outer-loop algorithm: propose → validate → evaluate → persist; Claude Code as proposer with full-history filesystem access

## Analysis
<!-- Cross-source synthesis. Added as patterns emerge across 3+ pages. -->
