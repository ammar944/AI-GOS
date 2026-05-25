import { artifactEnvelopeSchema } from "../artifacts/artifact-envelope";
import {
  marketCategorySectionOutputSchema,
  validateMarketCategoryMinimums,
  type MarketCategoryArtifact,
  type MarketCategorySectionOutput,
} from "../artifacts/schemas/market-category";

const createdAt = "2026-05-20T15:30:00.000Z";

export const marketCategoryFixtureArtifact = artifactEnvelopeSchema
  .extend({
    body: marketCategorySectionOutputSchema.shape.body,
  })
  .parse({
    id: "art_fixture_mc_saaslaunch",
    runId: "run_saaslaunch_fixture",
    sectionId: "positioningMarketCategory",
    sectionTitle: "Market & Category Intelligence",
    verdict:
      "SaaSLaunch should frame itself as an AI-native GTM operating loop, not another CRM assistant.",
    statusSummary:
      "The fixture evidence points to a growing but noisy category around founder-led revenue operations. Buyers can confuse it with CRM cleanup, AI sales assistants, and RevOps tooling, so the strongest wedge is weekly operating discipline with source-backed next actions. Confidence is moderate because the lab uses deterministic fixture evidence rather than live market research.",
    confidence: 0.6,
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
    body: {
      categoryDefinition: {
        prose:
          "SaaSLaunch fits best in AI-native GTM operations: tools and workflows that preserve the weekly operating rhythm for founder-led sales teams. The category boundary should emphasize repeatable account focus and evidence-backed next actions rather than generic CRM automation.",
        adjacentCategories: [
          {
            name: "CRM cleanup tools",
            whyBuyersConfuseIt:
              "CRM cleanup tools also surface stale deals, missing next steps, and hygiene gaps before pipeline review.",
            disambiguatingSignal:
              "SaaSLaunch should own the recurring operating loop after cleanup: account priority, decision support, and follow-up rhythm.",
            sourceTitle: "SaaSLaunch Positioning Notes",
            sourceUrl: "https://example.com/saaslaunch/positioning-notes",
          },
          {
            name: "AI sales assistants",
            whyBuyersConfuseIt:
              "AI sales assistants promise automation around follow-up, summaries, and recommended action.",
            disambiguatingSignal:
              "The stronger boundary is operator-grade weekly GTM discipline, not autonomous message volume.",
            sourceTitle: "Founder-Led Sales Workflow Brief",
            sourceUrl: "https://example.com/saaslaunch/founder-led-sales",
          },
        ],
      },
      marketSize: {
        prose:
          "The fixture supports directional demand, not a precise TAM claim. The market appears to be expanding because founder-led teams are searching for operating leverage without adding a full revenue-ops layer, while adjacent competitors already advertise CRM cleanup and AI operator language.",
        signals: [
          {
            signalType: "public-data",
            name: "Visible GTM operating-loop language",
            evidence:
              "The fixture homepage describes ranked account focus, account context, and weekly GTM rhythm as the product center.",
            trajectory: "expanding",
            methodology: "top-down",
            sourceTitle: "SaaSLaunch Fixture Homepage",
            sourceUrl: "https://example.com/saaslaunch",
            dateObserved: "2026-05-20",
          },
          {
            signalType: "search-trend",
            name: "Problem-aware CRM cleanup demand",
            evidence:
              "Competitor fixture ads use CRM cleanup and pipeline review pain, implying buyers already recognize the operating problem.",
            trajectory: "stable",
            methodology: "bottom-up",
            sourceTitle: "PipelinePilot Fixture Ad",
            sourceUrl: "https://example.com/fixtures/ad-library/pipelinepilot-google",
            dateObserved: "2026-05-20",
          },
          {
            signalType: "hiring-velocity",
            name: "Early revenue team operating pressure",
            evidence:
              "The onboarding fixture targets seed-to-Series-A teams that need revenue operating discipline before they can hire a full RevOps team.",
            trajectory: "expanding",
            methodology: "bottom-up",
            sourceTitle: "SaaSLaunch Positioning Notes",
            sourceUrl: "https://example.com/saaslaunch/positioning-notes",
            dateObserved: "2026-05-20",
          },
        ],
      },
      structuralForces: {
        prose:
          "Three forces shape the category: AI platform bundling raises expectations, buyer teams still need accountable operating rituals, and data/privacy discipline limits unsupported automation claims. SaaSLaunch should use those forces to position around verifiable operator workflow.",
        forces: [
          {
            forceType: "regulation",
            name: "Evidence and privacy pressure around AI sales automation",
            evidence:
              "The fixture constraints warn against claiming fully autonomous revenue work without credible evidence and controls.",
            implication:
              "Positioning should stress source-backed recommendations and human-verifiable next actions.",
            impact: "medium",
            direction: "neutral",
            sourceTitle: "SaaSLaunch Positioning Notes",
            sourceUrl: "https://example.com/saaslaunch/positioning-notes",
          },
          {
            forceType: "platform-shift",
            name: "AI features are becoming table stakes in GTM systems",
            evidence:
              "Fixture competitors advertise AI account prioritization, operator automation, and CRM risk summaries.",
            implication:
              "The category wedge must go deeper than generic AI assistance by owning the recurring GTM loop.",
            impact: "high",
            direction: "accelerating",
            sourceTitle: "SignalForge Fixture Ad",
            sourceUrl: "https://example.com/fixtures/ad-library/signalforge-linkedin",
          },
          {
            forceType: "buyer-behavior",
            name: "Founder-led teams want rhythm before headcount",
            evidence:
              "The target customer is a founder-led team with a small revenue function and a need for weekly pipeline operating discipline.",
            implication:
              "The product should sell the operating cadence and decision loop, not the promise of replacing a sales team.",
            impact: "high",
            direction: "accelerating",
            sourceTitle: "Founder-Led Sales Workflow Brief",
            sourceUrl: "https://example.com/saaslaunch/founder-led-sales",
          },
        ],
      },
      categoryMaturity: {
        prose:
          "The category is growing: the operating problem is clear, adjacent vendor language is visible, and buyers have alternatives, but there is still whitespace around founder-led GTM discipline as a named category.",
        classification: {
          stage: "growing",
          evidenceSummary:
            "Competitor ads and fixture positioning show buyer education already exists, while the category boundary remains unsettled enough for a focused operator workflow wedge.",
          supportingSignals: [
            {
              signalType: "player-count",
              evidence:
                "The fixture includes multiple adjacent competitors using CRM cleanup, AI operator, and account-priority language.",
              implication:
                "Buyers can compare alternatives, so the category is past pure invention.",
              sourceUrl: "https://example.com/fixtures/ad-library/signalforge-linkedin",
            },
            {
              signalType: "buyer-education",
              evidence:
                "The sales workflow brief already names pipeline review, ranked account focus, and follow-up decisions as familiar operating jobs.",
              implication:
                "Messaging can start from known workflow pain rather than teaching the whole problem from zero.",
              sourceUrl: "https://example.com/saaslaunch/founder-led-sales",
            },
          ],
        },
      },
    },
    createdAt,
  }) as MarketCategoryArtifact;

export const marketCategoryFixtureSectionOutput =
  marketCategorySectionOutputSchema.parse({
    sectionTitle: marketCategoryFixtureArtifact.sectionTitle,
    verdict: marketCategoryFixtureArtifact.verdict,
    statusSummary: marketCategoryFixtureArtifact.statusSummary,
    confidence: marketCategoryFixtureArtifact.confidence,
    sources: marketCategoryFixtureArtifact.sources.map(
      ({ title, url, publisher }) => ({
        title,
        url,
        publisher,
      }),
    ),
    body: marketCategoryFixtureArtifact.body,
  }) satisfies MarketCategorySectionOutput;

const marketCategoryFixtureMinimums = validateMarketCategoryMinimums(
  marketCategoryFixtureArtifact,
);

if (!marketCategoryFixtureMinimums.ok) {
  throw new Error(
    `marketCategoryFixtureArtifact failed minimums: ${marketCategoryFixtureMinimums.errors.join("; ")}`,
  );
}
