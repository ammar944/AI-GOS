import { z } from 'zod';

// ---------------------------------------------------------------------------
// Flat data type — canonical GTM brief plus media plan setup
// ---------------------------------------------------------------------------

export interface SalesProcessDocRef {
  label: string;
  url: string;
}

// A cited source captured during research, surfaced read-only in the GTM
// brief review. Kept here so the onboarding wizard's corpusSources prop shape
// stays stable independent of the research state machine.
export interface CorpusSourceLink {
  title: string;
  url: string;
  whyItMatters?: string;
}

export interface OnboardingV2Data {
  // Section 1: Product & Revenue Model
  companyName: string;
  productDescription: string;
  builtFor: string;
  salesMotion: 'product_led' | 'sales_led' | 'hybrid' | '';
  pricingModel: 'subscription' | 'usage_based' | 'per_seat' | 'one_time_plus_sub' | '';
  conversionPath: 'free_trial' | 'freemium' | 'demo_required' | 'direct_checkout' | '';
  acv: 'lt_1k' | '1k_10k' | '10k_50k' | 'gt_50k' | '';

  // Section 2: ICP + Pain
  idealCustomer: string;
  industry: string;
  jobTitles: string;
  companySize: string;
  geographicFocus: string;
  triggers: string;
  currentAlternative: string;
  awarenessLevel: 'unaware' | 'problem_aware' | 'solution_aware' | 'product_aware' | '';

  // Section 3: Offer & Product Experience
  coreFeatures: string;
  firstValueMoment: string;
  activationEvent: string;
  retentionDrivers: string;

  // Section 4: Pricing & Economics
  pricingTiers: string;
  targetPlan: string;
  avgLtv: string;
  targetCac: string;
  targetTrialsPerMonth: string;
  monthlyAdBudget: string;

  // Section 5: Competition & Positioning
  topCompetitors: string;
  whyCustomersChooseYou: string;
  lossReasons: string;
  competitorAdvantages: string;

  // Section 6: Goals & Strategy
  primaryGoal90Days: string;
  monthlyPipelineTarget: string;
  commonObjections: string;
  keyPromises: string;
  brandPositioning: string;
  gtmMotion: 'SLG' | 'PLG' | '';

  // Media Plan Setup
  salesProcessDocs: SalesProcessDocRef[];
  salesLoomUrl: string;
  creativeCapacity: 'lean' | 'standard' | 'high' | '';
  leadListAvailable: boolean | null;

  // Section 7: Current Marketing & Performance
  channels: string[];
  budgetSplit: string;
  whatsWorking: string;
  whatsNotWorking: string;
  currentCac: string;
  monthlyRevenue: string;
  avgSalesCycle: string;
  // Optional funnel metrics
  visitorToSignup: string;
  signupToActivation: string;
  activationToPaid: string;
  demoToClose: string;
  growthTrend: string;
}

export interface OnboardingFieldPrefillMetadata {
  value: string;
  confidence: number | null;
  sourceUrl: string | null;
  reasoning: string | null;
}

export type OnboardingPrefillMetadata = Partial<
  Record<keyof OnboardingV2Data, OnboardingFieldPrefillMetadata>
>;

export type OnboardingFieldReviewState =
  | 'AI-filled'
  | 'User-edited'
  | 'Missing'
  | 'Needs review'
  // Blank OPTIONAL field. Distinct from 'Missing' (hard-required blank) so it
  // never renders red and never blocks the run.
  | 'Optional';

export interface OnboardingFieldReview {
  key: keyof OnboardingV2Data;
  label: string;
  sectionId: string;
  sectionTitle: string;
  state: OnboardingFieldReviewState;
  value: string | string[];
  aiValue: string | null;
  confidence: number | null;
  sourceUrl: string | null;
  reasoning: string | null;
}

export interface OnboardingReviewMetadata {
  source: 'onboarding_v2_review';
  fieldCount: number;
  lowConfidenceThreshold: number;
  /** Hard-required blanks + low-confidence required fills. The only run-audit blockers. */
  pinnedFieldKeys: Array<keyof OnboardingV2Data>;
  /** Blank optional fields. Never blocks the run; surfaced as a calm "improve output" nudge. */
  optionalIncomplete: Array<keyof OnboardingV2Data>;
  counts: Record<OnboardingFieldReviewState, number>;
  fields: Partial<Record<keyof OnboardingV2Data, OnboardingFieldReview>>;
  savedAt?: string;
}

