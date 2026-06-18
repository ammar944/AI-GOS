import { describe, expect, it } from "vitest";

import {
  reconcileAdEvidenceProseWithVerifiedCounts,
  summarizeCompetitorAdEvidenceGroups,
} from "@/lib/lab-engine/agents/tools/competitor-ad-adapter";
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

  // run 73dfbc0d follow-up: a single verified creative is NOT license to keep
  // prose that claims 4/5 ads. The clamp replaces prose whose max claimed count
  // exceeds totalVerified with the grounded deterministic summary.
  it("replaces overclaiming model prose (claims 4/5 vs 1 verified) with the deterministic summary", (): void => {
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

    const deterministicSummary = summarizeCompetitorAdEvidenceGroups(groups);
    const prose = reconcileAdEvidenceProseWithVerifiedCounts({
      prose: fabricatedProse,
      groups,
      deterministicSummary,
    });

    // totalVerified = 1, but prose claims 4 and 5 → clamp to the grounded summary.
    expect(prose).toBe(deterministicSummary);
    expect(prose).not.toContain("Notion ran 4");
    expect(prose).not.toContain("ClickUp ran 5");
  });

  it("keeps model prose verbatim when its claimed counts do not exceed totalVerified", (): void => {
    const groups = [
      adEvidenceGroup({
        advertiserName: "Notion",
        displayableTotal: 5,
        returnedCreativeCount: 5,
        displayableCounts: { google: 5, meta: 0, linkedin: 0 },
        verifiedCount: 5,
        quarantinedCount: 0,
      }),
    ];

    const deterministicSummary = summarizeCompetitorAdEvidenceGroups(groups);
    const underClaimProse =
      "Notion ran 4 video ads on Google; we confirmed a workspace headline.";
    const prose = reconcileAdEvidenceProseWithVerifiedCounts({
      prose: underClaimProse,
      groups,
      deterministicSummary,
    });

    // max claimed count (4) <= totalVerified (5) → prose kept verbatim.
    expect(prose).toBe(underClaimProse);
  });

  it("clamps prose that uses a vague-large quantity word while few ads are verified", (): void => {
    const groups = [
      adEvidenceGroup({
        advertiserName: "Notion",
        displayableTotal: 1,
        returnedCreativeCount: 1,
        displayableCounts: { google: 1, meta: 0, linkedin: 0 },
        verifiedCount: 1,
        quarantinedCount: 0,
      }),
    ];

    const deterministicSummary = summarizeCompetitorAdEvidenceGroups(groups);
    const vagueProse = "Notion is running dozens of ads across Meta and Google.";
    const prose = reconcileAdEvidenceProseWithVerifiedCounts({
      prose: vagueProse,
      groups,
      deterministicSummary,
    });

    // "dozens" while totalVerified <= 2 → clamp to the grounded summary.
    expect(prose).toBe(deterministicSummary);
    expect(prose).not.toContain("dozens");
  });

  function verifiedHiringCreative(
    id: string,
    headline: string,
  ): CompetitorAdEvidenceGroup["creatives"][number] {
    return {
      id,
      platform: "linkedin",
      advertiserName: "Airbase",
      headline,
      body: null,
      landingUrl: null,
      creativeUrl: null,
      imageUrl: null,
      videoUrl: null,
      detailsUrl: null,
      sourceUrl: "https://www.linkedin.com/ad-library/airbase",
      firstSeen: null,
      lastSeen: null,
      format: "text",
      isActive: true,
      source: null,
      transcript: null,
      cta: null,
      verified: true,
      identityBasis: "domain",
    };
  }

  // Track A.2 (a): the subject is probed on its own wall, so its verified ads
  // must NOT inflate the COMPETITOR verified total the prose clamp gates on.
  it("excludes the subject's own verified creatives from the competitor totalVerified", (): void => {
    const groups = [
      adEvidenceGroup({
        advertiserName: "Ramp",
        domain: "ramp.com",
        verifiedCount: 6,
        isSubject: true,
      }),
      adEvidenceGroup({
        advertiserName: "Brex",
        domain: "brex.com",
        verifiedCount: 1,
      }),
    ];

    const deterministicSummary = summarizeCompetitorAdEvidenceGroups(groups);
    const prose = reconcileAdEvidenceProseWithVerifiedCounts({
      prose: "Brex ran 4 video ads on Meta.",
      groups,
      deterministicSummary,
    });

    // competitor totalVerified = 1 (subject's 6 excluded); claim 4 > 1 → clamp.
    expect(prose).toBe(deterministicSummary);
    expect(prose).not.toContain("Brex ran 4");
  });

  // Track A.2 (b): recruiter/hiring creatives are not product advertising and
  // must be downgraded out of the verified competitor-ad count (never deleted).
  it("downgrades recruiter/hiring creatives so they do not count as verified competitor ads", (): void => {
    const groups = [
      adEvidenceGroup({
        advertiserName: "Airbase",
        domain: "airbase.com",
        verifiedCount: 3,
        creatives: [
          verifiedHiringCreative(
            "airbase-1",
            "We're hiring a Senior AP Manager — join our team",
          ),
          verifiedHiringCreative(
            "airbase-2",
            "Now hiring: Finance Operations Lead",
          ),
          verifiedHiringCreative(
            "airbase-3",
            "Join our team — open roles across GTM",
          ),
        ],
      }),
    ];

    const deterministicSummary = summarizeCompetitorAdEvidenceGroups(groups);
    const prose = reconcileAdEvidenceProseWithVerifiedCounts({
      prose: "Airbase ran 3 ads on LinkedIn.",
      groups,
      deterministicSummary,
    });

    // all 3 verified creatives are hiring posts → competitor totalVerified = 0;
    // claim 3 > 0 → clamp to the grounded summary.
    expect(prose).toBe(deterministicSummary);
    expect(prose).not.toContain("Airbase ran 3");
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

describe("summarizeCompetitorAdEvidenceGroups", (): void => {
  // FIX-COMP: the deterministic summary is what the prose clamp swaps in when
  // the model overclaims. Its verifiedCount/quarantinedCount reducers must
  // exclude the subject's own group (the subject is probed on the same wall) —
  // otherwise the swapped-in summary reports a SUBJECT-INFLATED competitor count
  // (e.g. Ramp's own 6 verified folded into a single competitor's 1).
  it("reports the COMPETITOR verified count, excluding the subject's own group", (): void => {
    const groups = [
      adEvidenceGroup({
        advertiserName: "Ramp",
        domain: "ramp.com",
        verifiedCount: 6,
        isSubject: true,
      }),
      adEvidenceGroup({
        advertiserName: "Brex",
        domain: "brex.com",
        verifiedCount: 1,
      }),
    ];

    const summary = summarizeCompetitorAdEvidenceGroups(groups);

    expect(summary).toContain("Verified competitor ad creatives: 1.");
    expect(summary).not.toContain("Verified competitor ad creatives: 7.");
  });

  it("reports the COMPETITOR quarantine count, excluding the subject's own group", (): void => {
    const groups = [
      adEvidenceGroup({
        advertiserName: "Ramp",
        domain: "ramp.com",
        verifiedCount: 0,
        quarantinedCount: 4,
        isSubject: true,
      }),
      adEvidenceGroup({
        advertiserName: "Brex",
        domain: "brex.com",
        verifiedCount: 0,
        quarantinedCount: 2,
      }),
    ];

    const summary = summarizeCompetitorAdEvidenceGroups(groups);

    // Both groups are quarantine-only → identityLine uses the "0 verified" form
    // and must report ONLY the competitor's 2 quarantine signals, not 6.
    expect(summary).toContain("Quarantine-tier ad signals: 2;");
    expect(summary).not.toContain("Quarantine-tier ad signals: 6;");
  });
});

describe("reconcileAdEvidenceProseWithVerifiedCounts", (): void => {
  const SUMMARY = "Confirmed competitor ad examples: 1.";

  it("returns prose unchanged when no count claim is present", (): void => {
    const groups = [adEvidenceGroup({ verifiedCount: 1 })];
    const prose = "Notion runs ads on Google and Meta.";

    expect(
      reconcileAdEvidenceProseWithVerifiedCounts({
        prose,
        groups,
        deterministicSummary: SUMMARY,
      }),
    ).toBe(prose);
  });

  it("clamps when the single max claimed count exceeds totalVerified", (): void => {
    const groups = [adEvidenceGroup({ verifiedCount: 1 })];

    expect(
      reconcileAdEvidenceProseWithVerifiedCounts({
        prose: "Notion ran 4 ads.",
        groups,
        deterministicSummary: SUMMARY,
      }),
    ).toBe(SUMMARY);
  });

  it("clamps on the MAX claim across multiple count claims", (): void => {
    const groups = [adEvidenceGroup({ verifiedCount: 3 })];

    // 2 <= 3 but 5 > 3 → the max claim governs and we clamp.
    expect(
      reconcileAdEvidenceProseWithVerifiedCounts({
        prose: "Notion ran 2 video ads; ClickUp ran 5 carousel ads.",
        groups,
        deterministicSummary: SUMMARY,
      }),
    ).toBe(SUMMARY);
  });

  it("keeps prose when the max claimed count equals totalVerified", (): void => {
    const groups = [adEvidenceGroup({ verifiedCount: 5 })];
    const prose = "Notion ran 5 carousel ads.";

    expect(
      reconcileAdEvidenceProseWithVerifiedCounts({
        prose,
        groups,
        deterministicSummary: SUMMARY,
      }),
    ).toBe(prose);
  });

  it("sums totalVerified across groups using the creatives fallback", (): void => {
    const groups = [
      adEvidenceGroup({
        verifiedCount: undefined as unknown as number,
        creatives: [
          {
            id: "g1-c1",
            platform: "google",
            advertiserName: "Notion",
            headline: "h",
            body: null,
            landingUrl: null,
            creativeUrl: null,
            imageUrl: null,
            videoUrl: null,
            detailsUrl: null,
            sourceUrl: "https://adstransparency.google.com/advertiser/x",
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
      adEvidenceGroup({ verifiedCount: 2 }),
    ];
    const prose = "Competitors ran 3 ads in total.";

    // 1 (creatives fallback) + 2 = 3, max claim 3 <= 3 → kept verbatim.
    expect(
      reconcileAdEvidenceProseWithVerifiedCounts({
        prose,
        groups,
        deterministicSummary: SUMMARY,
      }),
    ).toBe(prose);
  });

  it.each(["dozens", "hundreds", "many"])(
    "clamps the vague-large quantity word %s when totalVerified is small",
    (word): void => {
      const groups = [adEvidenceGroup({ verifiedCount: 2 })];

      expect(
        reconcileAdEvidenceProseWithVerifiedCounts({
          prose: `Notion is running ${word} of ads.`,
          groups,
          deterministicSummary: SUMMARY,
        }),
      ).toBe(SUMMARY);
    },
  );

  it("keeps a vague-large quantity word when totalVerified is not small", (): void => {
    const groups = [adEvidenceGroup({ verifiedCount: 9 })];
    const prose = "Notion is running dozens of ads.";

    // totalVerified (9) > 2 → vague-large word is tolerated, no integer overclaim.
    expect(
      reconcileAdEvidenceProseWithVerifiedCounts({
        prose,
        groups,
        deterministicSummary: SUMMARY,
      }),
    ).toBe(prose);
  });
});
