# Herk LLM wiki walkthrough

Nate Herk's YouTube walkthrough of Karpathy's LLM wiki pattern, demonstrated on 36 of his own video transcripts.

- Domain: Learning & Research
- Intent: research, planning
- worth_porting: yes
- Tier: full
- Ingested: 2026-04-20

## One-line

You give raw markdown to Claude Code; it compares, organizes, and cross-links them into a browsable second brain — no embeddings, no vector DB, just a folder.

## Structure Herk uses

- `raw/` — untouched source files.
- `wiki/` — interpreted pages produced by Claude Code. Four default subfolders seeded: `analysis/`, `concepts/`, `entities/`, `sources/`.
- `index.md` — master table of contents, auto-maintained.
- `log.md` — operation history.
- `hot.md` — rolling ~500-char cache of "what we just talked about."
- `CLAUDE.md` — explains how the project works and how to search/update.

## Key quantitative claims from the transcript

- 36 YouTube transcripts → 23 wiki pages, produced in ~14 minutes.
- One X user: 383 scattered files + 100+ meeting transcripts → compact wiki → 95% token reduction on queries.
- Karpathy's own vault: ~100 articles, ~500,000 words, no RAG needed.

## The hot cache decision

Herk keeps `hot.md` on the brain that's actively being used in conversation (his executive assistant) but NOT on the 36-video archive. The cache is only useful when there's a "most recent thing we discussed" worth caching.

## Lint loop

Karpathy runs periodic LLM health checks to:
- Find inconsistent data
- Impute missing data via web search
- Spot new-article candidates (concepts mentioned repeatedly but without a dedicated page)

## Wiki vs RAG — Herk's framing

| | LLM wiki | Semantic search RAG |
|---|---|---|
| How it finds info | Reads indexes, follows links | Chunk similarity |
| Infra | Markdown folder | Embedding model + vector DB + chunk pipeline |
| Cost | Free (just tokens) | Ongoing compute + storage |
| Maintenance | Run a lint | Re-embed on change |
| Weakness | Doesn't scale to millions of docs | Loses relationship structure |

"Hundreds of pages with good indexes" is the sweet spot for this pattern.

## Setup instruction (Herk's verbatim)

"You literally just say hey cloud code read this idea from Andre Karpathy and implement it. And Karpathy even said, 'Hey, I left this prompt vague so that you guys can customize it.'"

## Sources

- [[raw/herk-llm-wiki-transcript.md]]

## Related

- [[wiki/concepts/llm-wiki.md]]
- [[wiki/techniques/wiki-lint-loop.md]]
- [[wiki/tools/obsidian.md]]
- [[wiki/entities/nate-herk.md]]
- [[wiki/entities/karpathy.md]]
