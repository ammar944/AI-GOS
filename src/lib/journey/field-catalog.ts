// ============================================================================
// Journey Field Catalog — v3 onboarding flow
// Source of truth: AIGOS Onboarding Flow.docx
// Field names and groupings match the doc exactly. Legacy fields have been
// retired where the doc did not carry them forward.
//
// Each field's purpose is annotated with what it UNLOCKS downstream — runners
// and media-plan skills should key off these fields directly rather than
// re-inferring from narrative context.
// ============================================================================

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
  key:
    | 'topCompetitors'
    | 'productDescription'
    | 'primaryIcpDescription'
    | 'pricingContext'
    | 'salesMotion'
    | 'pricingModel'
    | 'conversionPath'
    | 'avgAcv'
    | 'targetCustomer';
  label: string;
  fieldKeys: readonly string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// JOURNEY_FIELDS — master field registry, one entry per field key
// ─────────────────────────────────────────────────────────────────────────────

export const JOURNEY_FIELDS: readonly JourneyFieldDefinition[] = [
  // §1 Product & Revenue Model
  // UNLOCKS: funnel type · channel strategy · CAC target · messaging frame · copy anchors · targeting
  { key: 'companyName', label: 'Company Name', category: 'research-enrichment', section: null, collectionMode: 'either', prefillVisible: true },
  { key: 'websiteUrl', label: 'Website', category: 'research-enrichment', section: null, collectionMode: 'either' },
  { key: 'productDescription', label: 'Product Description', category: 'required-blocker', section: 'offerAnalysis', collectionMode: 'either', prefillVisible: true },
  { key: 'targetCustomer', label: 'Target Customer', category: 'required-blocker', section: 'icpValidation', collectionMode: 'either', prefillVisible: true },
  { key: 'salesMotion', label: 'Sales Motion', category: 'required-blocker', section: 'industryMarket', collectionMode: 'either', prefillVisible: true },
  { key: 'pricingModel', label: 'Pricing Model', category: 'required-blocker', section: 'offerAnalysis', collectionMode: 'either', prefillVisible: true },
  { key: 'conversionPath', label: 'Conversion Path', category: 'required-blocker', section: 'offerAnalysis', collectionMode: 'either', prefillVisible: true },
  { key: 'avgAcv', label: 'Avg Contract Value', category: 'required-blocker', section: 'offerAnalysis', collectionMode: 'either', prefillVisible: true },

  // §2 ICP + Pain
  // UNLOCKS: precise targeting · trigger-based hooks · switch-from-X positioning · awareness-sophistication messaging
  { key: 'primaryIcpDescription', label: 'Ideal Customer Profile', category: 'required-blocker', section: 'icpValidation', collectionMode: 'either', prefillVisible: true },
  { key: 'industryVertical', label: 'Industry Vertical', category: 'required-blocker', section: 'icpValidation', collectionMode: 'either', prefillVisible: true },
  { key: 'jobTitles', label: 'Target Job Titles', category: 'section-followup', section: 'icpValidation', collectionMode: 'either', prefillVisible: true },
  { key: 'companySize', label: 'Company Size', category: 'section-followup', section: 'icpValidation', collectionMode: 'either', prefillVisible: true },
  { key: 'geography', label: 'Geographic Focus', category: 'section-followup', section: 'icpValidation', collectionMode: 'either', prefillVisible: true },
  { key: 'buyingTriggers', label: 'Buying Triggers', category: 'section-followup', section: 'icpValidation', collectionMode: 'manual' },
  { key: 'currentAlternative', label: 'Current Alternative', category: 'section-followup', section: 'icpValidation', collectionMode: 'manual' },

  // §3 Offer & Product Experience
  // UNLOCKS: correct funnel · value-based angles · activation-aligned landing pages · retention-aware messaging
  { key: 'coreDeliverables', label: 'Core Features / Outcomes', category: 'required-blocker', section: 'offerAnalysis', collectionMode: 'either', prefillVisible: true },
  { key: 'firstValueMoment', label: 'First Value Moment', category: 'section-followup', section: 'offerAnalysis', collectionMode: 'manual' },
  { key: 'activationEvent', label: 'Activation Event', category: 'section-followup', section: 'offerAnalysis', collectionMode: 'manual' },
  { key: 'retentionDrivers', label: 'Retention Drivers', category: 'section-followup', section: 'offerAnalysis', collectionMode: 'manual' },

  // §4 Pricing & Economics
  // UNLOCKS: CAC targets · volume vs quality strategy · highest-value offer · budget allocation
  { key: 'pricingTiers', label: 'Pricing Tiers', category: 'section-followup', section: 'offerAnalysis', collectionMode: 'either', prefillVisible: true },
  { key: 'targetPlan', label: 'Target Plan', category: 'section-followup', section: 'offerAnalysis', collectionMode: 'manual' },
  { key: 'monthlyAdBudget', label: 'Monthly Ad Budget', category: 'required-blocker', section: 'offerAnalysis', collectionMode: 'either' },
  { key: 'avgCustomerLtv', label: 'Avg Customer LTV', category: 'section-followup', section: 'offerAnalysis', collectionMode: 'manual', prefillVisible: false },
  { key: 'targetCac', label: 'Target CAC', category: 'section-followup', section: 'crossAnalysis', collectionMode: 'manual' },

  // §5 Competition & Positioning
  // UNLOCKS: us-vs-them ads · objection-based hooks · positioning gaps · differentiation angles · comparison LPs
  { key: 'topCompetitors', label: 'Top Competitors', category: 'required-blocker', section: 'competitors', collectionMode: 'either', prefillVisible: true },
  { key: 'uniqueEdge', label: 'Why Customers Choose You', category: 'required-blocker', section: 'competitors', collectionMode: 'either', prefillVisible: true },
  { key: 'lossReasons', label: 'Loss Reasons', category: 'section-followup', section: 'competitors', collectionMode: 'manual' },
  { key: 'competitorStrengths', label: 'Competitor Strengths', category: 'section-followup', section: 'competitors', collectionMode: 'manual' },

  // §6 Goals & Strategy
  // UNLOCKS: goal-aligned GTM · CAC/pipeline benchmarks · objection-based creatives · consistent messaging · right growth lever
  { key: 'goals', label: 'Primary 90-Day Goal', category: 'required-blocker', section: 'crossAnalysis', collectionMode: 'either' },
  { key: 'pipelineTarget', label: 'Monthly Pipeline Target', category: 'section-followup', section: 'crossAnalysis', collectionMode: 'manual' },
  { key: 'commonObjections', label: 'Common Objections', category: 'section-followup', section: 'crossAnalysis', collectionMode: 'either', prefillVisible: true },
  { key: 'keyPromises', label: 'Key Promises / Outcomes', category: 'section-followup', section: 'crossAnalysis', collectionMode: 'manual' },
  { key: 'brandPositioning', label: 'Brand Positioning', category: 'required-blocker', section: 'crossAnalysis', collectionMode: 'either', prefillVisible: true },

  // §7 Current Marketing & Performance
  // UNLOCKS: biggest growth constraint · budget reallocation · funnel leak diagnosis · SaaS benchmarking · stage-appropriate scaling
  { key: 'channels', label: 'Channels', category: 'required-blocker', section: 'crossAnalysis', collectionMode: 'manual' },
  { key: 'channelBudgetSplit', label: 'Channel Budget Split', category: 'section-followup', section: 'crossAnalysis', collectionMode: 'manual' },
  { key: 'whatIsWorking', label: "What's Working", category: 'section-followup', section: 'crossAnalysis', collectionMode: 'manual' },
  { key: 'whatIsNotWorking', label: "What's Not Working", category: 'section-followup', section: 'crossAnalysis', collectionMode: 'manual' },
  { key: 'currentCac', label: 'Current CAC', category: 'section-followup', section: 'offerAnalysis', collectionMode: 'manual', prefillVisible: false },
  { key: 'monthlyRevenue', label: 'Monthly Revenue (MRR/ARR)', category: 'section-followup', section: 'offerAnalysis', collectionMode: 'manual' },
  { key: 'salesCycleLength', label: 'Avg Sales Cycle Length', category: 'section-followup', section: 'crossAnalysis', collectionMode: 'manual' },
  // Optional funnel metrics
  { key: 'visitorToSignupPct', label: 'Visitor → Signup %', category: 'section-followup', section: 'crossAnalysis', collectionMode: 'manual' },
  { key: 'signupToActivationPct', label: 'Signup → Activation %', category: 'section-followup', section: 'crossAnalysis', collectionMode: 'manual' },
  { key: 'activationToPaidPct', label: 'Activation → Paid %', category: 'section-followup', section: 'crossAnalysis', collectionMode: 'manual' },
  { key: 'demoToCloseRate', label: 'Demo → Close Rate', category: 'section-followup', section: 'crossAnalysis', collectionMode: 'manual' },
  { key: 'last3to6MoGrowthTrend', label: 'Last 3-6 Month Growth Trend %', category: 'section-followup', section: 'offerAnalysis', collectionMode: 'manual', prefillVisible: false },

  // Research enrichment (scraped, auto-populated — not user-visible in the onboarding form)
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

// ─────────────────────────────────────────────────────────────────────────────
// Required-blocker manual entry metadata (placeholder/helper/rows for form UI)
// ─────────────────────────────────────────────────────────────────────────────

export const JOURNEY_MANUAL_BLOCKER_FIELDS: readonly JourneyManualFieldDefinition[] = [
  {
    key: 'productDescription',
    label: 'What does your product do?',
    placeholder: 'We run paid media and pipeline-focused demand gen systems for B2B SaaS companies.',
    helper: 'Describe what the customer actually buys from you.',
    rows: 3,
    required: true,
  },
  {
    key: 'targetCustomer',
    label: 'Who is it built for?',
    placeholder: 'Growth-stage B2B SaaS founders and marketing leads.',
    helper: 'Short one-liner — the detailed ICP comes in the next section.',
    rows: 2,
    required: true,
  },
  {
    key: 'salesMotion',
    label: 'How do customers buy?',
    placeholder: 'Product-led / Sales-led / Hybrid',
    helper: 'Product-led = self-serve signup. Sales-led = demo then close. Hybrid = mix.',
    rows: 1,
    required: true,
  },
  {
    key: 'pricingModel',
    label: 'What is your pricing model?',
    placeholder: 'Subscription / Usage-based / Per seat / One-time + subscription',
    helper: 'Pick the dominant structure. Mixed plans can be described in Pricing Tiers later.',
    rows: 1,
    required: true,
  },
  {
    key: 'conversionPath',
    label: 'How do customers convert?',
    placeholder: 'Free trial / Freemium / Demo required / Direct checkout',
    helper: 'The path from interested visitor to paying customer.',
    rows: 1,
    required: true,
  },
  {
    key: 'avgAcv',
    label: 'Average price or ACV',
    placeholder: '<$1K / $1K–$10K / $10K–$50K / $50K+',
    helper: 'Annual contract value. Anchors CAC targets and channel strategy.',
    rows: 1,
    required: true,
  },
  {
    key: 'primaryIcpDescription',
    label: 'Describe your ideal customer',
    placeholder: 'Seed to Series B B2B SaaS teams that need pipeline growth without building a full in-house demand gen function.',
    helper: 'Company + persona. Rich detail fuels targeting and messaging.',
    rows: 4,
    required: true,
  },
  {
    key: 'topCompetitors',
    label: 'Top Competitors (minimum 3)',
    placeholder: 'Hey Digital, Sales Captain, Growth Marketing Pro',
    helper: 'Name the 3+ agencies or platforms prospects compare you against most.',
    rows: 2,
    required: true,
  },
  {
    key: 'uniqueEdge',
    label: 'Why do customers choose you over alternatives?',
    placeholder: 'We are deeply specialized in B2B SaaS and tie campaigns directly to pipeline, not vanity metrics.',
    helper: 'Your differentiation. Fuels ad angles and positioning.',
    rows: 2,
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
    label: 'Primary goal in the next 90 days',
    placeholder: 'More qualified demos, lower CAC, and better pipeline attribution.',
    helper: 'Defines strategy direction — scale vs optimize vs fix conversion.',
    rows: 2,
    required: true,
  },
  {
    key: 'industryVertical',
    label: 'Industry / Vertical',
    placeholder: 'B2B SaaS — Revenue Attribution / Marketing Analytics',
    helper: 'The vertical you compete in. Drives keyword, ad, and competitor research.',
    rows: 1,
    required: true,
  },
  {
    key: 'coreDeliverables',
    label: 'Core deliverables / features',
    placeholder: 'Multi-touch attribution, pipeline reporting, HubSpot + Salesforce sync, CAC payback dashboards.',
    helper: 'Concrete features or services the customer actually uses. Fuels benefit-led ad copy.',
    rows: 3,
    required: true,
  },
  {
    key: 'brandPositioning',
    label: 'Brand positioning statement',
    placeholder: 'The attribution platform built for B2B SaaS teams who need pipeline truth without a data engineer.',
    helper: 'One-sentence positioning. Anchors tone, messaging frame, and hero copy.',
    rows: 2,
    required: true,
  },
  {
    key: 'channels',
    label: 'Active acquisition channels',
    placeholder: 'Meta, Google, LinkedIn, Outbound',
    helper: 'Which channels are currently running or planned. Informs media-plan prioritization.',
    rows: 1,
    required: true,
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Optional / enrichment field metadata (placeholder/helper/rows for form UI)
// ─────────────────────────────────────────────────────────────────────────────

export const JOURNEY_ENRICHMENT_FIELD_METAS: readonly JourneyManualFieldDefinition[] = [
  // §2 ICP + Pain
  {
    key: 'buyingTriggers',
    label: 'What triggers them to look for a solution?',
    placeholder: 'New CMO hire, board pressure for attribution, scaling paid ads, preparing for Series B fundraise.',
    helper: 'Real-world events that push prospects into the market. Fuels trigger-based ad hooks.',
    rows: 3,
  },
  {
    key: 'currentAlternative',
    label: 'What are they currently using instead?',
    placeholder: 'Spreadsheets, HubSpot native attribution, an in-house freelancer, or nothing.',
    helper: "Their status quo. Anchors 'switch from X to Y' positioning.",
    rows: 2,
  },

  // §3 Offer & Product Experience
  {
    key: 'firstValueMoment',
    label: 'What is the first value moment users experience?',
    placeholder: 'Seeing their first attribution report with real pipeline data, usually within 2 minutes of connecting HubSpot.',
    helper: 'Determines how aggressively you can convert users.',
    rows: 2,
  },
  {
    key: 'activationEvent',
    label: 'What action defines an activated user?',
    placeholder: 'Connected 3+ integrations and viewed the unified dashboard at least twice in week 1.',
    helper: 'Anchors what you actually optimize for (not vanity metrics).',
    rows: 2,
  },
  {
    key: 'retentionDrivers',
    label: 'What keeps your best customers using the product?',
    placeholder: 'Weekly attribution updates tied to their board reporting cadence.',
    helper: 'Reveals what truly delivers value and should be emphasized in messaging.',
    rows: 2,
  },

  // §4 Pricing & Economics
  {
    key: 'targetPlan',
    label: "What is your target customer's typical plan?",
    placeholder: 'Pro $997/mo — our growth-stage sweet spot.',
    helper: 'Focuses acquisition on revenue-driving users.',
    rows: 2,
  },
  {
    key: 'avgCustomerLtv',
    label: 'Average Customer LTV',
    placeholder: 'e.g. $3,600 — total revenue per customer over their lifetime',
    helper: 'Sets the ceiling for how much you can spend to acquire. Leave blank if unknown.',
    rows: 1,
  },
  {
    key: 'targetCac',
    label: 'Target CAC',
    placeholder: 'e.g. $450 — what you want to pay to acquire a customer',
    helper: 'Anchors performance expectations and channel profitability decisions.',
    rows: 1,
  },

  // §5 Competition & Positioning
  {
    key: 'lossReasons',
    label: 'In deals you lose, what do prospects say before choosing a competitor?',
    placeholder: 'They went with HubSpot because it was already bundled in their contract.',
    helper: 'Fuels objection handling and creative angles.',
    rows: 3,
  },
  {
    key: 'competitorStrengths',
    label: 'What do competitors do better than you?',
    placeholder: 'Dreamdata has a more polished UI. Bizible has deeper Salesforce integrations.',
    helper: 'Honest competitive self-assessment. Informs positioning strategy.',
    rows: 3,
  },

  // §6 Goals & Strategy
  {
    key: 'pipelineTarget',
    label: 'Monthly pipeline target ($ or # of demos)',
    placeholder: '$500k in SQL pipeline per month, or 60 qualified demos.',
    helper: 'Sets measurable output targets for campaigns.',
    rows: 1,
  },
  {
    key: 'commonObjections',
    label: 'Common objections from prospects',
    placeholder: 'We already have Google Analytics. Our data is too messy. We tried Bizible and it was a nightmare.',
    helper: 'Fuels high-converting ad hooks and sales enablement.',
    rows: 3,
  },
  {
    key: 'keyPromises',
    label: 'Key promises / outcomes you want to be known for',
    placeholder: 'Cut wasted ad spend by 30% in 90 days. Board-ready attribution in 2 weeks.',
    helper: 'Defines core messaging and value proposition.',
    rows: 3,
  },
  {
    key: 'brandPositioning',
    label: 'Current brand positioning (1–2 sentences)',
    placeholder: "The 'easy button' for marketing attribution — affordable, fast to implement.",
    helper: 'Ensures consistency across ads, pages, and sales.',
    rows: 2,
  },

  // §7 Current Marketing & Performance
  {
    key: 'channels',
    label: 'What channels are you currently running?',
    placeholder: 'Meta, LinkedIn, Cold Email',
    helper: 'Select all that apply: Meta, Google, LinkedIn, Cold Email, Outbound, Organic, Other.',
    rows: 1,
  },
  {
    key: 'channelBudgetSplit',
    label: 'Budget split per channel',
    placeholder: 'Meta $8k, LinkedIn $3k, Cold Email $2k.',
    helper: 'Reveals where attention and spend are currently going.',
    rows: 2,
  },
  {
    key: 'whatIsWorking',
    label: "What's working right now?",
    placeholder: 'Meta LAL 1% + UGC testimonial hooks — 2.1x ROAS.',
    helper: 'Surfaces winning angles and channels to double down on.',
    rows: 3,
  },
  {
    key: 'whatIsNotWorking',
    label: "What's not working?",
    placeholder: 'LinkedIn job-title + static images is flat. Google Search not set up yet.',
    helper: 'Highlights inefficiencies and wasted spend to cut or fix.',
    rows: 3,
  },
  {
    key: 'currentCac',
    label: 'Current CAC',
    placeholder: 'e.g. $450 — what one customer currently costs to acquire',
    helper: 'Anchors profitability and scaling potential.',
    rows: 1,
  },
  {
    key: 'monthlyRevenue',
    label: 'Monthly revenue (MRR or ARR)',
    placeholder: '$50K MRR or $600K ARR',
    helper: 'Defines growth stage and strategy complexity.',
    rows: 1,
  },
  {
    key: 'salesCycleLength',
    label: 'Average sales cycle length (if sales-led)',
    placeholder: '14–30 days, or however long typical deals take.',
    helper: 'Relevant mostly for sales-led motions.',
    rows: 1,
  },
  // Optional funnel metrics
  {
    key: 'visitorToSignupPct',
    label: 'Visitor → Signup %',
    placeholder: 'e.g. 3 (means 3% of visitors sign up)',
    helper: 'Top-of-funnel conversion rate. Optional.',
    rows: 1,
  },
  {
    key: 'signupToActivationPct',
    label: 'Signup → Activation %',
    placeholder: 'e.g. 40 (means 40% of signups activate)',
    helper: 'How many signups become active users. Optional.',
    rows: 1,
  },
  {
    key: 'activationToPaidPct',
    label: 'Activation → Paid %',
    placeholder: 'e.g. 15 (means 15% of activated users convert to paid)',
    helper: 'Activation-to-revenue conversion. Optional.',
    rows: 1,
  },
  {
    key: 'demoToCloseRate',
    label: 'Demo → Close Rate',
    placeholder: 'e.g. 25 (means 25% of demos close)',
    helper: 'Sales-led close rate. Optional.',
    rows: 1,
  },
  {
    key: 'last3to6MoGrowthTrend',
    label: 'Last 3–6 Month Growth Trend %',
    placeholder: "e.g. 25 (means 25% — leave blank if you don't track it)",
    helper: 'Trailing 3–6 month revenue growth rate. Used to gate growth-rate claims in the plan.',
    rows: 1,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Wave-two dispatch requirements
// ─────────────────────────────────────────────────────────────────────────────

export const JOURNEY_WAVE_TWO_REQUIREMENTS: readonly JourneyRequirementDefinition[] = [
  { key: 'topCompetitors', label: 'competitors', fieldKeys: ['topCompetitors'] },
  { key: 'productDescription', label: 'product description', fieldKeys: ['productDescription'] },
  { key: 'primaryIcpDescription', label: 'ICP specifics', fieldKeys: ['primaryIcpDescription'] },
  { key: 'targetCustomer', label: 'target customer', fieldKeys: ['targetCustomer'] },
  { key: 'salesMotion', label: 'sales motion', fieldKeys: ['salesMotion'] },
  { key: 'pricingModel', label: 'pricing model', fieldKeys: ['pricingModel'] },
  { key: 'conversionPath', label: 'conversion path', fieldKeys: ['conversionPath'] },
  { key: 'avgAcv', label: 'average contract value', fieldKeys: ['avgAcv'] },
  { key: 'pricingContext', label: 'pricing or budget', fieldKeys: ['pricingTiers', 'monthlyAdBudget'] },
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

// ─────────────────────────────────────────────────────────────────────────────
// Group / Set exports for field-group UI rendering
// ─────────────────────────────────────────────────────────────────────────────

export interface JourneyFieldGroupMeta {
  id: string;
  label: string;
  fieldKeys: string[];
}

/** Required field keys (required: true in manual blocker definitions) */
export const JOURNEY_REQUIRED_FIELD_KEYS: ReadonlySet<string> = new Set(
  JOURNEY_MANUAL_BLOCKER_FIELDS
    .filter((f) => f.required)
    .map((f) => f.key),
);

/** Pricing-context group keys (requiredGroup: 'pricingContext') — at least one must be filled */
export const JOURNEY_PRICING_GROUP_KEYS: ReadonlySet<string> = new Set(
  JOURNEY_MANUAL_BLOCKER_FIELDS
    .filter((f) => f.requiredGroup === 'pricingContext')
    .map((f) => f.key),
);

/** Fields that should render as multiline inputs (rows > 1) */
export const JOURNEY_MULTILINE_FIELDS: ReadonlySet<string> = new Set(
  [...JOURNEY_MANUAL_BLOCKER_FIELDS, ...JOURNEY_ENRICHMENT_FIELD_METAS]
    .filter((f) => f.rows > 1)
    .map((f) => f.key),
);

/** Enum-backed single-select fields */
export const JOURNEY_ENUM_FIELD_KEYS: ReadonlySet<string> = new Set([
  'salesMotion',
  'pricingModel',
  'conversionPath',
  'avgAcv',
]);

/** Multi-select array fields */
export const JOURNEY_MULTI_SELECT_FIELD_KEYS: ReadonlySet<string> = new Set([
  'channels',
]);

/** Get manual blocker metadata for a field key (placeholder, helper, rows) */
export function getManualBlockerMeta(key: string): JourneyManualFieldDefinition | undefined {
  return (
    JOURNEY_MANUAL_BLOCKER_FIELDS.find((f) => f.key === key) ??
    JOURNEY_ENRICHMENT_FIELD_METAS.find((f) => f.key === key)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// v3 field groups — 7 sections, matching the onboarding doc
// ─────────────────────────────────────────────────────────────────────────────

export const JOURNEY_FIELD_GROUPS: readonly JourneyFieldGroupMeta[] = [
  {
    id: 'product-revenue-model',
    label: 'Product & Revenue Model',
    fieldKeys: [
      'companyName',
      'productDescription',
      'targetCustomer',
      'salesMotion',
      'pricingModel',
      'conversionPath',
      'avgAcv',
    ],
  },
  {
    id: 'icp-pain',
    label: 'ICP + Pain',
    fieldKeys: [
      'primaryIcpDescription',
      'industryVertical',
      'jobTitles',
      'companySize',
      'geography',
      'buyingTriggers',
      'currentAlternative',
    ],
  },
  {
    id: 'offer-experience',
    label: 'Offer & Product Experience',
    fieldKeys: [
      'coreDeliverables',
      'firstValueMoment',
      'activationEvent',
      'retentionDrivers',
    ],
  },
  {
    id: 'pricing-economics',
    label: 'Pricing & Economics',
    fieldKeys: [
      'pricingTiers',
      'targetPlan',
      'monthlyAdBudget',
      'avgCustomerLtv',
      'targetCac',
    ],
  },
  {
    id: 'competition-positioning',
    label: 'Competition & Positioning',
    fieldKeys: [
      'topCompetitors',
      'uniqueEdge',
      'lossReasons',
      'competitorStrengths',
    ],
  },
  {
    id: 'goals-strategy',
    label: 'Goals & Strategy',
    fieldKeys: [
      'goals',
      'pipelineTarget',
      'commonObjections',
      'keyPromises',
      'brandPositioning',
    ],
  },
  {
    id: 'current-marketing',
    label: 'Current Marketing & Performance',
    fieldKeys: [
      'channels',
      'channelBudgetSplit',
      'whatIsWorking',
      'whatIsNotWorking',
      'currentCac',
      'monthlyRevenue',
      'salesCycleLength',
      // Optional funnel metrics (UI should hide behind a "show optional" toggle)
      'visitorToSignupPct',
      'signupToActivationPct',
      'activationToPaidPct',
      'demoToCloseRate',
      'last3to6MoGrowthTrend',
    ],
  },
];

/** Profile field groups — identical to JOURNEY_FIELD_GROUPS in v3 (no legacy superset needed) */
export const PROFILE_FIELD_GROUPS: readonly JourneyFieldGroupMeta[] = [
  {
    id: 'product-revenue-model',
    label: 'Product & Revenue Model',
    fieldKeys: [
      'companyName',
      'websiteUrl',
      'productDescription',
      'targetCustomer',
      'salesMotion',
      'pricingModel',
      'conversionPath',
      'avgAcv',
    ],
  },
  {
    id: 'icp-pain',
    label: 'ICP + Pain',
    fieldKeys: [
      'primaryIcpDescription',
      'industryVertical',
      'jobTitles',
      'companySize',
      'geography',
      'buyingTriggers',
      'currentAlternative',
    ],
  },
  {
    id: 'offer-experience',
    label: 'Offer & Product Experience',
    fieldKeys: [
      'coreDeliverables',
      'firstValueMoment',
      'activationEvent',
      'retentionDrivers',
    ],
  },
  {
    id: 'pricing-economics',
    label: 'Pricing & Economics',
    fieldKeys: [
      'pricingTiers',
      'targetPlan',
      'monthlyAdBudget',
      'avgCustomerLtv',
      'targetCac',
    ],
  },
  {
    id: 'competition-positioning',
    label: 'Competition & Positioning',
    fieldKeys: [
      'topCompetitors',
      'uniqueEdge',
      'lossReasons',
      'competitorStrengths',
    ],
  },
  {
    id: 'goals-strategy',
    label: 'Goals & Strategy',
    fieldKeys: [
      'goals',
      'pipelineTarget',
      'commonObjections',
      'keyPromises',
      'brandPositioning',
    ],
  },
  {
    id: 'current-marketing',
    label: 'Current Marketing & Performance',
    fieldKeys: [
      'channels',
      'channelBudgetSplit',
      'whatIsWorking',
      'whatIsNotWorking',
      'currentCac',
      'monthlyRevenue',
      'salesCycleLength',
      'visitorToSignupPct',
      'signupToActivationPct',
      'activationToPaidPct',
      'demoToCloseRate',
      'last3to6MoGrowthTrend',
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Enum types + option arrays for v3 single-select / multi-select fields
// ─────────────────────────────────────────────────────────────────────────────

export type SalesMotion = 'product-led' | 'sales-led' | 'hybrid';

export const SALES_MOTION_OPTIONS: readonly { value: SalesMotion; label: string; helper: string }[] = [
  { value: 'product-led', label: 'Product-led (self-serve)', helper: 'Customers sign up and start using the product without talking to sales.' },
  { value: 'sales-led', label: 'Sales-led (demo → close)', helper: 'Customers book a demo and a sales rep walks them through the close.' },
  { value: 'hybrid', label: 'Hybrid', helper: 'Mix of self-serve and sales-led motions.' },
] as const;

/** Pricing archetype — named to avoid collision with legacy `PricingModel` in src/lib/onboarding/types.ts */
export type PricingArchetype =
  | 'subscription'
  | 'usage-based'
  | 'per-seat'
  | 'one-time-plus-subscription';

export const PRICING_MODEL_OPTIONS: readonly { value: PricingArchetype; label: string }[] = [
  { value: 'subscription', label: 'Subscription (monthly / annual)' },
  { value: 'usage-based', label: 'Usage-based' },
  { value: 'per-seat', label: 'Per seat' },
  { value: 'one-time-plus-subscription', label: 'One-time + subscription' },
] as const;

export type ConversionPath = 'free-trial' | 'freemium' | 'demo-required' | 'direct-checkout';

export const CONVERSION_PATH_OPTIONS: readonly { value: ConversionPath; label: string }[] = [
  { value: 'free-trial', label: 'Free trial' },
  { value: 'freemium', label: 'Freemium' },
  { value: 'demo-required', label: 'Demo required' },
  { value: 'direct-checkout', label: 'Direct checkout' },
] as const;

export type AvgAcv = 'under-1k' | '1k-10k' | '10k-50k' | '50k-plus';

export const AVG_ACV_OPTIONS: readonly { value: AvgAcv; label: string }[] = [
  { value: 'under-1k', label: '<$1K' },
  { value: '1k-10k', label: '$1K–$10K' },
  { value: '10k-50k', label: '$10K–$50K' },
  { value: '50k-plus', label: '$50K+' },
] as const;

export type OnboardingChannel =
  | 'meta'
  | 'google'
  | 'linkedin'
  | 'cold-email'
  | 'outbound'
  | 'organic'
  | 'other';

export const CHANNEL_OPTIONS: readonly { value: OnboardingChannel; label: string }[] = [
  { value: 'meta', label: 'Meta' },
  { value: 'google', label: 'Google' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'cold-email', label: 'Cold Email' },
  { value: 'outbound', label: 'Outbound' },
  { value: 'organic', label: 'Organic' },
  { value: 'other', label: 'Other' },
] as const;

/** Fields that should render as multi-line textarea in profile edit */
export const PROFILE_MULTILINE_KEYS: ReadonlySet<string> = new Set([
  'primaryIcpDescription',
  'targetCustomer',
  'buyingTriggers',
  'currentAlternative',
  'productDescription',
  'coreDeliverables',
  'firstValueMoment',
  'activationEvent',
  'retentionDrivers',
  'targetPlan',
  'pricingTiers',
  'lossReasons',
  'competitorStrengths',
  'commonObjections',
  'keyPromises',
  'brandPositioning',
  'channelBudgetSplit',
  'whatIsWorking',
  'whatIsNotWorking',
]);
