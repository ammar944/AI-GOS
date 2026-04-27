# present-workspace Spec

## Skill

`skills/present-workspace/`

## GOAL

Convert validated skill outputs into Journey workspace card payloads and write the approved research result envelope back to Supabase for realtime UI hydration.

## NON-GOALS

- Does not collect new facts, scrape sources, or call research providers.
- Does not edit research content beyond deterministic card mapping.
- Does not run chat refinement. `chat-refine` owns edit proposals.
- Does not parse documents, URLs, or Fathom recordings.
- Does not own frontend rendering components. Existing workspace card components render the card payloads.
- Does not let any other skill write Supabase rows.

## INPUT

- Upstream contract:
  - one or more validated skill outputs
  - `research-worker/src/schemas/gtm/gtm-brief.ts` for brief review cards
  - workspace card state when persisting edits or approved document snapshots
- Runtime stage:
  - `review-brief` from `GTM_STAGE_KEYS` for brief review presentation
  - also used after any stage that needs workspace card write-back
- Required input fields:
  - `run_id`
  - `user_id`
  - `section_key`
  - `skill_output`
- Optional input fields:
  - `brief_id`, `brief_snapshot_id`, `client_id`
  - `existing_cards`, `card_edits`, `write_mode`
- Required prior skill output:
  - any skill output that needs rendering
- Optional prior skill output:
  - all completed skill outputs for document save or cross-section hydration

## OUTPUT

- Downstream consumers: Supabase realtime, workspace state hydration, research document save, and Journey session readers.
- Zod schema reference: `skills/present-workspace/schemas/output.ts`.
- Schema sketch:

```ts
const sourcedClaimSchema = z.object({
  value: z.string().min(1),
  source_url: z.string().url(),
  retrieved_at: z.string().datetime(),
});

const workspaceCardSchema = z.object({
  id: z.string().min(1),
  section_key: z.string().min(1),
  card_type: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1).optional(),
  content: z.record(z.string(), z.unknown()),
  status: z.enum(['draft', 'edited', 'approved']),
  evidence: z.array(sourcedClaimSchema),
});

const supabaseWriteSchema = z.object({
  table: z.literal('journey_sessions'),
  run_id: z.string().min(1),
  section_key: z.string().min(1),
  result_status: z.enum(['complete', 'partial', 'error']),
  wrote_research_results: z.boolean(),
  wrote_research_document: z.boolean(),
  updated_at: z.string().datetime(),
});

export const presentWorkspaceOutputSchema = z.object({
  run_id: z.string().min(1),
  stage: z.literal('present-workspace'),
  section_key: z.string().min(1),
  cards: z.array(workspaceCardSchema),
  write: supabaseWriteSchema,
  warnings: z.array(z.string().min(1)),
  generated_at: z.string().datetime(),
});
```

Card evidence points back to the skill output claims used to create the card. Derived layout fields do not need their own evidence.

## HYBRID CHOICE

`heavy` — presentation owns deterministic card mapping, stable card IDs, edit overlays, Supabase merge semantics, realtime hydration shape, and write failure handling.

## FILES TO CREATE

- `skills/present-workspace/SKILL.md`
- `skills/present-workspace/README.md`
- `skills/present-workspace/package.json`
- `skills/present-workspace/tsconfig.json`
- `skills/present-workspace/schemas/input.ts`
- `skills/present-workspace/schemas/output.ts`
- `skills/present-workspace/scripts/validate.ts`
- `skills/present-workspace/scripts/sanity-check.ts`
- `skills/present-workspace/scripts/orchestrate.ts`
- `skills/present-workspace/scripts/map-cards.ts`
- `skills/present-workspace/scripts/write-supabase.ts`
- `skills/present-workspace/scripts/apply-card-edits.ts`
- `skills/present-workspace/references/card-taxonomy.md`
- `skills/present-workspace/references/write-back.md`
- `skills/present-workspace/references/rules.md`
- `skills/present-workspace/example/input.json`
- `skills/present-workspace/example/output.json`

No collector prompt is required unless implementation adds a model-based card summarizer. The default path is deterministic mapping from typed outputs.

## CONSTRAINTS

