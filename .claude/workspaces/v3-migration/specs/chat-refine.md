# chat-refine Spec

## Skill

`skills/chat-refine/`

## GOAL

Accept sidebar edit requests against existing workspace cards or brief fields and emit user-reviewable edit proposals without triggering new research.

## NON-GOALS

- Does not dispatch research tools, worker jobs, web searches, or provider calls for new facts.
- Does not re-run offer, ICP, competitor, market, keyword, VoC, media plan, or scripts stages.
- Does not write Supabase rows directly. `present-workspace` owns writes.
- Does not apply edits without user approval.
- Does not invent new metrics, claims, quotes, prices, or competitor facts.
- Does not replace card rendering. It only emits edit proposals over already-rendered workspace state.

## INPUT

- Upstream contract:
  - prior skill output or workspace card state
  - `research-worker/src/schemas/gtm/gtm-brief.ts` when a brief field update is requested
- Runtime stage:
  - `review-brief` from `GTM_STAGE_KEYS` for brief review edits; post-research card edits attach to the completed section being edited without advancing the stage cursor
- Required input fields:
  - `run_id`
  - `request`
  - at least one of `section_cards[]` or `brief_fields`
- Optional input fields:
  - `current_section`, `approved_sections`, `user_selection`, `prior_messages`
- Required prior skill output:
  - any existing research, synthesis, media plan, script, ingest, or brief output being edited
- Optional prior skill output:
  - all prior research outputs available in the workspace context

## OUTPUT

- Downstream consumers: workspace sidebar approval UI and `present-workspace`.
- Zod schema reference: `skills/chat-refine/schemas/output.ts`.
- Schema sketch:

```ts
const sourcedClaimSchema = z.object({
  value: z.string().min(1),
  source_url: z.string().url(),
  retrieved_at: z.string().datetime(),
});

const cardEditProposalSchema = z.object({
  type: z.literal('card_edit'),
  card_id: z.string().min(1),
  section_key: z.string().min(1),
  field_path: z.string().min(1),
  previous_value: z.unknown(),
  proposed_value: z.unknown(),
  rationale: z.string().min(1),
  evidence: z.array(sourcedClaimSchema),
});

const fieldUpdateProposalSchema = z.object({
  type: z.literal('brief_field_update'),
  field_key: z.string().min(1),
  previous_value: z.string(),
  proposed_value: z.string().min(1),
  rationale: z.string().min(1),
  evidence: z.array(sourcedClaimSchema),
});

export const chatRefineOutputSchema = z.object({
  run_id: z.string().min(1),
  stage: z.literal('review-brief'),
  operation: z.literal('chat-refine'),
  request: z.string().min(1),
  proposals: z.array(z.discriminatedUnion('type', [
    cardEditProposalSchema,
    fieldUpdateProposalSchema,
  ])).min(1),
  rejected_actions: z.array(z.object({
    action: z.string().min(1),
    reason: z.string().min(1),
  })),
  generated_at: z.string().datetime(),
});
```

Evidence is required when a proposal changes a factual value. Copy edits can use an empty `evidence` array only when no factual claim changes.

## HYBRID CHOICE

`heavy` — the skill must bundle current chat tools as references, restrict field paths, block dispatch actions, validate card IDs, and produce deterministic edit overlays.

## FILES TO CREATE

- `skills/chat-refine/SKILL.md`
- `skills/chat-refine/README.md`
- `skills/chat-refine/package.json`
- `skills/chat-refine/tsconfig.json`
- `skills/chat-refine/schemas/input.ts`
- `skills/chat-refine/schemas/output.ts`
- `skills/chat-refine/scripts/validate.ts`
- `skills/chat-refine/scripts/sanity-check.ts`
- `skills/chat-refine/scripts/orchestrate.ts`
- `skills/chat-refine/scripts/apply-overlay.ts`
- `skills/chat-refine/references/card-edit.md`
- `skills/chat-refine/references/field-update.md`
- `skills/chat-refine/references/rules.md`
- `skills/chat-refine/example/input.json`
- `skills/chat-refine/example/output.json`

No fetch, web search, research dispatch, report generation, or Supabase script belongs in this skill.

## CONSTRAINTS

