export type JourneyFieldCategory =
  | 'required-blocker'
  | 'section-followup'
  | 'research-enrichment';

export type JourneyFieldSection =
  | 'industryMarket'
  | 'competitors'
  | 'icpValidation'
  | 'offerAnalysis'
  | 'crossAnalysis'
  | null;

export interface JourneyFieldDefinition {
  key: string;
  label: string;
  category: JourneyFieldCategory;
  section: JourneyFieldSection;
  collectionMode: 'manual' | 'scrape' | 'either';
  prefillVisible?: boolean;
}

export interface JourneyManualFieldDefinition {
  key: string;
  label: string;
  placeholder: string;
  helper: string;
  rows: number;
  required?: boolean;
  requiredGroup?: 'pricingContext';
}

export interface JourneyRequirementDefinition {
  key: 'topCompetitors' | 'productDescription' | 'primaryIcpDescription' | 'pricingContext';
  label: string;
  fieldKeys: readonly string[];
}

export const JOURNEY_FIELDS: readonly JourneyFieldDefinition[] = [
  { key: 'companyName', label: 'Company Name', category: 'research-enrichment', section: null, collectionMode: 'either', prefillVisible: true },
  { key: 'websiteUrl', label: 'Website', category: 'research-enrichment', section: null, collectionMode: 'either' },
  { key: 'businessModel', label: 'Business Model', category: 'required-blocker', section: 'industryMarket', collectionMode: 'either', prefillVisible: true },
  { key: 'industryVertical', label: 'Industry Vertical', category: 'section-followup', section: 'icpValidation', collectionMode: 'either', prefillVisible: true },
  { key: 'primaryIcpDescription', label: 'Ideal Customer Profile', category: 'required-blocker', section: 'icpValidation', collectionMode: 'either', prefillVisible: true },
  { key: 'jobTitles', label: 'Target Job Titles', category: 'section-followup', section: 'icpValidation', collectionMode: 'either', prefillVisible: true },
  { key: 'companySize', label: 'Company Size', category: 'section-followup', section: 'icpValidation', collectionMode: 'either', prefillVisible: true },
  { key: 'geography', label: 'Geographic Focus', category: 'section-followup', section: 'icpValidation', collectionMode: 'either', prefillVisible: true },
  { key: 'headquartersLocation', label: 'Headquarters', category: 'research-enrichment', section: null, collectionMode: 'scrape', prefillVisible: true },
  { key: 'easiestToClose', label: 'Easiest to Close', category: 'section-followup', section: 'icpValidation', collectionMode: 'manual' },
  { key: 'buyingTriggers', label: 'Buying Triggers', category: 'section-followup', section: 'icpValidation', collectionMode: 'manual' },
  { key: 'bestClientSources', label: 'Best Client Sources', category: 'section-followup', section: 'icpValidation', collectionMode: 'manual' },
  { key: 'productDescription', label: 'Product Description', category: 'required-blocker', section: 'offerAnalysis', collectionMode: 'either', prefillVisible: true },
  { key: 'coreDeliverables', label: 'Core Deliverables', category: 'section-followup', section: 'offerAnalysis', collectionMode: 'either', prefillVisible: true },
  { key: 'pricingTiers', label: 'Pricing Tiers', category: 'required-blocker', section: 'offerAnalysis', collectionMode: 'either', prefillVisible: true },
  { key: 'valueProp', label: 'Value Proposition', category: 'section-followup', section: 'offerAnalysis', collectionMode: 'either', prefillVisible: true },
  { key: 'currentFunnelType', label: 'Current Funnel Type', category: 'section-followup', section: 'offerAnalysis', collectionMode: 'manual' },
  { key: 'guarantees', label: 'Guarantees', category: 'section-followup', section: 'offerAnalysis', collectionMode: 'either', prefillVisible: true },
  { key: 'topCompetitors', label: 'Top Competitors', category: 'required-blocker', section: 'competitors', collectionMode: 'either', prefillVisible: true },
  { key: 'uniqueEdge', label: 'Unique Edge', category: 'required-blocker', section: 'competitors', collectionMode: 'either', prefillVisible: true },
  { key: 'competitorFrustrations', label: 'Competitor Frustrations', category: 'section-followup', section: 'competitors', collectionMode: 'manual' },
  { key: 'marketBottlenecks', label: 'Market Bottlenecks', category: 'section-followup', section: 'competitors', collectionMode: 'manual' },
  { key: 'marketProblem', label: 'Market Problem', category: 'research-enrichment', section: null, collectionMode: 'scrape', prefillVisible: true },
  { key: 'situationBeforeBuying', label: 'Before State', category: 'section-followup', section: 'crossAnalysis', collectionMode: 'either', prefillVisible: true },
  { key: 'desiredTransformation', label: 'Desired Transformation', category: 'section-followup', section: 'crossAnalysis', collectionMode: 'either', prefillVisible: true },
  { key: 'commonObjections', label: 'Common Objections', category: 'section-followup', section: 'crossAnalysis', collectionMode: 'either', prefillVisible: true },
  { key: 'salesCycleLength', label: 'Sales Cycle Length', category: 'section-followup', section: 'crossAnalysis', collectionMode: 'manual' },
  { key: 'salesProcessOverview', label: 'Sales Process', category: 'section-followup', section: 'crossAnalysis', collectionMode: 'manual' },
  { key: 'brandPositioning', label: 'Brand Positioning', category: 'section-followup', section: 'crossAnalysis', collectionMode: 'either', prefillVisible: true },
  { key: 'monthlyAdBudget', label: 'Monthly Ad Budget', category: 'required-blocker', section: 'offerAnalysis', collectionMode: 'either' },
  { key: 'campaignDuration', label: 'Campaign Duration', category: 'section-followup', section: 'crossAnalysis', collectionMode: 'manual' },
  { key: 'targetCpl', label: 'Target CPL', category: 'section-followup', section: 'crossAnalysis', collectionMode: 'manual' },
  { key: 'targetCac', label: 'Target CAC', category: 'section-followup', section: 'crossAnalysis', collectionMode: 'manual' },
  { key: 'goals', label: 'Goals', category: 'required-blocker', section: 'crossAnalysis', collectionMode: 'either' },
  { key: 'testimonialQuote', label: 'Testimonial Quote', category: 'research-enrichment', section: null, collectionMode: 'scrape', prefillVisible: true },
  { key: 'caseStudiesUrl', label: 'Case Studies URL', category: 'research-enrichment', section: null, collectionMode: 'scrape', prefillVisible: true },
  { key: 'testimonialsUrl', label: 'Testimonials URL', category: 'research-enrichment', section: null, collectionMode: 'scrape', prefillVisible: true },
  { key: 'pricingUrl', label: 'Pricing URL', category: 'research-enrichment', section: null, collectionMode: 'scrape', prefillVisible: true },
  { key: 'demoUrl', label: 'Demo URL', category: 'research-enrichment', section: null, collectionMode: 'scrape', prefillVisible: true },
] as const;

