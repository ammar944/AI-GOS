# Auto-research

Arrange once, hit go, walk away. A coding agent explores a research question (hyperparameter sweep, architecture variant, library benchmark) without your involvement. You come back to results.

## Karpathy's receipt

He's been tuning nanoGPT by hand for "two decades of experience with training." Let an auto-research run go overnight. "It came back with tunings that I didn't see. I did forget the weight decay on the value embeddings and my Adam betas were not sufficiently tuned."

His point: the expert is no longer faster than the automated search on questions the search can be specified clearly. "I shouldn't be a bottleneck."

## Requirements

1. **Clear specification.** What are you varying? What are you measuring? What's "better"?
2. **Cheap iteration.** If each step costs $100 you can't afford a sweep. Small model first, extrapolate via scaling laws (this is what frontier labs do).
3. **A loop that doesn't need your permission.** This is why bypass-permissions modes exist. See `.claude/rules/hooks-and-automation.md` bypass section.
4. **A clear stop condition.** "Run until X improvements plateau" or "try N variants."

## Relationship to this repo

- The wiki-ingest loop is a form of auto-research: specify a raw source, let the agent triage/synthesize/cross-link, come back to a populated wiki.
- AIGOS's research-worker pipeline is structurally similar: specify a profile, let the worker dispatch 8 runners, come back to 6 research cards + media plan + scripts.

## The untrusted-worker vision

Karpathy: swarm of internet workers collaborating on auto-research like folding@home. Expensive to search, cheap to verify. Reward = leaderboard placement. Not built yet, but plausible because the verification-gap is favorable.

## Forbidden pattern

Running paid-API loops (Firecrawl, Perplexity, Anthropic) without an abort condition. See `.claude/rules/exploration-budget.md` + `CLAUDE.md` rule: "Never run a paid API in a loop without an abort condition."

## Sources

- [[raw/karpathy-noam-no-priors-transcript.md]]

## Related

- [[wiki/sources/karpathy-noam-no-priors-transcript.md]]
- [[wiki/techniques/multi-agent-parallel.md]]
- [[wiki/concepts/token-throughput.md]]
- [[wiki/concepts/skill-issue.md]]