// ---------------------------------------------------------------------------
// Zod schema for full form validation
// ---------------------------------------------------------------------------

export const SalesProcessDocRefSchema = z
  .object({
    label: z.string().min(1, 'Doc label is required'),
    url: z.string().url('Enter a valid doc URL'),
  })
  .strict();

export const SalesProcessDocsSchema = z.preprocess((value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .flatMap((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return [];
      }

      const record = item as Record<string, unknown>;
      const label = typeof record.label === 'string' ? record.label.trim() : '';
      const url = typeof record.url === 'string' ? record.url.trim() : '';

      if (!label || !url) {
        return [];
      }

      return [{ label, url }];
    })
    .slice(0, 4);
}, z.array(SalesProcessDocRefSchema).max(4));

export const OnboardingV2Schema = z.object({
  // Section 1
  companyName: z.string().min(1, 'Company name is required'),
  productDescription: z.string().min(1, 'Product description is required'),
  builtFor: z.string().min(1, 'Required'),
  salesMotion: z.enum(['product_led', 'sales_led', 'hybrid', '']).refine(v => v !== '', { message: 'Select a sales motion' }),
  pricingModel: z.enum(['subscription', 'usage_based', 'per_seat', 'one_time_plus_sub', '']).refine(v => v !== '', { message: 'Select a pricing model' }),
  conversionPath: z.enum(['free_trial', 'freemium', 'demo_required', 'direct_checkout', '']).refine(v => v !== '', { message: 'Select a conversion path' }),
  acv: z.enum(['lt_1k', '1k_10k', '10k_50k', 'gt_50k', '']).refine(v => v !== '', { message: 'Select an ACV range' }),
  // Section 2
  idealCustomer: z.string().min(1, 'Required'),
  industry: z.string().min(1, 'Required'),
  jobTitles: z.string().min(1, 'Required'),
  companySize: z.string().min(1, 'Required'),
  geographicFocus: z.string().min(1, 'Required'),
  triggers: z.string().min(1, 'Required'),
  currentAlternative: z.string().min(1, 'Required'),
  awarenessLevel: z.enum(['unaware', 'problem_aware', 'solution_aware', 'product_aware', '']).refine(v => v !== '', { message: 'Select an awareness level' }),
  // Section 3
  coreFeatures: z.string().min(1, 'Required'),
  firstValueMoment: z.string().min(1, 'Required'),
  activationEvent: z.string().min(1, 'Required'),
  retentionDrivers: z.string().min(1, 'Required'),
  // Section 4 — internal economics (targetPlan/avgLtv/targetCac) are never
  // publicly discoverable, so they cannot block the run.
  pricingTiers: z.string().min(1, 'Required'),
  targetPlan: z.string().optional().default(''),
  avgLtv: z.string().optional().default(''),
  targetCac: z.string().optional().default(''),
  targetTrialsPerMonth: z.string().optional().default(''),
  monthlyAdBudget: z.string().min(1, 'Required'),
  // Section 5
  topCompetitors: z.string().min(1, 'Required'),
  whyCustomersChooseYou: z.string().min(1, 'Required'),
  lossReasons: z.string().min(1, 'Required'),
  competitorAdvantages: z.string().min(1, 'Required'),
  // Section 6 — monthlyPipelineTarget is an internal metric prefill can never
  // supply; optional so it stops pinning the blocker rail.
  primaryGoal90Days: z.string().min(1, 'Required'),
  monthlyPipelineTarget: z.string().optional().default(''),
  commonObjections: z.string().min(1, 'Required'),
  keyPromises: z.string().min(1, 'Required'),
  brandPositioning: z.string().min(1, 'Required'),
  gtmMotion: z.enum(['SLG', 'PLG', '']).optional().default(''),
  // Media Plan Setup
  salesProcessDocs: SalesProcessDocsSchema,
  salesLoomUrl: z.string().url('Enter a valid Loom URL').or(z.literal('')).optional().default(''),
  creativeCapacity: z.enum(['lean', 'standard', 'high', '']).optional().default(''),
  leadListAvailable: z.boolean().nullable().optional().default(null),
  // Section 7 — current-marketing performance is internal data research can
  // never auto-fill; the whole section is optional context, not a run blocker.
  channels: z.array(z.string()).optional().default([]),
  budgetSplit: z.string().optional().default(''),
  whatsWorking: z.string().optional().default(''),
  whatsNotWorking: z.string().optional().default(''),
  currentCac: z.string().optional().default(''),
  monthlyRevenue: z.string().optional().default(''),
  avgSalesCycle: z.string().optional().default(''),
  // Optional funnel metrics
  visitorToSignup: z.string().optional().default(''),
  signupToActivation: z.string().optional().default(''),
  activationToPaid: z.string().optional().default(''),
  demoToClose: z.string().optional().default(''),
  growthTrend: z.string().optional().default(''),
});

