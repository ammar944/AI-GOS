# Codex Wave 1 Implementation — research-icp

You are implementing the `research-icp` skill in the AIGOS v3 migration. Wave 0 wrote a contract; you write the code that satisfies the contract.

## Authoritative spec

Read this entire file before doing anything else and treat it as the contract you must satisfy:

- `/Users/ammar/Dev-Projects/AI-GOS-main/.claude/workspaces/v3-migration/specs/research-icp.md`
- Spec template (governing format): `/Users/ammar/Dev-Projects/AI-GOS-main/.claude/workspaces/v3-migration/SPEC_TEMPLATE.md`

## Reference implementation

The only fully-built skill in the repo. Use it as a structural template — same package.json scripts shape, same tsconfig, same SKILL.md frontmatter, same `validate.ts`/`sanity-check.ts` style. Do NOT import from it.

- `/Users/ammar/Dev-Projects/AI-GOS-main/skills/research-competitor/`
  - `package.json` — script names: `check`, `validate`, `sanity-check`, `report`, `orchestrate`
  - `tsconfig.json` — copy verbatim
  - `SKILL.md` — frontmatter shape + section headers
  - `schemas/{input,output}.ts` — sourced-claim style
  - `scripts/validate.ts` — Zod gate, exit 0/1
  - `scripts/sanity-check.ts` — fail/warn pattern with `ALLOW_SUSPECT=1` override

## Current skill state

`skills/research-icp/` is a stub. Existing files:

- `SKILL.md` — placeholder, REWRITE
- `package.json` — keep, but add `dependencies` + `devDependencies` parity with the reference
- `tsconfig.json` — keep
- `references/rules.md` — placeholder, REWRITE
- `references/TODO.md`, `example/TODO.md`, `scripts/TODO.md`, `assets/TODO.md` — DELETE these TODO markers

## Upstream context (read but do not import)

- `/Users/ammar/Dev-Projects/AI-GOS-main/research-worker/src/runners/icp.ts`
- `/Users/ammar/Dev-Projects/AI-GOS-main/research-worker/src/schemas/gtm/gtm-brief.ts` — for the field set in the GtmBrief input
- `/Users/ammar/Dev-Projects/AI-GOS-main/research-worker/src/schemas/gtm/gtm-run.ts` — for the `research-buyer-icp` stage key
- `/Users/ammar/Dev-Projects/AI-GOS-main/research-worker/src/schemas/gtm/research-sections.ts`
- `/Users/ammar/Dev-Projects/AI-GOS-main/research-worker/src/contracts.ts`

You are NOT migrating that runner code. You are writing a self-contained skill whose schema captures the same facts in a sourced-claim shape.

## Files to deliver (in skills/research-icp/)

Per the spec's "FILES TO CREATE" list:

1. `SKILL.md` — replace stub. Real frontmatter + Trigger + What it does + Workflow + Tools + Hard constraints + Output. Under 500 lines.
2. `README.md` — short README mirroring the SKILL.md description. (Stub already exists; rewrite if generic.)
3. `package.json` — add `@types/node` if missing. Keep script names identical to reference.
4. `tsconfig.json` — match the reference exactly.
5. `schemas/input.ts` — sealed input: `run_id`, `brief_snapshot_id`, locked `GtmBrief` fields, optional `ingest_identity` and `research_market` prior outputs. Duplicate the GtmBrief field shape locally (no imports from `research-worker/`).
6. `schemas/output.ts` — implement `researchIcpOutputSchema` exactly as sketched in the spec. Use a `sourceSchema` + `sourcedClaimSchema` primitive. Persona anchors, awareness stages, job titles, search intent, buying-committee notes, exclusions, plus `run_id` + `brief_snapshot_id` + `stage: z.literal('research-buyer-icp')` + `generated_at`. No score fields. No fabricated metrics.
7. `scripts/validate.ts` — Zod gate for `example/output.json`. Pattern from reference.
8. `scripts/sanity-check.ts` — implement these checks per the spec's CONFORMANCE TESTS:
   - `missing-source-url`, `missing-retrieved-at` (Zod catches these via validate; sanity also re-asserts on persona pains and job titles)
   - `placeholder-rejection` — reject `unknown`, `TBD`, `n/a`, empty strings, scaffold/placeholder text
   - `persona-anchor-floor` — `persona_anchors.length >= 1`
   - `job-title-floor` — `job_titles.length >= 1`
   - `no-outside-imports` — scan `skills/research-icp/**/*.ts` for forbidden import prefixes (`../..`, `@/`, `src/`, `research-worker/`, other `skills/`). Fail if any.
   - Standard `ALLOW_SUSPECT=1` override.
