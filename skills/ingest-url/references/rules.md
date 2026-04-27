# Rules - ingest-url

## Hard constraints

- Every factual output value has `source_url` and `retrieved_at`.
- Empty arrays are allowed when a field or page cannot be sourced.
- Do not emit placeholder values: `unknown`, `TBD`, `n/a`, `not found`, or `scaffold`.
- Do not emit legacy field keys such as `websiteUrl`, `valueProp`, or `headquartersLocation`.
- Do not write Supabase rows, Journey session rows, UI cards, reports, screenshots, or markdown summaries.
- Do not import from outside `skills/ingest-url/`.
- Do not infer hidden pricing, ACV, competitors, or conversion path without source evidence.

## Discovery rules

- Normalize the base URL to origin only.
- Keep only same-origin public pages.
- Drop duplicate URLs after removing query strings, hashes, and trailing slashes.
- Drop asset URLs, login/auth/signup pages, legal/privacy/cookie pages, careers/jobs pages, blogs, news, press, and docs.
- Prefer homepage, pricing, product/features, customers/testimonials, case studies, about, demo/contact, then other public product pages.

## Field rules

- `companyName`, `companyUrl`, `productDescription`, `targetCustomer`, `corePromise`, `pricingModel`, `pricingTiers`, `conversionPath`, `salesMotion`, `industryVertical`, `primaryIcpDescription`, `coreDeliverables`, `uniqueEdge`, `brandPositioning`, `caseStudies`, and `testimonials` are valid prefill targets when sourced.
- Normalize legacy keys before output:
  - `websiteUrl` -> `companyUrl`
  - `valueProp` -> `corePromise`
  - `headquartersLocation` -> `hqLocation`
- Unknown legacy keys must be omitted and listed in `unresolved_fields` when relevant.
