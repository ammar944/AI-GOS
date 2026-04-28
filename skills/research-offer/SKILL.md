---
name: research-offer
description: Produce a sourced offer diagnostic for a locked GTM brief, including offer path, value props, proof, pricing signals, packaging notes, public objections, and source gaps.
version: 1.0.0
---

# Section 04 - Offer Funnel Research

## Trigger

`@research-offer { "run_id": "...", "brief_snapshot_id": "...", ... }`

Use this skill when a locked GTM brief needs the `research-offer-funnel` stage completed.

Invoke when the user asks for offer, funnel, pricing, packaging, CTA, first-value moment, activation, proof, or public-objection research for the canonical company after `ingest-identity` has resolved the company.

Do not use this skill to:

- Resolve company identity.
- Size a market or evaluate category maturity.
- Build a competitor landscape from scratch.
- Mine broad category Voice of Customer.
- Analyze client ad creatives.
- Generate recommendations, scores, launch verdicts, ad copy, headlines, scripts, or guarantees.

## What It Does

Takes a sealed payload matching `schemas/input.ts` and returns a strict JSON object matching `schemas/output.ts`. The output is a sourced public-offer diagnostic for one company: what the company promises, what public CTAs exist, how a buyer reaches first value, what activation friction is visible, what value props and proof assets are public, what pricing and packaging can be verified, what public objections appear, and what source gaps remain.

This is a collection skill, not a strategy skill. Every factual item carries `source_url` and `retrieved_at`. Unsupported facts are omitted and, when relevant to the contract, recorded in `source_gaps`.

The runtime stage is always:

```text
research-offer-funnel
```

## Design Rules

1. Facts only - no recommendations, scores, advice, generated copy, counter-positioning, or launch verdicts.
2. Use `ingest_identity` as the identity boundary. Do not widen or reinterpret the company after collection starts.
3. First-party sources come first for offer path, value props, proof, pricing, packaging, CTA, first-value, and activation evidence.
4. Public review/community sources are allowed only for subject-company objections.
5. Brief fields are hints only. A brief-stated claim must still be verified from a public artifact before it appears in output.
6. If a fact cannot be publicly verified, omit it. Do not fill with `unknown`, `TBD`, `n/a`, empty strings, or scaffold text.
7. Agent collects and writes JSON. TypeScript validates and sanity-checks. No TypeScript script performs web research.

## Architecture

```text
skills/research-offer/
  schemas/
    input.ts           # Zod input contract: locked GTM brief + ingest_identity + optional research_market
    output.ts          # Zod output contract: sourced offer diagnostic
  references/
    collector.md       # Main Claude Code collection prompt
    rules.md           # Runtime constraints and source rules
  scripts/
    validate.ts        # Zod schema gate for example/input.json, example/output.json, or a supplied output
    sanity-check.ts    # Deterministic checks: pricing gap, placeholders, no outside imports
  example/
    input.json         # Linear fixture payload
    output.json        # Fully populated valid output fixture
  package.json
  tsconfig.json
  README.md
  SKILL.md
```

## Runtime Topology

```text
Claude Code slash command
  |
  | 1. Read SKILL.md, references/collector.md, references/rules.md.
  | 2. Parse the sealed payload against schemas/input.ts.
  | 3. Collect public evidence with native web/browser tools.
  | 4. Write <run_dir>/output.json matching schemas/output.ts.
  v
Deterministic tail inside skills/research-offer/
  |
  | npm run check
  | npm run validate -- <run_dir>/output.json
  | npm run sanity-check <run_dir>/output.json
  v
Validated research-offer-funnel JSON
```

Recommended run directory:

```text
/tmp/research-offer-<run_id>/
```

Required artifact:

```text
<run_dir>/output.json
```

There is no report renderer in this skill. The deliverable is the validated JSON artifact.

## Input Contract

The input is a sealed JSON payload matching `schemas/input.ts`:

```json
{
  "run_id": "...",
  "brief_snapshot_id": "...",
  "locked_gtm_brief": {
    "briefId": "...",
    "fields": {
      "companyName": { "value": "...", "status": "confirmed", "confidence": "high", "sources": [], "updatedBy": "user", "updatedAt": "..." },
      "companyUrl": { "value": "...", "status": "confirmed", "confidence": "high", "sources": [], "updatedBy": "user", "updatedAt": "..." },
      "category": { "value": "...", "status": "confirmed", "confidence": "high", "sources": [], "updatedBy": "user", "updatedAt": "..." }
    }
  },
  "ingest_identity": {
    "stage": "ingest-identity",
    "company_name": "...",
    "canonical_domain": "...",
    "category": "...",
    "core_keywords": [],
    "negative_keywords": [],
    "generated_at": "..."
  },
  "research_market": {
    "stage": "research-market-category",
    "category": "...",
    "generated_at": "..."
  }
}
```