9. `references/rules.md` — non-negotiable collection rules. Forbid placeholders, require source per claim, respect `ingest-identity` negative keywords.
10. `references/collector.md` — the agent's runtime prompt. Must say: "every collection instruction maps to one output key." Cover persona anchor discovery, awareness-stage evidence search, job-title sourcing, search-intent inference, buying-committee notes.
11. `example/input.json` — realistic sealed input matching `schemas/input.ts`. Use Linear or another well-known SaaS so URLs are real.
12. `example/output.json` — fully populated output. Every claim has `source_url` + `retrieved_at` (ISO 8601). At least 2 persona anchors, all 5 awareness stages, ≥5 job titles, ≥5 search-intent rows, ≥1 buying-committee note. Use real source URLs (job boards, help docs, customer logos pages, review snippets, search result pages).

DELETE the TODO marker files in `references/`, `example/`, `scripts/`, `assets/` after writing real content.

## Hard constraints (from spec CONSTRAINTS)

- Skill is self-contained. No imports from `src/`, `research-worker/`, root `lib/`, or another skill.
- Duplicate only the schema primitives needed.
- Facts only. No recommendations, no campaign plans, no positioning rewrites.
- No LLM scores, confidence percentages, TAM estimates, persona importance scores.
- Every factual claim has `source_url` + `retrieved_at`.
- If a field can't be sourced, omit or empty array. No `unknown`, `TBD`, `n/a` placeholders.
- External fetch/search failures must throw with provider, query, status, run id (this rule applies to runtime collectors; not enforceable in the example fixture).

## Verification (run before declaring done)

```bash
cd /Users/ammar/Dev-Projects/AI-GOS-main/skills/research-icp
npm install
npm run check
npm run validate
npm run sanity-check example/output.json
```

All four must exit 0 with no `ALLOW_SUSPECT` bypass. If `npm install` already happened, `node_modules/` will exist — that's fine.

Then run the conformance probes by hand:

```bash
# Each of these should exit non-zero (fail). After verifying, restore example/output.json.
cp example/output.json /tmp/icp-good.json
# 1. missing source_url
node -e "const x=require('./example/output.json');delete x.persona_anchors[0].pains[0].source_url;require('fs').writeFileSync('/tmp/icp-bad.json',JSON.stringify(x))" && npm run validate /tmp/icp-bad.json && echo "FAIL: should have rejected" || echo "ok: missing source_url rejected"
# 2. empty persona_anchors
node -e "const x=require('./example/output.json');x.persona_anchors=[];require('fs').writeFileSync('/tmp/icp-bad.json',JSON.stringify(x))" && npm run sanity-check /tmp/icp-bad.json && echo "FAIL: should have rejected" || echo "ok: empty anchors rejected"
# 3. placeholder
node -e "const x=require('./example/output.json');x.persona_anchors[0].pains[0].claim='unknown';require('fs').writeFileSync('/tmp/icp-bad.json',JSON.stringify(x))" && npm run sanity-check /tmp/icp-bad.json && echo "FAIL: should have rejected" || echo "ok: placeholder rejected"
# Confirm clean fixture still passes
npm run sanity-check example/output.json
```

Capture the output of `npm run check`, `npm run validate`, `npm run sanity-check example/output.json` in the final report. Don't commit. Don't push. Don't delete unrelated files.

## Out of scope

- No `scripts/orchestrate.ts`, `merge-fragments.ts`, `generate-report.ts`, `screenshot.ts`, `assets/report-shell.html` in Wave 1.
- No runtime wiring (no `.claude/skills/research-icp/` bridge changes, no `.claude/commands/research-icp.md` changes).
- No tests for the prior `research-worker/src/runners/icp.ts` (legacy stays untouched).

## Final report

When done, print:

1. Files created/modified list.
2. `npm run check` output.
3. `npm run validate` output.
4. `npm run sanity-check example/output.json` output.
5. Conformance probe outputs (3 above).
6. Any deviations from the spec, with one-sentence justification.

Begin.
