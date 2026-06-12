import { describe, expect, it } from "vitest";

import { summarizeCompetitorAdEvidenceGroups } from "@/lib/lab-engine/agents/tools/competitor-ad-adapter";
import { competitorAdEvidenceGroupSchema } from "@/lib/lab-engine/artifacts/schemas/competitor-landscape";
import type { CompetitorAdEvidenceGroup } from "@/lib/lab-engine/artifacts/schemas/competitor-landscape";
import { checkRequiredEvidenceClasses } from "@/lib/lab-engine/sections/required-evidence";

import {
  mergeAdEvidenceGroups,
  withNormalizedCompetitorAdEvidence,
} from "../run-section";

function adEvidenceGroup(
  overrides: Partial<CompetitorAdEvidenceGroup> = {},
): CompetitorAdEvidenceGroup {
  return {
    advertiserName: "idk",
    domain: null,
    platforms: ["google", "meta", "linkedin"],
    rawCounts: { google: 0, meta: 0, linkedin: 0 },
    displayableCounts: { google: 0, meta: 0, linkedin: 0 },
    displayableTotal: 0,
    returnedCreativeCount: 0,
    verifiedCount: 0,
    quarantinedCount: 0,
    creatives: [],
    rawSourceSamples: [],
    dataGaps: [],
    sourceErrors: [],
    libraryLinks: { google: "", meta: "", linkedin: "" },
    observedAt: "2026-06-09T00:00:00.000Z",
    identityConfidence: "low",
    ...overrides,
  } as unknown as CompetitorAdEvidenceGroup;
}

function proseOf(output: unknown): string {
  const body = (output as { body?: { adEvidence?: { prose?: string } } }).body;
  return body?.adEvidence?.prose ?? "";
}

function adEvidenceBodyOf(output: unknown): Record<string, unknown> {
  return (output as { body: Record<string, unknown> }).body;
}

function clientFacingAdEvidenceSummaryForEmptyGroup(): string {
  return [
    "Live ad-library evidence was collected for 1 advertiser group.",
    "Raw rows by platform: google 0, meta 0, linkedin 0.",
    "Reviewable ad examples by platform: google 0, meta 0, linkedin 0.",
    "Returned ad example count: 0.",
    "Confirmed competitor ad examples: 0.",
    "Unverified ad samples requiring caution: 0.",
    "No ad-library data gaps were reported by the collected tool results.",
  ].join(" ");
}

