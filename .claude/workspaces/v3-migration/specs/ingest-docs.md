# ingest-docs Spec

## Skill

`skills/ingest-docs/`

## GOAL

Parse uploaded business documents, extract sourced field evidence, and emit a structured field catalog that can enrich the GTM brief before review.

## NON-GOALS

- Does not fetch or scrape a company website. `ingest-url` owns URL discovery.
- Does not fetch Fathom recordings. `ingest-fathom` owns recording ingest.
- Does not run research sections or strategy synthesis.
- Does not write uploaded text to `business_profile_documents` or any Supabase table.
- Does not own the final review UI. `present-workspace` owns cards and write-back.
- Does not keep the legacy flat string-only extraction output as the final contract.

## INPUT

- Upstream contract:
  - `research-worker/src/schemas/gtm/gtm-brief.ts`
  - `gtmBriefSchema`
- Runtime stage:
  - `enrich-brief` from `GTM_STAGE_KEYS` in `research-worker/src/schemas/gtm/gtm-run.ts`
- Required input fields:
  - `run_id`
  - `documents[]`
  - `documents[].file_name`
  - `documents[].mime_type`
  - one of `documents[].file_base64` or `documents[].storage_path`
- Optional input fields:
  - `brief_id`, `client_id`, `business_profile_id`
  - `documents[].document_type_hint`
- Required prior skill output:
  - none
- Optional prior skill output:
  - `ingest-url` output when URL-sourced fields already exist and need conflict notes

## OUTPUT

- Downstream consumers: `review-brief`, `lock-brief`, all research skills, and `present-workspace`.
- Zod schema reference: `skills/ingest-docs/schemas/output.ts`.
- Schema sketch:

```ts
const sourcedClaimSchema = z.object({
  value: z.string().min(1),
  source_url: z.string().url(),
  retrieved_at: z.string().datetime(),
});

const documentSourceSchema = z.object({
  document_id: z.string().min(1),
  file_name: z.string().min(1),
  mime_type: z.string().min(1),
  doc_kind: z.enum(['pitch_deck', 'icp_doc', 'case_study', 'brand_book', 'pricing_sheet', 'competitor_analysis', 'market_research', 'meeting_transcript', 'other']),
  word_count: z.number().int().nonnegative(),
  source_url: z.string().url(),
  retrieved_at: z.string().datetime(),
});

const extractedFieldSchema = z.object({
  field_key: z.string().min(1),
  label: z.string().min(1),
  value: z.string().min(1),
  confidence: z.enum(['low', 'medium', 'high']),
  evidence: z.array(sourcedClaimSchema).min(1),
  source_document_ids: z.array(z.string().min(1)).min(1),
});

export const ingestDocsOutputSchema = z.object({
  run_id: z.string().min(1),
  stage: z.literal('enrich-brief'),
  documents: z.array(documentSourceSchema).min(1),
  field_catalog: z.array(extractedFieldSchema),
  conflicts: z.array(z.object({
    field_key: z.string().min(1),
    values: z.array(sourcedClaimSchema).min(2),
    resolution_note: z.string().min(1),
  })),
  unresolved_fields: z.array(z.string().min(1)),
  generated_at: z.string().datetime(),
});
```

The document itself is a source. Use a deterministic `source_url` such as `document://<document_id>` only if the output schema explicitly allows that URI form; otherwise use the stored object URL or signed source URL.

## HYBRID CHOICE

`heavy` — PDF/DOCX parsing, file validation, token budgets, document classification, conflict detection, and field normalization all need deterministic TypeScript before and after extraction.

## FILES TO CREATE

- `skills/ingest-docs/SKILL.md`
- `skills/ingest-docs/README.md`
- `skills/ingest-docs/package.json`
- `skills/ingest-docs/tsconfig.json`
- `skills/ingest-docs/schemas/input.ts`
- `skills/ingest-docs/schemas/output.ts`
- `skills/ingest-docs/scripts/validate.ts`
- `skills/ingest-docs/scripts/sanity-check.ts`
- `skills/ingest-docs/scripts/orchestrate.ts`
- `skills/ingest-docs/scripts/parse-document.ts`
- `skills/ingest-docs/scripts/classify-document.ts`
- `skills/ingest-docs/scripts/normalize-fields.ts`
- `skills/ingest-docs/references/collector.md`
- `skills/ingest-docs/references/rules.md`
- `skills/ingest-docs/example/input.json`
- `skills/ingest-docs/example/output.json`

