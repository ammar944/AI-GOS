import {
  competitorAdSchema,
  type CompetitorAd,
} from "../artifacts/artifact-envelope";

const rawCompetitorAds: CompetitorAd[] = [
  {
    id: "ad_kalungi_meta_pipeline",
    competitorName: "Kalungi",
    platform: "meta",
    headline: "GTM-as-a-service for predictable growth",
    body: "Kalungi positions as a full outsourced B2B SaaS marketing department with fractional CMO leadership, paid media, ABM, RevOps, SEO, and web execution.",
    landingUrl: "https://www.kalungi.com/",
    firstSeen: null,
    lastSeen: null,
    creativeUrl: null,
    sourceUrl: "https://www.kalungi.com/",
    angle: "Full-stack outsourced SaaS GTM team and fractional CMO",
  },
  {
    id: "ad_powered_by_search_google_pipeline",
    competitorName: "Powered by Search",
    platform: "google",
    headline: "Get 30% more sales-ready opportunities in 90 days",
    body: "Powered by Search positions around predictable B2B pipeline, paid search, paid social, content, and ABM for SaaS teams that need sales-ready opportunities.",
    landingUrl: "https://www.poweredbysearch.com/",
    firstSeen: null,
    lastSeen: null,
    creativeUrl: null,
    sourceUrl: "https://www.poweredbysearch.com/",
    angle: "Predictable pipeline and paid-media execution for B2B SaaS",
  },
  {
    id: "ad_directive_google_b2b_growth",
    competitorName: "Directive Consulting",
    platform: "google",
    headline: "Rethink the potential of your B2B agency",
    body: "Directive positions as a B2B agency connecting content, paid media, creative, programmatic, and RevOps to measurable pipeline and revenue.",
    landingUrl: "https://directiveconsulting.com/",
    firstSeen: null,
    lastSeen: null,
    creativeUrl: null,
    sourceUrl: "https://directiveconsulting.com/",
    angle: "Revenue-accountable B2B growth agency across paid media and RevOps",
  },
  {
    id: "ad_refine_labs_meta_demand",
    competitorName: "Refine Labs",
    platform: "meta",
    headline: "Modernize your B2B growth strategy",
    body: "Refine Labs positions around modern demand generation, measurement, and execution for mid-market and enterprise B2B SaaS companies.",
    landingUrl: "https://www.refinelabs.com/",
    firstSeen: null,
    lastSeen: null,
    creativeUrl: null,
    sourceUrl: "https://www.refinelabs.com/",
    angle: "Demand generation and measurement strategy for B2B SaaS",
  },
  {
    id: "ad_simpletiger_google_saas_seo",
    competitorName: "SimpleTiger",
    platform: "google",
    headline: "B2B SaaS marketing agency and AI search leader",
    body: "SimpleTiger positions around SaaS SEO, AI search visibility, paid advertising, content, digital PR, email, and web design.",
    landingUrl: "https://www.simpletiger.com/",
    firstSeen: null,
    lastSeen: null,
    creativeUrl: null,
    sourceUrl: "https://www.simpletiger.com/",
    angle: "Search visibility and paid acquisition for B2B SaaS",
  },
];

export const competitorAdsFixture = competitorAdSchema
  .array()
  .min(3)
  .max(5)
  .parse(rawCompetitorAds);