`locked_gtm_brief.fields` may contain offer hints such as `corePromise`, `firstValueMoment`, `activationEvent`, `cta`, `packaging`, `pricingModel`, `pricingTiers`, `targetPlan`, `useCases`, `coreDeliverables`, `retentionDrivers`, `conversionPath`, `salesMotion`, `testimonials`, `caseStudies`, `logos`, `metrics`, `claims`, and `commonObjections`.

Use those fields to guide collection. Do not copy them into output unless a public source verifies them.

## Collection Plan

### Phase 0 - Establish Run Boundary

1. Parse the input payload against `schemas/input.ts`.
2. Create `<run_dir>` under `/tmp/research-offer-<run_id>/`.
3. Set `company_name`, `category`, and canonical domain from `ingest_identity`.
4. Check `ingest_identity.negative_keywords` before every broader search.
5. Normalize the canonical domain for source planning, but preserve full source URLs in output.
6. Record the collection timestamp as ISO datetime for each `retrieved_at` value.

If identity is ambiguous, stop and report the ambiguity. Do not resolve identity inside this skill.

### Phase 1 - First-Party Source Sweep

Inspect the canonical domain before any broad third-party search. Prioritize:

- Homepage and main product pages.
- Pricing, plans, billing, subscriptions, sales, enterprise, or packaging pages.
- Docs, help center, getting-started guides, onboarding docs, import/migration docs, integrations docs, and security/admin docs.
- Customer stories, case studies, customers index, logo pages, outcomes pages, and testimonials.
- Changelog, launch posts, feature pages, templates, marketplace, or examples pages when they clarify first value or packaging.

Write a source ledger while collecting. For each usable page, capture:

- URL.
- Retrieval timestamp.
- What output fields it can support.
- Whether it is first-party, review/community, or other third-party.

### Phase 2 - Offer Path

Populate `offer_path` with four arrays:

- `promise`: public positioning or core promise claims.
- `cta`: public calls to action, such as "Get started", "Try", "Start free", "Book demo", "Contact sales", "Download", or "Open app".
- `first_value_path`: public evidence for how a user or buyer reaches a useful outcome after entry.
- `activation_friction`: public evidence of setup, import, migration, integration, configuration, admin, seat, security, workflow, or data requirements.

Use first-party sources wherever possible. Docs and help pages are usually better than marketing pages for first-value and activation-friction claims.

Each item must be:

```json
{
  "claim": "Concise sourced fact.",
  "source_url": "https://...",
  "retrieved_at": "2026-04-28T00:00:00.000Z"
}
```

If first-value or activation evidence cannot be found, leave the relevant array empty and add a `source_gaps` entry with `topic: "activation"`.

### Phase 3 - Value Props

Collect public value propositions from first-party pages. Prefer claims that describe what the product helps the customer do, not generic adjectives.

Good sources:

- Homepage value blocks.
- Product pages.
- Feature pages.
- Use-case pages.
- Docs that describe concrete workflows.

Each item must include:

```json
{
  "label": "Short noun phrase",
  "value": "Factual sourced value proposition.",
  "source_url": "https://...",
  "retrieved_at": "2026-04-28T00:00:00.000Z"
}
```

Target 3-6 value props when available. Fewer is acceptable if public evidence is limited and the gap is recorded under the closest valid topic.

### Phase 4 - Proof Assets

Collect public proof assets tied to the subject company:

- Customer logos.
- Customer-story facts.
- Named case studies.
- Public metrics.
- Testimonials.
- Public launch/customer quotes if they are verifiable.

Do not invent metrics or infer outcomes. If a customer page says "used by X", capture that exact fact. If it says "reduced time by 52%", capture the metric with the source.

If no public proof can be verified, set `proof_assets: []` and add a `source_gaps` entry with `topic: "proof"`.

### Phase 5 - Pricing Signals

Search first-party pricing sources before any other source:

1. Visit likely paths: `/pricing`, `/plans`, `/billing`, `/enterprise`, `/sales`, `/contact-sales`, `/docs/billing`, and help-center pricing pages.
2. Search the canonical domain for pricing, plan, billing, subscription, seat, usage, add-on, enterprise, and annual billing terms.
3. Capture exact public price text, plan names, billing periods, caveats, usage limits, and "Contact sales" signals.

Each pricing item must include:

