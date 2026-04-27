---
name: research-offer
description: Produce a sourced offer diagnostic for a locked GTM brief, including offer path, value props, proof, pricing signals, packaging notes, public objections, and source gaps.
version: 1.0.0
---

# research-offer

## Trigger

Use this skill when a locked GTM brief needs the `research-offer-funnel` stage completed.

Invoke when the user asks for offer, funnel, pricing, packaging, first-value, activation, proof, CTA, or public-objection research for the canonical company after `ingest-identity` has resolved the company.

Do not use this skill to:

- Resolve company identity.
- Size a market or evaluate category maturity.
- Research competitors from scratch.
- Mine broad category Voice of Customer.
- Analyze client ad creatives.
- Generate ad copy, headlines, scripts, guarantees, scores, recommendations, or launch verdicts.

## What It Does

This skill collects and structures externally verifiable facts about the subject company's public offer. It validates whether each claim is sourced with `source_url` and `retrieved_at`, records pricing gaps when pricing cannot be verified, and emits a strict JSON object for downstream GTM synthesis stages.

The runtime stage is always:

```text
research-offer-funnel
```

## Workflow

1. Parse the locked brief with `schemas/input.ts`.
2. Use `ingest_identity` as the identity boundary:
   - canonical company name
   - canonical domain
   - category
   - core keywords
   - negative keywords
3. Check first-party pages before broader search:
   - pricing page
   - homepage or product page
   - docs or help pages
   - customer story pages
   - changelog or launch pages
4. Collect one set of facts per output section:
   - `offer_path`
   - `value_props`
   - `proof_assets`
   - `pricing_signals`
   - `packaging_notes`
   - `public_objections`
   - `source_gaps`
5. Write only externally verified facts into `example/output.json` or the active run output.
6. Run:

```bash
npm run check
npm run validate
npm run sanity-check example/output.json
```

## Tools

- Web search for first-party pages, docs, customer stories, pricing pages, and public review pages.
- Browser inspection or page fetch tools for source verification when available.
- `npm run validate` for Zod validation.
- `npm run sanity-check <output.json>` for deterministic conformance checks.

## Hard Constraints

- Self-contained skill: no imports from `src/`, `research-worker/`, root `lib/`, or another skill.
- Duplicate only the primitives needed for this skill.
- Facts only.
- No scores, ICE ranking, action plans, generated copy, recommendations, or launch verdicts.
- Every pricing, value, proof, CTA, activation, packaging, and objection claim must include `source_url` and `retrieved_at`.
- First-party pages are preferred for offer, pricing, CTA, proof, and packaging claims.
- Brief-stated value or pricing may guide collection, but it must still be cited from a public artifact before output.
- If verified pricing is unavailable, set `pricing_signals: []` and add a `source_gaps[]` entry with `topic: "pricing"`.
- Respect `ingest_identity.negative_keywords`; omit unrelated entities that share the same name.
- Do not analyze client ad creatives.
- Empty arrays are allowed when the corresponding evidence cannot be verified and the gap is recorded.
- Placeholder values such as `unknown`, `TBD`, `n/a`, empty strings, and scaffold text are invalid.

## Output

The output is a strict JSON object matching `schemas/output.ts`:

- `run_id`
- `brief_snapshot_id`
- `stage: "research-offer-funnel"`
- `company_name`
- `offer_name`
- `category`
- `offer_path`
- `value_props`
- `proof_assets`
- `pricing_signals`
- `packaging_notes`
- `public_objections`
- `source_gaps`
- `generated_at`

Downstream consumers are `research-cross`, `synthesize-positioning`, `synthesize-media-plan`, `synthesize-scripts`, and `present-workspace`.
