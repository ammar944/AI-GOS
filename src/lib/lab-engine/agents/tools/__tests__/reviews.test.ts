import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { reviewsAgentTool } from "../reviews";

interface ReviewsInput {
  brand: string;
  max_body_pages?: number;
  max_results?: number;
  mode?: "snippets" | "bodies";
}

type ReviewsExecute = (
  input: ReviewsInput,
  context: { abortSignal?: AbortSignal },
) => Promise<unknown>;

function getExecute(): ReviewsExecute {
  const execute = reviewsAgentTool.execute;

  if (execute === undefined) {
    throw new Error("Expected reviews tool execute function.");
  }

  return execute as unknown as ReviewsExecute;
}

function jsonResponse(value: unknown): Response {
  return Response.json(value);
}

function requestUrlToString(requestUrl: string | URL | Request): string {
  if (typeof requestUrl === "string") {
    return requestUrl;
  }

  if (requestUrl instanceof URL) {
    return requestUrl.toString();
  }

  return requestUrl.url;
}

describe("reviewsAgentTool", (): void => {
  const originalFirecrawlKey = process.env.FIRECRAWL_API_KEY;
  const originalSearchApiKey = process.env.SEARCHAPI_KEY;

  beforeEach((): void => {
    process.env.FIRECRAWL_API_KEY = "test-firecrawl-key";
    process.env.SEARCHAPI_KEY = "test-searchapi-key";
  });

  afterEach((): void => {
    if (originalFirecrawlKey === undefined) {
      delete process.env.FIRECRAWL_API_KEY;
    } else {
      process.env.FIRECRAWL_API_KEY = originalFirecrawlKey;
    }

    if (originalSearchApiKey === undefined) {
      delete process.env.SEARCHAPI_KEY;
    } else {
      process.env.SEARCHAPI_KEY = originalSearchApiKey;
    }

    vi.unstubAllGlobals();
  });

  it("keeps snippet mode as a SearchAPI-only compatibility path", async (): Promise<void> => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      jsonResponse({
        organic_results: [
          {
            link: "https://www.g2.com/products/ramp/reviews",
            snippet: "Users mention manual expense cleanup and approval pain.",
            title: "Ramp reviews",
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getExecute()({ brand: "Ramp", max_results: 3 }, {}),
    ).resolves.toEqual({
      type: "result",
      brand: "Ramp",
      excerpts: [
        {
          acquisitionMode: "serp_snippet",
          source: "G2",
          title: "Ramp reviews",
          url: "https://www.g2.com/products/ramp/reviews",
          snippet: "Users mention manual expense cleanup and approval pain.",
        },
      ],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("scrapes and extracts review bodies in bodies mode", async (): Promise<void> => {
    const fetchMock = vi.fn<typeof fetch>(async (requestUrl, requestInit) => {
      const url = requestUrlToString(requestUrl);

      if (url.includes("searchapi.io")) {
        return jsonResponse({
          organic_results: [
            {
              link: "https://www.g2.com/products/ramp/reviews",
              snippet: "G2 snippet about approval workflow pain.",
              title: "Ramp reviews",
            },
            {
              link: "https://www.trustpilot.com/review/ramp.com",
              snippet: "Trustpilot snippet about support issues.",
              title: "Ramp Trustpilot",
            },
          ],
        });
      }

      const body = JSON.parse(String(requestInit?.body)) as {
        blockAds?: unknown;
        url?: unknown;
      };
      expect(body.blockAds).toBe(true);

      if (body.url === "https://www.g2.com/products/ramp/reviews") {
        return jsonResponse({
          data: {
            markdown: [
              "What do you dislike about Ramp?",
              "Approvals are still confusing when finance has to reconcile manual exception workflows after month-end close.",
              "Review collected by and hosted on G2.com.",
            ].join("\n"),
            metadata: {
              sourceURL: "https://www.g2.com/products/ramp/reviews",
              title: "Ramp G2 Reviews",
            },
          },
        });
      }

      return jsonResponse({
        data: {
          markdown: [
            "Rated 2 out of 5 stars",
            "The support handoff was slow and expensive for our finance operations team.",
            "Date of experience: March 02, 2026",
          ].join("\n"),
          metadata: {
            sourceURL: "https://www.trustpilot.com/review/ramp.com",
            title: "Ramp Trustpilot",
          },
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getExecute()(
        {
          brand: "Ramp",
          max_body_pages: 2,
          max_results: 2,
          mode: "bodies",
        },
        {},
      ),
    ).resolves.toMatchObject({
      type: "result",
      brand: "Ramp",
      excerpts: [
        {
          acquisitionMode: "review_body",
          source: "G2",
          title: "Ramp G2 Reviews",
          url: "https://www.g2.com/products/ramp/reviews",
          reviewText:
            "Approvals are still confusing when finance has to reconcile manual exception workflows after month-end close.",
        },
        {
          acquisitionMode: "review_body",
          date: "March 02, 2026",
          rating: 2,
          source: "Trustpilot",
          title: "Ramp Trustpilot",
          url: "https://www.trustpilot.com/review/ramp.com",
          reviewText:
            "The support handoff was slow and expensive for our finance operations team.",
        },
      ],
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("returns per-URL attempts when body scraping has no usable reviews", async (): Promise<void> => {
    const fetchMock = vi.fn<typeof fetch>(async (requestUrl) => {
      const url = requestUrlToString(requestUrl);

      if (url.includes("searchapi.io")) {
        return jsonResponse({
          organic_results: [
            {
              link: "https://www.capterra.com/p/123/ramp/reviews/",
              snippet: "Capterra users mention manual approval pain.",
              title: "Ramp Capterra",
            },
          ],
        });
      }

      return jsonResponse({ data: { markdown: "" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getExecute()(
        {
          brand: "Ramp",
          max_body_pages: 1,
          max_results: 1,
          mode: "bodies",
        },
        {},
      ),
    ).resolves.toMatchObject({
      type: "result",
      brand: "Ramp",
      excerpts: [],
      attempts: [
        {
          acquisitionMode: "review_body",
          domain: "capterra.com",
          gapReason: "empty_markdown",
          source: "Capterra",
          status: "failed",
          url: "https://www.capterra.com/p/123/ramp/reviews/",
        },
      ],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("scrapes URL-only SearchAPI body-mode results before rejecting them", async (): Promise<void> => {
    const fetchMock = vi.fn<typeof fetch>(async (requestUrl, requestInit) => {
      const url = requestUrlToString(requestUrl);

      if (url.includes("searchapi.io")) {
        return jsonResponse({
          organic_results: [
            {
              link: "https://www.capterra.com/p/123/ramp/reviews/",
              title: "Ramp Capterra reviews",
            },
          ],
        });
      }

      const body = JSON.parse(String(requestInit?.body)) as { url?: unknown };
      expect(body.url).toBe("https://www.capterra.com/p/123/ramp/reviews/");
      return jsonResponse({
        data: {
          markdown: [
            "Cons: Reporting setup is confusing and the manual approval workflow still creates month-end finance pain for operators.",
            "Pros: The card controls are helpful once configured.",
          ].join("\n\n"),
          metadata: {
            sourceURL: "https://www.capterra.com/p/123/ramp/reviews/",
            title: "Ramp Capterra Reviews",
          },
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getExecute()(
        {
          brand: "Ramp",
          max_body_pages: 1,
          max_results: 1,
          mode: "bodies",
        },
        {},
      ),
    ).resolves.toMatchObject({
      type: "result",
      brand: "Ramp",
      attempts: [
        {
          acquisitionMode: "review_body",
          domain: "capterra.com",
          source: "Capterra",
          status: "succeeded",
        },
      ],
      excerpts: [
        {
          acquisitionMode: "review_body",
          source: "Capterra",
          title: "Ramp Capterra Reviews",
          url: "https://www.capterra.com/p/123/ramp/reviews/",
          reviewText:
            "Reporting setup is confusing and the manual approval workflow still creates month-end finance pain for operators.",
        },
      ],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("records blocked JS challenge pages as acquisition attempts", async (): Promise<void> => {
    const fetchMock = vi.fn<typeof fetch>(async (requestUrl) => {
      const url = requestUrlToString(requestUrl);

      if (url.includes("searchapi.io")) {
        return jsonResponse({
          organic_results: [
            {
              link: "https://www.reddit.com/r/finance/comments/ramp",
              snippet: "Reddit users mention approval pain.",
              title: "Ramp approval pain",
            },
          ],
        });
      }

      return jsonResponse({
        data: {
          markdown:
            "Just a moment... Enable JavaScript and cookies to continue.",
          metadata: {
            sourceURL: "https://www.reddit.com/r/finance/comments/ramp",
            title: "Ramp approval pain",
          },
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getExecute()(
        {
          brand: "Ramp",
          max_body_pages: 1,
          max_results: 1,
          mode: "bodies",
        },
        {},
      ),
    ).resolves.toMatchObject({
      type: "result",
      attempts: [
        {
          acquisitionMode: "forum_comment",
          domain: "reddit.com",
          gapReason: "blocked_js_challenge",
          source: "Web",
          status: "failed",
          url: "https://www.reddit.com/r/finance/comments/ramp",
        },
      ],
      excerpts: [],
    });
  });

  it("returns a Firecrawl credential gap before SearchAPI discovery in bodies mode", async (): Promise<void> => {
    delete process.env.FIRECRAWL_API_KEY;
    const fetchMock = vi.fn<typeof fetch>(async () =>
      jsonResponse({ organic_results: [] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getExecute()(
        {
          brand: "Ramp",
          max_body_pages: 1,
          max_results: 1,
          mode: "bodies",
        },
        {},
      ),
    ).resolves.toMatchObject({
      type: "gap",
      reason: "missing_credential",
      envVar: "FIRECRAWL_API_KEY",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
