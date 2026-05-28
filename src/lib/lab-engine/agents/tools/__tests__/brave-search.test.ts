import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { braveSearchAgentTool } from "../brave-search";

interface BraveSearchInput {
  q: string;
  count?: number;
  freshness?: "pd" | "pw" | "pm" | "py";
  country?: string;
}

type BraveSearchExecute = (
  input: BraveSearchInput,
  context: { abortSignal?: AbortSignal },
) => Promise<unknown>;

function getExecute(): BraveSearchExecute {
  const execute = braveSearchAgentTool.execute;

  if (execute === undefined) {
    throw new Error("Expected Brave Search tool execute function.");
  }

  return execute as unknown as BraveSearchExecute;
}

describe("braveSearchAgentTool", (): void => {
  const originalApiKey = process.env.BRAVE_SEARCH_API_KEY;

  beforeEach((): void => {
    process.env.BRAVE_SEARCH_API_KEY = "test-brave-key";
  });

  afterEach((): void => {
    if (originalApiKey === undefined) {
      delete process.env.BRAVE_SEARCH_API_KEY;
    } else {
      process.env.BRAVE_SEARCH_API_KEY = originalApiKey;
    }

    vi.unstubAllGlobals();
  });

  it("parses web results from Brave Search", async (): Promise<void> => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({
        web: {
          results: [
            {
              title: "Fellow meeting automation",
              url: "https://fellow.app/",
              description: "AI meeting notes and action items.",
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

    const firstCall = fetchMock.mock.calls[0];
    if (firstCall === undefined) {
      throw new Error("Expected Brave Search to call fetch.");
    }

    const [requestUrl, requestInit] = firstCall;
    if (typeof requestUrl !== "string" || requestInit === undefined) {
      throw new Error("Expected Brave Search fetch call to include url and init.");
    }

    const url = new URL(requestUrl);

    expect(url.origin + url.pathname).toBe(
      "https://api.search.brave.com/res/v1/web/search",
    );
    expect(url.searchParams.get("q")).toBe("Fellow AI meeting automation");
    expect(url.searchParams.get("count")).toBe("20");
    expect(url.searchParams.get("country")).toBe("US");
    expect(url.searchParams.get("freshness")).toBe("pm");
    expect(requestInit.headers).toEqual({
      "X-Subscription-Token": "test-brave-key",
      Accept: "application/json",
    });
  });

  it("returns a credential gap when the API key is missing", async (): Promise<void> => {
    delete process.env.BRAVE_SEARCH_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getExecute()({ q: "Fellow AI", count: 10, country: "US" }, {}),
    ).resolves.toEqual({
      type: "gap",
      reason: "missing_credential",
      envVar: "BRAVE_SEARCH_API_KEY",
      message:
        "BRAVE_SEARCH_API_KEY not configured - set the env var to enable this tool.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns an API gap when Brave Search responds non-ok", async (): Promise<void> => {
    const fetchMock = vi.fn(
      async () =>
        new Response("rate limit exceeded for this subscription", {
          status: 429,
        }),
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