No `generate-report.ts`, `assets/report-shell.html`, or screenshot script in Wave 4.

## CONSTRAINTS

- Skill is self-contained. No imports from `src/`, `research-worker/`, root `lib/`, or another skill.
- Port parser behavior from `src/lib/company-intel/document-parser.ts` into the skill: PDF text extraction, DOCX raw text extraction, TXT/MD support, max character cap, page count, and word count.
- Port document MIME and extension constraints from `src/lib/company-intel/document-types.ts`.
- Port section classification behavior from `src/lib/documents/section-tagger.ts`, but emit GTM-stage tags in the new skill contract.
- Port useful extraction targets from `src/lib/company-intel/document-extraction-schema.ts`, then normalize to GTM brief field keys.
- Reject empty or image-only documents with actionable error messages.
- Enforce per-file and total-token budgets before model extraction.
- Do not write parsed markdown, extracted fields, or metadata to Supabase.
- Every extracted field must include evidence from a document source and retrieval time.
- Empty arrays are allowed. Placeholder text is not allowed.

## STEPS

1. Read legacy document paths:
   - `src/app/api/documents/upload/route.ts`
   - `src/app/api/onboarding/extract-document/route.ts`
   - `src/lib/company-intel/document-parser.ts`
   - `src/lib/company-intel/document-types.ts`
   - `src/lib/company-intel/document-extraction-schema.ts`
   - `src/lib/documents/section-tagger.ts`
   - `src/lib/workspace/context-builder.ts`
   - Verify: implementation notes list kept parser, classifier, and extraction behavior.
2. Define `schemas/input.ts` with document array validation, MIME checks, size metadata, and optional prior `ingest-url` output.
   - Verify: missing file payloads, unsupported MIME types, and empty arrays fail.
3. Write `scripts/parse-document.ts` with portable PDF, DOCX, TXT, and MD parsing.
   - Verify: empty documents and image-only parses fail before extraction.
4. Write `scripts/classify-document.ts` from the legacy keyword classifier.
   - Verify: pitch decks, ICP docs, pricing sheets, competitor docs, market research, and brand books receive expected tags.
5. Write `references/collector.md` and `references/rules.md`.
   - Verify: every requested extraction field maps to a GTM brief field key or `unresolved_fields`.
6. Write `scripts/normalize-fields.ts` and conflict detection.
   - Verify: conflicting values for the same field are emitted in `conflicts`, not silently overwritten.
7. Write `orchestrate.ts`, validation scripts, sanity checks, and fixtures.
   - Verify: fixtures use real document source URLs or accepted signed-source URLs and ISO timestamps.

## VERIFY

```bash
cd skills/ingest-docs
npm install
npm run check
npm run validate
npm run sanity-check example/output.json
npm run orchestrate -- example
```

Expected result:

- TypeScript compiles with no errors.
- `example/input.json` validates with at least one document.
- `example/output.json` validates as `ingestDocsOutputSchema`.
- Orchestrator emits parsed document metadata and sourced field catalog output.

## CONFORMANCE TESTS

- `missing-source-url`: remove `source_url` from one field evidence object; `npm run validate` must fail.
- `missing-retrieved-at`: remove `retrieved_at` from one document source; `npm run validate` must fail.
- `unsupported-mime`: use `application/x-msdownload`; input validation must fail.
- `empty-document`: parse a file with fewer than 10 words; orchestrate must fail before model extraction.
- `conflict-preserved`: provide two documents with different pricing values; output must include `conflicts[]` instead of selecting one silently.
- `no-outside-imports`: scan `skills/ingest-docs/**/*.ts` for imports beginning with `../..`, `@/`, `src/`, `research-worker/`, or another `skills/` path; the check must fail if any exist.
- `no-supabase-write`: scan scripts for `business_profile_documents`, `journey_sessions`, `createAdminClient`, or Supabase service keys; the check must fail if present.

## WAVE

Wave number: `4`.

## DEPENDENCIES

- Required upstream skills:
  - none
- Required non-skill upstream state:
  - uploaded document payloads or runtime-resolved storage paths
- Optional upstream skills:
  - `ingest-url`
- Blocked by:
  - portable parser dependency choice for PDF and DOCX inside skill-local package boundaries.
