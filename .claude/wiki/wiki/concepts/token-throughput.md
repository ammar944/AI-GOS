# Token throughput

The replacement for FLOPs as the personal-productivity metric. "What is your token throughput and what token throughput do you command?"

## Karpathy's quote

"I actually kind of experienced this when I was a PhD student — you would feel nervous when your GPUs are not running. But now it's not about flops it's about tokens."

"I feel nervous when I have subscription left over, that just means I haven't maximized my token throughput."

## What it measures

Tokens/day your agents are actually consuming doing real work. Not tokens your subscription allows. Not tokens you typed. Tokens the agents spent reasoning and writing on your behalf.

## Implications

- **Multiple agents > one agent.** Serial single-agent work caps you at one agent's speed. Throughput = parallelism.
- **Switch providers when caps hit.** "If you run out of code on Codex you should switch to Claude." The model doesn't matter as much as the tokens flowing.
- **Idle subscription = wasted capex.** If you pay for 1M tokens/day and use 200k, the question is what you're bottlenecked on — probably specification or orchestration, not the models.

## How to increase throughput in this repo

1. Parallel tool calls in a single message (AIGOS CLAUDE.md already enforces this).
2. `/team N:executor` for parallel fixes.
3. `run_in_background=true` on long builds/tests so the main agent moves on.
4. Better feature specs so agents don't stall waiting for clarification.

## Not the same as cost efficiency

Throughput ≠ cheap. Opus at full blast is more throughput than Haiku at full blast, and also more expensive. Pair with `.claude/rules/model-selection.md` — default cheap, escalate on demand.

## Sources

- [[raw/karpathy-noam-no-priors-transcript.md]]

## Related

- [[wiki/sources/karpathy-noam-no-priors-transcript.md]]
- [[wiki/techniques/multi-agent-parallel.md]]
- [[wiki/concepts/auto-research.md]]
- [[wiki/tools/codex.md]]
- [[wiki/tools/claude-code.md]]
