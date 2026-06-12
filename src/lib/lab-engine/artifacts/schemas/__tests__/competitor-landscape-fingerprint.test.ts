import { describe, expect, it } from "vitest";

import {
  adCreativeFingerprint,
  normalizeCompetitorLandscapeBody,
} from "../competitor-landscape";

describe("adCreativeFingerprint", (): void => {
  it("collapses creatives sharing a bare numeric id (tier 1)", (): void => {
    const a = adCreativeFingerprint({
      platform: "meta",
      id: "123456789",
      headline: "Win more deals",
      body: "Forecast accuracy",
    });
    const b = adCreativeFingerprint({
      platform: "facebook",
      id: "123456789",
      headline: "Totally different copy",
      body: "Different body too",
    });

    expect(a).toBe("id:123456789");
    expect(a).toBe(b);
  });

  it("does NOT treat synthetic ids as a shared canonical id", (): void => {
    const adapterMinted = adCreativeFingerprint({
      platform: "meta",
      id: "ad_meta_gong_0",
      headline: "Win more deals",
      body: "Forecast accuracy",
    });
    const sourceMinted = adCreativeFingerprint({
      platform: "meta",
      id: "meta-0",
      headline: "Win more deals",
      body: "Forecast accuracy",
    });

    expect(adapterMinted.startsWith("id:")).toBe(false);
    expect(sourceMinted.startsWith("id:")).toBe(false);
    // Same content + canonical platform -> they still match on the tier-2 key.
    expect(adapterMinted).toBe("c2:meta:win more deals:forecast accuracy");
    expect(adapterMinted).toBe(sourceMinted);
  });

  it("uses a media-only key when headline and body are empty", (): void => {
    const fp = adCreativeFingerprint({
      platform: "instagram",
      id: "ad_meta_gong_2",
      headline: "",
      body: null,
      videoUrl: "https://cdn.example.com/v.mp4",
      imageUrl: "https://cdn.example.com/i.jpg",
    });

    // Video wins over image; platform canonicalizes instagram -> meta.
    expect(fp).toBe("media:meta:https://cdn.example.com/v.mp4");
  });

  it("falls back to image url for the media-only key when no video", (): void => {
    const fp = adCreativeFingerprint({
      platform: "google",
      headline: null,
      body: "",
      imageUrl: "https://cdn.example.com/i.jpg",
    });

    expect(fp).toBe("media:google:https://cdn.example.com/i.jpg");
  });

  it("builds a tier-2 content key from canonical platform + headline + body", (): void => {
    const fp = adCreativeFingerprint({
      platform: "Meta",
      id: "ad_meta_gong_0",
      headline: "  Improve Forecast Accuracy  ",
      body: "See how teams win",
    });

    expect(fp).toBe("c2:meta:improve forecast accuracy:see how teams win");
  });
});

describe("normalizeCompetitorLandscapeBody", (): void => {
  it("labels third-party pricing rows with the reporting domain", (): void => {
    const normalized = normalizeCompetitorLandscapeBody({
      competitorSet: {
        competitors: [
          {
            name: "Airtable",
            url: "https://www.airtable.com",
          },
          {
            name: "ClickUp",
            url: "https://clickup.com",
          },
        ],
      },
      pricingReality: {
        dataPoints: [
          {
            competitor: "Airtable",
            monthlyPrice: "$20/user/mo",
            sourceUrl: "https://www.zapier.com/blog/airtable-alternatives/",
          },
          {
            competitor: "ClickUp",
            monthlyPrice: "$10/user/mo",
            sourceUrl: "https://clickup.com/pricing",
          },
        ],
      },
    });

    const pricingReality = normalized.pricingReality as {
      dataPoints: Array<{ monthlyPrice: string }>;
    };

    expect(pricingReality.dataPoints[0]?.monthlyPrice).toBe(
      "$20/user/mo - per zapier.com",
    );
    expect(pricingReality.dataPoints[1]?.monthlyPrice).toBe("$10/user/mo");
  });

  it("does not append a duplicate reporter label", (): void => {
    const normalized = normalizeCompetitorLandscapeBody({
      competitorSet: {
        competitors: [{ name: "Airtable", url: "https://airtable.com" }],
      },
      pricingReality: {
        dataPoints: [
          {
            competitor: "Airtable",
            monthlyPrice: "$20/user/mo - per zite.com",
            sourceUrl: "https://zite.com/blog/airtable-alternatives",
          },
        ],
      },
    });

    const pricingReality = normalized.pricingReality as {
      dataPoints: Array<{ monthlyPrice: string }>;
    };

    expect(pricingReality.dataPoints[0]?.monthlyPrice).toBe(
      "$20/user/mo - per zite.com",
    );
  });
});
