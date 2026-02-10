// Comprehensive Onboarding Form Types
// These types cover all data needed for market research and media planning

// =============================================================================
// Step 1: Business Basics
// =============================================================================

export interface BusinessBasicsData {
  businessName: string;
  websiteUrl: string;
}

// =============================================================================
// Step 2: Ideal Customer Profile (ICP)
// =============================================================================

export type CompanySize =
  | "solo"
  | "1-10"
  | "11-50"
  | "51-200"
  | "201-1000"
  | "1000+";

export const COMPANY_SIZE_OPTIONS: { value: CompanySize; label: string }[] = [
  { value: "solo", label: "Solo / Freelancer" },
  { value: "1-10", label: "1-10 employees" },
  { value: "11-50", label: "11-50 employees" },
  { value: "51-200", label: "51-200 employees" },
  { value: "201-1000", label: "201-1000 employees" },
  { value: "1000+", label: "1000+ employees" },
];

export type ClientSource =
  | "referrals"
  | "linkedin"
  | "outbound"
  | "paid_ads"
  | "seo"
  | "events"
  | "partnerships"
  | "content"
  | "other";

export const CLIENT_SOURCE_OPTIONS: { value: ClientSource; label: string }[] = [
  { value: "referrals", label: "Referrals" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "outbound", label: "Outbound / Cold Email" },
  { value: "paid_ads", label: "Paid Ads" },
  { value: "seo", label: "SEO / Organic Search" },
  { value: "events", label: "Events / Conferences" },
  { value: "partnerships", label: "Partnerships" },
  { value: "content", label: "Content / Social Media" },
  { value: "other", label: "Other" },
];

export interface ICPData {
  primaryIcpDescription: string;
  industryVertical: string;
  jobTitles: string;
  companySize: CompanySize[];
  geography: string;
  easiestToClose: string;
  buyingTriggers: string;
  bestClientSources: ClientSource[];
  secondaryIcp?: string;
  // Systems/Platforms used (CRM, GHL, HubSpot, Slack, ClickUp, etc.)
  systemsPlatforms?: string;
}

// =============================================================================
// Step 3: Product & Offer
// =============================================================================

export type PricingModel =
  | "monthly"
  | "annual"
  | "one_time"
  | "usage_based"
  | "seat_based"
  | "custom";

export const PRICING_MODEL_OPTIONS: { value: PricingModel; label: string }[] = [
  { value: "monthly", label: "Monthly Subscription" },
  { value: "annual", label: "Annual Subscription" },
  { value: "one_time", label: "One-time Payment" },
  { value: "usage_based", label: "Usage-based" },
  { value: "seat_based", label: "Per Seat / Per User" },
  { value: "custom", label: "Custom / Enterprise" },
];

export type FunnelType =
  | "lead_form"
  | "booking_page"
  | "free_trial"
  | "webinar"
  | "demo"
  | "application"
  | "challenge"
  | "ecommerce"
  | "other";

export const FUNNEL_TYPE_OPTIONS: { value: FunnelType; label: string }[] = [
  { value: "lead_form", label: "Lead Form" },
  { value: "booking_page", label: "Booking / Calendar Page" },
  { value: "free_trial", label: "Free Trial" },
  { value: "webinar", label: "Webinar / Live Event" },
  { value: "demo", label: "Product Demo" },
  { value: "application", label: "Application Form" },
  { value: "challenge", label: "Challenge / Course" },
  { value: "ecommerce", label: "E-commerce / Direct Purchase" },
  { value: "other", label: "Other" },
];

export interface ProductOfferData {
  productDescription: string;
  coreDeliverables: string;
  offerPrice: number;
  pricingModel: PricingModel[];
  valueProp: string;
  guarantees?: string;
  currentFunnelType: FunnelType[];
}

// =============================================================================
// Step 4: Market & Competition
// =============================================================================

export interface MarketCompetitionData {
  topCompetitors: string;
  uniqueEdge: string;
  competitorFrustrations?: string;
  marketBottlenecks: string;
  proprietaryTech?: string;
}

// =============================================================================
// Step 5: Customer Journey
// =============================================================================

export type SalesCycleLength =
  | "less_than_7_days"
  | "7_to_14_days"
  | "14_to_30_days"
  | "more_than_30_days";

