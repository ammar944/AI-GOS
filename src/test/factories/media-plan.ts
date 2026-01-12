/**
 * Test Data Factories for Media Plan Pipeline
 *
 * Factory functions that create valid test data matching Zod schema requirements.
 * Each factory accepts partial overrides for customization.
 */

import type {
  NicheFormData,
  BriefingFormData,
  ExtractedData,
  ResearchData,
  LogicData,
  MediaPlanBlueprint,
  SalesCycleLength,
} from "@/lib/media-plan/types";

// =============================================================================
// Form Data Factories
// =============================================================================

/**
 * Create mock NicheFormData with realistic test values
 */
export function createMockNicheFormData(
  overrides?: Partial<NicheFormData>
): NicheFormData {
  return {
    industry: "E-commerce SaaS",
    audience: "Small business owners aged 30-50 looking to automate their online stores",
    icp: "Tech-savvy entrepreneurs running Shopify or WooCommerce stores with $50K-500K annual revenue",
    ...overrides,
  };
}

/**
 * Create mock BriefingFormData with realistic test values
 */
export function createMockBriefingFormData(
  overrides?: Partial<BriefingFormData>
): BriefingFormData {
  return {
    budget: 10000,
    offerPrice: 2500,
    salesCycleLength: "14_to_30_days" as SalesCycleLength,
    ...overrides,
  };
}

// =============================================================================
// Pipeline Stage Data Factories
// =============================================================================

/**
 * Create mock ExtractedData (Stage 1 output)
 */
export function createMockExtractedData(
  overrides?: Partial<ExtractedData>
): ExtractedData {
  const base: ExtractedData = {
    industry: {
      name: "E-commerce SaaS",
      vertical: "Software as a Service",
      subNiche: "E-commerce automation tools",
    },
    audience: {
      demographics: "Small business owners, 30-50 years old, primarily in North America and Europe",
      psychographics: "Tech-savvy, growth-oriented, value efficiency and automation",
      painPoints: [
        "Manual inventory management is time-consuming",
        "Difficulty scaling operations without additional staff",
        "Inconsistent customer communication",
      ],
    },
    icp: {
      description: "Tech-savvy entrepreneurs running successful e-commerce stores seeking automation",
      characteristics: [
        "Running Shopify or WooCommerce stores",
        "$50K-500K annual revenue",
        "Team of 1-10 employees",
        "Actively seeking growth tools",
      ],
      buyingBehavior: "Research-driven, relies on peer reviews and case studies, prefers free trials",
    },
    budget: {
      total: 10000,
      currency: "USD",
    },
    offer: {
      price: 2500,
      type: "mid_ticket",
    },
    salesCycle: {
      length: "14_to_30_days",
      daysEstimate: 22,
      complexity: "moderate",
    },
  };

  // Deep merge overrides
  if (overrides) {
    return deepMerge(base, overrides) as ExtractedData;
  }
  return base;
}

/**
 * Create mock ResearchData (Stage 2 output)
 */
export function createMockResearchData(
  overrides?: Partial<ResearchData>
): ResearchData {
  const base: ResearchData = {
    marketOverview: {
      size: "$15.5 billion global e-commerce SaaS market",
      trends: [
        "AI-powered automation adoption increasing 40% YoY",
        "Mobile commerce driving platform integration needs",
        "Subscription-based pricing becoming standard",
      ],
      growth: "12.4% CAGR through 2028",
    },
    competitors: [
      {
        name: "Klaviyo",
        positioning: "Email marketing automation for e-commerce",
        channels: ["Google Ads", "LinkedIn", "Content Marketing"],
      },
      {
        name: "Omnisend",
        positioning: "All-in-one e-commerce marketing platform",
        channels: ["Meta Ads", "Google Ads", "YouTube"],
      },
      {
        name: "ActiveCampaign",
        positioning: "Customer experience automation",
        channels: ["LinkedIn", "Google Ads", "Podcast Sponsorships"],
      },
    ],
    benchmarks: {
      cpc: { low: 1.5, high: 8.0, average: 3.5 },
      cpm: { low: 12, high: 45, average: 25 },
      ctr: { low: 0.008, high: 0.035, average: 0.018 },
      conversionRate: { low: 0.015, high: 0.045, average: 0.028 },
    },
    audienceInsights: {
      platforms: ["LinkedIn", "Facebook", "YouTube", "Google Search"],
      contentPreferences: ["Case studies", "How-to guides", "Video tutorials", "Webinars"],
      peakEngagementTimes: ["Tuesday 10am-12pm", "Wednesday 2pm-4pm", "Thursday 9am-11am"],
    },
    sources: [
      {
        title: "Statista E-commerce SaaS Market Report 2024",
        url: "https://example.com/statista-report",
      },
      {
        title: "HubSpot State of Marketing 2024",
        url: "https://example.com/hubspot-report",
      },
      {
        title: "WordStream Google Ads Benchmarks",
        url: "https://example.com/wordstream-benchmarks",
      },
    ],
  };

  if (overrides) {
    return deepMerge(base, overrides) as ResearchData;
  }
  return base;
}

