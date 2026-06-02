import { describe, expect, it } from "vitest";

import type { ForeplayAdDetails } from "@/lib/foreplay/types";

import { normalizeForeplayAd } from "../foreplay-normalize";

function buildForeplayAd(
  overrides: Partial<ForeplayAdDetails> = {},
): ForeplayAdDetails {
  return {
    ad_id: "fp_ad_1",
    ad_library_id: "1234567890",
    brand: { id: "brand_1", name: "Acme Co", domain: "acme.com" },
    creative: {
      type: "video",
      url: "https://r2.foreplay.co/creatives/abc.mp4",
      thumbnail_url: "https://r2.foreplay.co/thumbs/abc.jpg",
      video_transcript: "Hook line then the pitch.",
      duration_seconds: 30,
    },
    copy: {
      headline: "Stop wasting spend",
      body: "Acme finds your winning creative.",
      cta: "Learn more",
      sponsor_name: "Acme Co Sponsor",
    },
    metadata: {
      platform: "facebook",
      first_seen: "2026-01-01",
      last_seen: "2026-02-01",
      is_active: true,
      landing_page: { url: "https://acme.com/lp" },
    },
    ...overrides,
  };
}

describe("normalizeForeplayAd", () => {
  it("maps a facebook video ad to a meta ad row with the shared numeric id", () => {
    const result = normalizeForeplayAd(buildForeplayAd());

    expect(result.platform).toBe("meta");
    // ad_library_id (the numeric Meta ad_archive_id join key) wins over ad_id.
    expect(result.id).toBe("1234567890");
    expect(result.advertiserName).toBe("Acme Co");
    expect(result.title).toBe("Stop wasting spend");
    expect(result.snippet).toBe("Acme finds your winning creative.");
    expect(result.imageUrl).toBe("https://r2.foreplay.co/thumbs/abc.jpg");
    expect(result.videoUrl).toBe("https://r2.foreplay.co/creatives/abc.mp4");
    // sourceUrl downstream = detailsUrl ?? url. Both resolve to the landing page.
    expect(result.detailsUrl).toBe("https://acme.com/lp");
    expect(result.landingUrl).toBe("https://acme.com/lp");
    expect(result.url).toBe("https://acme.com/lp");
    expect(result.source).toBe("foreplay");
    expect(result.transcript).toBe("Hook line then the pitch.");
    expect(result.cta).toBe("Learn more");
    expect(result.format).toBe("video");
    expect(result.isActive).toBe(true);
    expect(result.firstSeen).toBe("2026-01-01");
    expect(result.lastSeen).toBe("2026-02-01");
  });

  it("maps a linkedin ad to the linkedin platform bucket", () => {
    const result = normalizeForeplayAd(
      buildForeplayAd({
        metadata: {
          platform: "linkedin",
          first_seen: "2026-01-01",
          last_seen: "2026-02-01",
          is_active: false,
          landing_page: { url: "https://acme.com/li" },
        },
      }),
    );

    expect(result.platform).toBe("linkedin");
    expect(result.isActive).toBe(false);
    expect(result.detailsUrl).toBe("https://acme.com/li");
  });

  it("maps instagram and tiktok onto meta", () => {
    for (const platform of ["instagram", "tiktok"] as const) {
      const result = normalizeForeplayAd(
        buildForeplayAd({
          metadata: {
            platform,
            first_seen: "2026-01-01",
            last_seen: "2026-02-01",
            is_active: true,
            landing_page: { url: "https://acme.com/x" },
          },
        }),
      );

      expect(result.platform).toBe("meta");
    }
  });

  it("falls back to the r2 creative url for sourceUrl when no landing page is present", () => {
    const result = normalizeForeplayAd(
      buildForeplayAd({
        creative: {
          type: "image",
          url: "https://r2.foreplay.co/creatives/static.jpg",
          thumbnail_url: "https://r2.foreplay.co/thumbs/static.jpg",
        },
        metadata: {
          platform: "facebook",
          first_seen: "2026-01-01",
          last_seen: "2026-02-01",
          is_active: true,
        },
      }),
    );

    expect(result.url).toBe("https://r2.foreplay.co/creatives/static.jpg");
    expect(result.landingUrl).toBeUndefined();
    expect(result.detailsUrl).toBeUndefined();
    // Image ad: no videoUrl emitted even though creative.url is present.
    expect(result.videoUrl).toBeUndefined();
    expect(result.format).toBe("image");
  });

  it("drops url-shaped fields that are not valid absolute URLs", () => {
    const result = normalizeForeplayAd(
      buildForeplayAd({
        creative: {
          type: "image",
          url: "not-a-url",
          thumbnail_url: "also-not-a-url",
        },
        metadata: {
          platform: "facebook",
          first_seen: "2026-01-01",
          last_seen: "2026-02-01",
          is_active: true,
          landing_page: { url: "still-not-a-url" },
        },
      }),
    );

    expect(result.imageUrl).toBeUndefined();
    expect(result.landingUrl).toBeUndefined();
    expect(result.detailsUrl).toBeUndefined();
    // url is required downstream, so an unparseable everything falls back to a
    // valid absolute URL rather than producing an invalid sourceUrl.
    expect(() => new URL(result.url)).not.toThrow();
  });

  it("prefers ad_id and sponsor_name when richer fields are missing", () => {
    const result = normalizeForeplayAd(
      buildForeplayAd({
        ad_library_id: undefined,
        brand: { id: "brand_1", name: "", domain: "acme.com" },
        copy: { sponsor_name: "Sponsored by Acme" },
      }),
    );

    expect(result.id).toBe("fp_ad_1");
    expect(result.advertiserName).toBe("Sponsored by Acme");
    expect(result.title).toBeUndefined();
    expect(result.snippet).toBeUndefined();
  });
});
