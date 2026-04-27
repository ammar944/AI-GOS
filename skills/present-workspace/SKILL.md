---
name: present-workspace
description: >
  Workspace presentation and dry-run write-back contract for AIGOS v3 skill outputs.
version: 1.0.0
---

# present-workspace

## Trigger

Use `present-workspace` after an upstream AIGOS skill has produced validated JSON that needs to hydrate Journey workspace cards or persist approved card edits.

Do not use it for fact collection, chat refinement, document ingestion, or frontend rendering work.

## What It Does

This skill maps validated skill output into workspace card payloads, applies approved card edit overlays, builds the `journey_sessions.research_results[section]` envelope, and exercises the Supabase write contract through a dry-run or mock transport.

It is downstream presentation and write-back plumbing only. It does not generate new research facts.

## Boundaries

- Owns deterministic card mapping, stable card IDs, section-level `__cardEdits`, and the typed Supabase write contract.
- Does not import or call `@supabase/supabase-js` during local tests.
- Does not call web search, Firecrawl, Perplexity, Anthropic, OpenAI, or any research provider.
- Does not mutate upstream skill output while mapping cards.
- Does not let upstream skill output include Supabase instructions.
- Does not own React rendering. Existing workspace card components consume the card payloads.

## Workflow

1. Validate input against `schemas/input.ts`.
2. Map the supplied skill output into cards with `scripts/map-cards.ts`.
3. Reject empty renderable data and missing sourced card evidence.
4. Apply approved card edits with `scripts/apply-card-edits.ts`.
5. Serialize edits under section-level `__cardEdits`, outside `data`.
6. Build the research result envelope for `journey_sessions.research_results`.
7. Exercise `scripts/write-supabase.ts` using `dry-run` or `mock-write`.
8. Validate and sanity-check the final output.

## Tools

- `node --import tsx/esm scripts/validate.ts`
- `node --import tsx/esm scripts/sanity-check.ts`
- `node --import tsx/esm scripts/orchestrate.ts`
- File reads for skill-local fixtures and references.
- No browser, web, provider, or live database tools.

## Hard Constraints

- Self-contained: no imports from `src/`, `research-worker/`, root `lib/`, or another skill.
- Only this skill may define the Supabase write contract in the v3 migration.
- Local verification must use dry-run or mock transport and make no live Supabase calls.
- Card IDs must be stable from section, card kind, and slugged label.
- Every card evidence item must include `source_url` and `retrieved_at`.
- Empty arrays are allowed only when the card still has renderable data.
- Empty renderable card data is an error.
- Reject placeholder values: `unknown`, `TBD`, `n/a`, `not found`, `scaffold`.
- Supabase write receipts that claim a write happened must include `idempotency_key`, `run_id`, and `card_kind`.
- Edits serialize under section-level `__cardEdits`, not inside `data`.

## Output

The output is `presentWorkspaceOutputSchema`: cards, the research result envelope, a typed write receipt, content snapshots for each card, and warnings. The schema intentionally extends the original spec sketch with `card_kind`, prior/new content snapshots, write outcome, and `idempotency_key` because Wave 4 write-back requires those fields.
