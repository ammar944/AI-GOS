import { describe, expect, it } from "vitest";

import { NOT_PROBED_THIS_RUN_PHRASE } from "../../../sections/sentinels";
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
    expect(linkedinGaps[0]?.reason).toContain(NOT_PROBED_THIS_RUN_PHRASE);
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

describe("competitor ad verification tiering", (): void => {
  const baseStep = (ads: unknown[]) => ({
    stepNumber: 0,
    finishReason: "tool-calls" as const,
    text: "",
    toolCalls: [
      {
        toolName: "meta_ads",
        input: { advertiser: "Gong", domain: "gong.io", max_results: 8 },
      },
    ],
    toolResults: [
      {
        toolName: "meta_ads",
        output: { type: "result", advertiser: "Gong", platform: "meta", ads },
      },
    ],
  });

  it("marks an identity-verified, English, name-matching creative as verified", () => {
    const [group] = buildCompetitorAdEvidenceGroups({
      observedAt: "2026-06-03T00:00:00.000Z",
      steps: [
        baseStep([
          {
            url: "https://www.facebook.com/ads/library/?id=1",
            id: "1",
            advertiserName: "Gong",
            title: "Win more deals with revenue intelligence",
            snippet: "See every customer conversation in one place.",
            identityVerified: true,
            identityBasis: "domain",
          },
        ]),
      ],
    });
    expect(group.creatives[0]?.verified).toBe(true);
    expect(group.creatives[0]?.isEnglish).toBe(true);
    expect(group.creatives[0]?.identityBasis).toBe("domain");
    expect(group.identityConfidence).toBe("verified");
    expect(group.quarantinedCount).toBe(0);
    expect(group.verifiedCount).toBe(1);
  });

  it("quarantines an ambiguous (identityVerified=false) creative", () => {
    const [group] = buildCompetitorAdEvidenceGroups({
      observedAt: "2026-06-03T00:00:00.000Z",
      steps: [
        baseStep([
          {
            url: "https://www.facebook.com/ads/library/?id=2",
            id: "2",
            advertiserName: "Gong",
            title: "Win more deals with revenue intelligence",
            identityVerified: false,
            identityBasis: "ambiguous",
          },
        ]),
      ],
    });
    expect(group.creatives[0]?.verified).toBe(false);
    expect(group.identityConfidence).toBe("low");
    expect(group.quarantinedCount).toBe(1);
    expect(group.verifiedCount).toBe(0);
  });

  it("quarantines a name-only creative and preserves the identity basis", () => {
    const [group] = buildCompetitorAdEvidenceGroups({
      observedAt: "2026-06-03T00:00:00.000Z",
      steps: [
        baseStep([
          {
            url: "https://adstransparency.google.com/advertiser/notion-limited",
            id: "notion-limited",
            advertiserName: "Notion Limited",
            title: "Get the book on management training",
            identityVerified: false,
            identityBasis: "name_only",
          },
        ]),
      ],
    });

    expect(group.creatives[0]?.verified).toBe(false);
    expect(group.creatives[0]?.identityBasis).toBe("name_only");
    expect(group.identityConfidence).toBe("low");
    expect(group.quarantinedCount).toBe(1);
  });

  it("drops off-topic name-only Airbase music creative from returned creatives", () => {
    const args = {
      observedAt: "2026-06-03T00:00:00.000Z",
      topicContext:
        "Spend management software for finance teams, expense approvals, procurement workflows, corporate cards, invoices, budgets, and vendor payments.",
      steps: [
        {
          stepNumber: 0,
          finishReason: "tool-calls" as const,
          text: "",
          toolCalls: [
            {
              toolName: "meta_ads",
              input: {
                advertiser: "Airbase",
                domain: "airbase.com",
                max_results: 8,
              },
            },
          ],
          toolResults: [
            {
              toolName: "meta_ads",
              output: {
                type: "result" as const,
                advertiser: "Airbase",
                platform: "meta" as const,
                ads: [
                  {
                    url: "https://www.facebook.com/ads/library/?id=airbase-trance",
                    id: "airbase-trance",
                    advertiserName: "Airbase",
                    title: "Airbase - Everything Else Could Wait",
                    snippet:
                      "NEW TRACK ALERT! Airbase - Everything Else Could Wait. Progressive trance at its finest!",
                    identityVerified: false,
                    identityBasis: "name_only",
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const [group] = buildCompetitorAdEvidenceGroups(args);

    expect(group.creatives).toHaveLength(0);
    expect(group.returnedCreativeCount).toBe(0);
    expect(group.quarantinedCount).toBe(0);
  });

  it("keeps on-topic name-only spend-management creative quarantined", () => {
    const args = {
      observedAt: "2026-06-03T00:00:00.000Z",
      topicContext:
        "Spend management software for finance teams, expense approvals, procurement workflows, corporate cards, invoices, budgets, and vendor payments.",
      steps: [
        {
          stepNumber: 0,
          finishReason: "tool-calls" as const,
          text: "",
          toolCalls: [
            {
              toolName: "meta_ads",
              input: {
                advertiser: "Airbase",
                domain: "airbase.com",
                max_results: 8,
              },
            },
          ],
          toolResults: [
            {
              toolName: "meta_ads",
              output: {
                type: "result" as const,
                advertiser: "Airbase",
                platform: "meta" as const,
                ads: [
                  {
                    url: "https://www.facebook.com/ads/library/?id=airbase-expense",
                    id: "airbase-expense",
                    advertiserName: "Airbase",
                    title: "Control every business expense before employees spend",
                    snippet:
                      "Corporate card controls, procurement approvals, and invoice workflows for finance teams.",
                    identityVerified: false,
                    identityBasis: "name_only",
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const [group] = buildCompetitorAdEvidenceGroups(args);

    expect(group.creatives).toHaveLength(1);
    expect(group.creatives[0]?.verified).toBe(false);
    expect(group.creatives[0]?.identityBasis).toBe("name_only");
    expect(group.quarantinedCount).toBe(1);
  });

  it("quarantines a non-English creative even when identity is verified", () => {
    const [group] = buildCompetitorAdEvidenceGroups({
      observedAt: "2026-06-03T00:00:00.000Z",
      steps: [
        baseStep([
          {
            url: "https://www.facebook.com/ads/library/?id=3",
            id: "3",
            advertiserName: "Gong",
            title: "Cierra más tratos con la mejor plataforma para tu negocio",
            snippet: "Compra ahora y obtén un descuento gratis para tu empresa.",
            identityVerified: true,
            identityBasis: "domain",
          },
        ]),
      ],
    });
    expect(group.creatives[0]?.isEnglish).toBe(false);
    expect(group.creatives[0]?.verified).toBe(false);
  });

  it("quarantines a creative whose own advertiserName is a different company", () => {
    const [group] = buildCompetitorAdEvidenceGroups({
      observedAt: "2026-06-03T00:00:00.000Z",
      steps: [
        baseStep([
          {
            url: "https://www.facebook.com/ads/library/?id=4",
            id: "4",
            advertiserName: "Some Other Company LLC",
            title: "Win more deals with revenue intelligence",
            identityVerified: true,
            identityBasis: "domain",
          },
        ]),
      ],
    });
    expect(group.creatives[0]?.verified).toBe(false);
  });

  it("ranks a verified creative above an unverified richer one in the cap", () => {
    const [group] = buildCompetitorAdEvidenceGroups({
      observedAt: "2026-06-03T00:00:00.000Z",
      returnedCreativeLimit: 2,
      steps: [
        baseStep([
          {
            url: "https://www.facebook.com/ads/library/?id=rich",
            id: "rich",
            advertiserName: "Gong",
            title: "Rich unverified ad",
            snippet: "Body copy here",
            videoUrl: "https://cdn.example.com/rich.mp4",
            transcript: "A long spoken transcript that boosts richness score.",
            identityVerified: false,
          },
          {
            url: "https://www.facebook.com/ads/library/?id=thin",
            id: "thin",
            advertiserName: "Gong",
            title: "Thin verified ad",
            identityVerified: true,
          },
        ]),
      ],
    });
    // The verified (thin) creative must rank first despite lower media richness.
    expect(group.creatives[0]?.verified).toBe(true);
    expect(group.creatives[0]?.id).toBe("thin");
  });

  it("ranks a more recent verified creative above an older verified one", () => {
    const [group] = buildCompetitorAdEvidenceGroups({
      observedAt: "2026-06-03T00:00:00.000Z",
      returnedCreativeLimit: 2,
      steps: [
        baseStep([
          {
            url: "https://www.facebook.com/ads/library/?id=old",
            id: "old",
            advertiserName: "Gong",
            title: "Older but verified ad",
            lastSeen: "2024-01-01",
            identityVerified: true,
          },
          {
            url: "https://www.facebook.com/ads/library/?id=fresh",
            id: "fresh",
            advertiserName: "Gong",
            title: "Recent verified ad",
            lastSeen: "2026-06-01",
            identityVerified: true,
          },
        ]),
      ],
    });
    expect(group.creatives[0]?.id).toBe("fresh");
  });

  it("keeps a quarantined sample even when verified creatives fill the cap", () => {
    const verifiedAds = Array.from({ length: 6 }, (_value, index) => ({
      url: `https://www.facebook.com/ads/library/?id=v${index}`,
      id: `v${index}`,
      advertiserName: "Gong",
      title: `Verified revenue intelligence ad number ${index}`,
      identityVerified: true,
      identityBasis: "domain",
    }));
    const quarantinedAds = Array.from({ length: 2 }, (_value, index) => ({
      url: `https://www.facebook.com/ads/library/?id=q${index}`,
      id: `q${index}`,
      advertiserName: "Gong",
      title: `Ambiguous ad number ${index}`,
      identityVerified: false,
      identityBasis: "ambiguous",
    }));
    const [group] = buildCompetitorAdEvidenceGroups({
      observedAt: "2026-06-03T00:00:00.000Z",
      returnedCreativeLimit: 6,
      steps: [baseStep([...verifiedAds, ...quarantinedAds])],
    });
    // The full verified cap must NOT slice the quarantined creatives away: the
    // count is honest and a sample is present for the drawer.
    expect(group.quarantinedCount).toBe(2);
    expect(group.creatives.filter((c) => c.verified === false)).toHaveLength(2);
    expect(group.creatives.filter((c) => c.verified === true)).toHaveLength(6);
  });

  it("quarantines a Croatian creative even when identity is verified (live E2E regression)", () => {
    // Exact failure class from the 2026-06-03 live run: a same-name 'Gong' page
    // resolved to a Croatian civic org and its Croatian creatives reached the wall
    // tagged verified/isEnglish:true. With franc the copy is now detected non-English
    // and the creative is quarantined.
    const [group] = buildCompetitorAdEvidenceGroups({
      observedAt: "2026-06-03T00:00:00.000Z",
      steps: [
        baseStep([
          {
            url: "https://www.facebook.com/ads/library/?id=hr",
            id: "hr",
            advertiserName: "Gong",
            title:
              "Izađimo da nas čuju: Evo zašto je važno glasati na parlamentarnim izborima!",
            snippet:
              "Hrvatska kao najmlađa članica Europske unije. Saznajte više o vladavini prava u Hrvatskoj.",
            identityVerified: true,
            identityBasis: "domain",
          },
        ]),
      ],
    });
    expect(group.creatives[0]?.isEnglish).toBe(false);
    expect(group.creatives[0]?.verified).toBe(false);
    expect(group.identityConfidence).toBe("low");
  });
});
