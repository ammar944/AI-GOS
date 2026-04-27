# ingest-docs Rules

## Extraction rules

- Extract only values explicitly present in the parsed document text.
- Treat the uploaded document as the source of record for every extracted value.
- Every extracted field must include `source_url`, `retrieved_at`, and `source_document_ids`.
- Empty arrays are valid when a document does not contain a requested value.
- Placeholder values are invalid: `unknown`, `TBD`, `n/a`, `not found`, scaffold text, and empty strings.
- Do not infer missing values from company name, category, or common industry knowledge.
- Preserve conflicts when different documents state different values for the same field.
- Do not write parsed text, extracted fields, or metadata to any external store.

## Supported local fixture formats

- `text/plain`
- `text/markdown`

PDF and DOCX payloads are accepted by schema so production callers can route them, but this local self-contained implementation fails with explicit parser dependency errors unless the caller supplies text as TXT or Markdown.

## Field mapping

Map document labels to GTM brief field keys:

- Company, Company Name, Business Name -> `companyName`
- Website, Website URL, Company URL -> `companyUrl`
- Category, Market Category, Vertical -> `category`
- Product, Product Description, What We Do -> `productDescription`
- Primary ICP, Ideal Customer, ICP, Target Customer -> `primaryIcpDescription`
- Job Titles, Target Job Titles, Buyers -> `jobTitles`
- Company Size, Target Company Size, Employee Range -> `companySize`
- Geography, Region, Target Region -> `geography`
- Buying Triggers, Trigger Events, Purchase Triggers -> `buyingTriggers`
- Systems, Platforms, Tools Used -> `systemsPlatforms`
- Deliverables, Features, Core Deliverables -> `coreDeliverables`
- Pricing, Pricing Tiers, Price, Packages -> `pricingTiers`
- Pricing Model, Billing Model -> `pricingModel`
- Value Proposition, Value Prop, Core Promise -> `valueProp`
- Guarantee, Guarantees, Risk Reversal -> `guarantees`
- Funnel, Current Funnel, Conversion Path -> `currentFunnelType`
- Competitors, Top Competitors, Alternatives -> `topCompetitors`
- Unique Edge, Differentiator, Differentiation -> `uniqueEdge`
- Competitor Frustrations, Frustrations With Competitors -> `competitorFrustrations`
- Market Bottlenecks, Market Problems, Bottlenecks -> `marketBottlenecks`
- Proprietary Technology, Proprietary Tech, IP -> `proprietaryTech`
- Before Buying, Current Pain, Situation Before Buying -> `situationBeforeBuying`
- Desired Transformation, Desired Outcome, After State -> `desiredTransformation`
- Objections, Common Objections -> `commonObjections`
- Sales Cycle, Sales Cycle Length -> `salesCycleLength`
- Sales Process, Sales Process Overview -> `salesProcessOverview`
- Positioning, Brand Positioning -> `brandPositioning`
- Customer Voice, Voice of Customer, Testimonials -> `customerVoice`
- Monthly Ad Budget, Ad Budget, Media Budget -> `monthlyAdBudget`
- Daily Budget, Daily Budget Ceiling -> `dailyBudgetCeiling`
- Campaign Duration, Duration -> `campaignDuration`
- Target CPL, CPL -> `targetCpl`
- Target CAC, CAC -> `targetCac`
- Target SQLs, SQLs Per Month -> `targetSqlsPerMonth`
- Target Demos, Demos Per Month -> `targetDemosPerMonth`
- Topics To Avoid, Avoid Topics -> `topicsToAvoid`
- Claim Restrictions, Compliance, Restricted Claims -> `claimRestrictions`
