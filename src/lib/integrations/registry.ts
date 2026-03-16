export type Tier = "required" | "research" | "paid-media" | "enrichment";

export interface IntegrationDefinition {
  name: string;
  slug: string;
  tier: Tier;
  purpose: string;
  envVars: string[];
  probeType: "http" | "supabase" | "env-only";
  probeUrl?: string;
}

export const TIER_LABELS: Record<Tier, string> = {
  required: "Core Infrastructure",
  research: "Research Pipeline",
  "paid-media": "Paid Media Data",
  enrichment: "Enrichment & Utilities",
};

export const INTEGRATIONS: IntegrationDefinition[] = [
  // Required
  {
    name: "Anthropic Claude",
    slug: "anthropic",
    tier: "required",
    purpose: "AI inference for lead agent and sub-agents",
    envVars: ["ANTHROPIC_API_KEY"],
    probeType: "env-only",
  },
  {
    name: "Supabase",
    slug: "supabase",
    tier: "required",
    purpose: "Database and persistent storage",
    envVars: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
    probeType: "supabase",
  },
  {
    name: "Clerk",
    slug: "clerk",
    tier: "required",
    purpose: "Authentication and user management",
    envVars: ["CLERK_SECRET_KEY", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"],
    probeType: "env-only",
  },
  {
    name: "Railway Worker",
    slug: "railway",
    tier: "required",
    purpose: "Research pipeline execution",
    envVars: ["RAILWAY_WORKER_URL", "RAILWAY_API_KEY"],
    probeType: "http",
  },
  // Research
  {
    name: "Perplexity Sonar Pro",
    slug: "perplexity",
    tier: "research",
    purpose: "Web-grounded research queries",
    envVars: ["PERPLEXITY_API_KEY"],
    probeType: "env-only",
  },
  {
    name: "SearchAPI",
    slug: "searchapi",
    tier: "research",
    purpose: "Ad Library access (Google, Meta, LinkedIn)",
    envVars: ["SEARCHAPI_KEY"],
    probeType: "env-only",
  },
  {
    name: "Firecrawl",
    slug: "firecrawl",
    tier: "research",
    purpose: "Pricing and landing page scraping",
    envVars: ["FIRECRAWL_API_KEY"],
    probeType: "env-only",
  },
  {
    name: "SpyFu",
    slug: "spyfu",
    tier: "research",
    purpose: "Keyword intelligence and domain analytics",
    envVars: ["SPYFU_API_KEY"],
    probeType: "env-only",
  },
  // Paid Media
  {
    name: "Google Ads",
    slug: "google-ads",
    tier: "paid-media",
    purpose: "Campaign performance and keyword data",
    envVars: [
      "GOOGLE_ADS_DEVELOPER_TOKEN",
      "GOOGLE_ADS_CLIENT_ID",
      "GOOGLE_ADS_CLIENT_SECRET",
      "GOOGLE_ADS_REFRESH_TOKEN",
      "GOOGLE_ADS_CUSTOMER_ID",
    ],
    probeType: "env-only",
  },
  {
    name: "Meta Marketing",
    slug: "meta-ads",
    tier: "paid-media",
    purpose: "Meta Ads Manager campaign data",
    envVars: ["META_ACCESS_TOKEN", "META_BUSINESS_ACCOUNT_ID"],
    probeType: "env-only",
  },
  {
    name: "GA4",
    slug: "ga4",
    tier: "paid-media",
    purpose: "Website traffic and audience analytics",
    envVars: ["GA4_PROPERTY_ID", "GA4_SERVICE_ACCOUNT_JSON"],
    probeType: "env-only",
  },
  // Enrichment
  {
    name: "PageSpeed Insights",
    slug: "pagespeed",
    tier: "enrichment",
    purpose: "Core Web Vitals and performance scoring",
    envVars: [],
    probeType: "http",
    probeUrl:
      "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://example.com&strategy=mobile&category=performance",
  },
  {
    name: "AntV Chart",
    slug: "antv-chart",
    tier: "enrichment",
    purpose: "Data visualization chart generation",
    envVars: [],
    probeType: "env-only",
  },
  {
    name: "Foreplay",
    slug: "foreplay",
    tier: "enrichment",
    purpose: "Creative intelligence enrichment",
    envVars: ["FOREPLAY_API_KEY", "ENABLE_FOREPLAY"],
    probeType: "env-only",
  },
];

export function getIntegrationsByTier(): Record<Tier, IntegrationDefinition[]> {
  return INTEGRATIONS.reduce(
    (acc, integration) => {
      if (!acc[integration.tier]) acc[integration.tier] = [];
      acc[integration.tier].push(integration);
      return acc;
    },
    {} as Record<Tier, IntegrationDefinition[]>
  );
}
