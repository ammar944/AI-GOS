// Document Extraction Zod Schema
// Used with Vercel AI SDK streamObject for structured extraction from uploaded documents
// All values are strings (even numbers/arrays/enums) — typed parsing happens in the hook
//
// IMPORTANT: Anthropic's output_format.schema has strict limits:
//   - No z.number().min()/max() (minimum/maximum not supported)
//   - Max 16 nullable/union-typed parameters
//   - Grammar size must stay small (no deeply nested repeated objects)
// So we use a flat schema: one string field per extraction target.

import { z } from 'zod';

// =============================================================================
// Document Extraction Output Schema — flat strings, no nested objects
// =============================================================================

export const documentExtractionSchema = z.object({
  // --- Step 1: Business Basics ---
  businessName: z.string().describe('Official company/business name. Empty if not found.'),
  websiteUrl: z.string().describe('Company website URL. Empty if not found.'),

  // --- Step 2: Ideal Customer Profile (ICP) ---
  primaryIcpDescription: z.string().describe('ICP description — who they sell to. 2-5 sentences. Empty if not found.'),
  industryVertical: z.string().describe('Industry or vertical the company operates in (e.g. "Restaurant Technology", "Healthcare", "Legal Tech"). Extract from document context. Empty if not found.'),
  jobTitles: z.string().describe('Target job titles, comma-separated. Empty if not found.'),
  companySize: z.string().describe('Target sizes. Map to: solo, 1-10, 11-50, 51-200, 201-1000, 1000+. Comma-separated. Empty if not found.'),
  geography: z.string().describe('Target regions. Empty if not found.'),
  easiestToClose: z.string().describe('Easiest customer segment. 2-3 sentences. Empty if not found.'),
  buyingTriggers: z.string().describe('Events that trigger buying. 2-3 sentences. Empty if not found.'),
  bestClientSources: z.string().describe('Lead sources. Map to: referrals, linkedin, outbound, paid_ads, seo, events, partnerships, content, other. Comma-separated. Empty if not found.'),
  secondaryIcp: z.string().describe('Secondary ICP. 2-3 sentences. Empty if not found.'),
  systemsPlatforms: z.string().describe('Systems/platforms used (CRM, tools). Empty if not found.'),

  // --- Step 3: Product & Offer ---
  productDescription: z.string().describe('What the product/service does. 2-5 sentences. Empty if not found.'),
  coreDeliverables: z.string().describe('Main features/deliverables. Comma-separated. Empty if not found.'),
  offerPrice: z.string().describe('Primary or starting price as a single number string (e.g. "997"). If multiple tiers exist, use the lowest/starting price only. Empty if not found.'),
  pricingModel: z.string().describe('Model: monthly, annual, one_time, usage_based, seat_based, custom. Comma-separated. Empty if not found.'),
  valueProp: z.string().describe('Value proposition. 2-3 sentences. Empty if not found.'),
  guarantees: z.string().describe('Guarantees or risk-reversal offers. Empty if not found.'),
  currentFunnelType: z.string().describe('Funnel: lead_form, booking_page, free_trial, webinar, demo, application, challenge, ecommerce, other. Comma-separated. Empty if not found.'),

  // --- Step 4: Market & Competition ---
  topCompetitors: z.string().describe('Named competitors, comma-separated. Empty if not found.'),
  uniqueEdge: z.string().describe('What differentiates from competitors. 2-3 sentences. Empty if not found.'),
  competitorFrustrations: z.string().describe('Customer frustrations with competitors. 2-3 sentences. Empty if not found.'),
  marketBottlenecks: z.string().describe('Market problems addressed. 2-3 sentences. Empty if not found.'),
  proprietaryTech: z.string().describe('Proprietary tech/methodology/IP. Empty if not found.'),

  // --- Step 5: Customer Journey ---
  situationBeforeBuying: z.string().describe('Customer pain before buying. 2-3 sentences. Empty if not found.'),
  desiredTransformation: z.string().describe('Desired outcome. 2-3 sentences. Empty if not found.'),
  commonObjections: z.string().describe('Common objections. Empty if not found.'),
  salesCycleLength: z.string().describe('Sales cycle: less_than_7_days, 7_to_14_days, 14_to_30_days, more_than_30_days. Empty if not found.'),
  salesProcessOverview: z.string().describe('Sales process overview. 2-3 sentences. Empty if not found.'),

  // --- Step 6: Brand & Positioning ---
  brandPositioning: z.string().describe('Brand market positioning. 2-3 sentences. Empty if not found.'),
  customerVoice: z.string().describe('Customer voice/testimonials/language tone. Empty if not found.'),

  // --- Step 7: Assets & Proof ---
  salesDeckUrl: z.string().describe('Sales deck URL. Empty if not found.'),
  productDemoUrl: z.string().describe('Product demo URL. Empty if not found.'),
  caseStudiesUrl: z.string().describe('Case studies URL. Empty if not found.'),
  testimonialsUrl: z.string().describe('Testimonials URL. Empty if not found.'),
  landingPageUrl: z.string().describe('Landing page URL. Empty if not found.'),
  existingAdsUrl: z.string().describe('Existing ads URL. Empty if not found.'),
  brandGuidelinesUrl: z.string().describe('Brand guidelines URL. Empty if not found.'),

  // --- Step 8: Budget & Targets ---
  monthlyAdBudget: z.string().describe('Monthly ad budget as number string. Empty if not found.'),
  dailyBudgetCeiling: z.string().describe('Daily budget ceiling as number string. Empty if not found.'),
  campaignDuration: z.string().describe('Duration: ongoing, 1_month, 3_months, 6_months, fixed. Empty if not found.'),
  targetCpl: z.string().describe('Target CPL as number string. Empty if not found.'),
  targetCac: z.string().describe('Target CAC as number string. Empty if not found.'),
  targetSqlsPerMonth: z.string().describe('Target SQLs/month as number string. Empty if not found.'),
  targetDemosPerMonth: z.string().describe('Target demos/month as number string. Empty if not found.'),

  // --- Step 9: Compliance ---
  topicsToAvoid: z.string().describe('Topics to avoid in marketing. Empty if not found.'),
  claimRestrictions: z.string().describe('Claim restrictions or regulatory constraints. Empty if not found.'),

  // --- Meta ---
  confidenceNotes: z.string().describe('2-3 sentences: what was found vs not found, which sections had detail.'),
}).describe(
  'Extract business information from the document. ' +
  'ONLY extract what is EXPLICITLY stated — NEVER fabricate. ' +
  'Use EMPTY STRING for fields not found. ' +
  'Condense to 2-5 sentences. Map enums to exact values in descriptions.'
);

