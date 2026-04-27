# Codex Wave 1 Implementation — research-offer

You are implementing the `research-offer` skill in the AIGOS v3 migration. Wave 0 wrote a contract; you write the code that satisfies the contract.

## Authoritative spec

Read this entire file before doing anything else:

- `/Users/ammar/Dev-Projects/AI-GOS-main/.claude/workspaces/v3-migration/specs/research-offer.md`
- Spec template: `/Users/ammar/Dev-Projects/AI-GOS-main/.claude/workspaces/v3-migration/SPEC_TEMPLATE.md`

## Reference implementation

Use as structural template only — DO NOT import from it.

- `/Users/ammar/Dev-Projects/AI-GOS-main/skills/research-competitor/`
  - `package.json`, `tsconfig.json`, `SKILL.md`, `schemas/{input,output}.ts`, `scripts/{validate,sanity-check}.ts`

## Current skill state

`skills/research-offer/` is a stub. Existing files:

- `SKILL.md` — placeholder, REWRITE
- `package.json`, `tsconfig.json` — keep, parity with reference
- `references/rules.md` — placeholder, REWRITE
- `references/TODO.md`, `example/TODO.md`, `scripts/TODO.md`, `assets/TODO.md` — DELETE

## Upstream context (read but do not import)

- `/Users/ammar/Dev-Projects/AI-GOS-main/research-worker/src/runners/offer.ts`
- `/Users/ammar/Dev-Projects/AI-GOS-main/research-worker/src/prompts/runners/offer-system.md`
- `/Users/ammar/Dev-Projects/AI-GOS-main/research-worker/src/contracts.ts`
- `/Users/ammar/Dev-Projects/AI-GOS-main/research-worker/src/schemas/gtm/research-sections.ts`
- `/Users/ammar/Dev-Projects/AI-GOS-main/research-worker/src/schemas/gtm/gtm-brief.ts`
- `/Users/ammar/Dev-Projects/AI-GOS-main/research-worker/src/schemas/gtm/gtm-run.ts` — for `research-offer-funnel` stage key

## Files to deliver (in skills/research-offer/)

1. `SKILL.md` — replace stub. Frontmatter, Trigger, What it does, Workflow, Tools, Hard constraints, Output. Under 500 lines.
2. `README.md` — concise.
3. `package.json` — add `@types/node` if missing. Same script names as reference.
4. `tsconfig.json` — match reference.
5. `schemas/input.ts` — sealed: `run_id`, `brief_snapshot_id`, locked `GtmBrief` (offer-relevant subset minimum), required `ingest_identity` prior output, optional `research_market` prior output. Duplicate primitives locally.
6. `schemas/output.ts` — implement `researchOfferOutputSchema` exactly as sketched in the spec:
   - `sourceSchema` + `sourcedClaimSchema` + `sourcedValueSchema` + `pricingSignalSchema` + `offerPathSchema` + `publicObjectionSchema`
   - Top-level: `run_id`, `brief_snapshot_id`, `stage: z.literal('research-offer-funnel')`, `company_name`, `category`, `offer_path`, `value_props`, `proof_assets`, `pricing_signals`, `packaging_notes`, `public_objections`, `source_gaps`, `generated_at`
   - No score, no ICE, no copy/headlines, no recommendations.
7. `scripts/validate.ts` — Zod gate. Pattern from reference.
8. `scripts/sanity-check.ts` — implement spec CONFORMANCE TESTS:
   - `missing-source-url`, `missing-retrieved-at` (Zod catches; reassert if helpful)
   - `pricing-gap-required` — if `pricing_signals` is empty AND no `source_gaps[]` entry has `topic === 'pricing'`, fail.
   - `no-score-fields` — Zod's `.strict()` or unknown-key rejection should kill `overallScore`/`painRelevance`/`iceScore`. Make the schema strict enough.
   - `no-generated-copy` — same: extra fields like `generatedOfferStatements` or ad headline fields rejected.
   - `placeholder-rejection` — `unknown`, `TBD`, `n/a`, empty, scaffold/placeholder text in any sourced claim → fail.
   - `no-outside-imports` — scan `skills/research-offer/**/*.ts` for `../..`, `@/`, `src/`, `research-worker/`, other `skills/`. Fail if any.
   - `ALLOW_SUSPECT=1` override.
