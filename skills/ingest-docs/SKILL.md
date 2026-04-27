---
name: ingest-docs
description: Use when AIGOS v3 needs to parse uploaded TXT or Markdown business documents, classify them, and emit sourced brief-fragment field evidence for the enrich-brief stage before GTM brief review.
---

## Trigger
`@ingest-docs { "run_id": "...", "stage": "enrich-brief", "documents": [ ... ] }`

Use this when the user has uploaded business documents that should enrich the GTM brief before review. Use adjacent ingest skills instead when the source is a website, Fathom recording, or typed identity profile.

## What it does

Takes uploaded document payloads, parses local TXT or Markdown content, classifies each document, extracts deterministic field evidence, detects conflicts, and returns an `enrich-brief` output containing `brief_fragment`, `field_catalog`, `conflicts`, and `unresolved_fields`. Every extracted value is tied to a document source with `source_url` and `retrieved_at`.

## Boundaries

This skill does not fetch websites, scrape URLs, retrieve call recordings, run research stages, synthesize strategy, render workspace UI, or persist uploaded document text. Adjacent skills own those jobs:

- `ingest-url`: website and URL-sourced brief evidence.
- `ingest-fathom`: meeting recording and transcript ingest.
- `ingest-identity`: typed or profile-derived canonical company identity.
- `present-workspace`: review cards and write-back.
- Research and synthesis skills: downstream research cards and strategy outputs.

## Workflow

1. Parse input with `schemas/input.ts`.
2. Parse document text with `scripts/parse-document.ts`.
3. Classify documents with `scripts/classify-document.ts`.
4. Normalize extracted lines into GTM brief field keys with `scripts/normalize-fields.ts`.
5. Preserve conflicting values in `conflicts`; do not silently choose a winner.
6. Write JSON matching `schemas/output.ts`.
7. Run `npm run check`.
8. Run `npm run validate`.
9. Run `npm run sanity-check <output.json>`.

## Tools

- File read/write tools: write only inside this skill folder or a caller-provided run directory.
- `Bash(npm run check)`: TypeScript gate.
- `Bash(npm run validate)`: input and output schema validation.
- `Bash(npm run sanity-check <output.json>)`: integrity and containment gates.
- `Bash(npm run orchestrate -- <input-or-dir>)`: deterministic local parse/classify/normalize run.

## Hard constraints

1. Keep the skill self-contained. Do not import from `src/`, `research-worker/`, root `lib/`, or another skill.
2. Do not write to any database, storage bucket, app route, worker, or legacy runner.
3. Every factual value must include `source_url` and `retrieved_at`.
4. Unknown values are omitted or emitted as empty arrays. Never use `unknown`, `TBD`, `n/a`, `not found`, scaffold text, or placeholders.
5. Empty arrays are allowed when no sourced value exists.
6. TXT and Markdown fixtures parse locally. PDF and DOCX inputs fail with explicit parser dependency errors unless a caller supplies already extracted text through TXT or Markdown.
7. Reject unsupported MIME types, missing payloads, empty documents, and image-only documents before extraction.
8. Enforce per-file size and total token budgets before normalization.

## Output

The output schema is `ingestDocsOutputSchema` in `schemas/output.ts`.

Top-level fields:

- `run_id`
- `stage: "enrich-brief"`
- `documents`
- `brief_fragment`
- `field_catalog`
- `conflicts`
- `unresolved_fields`
- `generated_at`

Every extracted field contains:

```ts
{
  field_key: string;
  label: string;
  value: string;
  confidence: "low" | "medium" | "high";
  evidence: Array<{ value: string; source_url: string; retrieved_at: string }>;
  source_document_ids: string[];
}
```

## Verification gate

Before returning output:

```bash
npm run check
npm run validate
npm run sanity-check example/output.json
npm run orchestrate -- example
```

All commands must pass without override flags.
