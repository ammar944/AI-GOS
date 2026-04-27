# Codex Orchestrator — Wave 4 (minus chat-refine) implementation

You are the orchestrator. Your job: implement four AIGOS v3 Wave 4 skills via parallel subagent fan-out, then run independent verification on every skill, then update the tracker. The fifth Wave 4 skill (`chat-refine`) is intentionally deferred.

## Four skills to implement

| Skill | Hybrid | Spec | Notes |
|---|---|---|---|
| `ingest-docs` | heavy | `.claude/workspaces/v3-migration/specs/ingest-docs.md` | Uploaded docs need parsing, extraction, validation |
| `ingest-fathom` | light | `.claude/workspaces/v3-migration/specs/ingest-fathom.md` | Meeting transcript → sales-call intelligence block |
| `ingest-url` | heavy | `.claude/workspaces/v3-migration/specs/ingest-url.md` | URL discovery + field prefill, deterministic cleanup |
| `present-workspace` | heavy | `.claude/workspaces/v3-migration/specs/present-workspace.md` | Presentation/write-back layer; owns Supabase card writes |

DO NOT touch `chat-refine`. It is deferred until after this batch.

## Authoritative inputs (read before dispatching)

- All four spec files above. Each contains GOAL, NON-GOALS, INPUT, OUTPUT, HYBRID CHOICE, FILES TO CREATE, CONSTRAINTS, STEPS, VERIFY, CONFORMANCE TESTS.
- Spec template: `.claude/workspaces/v3-migration/SPEC_TEMPLATE.md`
- Reference fully-built heavy skill: `skills/research-competitor/`
- Wave 1+2+3 finished templates (closer to today's normalized form): `skills/research-icp/`, `skills/research-offer/`, `skills/research-market/`, `skills/research-cross/`, `skills/research-keywords/`, `skills/research-voc/`, `skills/synthesize-positioning/`, `skills/synthesize-media-plan/`, `skills/synthesize-scripts/`
- Tracker: `.claude/workspaces/v3-migration/tracker.md`

## Wave 4 differs from Waves 1-3 — internalize this

The earlier waves (research/synthesize) consume the locked GTM brief and emit research cards. Wave 4 skills are **upstream** (feed the brief) or **downstream presentation**:

- `ingest-*` skills produce structured fragments that *populate or update* the GTM brief / sales-call intelligence block. They are pre-research, not post-research.
- `present-workspace` is the only skill that **writes to product storage** (Supabase workspace cards). Every other skill must remain Supabase-pure (no DB writes).

Do not conflate these with research skills. The output schemas are brief-fragment-shaped, not research-card-shaped.

## Standardized skill shape (from Wave 1 normalization, 2026-04-27)

Every skill folder must follow this normalized shape:

- `package.json` — script names: `check`, `validate`, `sanity-check`, `test`. Use `node --import tsx/esm scripts/<file>.ts` for the runner. Heavy skills may add `report`, `orchestrate`, `merge-fragments` using the same `node --import tsx/esm` form. devDependencies: `tsx ^4.19.4`, `typescript ^5.8.3`, `@types/node ^22.15.3`. dependencies: `zod ^3.24.3` only.
- `tsconfig.json` — copy verbatim from `skills/research-competitor/tsconfig.json`.
- `SKILL.md` — frontmatter (`name`, `description`), then sections: Trigger, What it does, Boundaries, Workflow, Tools, Hard constraints, Output. Under 500 lines.
- `README.md` — short.
- `schemas/input.ts`, `schemas/output.ts`.
- `scripts/validate.ts`, `scripts/sanity-check.ts`. Heavy skills add `orchestrate.ts`, `merge-fragments.ts`, `generate-report.ts` only when the spec requires them.
- `references/rules.md`, `references/collector.md`. Heavy skills may add `references/subagent-<role>.md`.
- `example/input.json`, `example/output.json`.
- DELETE every `*/TODO.md` marker file inside the skill folder.

## Spec deviation note from Wave 1 (you must honor)

When you split required vs optional GtmBrief field shapes, do NOT use `.and()` to combine two `.strict()` objects. Zod intersection of two strict objects rejects valid keys. Use `.merge(...)` then chain `.strict()` on the merged result instead. This pattern was found and fixed in `research-offer/schemas/input.ts` during Wave 1.

## Special constraint for `present-workspace`

`present-workspace` is the ONLY skill in the v3 migration that may interact with Supabase. The spec defines its write-back contract.

- Inside the skill folder, define the Supabase write contract as a typed function signature with a stub or mock backing it. Do NOT put real `@supabase/supabase-js` calls in the example fixture's runtime path.
- The example fixture must use a mock-write transport so `npm test` runs without network or env vars.
- The skill's schemas must capture: card identity (run_id, brief_snapshot_id, card_kind), prior content snapshot, new content snapshot, write outcome, and idempotency key.
- `sanity-check.ts` must reject any output that claims a Supabase write happened without an idempotency key, run_id, and card_kind.

If the spec contradicts any of the above, follow the spec and note the contradiction in your final report.

## Subagent dispatch pattern

1. Read all four specs and identify per-spec quirks.
2. Launch four subagents in parallel, one per skill. Each subagent owns:
   - Reading its spec
   - Reading its current skill folder state (most are stubs with `TODO.md` files)
   - Reading the upstream legacy code if the spec names one (e.g., `research-worker/src/runners/meeting-extract.ts` for fathom; `src/lib/journey/identity-prefill*` for ingest-url; `src/lib/business-profile-documents*` for ingest-docs; existing workspace card writers in `src/lib/journey/persistence*` or `src/components/workspace/*` for present-workspace) — read but never import
   - Producing the canonical files in `skills/<skill-name>/` per the standardized shape
   - Running `npm install`, `npm run check`, `npm run validate`, `npm run sanity-check example/output.json` and capturing outputs
   - Running spec-specific conformance probes
3. After all four return, you (the orchestrator) run an independent verification pass:
   - For each skill: `cd skills/<name> && npm test`
   - Confirm no skill imports from `src/`, `research-worker/`, root `lib/`, or another `skills/<other>/`
   - Confirm `present-workspace` does not import `@supabase/supabase-js` in code that runs during `npm test`
4. Update the tracker at `.claude/workspaces/v3-migration/tracker.md`: flip the four skills' status from `Spec'd` to `Validated`. Owner: `Codex gpt-5.5 (2026-04-27)`. Append a one-sentence note per skill.

If a subagent's verification fails, debug and re-dispatch that one subagent rather than restarting the whole batch.

## Hard constraints (apply to every subagent)

- Every skill is self-contained. No imports from `src/`, `research-worker/`, root `lib/`, or another skill folder. Duplicate primitives locally.
- Facts only. No fabricated metrics, no LLM scores, no invented quotes.
- Every factual claim has `source_url` and `retrieved_at` (ingest skills cite the source artifact — uploaded doc URI, fathom recording id, scraped URL, etc.).
- Empty arrays allowed. Placeholder text (`unknown`, `TBD`, `n/a`, `scaffold`) rejected by sanity-check.
- DELETE all `TODO.md` marker files inside each skill folder.
- Sanity-check each skill must include a `no-outside-imports` scanner that walks `skills/<name>/**/*.ts` (skipping `node_modules/`) and fails on imports starting with `../..`, `@/`, `src/`, `research-worker/`, or `skills/<other>/`.
- Use real-domain fixtures (Linear/Notion/Figma/etc.) — no `example.com` placeholder URLs.
- For `present-workspace`: the write-back code path must be mockable (no live Supabase env required for `npm test`).

## Per-subagent prompt template (you generate one per skill, pre-filled)

```
You are implementing skills/<skill-name>/ for AIGOS v3 Wave 4.

Read first:
- Spec: .claude/workspaces/v3-migration/specs/<skill-name>.md
- Reference shape: skills/research-icp/ (light) or skills/research-competitor/ (heavy with fan-out)
- Standardized package.json + tsconfig from the orchestrator brief
- Wave 4 differs: ingest-* skills feed the brief; present-workspace writes Supabase cards

Build the canonical files (SKILL.md, README, package.json, tsconfig, schemas/{input,output}.ts, scripts/{validate,sanity-check}.ts, references/{rules,collector}.md, example/{input,output}.json) plus heavy-only files the spec demands.

Use a real-domain fixture. ingest-fathom can use a synthesized but realistic transcript snippet. present-workspace must use a mock Supabase transport.

Verify:
  cd skills/<skill-name>
  npm install
  npm test

Run the spec's CONFORMANCE TESTS by hand.

Report: files created/modified, test outputs, conformance probe outputs, any spec deviations with one-sentence justification.
```

## Final report (you, the orchestrator)

After all subagents return and you've run independent verification, output one combined report:

1. Per-skill table: skill name, files created (count), `check` / `validate` / `sanity-check` results, conformance probe pass/fail count, any deviations.
2. Confirmation that the tracker was updated with the four new `Validated` rows (and that `chat-refine` row is unchanged).
3. Total wall-clock time and total tokens used.
4. Any cross-cutting issues (e.g., one-shot fixes you applied across multiple skills).
5. Confirmation: `present-workspace` does not run live Supabase calls during `npm test`.

## What you must NOT do

- Do NOT touch `chat-refine` — it stays at `Spec'd`.
- Do NOT touch any file outside `skills/<the four skills>/` and `.claude/workspaces/v3-migration/tracker.md`.
- Do NOT modify Wave 1/2/3 skills or `research-competitor` / `ingest-identity`.
- Do NOT modify legacy runners under `research-worker/src/runners/`.
- Do NOT add `screenshot.ts` unless the spec explicitly requires it.
- Do NOT add slash command bridges (`.claude/commands/`, `.claude/skills/<name>/`) — those are a separate Wired step.
- Do NOT commit. Do NOT push. Do NOT modify .env files.
- Do NOT run paid APIs in a loop — the example fixtures should use ONE real source URL set per skill, not iterate through search providers.
- Do NOT have `present-workspace` actually write to Supabase. Mock the transport.

Begin by reading the four specs in parallel, then planning the subagent dispatch.
