import { afterEach, describe, expect, it, vi } from "vitest";

import { ForeplayService } from "../service";

describe("ForeplayService", (): void => {
  afterEach((): void => {
    vi.unstubAllGlobals();
  });

  it("does not retry or try domain variants when Foreplay excludes a domain", async (): Promise<void> => {
    const fetchMock = vi.fn(async () =>
      new Response("Domain is excluded - monday.com is in the excluded list", {
        status: 400,
        statusText: "Bad Request",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const service = new ForeplayService({
      apiKey: "test-foreplay-key",
      timeout: 1_000,
    });

    await expect(service.searchBrands({ domain: "monday.com" })).resolves.toEqual(
      [],
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry generic non-rate-limit 400 responses", async (): Promise<void> => {
    const fetchMock = vi.fn(async () =>
      new Response("Bad request", {
        status: 400,
        statusText: "Bad Request",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const service = new ForeplayService({
      apiKey: "test-foreplay-key",
      timeout: 1_000,
    });

    await expect(service.searchBrands({ domain: "example.com" })).resolves.toEqual(
      [],
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