export const JOURNEY_FIELD_LABELS: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(JOURNEY_FIELDS.map((field) => [field.key, field.label])),
);

export const JOURNEY_PREFILL_REVIEW_FIELDS = JOURNEY_FIELDS.filter(
  (field) => field.prefillVisible,
);

export const JOURNEY_REQUIRED_BLOCKER_FIELDS = JOURNEY_FIELDS.filter(
  (field) => field.category === 'required-blocker',
);

export const JOURNEY_SECTION_FOLLOWUP_FIELDS = JOURNEY_FIELDS.filter(
  (field) => field.category === 'section-followup',
);

export const JOURNEY_RESEARCH_ENRICHMENT_FIELDS = JOURNEY_FIELDS.filter(
  (field) => field.category === 'research-enrichment',
);

export const JOURNEY_MANUAL_BLOCKER_FIELDS: readonly JourneyManualFieldDefinition[] = [
  {
    key: 'businessModel',
    label: 'Business Model',
    placeholder: 'B2B SaaS agency / service business',
    helper: 'How do you make money? Keep it short and concrete.',
    rows: 1,
    required: true,
  },
  {
    key: 'productDescription',
    label: 'Product Description',
    placeholder: 'We run paid media and pipeline-focused demand gen systems for B2B SaaS companies.',
    helper: 'Describe what the customer actually buys from you.',
    rows: 3,
    required: true,
  },
  {
    key: 'topCompetitors',
    label: 'Top Competitors',
    placeholder: 'Hey Digital, Sales Captain, Growth Marketing Pro',
    helper: 'Name the 2-3 agencies or platforms prospects compare you against most.',
    rows: 2,
    required: true,
  },
  {
    key: 'primaryIcpDescription',
    label: 'Ideal Customer Profile',
    placeholder: 'Seed to Series B B2B SaaS teams that need pipeline growth without building a full in-house demand gen function.',
    helper: 'Describe the best-fit customer in your own words.',
    rows: 4,
    required: true,
  },
  {
    key: 'pricingTiers',
    label: 'Pricing Tiers',
    placeholder: 'Retainer-based. Starter $4k/mo, Growth $8k/mo, Scale $12k+/mo.',
    helper: 'If you have fixed packages or retainers, add them here.',
    rows: 3,
    requiredGroup: 'pricingContext',
  },
  {
    key: 'monthlyAdBudget',
    label: 'Monthly Ad Budget',
    placeholder: '$15,000/month',
    helper: 'Optional if pricing is still custom. Budget is enough to benchmark the offer.',
    rows: 1,
    requiredGroup: 'pricingContext',
  },
  {
    key: 'goals',
    label: 'Goals',
    placeholder: 'More qualified demos, lower CAC, and better pipeline attribution.',
    helper: 'What matters most in the next 90 days?',
    rows: 2,
    required: true,
  },
  {
    key: 'uniqueEdge',
    label: 'Unique Edge',
    placeholder: 'We are deeply specialized in B2B SaaS and tie campaigns directly to pipeline, not vanity metrics.',
    helper: 'What do you win on that competitors struggle to match?',
    rows: 2,
    required: true,
  },
] as const;

export const JOURNEY_WAVE_TWO_REQUIREMENTS: readonly JourneyRequirementDefinition[] = [
  {
    key: 'topCompetitors',
    label: 'competitors',
    fieldKeys: ['topCompetitors'],
  },
  {
    key: 'productDescription',
    label: 'product description',
    fieldKeys: ['productDescription'],
  },
  {
    key: 'primaryIcpDescription',
    label: 'ICP specifics',
    fieldKeys: ['primaryIcpDescription'],
  },
  {
    key: 'pricingContext',
    label: 'pricing or budget',
    fieldKeys: ['pricingTiers', 'monthlyAdBudget'],
  },
] as const;

export function getJourneyFieldDefinition(
  key: string,
): JourneyFieldDefinition | undefined {
  return JOURNEY_FIELDS.find((field) => field.key === key);
}

export function getJourneyFollowupFieldsForSection(
  section: Exclude<JourneyFieldSection, null>,
): JourneyFieldDefinition[] {
  return JOURNEY_SECTION_FOLLOWUP_FIELDS.filter((field) => field.section === section);
}
