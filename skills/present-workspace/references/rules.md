# Rules - present-workspace

- Read local JSON only.
- Never call paid APIs, live databases, browser tools, or web search.
- Never import outside this skill folder.
- Never mutate upstream skill output.
- Emit all 10 card types every run.
- Missing upstream paths produce `status: "missing"` cards.
- Invalid upstream JSON or transformer failures produce `status: "error"` cards.
- Every emitted card must have non-empty `source_gaps`.
- `evidence` must preserve `source_url` and `retrieved_at` when upstream evidence provides them.
- The output is data only. Do not create React components or modify existing workspace UI.

## Positive Rules

- Emit exactly the supported 10 card types every run.
- Preserve upstream evidence URLs and retrieval timestamps.
- Preserve upstream `source_gaps`; add a generated gap only for missing or invalid stages.
- Isolate failures to the affected card.
- Derive workspace status from card statuses:
  - all ready -> ready
  - any partial -> partial
  - any missing/error and at least one ready -> partial
  - all missing/error -> error
- Never emit `ready` by title or section count alone.
