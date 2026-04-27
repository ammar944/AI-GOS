# ingest-fathom Spec

## Skill

`skills/ingest-fathom/`

## GOAL

Fetch a Fathom recording by ID, extract sourced sales-call intelligence, and emit a structured meeting block that downstream research skills can use as client-grounded evidence.

## NON-GOALS

- Does not parse uploaded transcript text directly. `ingest-docs` owns uploaded documents and plain transcript files.
- Does not run market, ICP, competitor, offer, keyword, or synthesis research.
- Does not write to `business_profile_documents`, `journey_sessions`, or Supabase.
- Does not update meeting status flags. Runtime wiring can do that outside the skill.
- Does not replace the existing meeting extraction categories from `research-worker/src/runners/meeting-extract.ts`; it ports them into a sourced skill output.
- Does not fabricate speaker labels, decisions, action items, budget, objections, or quotes.

## INPUT

- Upstream contract:
  - `research-worker/src/schemas/gtm/gtm-brief.ts`
  - `gtmBriefSchema` when a brief exists, optional for this entry skill
- Runtime stage:
  - `enrich-brief` from `GTM_STAGE_KEYS` when meeting intelligence is attached before `lock-brief`
- Required input fields:
  - `recording_id`
  - `run_id`
- Optional input fields:
  - `brief_id`, `client_id`, `meeting_type_hint`, `title`
- Required prior skill output:
  - none
- Optional prior skill output:
  - none

## OUTPUT

- Downstream consumers: `research-icp`, `research-offer`, `research-competitor`, `research-voc`, `research-cross`, and `present-workspace`.
- Zod schema reference: `skills/ingest-fathom/schemas/output.ts`.
- Schema sketch:

```ts
const sourcedClaimSchema = z.object({
  value: z.string().min(1),
  source_url: z.string().url(),
  retrieved_at: z.string().datetime(),
});

const transcriptQuoteSchema = sourcedClaimSchema.extend({
  speaker: z.string().min(1),
  timestamp: z.string().min(1).optional(),
});

const actionItemSchema = z.object({
  action: sourcedClaimSchema,
  owner: sourcedClaimSchema.optional(),
  due_date: sourcedClaimSchema.optional(),
  evidence: transcriptQuoteSchema,
});

const decisionSchema = z.object({
  decision: sourcedClaimSchema,
  participants: z.array(sourcedClaimSchema),
  evidence: transcriptQuoteSchema,
});

export const ingestFathomOutputSchema = z.object({
  run_id: z.string().min(1),
  stage: z.literal('enrich-brief'),
  ingest_kind: z.literal('fathom'),
  recording_id: z.string().min(1),
  recording_url: z.string().url(),
  title: sourcedClaimSchema.optional(),
  call_type: z.enum(['discovery', 'demo', 'follow_up', 'closing', 'strategy', 'kickoff', 'review', 'other']),
  speakers: z.array(z.object({
    name: sourcedClaimSchema,
    role: sourcedClaimSchema.optional(),
  })),
  pain_points: z.array(z.object({
    pain: sourcedClaimSchema,
    severity: z.enum(['critical', 'moderate', 'minor']),
    evidence: transcriptQuoteSchema,
  })),
  budget_signals: z.array(z.object({
    signal: sourcedClaimSchema,
    evidence: transcriptQuoteSchema,
  })),
  competitor_mentions: z.array(z.object({
    name: sourcedClaimSchema,
    sentiment: z.enum(['positive', 'negative', 'neutral']),
    evidence: transcriptQuoteSchema,
  })),
  buying_triggers: z.array(z.object({
    trigger: sourcedClaimSchema,
    urgency: z.enum(['immediate', 'near_term', 'exploratory']),
    evidence: transcriptQuoteSchema,
  })),
  objections: z.array(z.object({
    objection: sourcedClaimSchema,
    resolution: sourcedClaimSchema.optional(),
    evidence: transcriptQuoteSchema,
  })),
  action_items: z.array(actionItemSchema),
  decisions: z.array(decisionSchema),
  notable_quotes: z.array(transcriptQuoteSchema),
  generated_at: z.string().datetime(),
});
```

Transcript facts use the Fathom recording URL as `source_url` and the fetch time as `retrieved_at`.

## HYBRID CHOICE

`light` — once the recording and transcript are fetched, the work is extraction and Zod validation with no deterministic merge, parser, renderer, or API cache in this wave.

## FILES TO CREATE

