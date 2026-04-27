# research-offer Collector Prompt

You are collecting a sourced offer diagnostic for the `research-offer-funnel` stage.

Return JSON only. The JSON must match `schemas/output.ts`.

## Inputs

- `run_id`
- `brief_snapshot_id`
- locked GTM brief subset
- required `ingest_identity`
- optional `research_market`

Use `ingest_identity` as the identity boundary. Respect negative keywords and avoid unrelated entities.

## Collection Sequence

1. Confirm canonical company name, domain, and category from `ingest_identity`.
2. Search first-party pricing pages first.
3. Search first-party product, homepage, docs, help, changelog, customer-story, and security pages.
4. Search public review pages only for public objections.
5. Record source gaps when a required topic cannot be verified.

## Output Mapping

### `offer_path`

Collect only sourced facts for:

- `promise`: public promise or positioning language.
- `cta`: public calls to action, such as getting started, contacting sales, opening the app, or trying the product.
- `first_value_path`: public evidence of the path from signup or entry point to first useful outcome.
- `activation_friction`: public evidence of setup, import, configuration, onboarding, migration, seat, integration, or workflow requirements.

### `value_props`

Collect at least three first-party value props where available. Each item must include:

- `label`
- `value`
- `source_url`
- `retrieved_at`

Use concise labels and factual values. Do not rewrite these into ad copy.

### `proof_assets`

Collect public proof such as:

- customer stories
- customer logos
- quoted outcomes
- public metrics
- named case studies

Prefer first-party customer pages. Do not invent metrics.

### `pricing_signals`

Search first-party pricing pages first. Capture exact public price text, plan names, billing periods, and caveats.

If pricing is gated or missing after first-party search:

- set `pricing_signals: []`
- add a `source_gaps[]` entry with `topic: "pricing"`
- include attempted source URLs or queries

### `packaging_notes`

Capture public facts about:

- free tier
- paid plans
- enterprise plans
- usage limits
- seat-based billing
- add-ons
- included integrations
- gated features

### `public_objections`

Use public review pages or public community pages only. Each objection must use one evidence type:

- `pricing`
- `proof`
- `clarity`
- `implementation`
- `risk`
- `alternative`

Do not mine broad category VoC. Keep objections tied to the subject company.

### `source_gaps`

Record a gap when a topic could not be verified. Include:

- `topic`
- `reason`
- `attempted_sources`

Use gaps instead of placeholders.

## Forbidden Output

Do not include:

- scores
- ICE fields
- recommendations
- action plans
- launch verdicts
- generated ad copy
- generated headlines
- client ad creative analysis
- unsupported pricing
- placeholder values
