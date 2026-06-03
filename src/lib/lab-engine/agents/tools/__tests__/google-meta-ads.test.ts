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

  it("meta_ads picks the page whose page_alias matches the verified domain, not the same-name decoy", async (): Promise<void> => {
    const requestedPageIds: string[] = [];
    const fetchMock = vi.fn(async (requestUrl: string) => {
      const url = new URL(requestUrl);
      const engine = url.searchParams.get("engine");

      if (engine === "meta_ad_library_page_search") {
        // Same-name collision: a Croatian NGO ("gong.hr") and the real SaaS
        // page ("gong.io") both surface as "Gong". Only the page_alias
        // distinguishes them.
        return searchApiResponse({
          page_results: [
            { page_id: "gong-hr", name: "Gong", page_alias: "gong.hr" },
            { page_id: "gong-io", name: "Gong", page_alias: "gong.io" },
          ],
        });
      }

      requestedPageIds.push(url.searchParams.get("page_id") ?? "");
      return searchApiResponse({
        ads: [
          {
            page_name: "Gong",
            ad_archive_id: "gong-meta",
            snapshot: { title: "Gong is a better way to revenue" },
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getMetaExecute()(
        { advertiser: "Gong", domain: "gong.io", max_results: 2 },
        {},
      ),
    ).resolves.toMatchObject({
      type: "result",
      ads: [{ advertiserName: "Gong", id: "gong-meta", identityVerified: true }],
    });
    expect(requestedPageIds).toEqual(["gong-io"]);
  });

  it("meta_ads does not mark a domain-contradicting same-name page as identity-verified", async (): Promise<void> => {
    // When the real page is absent and every candidate's page_alias points to a
    // different domain, the page resolves as ambiguous: its ads may still be
    // fetched but must carry identityVerified=false so the wall quarantines them.
    const fetchMock = vi.fn(async (requestUrl: string) => {
      const url = new URL(requestUrl);
      const engine = url.searchParams.get("engine");

      if (engine === "meta_ad_library_page_search") {
        return searchApiResponse({
          page_results: [{ page_id: "gong-hr", name: "Gong", page_alias: "gong.hr" }],
        });
      }

      return searchApiResponse({
        ads: [
          {
            page_name: "Gong",
            ad_archive_id: "gong-hr-ad",
            snapshot: { title: "Izađimo da nas čuju" },
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getMetaExecute()(
        { advertiser: "Gong", domain: "gong.io", max_results: 2 },
        {},
      ),
    ).resolves.toMatchObject({
      type: "result",
      ads: [{ id: "gong-hr-ad", identityVerified: false }],
    });
  });

  it("ignores platform profile URLs and resolves a clean single page normally", async (): Promise<void> => {
    // Every Meta page carries a facebook.com page_profile_uri; that platform URL
    // must NOT be read as the entity's domain (it would falsely contradict the
    // verified domain on every candidate and over-quarantine real ads).
    const requestedPageIds: string[] = [];
    const fetchMock = vi.fn(async (requestUrl: string) => {
      const url = new URL(requestUrl);
      const engine = url.searchParams.get("engine");

      if (engine === "meta_ad_library_page_search") {
        return searchApiResponse({
          page_results: [
            {
              page_id: "ramp-real",
              name: "Ramp",
              page_profile_uri: "https://facebook.com/RampFinance",
            },
          ],
        });
      }

      requestedPageIds.push(url.searchParams.get("page_id") ?? "");
      return searchApiResponse({
        ads: [
          {
            page_name: "Ramp",
            ad_archive_id: "ramp-meta",
            snapshot: { title: "The financial operations platform" },
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getMetaExecute()(
        { advertiser: "Ramp", domain: "ramp.com", max_results: 2 },
        {},
      ),
    ).resolves.toMatchObject({
      type: "result",
      ads: [{ advertiserName: "Ramp", id: "ramp-meta", identityVerified: true }],
    });
    expect(requestedPageIds).toEqual(["ramp-real"]);
  });
});
