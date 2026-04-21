# Wiki — second brain for AIGOS

Karpathy/Herk-style LLM knowledge wiki, hardened with Simon Says's triage discipline. This file is the operating contract for any agent that ingests, queries, or lints the wiki.

## Mental model — the one insight that matters

Four layers, in order of canonicality:

1. **Raw** (`raw/`) — immutable source of truth. Transcripts, docs, papers as-ingested. NEVER edited. Fidelity insurance.
2. **Index** (`index.md`) — the canonical control layer. Every wiki page listed with a one-line summary. This is what you search first. If the index is right, the wiki can be rebuilt.
3. **Synthesis pages** (`wiki/concepts/`, `wiki/entities/`, `wiki/tools/`, `wiki/techniques/`) — atomic interpreted pages. The readable second brain.
4. **Source notes** (`wiki/sources/`, `wiki/analysis/`) — per-source write-ups. Detail the synthesis pages don't capture.

The index is canonical, not the wiki. If you treat the wiki as canonical, every rename becomes a data migration. Treat the index as canonical and the wiki is a projection you can rebuild.

## Structure

- `raw/` — **do not edit.** Full ingested sources (transcripts, articles, PDFs converted to md, pasted content).
- `wiki/` — interpreted layer, maintained by agents. Split by type:
  - `sources/` — one page per ingested source, summarising + linking back to `raw/<file>`.
  - `concepts/` — abstract ideas (e.g. `icm.md`, `auto-research.md`, `jaggedness.md`).
  - `entities/` — people, companies, models, projects (e.g. `karpathy.md`, `anthropic.md`).
  - `tools/` — named software/APIs (e.g. `claude-code.md`, `obsidian.md`).
  - `techniques/` — named patterns/methods (e.g. `wat-framework.md`, `auto-research-loop.md`).
  - `analysis/` — synthesis across sources ("what does the corpus say about X").
- `index.md` — master table of contents. Canonical.
- `log.md` — append-only operation history. Every ingest/lint/update logged.
- `hot.md` — rolling cache of the last ~500 chars of notable context. Purged on session start.
- `taxonomy.md` — domain/intent/worth contract. Read before any ingest. See [taxonomy.md](./taxonomy.md).
- `retrieval-rules.md` — the reading order for queries. See [retrieval-rules.md](./retrieval-rules.md).
- `review-queue.md` — pressure valve for ambiguous items. See [review-queue.md](./review-queue.md).

## The triage gate — what enters the wiki

Not every ingested source becomes a wiki page. Apply the taxonomy from [taxonomy.md](./taxonomy.md) to every source BEFORE expanding it into atomic pages.

For each source:

1. Assign a **primary domain** (exactly one from `taxonomy.md`).
2. Assign **one or two intents**.
3. Decide **worth_porting**: `yes`, `no`, or `review`.
   - `yes` → proceed to synthesis.
   - `no` → log it, skip it. Source stays in `raw/` as fidelity but does not enter the wiki.
   - `review` → append a block to `review-queue.md`, do not synthesize. The human decides later.
4. For `yes` items, decide **tier**: `full` or `synthesis_only`.
   - `full` → creates its own source note in `wiki/sources/`.
   - `synthesis_only` → contributes facts/quotes to topic/entity pages but does NOT get its own source note.
   - Default to `synthesis_only`. Promote to `full` only for durable, dense, durable-intent sources. Simon's production ratio was 46% `full` / 54% `synthesis_only`.

Strictness:
- Be skeptical but not over-skeptical. Short doesn't mean `no`. Important-sounding doesn't mean `yes`.
- When torn between `yes` and `review`, pick `review`.
- When torn between `review` and `no` for disposable lookups, pick `no`.

## Ingest flow — when user says "ingest X" or drops a file in `raw/`

1. Read the raw file fully. No truncation.
2. **Apply the triage gate** (above). Record the decision. Stop here if `no` or `review`.
3. For `yes` items, identify atomic units: each distinct concept, entity, tool, technique, argument. Aim for 5–15 pages per source (small > big).
4. For each atomic unit:
   - Check `index.md` — does the page exist? If yes, **enrich** (add source reference, merge facts). If no, **create** in the right subfolder.
   - Kebab-case filenames: `wiki/concepts/auto-research-loop.md`.
   - Every page starts with: (a) one-line definition, (b) `## Sources` with backlinks to `raw/<file>`, (c) `## Related` with `[[wiki/...]]` backlinks.
5. If the source is `full` tier, also create `wiki/sources/<slug>.md` summarising the whole source.
6. Append a line to `log.md`: `YYYY-MM-DD ingest: <raw file> — domain=<x> intent=<y> worth=yes tier=<full|synthesis_only> → N new pages, M enriched`.
7. Update `index.md`: add every new page with its one-line summary.
8. Update `hot.md` with a one-line summary of what was just ingested.

## Query flow — when user asks a question

Follow [retrieval-rules.md](./retrieval-rules.md). Short version:

1. `hot.md` first (cheapest).
2. `index.md` second (map to relevant pages).
3. Synthesis pages third.
4. Source notes fourth.
5. Raw only for verification, audit, or when nothing above has it.
6. Never grep the whole wiki. Use the index.

After answering, update `hot.md` with question + one-line answer.

## Lint flow — when user says "lint" or "health check"

1. For every wiki page: does it have at least one source, one related link, and an `index.md` entry? If not, flag.
2. Find orphans (pages no other page links to). Flag.
3. Find stale entries: `index.md` references a file that doesn't exist, or a page references a `raw/` file that's gone. Flag.
4. Find imputation candidates: concepts mentioned in 3+ sources with no dedicated page. Flag.
5. **Drain `review-queue.md`**: any items older than 60 days without action → mark `no`, remove.
6. Write a report into `log.md`. Do not auto-fix. Wait for user go-ahead.

## Forbidden

- Editing `raw/`. Source of truth. Immutable.
- Creating pages > 200 lines. Split.
- Deep subfolder nesting. Max 2 levels (`wiki/<type>/<page>.md`).
- HTML. Markdown only.
- Vector DBs, embeddings, or RAG infra. This is deliberately flat markdown.
- Grepping the whole wiki to answer a question. Use the index. Grepping defeats the structure.
- Ingesting without running the triage gate. Every source gets a yes/no/review decision.
- Creating a wiki page for a `review` item before it's been promoted to `yes`.

## Style

- Every page has a 1-line summary at the top, then sections.
- Backlinks use `[[wiki/concepts/x.md]]` so Obsidian can render them.
- Prefer linking over repeating. If a concept has its own page, link — don't restate.
- Keep pages < 200 lines. Split if bigger.

## What this replaces in the original wiki

The first version of this file (Apr 20 2026) was Karpathy/Herk only: raw + wiki + index + log + hot. Simon Says's system added the triage gate (worth_porting + tier) and the explicit taxonomy and retrieval order. Those are the additions. The Karpathy structure is intact.
