export const GTM_ONBOARDING_SOURCE_DOCUMENT = 'AIGOS Onboarding Flow.docx';

export type GtmOnboardingResponseType = 'text' | 'single-select' | 'multi-select';

export interface GtmOnboardingQuestion {
  kind: 'question';
  id: string;
  answerKey: string;
  prompt: string;
  responseType: GtmOnboardingResponseType;
  options?: readonly string[];
  optional?: boolean;
}

export interface GtmOnboardingSubheading {
  kind: 'subheading';
  text: string;
}

export type GtmOnboardingItem = GtmOnboardingQuestion | GtmOnboardingSubheading;

export interface GtmOnboardingSection {
  id: string;
  heading: string;
  title: string;
  goal: string;
  items: readonly GtmOnboardingItem[];
  existingFieldChanges?: readonly string[];
  whyThisSetupWorks: readonly string[];
  unlocks: readonly string[];
}

export const GTM_ONBOARDING_QUESTIONNAIRE = [
  {
    id: 'business-basics',
    heading: 'Business Basics',
    title: 'Product & Revenue Model',
    goal: 'Understand how the product works + how it’s sold',
    items: [
      { kind: 'question', id: 'company-name', answerKey: 'companyName', prompt: 'Company Name', responseType: 'text' },
      {
        kind: 'question',
        id: 'product-saas-description',
        answerKey: 'productDescription',
        prompt: 'What does your product/SaaS do?',
        responseType: 'text',
      },
      {
        kind: 'question',
        id: 'target-customer-summary',
        answerKey: 'targetCustomer',
        prompt: 'Who is it built for?',
        responseType: 'text',
      },
      { kind: 'subheading', text: 'Sales Motion' },
      {
        kind: 'question',
        id: 'sales-motion',
        answerKey: 'salesMotion',
        prompt: 'How do customers buy?',
        responseType: 'single-select',
        options: ['Product-led (self-serve)', 'Sales-led (demo → close)', 'Hybrid'],
      },
      { kind: 'subheading', text: 'Pricing Structure' },
      {
        kind: 'question',
        id: 'pricing-model',
        answerKey: 'pricingModel',
        prompt: 'What is your pricing model?',
        responseType: 'single-select',
        options: ['Subscription (monthly / annual)', 'Usage-based', 'Per seat', 'One-time + subscription'],
      },
      { kind: 'subheading', text: 'Conversion Path' },
      {
        kind: 'question',
        id: 'conversion-path',
        answerKey: 'conversionPath',
        prompt: 'How do customers convert?',
        responseType: 'single-select',
        options: ['Free trial', 'Freemium', 'Demo required', 'Direct checkout'],
      },
      { kind: 'subheading', text: 'Deal Size' },
      {
        kind: 'question',
        id: 'average-acv',
        answerKey: 'avgAcv',
        prompt: 'What is your average price or ACV (contract value)?',
        responseType: 'single-select',
        options: ['<$1K', '$1K–$10K', '$10K–$50K', '$50K+'],
      },
    ],
    existingFieldChanges: ['Business Model → Repurposed to How do customers buy?'],
    whyThisSetupWorks: [
      '✅ How customers buy → defines funnel type (signup vs demo vs checkout)',
      '✅ Pricing model → shapes messaging (ROI, efficiency, scalability, cost)',
      '✅ Conversion path → determines CTA + landing page structure',
      '✅ ACV / price → sets CAC targets + channel strategy',
      '✅ What the product does → anchors all copy and positioning',
      '✅ Who it’s for → guides targeting + creative relevance',
    ],
    unlocks: [
      'Generate the correct funnel (PLG vs sales-led vs hybrid)',
      'Build channel strategy (Meta vs Google vs LinkedIn vs outbound)',
      'Write high-converting ad angles (trial vs demo vs ROI-driven)',
      'Design optimized landing pages (product-first vs demo-first vs offer-first)',
      'Set realistic CAC + conversion expectations',
      'Align marketing and sales strategy from day one',
    ],
  },
  {
    id: 'target-customer',
    heading: 'Target Customer',
    title: 'ICP + Pain',
    goal: 'Fuel targeting + messaging + creative',
    items: [
      {
        kind: 'question',
        id: 'ideal-customer',
        answerKey: 'primaryIcpDescription',
        prompt: 'Describe your ideal customer (company + persona)',
        responseType: 'text',
      },
      {
        kind: 'question',
        id: 'industry',
        answerKey: 'industryVertical',
        prompt: 'What industry do they operate in?',
        responseType: 'text',
      },
      {
        kind: 'question',
        id: 'job-titles',
        answerKey: 'jobTitles',
        prompt: 'What job titles do you sell to?',
        responseType: 'text',
      },
      {
        kind: 'question',
        id: 'company-size',
        answerKey: 'companySize',
        prompt: 'Company size (employees or revenue range)',
        responseType: 'text',
      },
      {
        kind: 'question',
        id: 'geographic-focus',
        answerKey: 'geography',
        prompt: 'Geographic focus',
        responseType: 'text',
      },
      { kind: 'subheading', text: 'Buying Context' },
      {
        kind: 'question',
        id: 'buying-triggers',
        answerKey: 'buyingTriggers',
        prompt: 'What triggers them to look for a solution like yours?',
        responseType: 'text',
      },
      {
        kind: 'question',
        id: 'current-alternative',
        answerKey: 'currentAlternative',
        prompt: 'What are they currently using instead?',
        responseType: 'text',
      },
      { kind: 'subheading', text: 'Awareness Level' },
      {
        kind: 'question',
        id: 'awareness-level',
        answerKey: 'awarenessLevel',
        prompt: 'How aware are they of the problem?',
        responseType: 'single-select',
        options: ['Unaware', 'Problem-aware', 'Solution-aware', 'Product-aware'],
      },
    ],
    whyThisSetupWorks: [
      '✅ Who they are → enables precise targeting (industry, role, company size, geo)',
      '✅ When they buy → fuels ad hooks based on real triggers',
      '✅ What they use today → anchors positioning and “switch from X” messaging',
      '✅ How aware they are → determines messaging sophistication (educate vs convert)',
    ],
    unlocks: [
      'Generate highly targeted ad audiences (especially LinkedIn & Meta)',
      'Write trigger-based hooks that convert faster',
      'Create “switch from X to Y” positioning angles',
      'Match messaging to awareness level (no more generic ads)',
      'Build ICP-specific landing pages and funnels',
      'Improve lead quality and reduce wasted ad spend',
    ],
  },
  {
    id: 'offer-product-experience',
    heading: 'Offer & Product Experience',
    title: 'Offer & Product Experience',
    goal: 'Understand conversion + activation + retention',
    items: [
      {
        kind: 'question',
        id: 'core-features-outcomes',
        answerKey: 'coreDeliverables',
        prompt: 'What are the core features / main outcome(s) your product delivers?',
        responseType: 'text',
      },
      {
        kind: 'question',
        id: 'first-value-moment',
        answerKey: 'firstValueMoment',
        prompt: 'What is the first “value moment” users experience?',
        responseType: 'text',
      },
      {
        kind: 'question',
        id: 'activation-event',
        answerKey: 'activationEvent',
        prompt: 'What action defines an activated user?',
        responseType: 'text',
      },
      { kind: 'subheading', text: 'Retention' },
      {
        kind: 'question',
        id: 'retention-drivers',
        answerKey: 'retentionDrivers',
        prompt: 'What keeps your best customers using the product?',
        responseType: 'text',
      },
    ],
    existingFieldChanges: [
      'Pricing tiers → Moved to Pricing & Economics',
      'Monthly Ad Budget → Moved to Pricing & Economics',
      'Guarantees → Removed',
      'Monthly Revenue Range → Removed',
      'Paying Customer Count → Removed',
    ],
    whyThisSetupWorks: [
      '✅ Core outcome → defines your value proposition and messaging',
      '✅ First value moment → determines how aggressively you can convert users',
      '✅ Activation event → anchors what you actually optimize for (not vanity metrics)',
      '✅ Retention drivers → reveals what truly delivers value and should be emphasized',
    ],
    unlocks: [
      'Generate the correct funnel (signup vs demo vs hybrid)',
      'Write high-converting value-based ad angles',
      'Align landing pages with product experience',
      'Optimize for activation, not just acquisition',
      'Improve retention-aware messaging and positioning',
    ],
  },
  {
    id: 'pricing-economics',
    heading: 'Pricing & Economics',
    title: 'Pricing & Economics',
    goal: 'Anchor CAC strategy and scaling potential',
    items: [
      {
        kind: 'question',
        id: 'pricing-tiers',
        answerKey: 'pricingTiers',
        prompt: 'List your pricing tiers',
        responseType: 'text',
      },
      {
        kind: 'question',
        id: 'target-plan',
        answerKey: 'targetPlan',
        prompt: 'What is your target customer’s typical plan?',
        responseType: 'text',
      },
      { kind: 'subheading', text: 'Unit Economics' },
      {
        kind: 'question',
        id: 'average-ltv',
        answerKey: 'avgCustomerLtv',
        prompt: 'Average LTV (if known)',
        responseType: 'text',
        optional: true,
      },
      {
        kind: 'question',
        id: 'target-cac-pricing',
        answerKey: 'targetCac',
        prompt: 'Target CAC (if known)',
        responseType: 'text',
        optional: true,
      },
      { kind: 'subheading', text: 'Investment Capacity' },
      {
        kind: 'question',
        id: 'monthly-ad-budget',
        answerKey: 'monthlyAdBudget',
        prompt: 'Monthly ad budget (or planned budget)',
        responseType: 'text',
      },
    ],
    whyThisSetupWorks: [
      '✅ Pricing tiers → defines how value is packaged',
      '✅ Target plan → focuses acquisition on revenue-driving users',
      '✅ LTV → sets the ceiling for how much you can spend',
      '✅ Target CAC → anchors performance expectations',
      '✅ Ad budget → determines speed and scale of execution',
    ],
    unlocks: [
      'Set realistic CAC targets',
      'Choose the right acquisition strategy (volume vs quality)',
      'Prioritize the highest-value offer in ads',
      'Allocate budget across channels effectively',
      'Avoid unprofitable scaling decisions',
    ],
  },
  {
    id: 'competition',
    heading: 'Competition',
    title: 'Competition & Positioning',
    goal: 'Differentiate ads + messaging',
    items: [
      {
        kind: 'question',
        id: 'top-competitors',
        answerKey: 'topCompetitors',
        prompt: 'Who are your top competitors (minimum 3)?',
        responseType: 'text',
      },
      {
        kind: 'question',
        id: 'unique-edge',
        answerKey: 'uniqueEdge',
        prompt: 'Why do customers choose you over alternatives?',
        responseType: 'text',
      },
      {
        kind: 'question',
        id: 'loss-reasons',
        answerKey: 'lossReasons',
        prompt: 'In deals you lose, what do prospects say before choosing a competitor?',
        responseType: 'text',
      },
      {
        kind: 'question',
        id: 'competitor-strengths',
        answerKey: 'competitorStrengths',
        prompt: 'What do competitors do better than you?',
        responseType: 'text',
      },
    ],
    whyThisSetupWorks: [
      '✅ Who they are → for targeting + research',
      '✅ Why you win → fuels ad angles',
      '✅ Why you lose → fuels objection handling + creatives',
      '✅ What competitors do better → informs positioning strategy',
    ],
    unlocks: [
      'Generate “us vs them” ads',
      'Write objection-based hooks',
      'Identify positioning gaps',
      'Create differentiation angles',
      'Build comparison landing pages',
    ],
  },
  {
    id: 'goals-strategy',
    heading: 'Goals & Strategy',
    title: 'Goals & Strategy',
    goal: 'Define what success looks like (so GTM aligns)',
    items: [
      {
        kind: 'question',
        id: 'primary-90-day-goal',
        answerKey: 'goals',
        prompt: 'What is your primary goal in the next 90 days?',
        responseType: 'text',
      },
      {
        kind: 'question',
        id: 'pipeline-target',
        answerKey: 'pipelineTarget',
        prompt: 'Monthly pipeline target ($ or # of demos)',
        responseType: 'text',
      },
      {
        kind: 'question',
        id: 'target-cac-goals',
        answerKey: 'targetCac',
        prompt: 'Target CAC',
        responseType: 'text',
      },
      { kind: 'subheading', text: 'Messaging Inputs' },
      {
        kind: 'question',
        id: 'common-objections',
        answerKey: 'commonObjections',
        prompt: 'Common objections from prospects',
        responseType: 'text',
      },
      {
        kind: 'question',
        id: 'key-promises',
        answerKey: 'keyPromises',
        prompt: 'Key promises / outcomes you want to be known for',
        responseType: 'text',
      },
      {
        kind: 'question',
        id: 'brand-positioning',
        answerKey: 'brandPositioning',
        prompt: 'Current brand positioning (1–2 sentences)',
        responseType: 'text',
      },
    ],
    existingFieldChanges: [
      'Desired Transformation → Removed',
      'Before State → Removed',
      'Current Marketing Activities → Moved to Current Marketing & Performance',
    ],
    whyThisSetupWorks: [
      '✅ Primary goal → defines strategy direction (scale vs optimize vs fix conversion)',
      '✅ Pipeline target → sets measurable output targets for campaigns',
      '✅ Target CAC → anchors profitability and channel decisions',
      '✅ Objections → fuels high-converting ad hooks and sales enablement',
      '✅ Key promises → defines core messaging and value proposition',
      '✅ Brand positioning → ensures consistency across ads, pages, and sales',
    ],
    unlocks: [
      'Generate goal-aligned GTM strategies',
      'Set clear CAC and pipeline benchmarks',
      'Write objection-based ad creatives',
      'Create consistent messaging across funnel',
      'Prioritize the right growth levers (traffic vs conversion vs sales)',
    ],
  },
  {
    id: 'current-performance',
    heading: 'Current Performance',
    title: 'Current Marketing & Performance',
    goal: 'Diagnose what’s working + where to fix',
    items: [
      {
        kind: 'question',
        id: 'channels',
        answerKey: 'channels',
        prompt: 'What channels are you currently running?',
        responseType: 'multi-select',
        options: ['Meta', 'Google', 'LinkedIn', 'Cold Email', 'Outbound', 'Organic', 'Other (specify)'],
      },
      {
        kind: 'question',
        id: 'channel-budget-split',
        answerKey: 'channelBudgetSplit',
        prompt: 'Budget split per channel',
        responseType: 'text',
      },
      { kind: 'subheading', text: 'Qualitative Performance' },
      {
        kind: 'question',
        id: 'what-is-working',
        answerKey: 'whatIsWorking',
        prompt: 'What’s working right now?',
        responseType: 'text',
      },
      {
        kind: 'question',
        id: 'what-is-not-working',
        answerKey: 'whatIsNotWorking',
        prompt: 'What’s not working?',
        responseType: 'text',
      },
      { kind: 'subheading', text: 'Core Metrics' },
      {
        kind: 'question',
        id: 'current-cac',
        answerKey: 'currentCac',
        prompt: 'Current CAC',
        responseType: 'text',
      },
      {
        kind: 'question',
        id: 'avg-customer-ltv',
        answerKey: 'avgCustomerLtv',
        prompt: 'Avg Customer LTV',
        responseType: 'text',
      },
      {
        kind: 'question',
        id: 'monthly-revenue',
        answerKey: 'monthlyRevenue',
        prompt: 'Monthly revenue (MRR or ARR)',
        responseType: 'text',
      },
      {
        kind: 'question',
        id: 'sales-cycle-length',
        answerKey: 'salesCycleLength',
        prompt: 'Average sales cycle length (if sales-led)',
        responseType: 'text',
      },
      { kind: 'subheading', text: 'Optional:' },
      { kind: 'subheading', text: 'Funnel Metrics' },
      {
        kind: 'question',
        id: 'visitor-to-signup-pct',
        answerKey: 'visitorToSignupPct',
        prompt: 'Website visitor → signup %',
        responseType: 'text',
        optional: true,
      },
      {
        kind: 'question',
        id: 'signup-to-activation-pct',
        answerKey: 'signupToActivationPct',
        prompt: 'Signup → activation %',
        responseType: 'text',
        optional: true,
      },
      {
        kind: 'question',
        id: 'activation-to-paid-pct',
        answerKey: 'activationToPaidPct',
        prompt: 'Activation → paid %',
        responseType: 'text',
        optional: true,
      },
      {
        kind: 'question',
        id: 'demo-to-close-rate',
        answerKey: 'demoToCloseRate',
        prompt: 'Demo → close rate (if applicable)',
        responseType: 'text',
        optional: true,
      },
      {
        kind: 'question',
        id: 'last-3-6-month-growth-trend',
        answerKey: 'last3to6MoGrowthTrend',
        prompt: 'Last 3–6 months growth trend',
        responseType: 'text',
        optional: true,
      },
    ],
    existingFieldChanges: ['Last 12-Month Revenue Growth % → Last 3–6 months growth trend'],
    whyThisSetupWorks: [
      '✅ Channels + budget split → reveals where attention and spend are currently going',
      '✅ What’s working → surfaces winning angles and channels to double down on',
      '✅ What’s not working → highlights inefficiencies and wasted spend',
      '✅ CAC + LTV → anchors profitability and scaling potential',
      '✅ Revenue (MRR/ARR) → defines growth stage and strategy complexity',
      '✅ Funnel metrics → pinpoints exact conversion bottlenecks',
      '✅ Growth trend → shows momentum and urgency level',
    ],
    unlocks: [
      'Identify the biggest growth constraint (traffic vs conversion vs sales)',
      'Reallocate budget to highest-performing channels',
      'Diagnose funnel leaks with precision',
      'Benchmark performance against expected SaaS metrics',
      'Build realistic, stage-appropriate scaling strategies',
      'Prioritize fastest wins vs long-term fixes',
    ],
  },
] as const satisfies readonly GtmOnboardingSection[];

type GtmOnboardingQuestionItem = Extract<
  (typeof GTM_ONBOARDING_QUESTIONNAIRE)[number]['items'][number],
  { kind: 'question' }
>;

export type GtmOnboardingAnswerKey = GtmOnboardingQuestionItem['answerKey'];

function isGtmOnboardingQuestion(item: GtmOnboardingItem): item is GtmOnboardingQuestion {
  return item.kind === 'question';
}

export function getGtmOnboardingQuestions(): GtmOnboardingQuestion[] {
  return GTM_ONBOARDING_QUESTIONNAIRE.flatMap((section) => {
    const items: readonly GtmOnboardingItem[] = section.items;
    return items.filter(isGtmOnboardingQuestion);
  });
}

export function getGtmOnboardingSection(sectionId: string): GtmOnboardingSection | undefined {
  return GTM_ONBOARDING_QUESTIONNAIRE.find((section) => section.id === sectionId);
}