export const SALES_CYCLE_OPTIONS: { value: SalesCycleLength; label: string }[] = [
  { value: "less_than_7_days", label: "Less than 7 days" },
  { value: "7_to_14_days", label: "7-14 days" },
  { value: "14_to_30_days", label: "14-30 days" },
  { value: "more_than_30_days", label: "30+ days" },
];

export interface CustomerJourneyData {
  situationBeforeBuying: string;
  desiredTransformation: string;
  commonObjections: string;
  salesCycleLength: SalesCycleLength;
  salesProcessOverview?: string;
}

// =============================================================================
// Step 6: Brand & Positioning
// =============================================================================

export interface BrandPositioningData {
  brandPositioning: string;
  customerVoice?: string;
}

// =============================================================================
// Step 7: Assets & Proof
// =============================================================================

export interface AssetsProofData {
  salesDeckUrl?: string;
  productDemoUrl?: string;
  caseStudiesUrl?: string;
  testimonialsUrl?: string;
  landingPageUrl?: string;
  existingAdsUrl?: string;
  brandGuidelinesUrl?: string;
  loomWalkthroughUrl?: string;
  // Additional asset URLs
  emailSequencesUrl?: string;
  productScreenshotsUrl?: string;
  ugcVideosUrl?: string;
}

// =============================================================================
// Step 8: Budget & Targets
// =============================================================================

export type CampaignDuration =
  | "ongoing"
  | "1_month"
  | "3_months"
  | "6_months"
  | "fixed";

export const CAMPAIGN_DURATION_OPTIONS: { value: CampaignDuration; label: string }[] = [
  { value: "ongoing", label: "Ongoing / Evergreen" },
  { value: "1_month", label: "1 Month" },
  { value: "3_months", label: "3 Months" },
  { value: "6_months", label: "6 Months" },
  { value: "fixed", label: "Fixed End Date" },
];

export interface BudgetTargetsData {
  monthlyAdBudget: number;
  dailyBudgetCeiling?: number;
  campaignDuration: CampaignDuration;
  targetCpl?: number;
  targetCac?: number;
  targetSqlsPerMonth?: number;
  targetDemosPerMonth?: number;
}

// =============================================================================
// Step 9: Compliance
// =============================================================================

export interface ComplianceData {
  topicsToAvoid?: string;
  claimRestrictions?: string;
}

// =============================================================================
// Combined Form Data
// =============================================================================

export interface OnboardingFormData {
  businessBasics: BusinessBasicsData;
  icp: ICPData;
  productOffer: ProductOfferData;
  marketCompetition: MarketCompetitionData;
  customerJourney: CustomerJourneyData;
  brandPositioning: BrandPositioningData;
  assetsProof: AssetsProofData;
  budgetTargets: BudgetTargetsData;
  compliance: ComplianceData;
}

// =============================================================================
// Form Step Configuration
// =============================================================================

export type OnboardingStep =
  | "business_basics"
  | "icp"
  | "product_offer"
  | "market_competition"
  | "customer_journey"
  | "brand_positioning"
  | "assets_proof"
  | "budget_targets"
  | "compliance";

export interface StepConfig {
  id: OnboardingStep;
  title: string;
  description: string;
  icon: string;
}

export const ONBOARDING_STEPS: StepConfig[] = [
  {
    id: "business_basics",
    title: "Business Basics",
    description: "Company information",
    icon: "Building2",
  },
  {
    id: "icp",
    title: "Ideal Customer",
    description: "Who you serve",
    icon: "Users",
  },
  {
    id: "product_offer",
    title: "Product & Offer",
    description: "What you sell",
    icon: "Package",
  },
  {
    id: "market_competition",
    title: "Market & Competition",
    description: "Your landscape",
    icon: "TrendingUp",
  },
  {
    id: "customer_journey",
    title: "Customer Journey",
    description: "The buying process",
    icon: "Route",
  },
  {
    id: "brand_positioning",
    title: "Brand & Positioning",
    description: "How you're perceived",
    icon: "Sparkles",
  },
  {
    id: "assets_proof",
    title: "Assets & Proof",
    description: "Your resources",
    icon: "FileCheck",
  },
  {
    id: "budget_targets",
    title: "Budget & Targets",
    description: "Investment & goals",
    icon: "Target",
  },
  {
    id: "compliance",
    title: "Compliance",
    description: "Restrictions & rules",
    icon: "Shield",
  },
];

