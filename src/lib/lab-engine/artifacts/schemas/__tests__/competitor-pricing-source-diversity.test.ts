import { describe, expect, it } from "vitest";

import { competitorLandscapeFixtureArtifact } from "../../../fixtures/competitor-landscape-artifact";
import {
  checkCompetitorPricingSourceDiversity,
  type CompetitorLandscapeArtifact,
} from "../competitor-landscape";

type Competitor =
  CompetitorLandscapeArtifact["body"]["competitorSet"]["competitors"][number];
type PricingPoint =
  CompetitorLandscapeArtifact["body"]["pricingReality"]["dataPoints"][number];

const subjectDomain = "https://acme.com";

// Competitors carrying DISTINCT registrable domains so the competitor-own-domain
// classifier inside the gate can cleanly separate first-party pricing pages from
// third-party aggregators.
const competitors: Competitor[] = [
  {
    name: "ClickUp",
    url: "https://clickup.com",
    competitorType: "direct",
    oneLinePositioning: "One app to replace them all.",
    verbatimHeroCopy: "One App, 10x More Done",
    pricingPosition: "freemium",
    sourceUrl: "https://clickup.com/pricing",
  },
  {
    name: "Smartsheet",
    url: "https://smartsheet.com",
    competitorType: "direct",
    oneLinePositioning: "Enterprise work management.",
    verbatimHeroCopy: "Modern work management",
    pricingPosition: "sales-led",
    sourceUrl: "https://smartsheet.com/pricing",
  },
  {
    name: "Notion",
    url: "https://notion.so",
    competitorType: "indirect",
    oneLinePositioning: "Connected workspace.",
    verbatimHeroCopy: "Write, plan, organize",
    pricingPosition: "freemium",
    sourceUrl: "https://notion.so/pricing",
  },
];

function pricingPoint(
  competitor: string,
  sourceUrl: string,
  index: number,
): PricingPoint {
  return {
    competitor,
    tierName: `Tier ${index}`,
    monthlyPrice: `$${10 + index}/user/mo`,
    packagingPattern: "per-seat",
    gatedSignals: "Public pricing page lists per-seat tiers.",
    sourceUrl,
  };
}

function withPricing(
  dataPoints: PricingPoint[],
  options: { blockGap?: boolean } = {},
): CompetitorLandscapeArtifact {
  return {
    ...competitorLandscapeFixtureArtifact,
    body: {
      ...competitorLandscapeFixtureArtifact.body,
      competitorSet: {
        ...competitorLandscapeFixtureArtifact.body.competitorSet,
        competitors,
      },
      pricingReality: {
        ...competitorLandscapeFixtureArtifact.body.pricingReality,
        dataPoints,
        blockGap: options.blockGap
          ? {
              summary:
                "Public pricing was gated for most competitors this run.",
              foundCount: dataPoints.length,
              requiredCount: 2,
              sourcingPlan: [
                "Re-run acquisition against each competitor's own pricing page.",
              ],
            }
          : undefined,
      },
    },
  };
}

describe("checkCompetitorPricingSourceDiversity", (): void => {
  it("rejects a single non-vendor blog monopolizing the pricing rows", (): void => {
    // 4 rows, 3 from one third-party aggregator (zite.com); threshold floor(4/2)=2.
    const artifact = withPricing([
      pricingPoint("ClickUp", "https://zite.com/airtable-alternatives", 1),
      pricingPoint("Smartsheet", "https://zite.com/airtable-alternatives", 2),
      pricingPoint("Notion", "https://zite.com/airtable-alternatives", 3),
      pricingPoint("ClickUp", "https://clickup.com/pricing", 4),
    ]);

    const result = checkCompetitorPricingSourceDiversity({
      artifact,
      subjectDomain,
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("zite.com");
    expect(result.errors.join(" ")).toContain("single-source majority");
  });

  it("passes a diverse pricing set with no single third-party majority", (): void => {
    const artifact = withPricing([
      pricingPoint("ClickUp", "https://clickup.com/pricing", 1),
      pricingPoint("Smartsheet", "https://smartsheet.com/pricing", 2),
      pricingPoint("Notion", "https://zite.com/airtable-alternatives", 3),
      pricingPoint("ClickUp", "https://g2.com/categories/project-management", 4),
    ]);

    const result = checkCompetitorPricingSourceDiversity({
      artifact,
      subjectDomain,
    });

    expect(result).toEqual({ ok: true, errors: [] });
  });

  it("does not penalize a competitor's own pricing page dominating the table", (): void => {
    // All rows are first-party competitor pricing pages — legitimate, never a
    // third-party monopoly even though one domain repeats.
    const artifact = withPricing([
      pricingPoint("ClickUp", "https://clickup.com/pricing", 1),
      pricingPoint("ClickUp", "https://clickup.com/pricing/business", 2),
      pricingPoint("ClickUp", "https://clickup.com/pricing/enterprise", 3),
      pricingPoint("Smartsheet", "https://smartsheet.com/pricing", 4),
    ]);

    const result = checkCompetitorPricingSourceDiversity({
      artifact,
      subjectDomain,
    });

    expect(result).toEqual({ ok: true, errors: [] });
  });

  it("honors the hasBlockGap escape even when a third-party blog dominates", (): void => {
    const artifact = withPricing(
      [
        pricingPoint("ClickUp", "https://zite.com/airtable-alternatives", 1),
        pricingPoint("Smartsheet", "https://zite.com/airtable-alternatives", 2),
        pricingPoint("Notion", "https://zite.com/airtable-alternatives", 3),
      ],
      { blockGap: true },
    );

    const result = checkCompetitorPricingSourceDiversity({
      artifact,
      subjectDomain,
    });

    expect(result).toEqual({ ok: true, errors: [] });
  });
});