// Per-section schemas for step-by-step validation
export const SECTION_SCHEMAS: Record<number, z.ZodSchema> = {
  0: OnboardingV2Schema.pick({
    companyName: true, productDescription: true, builtFor: true,
    salesMotion: true, pricingModel: true, conversionPath: true, acv: true,
  }),
  1: OnboardingV2Schema.pick({
    idealCustomer: true, industry: true, jobTitles: true,
    companySize: true, geographicFocus: true, triggers: true,
    currentAlternative: true, awarenessLevel: true,
  }),
  2: OnboardingV2Schema.pick({
    coreFeatures: true, firstValueMoment: true, activationEvent: true, retentionDrivers: true,
  }),
  3: OnboardingV2Schema.pick({
    pricingTiers: true, targetPlan: true, avgLtv: true, targetCac: true, targetTrialsPerMonth: true, monthlyAdBudget: true,
  }),
  4: OnboardingV2Schema.pick({
    topCompetitors: true, whyCustomersChooseYou: true, lossReasons: true, competitorAdvantages: true,
  }),
  5: OnboardingV2Schema.pick({
    primaryGoal90Days: true, monthlyPipelineTarget: true,
    commonObjections: true, keyPromises: true, brandPositioning: true,
  }),
  6: OnboardingV2Schema.pick({
    channels: true, budgetSplit: true, whatsWorking: true, whatsNotWorking: true,
    currentCac: true, monthlyRevenue: true, avgSalesCycle: true, growthTrend: true,
    visitorToSignup: true, signupToActivation: true, activationToPaid: true, demoToClose: true,
  }),
  7: OnboardingV2Schema.pick({
    creativeCapacity: true, leadListAvailable: true,
    salesProcessDocs: true, salesLoomUrl: true,
  }),
};

// ---------------------------------------------------------------------------
// Section metadata
// ---------------------------------------------------------------------------

export type SectionIconName = 'Building2' | 'Users' | 'Package' | 'TrendingUp' | 'Sparkles' | 'Target' | 'Route' | 'UploadCloud';

export interface SectionField {
  key: keyof OnboardingV2Data;
  label: string;
  type: 'text' | 'textarea' | 'radio' | 'checkbox' | 'boolean-radio' | 'sales-process-docs';
  required: boolean;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  description?: string;
}

export interface SectionMeta {
  id: string;
  title: string;
  /** Compact label for the section nav (≤ 12 chars). Falls back to title if absent. */
  shortTitle?: string;
  description: string;
  icon: SectionIconName;
  fields: SectionField[];
}

