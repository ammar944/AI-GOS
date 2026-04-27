# ingest-url Spec

## Skill

`skills/ingest-url/`

## GOAL

Take a company URL, discover high-signal public pages, extract sourced company metadata, and produce a prefilled GTM brief field catalog for review.

## NON-GOALS

- Does not lock the GTM brief. `lock-brief` owns the immutable snapshot.
- Does not parse uploaded PDFs, DOCX files, transcripts, or meeting recordings. `ingest-docs` and `ingest-fathom` own those sources.
- Does not run market, ICP, competitor, VoC, keyword, offer, or synthesis research.
- Does not write Supabase rows or UI cards directly. `present-workspace` owns presentation and write-back.
- Does not keep the legacy stream response shape from `src/app/api/onboarding/research/route.ts`; this skill emits JSON files.
- Does not accept fields without source evidence, even if the old prefill screen allowed restored state with `sourceUrl: null`.

## INPUT

- Upstream contract:
  - `research-worker/src/schemas/gtm/gtm-brief.ts`
  - `gtmBriefSchema`
- Runtime stage:
  - `discover-url` from `GTM_STAGE_KEYS` in `research-worker/src/schemas/gtm/gtm-run.ts`
- Required input fields:
  - `url`
- Optional input fields:
  - `run_id`, `brief_id`, `client_id`, `user_notes`
  - `linkedin_url` when the user supplied a LinkedIn company page
- Required prior skill output:
  - none
- Optional prior skill output:
  - none

## OUTPUT

- Downstream consumers: `enrich-brief`, `review-brief`, `lock-brief`, and `present-workspace`.
- Zod schema reference: `skills/ingest-url/schemas/output.ts`.
- Schema sketch:

```ts
const sourcedClaimSchema = z.object({
  value: z.string().min(1),
  source_url: z.string().url(),
  retrieved_at: z.string().datetime(),
});

const prefilledFieldSchema = z.object({
  field_key: z.string().min(1),
  label: z.string().min(1),
  value: z.string().min(1),
  confidence: z.enum(['low', 'medium', 'high']),
  evidence: z.array(sourcedClaimSchema).min(1),
  reason: z.string().min(1),
});

const discoveredPageSchema = z.object({
  url: z.string().url(),
  page_type: z.enum(['homepage', 'pricing', 'product', 'customers', 'case_study', 'about', 'demo', 'other']),
  title: sourcedClaimSchema.optional(),
  excerpt: sourcedClaimSchema.optional(),
});

export const ingestUrlOutputSchema = z.object({
  run_id: z.string().min(1),
  stage: z.literal('discover-url'),
  input_url: z.string().url(),
  canonical_url: sourcedClaimSchema,
  company_name: sourcedClaimSchema,
  discovered_pages: z.array(discoveredPageSchema),
  prefilled_fields: z.array(prefilledFieldSchema),
  unresolved_fields: z.array(z.string().min(1)),
  generated_at: z.string().datetime(),
});
```

Every factual value uses `source_url` + `retrieved_at`. `unresolved_fields` are field keys only and do not claim facts.

## HYBRID CHOICE

`heavy` — URL discovery, domain cleanup, page ranking, duplicate-page removal, and field normalization need deterministic TypeScript gates before the model sees or emits data.

## FILES TO CREATE

- `skills/ingest-url/SKILL.md`
- `skills/ingest-url/README.md`
- `skills/ingest-url/package.json`
- `skills/ingest-url/tsconfig.json`
- `skills/ingest-url/schemas/input.ts`
- `skills/ingest-url/schemas/output.ts`
- `skills/ingest-url/scripts/validate.ts`
- `skills/ingest-url/scripts/sanity-check.ts`
- `skills/ingest-url/scripts/orchestrate.ts`
- `skills/ingest-url/scripts/discover-pages.ts`
- `skills/ingest-url/scripts/normalize-fields.ts`
- `skills/ingest-url/references/collector.md`
- `skills/ingest-url/references/rules.md`
- `skills/ingest-url/example/input.json`
- `skills/ingest-url/example/output.json`

No `merge-fragments.ts`, `generate-report.ts`, `assets/report-shell.html`, or screenshot script in Wave 4 unless implementation adds a real render step and updates this spec first.

## CONSTRAINTS

