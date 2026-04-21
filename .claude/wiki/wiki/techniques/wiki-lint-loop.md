# Wiki lint loop

Periodic LLM health-check over the wiki. Finds inconsistencies, orphan pages, stale references, and imputation candidates (topics mentioned in 3+ pages with no dedicated page).

## Karpathy's framing

"Karpathy runs some LLM health checks over the wiki to find inconsistent data, impute missing data with web searches, find interesting connections for new article candidates, things like that. So it basically helps you run a lint, you know, every day, every week, whenever you want."

## What the lint checks (this repo)

Defined in `.claude/wiki/CLAUDE.md` section "Lint flow" and operationalized in `.claude/commands/wiki-lint.md`:

1. **Structural:** every page has a source backlink, a related backlink, and an index entry.
2. **Orphans:** pages that no one else links to.
3. **Stale refs:** index.md → missing page, or page → missing raw.
4. **Imputation candidates:** terms mentioned in 3+ pages with no dedicated page.
5. **Review-queue drain:** items older than 60 days default to `no`.

## What it does NOT do

- Auto-fix. Report only. User approves each fix.
- Edit `raw/`. Never.
- Delete pages without an explicit `y`.

## Cadence

Weekly is enough. Monthly is fine for a wiki under 50 pages. Run after every batch-ingest of >3 sources.

## Why this matters more than it sounds

Without a lint loop, entropy wins. Pages get written, authors forget backlinks, pages contradict each other, and the index drifts from reality. The lint is the antifragility step.

## Invocation

`/wiki-lint` — runs the full check, appends a report block to `log.md`, waits for user go-ahead before any edits.

## Sources

- [[raw/herk-llm-wiki-transcript.md]]

## Related

- [[wiki/sources/herk-llm-wiki-transcript.md]]
- [[wiki/concepts/llm-wiki.md]]
- [[wiki/entities/karpathy.md]]
