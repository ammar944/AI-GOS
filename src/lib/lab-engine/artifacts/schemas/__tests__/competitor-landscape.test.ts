import { describe, expect, it } from "vitest";

import { normalizeCompetitorLandscapeBody } from "../competitor-landscape";

// Defect 2 (run 3b568ea0): the model bakes inflated "N verified" counts into the
// free-text evidence of adPresence.signals + shareOfVoice.slices ("15 verified
// Google ads" while only 12 creatives were captured). The structured
// verifiedCount is already clamped by the ad adapter, but these narrative
// numbers leak past it and the buyer-eval COMPETITOR-COUNT check reads them.
// normalizeCompetitorLandscapeBody must clamp every claimed "N verified" down to
// the captured creatives for that advertiser so claimed <= captured everywhere.

function creative(id: string, advertiserName: string, platform = "google") {
  return {
    id,
    platform,
    advertiserName,
    headline: "headline",
    body: "body",
    landingUrl: null,
    creativeUrl: null,
    imageUrl: null,
    videoUrl: null,
    detailsUrl: null,
    sourceUrl: "https://example.com/ad",
    firstSeen: null,
    lastSeen: null,
    format: "image",
    isActive: true,
    source: null,
    transcript: null,
    cta: null,
    verified: true,
  };
}

function bodyWithCapturedAndClaims({
  capturedPerAdvertiser,
  signalEvidence,
  sliceEvidence,
  sliceWinner,
}: {
  capturedPerAdvertiser: number;
  signalEvidence: string;
  sliceEvidence: string;
  sliceWinner: string;
}): Record<string, unknown> {
  const creatives = Array.from({ length: capturedPerAdvertiser }, (_, index) =>
    creative(`notion-${index}`, "Notion"),
  );

  return {
    adEvidence: {
      prose: "Live ad evidence captured.",
      advertiserGroups: [
        {
          advertiserName: "Notion",
          domain: "notion.so",
          platforms: ["google"],
          rawCounts: { google: capturedPerAdvertiser, meta: 0, linkedin: 0 },
          displayableCounts: {
            google: capturedPerAdvertiser,
            meta: 0,
            linkedin: 0,
          },
          displayableTotal: capturedPerAdvertiser,
          returnedCreativeCount: capturedPerAdvertiser,
          creatives,
          libraryLinks: {},
          rawSourceSamples: [],
          dataGaps: [],
          sourceErrors: [],
          observedAt: "2026-06-16T00:00:00.000Z",
          verifiedCount: capturedPerAdvertiser,
        },
      ],
    },
    adPresence: {
      prose: "Ad presence summary.",
      signals: [
        {
          competitor: "Notion",
          platforms: ["google"],
          estSpend: "Unknown",
          evidence: signalEvidence,
          sourceUrl: "https://example.com/notion",
        },
      ],
    },
    shareOfVoice: {
      prose: "Share of voice summary.",
      slices: [
        {
          surface: "Google Search",
          winner: sliceWinner,
          evidence: sliceEvidence,
          sourceUrl: "https://example.com/sov",
        },
      ],
    },
  };
}

const VERIFIED_RE = /(\d+)\s+(?:total\s+)?verified/gi;

function maxClaimedVerified(text: string): number {
  let max = 0;
  for (const match of text.matchAll(VERIFIED_RE)) {
    max = Math.max(max, Number(match[1]));
  }
  return max;
}

describe("normalizeCompetitorLandscapeBody — verified-count clamp (Defect 2)", () => {
  it("clamps an inflated 'N verified' claim in adPresence.signals down to captured creatives", () => {
    const normalized = normalizeCompetitorLandscapeBody(
      bodyWithCapturedAndClaims({
        capturedPerAdvertiser: 12,
        signalEvidence: "Running 15 verified Google ads for evaluators.",
        sliceEvidence: "Holds presence here.",
        sliceWinner: "Notion",
      }),
    ) as Record<string, unknown>;

    const signals = (normalized.adPresence as Record<string, unknown>)
      .signals as Array<Record<string, unknown>>;
    const evidence = signals[0].evidence as string;

    // 15 -> 12 (captured), and never above captured.
    expect(evidence).toContain("12 verified");
    expect(evidence).not.toContain("15 verified");
    expect(maxClaimedVerified(evidence)).toBeLessThanOrEqual(12);
  });

  it("clamps inflated 'N verified' claims in shareOfVoice slices (evidence + winner) too", () => {
    const normalized = normalizeCompetitorLandscapeBody(
      bodyWithCapturedAndClaims({
        capturedPerAdvertiser: 12,
        signalEvidence: "No count here.",
        sliceEvidence: "Notion leads with 15 verified creatives this surface.",
        sliceWinner: "Notion (29 verified ads)",
      }),
    ) as Record<string, unknown>;

    const slices = (normalized.shareOfVoice as Record<string, unknown>)
      .slices as Array<Record<string, unknown>>;
    const evidence = slices[0].evidence as string;
    const winner = slices[0].winner as string;

    expect(maxClaimedVerified(evidence)).toBeLessThanOrEqual(12);
    expect(maxClaimedVerified(winner)).toBeLessThanOrEqual(12);
    expect(maxClaimedVerified(`${evidence} ${winner}`)).toBeLessThanOrEqual(12);
  });

  it("leaves an honest claim that does not exceed captured creatives untouched", () => {
    const normalized = normalizeCompetitorLandscapeBody(
      bodyWithCapturedAndClaims({
        capturedPerAdvertiser: 12,
        signalEvidence: "Running 8 verified Google ads.",
        sliceEvidence: "Holds presence here.",
        sliceWinner: "Notion",
      }),
    ) as Record<string, unknown>;

    const signals = (normalized.adPresence as Record<string, unknown>)
      .signals as Array<Record<string, unknown>>;
    expect(signals[0].evidence).toBe("Running 8 verified Google ads.");
  });

  it("guarantees no claimed verified count exceeds captured for the attributed advertiser", () => {
    const normalized = normalizeCompetitorLandscapeBody(
      bodyWithCapturedAndClaims({
        capturedPerAdvertiser: 12,
        signalEvidence: "Notion runs 15 verified Google ads and more.",
        sliceEvidence: "Notion holds 29 verified creatives here.",
        sliceWinner: "Notion — 35 verified",
      }),
    ) as Record<string, unknown>;

    const signals = (normalized.adPresence as Record<string, unknown>)
      .signals as Array<Record<string, unknown>>;
    const slices = (normalized.shareOfVoice as Record<string, unknown>)
      .slices as Array<Record<string, unknown>>;

    const allText = [
      signals[0].evidence as string,
      slices[0].evidence as string,
      slices[0].winner as string,
    ].join(" ");

    expect(maxClaimedVerified(allText)).toBeLessThanOrEqual(12);
  });
});