- Skill is self-contained. No imports from `src/`, `research-worker/`, root `lib/`, or another skill.
- Duplicate the needed GTM brief field primitives and URL input contract inside the skill.
- Port the useful behavior from `src/app/api/onboarding/research/route.ts`: validate URL, normalize base domain, map site pages, score key pages, skip junk URLs, scrape selected pages, and cap text by page type.
- Port the useful mapping from `src/lib/journey/prefill.ts`: produce reviewable proposals for known GTM fields, but require evidence for every value.
- Keep Firecrawl or equivalent page discovery behind a provider adapter inside the skill.
- No silent search-only fallback. If crawling fails and search is used, record the provider, query, status, and gap.
- Do not infer hidden pricing, ACV, conversion path, or competitors without source evidence.
- Enum-like brief fields must be normalized to the current GTM brief language before output.
- Empty arrays are allowed. Placeholder strings such as `unknown`, `n/a`, `TBD`, and `not found` are not allowed in sourced values.
- External API errors must throw with provider, URL or query, status, and run id.

## STEPS

1. Read legacy URL and prefill paths:
   - `research-worker/src/stages/discover-url.ts`
   - `src/app/api/onboarding/research/route.ts`
   - `src/lib/company-intel/schemas.ts`
   - `src/lib/journey/prefill.ts`
   - `src/lib/gtm/contracts/stage-inputs.ts`
   - Verify: implementation notes list each inspected path and the kept behavior.
2. Define `schemas/input.ts` with `run_id`, `url`, optional `linkedin_url`, and optional `user_notes`.
   - Verify: invalid protocols, empty URLs, and non-company LinkedIn URLs fail validation.
3. Write `scripts/discover-pages.ts` for base URL cleanup, map result filtering, key-page scoring, and fallback path selection.
   - Verify: duplicate URLs, asset URLs, login URLs, legal pages, and blog/news URLs are removed.
4. Write `references/collector.md` with field extraction instructions mapped to GTM brief field keys.
   - Verify: every collected field maps to `prefilled_fields[].field_key`.
5. Define `schemas/output.ts` with sourced claims on canonical URL, company name, discovered page facts, and every prefilled field.
   - Verify: any field without evidence fails Zod.
6. Write `scripts/normalize-fields.ts` to map legacy names such as `websiteUrl`, `valueProp`, and `headquartersLocation` to GTM brief keys.
   - Verify: unknown legacy keys are rejected unless explicitly listed as `unresolved_fields`.
7. Write `scripts/orchestrate.ts`, `validate.ts`, `sanity-check.ts`, and fixtures.
   - Verify: examples use real URLs, ISO timestamps, and no placeholders.

## VERIFY

```bash
cd skills/ingest-url
npm install
npm run check
npm run validate
npm run sanity-check example/output.json
npm run orchestrate -- example
```

Expected result:

- TypeScript compiles with no errors.
- `example/input.json` validates as a `discover-url` request.
- `example/output.json` validates as `ingestUrlOutputSchema`.
- Orchestrator emits `output.json` with sourced prefill proposals.
- Sanity-check exits 0 without `ALLOW_SUSPECT`.

## CONFORMANCE TESTS

- `missing-source-url`: remove `source_url` from one prefilled field evidence item; `npm run validate` must fail with the object path.
- `missing-retrieved-at`: remove `retrieved_at` from `canonical_url`; `npm run validate` must fail.
- `asset-url-filter`: include `.pdf`, `.png`, `.xml`, login, privacy, and blog URLs in discovery input; `discover-pages` must drop them.
- `placeholder-rejection`: set a sourced value to `unknown`, `n/a`, `TBD`, or `not found`; `npm run sanity-check` must fail.
- `field-key-normalization`: emit legacy `websiteUrl` or `valueProp` directly in output; sanity-check must fail and require GTM brief field keys.
- `no-outside-imports`: scan `skills/ingest-url/**/*.ts` for imports beginning with `../..`, `@/`, `src/`, `research-worker/`, or another `skills/` path; the check must fail if any exist.
- `no-supabase-write`: scan scripts for `createClient`, `from('journey_sessions')`, or Supabase service keys; the check must fail if present.

## WAVE

Wave number: `4`.

## DEPENDENCIES

- Required upstream skills:
  - none
- Required non-skill upstream state:
  - user-submitted company URL
- Optional upstream skills:
  - none
- Blocked by:
  - provider choice for page discovery and scraping in the portable skill runtime.
