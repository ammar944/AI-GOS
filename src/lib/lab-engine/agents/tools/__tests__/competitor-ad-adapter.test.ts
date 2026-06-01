import { describe, expect, it } from "vitest";

import { buildCompetitorAdEvidenceGroups } from "../competitor-ad-adapter";

describe("buildCompetitorAdEvidenceGroups", (): void => {
  it("sets the group domain from the matching ad tool input", (): void => {
    const groups = buildCompetitorAdEvidenceGroups({
      observedAt: "2026-05-28T00:00:00.000Z",
      steps: [
        {
          stepNumber: 0,
          finishReason: "tool-calls",
          text: "",
          toolCalls: [
            {
              toolName: "google_ads",
              input: {
                advertiser: "Gong",
                domain: "gong.io",
                max_results: 4,
              },
            },
          ],
          toolResults: [
            {
              toolName: "google_ads",
              output: {
                type: "result",
                advertiser: "Gong",
                platform: "google",
                ads: [
                  {
                    url: "https://adstransparency.google.com/advertiser/gong",
                    id: "gong-ad-1",
                    advertiserName: "Gong",
                    title: "Improve forecast accuracy",
                    detailsUrl:
                      "https://adstransparency.google.com/advertiser/gong",
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      advertiserName: "Gong",
      domain: "gong.io",
      returnedCreativeCount: 1,
    });
  });

  it("emits exactly one not-probed linkedin dataGap and never adds linkedin to platforms", () => {
    const groups = buildCompetitorAdEvidenceGroups({
      observedAt: "2026-05-28T00:00:00.000Z",
      steps: [
        {
          stepNumber: 0,
          finishReason: "tool-calls",
          text: "",
          toolCalls: [
            {
              toolName: "google_ads",
              input: { advertiser: "Gong", domain: "gong.io", max_results: 4 },
            },
            {
              toolName: "meta_ads",
              input: { advertiser: "Gong", domain: "gong.io", max_results: 4 },
            },
          ],
          toolResults: [
            {
              toolName: "google_ads",
              output: {
                type: "result",
                advertiser: "Gong",
                platform: "google",
                ads: [
                  {
                    url: "https://adstransparency.google.com/advertiser/gong",
                    id: "gong-ad-1",
                    advertiserName: "Gong",
                    title: "Improve forecast accuracy",
                    detailsUrl:
                      "https://adstransparency.google.com/advertiser/gong",
                  },
                ],
              },
            },
            {
              toolName: "meta_ads",
              output: {
                type: "result",
                advertiser: "Gong",
                platform: "meta",
                ads: [
                  {
                    url: "https://www.facebook.com/ads/library/?id=gong-meta-1",
                    id: "gong-meta-1",
                    advertiserName: "Gong",
                    title: "Win more deals",
                    detailsUrl:
                      "https://www.facebook.com/ads/library/?id=gong-meta-1",
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(groups).toHaveLength(1);
    const [group] = groups;

    // Built only from google_ads + meta_ads results: linkedin is never probed.
    expect(group.platforms).not.toContain("linkedin");
    expect(group.platforms).toEqual(expect.arrayContaining(["google", "meta"]));

    // Exactly one linkedin dataGap, and it states the channel was not probed.
    const linkedinGaps = group.dataGaps.filter(
      (gap) => gap.platform === "linkedin",
    );
    expect(linkedinGaps).toHaveLength(1);
    expect(linkedinGaps[0]?.reason).toMatch(/not probed this run/i);
    expect(linkedinGaps[0]?.reason).toMatch(/structurally 0/i);

    // No bogus linkedin "returned no raw rows" gap leaked through rawCountGaps.
    expect(
      group.dataGaps.some(
        (gap) =>
          gap.platform === "linkedin" &&
          /returned no raw ad-library rows/i.test(gap.reason),
      ),
    ).toBe(false);
  });
});
