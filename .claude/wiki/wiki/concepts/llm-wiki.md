# LLM wiki

A markdown-folder knowledge base that a coding agent ingests, organizes, and queries. Four layers: raw sources, atomic interpreted pages, index, log. No embeddings, no vector DB.

## Why it works at this scale

- Hundreds of pages with a good index → the LLM reads the index, jumps to the relevant pages, answers. Much less noisy than chunk-similarity RAG.
- Relationships are typed links, not proximity in embedding space. "These chunks seem similar" is replaced by "these pages explicitly link each other."
- Maintenance is a lint, not a re-embedding pipeline.

## The four layers (this repo's version)

1. **`raw/`** — immutable sources. Never edited.
2. **`index.md`** — canonical control surface. Every page listed with a one-line summary.
3. **Synthesis pages** (`wiki/concepts/`, `wiki/entities/`, `wiki/tools/`, `wiki/techniques/`) — atomic interpreted pages, the readable second brain.
4. **Source notes** (`wiki/sources/`, `wiki/analysis/`) — per-source write-ups, detail the synthesis doesn't capture.

## What it replaces

- Chunk-embedding RAG for <5000-page knowledge bases.
- Ad-hoc notes folders where the LLM has to grep from scratch each session.
- "Re-explaining the project" at the top of every chat.

## What it doesn't replace

- Enterprise-scale retrieval over millions of documents (where you do want a vector DB).
- Live conversation memory (use session-memory for that).
- Graph-of-code tools like `.understand-anything/knowledge-graph.json` — those are code-aware; the wiki is domain/concept-aware.

## When to use which

| Need | Layer |
|---|---|
| "What did Karpathy say about X?" | Wiki |
| "Where is function foo defined?" | Knowledge graph |
| "What did WE decide about X last month?" | Session memory |

Three legs of one system.

## Failure mode to avoid

Reading raw/ first. That's what the retrieval order (`.claude/wiki/retrieval-rules.md`) prevents — it makes you go hot → index → synthesis → source → raw. Starting at raw burns 50k tokens to answer something a 200-token atomic page already contains.

## Sources

- [[raw/herk-llm-wiki-transcript.md]]
- [[raw/karpathy-noam-no-priors-transcript.md]]

## Related

- [[wiki/sources/herk-llm-wiki-transcript.md]]
- [[wiki/techniques/wiki-lint-loop.md]]
- [[wiki/tools/obsidian.md]]
- [[wiki/entities/karpathy.md]]
