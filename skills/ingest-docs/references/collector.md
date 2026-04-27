# ingest-docs Collector

The collector is deterministic in this Wave 4 implementation.

1. Validate `schemas/input.ts`.
2. Parse each supported text document locally.
3. Classify document kind and GTM stage tags from file name and keyword rules.
4. Read explicit `Label: value` lines from document text.
5. Normalize recognized labels to GTM brief field keys using `references/rules.md`.
6. Emit every extracted value into `field_catalog` with document evidence.
7. Emit non-conflicting values into `brief_fragment`.
8. Emit conflicting values into `conflicts` and leave them out of `brief_fragment`.
9. Emit missing recognized field keys into `unresolved_fields`.

Do not use external network calls or paid APIs for local fixture runs.
