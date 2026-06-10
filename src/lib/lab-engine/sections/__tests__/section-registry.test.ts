import { describe, expect, it } from "vitest";

import {
  ALL_POSITIONING_SECTION_IDS,
  POSITIONING_SECTION_IDS,
} from "@/lib/ai/prompts/positioning-skills";
import { SECTION_REGISTRY } from "../section-registry";

describe("SECTION_REGISTRY live-tool budgets", (): void => {
  it("matches the Phase D bounded in-section tool contract", (): void => {
    expect(SECTION_REGISTRY.positioningMarketCategory).toMatchObject({
      allowedTools: ["web_search", "firecrawl", "keyword_volume"],
      maxExternalLookups: 5,
      requiredEvidenceClasses: ["marketCategory_name"],
    });
    expect(SECTION_REGISTRY.positioningBuyerICP).toMatchObject({
      allowedTools: ["web_search", "firecrawl"],
      maxExternalLookups: 6,
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
      scrapeReservedLookups: 2,
      requiredEvidenceClasses: ["voc_quote_or_gap"],
    });
    expect(SECTION_REGISTRY.positioningDemandIntent).toMatchObject({
      allowedTools: [
        "web_search",
        "keyword_ad_probe",
        "keyword_volume",
        "keyword_trends",
        "firecrawl",
      ],
      maxExternalLookups: 7,
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

  it("keeps W4 lookup headroom selective to BuyerICP and DemandIntent", (): void => {
    expect(SECTION_REGISTRY.positioningBuyerICP.requiredEvidenceClasses).toEqual([
      "icp_persona",
      "icp_quote_or_gap",
    ]);
    expect(SECTION_REGISTRY.positioningBuyerICP.maxExternalLookups).toBe(6);
    expect(SECTION_REGISTRY.positioningDemandIntent.maxExternalLookups).toBe(7);
    expect(SECTION_REGISTRY.positioningOfferDiagnostic.maxExternalLookups).toBe(4);
  });

  // P4: the committable gate now reads definition.loadBearingKinds off the
  // descriptor (was the gate's getLoadBearingKindsForSection ternary). Pin the
  // per-section values here so a registry edit cannot silently change which
  // claim kinds the gate treats as load-bearing.
  it("carries the per-section load-bearing claim kinds on the descriptor", (): void => {
    expect(SECTION_REGISTRY.positioningVoiceOfCustomer.loadBearingKinds).toEqual([
      "numeric",
      "url",
      "quote",
    ]);
    expect(SECTION_REGISTRY.positioningPaidMediaPlan.loadBearingKinds).toEqual([
      "url",
    ]);
    expect(SECTION_REGISTRY.positioningMarketCategory.loadBearingKinds).toEqual([
      "numeric",
      "url",
    ]);
  });
});

describe("post-six section registration", (): void => {
  it("registers exactly seven sections including paid-media", (): void => {
    const ids = Object.keys(SECTION_REGISTRY);
    expect(ids).toHaveLength(7);
    expect(ids).toContain("positioningPaidMediaPlan");
  });

  // The parent rollup keys on POSITIONING_SECTION_IDS.length (6) and
  // derivedChildrenComplete filters by isPositioningSectionId. Paid-media must
  // stay OUT of the six so it can never bump children_total / block completion.
  it("keeps paid-media out of the six-section parent rollup", (): void => {
    expect(POSITIONING_SECTION_IDS).toHaveLength(6);
    expect(POSITIONING_SECTION_IDS as readonly string[]).not.toContain(
      "positioningPaidMediaPlan",
    );
    expect(ALL_POSITIONING_SECTION_IDS as readonly string[]).toContain(
      "positioningPaidMediaPlan",
    );
  });
});
