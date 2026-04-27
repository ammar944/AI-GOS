# Collector Instructions - ingest-url

Collect only facts visible on the company website or user-supplied LinkedIn company URL.

## Required source shape

Every collected value must carry:

- `value`
- `source_url`
- `retrieved_at`

Use ISO datetime strings for `retrieved_at`.

## Field mapping

Map collected website facts to current GTM brief keys:

- Company name -> `companyName`
- Website URL -> `companyUrl`
- Category or vertical -> `category` or `industryVertical`
- Product description -> `productDescription`
- Target audience -> `targetCustomer`
- Main promise or hero value statement -> `corePromise`
- Features, deliverables, services, or product modules -> `coreDeliverables`
- Pricing model -> `pricingModel`
- Pricing page details -> `pricingTiers`
- Signup, demo, contact-sales, or checkout path -> `conversionPath`
- Self-serve, sales-led, or mixed buying path -> `salesMotion`
- ICP description -> `primaryIcpDescription`
- Differentiation claimed by the company -> `uniqueEdge`
- Positioning statement -> `brandPositioning`
- Case-study page URL -> `caseStudies`
- Testimonials or customer proof page URL -> `testimonials`

## Do not collect

- Hidden pricing.
- Competitor names unless the company itself names them on a sourced page.
- Market size, TAM, growth rates, or third-party benchmarks.
- ACV unless the company publishes enough pricing detail to support it.
- Any field with placeholder text or missing source evidence.