describe("withNormalizedCompetitorAdEvidence", (): void => {
  // run 73dfbc0d: the model's prose fabricated competitor ad counts against an
  // empty advertiserGroups wall (the poisoned "idk" advertiser returned nothing).
  const fabricatedProse =
    "Notion ran 4 video ads on Meta; ClickUp ran 5 carousel ads.";

  it("replaces unverified model prose with the deterministic summary when there are zero displayable ad creatives", (): void => {
    const groups = [adEvidenceGroup()];

    const result = withNormalizedCompetitorAdEvidence({
      rawOutput: {
        body: { adEvidence: { prose: fabricatedProse, advertiserGroups: [] } },
      },
      normalizedAdEvidenceGroups: groups,
    });

    expect(proseOf(result)).toBe(clientFacingAdEvidenceSummaryForEmptyGroup());
    expect(proseOf(result)).not.toBe(
      summarizeCompetitorAdEvidenceGroups(groups),
    );
    expect(proseOf(result)).not.toContain("Notion");
    expect(proseOf(result)).not.toContain("ClickUp");
  });

  it("keeps the model prose when displayable ad creatives exist", (): void => {
    const groups = [
      adEvidenceGroup({
        advertiserName: "Notion",
        displayableTotal: 2,
        returnedCreativeCount: 2,
        displayableCounts: { google: 2, meta: 0, linkedin: 0 },
        verifiedCount: 1,
        quarantinedCount: 0,
        creatives: [
          {
            id: "notion-verified-1",
            platform: "google",
            advertiserName: "Notion",
            headline: "Run projects and docs in one workspace",
            body: null,
            landingUrl: null,
            creativeUrl: null,
            imageUrl: null,
            videoUrl: null,
            detailsUrl: null,
            sourceUrl: "https://adstransparency.google.com/advertiser/notion",
            firstSeen: null,
            lastSeen: null,
            format: "text",
            isActive: true,
            source: null,
            transcript: null,
            cta: null,
            verified: true,
            identityBasis: "domain",
          },
        ],
      }),
    ];

    const result = withNormalizedCompetitorAdEvidence({
      rawOutput: {
        body: { adEvidence: { prose: fabricatedProse, advertiserGroups: [] } },
      },
      normalizedAdEvidenceGroups: groups,
    });

    expect(proseOf(result)).toBe(fabricatedProse);
  });

  it("replaces model prose when creatives are quarantine-only despite displayable counts", (): void => {
    const groups = [
      adEvidenceGroup({
        advertiserName: "Notion",
        displayableTotal: 41,
        returnedCreativeCount: 2,
        displayableCounts: { google: 0, meta: 41, linkedin: 0 },
        verifiedCount: 0,
        quarantinedCount: 41,
        creatives: [
          {
            id: "notion-quarantine-1",
            platform: "meta",
            advertiserName: "Notion",
            headline: "All-in-one workspace",
            body: null,
            landingUrl: null,
            creativeUrl: null,
            imageUrl: null,
            videoUrl: null,
            detailsUrl: null,
            sourceUrl: "https://www.facebook.com/ads/library/?id=1",
            firstSeen: null,
            lastSeen: null,
            format: "text",
            isActive: true,
            source: null,
            transcript: null,
            cta: null,
            verified: false,
            identityBasis: "name_only",
          },
        ],
        dataGaps: [
          {
            reason:
              "Identity-unverified ad signals only: verifiedCount=0; quarantinedCount=41.",
          },
        ],
      }),
    ];

    const result = withNormalizedCompetitorAdEvidence({
      rawOutput: {
        body: { adEvidence: { prose: fabricatedProse, advertiserGroups: [] } },
      },
      normalizedAdEvidenceGroups: groups,
    });

    expect(proseOf(result)).not.toBe(fabricatedProse);
    expect(proseOf(result)).toContain("Confirmed competitor ad examples: 0");
    expect(proseOf(result)).toContain(
      "Unverified ad samples requiring caution: 41",
    );
    expect(proseOf(result)).not.toContain("quarantine");
    expect(proseOf(result)).not.toContain("displayable");

    const adEvidence = (
      adEvidenceBodyOf(result) as {
        adEvidence: { advertiserGroups: CompetitorAdEvidenceGroup[] };
      }
    ).adEvidence;
    expect(adEvidence.advertiserGroups[0]?.dataGaps[0]).toMatchObject({
      internalDetail:
        "Identity-unverified ad signals only: verifiedCount=0; quarantinedCount=41.",
      reason: "Fewer verified ads than expected for this advertiser.",
    });
  });

  it("rewrites code-authored ad data gaps and source errors for clients", (): void => {
    const groups = [
      adEvidenceGroup({
        dataGaps: [
          {
            platform: "meta",
            reason:
              "meta returned 12 raw rows, but no row had headline, body, image, or video evidence for a unique displayable creative.",
          },
          {
            reason:
              "Returned 6 of 12 displayable creatives to keep the structured artifact bounded.",
          },
        ],
        sourceErrors: [
          {
            platform: "google",
            message: "429 rate limited by upstream provider",
          },
        ],
      }),
    ];

    const result = withNormalizedCompetitorAdEvidence({
      rawOutput: {
        body: { adEvidence: { advertiserGroups: [] } },
      },
      normalizedAdEvidenceGroups: groups,
    });
    const adEvidence = (
      adEvidenceBodyOf(result) as {
        adEvidence: { advertiserGroups: CompetitorAdEvidenceGroup[] };
      }
    ).adEvidence;
    const group = adEvidence.advertiserGroups[0];

    expect(group?.dataGaps).toEqual([
      {
        internalDetail:
          "meta returned 12 raw rows, but no row had headline, body, image, or video evidence for a unique displayable creative.",
        platform: "meta",
        reason:
          "The ad library returned rows, but none had enough creative content to review.",
      },
      {
        internalDetail:
          "Returned 6 of 12 displayable creatives to keep the structured artifact bounded.",
        reason: "Some ad examples were omitted to keep the report readable.",
      },
    ]);
    expect(group?.sourceErrors).toEqual([
      {
        internalDetail: "429 rate limited by upstream provider",
        message: "This ad-library lookup could not be completed.",
        platform: "google",
      },
    ]);
  });

  it("falls back to the deterministic summary when the model omits prose", (): void => {
    const groups = [adEvidenceGroup()];

    const result = withNormalizedCompetitorAdEvidence({
      rawOutput: { body: { adEvidence: { advertiserGroups: [] } } },
      normalizedAdEvidenceGroups: groups,
    });

    expect(proseOf(result)).toBe(clientFacingAdEvidenceSummaryForEmptyGroup());
    expect(proseOf(result)).not.toBe(
      summarizeCompetitorAdEvidenceGroups(groups),
    );
  });

  // Regression for prod run 0eeebd93 (2026-06-09): an empty competitor seed left
  // normalizedAdEvidenceGroups = [], the empty wall failed the adEvidence_or_gap
  // gate (required_evidence_missing), and the whole section hard-errored.
  it("emits one explicit gap group (never an empty wall) when there are zero normalized ad groups", (): void => {
    const result = withNormalizedCompetitorAdEvidence({
      rawOutput: {
        body: { adEvidence: { prose: "anything", advertiserGroups: [] } },
      },
      normalizedAdEvidenceGroups: [],
    });

    const adEvidence = (
      adEvidenceBodyOf(result) as {
        adEvidence: { advertiserGroups: CompetitorAdEvidenceGroup[] };
      }
    ).adEvidence;

    expect(adEvidence.advertiserGroups).toHaveLength(1);
    const group = adEvidence.advertiserGroups[0];
    expect(group.displayableTotal).toBe(0);
    expect(group.returnedCreativeCount).toBe(0);
    expect(group.dataGaps.length).toBeGreaterThan(0);
    // the synthetic group must satisfy the strict competitor schema
    expect(() => competitorAdEvidenceGroupSchema.parse(group)).not.toThrow();

    // and the adEvidence_or_gap gate must now COMMIT (return null) instead of
    // reporting the class missing — the exact failure that errored the section.
    expect(
      checkRequiredEvidenceClasses({
        body: adEvidenceBodyOf(result),
        requiredEvidenceClasses: ["adEvidence_or_gap"],
        sectionId: "positioningCompetitorLandscape",
      }),
    ).toBeNull();
  });

  it("sums duplicate-group identity counts and recomputes confidence", (): void => {
    const baseGroup = adEvidenceGroup({
      advertiserName: "Notion",
      identityConfidence: "low",
      verifiedCount: 0,
      quarantinedCount: 2,
    });
    const nextGroup = adEvidenceGroup({
      advertiserName: "Notion",
      identityConfidence: "verified",
      verifiedCount: 1,
      quarantinedCount: 1,
      creatives: [
        {
          id: "notion-verified-2",
          platform: "meta",
          advertiserName: "Notion",
          headline: "Verified Notion ad",
          body: null,
          landingUrl: null,
          creativeUrl: null,
          imageUrl: null,
          videoUrl: null,
          detailsUrl: null,
          sourceUrl: "https://www.facebook.com/ads/library/?id=2",
          firstSeen: null,
          lastSeen: null,
          format: "text",
          isActive: true,
          source: null,
          transcript: null,
          cta: null,
          verified: true,
          identityBasis: "domain",
        },
      ],
    });

    const [merged] = mergeAdEvidenceGroups([baseGroup], [nextGroup]);

    expect(merged?.verifiedCount).toBe(1);
    expect(merged?.quarantinedCount).toBe(3);
    expect(merged?.identityConfidence).toBe("verified");
  });
});