- Skill is self-contained. No imports from `src/`, `research-worker/`, root `lib/`, or another skill.
- Port the behavior contract from `src/lib/ai/tools/edit-card.ts`: proposals include card id, field path, new value, and explanation.
- Port the field allowlist from `src/lib/ai/tools/update-field.ts` into skill-local schema code.
- Respect the sidebar context shape built in `src/components/workspace/workspace-page.tsx`: card id, title, first paragraph, and editable fields.
- Keep the hard rule from this wave: `chat-refine` must not trigger new research dispatches.
- Block action text such as `re-run`, `research`, `launch`, `dispatch`, `analyze again`, and `scrape` by returning `rejected_actions`.
- User approval is required before writes. Output proposals only.
- Factual changes require evidence from existing card content, existing brief field sources, or prior skill outputs.
- Empty evidence arrays are only allowed for tone, grammar, formatting, or copy compression edits.
- Unknown card IDs and unknown field paths must fail validation.

## STEPS

1. Read legacy chat and edit paths:
   - `src/lib/ai/tools/edit-card.ts`
   - `src/lib/ai/tools/update-field.ts`
   - `src/app/api/journey/stream/route.ts`
   - `src/app/api/journey/card-edit/route.ts`
   - `src/components/workspace/workspace-page.tsx`
   - `src/lib/ai/tools/research/dispatch.ts`
   - Verify: implementation notes name edit behavior kept and dispatch behavior excluded.
2. Define `schemas/input.ts` with card context, brief fields, current section, and user request.
   - Verify: input fails when both `section_cards` and `brief_fields` are absent.
3. Define `schemas/output.ts` with edit proposals and rejected actions.
   - Verify: proposals require known card IDs or known field keys.
4. Write `references/card-edit.md` and `references/field-update.md`.
   - Verify: each reference maps to one proposal type.
5. Write `references/rules.md` with no-dispatch, no-new-facts, and approval-only rules.
   - Verify: banned research verbs return rejected actions.
6. Write `scripts/apply-overlay.ts` to preview a proposal over input state without mutating the original input.
   - Verify: original fixture input remains byte-stable after preview.
7. Write `SKILL.md`, validation scripts, sanity checks, and fixtures.
   - Verify: copy-edit fixture can pass without evidence; factual-edit fixture requires evidence.

## VERIFY

```bash
cd skills/chat-refine
npm install
npm run check
npm run validate
npm run sanity-check example/output.json
npm run orchestrate -- example
```

Expected result:

- TypeScript compiles with no errors.
- `example/input.json` validates with workspace card context.
- `example/output.json` validates as `chatRefineOutputSchema`.
- Orchestrator emits proposals only, never a dispatched research job.

## CONFORMANCE TESTS

- `dispatch-blocked`: request `re-run competitor research`; output must contain a `rejected_actions` entry and no research tool payload.
- `unknown-card-id`: propose an edit for a card id not in input; `npm run sanity-check` must fail.
- `unknown-field-path`: propose `stats.Fake Metric` when the card does not expose that field; sanity-check must fail.
- `missing-source-url`: factual `proposed_value` changes with evidence missing `source_url`; `npm run validate` must fail.
- `copy-edit-no-evidence`: grammar-only edit with empty evidence must pass when previous and proposed facts are the same.
- `no-outside-imports`: scan `skills/chat-refine/**/*.ts` for imports beginning with `../..`, `@/`, `src/`, `research-worker/`, or another `skills/` path; the check must fail if any exist.
- `no-write-no-fetch`: scan scripts for `fetch(`, `dispatchResearch`, `RAILWAY_WORKER_URL`, `createAdminClient`, and `journey_sessions`; the check must fail if present.

## WAVE

Wave number: `4`.

## DEPENDENCIES

- Required upstream skills:
  - any prior skill output or workspace card state selected by the user
- Required non-skill upstream state:
  - existing workspace cards, brief fields, or approved research artifacts
- Optional upstream skills:
  - `ingest-url`
  - `ingest-docs`
  - `ingest-fathom`
  - `research-market`
  - `research-icp`
  - `research-competitor`
  - `research-voc`
  - `research-keywords`
  - `research-offer`
  - `research-cross`
  - `synthesize-positioning`
  - `synthesize-media-plan`
  - `synthesize-scripts`
- Blocked by:
  - final runtime decision for how sidebar proposal approval calls `present-workspace`.