export const SECTION_META: SectionMeta[] = [
  {
    id: 'product-revenue',
    title: 'Product & Revenue Model',
    shortTitle: 'Product',
    description: 'Understand how the product works and how it\'s sold',
    icon: 'Building2',
    fields: [
      { key: 'companyName', label: 'Company Name', type: 'text', required: true, placeholder: 'Acme Corp' },
      { key: 'productDescription', label: 'What does your product/SaaS do?', type: 'textarea', required: true, placeholder: 'Describe your product in 1–2 sentences' },
      { key: 'builtFor', label: 'Who is it built for?', type: 'text', required: true, placeholder: 'e.g. B2B SaaS marketing teams' },
      {
        key: 'salesMotion', label: 'How do customers buy?', type: 'radio', required: true,
        options: [
          { value: 'product_led', label: 'Product-led (self-serve)' },
          { value: 'sales_led', label: 'Sales-led (demo → close)' },
          { value: 'hybrid', label: 'Hybrid' },
        ],
      },
      {
        key: 'pricingModel', label: 'What is your pricing model?', type: 'radio', required: true,
        options: [
          { value: 'subscription', label: 'Subscription (monthly / annual)' },
          { value: 'usage_based', label: 'Usage-based' },
          { value: 'per_seat', label: 'Per seat' },
          { value: 'one_time_plus_sub', label: 'One-time + subscription' },
        ],
      },
      {
        key: 'conversionPath', label: 'How do customers convert?', type: 'radio', required: true,
        options: [
          { value: 'free_trial', label: 'Free trial' },
          { value: 'freemium', label: 'Freemium' },
          { value: 'demo_required', label: 'Demo required' },
          { value: 'direct_checkout', label: 'Direct checkout' },
        ],
      },
      {
        key: 'acv', label: 'What is your average price or ACV?', type: 'radio', required: true,
        options: [
          { value: 'lt_1k', label: '<$1K' },
          { value: '1k_10k', label: '$1K–$10K' },
          { value: '10k_50k', label: '$10K–$50K' },
          { value: 'gt_50k', label: '$50K+' },
        ],
      },
    ],
  },
  {
    id: 'icp-pain',
    title: 'ICP + Pain',
    shortTitle: 'ICP',
    description: 'Fuel targeting, messaging, and creative',
    icon: 'Users',
    fields: [
      { key: 'idealCustomer', label: 'Describe your ideal customer (company + persona)', type: 'textarea', required: true, placeholder: 'e.g. Series A SaaS startup, VP of Marketing...' },
      { key: 'industry', label: 'What industry do they operate in?', type: 'text', required: true, placeholder: 'e.g. B2B SaaS, FinTech, Healthcare' },
      { key: 'jobTitles', label: 'What job titles do you sell to?', type: 'text', required: true, placeholder: 'e.g. CMO, VP Marketing, Growth Lead' },
      { key: 'companySize', label: 'Company size (employees or revenue range)', type: 'text', required: true, placeholder: 'e.g. 50–500 employees, $5M–$50M ARR' },
      { key: 'geographicFocus', label: 'Geographic focus', type: 'text', required: true, placeholder: 'e.g. North America, Global, EMEA' },
      { key: 'triggers', label: 'What triggers them to look for a solution like yours?', type: 'textarea', required: true, placeholder: 'e.g. Missed revenue targets, hiring a new CMO...' },
      { key: 'currentAlternative', label: 'What are they currently using instead?', type: 'text', required: true, placeholder: 'e.g. Spreadsheets, HubSpot, a competitor' },
      {
        key: 'awarenessLevel', label: 'How aware are they of the problem?', type: 'radio', required: true,
        options: [
          { value: 'unaware', label: 'Unaware' },
          { value: 'problem_aware', label: 'Problem-aware' },
          { value: 'solution_aware', label: 'Solution-aware' },
          { value: 'product_aware', label: 'Product-aware' },
        ],
      },
    ],
  },
  {
    id: 'offer-experience',
    title: 'Offer & Product Experience',
    shortTitle: 'Offer',
    description: 'Understand conversion, activation, and retention',
    icon: 'Package',
    fields: [
      { key: 'coreFeatures', label: 'Core features / main outcome(s) your product delivers', type: 'textarea', required: true, placeholder: 'List your top 3–5 features or outcomes' },
      { key: 'firstValueMoment', label: 'What is the first "value moment" users experience?', type: 'textarea', required: true, placeholder: 'e.g. First report generated within 5 minutes' },
      { key: 'activationEvent', label: 'What action defines an activated user?', type: 'text', required: true, placeholder: 'e.g. Connects their first data source' },
      { key: 'retentionDrivers', label: 'What keeps your best customers using the product?', type: 'textarea', required: true, placeholder: 'e.g. Daily reporting habit, team collaboration...' },
    ],
  },
  {
    id: 'pricing-economics',
    title: 'Pricing & Economics',
    shortTitle: 'Pricing',
    description: 'Anchor CAC strategy and scaling potential',
    icon: 'TrendingUp',
    fields: [
      { key: 'pricingTiers', label: 'List your pricing tiers', type: 'textarea', required: true, placeholder: 'e.g. Starter $49/mo, Growth $199/mo, Enterprise custom' },
      { key: 'targetPlan', label: "What is your target customer's typical plan?", type: 'text', required: false, placeholder: 'e.g. Growth plan', description: 'optional — sharpens economics' },
      { key: 'avgLtv', label: 'Average LTV', type: 'text', required: false, placeholder: 'e.g. $2,400', description: 'optional — sharpens economics' },
      { key: 'targetCac', label: 'Target CAC', type: 'text', required: false, placeholder: 'e.g. $400', description: 'optional — sharpens economics' },
      { key: 'targetTrialsPerMonth', label: 'Target trials / leads per month', type: 'text', required: false, placeholder: 'e.g. 120', description: 'optional — surfaces the projected-vs-goal gap in the media plan' },
      { key: 'monthlyAdBudget', label: 'Monthly ad budget (or planned budget)', type: 'text', required: true, placeholder: 'e.g. $10,000/mo' },
    ],
  },
  {
    id: 'competition-positioning',
    title: 'Competition & Positioning',
    shortTitle: 'Compete',
    description: 'Differentiate ads and messaging',
    icon: 'Sparkles',
    fields: [
      { key: 'topCompetitors', label: 'Who are your top competitors (minimum 3)?', type: 'textarea', required: true, placeholder: 'Competitor A, Competitor B, Competitor C...' },
      { key: 'whyCustomersChooseYou', label: 'Why do customers choose you over alternatives?', type: 'textarea', required: true, placeholder: 'e.g. Faster onboarding, better integrations...' },
      { key: 'lossReasons', label: 'In deals you lose, what do prospects say before choosing a competitor?', type: 'textarea', required: true, placeholder: 'e.g. "Too expensive", "Missing feature X"...' },
      { key: 'competitorAdvantages', label: 'What do competitors do better than you?', type: 'textarea', required: true, placeholder: 'Be honest — this fuels positioning strategy' },
    ],
  },
  {
    id: 'goals-strategy',
    title: 'Goals & Strategy',
    shortTitle: 'Goals',
    description: 'Define what success looks like so GTM aligns',
    icon: 'Target',
    fields: [
      { key: 'primaryGoal90Days', label: 'What is your primary goal in the next 90 days?', type: 'textarea', required: true, placeholder: 'e.g. 50 qualified demos, $500K new ARR...' },
      { key: 'monthlyPipelineTarget', label: 'Monthly pipeline target ($ or # of demos)', type: 'text', required: false, placeholder: 'e.g. $200K pipeline or 40 demos/mo', description: 'optional' },
      { key: 'commonObjections', label: 'Common objections from prospects', type: 'textarea', required: true, placeholder: 'e.g. "We already have X", "Not the right time"...' },
      { key: 'keyPromises', label: 'Key promises / outcomes you want to be known for', type: 'textarea', required: true, placeholder: 'e.g. "10x faster reporting"' },
      { key: 'brandPositioning', label: 'Current brand positioning (1–2 sentences)', type: 'textarea', required: true, placeholder: 'e.g. "We help [ICP] achieve [outcome] without [pain]"' },
    ],
  },
  {
    id: 'current-marketing',
    title: 'Current Marketing & Performance',
    shortTitle: 'Marketing',
    description: 'Diagnose what\'s working and where to fix',
    icon: 'Route',
    fields: [
      {
        key: 'channels', label: 'What channels are you currently running?', type: 'checkbox', required: false,
        options: [
          { value: 'meta', label: 'Meta' },
          { value: 'google', label: 'Google' },
          { value: 'linkedin', label: 'LinkedIn' },
          { value: 'cold_email', label: 'Cold Email' },
          { value: 'outbound', label: 'Outbound' },
          { value: 'organic', label: 'Organic' },
          { value: 'other', label: 'Other' },
        ],
        description: 'optional — leave blank if not running ads yet',
      },
      { key: 'budgetSplit', label: 'Budget split per channel', type: 'textarea', required: false, placeholder: 'e.g. Meta 50%, Google 30%, LinkedIn 20%', description: 'optional' },
      { key: 'whatsWorking', label: "What's working right now?", type: 'textarea', required: false, placeholder: 'Channels, campaigns, offers that are performing', description: 'optional' },
      { key: 'whatsNotWorking', label: "What's not working?", type: 'textarea', required: false, placeholder: 'Channels or tactics that are underperforming', description: 'optional' },
      { key: 'currentCac', label: 'Current CAC', type: 'text', required: false, placeholder: 'e.g. $600', description: 'optional' },
      { key: 'monthlyRevenue', label: 'Monthly revenue (MRR or ARR)', type: 'text', required: false, placeholder: 'e.g. $50K MRR', description: 'optional' },
      { key: 'avgSalesCycle', label: 'Average sales cycle length', type: 'text', required: false, placeholder: 'e.g. 30 days', description: 'if sales-led' },
      { key: 'visitorToSignup', label: 'Website visitor → signup %', type: 'text', required: false, placeholder: 'e.g. 3%', description: 'optional funnel metric' },
      { key: 'signupToActivation', label: 'Signup → activation %', type: 'text', required: false, placeholder: 'e.g. 40%', description: 'optional funnel metric' },
      { key: 'activationToPaid', label: 'Activation → paid %', type: 'text', required: false, placeholder: 'e.g. 15%', description: 'optional funnel metric' },
      { key: 'demoToClose', label: 'Demo → close rate', type: 'text', required: false, placeholder: 'e.g. 25%', description: 'if applicable' },
      { key: 'growthTrend', label: 'Last 3–6 months growth trend', type: 'text', required: false, placeholder: 'e.g. +20% MoM, flat, declining', description: 'optional' },
    ],
  },
  {
    id: 'media-plan-setup',
    title: 'Media Plan Setup',
    shortTitle: 'Media',
    description: 'Provide the sales-process inputs the paid media plan needs',
    icon: 'UploadCloud',
    fields: [
      {
        key: 'salesProcessDocs',
        label: 'Sales-process SOP links',
        type: 'sales-process-docs',
        required: false,
        description: 'up to 4 docs',
      },
      {
        key: 'salesLoomUrl',
        label: 'Sales-process Loom',
        type: 'text',
        required: false,
        placeholder: 'https://www.loom.com/share/...',
        description: 'optional',
      },
      {
        key: 'creativeCapacity', label: 'Creative production capacity', type: 'radio', required: false,
        options: [
          { value: 'lean', label: 'Lean (5 static + 3 video)' },
          { value: 'standard', label: 'Standard (5 static + 5 video)' },
          { value: 'high', label: 'High-volume testing' },
        ],
        description: 'optional',
      },
      {
        key: 'leadListAvailable',
        label: 'Do you have a 5–10k lead/account list available?',
        type: 'boolean-radio',
        required: false,
        description: 'optional',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Default empty state
// ---------------------------------------------------------------------------

export const EMPTY_ONBOARDING_V2: OnboardingV2Data = {
  companyName: '',
  productDescription: '',
  builtFor: '',
  salesMotion: '',
  pricingModel: '',
  conversionPath: '',
  acv: '',
  idealCustomer: '',
  industry: '',
  jobTitles: '',
  companySize: '',
  geographicFocus: '',
  triggers: '',
  currentAlternative: '',
  awarenessLevel: '',
  coreFeatures: '',
  firstValueMoment: '',
  activationEvent: '',
  retentionDrivers: '',
  pricingTiers: '',
  targetPlan: '',
  avgLtv: '',
  targetCac: '',
  targetTrialsPerMonth: '',
  monthlyAdBudget: '',
  topCompetitors: '',
  whyCustomersChooseYou: '',
  lossReasons: '',
  competitorAdvantages: '',
  primaryGoal90Days: '',
  monthlyPipelineTarget: '',
  commonObjections: '',
  keyPromises: '',
  brandPositioning: '',
  gtmMotion: '',
  salesProcessDocs: [],
  salesLoomUrl: '',
  creativeCapacity: '',
  leadListAvailable: null,
  channels: [],
  budgetSplit: '',
  whatsWorking: '',
  whatsNotWorking: '',
  currentCac: '',
  monthlyRevenue: '',
  avgSalesCycle: '',
  visitorToSignup: '',
  signupToActivation: '',
  activationToPaid: '',
  demoToClose: '',
  growthTrend: '',
};
