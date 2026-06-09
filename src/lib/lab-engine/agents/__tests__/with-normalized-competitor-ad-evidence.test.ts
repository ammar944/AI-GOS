import { describe, expect, it } from "vitest";

import { summarizeCompetitorAdEvidenceGroups } from "@/lib/lab-engine/agents/tools/competitor-ad-adapter";
import { competitorAdEvidenceGroupSchema } from "@/lib/lab-engine/artifacts/schemas/competitor-landscape";
import type { CompetitorAdEvidenceGroup } from "@/lib/lab-engine/artifacts/schemas/competitor-landscape";
import { checkRequiredEvidenceClasses } from "@/lib/lab-engine/sections/required-evidence";

import { withNormalizedCompetitorAdEvidence } from "../run-section";

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

    expect(proseOf(result)).toBe(summarizeCompetitorAdEvidenceGroups(groups));
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

  it("falls back to the deterministic summary when the model omits prose", (): void => {
    const groups = [adEvidenceGroup()];

    const result = withNormalizedCompetitorAdEvidence({
      rawOutput: { body: { adEvidence: { advertiserGroups: [] } } },
      normalizedAdEvidenceGroups: groups,
    });

    expect(proseOf(result)).toBe(summarizeCompetitorAdEvidenceGroups(groups));
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
});