// =============================================================================
// Type Exports
// =============================================================================

export type DocumentExtractionOutput = z.infer<typeof documentExtractionSchema>;

// All field keys (excludes confidenceNotes)
export const EXTRACTION_FIELD_KEYS = [
  'businessName', 'websiteUrl',
  'primaryIcpDescription', 'industryVertical', 'jobTitles', 'companySize',
  'geography', 'easiestToClose', 'buyingTriggers', 'bestClientSources',
  'secondaryIcp', 'systemsPlatforms',
  'productDescription', 'coreDeliverables', 'offerPrice', 'pricingModel',
  'valueProp', 'guarantees', 'currentFunnelType',
  'topCompetitors', 'uniqueEdge', 'competitorFrustrations', 'marketBottlenecks',
  'proprietaryTech',
  'situationBeforeBuying', 'desiredTransformation', 'commonObjections',
  'salesCycleLength', 'salesProcessOverview',
  'brandPositioning', 'customerVoice',
  'salesDeckUrl', 'productDemoUrl', 'caseStudiesUrl', 'testimonialsUrl',
  'landingPageUrl', 'existingAdsUrl', 'brandGuidelinesUrl',
  'monthlyAdBudget', 'dailyBudgetCeiling', 'campaignDuration', 'targetCpl',
  'targetCac', 'targetSqlsPerMonth', 'targetDemosPerMonth',
  'topicsToAvoid', 'claimRestrictions',
] as const;

export const TOTAL_EXTRACTION_FIELDS = EXTRACTION_FIELD_KEYS.length;
