# Claude Code

Anthropic's agentic CLI. Primary coding-agent interface for this repo. Karpathy contrasts it favourably with Codex: Claude has a "compelling personality that feels like a teammate."

## Why it's in this wiki

Both primary sources in the wiki use Claude Code as their coding agent:

- Herk demonstrates the LLM-wiki pattern by saying "hey cloud code read this idea from Andre Karpathy and implement it."
- Karpathy uses it alongside Codex for parallel work.

## Karpathy's take on it

- Personality: "Claude has a compelling personality. Codex is more dry."
- Sycophancy calibration: "When Claude gives me praise I do feel like I slightly deserve it. I kind of feel like I'm trying to earn its praise which is really weird." (Dialed well, not too much.)
- "Claw" (the concept) = Claude running in sandbox mode doing persistent work on your behalf even while you're not looking.

## How it's configured in this repo

- **Settings:** `.claude/settings.json` (hooks, permissions) + `.claude/settings.local.json` (local overrides).
- **MCPs:** claude-flow + supabase. Only two — see `.claude/rules/mcp-policy.md`.
- **Rules:** `.claude/rules/*.md` loaded by reference from `CLAUDE.md`.
- **Commands:** `.claude/commands/*.md` — this repo has `feature`, `ingest`, `wiki-lint`, plus claude-flow/sparc/github bundled.
- **Bypass-permissions:** allowed for safe loops (wiki ingest, lint, sandboxed auto-research). Policy in `.claude/rules/hooks-and-automation.md`.

## In parallel with Codex

Karpathy runs both — switch when one hits subscription cap. See [[wiki/concepts/token-throughput.md]].

## Sources

- [[raw/karpathy-noam-no-priors-transcript.md]]
- [[raw/herk-llm-wiki-transcript.md]]

## Related

- [[wiki/sources/karpathy-noam-no-priors-transcript.md]]
- [[wiki/sources/herk-llm-wiki-transcript.md]]
- [[wiki/tools/codex.md]]
- [[wiki/concepts/token-throughput.md]]
- [[wiki/techniques/multi-agent-parallel.md]]
- [[wiki/entities/karpathy.md]]
