import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { adLibraryAgentTool } from "../adlibrary";

interface AdLibraryInput {
  advertiser: string;
  platform?: "meta" | "google";
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

  beforeEach((): void => {
    process.env.SEARCHAPI_KEY = "test-searchapi-key";
  });

  afterEach((): void => {
    if (originalApiKey === undefined) {
      delete process.env.SEARCHAPI_KEY;
    } else {
      process.env.SEARCHAPI_KEY = originalApiKey;
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