- `skills/ingest-fathom/SKILL.md`
- `skills/ingest-fathom/README.md`
- `skills/ingest-fathom/package.json`
- `skills/ingest-fathom/tsconfig.json`
- `skills/ingest-fathom/schemas/input.ts`
- `skills/ingest-fathom/schemas/output.ts`
- `skills/ingest-fathom/scripts/validate.ts`
- `skills/ingest-fathom/scripts/sanity-check.ts`
- `skills/ingest-fathom/references/collector.md`
- `skills/ingest-fathom/references/rules.md`
- `skills/ingest-fathom/example/input.json`
- `skills/ingest-fathom/example/output.json`

No `scripts/orchestrate.ts` in Wave 4 unless the Fathom client fetch is moved inside the skill implementation. If the client is ported into the skill, add `scripts/fetch-recording.ts` and update this spec first.

## CONSTRAINTS

- Skill is self-contained. No imports from `src/`, `research-worker/`, root `lib/`, or another skill.
- `src/lib/fathom/` is not present in this checkout. If that client exists in another branch, port it into this skill instead of rewriting the API behavior.
- Keep the extraction categories from `research-worker/src/runners/meeting-extract.ts`: pain points, budget signals, competitor mentions, buying triggers, objections, ICP signals, current marketing, goals, and notable quotes.
- Add speakers, action items, and decisions because this skill is the meeting entry point, not only a runner-side context helper.
- Quotes are required for pain points, competitor mentions, buying triggers, objections, goals, decisions, and action items.
- Speaker attribution must stay explicit. Do not collapse all quotes into anonymous statements.
- Empty arrays are allowed. Do not add placeholders for missing categories.
- Recording fetch errors must throw with provider, recording id, status, and run id.
- Transcript extraction failures must preserve the raw model text only in local run artifacts, not in final sourced output.

## STEPS

1. Read legacy meeting paths:
   - `research-worker/src/runners/meeting-extract.ts`
   - `research-worker/src/index.ts`
   - `src/app/api/meetings/submit/route.ts`
   - `src/lib/meeting-intel/schemas.ts`
   - `src/lib/meeting-intel/types.ts`
   - Verify: implementation notes state that `src/lib/fathom/` was absent or name the ported Fathom client path.
2. Define `schemas/input.ts` with `run_id`, `recording_id`, optional title, and optional `meeting_type_hint`.
   - Verify: empty recording IDs and missing run IDs fail.
3. Define `schemas/output.ts` with the sourced meeting intelligence shape.
   - Verify: every quoted or factual entry carries `source_url` and `retrieved_at`.
4. Write `references/collector.md` from the old extraction prompt but remove runner-only write-back language.
   - Verify: every prompt category maps to one output key.
5. Write `references/rules.md` for quote requirements, speaker attribution, empty arrays, and no inferred budget values.
   - Verify: rules forbid unsupported action items and decisions.
6. Write `SKILL.md`, `validate.ts`, `sanity-check.ts`, and fixtures.
   - Verify: fixture output contains a real-looking recording URL, ISO timestamps, and direct quote evidence.
7. Add local verification commands.
   - Verify: check, validate, and sanity-check pass without root build.

## VERIFY

```bash
cd skills/ingest-fathom
npm install
npm run check
npm run validate
npm run sanity-check example/output.json
```

Expected result:

- TypeScript compiles with no errors.
- `example/input.json` validates.
- `example/output.json` validates as `ingestFathomOutputSchema`.
- Sanity-check rejects missing quote evidence and placeholder transcript facts.

## CONFORMANCE TESTS

- `missing-source-url`: remove `source_url` from a pain point evidence quote; `npm run validate` must fail.
- `missing-retrieved-at`: remove `retrieved_at` from a decision evidence quote; `npm run validate` must fail.
- `quote-required`: add an objection without `evidence.value`; `npm run sanity-check` must fail.
- `speaker-required`: remove `speaker` from a notable quote; `npm run validate` must fail.
- `no-inferred-budget`: add a budget signal without an exact quote; sanity-check must fail.
- `no-outside-imports`: scan `skills/ingest-fathom/**/*.ts` for imports beginning with `../..`, `@/`, `src/`, `research-worker/`, or another `skills/` path; the check must fail if any exist.
- `no-supabase-write`: scan scripts for `business_profile_documents`, `journey_sessions`, or Supabase service keys; the check must fail if present.

## WAVE

Wave number: `4`.

## DEPENDENCIES

- Required upstream skills:
  - none
- Required non-skill upstream state:
  - Fathom recording ID and provider credentials at runtime
- Optional upstream skills:
  - none
- Blocked by:
  - Fathom client availability in the portable skill runtime.
