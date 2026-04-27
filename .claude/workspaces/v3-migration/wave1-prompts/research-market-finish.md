# Codex Wave 1 Implementation — research-market (FINISH/DELTA)

You are finishing the partially-built `research-market` skill. This is a delta pass, not a rewrite. The schemas are already rich and the legacy projection fields must stay intact.

## Authoritative spec

Read this entire file before doing anything else. The spec uses `ALREADY EXISTS` and `TO ADD OR HARDEN` markers — respect them strictly.

- `/Users/ammar/Dev-Projects/AI-GOS-main/.claude/workspaces/v3-migration/specs/research-market.md`
- Spec template: `/Users/ammar/Dev-Projects/AI-GOS-main/.claude/workspaces/v3-migration/SPEC_TEMPLATE.md`

## Reference implementation

For style only. DO NOT import from it.

- `/Users/ammar/Dev-Projects/AI-GOS-main/skills/research-competitor/`

## Current skill state — do not delete or shrink

These files already exist with non-trivial content. PRESERVE the rich content; only edit per the deltas below.

- `skills/research-market/SKILL.md` — STILL A STUB (`> Status: scaffolded`). REWRITE with real content.
- `skills/research-market/README.md` — keep or refine.
- `skills/research-market/package.json` — keep, add `@types/node` if helpful.
- `skills/research-market/tsconfig.json` — keep.
- `skills/research-market/schemas/input.ts` — RICH already. Edit to **require** `ingest_identity` in `priorOutputs` (currently `priorOutputs` is `z.record(z.string(), z.unknown())`). Add a strict `ingest_identity` shape that the runtime can fill, and require it.
- `skills/research-market/schemas/output.ts` — RICH already with both new sourced shape AND legacy projection. Edit to add `stage: z.literal('research-market-category')` to `ResearchMarketOutputSchema`. Do NOT remove the legacy projection fields (`categorySnapshot`, `painPoints`, `marketDynamics`, `trendSignals`, `messagingOpportunities`, `marketOpportunities`).
- `skills/research-market/scripts/validate.ts` — keep, will continue working.
- `skills/research-market/scripts/sanity-check.ts` — RICH (parent-market caveat, scaffold markers, market-size gap). Edit to ADD a `no-outside-imports` check matching the reference pattern.
- `skills/research-market/scripts/orchestrate.ts`, `merge-fragments.ts`, `generate-report.ts` — keep, do not touch in Wave 1.
- `skills/research-market/references/collector.md`, `references/rules.md` — keep, edit only if needed for ingest-identity wiring.
- `skills/research-market/example/output.json` — keep, valid fixture.
- `skills/research-market/assets/TODO.md` — DELETE (this is a marker; the skill needs no Wave 1 assets).

## Files to add or modify (DELTA list, exhaustive)

1. **`skills/research-market/SKILL.md`** — REPLACE the stub body with real content matching the reference style:
   - Frontmatter `name`, `description`, `version` already present; keep.
   - Replace the `> Status: scaffolded` callout and every `TODO —` block with concrete prose.
   - Sections: What this skill does, Trigger, Tools used, Workflow, Schema reference, Hard constraints, Output. Under 500 lines.
   - Name no forbidden imports.

