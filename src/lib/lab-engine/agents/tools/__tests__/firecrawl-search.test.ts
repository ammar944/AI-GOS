import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { firecrawlSearchAgentTool } from "../firecrawl-search";

interface WebSearchInput {
  q: string;
  count?: number;
  freshness?: "pd" | "pw" | "pm" | "py";
  country?: string;
}

type WebSearchExecute = (
  input: WebSearchInput,
  context: { abortSignal?: AbortSignal },
) => Promise<unknown>;

function getExecute(): WebSearchExecute {
  const execute = firecrawlSearchAgentTool.execute;

  if (execute === undefined) {
    throw new Error("Expected Firecrawl Search tool execute function.");
  }

  return execute as unknown as WebSearchExecute;
}

function getRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }

  return input instanceof URL ? input.toString() : input.url;
}

const braveFallbackResponseBody = {
  web: {
    results: [
      {
        title: "Fellow meeting automation",
        url: "https://fellow.app/",
        description: "AI meeting notes and action items.",
        extra_snippets: ["Teams use Fellow to capture meeting action items."],
      },
    ],
  },
};

const braveFallbackExpectedOutput = {
  type: "result",
  query: "Fellow AI",
  results: [
    {
      title: "Fellow meeting automation",
      url: "https://fellow.app/",
      description: "AI meeting notes and action items.",
      extra_snippets: ["Teams use Fellow to capture meeting action items."],
    },
  ],
};

describe("firecrawlSearchAgentTool", (): void => {
  const originalFirecrawlKey = process.env.FIRECRAWL_API_KEY;
  const originalBraveKey = process.env.BRAVE_SEARCH_API_KEY;

  beforeEach((): void => {
    process.env.FIRECRAWL_API_KEY = "test-firecrawl-key";
    process.env.BRAVE_SEARCH_API_KEY = "test-brave-key";
  });

  afterEach((): void => {
    if (originalFirecrawlKey === undefined) {
      delete process.env.FIRECRAWL_API_KEY;
    } else {
      process.env.FIRECRAWL_API_KEY = originalFirecrawlKey;
    }

    if (originalBraveKey === undefined) {
      delete process.env.BRAVE_SEARCH_API_KEY;
    } else {
      process.env.BRAVE_SEARCH_API_KEY = originalBraveKey;
    }

    vi.unstubAllGlobals();
  });

  it("parses web results from Firecrawl Search", async (): Promise<void> => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({
        success: true,
        data: {
          web: [
            {
              url: "https://fellow.app/",
              title: "Fellow meeting automation",
              description: "AI meeting notes and action items.",
              position: 1,
            },
            {
              // Scraped Document entry — filtered out of web_search results.
              url: "https://fellow.app/pricing",
              title: "Fellow pricing",
              markdown: "# Pricing",
              position: 2,
            },
            {
              // No url — filtered out.
              title: "Entry without a url",
              position: 3,
            },
          ],
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const output = await getExecute()(
      {
        q: "Fellow AI meeting automation",
        count: 100,
        freshness: "pm",
        country: "US",
      },
      {},
    );

    expect(output).toEqual({
      type: "result",
      query: "Fellow AI meeting automation",
      results: [
        {
          title: "Fellow meeting automation",
          url: "https://fellow.app/",
          description: "AI meeting notes and action items.",
          extra_snippets: [],
        },
      ],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstCall = fetchMock.mock.calls[0];
    if (firstCall === undefined) {
      throw new Error("Expected Firecrawl Search to call fetch.");
    }

    const [requestUrl, requestInit] = firstCall;
    if (typeof requestUrl !== "string" || requestInit === undefined) {
      throw new Error(
        "Expected Firecrawl Search fetch call to include url and init.",
      );
    }

    expect(requestUrl).toBe("https://api.firecrawl.dev/v2/search");
    expect(requestInit.method).toBe("POST");
    expect(requestInit.headers).toEqual({
      Authorization: "Bearer test-firecrawl-key",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(requestInit.body))).toEqual({
      query: "Fellow AI meeting automation",
      limit: 20,
      location: "US",
      tbs: "qdr:m",
    });
  });

  it("falls back to Brave when FIRECRAWL_API_KEY is missing", async (): Promise<void> => {
    delete process.env.FIRECRAWL_API_KEY;
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL): Promise<Response> => {
        const url = getRequestUrl(input);

        if (url.includes("api.search.brave.com")) {
          return Response.json(braveFallbackResponseBody);
        }

        throw new Error(`Unexpected fetch call: ${url}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getExecute()({ q: "Fellow AI", count: 10, country: "US" }, {}),
    ).resolves.toEqual(braveFallbackExpectedOutput);

    // The credential gap short-circuits before any Firecrawl fetch happens.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getRequestUrl(fetchMock.mock.calls[0]?.[0] as RequestInfo | URL)).toContain(
      "api.search.brave.com",
    );
  });

  it("falls back to Brave when Firecrawl Search responds non-ok", async (): Promise<void> => {
    const requestedUrls: string[] = [];
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL): Promise<Response> => {
        const url = getRequestUrl(input);
        requestedUrls.push(url);

        if (url.includes("api.firecrawl.dev")) {
          return new Response("rate limit exceeded", { status: 429 });
        }

        return Response.json(braveFallbackResponseBody);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getExecute()({ q: "Fellow AI", count: 10, country: "US" }, {}),
    ).resolves.toEqual(braveFallbackExpectedOutput);

    expect(requestedUrls).toHaveLength(2);
    expect(requestedUrls[0]).toContain("api.firecrawl.dev");
    expect(requestedUrls[1]).toContain("api.search.brave.com");
  });

  it("falls back to Brave when Firecrawl Search returns an unexpected shape", async (): Promise<void> => {
    const requestedUrls: string[] = [];
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL): Promise<Response> => {
        const url = getRequestUrl(input);
        requestedUrls.push(url);

        if (url.includes("api.firecrawl.dev")) {
          // Scrape-shaped body instead of search results.
          return Response.json({ data: { markdown: "# Not search results" } });
        }

        return Response.json(braveFallbackResponseBody);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getExecute()({ q: "Fellow AI", count: 10, country: "US" }, {}),
    ).resolves.toEqual(braveFallbackExpectedOutput);

    expect(requestedUrls).toHaveLength(2);
    expect(requestedUrls[0]).toContain("api.firecrawl.dev");
    expect(requestedUrls[1]).toContain("api.search.brave.com");
  });

  it("returns the Brave gap when both providers fail", async (): Promise<void> => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL): Promise<Response> => {
        const url = getRequestUrl(input);

        if (url.includes("api.firecrawl.dev")) {
          return new Response("internal error", { status: 500 });
        }

        return new Response("rate limit exceeded for this subscription", {
          status: 429,
        });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getExecute()({ q: "Fellow AI", count: 10, country: "US" }, {}),
    ).resolves.toEqual({
      type: "gap",
      reason: "api_error",
      message: "Brave Search 429: rate limit exceeded for this subscription",
    });
  });
});
