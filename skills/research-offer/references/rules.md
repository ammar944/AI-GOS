# research-offer Rules

These rules are non-negotiable for `research-offer-funnel`.

## Collection Order

1. Use `ingest_identity` to set the identity boundary before collection.
2. Respect `ingest_identity.negative_keywords`; do not include unrelated entities sharing the same name.
3. Search first-party pricing pages before broader search.
4. If no explicit pricing URL is present, search the canonical domain for pricing, billing, plans, docs, and help-center pricing pages before using third-party sources.
5. Use broader search only after first-party pricing collection has been attempted.

## Public Artifact Requirement

- Brief-stated value props, pricing, target plan, CTA, activation event, first-value moment, proof, and packaging are hints only.
- A brief-stated fact must still be cited from a public artifact before it appears in output.
- If the public artifact cannot verify the fact, omit the fact or add a matching `source_gaps[]` entry.

## Source Rules

- Every factual item must include `source_url` and `retrieved_at`.
- Prefer first-party pages for offer path, pricing, CTA, proof, and packaging.
- Public review pages may support `public_objections`.
- Public docs, product pages, changelogs, help pages, customer stories, pricing pages, and review pages are valid sources.
- Do not use private notes, unverified memory, or model knowledge as sources.
- The top-level `source_gaps` array is required and must contain at least one valid entry.

## Pricing Rules

- Verified pricing means pricing observed in a public source.
- Never infer pricing from category norms or model knowledge.
- If verified pricing is unavailable, output `pricing_signals: []`.
- If `pricing_signals` is empty, `source_gaps` must include `{ "topic": "pricing", ... }`.

## Boundary Rules

- Do not analyze client ad creatives.
- Do not research competitors from scratch.
- Do not score, rank, recommend, write copy, generate headlines, or issue launch verdicts.
- Do not output placeholders such as `unknown`, `TBD`, `n/a`, empty strings, or scaffold text.
- Do not import from `src/`, `research-worker/`, root `lib/`, or another skill.

## Funnel-Stage Rules

- `promise`: homepage, product, category, or use-case page.
- `cta`: visible signup, demo, sales, contact, download, checkout, or install action.
- `first_value_path`: docs, onboarding, template, integration, or workflow evidence.
- `activation_friction`: migration, import, permissions, security, admin, billing, or setup evidence.
- `proof_assets`: customer story, testimonial, logo proof, named outcome, or public metric.
- `pricing_signals`: first-party pricing preferred; third-party only after first-party attempt.

Brief hints do not satisfy any stage without public evidence.
