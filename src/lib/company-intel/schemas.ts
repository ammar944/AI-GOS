// Company Research Zod Schemas
// Used with Vercel AI SDK streamObject/generateObject for structured extraction
// CRITICAL: Every .describe() hint reinforces factual-only extraction — no hallucination
//
// Field names are aligned 1:1 with the journey's FIELD_LABELS (32 onboarding fields).
// 22 of 32 fields are extractable from a website; 10 are user-only (budget, goals, etc.).

import { z } from 'zod';

// =============================================================================
// Per-Field Schema: value + confidence + source attribution
// =============================================================================

/**
 * A single researched field with model-assessed confidence and source.
 * The AI must provide a sourceUrl for any field it populates.
 * Fields not found on the actual website/sources MUST be null.
 */
const researchedFieldSchema = z.object({
  value: z.string().nullable()
    .describe('The extracted value. MUST be null if not found in actual sources. NEVER guess, infer, or fabricate.'),

  confidence: z.number().min(0).max(100)
    .describe('Your confidence in this value: 90-100 = directly quoted/stated on the website or LinkedIn. 60-89 = clearly implied by content you read. 30-59 = partially found but some interpretation needed. 0-29 = very uncertain. If value is null, set to 0.'),

  sourceUrl: z.string().nullable()
    .describe('The specific URL where you found this information (e.g., "https://example.com/about", "https://linkedin.com/company/xyz"). MUST be null if value is null. Do NOT fabricate URLs.'),

  reasoning: z.string()
    .describe('One sentence explaining where/how you found this or why it is null. Be specific: "Found on the homepage hero section" or "Not mentioned anywhere on the website or LinkedIn".'),
}).describe('A single extracted field with provenance. null value = not found.');

// =============================================================================
// Company Research Output Schema — aligned with the journey's 32 onboarding fields
// 22 extractable fields + confidenceNotes + asset URLs
// =============================================================================