/**
 * Create mock LogicData (Stage 3 output)
 */
export function createMockLogicData(
  overrides?: Partial<LogicData>
): LogicData {
  const base: LogicData = {
    platforms: [
      {
        name: "Google Ads",
        priority: "primary",
        reason: "High intent audience searching for e-commerce solutions, strong B2B targeting",
        budgetPercentage: 50,
      },
      {
        name: "LinkedIn Ads",
        priority: "secondary",
        reason: "B2B audience of business owners, professional targeting options",
        budgetPercentage: 30,
      },
      {
        name: "Meta Ads",
        priority: "secondary",
        reason: "Retargeting capabilities and lookalike audiences",
        budgetPercentage: 15,
      },
      {
        name: "Testing Reserve",
        priority: "secondary",
        reason: "Budget for A/B testing and new channel experiments",
        budgetPercentage: 5,
      },
    ],
    budgetAllocation: [
      { platform: "Google Ads", amount: 5000, percentage: 50 },
      { platform: "LinkedIn Ads", amount: 3000, percentage: 30 },
      { platform: "Meta Ads", amount: 1500, percentage: 15 },
      { platform: "Testing Reserve", amount: 500, percentage: 5 },
    ],
    funnelType: {
      name: "Lead Magnet Funnel",
      stages: ["Ad", "Lead Magnet Landing Page", "Email Nurture Sequence", "Demo/Sales Call", "Purchase"],
      reason: "Mid-ticket offer with moderate sales cycle requires education and trust-building before purchase",
    },
    kpiTargets: [
      {
        metric: "CPA",
        target: 250,
        unit: "dollars",
        rationale: "10% of offer price ($2,500) following industry standard for mid-ticket SaaS",
      },
      {
        metric: "ROAS",
        target: 10,
        unit: "ratio",
        rationale: "Offer price ($2,500) / Target CPA ($250) = 10x return",
      },
      {
        metric: "CTR",
        target: 0.018,
        unit: "percent",
        rationale: "Industry benchmark average for SaaS advertising",
      },
      {
        metric: "Lead Conversion Rate",
        target: 0.028,
        unit: "percent",
        rationale: "Industry benchmark average for e-commerce SaaS",
      },
      {
        metric: "Monthly Leads",
        target: 40,
        unit: "count",
        rationale: "Budget / Target CPA = $10,000 / $250 = 40 leads",
      },
    ],
  };

  if (overrides) {
    return deepMerge(base, overrides) as LogicData;
  }
  return base;
}

/**
 * Create mock MediaPlanBlueprint (Stage 4 output / final result)
 */
