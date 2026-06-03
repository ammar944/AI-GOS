import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchVerifiedMetaPageAds } from "../adlibrary";

function searchApiResponse(payload: unknown): Response {
  return Response.json(payload);
}

describe("fetchVerifiedMetaPageAds", (): void => {
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

  it("fetches the page's ads directly by id and tags them domain-verified (no name search)", async (): Promise<void> => {
    const requestedEngines: string[] = [];
    const requestedPageIds: string[] = [];
    const fetchMock = vi.fn(async (requestUrl: string) => {
      const url = new URL(requestUrl);
      requestedEngines.push(url.searchParams.get("engine") ?? "");
      requestedPageIds.push(url.searchParams.get("page_id") ?? "");
      return searchApiResponse({
        ads: [
          {
            id: "ramp-meta-1",
            advertiserName: "Ramp",
            snapshot: { title: "Meet the $32B Finance Platform." },
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchVerifiedMetaPageAds({
      advertiser: "Ramp",
      domain: "ramp.com",
      maxResults: 8,
      pageId: "103437121012366",
    });

    expect(result).toMatchObject({
      type: "result",
      platform: "meta",
      ads: [{ id: "ramp-meta-1", identityVerified: true, identityBasis: "domain" }],
    });
    // Went straight to the page by id — the conservative name/alias resolution
    // (meta_ad_library_page_search) is never called.
    expect(requestedEngines).toEqual(["meta_ad_library"]);
    expect(requestedPageIds).toEqual(["103437121012366"]);
  });

  it("returns a credential gap when SEARCHAPI_KEY is missing", async (): Promise<void> => {
    delete process.env.SEARCHAPI_KEY;

    const result = await fetchVerifiedMetaPageAds({
      advertiser: "Ramp",
      domain: "ramp.com",
      maxResults: 8,
      pageId: "103437121012366",
    });

    expect(result).toMatchObject({ type: "gap" });
  });
});
