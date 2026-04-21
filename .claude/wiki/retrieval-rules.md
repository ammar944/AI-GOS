# Retrieval Rules

When an agent is asked a question that might be answered from the wiki, read in this exact order. Stop at the first layer that answers the question.

## Order

1. **`hot.md`** — rolling 500-char cache of the most recent ingest context. If the question is about what we just talked about, this is the answer.
2. **`index.md`** — the triage index. Every wiki page is listed here with one-line summaries. Use this to locate relevant pages without opening them.
3. **Domain / topic / entity pages** (`wiki/concepts/*`, `wiki/tools/*`, `wiki/entities/*`, `wiki/techniques/*`) — the synthesized atomic pages. These are the answer for 80% of questions.
4. **Source notes** (`wiki/sources/*`, `wiki/analysis/*`) — full write-ups of single sources. Read only when an atomic page references them and you need detail the page didn't capture.
5. **Raw transcripts** (`raw/*`) — immutable source of truth. Read only for verification, quote-checking, or when auditing a suspected wrong synthesis.

## Why this order

- `hot.md` is cheapest (1 read, <500 chars) — try it first.
- `index.md` lets you skip reading pages that aren't relevant.
- Atomic pages are the designed answer surface. If they don't answer, the atomic pages are too thin — fix the page, don't fall through to raw.
- Raw is fidelity insurance, not a primary retrieval layer. Starting at raw is how sessions burn 30k tokens on a question a 200-token atomic page already answers.

## When to bypass the order

- **Transcript-first analysis**: the user explicitly asks "what exactly did Karpathy say about X?" — go to raw, cite the line.
- **Audit**: you suspect a wiki page mis-states a source. Read raw, verify, fix the page.
- **New source just ingested**: nothing in the wiki yet — raw is the only layer with content.

## What to do if the wiki doesn't answer

1. Say so explicitly — "wiki doesn't cover this."
2. Check if `raw/` has a source that covers it. If yes, answer from raw and flag that this page should be synthesized.
3. If neither, say "I don't know — not in the wiki." Don't invent.

## The failure mode this prevents

Without this rule, agents default to raw transcripts (they trust the source) and reread 50k tokens to answer a question already synthesized in a 200-token page. That's the cost of not having retrieval rules.