export function createMockMediaPlanBlueprint(
  overrides?: Partial<MediaPlanBlueprint>
): MediaPlanBlueprint {
  const base: MediaPlanBlueprint = {
    executiveSummary: `This strategic media plan targets small business e-commerce owners with a $10,000 monthly budget. The primary focus is on Google Ads for high-intent search traffic, supplemented by LinkedIn for B2B targeting and Meta for retargeting. The Lead Magnet Funnel approach will nurture prospects through educational content before sales calls.

Expected outcomes include 40 qualified leads per month at a $250 CPA, with a target ROAS of 10x. The moderate sales cycle (14-30 days) will be supported by an email nurture sequence designed to build trust and demonstrate value.

Key success factors include compelling ad creative addressing automation pain points, a high-value lead magnet, and consistent follow-up through the nurture sequence.`,
    platformStrategy: [
      {
        platform: "Google Ads",
        rationale: "Primary channel capturing high-intent search traffic from business owners actively seeking e-commerce automation solutions",
        tactics: [
          "Search campaigns targeting 'e-commerce automation' and 'Shopify automation' keywords",
          "Performance Max campaigns for broader reach",
          "Remarketing to website visitors",
          "Competitor keyword targeting",
        ],
        budget: 5000,
      },
      {
        platform: "LinkedIn Ads",
        rationale: "B2B targeting capabilities to reach business owners and decision-makers directly",
        tactics: [
          "Sponsored content with case studies",
          "Lead gen forms with whitepaper offers",
          "Retargeting website visitors on LinkedIn",
        ],
        budget: 3000,
      },
      {
        platform: "Meta Ads",
        rationale: "Retargeting and lookalike audiences to expand reach cost-effectively",
        tactics: [
          "Retargeting campaigns for website visitors",
          "Lookalike audiences from customer email list",
          "Video ads showcasing product demos",
        ],
        budget: 1500,
      },
    ],
    budgetBreakdown: [
      {
        category: "Google Ads",
        amount: 5000,
        percentage: 50,
        notes: "Primary acquisition channel - search and performance max campaigns",
      },
      {
        category: "LinkedIn Ads",
        amount: 3000,
        percentage: 30,
        notes: "B2B lead generation and thought leadership",
      },
      {
        category: "Meta Ads",
        amount: 1500,
        percentage: 15,
        notes: "Retargeting and lookalike audience expansion",
      },
      {
        category: "Testing Reserve",
        amount: 500,
        percentage: 5,
        notes: "A/B testing new creatives and exploring new channels",
      },
    ],
    funnelStrategy: {
      type: "Lead Magnet Funnel",
      stages: [
        {
          name: "Awareness",
          objective: "Capture attention with compelling ad creative",
          channels: ["Google Ads", "LinkedIn Ads", "Meta Ads"],
          content: ["Video ads", "Carousel ads", "Search ads"],
        },
        {
          name: "Lead Capture",
          objective: "Convert visitors to leads with valuable resource",
          channels: ["Landing Page"],
          content: ["E-commerce Automation Guide", "ROI Calculator"],
        },
        {
          name: "Nurture",
          objective: "Build trust and demonstrate value over 14-21 days",
          channels: ["Email"],
          content: ["Welcome sequence", "Case studies", "Product tutorials"],
        },
        {
          name: "Conversion",
          objective: "Convert qualified leads to customers",
          channels: ["Sales Call", "Demo"],
          content: ["Personalized demo", "Proposal"],
        },
      ],
    },
    adAngles: [
      {
        angle: "Time Savings",
        hook: "Stop spending 10+ hours a week on manual tasks",
        targetEmotion: "Relief from overwhelm",
        example: "Automate your Shopify store and get 10+ hours back every week",
      },
      {
        angle: "Scale Without Hiring",
        hook: "Grow your revenue without growing your team",
        targetEmotion: "Excitement about growth",
        example: "Our automation handles the work of 3 employees - without the overhead",
      },
      {
        angle: "Competitor Comparison",
        hook: "Why top e-commerce stores are switching from [Competitor]",
        targetEmotion: "Fear of missing out",
        example: "See why 500+ stores switched from Klaviyo to save $500/month",
      },
      {
        angle: "Social Proof",
        hook: "Join 1,000+ successful e-commerce entrepreneurs",
        targetEmotion: "Trust and belonging",
        example: "1,000+ stores automated. $10M+ in time saved. Your turn.",
      },
    ],
    kpiTargets: [
      {
        metric: "Cost Per Acquisition (CPA)",
        target: "$250",
        benchmark: "$200-400 industry average for mid-ticket SaaS",
      },
      {
        metric: "Return on Ad Spend (ROAS)",
        target: "10x",
        benchmark: "6-12x typical for SaaS with $2,500 price point",
      },
      {
        metric: "Click-Through Rate (CTR)",
        target: "1.8%",
        benchmark: "1.5-2.5% for B2B SaaS ads",
      },
      {
        metric: "Lead Conversion Rate",
        target: "2.8%",
        benchmark: "2-4% for e-commerce SaaS",
      },
      {
        metric: "Monthly Qualified Leads",
        target: "40 leads",
        benchmark: "Based on $10,000 budget at $250 CPA",
      },
    ],
    sources: [
      {
        title: "Statista E-commerce SaaS Market Report 2024",
        url: "https://example.com/statista-report",
      },
      {
        title: "HubSpot State of Marketing 2024",
        url: "https://example.com/hubspot-report",
      },
      {
        title: "WordStream Google Ads Benchmarks",
        url: "https://example.com/wordstream-benchmarks",
      },
    ],
    metadata: {
      generatedAt: new Date().toISOString(),
      totalCost: 0.0234,
      processingTime: 45000,
    },
  };

  if (overrides) {
    return deepMerge(base, overrides) as MediaPlanBlueprint;
  }
  return base;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Deep merge utility for overriding nested properties
 */
function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const output = { ...target };

  for (const key in source) {
    if (source[key] !== undefined) {
      if (
        typeof source[key] === "object" &&
        source[key] !== null &&
        !Array.isArray(source[key]) &&
        typeof target[key] === "object" &&
        target[key] !== null &&
        !Array.isArray(target[key])
      ) {
        // Recursively merge nested objects
        output[key] = deepMerge(
          target[key] as object,
          source[key] as object
        ) as T[Extract<keyof T, string>];
      } else {
        // Direct assignment for primitives and arrays
        output[key] = source[key] as T[Extract<keyof T, string>];
      }
    }
  }

  return output;
}

/**
 * Create a complete pipeline input set
 */
export function createMockPipelineInput(overrides?: {
  niche?: Partial<NicheFormData>;
  briefing?: Partial<BriefingFormData>;
}): { niche: NicheFormData; briefing: BriefingFormData } {
  return {
    niche: createMockNicheFormData(overrides?.niche),
    briefing: createMockBriefingFormData(overrides?.briefing),
  };
}

/**
 * Create all stage outputs for mocking the complete pipeline
 */
export function createMockPipelineStageResults(): {
  extracted: ExtractedData;
  research: ResearchData;
  logic: LogicData;
  blueprint: MediaPlanBlueprint;
} {
  return {
    extracted: createMockExtractedData(),
    research: createMockResearchData(),
    logic: createMockLogicData(),
    blueprint: createMockMediaPlanBlueprint(),
  };
}