export const companyResearchSchema = z.object({
  // ── Business Basics (Phase 1) ─────────────────────────────────────────────
  companyName: researchedFieldSchema
    .describe('The official company name exactly as displayed on their website. Do NOT guess abbreviated or full names.'),

  businessModel: researchedFieldSchema
    .describe('Their business model: "B2B SaaS", "B2C / E-commerce", "Marketplace / Platform", "Agency / Services", or other. Infer from their website positioning, pricing model, and target audience.'),

  industryVertical: researchedFieldSchema
    .describe('The primary industry/vertical they operate in (e.g., "B2B SaaS Marketing", "Healthcare IT", "FinTech"). Only state what is clear from their website.'),

  // ── v3 Required Blockers (enum-typed — MUST match these exact values) ────
  targetCustomer: researchedFieldSchema
    .describe('One concise sentence describing WHO the product is built for — "Growth-stage B2B SaaS founders and marketing leads", "Enterprise security teams at Fortune 500 banks", etc. Extract from hero copy, "who it\'s for", case studies. Short one-liner. Different from primaryIcpDescription (longer detailed ICP).'),

  salesMotion: researchedFieldSchema
    .describe('HOW customers buy. Value MUST be EXACTLY one of: "product-led" | "sales-led" | "hybrid". Infer from: (a) "sales-led" if they require demos/talk-to-sales/enterprise contact forms with no public signup, (b) "product-led" if they have self-serve signup and public pricing, (c) "hybrid" if they offer both free self-serve AND paid tiers gated by sales. If unclear, best-guess with lower confidence. The value field MUST be exactly "product-led", "sales-led", or "hybrid" — never a description.'),

  pricingModel: researchedFieldSchema
    .describe('Pricing archetype. Value MUST be EXACTLY one of: "subscription" | "usage-based" | "per-seat" | "one-time-plus-subscription". Check pricing page: (a) "per-seat" if prices are per user/seat/license, (b) "usage-based" if billed by API calls/GB/events/credits/tokens, (c) "one-time-plus-subscription" if upfront fee + recurring, (d) "subscription" for flat monthly/annual. The value field MUST be exactly one of those 4 strings — never a description.'),

  conversionPath: researchedFieldSchema
    .describe('How prospects convert from visitor to paying customer. Value MUST be EXACTLY one of: "free-trial" | "freemium" | "demo-required" | "direct-checkout". Check: (a) "free-trial" if they offer time-limited trial (14-day/30-day), (b) "freemium" if there\'s a forever-free tier alongside paid, (c) "demo-required" if the primary CTA is "Book a Demo" / "Contact Sales" with no signup, (d) "direct-checkout" if they go straight from pricing to checkout (Stripe/signup). The value field MUST be exactly one of those 4 strings — never a description.'),

  avgAcv: researchedFieldSchema
    .describe('Average annual contract value / price tier. Value MUST be EXACTLY one of: "under-1k" | "1k-10k" | "10k-50k" | "50k-plus". Infer from pricing page lowest-paid-plan annualized: (a) "under-1k" if lowest paid plan < $1K/yr, (b) "1k-10k" if $1K-$10K/yr, (c) "10k-50k" if $10K-$50K/yr or "enterprise" with custom pricing for mid-market, (d) "50k-plus" if enterprise-only with 5-figure+ annual commits. If pricing is hidden (sales-led), infer from positioning and ICP. The value field MUST be exactly one of those 4 strings — never a price.'),

  // ── ICP — Ideal Customer Profile (Phase 2) ────────────────────────────────
  primaryIcpDescription: researchedFieldSchema
    .describe('Detailed description of who they sell to — industries, company types, personas, pain points they address. Extract from "who we serve", case studies, and marketing copy. Use their words.'),

  jobTitles: researchedFieldSchema
    .describe('Specific job titles they target (e.g., "CMOs", "Engineering Managers", "Founders"). Only if mentioned in their copy, case studies, or testimonials.'),

  companySize: researchedFieldSchema
    .describe('Employee count or range from LinkedIn or their website (e.g., "51-200 employees", "500+"). Use LinkedIn data if available.'),

  geography: researchedFieldSchema
    .describe('Geographic focus — where their customers are. Extract from site copy, case studies, footer. E.g., "US-only", "North America", "Global". null if not stated.'),

  headquartersLocation: researchedFieldSchema
    .describe('City and country of headquarters. Only from their website footer, about page, or LinkedIn.'),

  // ── Product & Offer (Phase 3) ─────────────────────────────────────────────
  productDescription: researchedFieldSchema
    .describe('What their product/service does — use THEIR words from the website, not your interpretation.'),

  coreDeliverables: researchedFieldSchema
    .describe('Main features, deliverables, or services they highlight on their features/product/services page. List only what they explicitly mention.'),

  pricingTiers: researchedFieldSchema
    .describe('Pricing information ONLY if publicly visible on their pricing page. Include plan names and prices. null if no public pricing.'),

  valueProp: researchedFieldSchema
    .describe('Their main value prop, tagline, or hero statement — quote directly from their homepage if possible.'),

  guarantees: researchedFieldSchema
    .describe('Any guarantees, warranties, SLAs, or risk-reversal promises on their site. E.g., "30-day money-back guarantee", "99.9% uptime SLA". null if none found.'),

  // ── Market & Competition (Phase 4) ────────────────────────────────────────
  topCompetitors: researchedFieldSchema
    .describe('Top 3-5 direct competitors — actively search the web to find companies offering similar products/services to the same target market. Use "[company] competitors" and "[company] alternatives" searches. Return as comma-separated names. Verify each is a real company in the same space. Do NOT fabricate names.'),

  uniqueEdge: researchedFieldSchema
    .describe('What they claim makes them different — use their own words from "why us", comparison, or about pages.'),

  marketProblem: researchedFieldSchema
    .describe('The problem they say they solve — from their homepage, about page, or marketing copy. Use their framing.'),

  // ── Customer Journey (Phase 5) ────────────────────────────────────────────
  situationBeforeBuying: researchedFieldSchema
    .describe('The "before" state of their customers — pain points, struggles, failed alternatives mentioned in case studies, testimonials, or marketing copy. null if not described.'),

  desiredTransformation: researchedFieldSchema
    .describe('The outcome/transformation they promise customers — from case studies, testimonials, or marketing copy.'),

  commonObjections: researchedFieldSchema
    .describe('Objections they address on their site (FAQ sections, "is this right for me" pages). null if no objection-handling content found.'),

  // ── Brand & Positioning (Phase 6) ─────────────────────────────────────────
  brandPositioning: researchedFieldSchema
    .describe('How they position themselves in the market — their brand identity statement or positioning from their about/homepage.'),

  testimonialQuote: researchedFieldSchema
    .describe('An actual customer testimonial quote found on their website. Must be a real quote with attribution if available. NEVER fabricate quotes.'),

  // ── Detected Asset URLs ───────────────────────────────────────────────────
  caseStudiesUrl: researchedFieldSchema
    .describe('URL to their case studies page if it exists. Must be a real URL you found by navigating their site. null if no case studies page.'),

  testimonialsUrl: researchedFieldSchema
    .describe('URL to their testimonials or reviews page if it exists. null if not found.'),

  pricingUrl: researchedFieldSchema
    .describe('URL to their pricing page if it exists. null if not found.'),

  demoUrl: researchedFieldSchema
    .describe('URL to their demo, free trial, or signup page if it exists. null if not found.'),

  // ── Overall Assessment ────────────────────────────────────────────────────
  confidenceNotes: z.string()
    .describe('2-3 sentence summary: what was easy to find vs. hard to find. Note any pages that were inaccessible or content-light. Be honest about gaps.'),

}).describe(
  'Company research extraction aligned with the 32-field onboarding schema. ' +
  'CRITICAL RULES: ' +
  '(1) ONLY return information you can verify from the actual website, LinkedIn page, or search results. ' +
  '(2) If you cannot find a piece of information, the value MUST be null — do NOT guess or infer. ' +
  '(3) Every non-null value must have a sourceUrl pointing to where you found it. ' +
  '(4) Use the company\'s own words whenever possible, not your paraphrasing. ' +
  '(5) Confidence scores must honestly reflect how certain you are — do not inflate scores.'
);

// =============================================================================
// Type Exports
// =============================================================================

export type CompanyResearchOutput = z.infer<typeof companyResearchSchema>;
export type ResearchedField = z.infer<typeof researchedFieldSchema>;
