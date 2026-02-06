// Per-Step AI Suggestion Schemas
// Used with Vercel AI SDK streamObject for context-aware field suggestions
// Each step schema defines which fields can be AI-suggested based on prior wizard context

import { z } from 'zod';

// =============================================================================
// Shared: Suggested Field Schema
// =============================================================================

/**
 * A single AI-suggested field value with reasoning and confidence.
 * Unlike researchedFieldSchema (which extracts from web sources),
 * this generates suggestions from the user's own prior wizard context.
 */
export const suggestedFieldSchema = z.object({
  value: z.string()
    .describe('The suggested value for this field. Must be directly based on the context provided from the user\'s prior wizard inputs. Do NOT invent information not implied by the context.'),

  reasoning: z.string()
    .describe('One sentence explaining how you derived this suggestion from the provided context. Be specific about which prior input informed this.'),

  confidence: z.number().min(0).max(100)
    .describe('How confident you are: 90-100 = directly derivable from context. 60-89 = reasonable inference from context. 30-59 = partially informed guess. If you cannot suggest anything meaningful, omit the field entirely.'),
});

export type SuggestedField = z.infer<typeof suggestedFieldSchema>;

// =============================================================================
// Step 2: ICP Suggestion Schema
// =============================================================================

export const icpSuggestionSchema = z.object({
  primaryIcpDescription: suggestedFieldSchema.optional()
    .describe('Suggest who the business primarily sells to — industries, company types, or personas. Base this on the business name, website, and any product info from prior steps.'),

  industryVertical: suggestedFieldSchema.optional()
    .describe('Suggest the primary industry or vertical. Must be clearly implied by the business description.'),

  jobTitles: suggestedFieldSchema.optional()
    .describe('Suggest target job titles based on who would buy this product/service. Be specific (e.g., "VP of Marketing, CMO") not generic.'),

  geography: suggestedFieldSchema.optional()
    .describe('Suggest target geography based on business location, website language, or market indicators.'),

  easiestToClose: suggestedFieldSchema.optional()
    .describe('Suggest which customer segment is easiest to close based on the product positioning and ICP description.'),

  buyingTriggers: suggestedFieldSchema.optional()
    .describe('Suggest what events or situations trigger a purchase. Base on the problem the product solves and the ICP.'),
}).describe(
  'ICP (Ideal Customer Profile) suggestions. RULES: ' +
  '(1) Base all suggestions on the business name, website URL, product description, and any data already entered in prior steps. ' +
  '(2) Only suggest fields where you have enough context to provide a meaningful value. ' +
  '(3) Omit fields entirely rather than guessing blindly. ' +
  '(4) Be specific and actionable, not generic.'
);

export type ICPSuggestion = z.infer<typeof icpSuggestionSchema>;

// =============================================================================
// Step 3: Product & Offer Suggestion Schema
// =============================================================================

export const productOfferSuggestionSchema = z.object({
  productDescription: suggestedFieldSchema.optional()
    .describe('Suggest a clear product/service description. Base on business name, industry, and any ICP data from prior steps.'),

  coreDeliverables: suggestedFieldSchema.optional()
    .describe('Suggest core features or deliverables. Base on the product description and ICP needs.'),

  valueProp: suggestedFieldSchema.optional()
    .describe('Suggest a value proposition statement. Synthesize from the product description, ICP, and competitive context.'),
}).describe(
  'Product & Offer suggestions. RULES: ' +
  '(1) Synthesize from all prior wizard context (business basics, ICP). ' +
  '(2) Use the user\'s own language and framing when possible. ' +
  '(3) Value props should be specific to their product and ICP, not generic marketing fluff. ' +
  '(4) Omit fields if insufficient context.'
);

export type ProductOfferSuggestion = z.infer<typeof productOfferSuggestionSchema>;

// =============================================================================
// Step 4: Market & Competition Suggestion Schema
// =============================================================================

