import { describe, expect, it } from "vitest";

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
      allowedTools: ["web_search", "keyword_ad_probe", "firecrawl"],
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
  });
});
