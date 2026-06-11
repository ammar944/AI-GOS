import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { adLibraryAgentTool } from "../adlibrary";

interface AdLibraryInput {
  advertiser: string;
  platform?: "meta" | "google" | "linkedin";
  max_results?: number;
  domain?: string;
}

type AdLibraryExecute = (
  input: AdLibraryInput,
  context: { abortSignal?: AbortSignal },
) => Promise<unknown>;

function getExecute(): AdLibraryExecute {
  const execute = adLibraryAgentTool.execute;

  if (execute === undefined) {
    throw new Error("Expected Ad Library tool execute function.");
  }

  return execute as unknown as AdLibraryExecute;
}

function searchApiResponse(payload: unknown): Response {
  return Response.json(payload);
}

describe("adLibraryAgentTool relevance filtering", (): void => {
  const originalApiKey = process.env.SEARCHAPI_KEY;
  const originalForeplayApiKey = process.env.FOREPLAY_API_KEY;

  beforeEach((): void => {
    process.env.SEARCHAPI_KEY = "test-searchapi-key";
    delete process.env.FOREPLAY_API_KEY;
  });

  afterEach((): void => {
    if (originalApiKey === undefined) {
      delete process.env.SEARCHAPI_KEY;
    } else {
      process.env.SEARCHAPI_KEY = originalApiKey;
    }
    if (originalForeplayApiKey === undefined) {
      delete process.env.FOREPLAY_API_KEY;
    } else {
      process.env.FOREPLAY_API_KEY = originalForeplayApiKey;
    }

    vi.unstubAllGlobals();
  });

  it("returns a typed gap when lookup candidates do not confidently match", async (): Promise<void> => {
    const fetchMock = vi.fn(async () =>
      searchApiResponse({
        advertisers: [{ id: "wrong", name: "Northwind Traders" }],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getExecute()(
        {
          advertiser: "Directive",
          platform: "google",
          domain: "directiveconsulting.com",
          max_results: 3,
        },
        {},
      ),
    ).resolves.toMatchObject({
      type: "gap",
      reason: "not_implemented",
      message: expect.stringContaining('No google advertiser matched "Directive"'),
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns ads for a correct-company candidate", async (): Promise<void> => {
    const fetchMock = vi.fn(async (requestUrl: string) => {
      const url = new URL(requestUrl);
      const engine = url.searchParams.get("engine");

      if (engine === "google_ads_transparency_center_advertiser_search") {
        return searchApiResponse({
          advertisers: [{ id: "gong-id", name: "Gong" }],
        });
      }

      return searchApiResponse({
        ad_creatives: [
          {
            advertiser_id: "gong-id",
            advertiser_name: "Gong",
            ad_id: "ad-1",
            headline: "Improve forecast accuracy",
            details_url: "https://adstransparency.google.com/advertiser/gong-id",
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getExecute()(
        {
          advertiser: "Gong",
          platform: "google",
          domain: "gong.io",
          max_results: 3,
        },
        {},
      ),
    ).resolves.toMatchObject({
      type: "result",
      advertiser: "Gong",
      platform: "google",
      ads: [
        {
          advertiserName: "Gong",
          id: "ad-1",
          title: "Improve forecast accuracy",
        },
      ],
    });
  });

  it("filters creatives whose advertiser name fails the final relevance guard", async (): Promise<void> => {
    const fetchMock = vi.fn(async (requestUrl: string) => {
      const url = new URL(requestUrl);
      const engine = url.searchParams.get("engine");

      if (engine === "google_ads_transparency_center_advertiser_search") {
        return searchApiResponse({
          advertisers: [{ id: "fathom-id", name: "Fathom" }],
        });
      }

      return searchApiResponse({
        ad_creatives: [
          {
            advertiser_id: "fathom-id",
            advertiser_name: "Fathom",
            ad_id: "good",
            headline: "AI meeting notes",
            details_url: "https://adstransparency.google.com/advertiser/fathom-id",
          },
          {
            advertiser_id: "wrong",
            advertiser_name: "Fathom Digital Manufacturing",
            ad_id: "wrong-company",
            headline: "Terrain manufacturing workflows",
            landing_url: "https://fathomdem.com/product",
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getExecute()(
        {
          advertiser: "Fathom",
          platform: "google",
          domain: "fathom.video",
          max_results: 5,
        },
        {},
      ),
    ).resolves.toMatchObject({
      type: "result",
      ads: [
        {
          advertiserName: "Fathom",
          id: "good",
        },
      ],
    });
  });

  it("uses verified domain corroboration to select the right short-name candidate", async (): Promise<void> => {
    const requestedAdvertiserIds: string[] = [];
    const fetchMock = vi.fn(async (requestUrl: string) => {
      const url = new URL(requestUrl);
      const engine = url.searchParams.get("engine");

      if (engine === "google_ads_transparency_center_advertiser_search") {
        return searchApiResponse({
          advertisers: [
            { id: "wrong-atlas", name: "Atlas VPN" },
            { id: "right-atlas", name: "AtlasCRM" },
          ],
        });
      }

      requestedAdvertiserIds.push(url.searchParams.get("advertiser_id") ?? "");
      return searchApiResponse({
        ad_creatives: [
          {
            advertiser_id: "right-atlas",
            advertiser_name: "AtlasCRM",
            ad_id: "atlas-ad",
            headline: "CRM built for pipeline teams",
            landing_url: "https://atlascrm.com/demo",
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getExecute()(
        {
          advertiser: "Atlas",
          platform: "google",
          domain: "atlascrm.com",
          max_results: 2,
        },
        {},
      ),
    ).resolves.toMatchObject({
      type: "result",
      ads: [{ advertiserName: "AtlasCRM", id: "atlas-ad" }],
    });
    expect(requestedAdvertiserIds).toEqual(["right-atlas"]);
  });
});

describe("adLibraryAgentTool LinkedIn channel", (): void => {
  const originalApiKey = process.env.SEARCHAPI_KEY;
  const originalForeplayApiKey = process.env.FOREPLAY_API_KEY;

  beforeEach((): void => {
    process.env.SEARCHAPI_KEY = "test-searchapi-key";
    delete process.env.FOREPLAY_API_KEY;
  });

  afterEach((): void => {
    if (originalApiKey === undefined) {
      delete process.env.SEARCHAPI_KEY;
    } else {
      process.env.SEARCHAPI_KEY = originalApiKey;
    }
    if (originalForeplayApiKey === undefined) {
      delete process.env.FOREPLAY_API_KEY;
    } else {
      process.env.FOREPLAY_API_KEY = originalForeplayApiKey;
    }

    vi.unstubAllGlobals();
  });

  // A live probe confirmed linkedin_ad_library?advertiser=Notion returns HTTP 200
  // with 24 ads, each carrying nested content + advertiser + a first-party link.
  function buildLinkedInAds(count: number): unknown[] {
    return Array.from({ length: count }, (_unused, index) => ({
      content: {
        headline: `Notion ad ${index + 1}`,
        body: "Organize your work in one connected workspace.",
        image: `https://media.licdn.com/notion-creative-${index + 1}.png`,
      },
      advertiser: { name: "Notion" },
      // Clickthrough resolves to the verified domain, so the link guard keeps it.
      link: "https://notion.so/product",
      ad_type: "SPONSORED_UPDATE",
      position: index + 1,
    }));
  }

  it("returns LinkedIn ads for a 200 / 24-ads response (engine + advertiser param)", async (): Promise<void> => {
    const requestedEngines: string[] = [];
    const fetchMock = vi.fn(async (requestUrl: string) => {
      const url = new URL(requestUrl);
      requestedEngines.push(url.searchParams.get("engine") ?? "");
      return searchApiResponse({ ads: buildLinkedInAds(24) });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = (await getExecute()(
      {
        advertiser: "Notion",
        platform: "linkedin",
        domain: "notion.so",
        max_results: 8,
      },
      {},
    )) as { type: string; platform?: string; ads?: unknown[] };

    expect(result.type).toBe("result");
    expect(result.platform).toBe("linkedin");
    // max_results caps the normalized rows; the 24-ad payload is bounded to 8.
    expect(result.ads).toHaveLength(8);
    // Single engine hit: linkedin takes the advertiser param directly with no
    // advertiser-search pre-step (unlike google/meta).
    expect(requestedEngines).toEqual(["linkedin_ad_library"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns a missing_credential gap when SEARCHAPI_KEY is absent", async (): Promise<void> => {
    delete process.env.SEARCHAPI_KEY;
    const fetchMock = vi.fn(async () => searchApiResponse({ ads: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getExecute()(
        { advertiser: "Notion", platform: "linkedin", max_results: 8 },
        {},
      ),
    ).resolves.toMatchObject({
      type: "gap",
      reason: "missing_credential",
      envVar: "SEARCHAPI_KEY",
    });
    // No-key path short-circuits before any network call.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns an api_error gap when the LinkedIn engine fails", async (): Promise<void> => {
    const fetchMock = vi.fn(async () => new Response("rate limited", { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getExecute()(
        { advertiser: "Notion", platform: "linkedin", max_results: 8 },
        {},
      ),
    ).resolves.toMatchObject({
      type: "gap",
      reason: "api_error",
    });
  });

  it("drops wrong-company LinkedIn ads via the short-name link guard (no fabricated match)", async (): Promise<void> => {
    // Short name (<=6 chars) + verified domain: a LinkedIn page slug that does
    // not corroborate the domain base must be dropped, yielding an empty (but
    // structured) result rather than a wrong-company creative.
    const fetchMock = vi.fn(async () =>
      searchApiResponse({
        ads: [
          {
            content: { headline: "Fathom Flood Risk", body: "Terrain data" },
            advertiser: { name: "Fathom" },
            link: "https://www.linkedin.com/company/fathom-global/",
            ad_type: "SPONSORED_UPDATE",
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = (await getExecute()(
      {
        advertiser: "Fathom",
        platform: "linkedin",
        domain: "fathom.video",
        max_results: 5,
      },
      {},
    )) as { type: string; ads?: unknown[] };

    expect(result.type).toBe("result");
    expect(result.ads).toEqual([]);
  });
});

describe("adLibraryAgentTool Foreplay provider", (): void => {
  const originalSearchApiKey = process.env.SEARCHAPI_KEY;
  const originalForeplayApiKey = process.env.FOREPLAY_API_KEY;

  beforeEach((): void => {
    process.env.SEARCHAPI_KEY = "test-searchapi-key";
    process.env.FOREPLAY_API_KEY = "test-foreplay-key";
  });

  afterEach((): void => {
    if (originalSearchApiKey === undefined) {
      delete process.env.SEARCHAPI_KEY;
    } else {
      process.env.SEARCHAPI_KEY = originalSearchApiKey;
    }
    if (originalForeplayApiKey === undefined) {
      delete process.env.FOREPLAY_API_KEY;
    } else {
      process.env.FOREPLAY_API_KEY = originalForeplayApiKey;
    }

    vi.unstubAllGlobals();
  });

  it("adds domain-resolved Foreplay ads and verified Meta page ads to the Meta wall", async (): Promise<void> => {
    const requestedMetaPageIds: string[] = [];
    const fetchMock = vi.fn(async (requestUrl: string) => {
      const url = new URL(requestUrl);

      if (url.hostname === "public.api.foreplay.co") {
        if (url.pathname.endsWith("/getBrandsByDomain")) {
          return searchApiResponse({
            data: [
              {
                id: "foreplay-brand",
                name: "Gong",
                domain: "gong.io",
                ad_library_id: "645975252242804",
              },
            ],
          });
        }

        return searchApiResponse({
          data: [
            {
              id: "foreplay-ad",
              ad_library_id: "555",
              brand_name: "Gong",
              headline: "Pipeline visibility that closes gaps",
              primary_text: "See every deal risk before forecast day.",
              landing_page_url: "https://gong.io/platform",
              video: "https://r2.foreplay.co/creatives/gong.mp4",
              thumbnail: "https://r2.foreplay.co/thumbs/gong.jpg",
              full_transcription: "Forecast every deal with Gong.",
              platform: "facebook",
              display_format: "video",
              is_active: true,
            },
          ],
        });
      }

      const engine = url.searchParams.get("engine");

      if (engine === "meta_ad_library_page_search") {
        return searchApiResponse({
          page_results: [{ id: "searchapi-page", name: "Gong", page_alias: "gong.io" }],
        });
      }

      requestedMetaPageIds.push(url.searchParams.get("page_id") ?? "");

      if (url.searchParams.get("page_id") === "645975252242804") {
        return searchApiResponse({
          ads: [
            {
              ad_archive_id: "556",
              page_name: "Gong",
              snapshot: {
                title: "Automate forecast inspection",
                body: { text: "Know which deals changed this week." },
                link_url: "https://gong.io/revenue-intelligence",
              },
            },
          ],
        });
      }

      return searchApiResponse({
        ads: [
          {
            ad_archive_id: "native-1",
            page_name: "Gong",
            snapshot: {
              title: "Improve forecast accuracy",
              body: { text: "Understand pipeline health." },
              link_url: "https://gong.io/forecast",
            },
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = (await getExecute()(
      {
        advertiser: "Gong",
        platform: "meta",
        domain: "gong.io",
        max_results: 6,
      },
      {},
    )) as { type: string; ads?: Array<{ id?: string; source?: string; transcript?: string }> };

    expect(result.type).toBe("result");
    expect(result.ads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "native-1" }),
        expect.objectContaining({ id: "556", identityVerified: true }),
        expect.objectContaining({
          id: "555",
          source: "foreplay",
          transcript: "Forecast every deal with Gong.",
        }),
      ]),
    );
    expect(requestedMetaPageIds).toContain("645975252242804");
  });

  it("keeps native SearchAPI ads when Foreplay credentials are dead", async (): Promise<void> => {
    const fetchMock = vi.fn(async (requestUrl: string) => {
      const url = new URL(requestUrl);

      if (url.hostname === "public.api.foreplay.co") {
        return new Response("unauthorized", { status: 401 });
      }

      const engine = url.searchParams.get("engine");

      if (engine === "meta_ad_library_page_search") {
        return searchApiResponse({
          page_results: [{ id: "notion-page", name: "Notion", page_alias: "notion.so" }],
        });
      }

      return searchApiResponse({
        ads: [
          {
            ad_archive_id: "notion-native",
            page_name: "Notion",
            snapshot: {
              title: "One workspace for every team",
              body: { text: "Plan and write in Notion." },
              link_url: "https://notion.so/product",
            },
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getExecute()(
        {
          advertiser: "Notion",
          platform: "meta",
          domain: "notion.so",
          max_results: 4,
        },
        {},
      ),
    ).resolves.toMatchObject({
      type: "result",
      ads: [expect.objectContaining({ id: "notion-native" })],
    });
  });

  it("keeps native SearchAPI ads and does not retry when Foreplay excludes the domain", async (): Promise<void> => {
    const fetchMock = vi.fn(async (requestUrl: string) => {
      const url = new URL(requestUrl);

      if (url.hostname === "public.api.foreplay.co") {
        return new Response(
          "Domain is excluded - monday.com is in the excluded list",
          { status: 400 },
        );
      }

      const engine = url.searchParams.get("engine");

      if (engine === "meta_ad_library_page_search") {
        return searchApiResponse({
          page_results: [{ id: "monday-page", name: "monday.com", page_alias: "monday.com" }],
        });
      }

      return searchApiResponse({
        ads: [
          {
            ad_archive_id: "monday-native",
            page_name: "monday.com",
            snapshot: {
              title: "Work management for every team",
              body: { text: "Plan and track work with monday.com." },
              link_url: "https://monday.com/product",
            },
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getExecute()(
        {
          advertiser: "monday.com",
          platform: "meta",
          domain: "monday.com",
          max_results: 4,
        },
        {},
      ),
    ).resolves.toMatchObject({
      type: "result",
      ads: [expect.objectContaining({ id: "monday-native" })],
    });
    expect(
      fetchMock.mock.calls.filter(([requestUrl]) => {
        const url = new URL(requestUrl as string);
        return url.hostname === "public.api.foreplay.co";
      }),
    ).toHaveLength(1);
  });
});
