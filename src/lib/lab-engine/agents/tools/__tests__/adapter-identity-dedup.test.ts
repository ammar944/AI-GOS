import { describe, expect, it } from "vitest";

import { buildCompetitorAdEvidenceGroups } from "../competitor-ad-adapter";

// Part B linchpin: the SAME Meta ad arrives twice in one advertiser step — first
// quarantined from the SearchAPI name-only path (identityVerified:false),
// then domain-verified from the Foreplay page-id recovery path
// (identityVerified:true). Because the quarantined copy is inserted first and
// the two have identical content (= identical richness), the dedup must promote
// on IDENTITY, not lose the tie to insertion order — otherwise the recovered ad
// never reaches the verified wall.
function stepWithDuplicateMetaAd() {
  const sharedAd = {
    url: "https://www.facebook.com/ads/library/?id=ramp-1",
    id: "ramp-1",
    advertiserName: "Ramp",
    title: "Meet the $32B Finance Platform.",
  };

  return {
    stepNumber: 0,
    finishReason: "tool-calls" as const,
    text: "",
    toolCalls: [
      { toolName: "meta_ads", input: { advertiser: "Ramp", domain: "ramp.com", max_results: 8 } },
    ],
    toolResults: [
      {
        toolName: "meta_ads",
        output: {
          type: "result" as const,
          advertiser: "Ramp",
          platform: "meta" as const,
          // name-only SearchAPI path: quarantined
          ads: [{ ...sharedAd, identityVerified: false, identityBasis: "name_only" }],
        },
      },
      {
        toolName: "meta_ads",
        output: {
          type: "result" as const,
          advertiser: "Ramp",
          platform: "meta" as const,
          // Foreplay domain-resolved page-id path: verified
          ads: [{ ...sharedAd, identityVerified: true, identityBasis: "domain" }],
        },
      },
    ],
  };
}

describe("buildCompetitorAdEvidenceGroups — identity-first dedup (Part B)", (): void => {
  it("promotes the domain-verified duplicate over the earlier quarantined copy of the same ad", (): void => {
    const groups = buildCompetitorAdEvidenceGroups({
      observedAt: "2026-06-03T00:00:00.000Z",
      steps: [stepWithDuplicateMetaAd()],
    });

    const group = groups[0];
    expect(group).toBeDefined();
    // Deduped to a single unique creative...
    expect(group?.creatives).toHaveLength(1);
    // ...and that creative is the VERIFIED one (reaches the wall), not the
    // first-inserted quarantined copy.
    expect(group?.creatives[0]?.verified).toBe(true);
  });
});