- Skill is self-contained. No imports from `src/`, `research-worker/`, root `lib/`, or another skill.
- This is the only skill allowed to own Supabase writes.
- Port write semantics from `research-worker/src/supabase.ts`: merge by `run_id`, section key, result envelope, retry with warnings, and fail loudly after retries.
- Port card mapping behavior from `src/lib/workspace/card-taxonomy.ts`, but keep it skill-local.
- Port stable card ID behavior from `nextCardId`: section, card type, and slugged label must produce repeatable IDs.
- Port edit overlay behavior from `src/app/api/journey/card-edit/route.ts`: edits live as section-level `__cardEdits` outside `data`.
- Preserve workspace hydration expectations from `src/components/workspace/workspace-page.tsx` and `src/lib/journey/research-realtime.ts`.
- Do not mutate skill output data while rendering cards.
- Do not allow another skill output to include direct Supabase instructions.
- Write errors must include run id, section key, table, operation, status, and last error.

## STEPS

1. Read legacy write and presentation paths:
   - `research-worker/src/supabase.ts`
   - `research-worker/src/index.ts`
   - `src/lib/workspace/card-taxonomy.ts`
   - `src/lib/workspace/types.ts`
   - `src/lib/workspace/pipeline.ts`
   - `src/components/workspace/workspace-page.tsx`
   - `src/lib/journey/research-realtime.ts`
   - `src/app/api/journey/card-edit/route.ts`
   - `src/lib/actions/journey-sessions.ts`
   - Verify: implementation notes list write semantics, hydration shape, and card taxonomy behavior kept.
2. Define `schemas/input.ts` with `run_id`, `user_id`, `section_key`, `skill_output`, optional `existing_cards`, and optional `card_edits`.
   - Verify: missing run id, user id, section key, or skill output fails.
3. Define `schemas/output.ts` with card payloads and Supabase write receipt.
   - Verify: cards have stable IDs, known section keys, status, content object, and evidence arrays.
4. Write `scripts/map-cards.ts` to convert known skill output shapes into workspace card payloads.
   - Verify: empty data returns a typed error, not an empty success.
5. Write `scripts/apply-card-edits.ts` for `__cardEdits` overlays without mutating original card content.
   - Verify: edit overlays can be replayed after cold-start hydration.
6. Write `scripts/write-supabase.ts` with runtime-injected credentials and retry behavior.
   - Verify: dry-run mode validates payloads without contacting Supabase.
7. Write `SKILL.md`, write-back rules, validation scripts, sanity checks, and fixtures.
   - Verify: no other Wave 4 skill spec claims Supabase ownership.

## VERIFY

```bash
cd skills/present-workspace
npm install
npm run check
npm run validate
npm run sanity-check example/output.json
npm run orchestrate -- example
```

Expected result:

- TypeScript compiles with no errors.
- `example/input.json` validates with a completed skill output.
- `example/output.json` validates as `presentWorkspaceOutputSchema`.
- Orchestrator maps skill output to cards and emits a write receipt in dry-run mode.
- Real Supabase writes are only run with explicit runtime credentials and non-fixture input.

## CONFORMANCE TESTS

- `missing-source-url`: remove `source_url` from card evidence; `npm run validate` must fail.
- `missing-retrieved-at`: remove `retrieved_at` from card evidence; `npm run validate` must fail.
- `stable-card-id`: run `map-cards` twice over the same input; card IDs must match exactly.
- `empty-data-error`: pass a complete result with empty renderable data; orchestrate must fail with section key and run id.
- `edit-overlay-location`: card edits must serialize under section-level `__cardEdits`, not inside `data`.
- `write-owner-only`: scan every other Wave 4 skill for Supabase write helpers; only `present-workspace` may include them.
- `no-outside-imports`: scan `skills/present-workspace/**/*.ts` for imports beginning with `../..`, `@/`, `src/`, `research-worker/`, or another `skills/` path; the check must fail if any exist.

## WAVE

Wave number: `4`.

## DEPENDENCIES

- Required upstream skills:
  - any skill output that needs rendering
- Required non-skill upstream state:
  - authenticated user id, run id, section key, and runtime Supabase credentials for non-dry-run writes
- Optional upstream skills:
  - `ingest-url`
  - `ingest-docs`
  - `ingest-fathom`
  - `chat-refine`
  - every research or synthesis skill that emits workspace-renderable JSON
- Blocked by:
  - final v3 runtime decision for whether card payloads are stored inside `research_results[section].cards` or derived on read from `data`.