// =============================================================================
// Default Values
// =============================================================================

// =============================================================================
// Sample Data for Testing
// =============================================================================

export const SAMPLE_ONBOARDING_DATA: OnboardingFormData = {
  businessBasics: {
    businessName: "FlowMetrics",
    websiteUrl: "https://flowmetrics.io",
  },
  icp: {
    primaryIcpDescription: "B2B SaaS founders and marketing leaders at growth-stage companies ($1M-$20M ARR) who are struggling to attribute revenue to their marketing efforts and need a unified analytics dashboard to prove ROI to their board.",
    industryVertical: "B2B SaaS, Technology, Marketing Technology",
    jobTitles: "VP of Marketing, Head of Growth, CMO, Demand Gen Director, Marketing Operations Manager",
    companySize: ["51-200", "201-1000"],
    geography: "United States, Canada, United Kingdom, Australia",
    easiestToClose: "Series A/B funded SaaS companies that just hired their first marketing leader and are being asked to prove marketing ROI. They typically have 3-5 marketing tools but no unified view of performance.",
    buyingTriggers: "New CMO/VP Marketing hire, board pressure for attribution, failed marketing hires, scaling paid ads, preparing for Series B fundraise",
    bestClientSources: ["linkedin", "content", "referrals", "paid_ads"],
    secondaryIcp: "Marketing agencies serving B2B SaaS clients who need white-label reporting for their clients",
    systemsPlatforms: "HubSpot, Salesforce, Google Analytics, Segment, Mixpanel, Stripe, Slack",
  },
  productOffer: {
    productDescription: "FlowMetrics is an AI-powered marketing attribution and analytics platform that connects all your marketing tools, CRM, and revenue data into a single dashboard. We use machine learning to show which campaigns, channels, and content actually drive pipeline and closed revenue - not just vanity metrics.",
    coreDeliverables: "1) Unified marketing dashboard connecting 50+ integrations, 2) Multi-touch attribution modeling (first-touch, last-touch, linear, custom), 3) Revenue forecasting based on pipeline velocity, 4) Automated weekly board-ready reports, 5) Slack alerts for campaign performance anomalies",
    offerPrice: 997,
    pricingModel: ["monthly", "annual"],
    valueProp: "Stop guessing which marketing works. FlowMetrics shows you exactly which campaigns drive revenue so you can double down on winners and cut losers - typically saving clients 30% of wasted ad spend in the first 90 days.",
    guarantees: "30-day money back guarantee. If you don't see at least 3 actionable insights in your first month, we'll refund 100% - no questions asked.",
    currentFunnelType: ["demo", "free_trial"],
  },
  marketCompetition: {
    topCompetitors: "HubSpot Attribution, Dreamdata, Bizible (Marketo), Factors.ai, Windsor.ai",
    uniqueEdge: "We're the only platform with AI-powered anomaly detection that proactively alerts you when campaigns are underperforming BEFORE you waste budget. Competitors require you to build reports and check them manually.",
    competitorFrustrations: "HubSpot attribution only works within HubSpot ecosystem. Dreamdata is too expensive for SMBs ($2k+/mo). Bizible requires Marketo. Most solutions take 3+ months to implement - we're live in 2 weeks.",
    marketBottlenecks: "Most marketing teams are stuck using spreadsheets to track attribution because existing tools are either too expensive, too complex, or require data engineering resources they don't have.",
    proprietaryTech: "Our ML-based 'Revenue Probability Score' predicts which leads will close based on engagement patterns across all touchpoints. 87% accuracy in beta testing.",
  },
  customerJourney: {
    situationBeforeBuying: "Marketing leader is spending $50k+/month on ads and content but can't prove to the CEO/board which channels drive revenue. They're manually pulling data from 5+ tools into spreadsheets every week. Their job security feels threatened because they can't justify their budget.",
    desiredTransformation: "Confident marketing leader who walks into board meetings with a single dashboard showing exactly how marketing drives revenue. They can instantly see which campaigns to scale and which to cut. They're seen as a strategic partner, not a cost center.",
    commonObjections: "1) We already have Google Analytics - why do we need this? 2) Our data is too messy to get accurate attribution. 3) We tried Bizible and it was a nightmare to implement. 4) Can you integrate with our custom CRM setup?",
    salesCycleLength: "14_to_30_days",
    salesProcessOverview: "Demo request → 30-min discovery call → 45-min product demo → 7-day pilot with their data → Proposal → Close. Champions are usually VP Marketing, economic buyer is usually CEO/CFO.",
  },
  brandPositioning: {
    brandPositioning: "FlowMetrics is the 'easy button' for marketing attribution. We're positioned as the affordable, fast-to-implement alternative to enterprise solutions. Our tone is confident but approachable - we're the smart friend who helps you look good in front of your board.",
    customerVoice: "Before FlowMetrics, I was spending 10 hours a week pulling reports. Now I just open one dashboard. Last month I identified $15k in wasted ad spend in the first week. My CEO finally understands what marketing does.",
  },
  assetsProof: {
    salesDeckUrl: "https://flowmetrics.io/deck",
    productDemoUrl: "https://demo.flowmetrics.io",
    caseStudiesUrl: "https://flowmetrics.io/customers",
    testimonialsUrl: "https://flowmetrics.io/reviews",
    landingPageUrl: "https://flowmetrics.io/demo",
    existingAdsUrl: "",
    brandGuidelinesUrl: "",
    loomWalkthroughUrl: "https://loom.com/share/flowmetrics-demo",
    emailSequencesUrl: "",
    productScreenshotsUrl: "https://flowmetrics.io/screenshots",
    ugcVideosUrl: "",
  },
  budgetTargets: {
    monthlyAdBudget: 15000,
    dailyBudgetCeiling: 600,
    campaignDuration: "3_months",
    targetCpl: 75,
    targetCac: 450,
    targetSqlsPerMonth: 40,
    targetDemosPerMonth: 80,
  },
  compliance: {
    topicsToAvoid: "No claims about specific revenue increases without case study backing. Avoid mentioning competitor names directly in ads. No income claims or guarantees about results.",
    claimRestrictions: "Must use 'typically' or 'on average' when citing customer results. ROI claims must be backed by documented case studies. Cannot guarantee implementation timeline without discovery call.",
  },
};

