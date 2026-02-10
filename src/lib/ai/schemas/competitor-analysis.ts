// Competitor Analysis Schema
// Enhanced with .describe() hints for better AI output quality

import { z } from 'zod';

// =============================================================================
// Competitor Snapshot
// =============================================================================

export const competitorSnapshotSchema = z.object({
  name: z.string()
    .describe('Actual competitor company name as it appears in their branding (e.g., "HubSpot", "Salesforce", not "hubspot.com").'),

  website: z.string().url().optional()
    .describe('Competitor website URL (e.g., "https://hubspot.com"). Include if found during research.'),

  positioning: z.string()
    .describe('How they position themselves in the market. Quote their tagline or describe their core message (e.g., "All-in-one CRM for growing businesses").'),

  offer: z.string()
    .describe('Their main offer/product with key features. Be specific about what they actually sell (e.g., "Marketing automation platform with email, landing pages, and attribution").'),

  price: z.string()
    .describe('General pricing tier (e.g., "Premium/Enterprise", "Mid-market", "SMB-friendly"). Do NOT guess exact prices - say "See pricing page" if unsure. Exact pricing is scraped separately.'),

  funnels: z.string()
    .describe('Their go-to-market approach (e.g., "Free trial → Demo → Annual contract", "Lead magnet → Webinar → Sales call").'),

  adPlatforms: z.array(z.string())
    .describe('Platforms where they run paid ads. Check Meta Ad Library, LinkedIn, Google. Be specific (e.g., ["Meta", "LinkedIn", "Google Search"]).'),

  strengths: z.array(z.string())
    .min(1).max(5)
    .describe('2-3 verified competitive strengths from reviews, market presence, and product capabilities. Be specific (e.g., "Strong brand recognition", "Best-in-class integrations").'),

  weaknesses: z.array(z.string())
    .min(1).max(5)
    .describe('2-3 weaknesses from G2/Capterra reviews or market positioning gaps. Use actual customer complaints (e.g., "Steep learning curve", "Poor customer support").'),

  // NOTE: These fields are populated by Firecrawl/Ad Library, not Perplexity
  // pricingTiers → scrapePricingForCompetitors()
  // adCreatives → fetchCompetitorAdsWithFallback()
}).describe('Individual competitor snapshot with positioning, offer, and SWOT analysis. Pricing tiers and ad creatives are enriched from external sources.');

// =============================================================================
// Creative Library
// =============================================================================

export const creativeLibrarySchema = z.object({
  creativeFormats: z.object({
    ugc: z.boolean()
      .describe('Do competitors use user-generated content (talking head videos, testimonial clips)?'),
    carousels: z.boolean()
      .describe('Do competitors use carousel ads (swipeable multi-image)?'),
    statics: z.boolean()
      .describe('Do competitors use static image ads?'),
    testimonial: z.boolean()
      .describe('Do competitors feature customer testimonials prominently?'),
    productDemo: z.boolean()
      .describe('Do competitors show product demos or screen recordings?'),
  }).describe('Creative format prevalence across competitor ads'),
}).describe('Competitor creative intelligence from ad library research');

// =============================================================================
// Funnel Breakdown
// =============================================================================

export const funnelBreakdownSchema = z.object({
  landingPagePatterns: z.array(z.string())
    .min(1).max(6)
    .describe('3-4 common landing page patterns observed (e.g., "Long-form sales page with video", "Minimal page with demo booking", "Free tool + email capture").'),

  headlineStructure: z.array(z.string())
    .min(1).max(6)
    .describe('3-4 headline formulas used by competitors (e.g., "[Outcome] without [Pain]", "The [Category] that [Differentiator]", "[X] trusted by [Y] companies").'),

  ctaHierarchy: z.array(z.string())
    .min(1).max(5)
    .describe('2-3 CTA patterns (e.g., "Primary: Start Free Trial, Secondary: Watch Demo", "Single CTA: Book a Call").'),

  socialProofPatterns: z.array(z.string())
    .min(1).max(6)
    .describe('3-4 types of social proof used (e.g., "Logo walls of enterprise clients", "G2 badges", "Specific metric testimonials", "Case study previews").'),

  leadCaptureMethods: z.array(z.string())
    .min(1).max(5)
    .describe('2-3 lead capture approaches (e.g., "Email-gated content", "Demo request form", "Free trial signup", "Interactive calculator").'),

  formFriction: z.enum(['low', 'medium', 'high'])
    .describe('"low" = email only or 2-3 fields. "medium" = 4-6 fields. "high" = 7+ fields or multi-step qualification.'),
}).describe('Competitor funnel and conversion patterns');

// =============================================================================
// Gaps and Opportunities
// =============================================================================

export const gapsAndOpportunitiesSchema = z.object({
  messagingOpportunities: z.array(z.string())
    .min(1).max(6)
    .describe('3-4 messaging gaps to exploit. What are competitors NOT saying that matters to the ICP? (e.g., "No one highlights implementation speed", "No competitor addresses [specific objection]").'),

  creativeOpportunities: z.array(z.string())
    .min(1).max(5)
    .describe('2-3 creative format opportunities (e.g., "No competitors using founder story content", "Opportunity for comparison ads", "No one doing before/after demos").'),

  funnelOpportunities: z.array(z.string())
    .min(1).max(5)
    .describe('2-3 funnel improvement opportunities (e.g., "Faster path to value - competitors require demo calls", "Lower friction signup than market norm").'),
}).describe('Specific opportunities based on competitive gaps');

// =============================================================================
// Complete Competitor Analysis Schema
// =============================================================================

export const competitorAnalysisSchema = z.object({
  competitors: z.array(competitorSnapshotSchema)
    .min(2).max(7)
    .describe('3-5 direct competitors with verified information from web research'),

  creativeLibrary: creativeLibrarySchema,

  funnelBreakdown: funnelBreakdownSchema,

  marketStrengths: z.array(z.string())
    .min(1).max(6)
    .describe('3-4 industry-wide strengths across all competitors (what the market does well collectively).'),

  marketWeaknesses: z.array(z.string())
    .min(1).max(6)
    .describe('3-4 industry-wide weaknesses (common complaints, gaps, or underserved needs across all players).'),

  gapsAndOpportunities: gapsAndOpportunitiesSchema,
}).describe('Comprehensive competitor analysis for paid media positioning');

// =============================================================================
// Type Export
// =============================================================================

export type CompetitorAnalysis = z.infer<typeof competitorAnalysisSchema>;
