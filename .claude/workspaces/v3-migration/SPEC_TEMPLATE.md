# AIGOS v3 Skill Spec Template

Use this template for every Wave 0 skill spec. Keep the filled spec concrete enough that an engineer can build the skill without reopening the design doc. This is a contract, not implementation code.

## Skill

`skills/<skill-name>/`

## GOAL

One sentence describing the capability and the typed output it must produce.

## NON-GOALS

- List what the skill must not do.
- Name adjacent skills that own nearby work.
- State any old runner or UI behavior that is out of scope.

## INPUT

- Upstream contract:
  - `research-worker/src/schemas/gtm/gtm-brief.ts`
  - or prior skill output named here.
- Required brief fields: `fields.<fieldName>`.
- Optional context: prior stage output, user notes, or existing research card.
- Runtime stage: one of `GTM_STAGE_KEYS` from `research-worker/src/schemas/gtm/gtm-run.ts`.

## OUTPUT

- Downstream consumer: next GTM stage or workspace surface.
- Zod schema reference: `skills/<skill-name>/schemas/output.ts` or `skills/<skill-name>/references/output-schema.ts`.
- Include a short schema sketch:

```ts
const sourcedClaimSchema = z.object({
  value: z.string().min(1),
  source_url: z.string().url(),
  retrieved_at: z.string().datetime(),
});
```

## HYBRID CHOICE

- `light` — SKILL.md + prompt references + Zod validation are enough. Use when the skill is mainly an LLM collection or synthesis call with no deterministic merge, API cache, name matching, screenshot, or parser.
- `heavy` — add TypeScript orchestration and deterministic gates. Use only when the skill needs real post-processing such as ad-fetch caching, name matching, document parsing, keyword normalization, report rendering, or multi-fragment fan-in.

Justification: one sentence.

## FILES TO CREATE

List every file planned under `skills/<skill-name>/`. Required for all skills:

- `skills/<skill-name>/SKILL.md`
- `skills/<skill-name>/README.md`
- `skills/<skill-name>/package.json`
- `skills/<skill-name>/tsconfig.json`
- `skills/<skill-name>/schemas/input.ts`
- `skills/<skill-name>/schemas/output.ts`
- `skills/<skill-name>/scripts/validate.ts`
- `skills/<skill-name>/scripts/sanity-check.ts`
- `skills/<skill-name>/example/input.json`
- `skills/<skill-name>/example/output.json`

Add only when needed:

- `skills/<skill-name>/references/collector.md`
- `skills/<skill-name>/references/subagent-<role>.md`
- `skills/<skill-name>/references/rules.md`
- `skills/<skill-name>/scripts/orchestrate.ts`
- `skills/<skill-name>/scripts/merge-fragments.ts`
- `skills/<skill-name>/scripts/generate-report.ts`
- `skills/<skill-name>/assets/report-shell.html`
- `skills/<skill-name>/assets/styles.css`

## CONSTRAINTS

- Skill is self-contained. No imports from `src/`, `research-worker/`, root `lib/`, or another skill.
- Duplicate the schema primitives needed for conformance. Do not create a shared library in this pass.
- Facts only. No recommendations unless this skill is explicitly a synthesis skill.
- No LLM scores. Use externally observable facts or omit the field.
- Every claim must carry `source_url` and `retrieved_at`.
- Empty arrays are allowed. Fabricated fields are not.
- External APIs must fail loudly with context: provider, query, status, and run id.
- Keep SKILL.md under 500 lines and move long prompts into `references/`.

## STEPS

1. Read the old runner, current schema, and existing UI card that consumes this stage.
   - Verify: list exact paths inspected.
2. Define `schemas/input.ts` from the locked GTM brief snapshot and required prior outputs.
   - Verify: fixture input validates.
3. Define `schemas/output.ts` with sourced claims on every factual field.
   - Verify: fixture output validates.
4. Write `SKILL.md` with trigger, boundaries, workflow, tools, and hard constraints.
   - Verify: SKILL.md names no forbidden imports or shared helpers.
5. Write prompt references or collector rules.
   - Verify: every collection instruction maps to an output field.
6. Add deterministic scripts only if the hybrid choice requires them.
   - Verify: the spec explains why each script exists.
7. Add example input and output, then run skill-local verification.
   - Verify: examples use real source URLs and command output is captured.

## VERIFY

Use skill-local commands. Do not rely on root build success as proof that the skill works.

```bash
cd skills/<skill-name>
npm install
npm run check
npm run validate
npm run sanity-check example/output.json
```

If the skill has an orchestrator:

```bash
npm run orchestrate -- example
```

If the skill renders:

```bash
npm run report -- example/output.json /tmp/<skill-name>-report.html
```

## CONFORMANCE TESTS

At minimum, specify:

- Output rejects any claim without `source_url`.
- Output rejects any claim without `retrieved_at`.
- Output rejects fabricated pricing, fabricated market size, fabricated quotes, and fabricated metrics.
- Output omits unknown values instead of using placeholder text.
- Skill imports stay inside `skills/<skill-name>/`.
- Fixture output passes Zod and sanity-check.

Add skill-specific rules here.

## WAVE

Wave number: `1`, `2`, `3`, or `4`.

## DEPENDENCIES

- Required upstream skills: `skill-name`.
- Optional upstream skills: `skill-name`.
- Blocked by: schema or runtime decision, if any.
