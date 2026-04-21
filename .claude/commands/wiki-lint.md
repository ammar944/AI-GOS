---
description: Run the wiki health check from wiki/CLAUDE.md. Reports issues, does not auto-fix.
---

# /wiki-lint

Executes the lint flow defined in `.claude/wiki/CLAUDE.md` section "Lint flow". Read-only. Writes a report to `.claude/wiki/log.md` and waits for user go-ahead before any fixes.

## Steps

1. **Structural checks — every page under `.claude/wiki/wiki/**/*.md` must have:**
   - At least one `## Sources` line with a backlink.
   - At least one `## Related` line with a backlink.
   - An entry in `.claude/wiki/index.md`.
   Flag every page that fails.

2. **Orphans.** Find pages that no other wiki page links to via `[[wiki/...]]`. Flag.

3. **Stale references.**
   - `index.md` references a `wiki/<type>/<slug>.md` that doesn't exist → flag.
   - A wiki page references `raw/<file>` that doesn't exist → flag.

4. **Imputation candidates.** Scan atomic pages for entity/concept/tool names mentioned in 3+ pages with no dedicated page. Flag with the proposed slug.

5. **Drain `review-queue.md`.** Any item older than 60 days without action → propose to mark `no` and remove the block.

6. **Write the report.** Append to `.claude/wiki/log.md`:
   ```
   YYYY-MM-DD HH:MM lint: <N structural fails>, <M orphans>, <K stale refs>, <J imputation candidates>, <R review-queue drains>
   ```
   Then list the findings inline so the user can read them.

## Forbidden

- Auto-fixing anything. Report only. The user approves each fix.
- Editing `raw/`.
- Deleting pages without explicit user `y`.

## Cadence

Weekly is enough. If the wiki has fewer than 50 pages, monthly is fine.
