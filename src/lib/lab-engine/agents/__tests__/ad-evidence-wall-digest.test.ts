import { describe, expect, it } from "vitest";

import type { CompetitorAdEvidenceGroup } from "../../artifacts/schemas/competitor-landscape";
import {
  AD_EVIDENCE_WALL_DIGEST_TOOL_NAME,
  buildAdEvidenceWallDigestStep,
} from "../ad-evidence-wall-digest";

function buildCreative(
  overrides: Partial<CompetitorAdEvidenceGroup["creatives"][number]> = {},
): CompetitorAdEvidenceGroup["creatives"][number] {
  return {
    id: "creative-1",
    platform: "meta",
    advertiserName: "Notion",
    headline: "Stop Drowning in Spreadsheets",
    body: "One workspace for every team.",
    landingUrl: "https://www.notion.so/",
    creativeUrl: null,
    imageUrl: null,
    videoUrl: null,
    detailsUrl: "https://www.facebook.com/ads/library/?id=680819654125583",
    sourceUrl: "https://www.facebook.com/ads/library/?id=680819654125583",
    firstSeen: "2026-05-01",
    lastSeen: "2026-06-01",
    format: "image",
    isActive: true,
    source: "meta_ads",
    transcript: null,
    cta: "Learn more",
    verified: true,
    ...overrides,
  };
}

function buildGroup(
  overrides: Partial<CompetitorAdEvidenceGroup> = {},
): CompetitorAdEvidenceGroup {
  return {
    advertiserName: "Notion",
    domain: "notion.so",
    platforms: ["google", "meta"],
    rawCounts: { google: 13, meta: 17, linkedin: 0 },
    displayableCounts: { google: 13, meta: 15, linkedin: 0 },
    displayableTotal: 28,
    returnedCreativeCount: 12,
    creatives: [buildCreative()],
    libraryLinks: {
      meta: "https://www.facebook.com/ads/library/",
    },
    rawSourceSamples: [],
    dataGaps: [{ platform: "linkedin", reason: "LinkedIn library not probed" }],
    sourceErrors: [
      { platform: "google", message: "no sufficient confidence match" },
    ],
    observedAt: "2026-06-11",
    identityConfidence: "verified",
    quarantinedCount: 2,
    verifiedCount: 26,
    ...overrides,
  };
}

describe("buildAdEvidenceWallDigestStep", (): void => {
  it("returns undefined for an empty wall", (): void => {
    expect(buildAdEvidenceWallDigestStep([])).toBeUndefined();
  });

  it("renders the wall counts, hooks, urls, gaps, and errors per advertiser", (): void => {
    const step = buildAdEvidenceWallDigestStep([buildGroup()]);

    expect(step).toBeDefined();
    expect(step?.toolResults).toHaveLength(1);

    const toolResult = step?.toolResults[0];
    expect(toolResult?.toolName).toBe(AD_EVIDENCE_WALL_DIGEST_TOOL_NAME);

    const output = toolResult?.output as {
      advertisers: Array<{
        advertiser: string;
        digest: string;
        hooks: readonly string[];
        urls: readonly string[];
        dataGaps: readonly string[];
        sourceErrors: readonly string[];
      }>;
    };
    const advertiser = output.advertisers[0];

    expect(advertiser?.advertiser).toBe("Notion");
    expect(advertiser?.digest).toContain(
      "Notion (notion.so) — 28 displayable creatives (13 Google, 15 Meta)",
    );
    expect(advertiser?.digest).toContain("verifiedCount=26");
    expect(advertiser?.digest).toContain("quarantinedCount=2");
    expect(advertiser?.digest).toContain(
      'top hooks: "Stop Drowning in Spreadsheets"',
    );
    expect(advertiser?.hooks).toEqual(["Stop Drowning in Spreadsheets"]);
    expect(advertiser?.urls).toEqual(
      expect.arrayContaining([
        "https://www.facebook.com/ads/library/?id=680819654125583",
        "https://www.facebook.com/ads/library/",
      ]),
    );
    expect(advertiser?.dataGaps).toEqual(["LinkedIn library not probed"]);
    expect(advertiser?.sourceErrors).toEqual([
      "google: no sufficient confidence match",
    ]);
  });

  it("dedupes repeated hooks and omits the hooks label when no creative has a headline", (): void => {
    const step = buildAdEvidenceWallDigestStep([
      buildGroup({
        creatives: [
          buildCreative({ id: "a" }),
          buildCreative({ id: "b" }),
          buildCreative({ id: "c", headline: null }),
        ],
      }),
      buildGroup({
        advertiserName: "Monday.com",
        domain: null,
        displayableCounts: { google: 0, meta: 0, linkedin: 0 },
        displayableTotal: 0,
        returnedCreativeCount: 0,
        creatives: [],
        libraryLinks: {},
        dataGaps: [],
        sourceErrors: [],
        quarantinedCount: 0,
        verifiedCount: 0,
      }),
    ]);

    const output = step?.toolResults[0]?.output as {
      advertisers: Array<{ digest: string; hooks: readonly string[] }>;
    };

    expect(output.advertisers[0]?.hooks).toEqual([
      "Stop Drowning in Spreadsheets",
    ]);
    expect(output.advertisers[1]?.digest).toContain(
      "Monday.com — 0 displayable creatives;",
    );
    expect(output.advertisers[1]?.digest).not.toContain("top hooks:");
  });
});
