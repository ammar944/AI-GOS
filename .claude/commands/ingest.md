---
description: Ingest a raw source into the wiki following the triage gate in wiki/CLAUDE.md.
---

# /ingest

Operationalizes the wiki ingest flow from `.claude/wiki/CLAUDE.md`. Does not invent — follows that file exactly.

## Arguments

- `<raw-file>` (required) — path under `.claude/wiki/raw/` (e.g. `raw/karpathy-noam-no-priors-transcript.md`) or a filename if unambiguous.

## Steps (execute in order)

1. **Read the full raw file.** No truncation.
2. **Triage gate** (`.claude/wiki/taxonomy.md`):
   - Pick ONE primary domain.
   - Pick ONE or TWO intents.
   - Decide `worth_porting`: `yes` / `no` / `review`.
     - `no` → append one line to `log.md` (`YYYY-MM-DD ingest: <file> → no`) and STOP.
     - `review` → append block to `review-queue.md` and STOP.
     - `yes` → continue.
   - Decide tier: `full` or `synthesis_only`. Default `synthesis_only`.
3. **Identify atomic units.** 5-15 per source. Each atom = one distinct concept/entity/tool/technique/argument.
4. **For each atom:**
   - Check `index.md`: exists? Enrich. Missing? Create at `wiki/<type>/<kebab-case-slug>.md`.
   - Every new page: one-line definition at top, `## Sources` with `[[raw/<file>]]` backlink, `## Related` with `[[wiki/...]]` backlinks.
5. **If tier = full:** also create `wiki/sources/<slug>.md` summarising the source.
6. **Append to `log.md`:**
   `YYYY-MM-DD HH:MM ingest: <raw file> — domain=<x> intent=<y> worth=yes tier=<full|synthesis_only> → N new pages, M enriched`
7. **Update `index.md`** with every new page + one-line summary.
8. **Update `hot.md`** with a one-line summary of what was ingested.

## Forbidden

- Editing `raw/` files.
- Creating pages > 200 lines (split).
- Skipping the triage gate.
- Synthesizing `review` items before they're promoted to `yes`.
- Creating HTML or using subfolders deeper than 2 levels.

## Output

Report: domain, intent, worth, tier, page count (new + enriched), and list of created pages.