2. **`skills/research-market/schemas/input.ts`** — extend so `ingest_identity` prior output is required:
   - Add a local `IngestIdentitySnapshotSchema` covering canonical_company_name, canonical_domain, category, core_keywords, negative_keywords (mirror what the spec describes; don't import). Use only `z` primitives.
   - Replace `priorOutputs: z.record(z.string(), z.unknown())` with a stricter object that has `ingest_identity: IngestIdentitySnapshotSchema` (required) and remaining keys as `.passthrough()` or a record of unknown for forward-compat.

3. **`skills/research-market/schemas/output.ts`** — add stage literal:
   - Add `stage: z.literal('research-market-category')` to `ResearchMarketOutputSchema` and the partial fragment schema.
   - No other shape changes. Legacy fields stay.

4. **`skills/research-market/scripts/sanity-check.ts`** — add `no-outside-imports` scanner:
   - New check function that walks `skills/research-market/**/*.ts` (use `fs.readdirSync` recursion or a small helper). Fail if any import line begins with `../..`, `@/`, `src/`, `research-worker/`, or `skills/<other>/`.
   - Wire it into `detectIssues`.
   - The new check must not depend on `node_modules/` content (skip that path).

5. **`skills/research-market/example/input.json`** — CREATE. Realistic fixture conforming to the updated `schemas/input.ts`. Use a SaaS like Linear/Notion. Required: `run_id`, `briefSnapshot` with the fields the schema requires, `priorOutputs.ingest_identity` populated.

6. **DELETE** `skills/research-market/assets/TODO.md`.

## Conformance probes the spec demands

After your changes, all of these must hold (in addition to the existing ones):

- `missing-source-url` on `category_definition` → validate fails (Zod).
- `missing-retrieved-at` on a `market_size_signals` item → validate fails (Zod).
- `market-size-gap-required` (empty `market_size_signals` AND no `source_gaps` for `market_size`) → sanity-check fails. (Already implemented.)
- `tam-context-caveat` → setting a parent-market signal to `label: 'sam'` or stripping the parent caveat → sanity-check fails. (Already implemented.)
- `scaffold-output-rejected` → scaffold seed output (placeholder summary, placeholder company) → sanity-check fails without `ALLOW_SUSPECT=1`. (Already implemented.)
- `placeholder-rejection` → `unknown`/`TBD`/`n/a`/scaffold text → sanity-check fails. (Already implemented.)
- `no-outside-imports` → adding `import x from "../../../research-worker/foo"` anywhere under `skills/research-market/` → sanity-check fails. (NEW, you implement this.)

## Verification (run before declaring done)

```bash
cd /Users/ammar/Dev-Projects/AI-GOS-main/skills/research-market
npm install
npm run check
npm run validate
npm run sanity-check example/output.json
```

All four must exit 0 with no `ALLOW_SUSPECT` bypass.

Then run the new conformance probes:

```bash
# 1. ingest_identity now required in input
node -e "const x=require('./example/input.json');delete x.priorOutputs.ingest_identity;require('fs').writeFileSync('/tmp/market-bad-input.json',JSON.stringify(x))"
# (input schema isn't directly invoked via npm; instead run a one-liner that imports schemas/input.ts and parses /tmp/market-bad-input.json — Codex, write a tiny script if needed and clean up after)

# 2. stage literal
node -e "const x=require('./example/output.json');x.stage='wrong';require('fs').writeFileSync('/tmp/market-bad.json',JSON.stringify(x))" && npm run validate /tmp/market-bad.json && echo "FAIL" || echo "ok"

# 3. no-outside-imports check fires when an import is added
# Temporarily inject a forbidden import line into a temp file under skills/research-market/scripts/, run sanity-check, then revert.
echo 'import x from "../../research-worker/foo";' > skills/research-market/scripts/_probe.ts
npm run sanity-check example/output.json && echo "FAIL: forbidden import not caught" || echo "ok: forbidden import caught"
rm skills/research-market/scripts/_probe.ts
# Re-confirm clean
npm run sanity-check example/output.json
```

If you do not want to run the dynamic input probe, ensure the schema's strictness is checked at TypeScript level via `npm run check` and write a one-line note in your final report.

## Hard constraints

- Self-contained. No imports from `src/`, `research-worker/`, root `lib/`, or another skill.
- Do NOT remove legacy projection fields. Downstream consumers may still expect them.
- Do NOT add `screenshot.ts`, new render assets, or new heavy infra in Wave 1.
- Do NOT shrink the existing rich schema.
- Do NOT touch any file outside `skills/research-market/`. (You may READ outside; do not WRITE outside.)
- Existing scaffold output must keep failing sanity-check without `ALLOW_SUSPECT=1`.

## Final report

1. Files created/modified (with line counts).
2. `npm run check` output.
3. `npm run validate example/output.json` output.
4. `npm run sanity-check example/output.json` output.
5. Conformance probe outputs (stage literal, no-outside-imports).
6. Any spec deviations with one-sentence justification.

Begin.
