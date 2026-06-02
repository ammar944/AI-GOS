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

  it("collapses the same numeric-id creative across providers and keeps the richer (video) variant", () => {
    const groups = buildCompetitorAdEvidenceGroups({
      observedAt: "2026-05-28T00:00:00.000Z",
      steps: [
        {
          stepNumber: 0,
          finishReason: "tool-calls",
          text: "",
          toolCalls: [
            {
              toolName: "meta_ads",
              input: { advertiser: "Gong", domain: "gong.io", max_results: 4 },
            },
            {
              toolName: "adlibrary",
              input: { advertiser: "Gong", domain: "gong.io", max_results: 4 },
            },
          ],
          toolResults: [
            {
              // SearchAPI: bare image variant of ad 555.
              toolName: "meta_ads",
              output: {
                type: "result",
                advertiser: "Gong",
                platform: "meta",
                ads: [
                  {
                    url: "https://www.facebook.com/ads/library/?id=555",
                    id: "555",
                    advertiserName: "Gong",
                    title: "Win more deals",
                    imageUrl: "https://cdn.example.com/555.jpg",
                    detailsUrl: "https://www.facebook.com/ads/library/?id=555",
                  },
                ],
              },
            },
            {
              // Foreplay: richer video + transcript variant of the SAME ad 555.
              toolName: "adlibrary",
              output: {
                type: "result",
                advertiser: "Gong",
                platform: "meta",
                ads: [
                  {
                    url: "https://foreplay.co/ad/555",
                    id: "555",
                    advertiserName: "Gong",
                    title: "Totally different headline",
                    videoUrl: "https://cdn.example.com/555.mp4",
                    transcript: "Spoken script of the winning video ad.",
                    source: "foreplay",
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

    // Two raw rows, ONE unique creative (richer-wins), counted once.
    expect(group.rawCounts.meta).toBe(2);
    expect(group.displayableCounts.meta).toBe(1);
    expect(group.displayableTotal).toBe(1);
    expect(group.returnedCreativeCount).toBe(1);
    expect(group.creatives).toHaveLength(1);

    // The richer (video + transcript + foreplay) variant won.
    expect(group.creatives[0]?.videoUrl).toBe("https://cdn.example.com/555.mp4");
    expect(group.creatives[0]?.transcript).toBe(
      "Spoken script of the winning video ad.",
    );
    expect(group.creatives[0]?.source).toBe("foreplay");

    // "X of Y displayable" copy stays true — no truncation gap for a single unique.
    expect(
      group.dataGaps.some((gap) => /of \d+ displayable creatives/i.test(gap.reason)),
    ).toBe(false);
  });

  it("caps returned creatives by returnedCreativeLimit on the UNIQUE set and emits a truthful truncation gap", () => {
    const ads = Array.from({ length: 5 }, (_value, index) => ({
      url: `https://www.facebook.com/ads/library/?id=${index}`,
      id: `meta-uniq-${index}`,
      advertiserName: "Gong",
      title: `Headline ${index}`,
      snippet: `Body copy ${index}`,
      detailsUrl: `https://www.facebook.com/ads/library/?id=${index}`,
    }));

    const groups = buildCompetitorAdEvidenceGroups({
      observedAt: "2026-05-28T00:00:00.000Z",
      returnedCreativeLimit: 3,
      steps: [
        {
          stepNumber: 0,
          finishReason: "tool-calls",
          text: "",
          toolCalls: [
            {
              toolName: "meta_ads",
              input: { advertiser: "Gong", domain: "gong.io", max_results: 5 },
            },
          ],
          toolResults: [
            {
              toolName: "meta_ads",
              output: {
                type: "result",
                advertiser: "Gong",
                platform: "meta",
                ads,
              },
            },
          ],
        },
      ],
    });

    const [group] = groups;
    expect(group.displayableTotal).toBe(5);
    expect(group.returnedCreativeCount).toBe(3);
    expect(group.creatives).toHaveLength(3);
    expect(
      group.dataGaps.some((gap) =>
        /Returned 3 of 5 displayable creatives/i.test(gap.reason),
      ),
    ).toBe(true);
  });
});
