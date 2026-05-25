import { researchInputSchema } from "../artifacts/artifact-envelope";
import { competitorAdsFixture } from "./competitor-ads";

const rawSaaslaunchResearchInput = {
  runId: "run_saaslaunch_fixture",
  fixtureId: "saaslaunch",
  company: {
    id: "company_saaslaunch",
    name: "SaaSLaunch",
    websiteUrl: "https://example.com/saaslaunch",
    category: "AI-native GTM operations",
    description:
      "SaaSLaunch helps early B2B SaaS teams turn messy founder-led sales activity into repeatable GTM operating loops.",
    stage: "Seed to Series A",
    targetCustomer:
      "Founder-led B2B SaaS teams with five to fifty employees and a small revenue team.",
  },
  onboarding: {
    primaryGoal:
      "Clarify the strongest market category and positioning wedge before building a section-agent workflow.",
    targetSegments: [
      "AI SaaS founders",
      "Fractional revenue operators",
      "Early-stage GTM teams",
    ],
    keyOffers: [
      "AI-assisted pipeline operating system",
      "Weekly founder-led sales workflow",
      "Account research and follow-up automation",
    ],
    distributionChannels: [
      "Founder communities",
      "LinkedIn outbound",
      "Operator-led implementation partners",
    ],
    constraints: [
      "Avoid generic CRM positioning",
      "Keep the offer credible without implying fully autonomous revenue work",
    ],
    notes:
      "The fixture should stress category clarity, buyer specificity, and evidence-backed competitor contrast.",
  },
  sources: [
    {
      id: "source_homepage",
      title: "SaaSLaunch Fixture Homepage",
      url: "https://example.com/saaslaunch",
      publisher: "AI-GOS AI SDK Lab Fixture",
      observedAt: "2026-05-20T15:00:00.000Z",
    },
    {
      id: "source_positioning_notes",
      title: "SaaSLaunch Positioning Notes",
      url: "https://example.com/saaslaunch/positioning-notes",
      publisher: "AI-GOS AI SDK Lab Fixture",
      observedAt: "2026-05-20T15:02:00.000Z",
    },
    {
      id: "source_sales_workflow",
      title: "Founder-Led Sales Workflow Brief",
      url: "https://example.com/saaslaunch/founder-led-sales",
      publisher: "AI-GOS AI SDK Lab Fixture",
      observedAt: "2026-05-20T15:04:00.000Z",
    },
  ],
  corpus: {
    excerpts: [
      {
        id: "excerpt_homepage_positioning",
        sourceId: "source_homepage",
        sourceUrl: "https://example.com/saaslaunch",
        title: "Homepage hero and product frame",
        text: "SaaSLaunch frames the product as an operating loop for founder-led sales teams: collect account context, decide the next action, and preserve the weekly GTM rhythm without adding another CRM dashboard.",
        observedAt: "2026-05-20T15:00:00.000Z",
      },
      {
        id: "excerpt_positioning_notes",
        sourceId: "source_positioning_notes",
        sourceUrl: "https://example.com/saaslaunch/positioning-notes",
        title: "Positioning notes on category pressure",
        text: "The strongest contrast is against lightweight CRM cleanup tools and generic sales assistants. The desired category should make operations, evidence, and repeatable founder behavior more central than automation volume.",
        observedAt: "2026-05-20T15:02:00.000Z",
      },
      {
        id: "excerpt_sales_workflow",
        sourceId: "source_sales_workflow",
        sourceUrl: "https://example.com/saaslaunch/founder-led-sales",
        title: "Weekly sales workflow brief",
        text: "The fixture workflow emphasizes a weekly pipeline review, ranked account focus, explicit follow-up decisions, and source-backed recommendations that a founder or first revenue hire can verify quickly.",
        observedAt: "2026-05-20T15:04:00.000Z",
      },
    ],
  },
  competitorAds: competitorAdsFixture,
};

export const saaslaunchResearchInput = researchInputSchema.parse(
  rawSaaslaunchResearchInput,
);
