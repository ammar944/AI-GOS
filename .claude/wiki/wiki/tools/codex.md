# Codex

OpenAI's coding-agent CLI. Karpathy's backup for when Claude hits subscription cap, and the tool Peter Steinberg is cited running 10 parallel instances of.

## Karpathy's take

- **Personality:** "Dry. Doesn't seem to care about what you're creating."
- **Use case:** When Claude's cap hits, switch to Codex. Maintain token throughput.
- **Steinberg's setup:** Multiple Codex agents on one monitor, 10 repos checked out, each 20-minute task dispatched in parallel.

## How it's wired in this repo

- Accessed via the `codex:*` skills (`codex:rescue`, `codex:setup`) from the `oh-my-claudecode` plugin.
- `/codex` skill wrapper available for code review (independent diff review) and hand-off of substantial work.
- Runtime contract: `codex-cli-runtime` skill.

## When to reach for Codex over Claude Code

- Second opinion on a diff — Claude wrote it, Codex reviews it (or vice versa).
- Claude is looping / stuck / the personality is interfering with a dispassionate call.
- Claude's monthly cap is spent and the throughput needs to keep flowing.
- The task is code-mechanical enough that the warmer personality adds no value.

## When NOT

- Design / UX / taste work — Karpathy's "dry" assessment suggests the collaborative back-and-forth is weaker.
- Anything requiring tight coordination with this repo's MCPs / hooks — they're wired for Claude Code.

## Sources

- [[raw/karpathy-noam-no-priors-transcript.md]]

## Related

- [[wiki/sources/karpathy-noam-no-priors-transcript.md]]
- [[wiki/tools/claude-code.md]]
- [[wiki/concepts/token-throughput.md]]
- [[wiki/techniques/multi-agent-parallel.md]]
- [[wiki/entities/peter-steinberg.md]]