export const DEFAULT_ONBOARDING_DATA: OnboardingFormData = {
  businessBasics: {
    businessName: "",
    websiteUrl: "",
  },
  icp: {
    primaryIcpDescription: "",
    industryVertical: "",
    jobTitles: "",
    companySize: [],
    geography: "",
    easiestToClose: "",
    buyingTriggers: "",
    bestClientSources: [],
    secondaryIcp: "",
    systemsPlatforms: "",
  },
  productOffer: {
    productDescription: "",
    coreDeliverables: "",
    offerPrice: 0,
    pricingModel: [],
    valueProp: "",
    guarantees: "",
    currentFunnelType: [],
  },
  marketCompetition: {
    topCompetitors: "",
    uniqueEdge: "",
    competitorFrustrations: "",
    marketBottlenecks: "",
    proprietaryTech: "",
  },
  customerJourney: {
    situationBeforeBuying: "",
    desiredTransformation: "",
    commonObjections: "",
    salesCycleLength: "14_to_30_days",
    salesProcessOverview: "",
  },
  brandPositioning: {
    brandPositioning: "",
    customerVoice: "",
  },
  assetsProof: {
    salesDeckUrl: "",
    productDemoUrl: "",
    caseStudiesUrl: "",
    testimonialsUrl: "",
    landingPageUrl: "",
    existingAdsUrl: "",
    brandGuidelinesUrl: "",
    loomWalkthroughUrl: "",
    emailSequencesUrl: "",
    productScreenshotsUrl: "",
    ugcVideosUrl: "",
  },
  budgetTargets: {
    monthlyAdBudget: 0,
    dailyBudgetCeiling: undefined,
    campaignDuration: "ongoing",
    targetCpl: undefined,
    targetCac: undefined,
    targetSqlsPerMonth: undefined,
    targetDemosPerMonth: undefined,
  },
  compliance: {
    topicsToAvoid: "",
    claimRestrictions: "",
  },
};