```json
{
  "plan_name": "Business",
  "price_text": "$16 per user/month",
  "billing_period": "Billed yearly",
  "caveats": ["Concise sourced caveat."],
  "source_url": "https://...",
  "retrieved_at": "2026-04-28T00:00:00.000Z"
}
```

If verified pricing is unavailable:

- Set `pricing_signals: []`.
- Add a `source_gaps` entry with `topic: "pricing"`.
- In `attempted_sources`, include the exact URLs or search queries you attempted.

Do not infer pricing from category norms, old memory, marketplace listings, screenshots without a URL, or model knowledge.

### Phase 6 - Packaging Notes

Capture public facts about:

- Free tier.
- Self-serve plans.
- Enterprise plans.
- Seat-based, usage-based, credit-based, workspace-based, or contact-sales billing.
- Plan limits.
- Add-ons.
- Included integrations.
- Security/admin gates.
- Trial structure.
- Migration, onboarding, or implementation support.

Each note uses `claim`, `source_url`, and `retrieved_at`.

If packaging cannot be verified, set `packaging_notes: []` and add `source_gaps` with `topic: "packaging"`.

### Phase 7 - Public Objections

Use public review or community pages only after first-party collection is complete. Keep objections tied to the subject company, not the category.

Allowed sources:

- G2, Capterra, TrustRadius, Product Hunt, App Store, Chrome Web Store, GitHub issues, official forums, public community threads, public docs comments, or public support/community pages.

Allowed `evidence_type` values:

- `pricing`
- `proof`
- `clarity`
- `implementation`
- `risk`
- `alternative`

Each objection must include:

```json
{
  "objection": "Concise sourced public objection.",
  "evidence_type": "implementation",
  "source_url": "https://...",
  "retrieved_at": "2026-04-28T00:00:00.000Z"
}
```

Do not scrape broad category Voice of Customer. Do not analyze competitors. If no subject-company objections can be verified, set `public_objections: []` and add a `source_gaps` entry with `topic: "objections"`.

### Phase 8 - Source Gaps

Use `source_gaps` when a contract-relevant topic cannot be verified after reasonable collection.

Valid topics are exactly:

- `pricing`
- `proof`
- `activation`
- `objections`
- `packaging`

Each gap must include:

```json
{
  "topic": "pricing",
  "reason": "No first-party pricing, plans, billing, or public review pricing page could be verified.",
  "attempted_sources": [
    "https://example.com/pricing",
    "site:example.com pricing plans billing"
  ]
}
```

Never use gaps for fields outside the schema enum. Map missing CTA, first-value, setup, import, migration, or onboarding evidence to `activation`.

## Output Contract

Write a strict JSON object matching `schemas/output.ts`:

- `run_id`
- `brief_snapshot_id`
- `stage: "research-offer-funnel"`
- `company_name`
- `offer_name` when publicly supported
- `category`
- `offer_path`
- `value_props`
- `proof_assets`
- `pricing_signals`
- `packaging_notes`
- `public_objections`
- `source_gaps`
- `generated_at`

Strict means:

- No extra keys.
- No comments.
- No markdown fences in the JSON artifact.
- Valid URL strings in every `source_url`.
- ISO datetime strings in every `retrieved_at` and `generated_at`.
- Arrays may be empty only when the corresponding fact class could not be verified and the relevant source gap is recorded when required by rules.

## Critical Rules Enforced by Scripts

1. If `pricing_signals` is empty, `source_gaps` must include a `topic: "pricing"` entry.
2. Placeholder text is rejected in output fields.
3. TypeScript files must not import from outside `skills/research-offer/`.
4. The output must pass the Zod schema exactly.

## Invoking

Inside Claude Code:

```text
@research-offer /path/to/input.json
```

The agent reads this file, `references/collector.md`, and `references/rules.md`, uses native web/browser tools to gather evidence, writes `<run_dir>/output.json`, and runs the deterministic tail.

Standalone validation:

```bash
cd skills/research-offer
npm install
npm run check
npm run validate
npm run sanity-check example/output.json
```

Validate an active run output:

```bash
cd skills/research-offer
npm run check
npm run validate -- /tmp/research-offer-<run_id>/output.json
npm run sanity-check /tmp/research-offer-<run_id>/output.json
```

## Verification Gate

Before declaring done:

1. `npm run check` exits 0.
2. `npm run validate -- <output.json>` exits 0 for the active output.
3. `npm run sanity-check <output.json>` exits 0.
4. Every factual item has `source_url` and `retrieved_at`.
5. Missing pricing has an explicit `source_gaps` pricing entry.
6. Zero scores, zero recommendations, zero generated copy, zero client ad creative analysis.
7. The folder remains self-contained: no imports from `src/`, `research-worker/`, root `lib/`, or another skill.
