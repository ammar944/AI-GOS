# Codex Wave 2 + 3 Implementation — single orchestrator with subagent fan-out

You are the orchestrator. Your job is to implement six AIGOS v3 skills by **dispatching subagents in parallel**, one per skill. You may use `Task` / `Agent` / your subagent primitive to fan out — do NOT serialize the work. After all subagents return, run independent verification on every skill and produce one combined report.

## Six skills to implement

| Wave | Skill | Hybrid | Spec |
|---|---|---|---|
| 2 | `research-cross` | light | `.claude/workspaces/v3-migration/specs/research-cross.md` |
| 2 | `research-keywords` | heavy | `.claude/workspaces/v3-migration/specs/research-keywords.md` |
| 2 | `research-voc` | heavy | `.claude/workspaces/v3-migration/specs/research-voc.md` |
| 3 | `synthesize-positioning` | light | `.claude/workspaces/v3-migration/specs/synthesize-positioning.md` |
| 3 | `synthesize-media-plan` | heavy | `.claude/workspaces/v3-migration/specs/synthesize-media-plan.md` |
| 3 | `synthesize-scripts` | heavy | `.claude/workspaces/v3-migration/specs/synthesize-scripts.md` |

## Your authoritative inputs

Read these before dispatching anything:

- All six spec files listed above. Each spec contains GOAL, NON-GOALS, INPUT, OUTPUT, HYBRID CHOICE, FILES TO CREATE, CONSTRAINTS, STEPS, VERIFY, CONFORMANCE TESTS.
- Spec template: `.claude/workspaces/v3-migration/SPEC_TEMPLATE.md`
- Reference fully-built skill (use as structural template, do NOT import from it): `skills/research-competitor/`
- Wave 1 finished templates (closer to today's normalized form): `skills/research-icp/`, `skills/research-offer/`, `skills/research-market/`
- Tracker: `.claude/workspaces/v3-migration/tracker.md`

## Standardized skill shape (from Wave 1 normalization, 2026-04-27)

Every skill folder must follow this normalized shape:

- `package.json` — script names: `check`, `validate`, `sanity-check`, `test`. Use `node --import tsx/esm scripts/<file>.ts` for the runner. Heavy skills may add `report`, `orchestrate`, `merge-fragments` using the same `node --import tsx/esm` form. Include `tsx ^4.19.4` and `typescript ^5.8.3` in devDependencies, plus `@types/node ^22.15.3`. `dependencies`: `zod ^3.24.3` only.
- `tsconfig.json` — copy verbatim from `skills/research-competitor/tsconfig.json`.
- `SKILL.md` — frontmatter (`name`, `description`), then sections: Trigger, What it does, Boundaries, Workflow, Tools, Hard constraints, Output. Under 500 lines.
- `README.md` — short.
- `schemas/input.ts`, `schemas/output.ts`.
- `scripts/validate.ts`, `scripts/sanity-check.ts`. Heavy skills add `orchestrate.ts`, `merge-fragments.ts`, `generate-report.ts` only when the spec requires them.
- `references/rules.md`, `references/collector.md`. Heavy skills may add `references/subagent-<role>.md`.
- `example/input.json`, `example/output.json`.
- DELETE every `*/TODO.md` marker file inside the skill folder.

## Spec deviation note from Wave 1 (you must honor)

In `research-offer/schemas/input.ts`, the original Codex output used `requiredFields.and(optionalFields)` to combine GtmBrief field shapes. This **fails** at runtime because Zod's intersection of two `.strict()` objects rejects valid keys. Wave 1 fix: use `requiredFields.merge(optionalFields).strict()` instead. Apply this lesson everywhere you split required vs optional brief field shapes.

## Subagent dispatch pattern

Plan:

1. Read all six specs. Assign one subagent per skill.
2. Launch the six subagents in parallel. Each subagent owns:
   - Reading its spec
   - Reading its current skill folder state (most are stubs with `TODO.md` files)
   - Reading the upstream legacy runner if the spec names one (e.g., `research-worker/src/runners/{cross,keywords,voc,synthesize}.ts`, `research-worker/src/runners/media-plan*.ts`, `research-worker/src/runners/scripts*.ts`) — read but never import
   - Producing the canonical files in `skills/<skill-name>/` per the standardized shape above
   - Running `npm install`, `npm run check`, `npm run validate`, `npm run sanity-check example/output.json` and reporting outputs
   - Running spec-specific conformance probes
3. After all six return, you (the orchestrator) run an independent verification pass:
   - For each skill: `cd skills/<name> && npm test`
   - Confirm no skill imports from `src/`, `research-worker/`, root `lib/`, or another `skills/<other>/`
4. Update the tracker at `.claude/workspaces/v3-migration/tracker.md` to flip the six skills' status from `Spec'd` to `Validated` (preserve the wave column, replace owner with `Codex gpt-5.5 (2026-04-27)`, append a one-sentence note).

If a subagent's verification fails, debug and re-dispatch that one subagent rather than restarting the whole batch.

## Hard constraints (apply to every subagent)

- Every skill is self-contained. No imports from `src/`, `research-worker/`, root `lib/`, or another skill folder. Duplicate primitives locally.
- Facts only. Synthesis skills produce typed structured output, but every claim must trace back to upstream sourced research outputs (positioning/media-plan/scripts cite the prior research card claims by source URL).
- No LLM scores, confidence percentages, fabricated metrics, or invented quotes.
- Every factual claim has `source_url` and `retrieved_at`. Synthesis-skill output items reference upstream source URLs from the inputs.
- Empty arrays allowed. Placeholder text (`unknown`, `TBD`, `n/a`, `scaffold`) rejected by sanity-check.
- DELETE all `TODO.md` marker files inside each skill folder.
- Sanity-check each skill must include a `no-outside-imports` scanner that walks `skills/<name>/**/*.ts` (skipping `node_modules/`) and fails on imports starting with `../..`, `@/`, `src/`, `research-worker/`, or `skills/<other>/`.
- Synthesis skills (Wave 3) MUST drop legacy `platformRecommendations`, `readinessScorecard`, retargeting fields, formatSpecs, kpis, cacFramework, and the `retargeting` campaign role. The Wave 0 specs already encode this; do not re-introduce.
- Media plan: max 2 campaigns, no Google in Phase 1 for unaware audiences (`synthesize-media-plan.md` spec is the source of truth).

## Per-subagent prompt template

Each subagent should receive a brief like this (you generate one per skill, pre-filled):

```
You are implementing skills/<skill-name>/ for AIGOS v3 Wave <N>.

Read first:
- Spec: .claude/workspaces/v3-migration/specs/<skill-name>.md
- Reference shape: skills/research-icp/ (light) or skills/research-competitor/ (heavy with fan-out)
- Standardized package.json + tsconfig from the orchestrator brief

Build the canonical files (SKILL.md, README, package.json, tsconfig, schemas/{input,output}.ts, scripts/{validate,sanity-check}.ts, references/{rules,collector}.md, example/{input,output}.json) plus any heavy-only files the spec demands.

Use a real-domain fixture (Linear, Notion, Figma, or another well-known SaaS) — never example.com placeholder URLs.

Verify:
  cd skills/<skill-name>
  npm install
  npm test

Run the spec's CONFORMANCE TESTS by hand and capture each result.

Report: files created/modified, test outputs, conformance probe outputs, any spec deviations with one-sentence justification.
```

## Final report (you, the orchestrator)

After all subagents return and you've run independent verification, output one combined report:

1. Per-skill table: skill name, files created (count), `check` / `validate` / `sanity-check` results, conformance probe pass/fail count, any deviations.
2. Confirmation that the tracker was updated with the six new `Validated` rows.
3. Total wall-clock time and total tokens used.
4. Any cross-cutting issues you noticed (e.g., one-shot fixes you applied across multiple skills).

## What you must NOT do

- Do NOT touch any file outside `skills/<skill-name>/` (for the six skills) and `.claude/workspaces/v3-migration/tracker.md`.
- Do NOT modify Wave 1 skills (`skills/research-icp/`, `skills/research-offer/`, `skills/research-market/`).
- Do NOT modify legacy runners under `research-worker/src/runners/`.
- Do NOT add `screenshot.ts`, runtime wiring (`.claude/skills/<name>/`), or slash commands (`.claude/commands/`). Bridges are a separate Wired step.
- Do NOT commit. Do NOT push. Do NOT modify .env files.
- Do NOT run paid APIs in a loop — the example fixtures should use ONE real source URL set per skill, not iterate through search providers.

Begin by reading the six specs in parallel, then planning the subagent dispatch.
