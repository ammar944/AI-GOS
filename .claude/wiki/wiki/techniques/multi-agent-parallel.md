# Multi-agent parallel

Pattern: run multiple coding agents in parallel, each on an isolated task, dispatched with explicit budgets and scope. Throughput maxes when you're not the bottleneck.

## Canonical example (Karpathy → Steinberg)

"Peter Steinberg — multiple Codex agents on one monitor, 10 repos checked out, each 20-minute task dispatched in parallel. You can move in much larger macro actions. It's not just like here's a line of code, here's a new function. It's like here's a new functionality and delegate it to agent one. Here's a new functionality that's not going to interfere with the other one."

## Preconditions

1. **Tasks are independent.** No shared state between agents. Different files, different repos, different scopes.
2. **Scope is precise.** Each dispatch has an ask, a scope, and a budget. Vague briefs spawn exploration spirals.
3. **A verification loop.** Without it, you can't trust the parallel output — you're just multiplying unverified work.

## How AIGOS already does this

- **Research-worker runners** (industry, ICP, competitors, offer, keywords) run in partial parallel via the pipeline.
- **`/team` orchestration** (OMC skill) dispatches N subagents on a shared task list.
- **Parallel tool calls** in a single message — enforced by CLAUDE.md.

## What breaks this pattern

- Shared mutable state (same file, same branch, same DB row).
- Lack of budgets → one spirals, others wait.
- Skipping verification because N agents × "it looked good" = N × overconfidence.

## Reference implementation in this repo

See `.claude/rules/exploration-budget.md` (caps), `.claude/workspaces/aigos-feature-dev/stages/02-plan/CONTEXT.md` (atoms = parallelizable tasks).

## Failure mode Karpathy names

"The bottleneck is how can I have more than one session of Claude Code or Codex? How can I do that appropriately?" The pattern is known. The orchestration is the unsolved part.

## Sources

- [[raw/karpathy-noam-no-priors-transcript.md]]

## Related

- [[wiki/sources/karpathy-noam-no-priors-transcript.md]]
- [[wiki/concepts/token-throughput.md]]
- [[wiki/concepts/auto-research.md]]
- [[wiki/tools/claude-code.md]]
- [[wiki/tools/codex.md]]
- [[wiki/entities/peter-steinberg.md]]