export const marketCompetitionSuggestionSchema = z.object({
  topCompetitors: suggestedFieldSchema.optional()
    .describe('Suggest real competitors in the same space. You have web search access — find actual companies. Name 3-5 real competitors with brief descriptions.'),

  uniqueEdge: suggestedFieldSchema.optional()
    .describe('Suggest what makes this business different from competitors. Base on their product description, features, and positioning vs. the competitors found.'),

  marketBottlenecks: suggestedFieldSchema.optional()
    .describe('Suggest key market problems or bottlenecks their customers face. Base on the ICP, product, and competitive landscape.'),
}).describe(
  'Market & Competition suggestions. This step uses web search to find real competitors. RULES: ' +
  '(1) Competitors MUST be real, verifiable companies — do NOT fabricate names. ' +
  '(2) Use web search results to identify actual market players. ' +
  '(3) Unique edge should contrast specifically with the competitors found. ' +
  '(4) Market bottlenecks should reflect real industry pain points.'
);

export type MarketCompetitionSuggestion = z.infer<typeof marketCompetitionSuggestionSchema>;

// =============================================================================
// Step 5: Customer Journey Suggestion Schema
// =============================================================================

export const customerJourneySuggestionSchema = z.object({
  situationBeforeBuying: suggestedFieldSchema.optional()
    .describe('Suggest the customer\'s situation before they buy. Base on ICP pain points, market bottlenecks, and the problem the product solves.'),

  desiredTransformation: suggestedFieldSchema.optional()
    .describe('Suggest the desired outcome customers want. Base on the product\'s value prop and ICP aspirations.'),

  commonObjections: suggestedFieldSchema.optional()
    .describe('Suggest common purchase objections. Base on the product type, pricing, competition, and typical concerns for this market.'),
}).describe(
  'Customer Journey suggestions. RULES: ' +
  '(1) Synthesize from ALL prior context: business, ICP, product, and market data. ' +
  '(2) Objections should be realistic for this specific product and market, not generic. ' +
  '(3) The before/after transformation should match their actual value proposition.'
);

export type CustomerJourneySuggestion = z.infer<typeof customerJourneySuggestionSchema>;

// =============================================================================
// Step 6: Brand & Positioning Suggestion Schema
// =============================================================================

export const brandPositioningSuggestionSchema = z.object({
  brandPositioning: suggestedFieldSchema.optional()
    .describe('Suggest a brand positioning statement. Synthesize from the unique edge, value prop, ICP, and competitive landscape.'),

  customerVoice: suggestedFieldSchema.optional()
    .describe('Suggest a realistic customer voice/testimonial example. Base on the ICP persona, their pain points, and the desired transformation. Frame as what a happy customer might say.'),
}).describe(
  'Brand & Positioning suggestions. RULES: ' +
  '(1) Brand positioning must be a genuine synthesis of all prior context, not generic marketing. ' +
  '(2) Customer voice should sound like a real person from the ICP — use their language and concerns. ' +
  '(3) Do NOT fabricate attributed quotes. Frame as "example voice" not real testimonials.'
);

export type BrandPositioningSuggestion = z.infer<typeof brandPositioningSuggestionSchema>;

// =============================================================================
// Step Name Type & Schema Map
// =============================================================================

export type SuggestableStep = 'icp' | 'productOffer' | 'marketCompetition' | 'customerJourney' | 'brandPositioning';

export const STEP_SUGGESTION_SCHEMAS = {
  icp: icpSuggestionSchema,
  productOffer: productOfferSuggestionSchema,
  marketCompetition: marketCompetitionSuggestionSchema,
  customerJourney: customerJourneySuggestionSchema,
  brandPositioning: brandPositioningSuggestionSchema,
} as const;

/**
 * Human-readable step labels for prompts and UI
 */
export const STEP_LABELS: Record<SuggestableStep, string> = {
  icp: 'Ideal Customer Profile',
  productOffer: 'Product & Offer',
  marketCompetition: 'Market & Competition',
  customerJourney: 'Customer Journey',
  brandPositioning: 'Brand & Positioning',
};

/**
 * Which model to use per step.
 * Step 4 (marketCompetition) uses Perplexity for web search.
 * All others use Claude Sonnet for synthesis from existing context.
 */
export const STEP_MODEL_STRATEGY: Record<SuggestableStep, 'perplexity' | 'anthropic'> = {
  icp: 'anthropic',
  productOffer: 'anthropic',
  marketCompetition: 'perplexity',
  customerJourney: 'anthropic',
  brandPositioning: 'anthropic',
};
