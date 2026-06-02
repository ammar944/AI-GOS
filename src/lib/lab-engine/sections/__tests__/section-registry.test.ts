import { describe, expect, it } from "vitest";

import {
  ALL_POSITIONING_SECTION_IDS,
  POSITIONING_SECTION_IDS,
  isPositioningSectionId,
} from "@/lib/ai/prompts/positioning-skills";
import { SECTION_REGISTRY } from "../section-registry";

describe("SECTION_REGISTRY live-tool budgets", (): void => {
  it("matches the Phase D bounded in-section tool contract", (): void => {
    expect(SECTION_REGISTRY.positioningMarketCategory).toMatchObject({
      allowedTools: ["web_search", "firecrawl"],
      maxExternalLookups: 4,
      requiredEvidenceClasses: ["marketCategory_name"],
    });
    expect(SECTION_REGISTRY.positioningBuyerICP).toMatchObject({
      allowedTools: ["web_search", "firecrawl"],
      maxExternalLookups: 4,
      requiredEvidenceClasses: ["icp_persona", "icp_quote_or_gap"],
    });
    expect(SECTION_REGISTRY.positioningCompetitorLandscape).toMatchObject({
      allowedTools: [
        "web_search",
        "firecrawl",
        "adlibrary",
        "google_ads",
        "meta_ads",
        "linkedin_ads",
        "reviews",
      ],
      maxExternalLookups: 6,
      requiredEvidenceClasses: ["competitor", "adEvidence_or_gap"],
    });
    expect(SECTION_REGISTRY.positioningVoiceOfCustomer).toMatchObject({
      allowedTools: ["web_search", "reviews", "firecrawl"],
      maxExternalLookups: 5,
      requiredEvidenceClasses: ["voc_quote_or_gap"],
    });
    expect(SECTION_REGISTRY.positioningDemandIntent).toMatchObject({
      allowedTools: [
        "web_search",
        "keyword_ad_probe",
        "keyword_volume",
        "firecrawl",
      ],
      maxExternalLookups: 5,
      requiredEvidenceClasses: ["demand_signal_or_gap"],
    });
    expect(SECTION_REGISTRY.positioningOfferDiagnostic).toMatchObject({
      allowedTools: ["web_search", "firecrawl", "pagespeed"],
      maxExternalLookups: 4,
      requiredEvidenceClasses: ["offer_axis"],
    });
    expect(SECTION_REGISTRY.positioningPaidMediaPlan).toMatchObject({
      allowedTools: ["keyword_ad_probe"],
      maxExternalLookups: 2,
    });
    expect(SECTION_REGISTRY.positioningSynthesis).toMatchObject({
      skillSlug: "positioning-synthesis",
      allowedTools: [],
      maxExternalLookups: 0,
      requiredEvidenceClasses: [],
    });
  });
});

describe("positioningSynthesis registration", (): void => {
  it("registers exactly eight sections including the synthesis capstone", (): void => {
    const ids = Object.keys(SECTION_REGISTRY);
    expect(ids).toHaveLength(8);
    expect(ids).toContain("positioningSynthesis");
  });

  // The parent rollup keys on POSITIONING_SECTION_IDS.length (6) and
  // derivedChildrenComplete filters by isPositioningSectionId. Synthesis must
  // stay OUT of the six so it can never bump children_total / block completion.
  it("keeps synthesis out of the six-section parent rollup", (): void => {
    expect(POSITIONING_SECTION_IDS).toHaveLength(6);
    expect(POSITIONING_SECTION_IDS as readonly string[]).not.toContain(
      "positioningSynthesis",
    );
    expect(isPositioningSectionId("positioningSynthesis")).toBe(false);
    expect(ALL_POSITIONING_SECTION_IDS as readonly string[]).toContain(
      "positioningSynthesis",
    );
  });
});
