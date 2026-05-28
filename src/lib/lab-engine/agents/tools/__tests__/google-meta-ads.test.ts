import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { googleAdsAgentTool } from "../google-ads";
import { metaAdsAgentTool } from "../meta-ads";

interface AdWrapperInput {
  advertiser: string;
  max_results?: number;
  domain?: string;
}

type AdWrapperExecute = (
  input: AdWrapperInput,
  context: { abortSignal?: AbortSignal },
) => Promise<unknown>;

function getGoogleExecute(): AdWrapperExecute {
  const execute = googleAdsAgentTool.execute;

  if (execute === undefined) {
    throw new Error("Expected Google Ads tool execute function.");
  }

  return execute as unknown as AdWrapperExecute;
}

function getMetaExecute(): AdWrapperExecute {
  const execute = metaAdsAgentTool.execute;

  if (execute === undefined) {
    throw new Error("Expected Meta Ads tool execute function.");
  }

  return execute as unknown as AdWrapperExecute;
}

function searchApiResponse(payload: unknown): Response {
  return Response.json(payload);
}

describe("ad tool wrappers", (): void => {
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

  it("passes domain through google_ads so short-name candidate resolution can disambiguate", async (): Promise<void> => {
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
            ad_id: "atlas-google",
            headline: "CRM built for pipeline teams",
            landing_url: "https://atlascrm.com/demo",
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getGoogleExecute()(
        {
          advertiser: "Atlas",
          domain: "atlascrm.com",
          max_results: 2,
        },
        {},
      ),
    ).resolves.toMatchObject({
      type: "result",
      ads: [{ advertiserName: "AtlasCRM", id: "atlas-google" }],
    });
    expect(requestedAdvertiserIds).toEqual(["right-atlas"]);
  });

  it("passes domain through meta_ads so short-name candidate resolution can disambiguate", async (): Promise<void> => {
    const requestedPageIds: string[] = [];
    const fetchMock = vi.fn(async (requestUrl: string) => {
      const url = new URL(requestUrl);
      const engine = url.searchParams.get("engine");

      if (engine === "meta_ad_library_page_search") {
        return searchApiResponse({
          page_results: [
            { page_id: "wrong-atlas", name: "Atlas VPN" },
            { page_id: "right-atlas", name: "AtlasCRM" },
          ],
        });
      }

      requestedPageIds.push(url.searchParams.get("page_id") ?? "");
      return searchApiResponse({
        ads: [
          {
            page_name: "AtlasCRM",
            ad_archive_id: "atlas-meta",
            snapshot: {
              title: "CRM built for pipeline teams",
              link_url: "https://atlascrm.com/demo",
            },
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getMetaExecute()(
        {
          advertiser: "Atlas",
          domain: "atlascrm.com",
          max_results: 2,
        },
        {},
      ),
    ).resolves.toMatchObject({
      type: "result",
      ads: [{ advertiserName: "AtlasCRM", id: "atlas-meta" }],
    });
    expect(requestedPageIds).toEqual(["right-atlas"]);
  });
});
