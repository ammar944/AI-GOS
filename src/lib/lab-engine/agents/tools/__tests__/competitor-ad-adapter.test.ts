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
});