9. `references/rules.md` — non-negotiable rules. First-party pricing collection precedes broader search. Brief-stated value/pricing must still be cited from a public artifact before output. Respect `ingest-identity` negative keywords.
10. `references/collector.md` — runtime prompt. Each section maps to one output key. Cover offer_path (promise/cta/first-value/activation friction), value_props, proof_assets (case studies, logos, metrics), pricing_signals (first-party page first), packaging_notes, public_objections, source_gaps recording.
11. `example/input.json` — realistic input. Use a SaaS with a public pricing page (e.g., Linear, Notion, Figma).
12. `example/output.json` — fully populated. Every claim sourced. ≥3 value props, ≥2 proof assets, ≥1 pricing signal (or empty array + matching `source_gaps` entry for `pricing`), ≥3 public objections, full `offer_path` block. Real URLs, ISO timestamps.

DELETE the four `TODO.md` files in `references/`, `example/`, `scripts/`, `assets/`.

## Hard constraints

- Self-contained. No imports from `src/`, `research-worker/`, root `lib/`, or another skill.
- Duplicate only required primitives.
- Facts only. No scores, no ICE, no action plans, no copy generation, no launch verdict.
- Pricing/value/proof/CTA/activation/packaging/objections require `source_url` + `retrieved_at`.
- First-party pages preferred for offer/pricing/CTA/proof/packaging.
- If verified pricing unavailable: `pricing_signals: []` + `source_gaps[]` entry with `topic: 'pricing'`.
- Do NOT analyze client ad creatives — that belongs in `research-competitor`.
- Respect `ingest-identity` negative keywords; do not include unrelated entities.

## Verification

```bash
cd /Users/ammar/Dev-Projects/AI-GOS-main/skills/research-offer
npm install
npm run check
npm run validate
npm run sanity-check example/output.json
```

All four exit 0, no `ALLOW_SUSPECT` bypass.

Conformance probes:

```bash
# 1. missing source_url
node -e "const x=require('./example/output.json');delete x.value_props[0].source_url;require('fs').writeFileSync('/tmp/offer-bad.json',JSON.stringify(x))" && npm run validate /tmp/offer-bad.json && echo "FAIL" || echo "ok"
# 2. pricing gap missing
node -e "const x=require('./example/output.json');x.pricing_signals=[];x.source_gaps=(x.source_gaps||[]).filter(g=>g.topic!=='pricing');require('fs').writeFileSync('/tmp/offer-bad.json',JSON.stringify(x))" && npm run sanity-check /tmp/offer-bad.json && echo "FAIL" || echo "ok"
# 3. score field present
node -e "const x=require('./example/output.json');x.overallScore=9;require('fs').writeFileSync('/tmp/offer-bad.json',JSON.stringify(x))" && npm run validate /tmp/offer-bad.json && echo "FAIL" || echo "ok"
# 4. placeholder
node -e "const x=require('./example/output.json');x.value_props[0].label='unknown';require('fs').writeFileSync('/tmp/offer-bad.json',JSON.stringify(x))" && npm run sanity-check /tmp/offer-bad.json && echo "FAIL" || echo "ok"
# Confirm clean fixture still passes
npm run sanity-check example/output.json
```

## Out of scope

- No `orchestrate.ts`, `merge-fragments.ts`, `generate-report.ts`, screenshot, ad fetching, report assets in Wave 1.
- No runtime wiring (`.claude/skills/...`, `.claude/commands/...` bridges untouched).
- No edits to legacy `research-worker/src/runners/offer.ts`.

## Final report

1. Files created/modified.
2. `npm run check`, `validate`, `sanity-check` outputs.
3. Conformance probe outputs.
4. Any spec deviations with one-sentence justification.

Begin.
