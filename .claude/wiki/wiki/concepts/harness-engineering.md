# Harness engineering

The **harness** is the executable program wrapping an LLM — retrieval policy, memory, tool-calling, orchestration, prompt construction. The model is a fixed resource; the harness is what changes. Lee et al. (2026) show harness choice alone causes up to 6× performance swings at constant model and compute on MATH (Table 1). This reframes most "model engineering" work as harness engineering.

## Why this concept matters for AIGOS

Our `.claude/CLAUDE.md` + `.claude/rules/*.md` + `.claude/workspaces/aigos-feature-dev/` stages are a manually-authored harness for Claude Code. Same model (Opus 4.6), different harnesses produce different developer-velocity outcomes. The leverage is in the harness — which justifies the investment we are putting into the rules/workspace layer.

## What counts as harness for a coding agent

For Claude Code, the harness is the sum of:

- **CLAUDE.md** (project-level prompt: classification protocol, banned openers, skill routing)
- **Rules** (`.claude/rules/*.md`): verification gates, model-selection, exploration-budget, MCP policy, security, learned-patterns
- **Commands** (`.claude/commands/*.md`): `/feature`, `/ingest`, `/wiki-lint`
- **Workspaces** (`.claude/workspaces/aigos-feature-dev/stages/*`): 01-discover through 05-ship
- **Hooks** (`settings.json`): TypeScript check, prettier, session-start memory load
- **Connected MCPs**: Supabase, Chrome, Gmail, Slack, scheduled-tasks, etc.
- **Enabled skills**: selection + ordering matters because descriptions load into context

Every one of these is part of the harness. Every one is a lever.

## What the paper says about "how to improve a harness"

1. Skill text is the highest-leverage knob. Iterate on prompt wording before adding structural machinery.
2. Start from a baseline + a hard set of cases it fails on. Saturated baselines have nothing to optimize.
3. Log failures in a machine-queryable format so future sessions can diagnose confounds.
4. Prefer **additive** changes (preambles, snapshots) over mutations to control flow. See [[wiki/concepts/additive-over-mutation.md]].
5. Keep the evaluator separate from the proposer (verification gate ≠ implementation).

Points 2, 3, 5 are already wired into our repo. Point 1 is the "shorten CLAUDE.md, put detail in ARCHITECTURE.md" lesson we already applied. Point 4 is the net-new contribution.

## Sources
- [[raw/meta-harness-lee-2026.pdf]] — the paper that crystallized this concept
- [[wiki/sources/meta-harness-lee-2026.md]]

## Related
- [[wiki/concepts/filesystem-as-feedback-channel.md]]
- [[wiki/concepts/additive-over-mutation.md]]
- [[wiki/techniques/harness-search-loop.md]]
- [[wiki/concepts/skill-issue.md]] — Karpathy's corollary: when agents fail, the harness is usually wrong, not the model
