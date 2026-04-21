# Markdown for agents

Documentation's primary reader is no longer the human. It's the router LLM. The human gets the answer translated back on demand.

## Karpathy's reframe

"Normally I would be tempted to make a video stepping through [microGPT]. But it's so simple now that any agent can explain it. I'm not explaining to people anymore. I'm explaining it to agents."

"If you can explain it to agents, then agents can be the router. They can target it to the human in their language with infinite patience."

"Instead of HTML documents for humans, you have markdown documents for agents. Because if agents get it, they can explain all the different parts."

## What changes if this is true

- **Docs optimize for LLM ingestibility, not for human reading flow.** Dense fact statements, explicit relationships, no clever prose.
- **Backlinks matter more than narrative.** The agent follows links; the human asks questions.
- **Length is cheap for agents.** They don't get bored. But context windows are finite, so keep atomic pages < 200 lines (wiki rule).
- **Markdown beats HTML.** Machine-readable, easy to emit, easy to diff.

## Validation in this repo

- `CLAUDE.md`, `.claude/rules/*.md`, `.claude/wiki/*` — all optimized for the agent reading them at session start, not for a human reading them front-to-back.
- `ARCHITECTURE.md` is denser than a typical project README because its reader is an LLM.
- The wiki pages themselves are at-most-200-line atomic concept pages with explicit `[[wiki/...]]` backlinks.

## Tension with human readability

A human audit of the wiki (this session, 2026-04-20) is still useful — but the human audits structure, not content. The content is for the agent.

## Sources

- [[raw/karpathy-noam-no-priors-transcript.md]]

## Related

- [[wiki/sources/karpathy-noam-no-priors-transcript.md]]
- [[wiki/concepts/llm-wiki.md]]
- [[wiki/entities/karpathy.md]]
