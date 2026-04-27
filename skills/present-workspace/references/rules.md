# Rules — present-workspace

Load-bearing constraints for the AIGOS v3 Wave 4 presentation skill.

## Hard constraints

- Presentation only: do not collect, infer, or synthesize new research facts.
- Write-back owner: no other skill owns Supabase writes.
- Local verification uses `dry-run` or `mock-write`; never live Supabase.
- Stable IDs are derived from `section_key`, `card_kind`, and slugged label.
- Edits persist under section-level `__cardEdits`, outside `data`.
- Input skill output must not contain direct write instructions.
- Upstream output must not be mutated during card mapping.
- Empty renderable card data is a blocking error.
- Placeholder strings are blocking errors: `unknown`, `TBD`, `n/a`, `not found`, `scaffold`.

## Sanity gates

- **[FAIL]** if output schema validation fails.
- **[FAIL]** if any TypeScript import leaves `skills/present-workspace/`.
- **[FAIL]** if card evidence misses `source_url` or `retrieved_at`.
- **[FAIL]** if `__cardEdits` appears inside `data`.
- **[FAIL]** if a claimed write lacks `idempotency_key`, `run_id`, or `card_kind`.

## Cross-cutting

- The output schema extends the spec sketch with write identity and snapshots.
- The write contract mirrors `journey_sessions` merge semantics but is transport-injected.
- Production can provide a real transport later; this skill does not include one.
