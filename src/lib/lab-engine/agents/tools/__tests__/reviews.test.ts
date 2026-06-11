import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isProductReviewText } from "../reviews";

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

  it("extracts Capterra review bodies from question-style markdown headings", async (): Promise<void> => {
    const fetchMock = vi.fn<typeof fetch>(async (requestUrl, requestInit) => {
      const url = requestUrlToString(requestUrl);

      if (url.includes("searchapi.io")) {
        return jsonResponse({
          organic_results: [
            {
              link: "https://www.capterra.com/p/123/ramp/reviews/",
              snippet: "Capterra users mention approval and onboarding pain.",
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
            "# Ramp Reviews",
            "",
            "What did you like least about Ramp?",
            "Expense approvals are hard to trace and support handoffs are slow when finance teams need month-end cleanup.",
            "",
            "Reasons for Switching to Ramp",
            "The old AP workflow was manual, scattered across email, and created painful vendor onboarding delays.",
          ].join("\n"),
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
            "Expense approvals are hard to trace and support handoffs are slow when finance teams need month-end cleanup.",
        },
        {
          acquisitionMode: "review_body",
          source: "Capterra",
          title: "Ramp Capterra Reviews",
          url: "https://www.capterra.com/p/123/ramp/reviews/",
          reviewText:
            "The old AP workflow was manual, scattered across email, and created painful vendor onboarding delays.",
        },
      ],
    });
  });

  it("prioritizes review-domain body pages over forum pages when the scrape budget is constrained", async (): Promise<void> => {
    const scrapedUrls: string[] = [];
    const fetchMock = vi.fn<typeof fetch>(async (requestUrl, requestInit) => {
      const url = requestUrlToString(requestUrl);

      if (url.includes("searchapi.io")) {
        return jsonResponse({
          organic_results: [
            {
              link: "https://www.reddit.com/r/accounting/comments/ramp_support",
              snippet: "Reddit users mention support pain.",
              title: "Ramp support pain",
            },
            {
              link: "https://www.reddit.com/r/startups/comments/ramp_cards",
              snippet: "Founders complain about card approval handoffs.",
              title: "Ramp card handoffs",
            },
            {
              link: "https://www.capterra.com/p/123/ramp/reviews/",
              snippet: "Capterra users mention manual approval pain.",
              title: "Ramp Capterra reviews",
            },
            {
              link: "https://www.g2.com/products/ramp/reviews",
              snippet: "G2 users mention month-end cleanup pain.",
              title: "Ramp G2 reviews",
            },
          ],
        });
      }

      const body = JSON.parse(String(requestInit?.body)) as { url?: string };
      scrapedUrls.push(body.url ?? "");
      return jsonResponse({
        data: {
          markdown: [
            "What do you dislike about Ramp?",
            "Finance approvals are still confusing and month-end cleanup is manual for operators.",
          ].join("\n"),
          metadata: {
            sourceURL: body.url,
            title: "Recovered review",
          },
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await getExecute()(
      {
        brand: "Ramp",
        max_body_pages: 2,
        max_results: 4,
        mode: "bodies",
      },
      {},
    );

    expect(scrapedUrls).toEqual([
      "https://www.capterra.com/p/123/ramp/reviews/",
      "https://www.g2.com/products/ramp/reviews",
    ]);
  });

  it("recovers reddit bodies via the JSON fallback when Firecrawl is blocked", async (): Promise<void> => {
    const redditComment =
      "Ramp's approval workflow is painful and their support is slow to respond when something breaks.";
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

      if (url.includes("reddit.com") && url.includes(".json")) {
        return jsonResponse([
          { data: { children: [{ data: { selftext: "" } }] } },
          { data: { children: [{ data: { body: redditComment } }] } },
        ]);
      }

      // Firecrawl scrape returns a JS-challenge / blocked page.
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

    const result = (await getExecute()(
      { brand: "Ramp", max_body_pages: 1, max_results: 1, mode: "bodies" },
      {},
    )) as { type: string; excerpts: Array<Record<string, unknown>> };

    expect(result.type).toBe("result");
    expect(result.excerpts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          acquisitionMode: "forum_comment",
          reviewText: expect.stringContaining("approval workflow is painful"),
        }),
      ]),
    );
  });

  it("recovers reddit bodies via the JSON fallback when Firecrawl returns 403", async (): Promise<void> => {
    const redditComment =
      "We switched off Ramp because the reimbursement flow kept failing and reconciliation was a mess.";
    const fetchMock = vi.fn<typeof fetch>(async (requestUrl) => {
      const url = requestUrlToString(requestUrl);

      if (url.includes("searchapi.io")) {
        return jsonResponse({
          organic_results: [
            {
              link: "https://www.reddit.com/r/CFO/comments/ramp",
              snippet: "CFO thread on Ramp.",
              title: "Ramp reconciliation pain",
            },
          ],
        });
      }

      if (url.includes("reddit.com") && url.includes(".json")) {
        return jsonResponse([
          { data: { children: [{ data: { selftext: "" } }] } },
          { data: { children: [{ data: { body: redditComment } }] } },
        ]);
      }

      // Firecrawl scrape is 403'd by reddit's anti-bot.
      return new Response("blocked", { status: 403 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = (await getExecute()(
      { brand: "Ramp", max_body_pages: 1, max_results: 1, mode: "bodies" },
      {},
    )) as { type: string; excerpts: Array<Record<string, unknown>> };

    expect(result.excerpts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          acquisitionMode: "forum_comment",
          reviewText: expect.stringContaining("reimbursement flow kept failing"),
        }),
      ]),
    );
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

  it("attaches each review's own permalink when a scraped G2 index page carries review anchors", async (): Promise<void> => {
    const fetchMock = vi.fn<typeof fetch>(async (requestUrl) => {
      const url = requestUrlToString(requestUrl);

      if (url.includes("searchapi.io")) {
        return jsonResponse({
          organic_results: [
            {
              link: "https://www.g2.com/products/airtable/reviews",
              snippet: "G2 reviews for Airtable.",
              title: "Airtable reviews",
            },
          ],
        });
      }

      return jsonResponse({
        data: {
          markdown: [
            '[Airtable Review: "Great but pricey"](https://www.g2.com/products/airtable/reviews/airtable-review-1111111)',
            "Verified User in Marketing",
            "What do you like best about Airtable?",
            "The flexibility is useful for our team workflows.",
            "What do you dislike about Airtable?",
            "The pricing escalates quickly and the per-seat model is expensive for our growing marketing operations team.",
            "Review collected by and hosted on G2.com.",
            '[Airtable Review: "Automation limits"](https://www.g2.com/products/airtable/reviews/airtable-review-2222222)',
            "Verified User in Operations",
            "What do you dislike about Airtable?",
            "Automation runs are limited and the record caps are a frustrating problem for scaling our client database.",
            "Review collected by and hosted on G2.com.",
          ].join("\n"),
          metadata: {
            sourceURL: "https://www.g2.com/products/airtable/reviews",
            title: "Airtable G2 Reviews",
          },
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getExecute()(
        { brand: "Airtable", max_body_pages: 1, max_results: 1, mode: "bodies" },
        {},
      ),
    ).resolves.toMatchObject({
      type: "result",
      excerpts: [
        {
          url: "https://www.g2.com/products/airtable/reviews/airtable-review-1111111",
          reviewText: expect.stringContaining("pricing escalates quickly"),
        },
        {
          url: "https://www.g2.com/products/airtable/reviews/airtable-review-2222222",
          reviewText: expect.stringContaining("Automation runs are limited"),
        },
      ],
    });
  });

  it("resolves Capterra Cons blocks to the owning review's permalink anchor", async (): Promise<void> => {
    const fetchMock = vi.fn<typeof fetch>(async (requestUrl) => {
      const url = requestUrlToString(requestUrl);

      if (url.includes("searchapi.io")) {
        return jsonResponse({
          organic_results: [
            {
              link: "https://www.capterra.com/p/178986/Airtable/reviews/",
              snippet: "Capterra reviews for Airtable.",
              title: "Airtable Capterra reviews",
            },
          ],
        });
      }

      return jsonResponse({
        data: {
          markdown: [
            "[Maria R. — Airtable review](https://www.capterra.com/p/178986/Airtable/reviews/9999999/)",
            "Pros: Easy to set up for small teams.",
            "Cons: The mobile app is slow and syncing failures are a constant problem for our distributed operations team.",
          ].join("\n"),
          metadata: {
            sourceURL: "https://www.capterra.com/p/178986/Airtable/reviews/",
            title: "Airtable Capterra Reviews",
          },
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getExecute()(
        { brand: "Airtable", max_body_pages: 1, max_results: 1, mode: "bodies" },
        {},
      ),
    ).resolves.toMatchObject({
      type: "result",
      excerpts: [
        {
          url: "https://www.capterra.com/p/178986/Airtable/reviews/9999999/",
          reviewText: expect.stringContaining("mobile app is slow"),
        },
      ],
    });
  });

  it("spends a constrained scrape budget on permalink SERP hits before index pages", async (): Promise<void> => {
    const scrapedUrls: string[] = [];
    const fetchMock = vi.fn<typeof fetch>(async (requestUrl, requestInit) => {
      const url = requestUrlToString(requestUrl);

      if (url.includes("searchapi.io")) {
        return jsonResponse({
          organic_results: [
            {
              link: "https://www.g2.com/products/airtable/reviews",
              snippet: "Index page.",
              title: "Airtable reviews",
            },
            {
              link: "https://www.g2.com/products/airtable/reviews/airtable-review-3333333",
              snippet: "One specific review.",
              title: "Airtable review",
            },
          ],
        });
      }

      const body = JSON.parse(String(requestInit?.body)) as { url?: string };
      scrapedUrls.push(body.url ?? "");

      return jsonResponse({
        data: {
          markdown: [
            "What do you dislike about Airtable?",
            "Sync conflicts keep corrupting our shared client base and support is slow to resolve the issue.",
          ].join("\n"),
          metadata: {
            sourceURL: body.url ?? "",
            title: "Airtable review",
          },
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = (await getExecute()(
      { brand: "Airtable", max_body_pages: 1, max_results: 2, mode: "bodies" },
      {},
    )) as { excerpts: Array<{ url: string }> };

    // The permalink hit wins the single scrape slot, and excerpts from a
    // permalink page keep that permalink even without in-page anchors.
    expect(scrapedUrls).toEqual([
      "https://www.g2.com/products/airtable/reviews/airtable-review-3333333",
    ]);
    expect(result.excerpts[0]?.url).toBe(
      "https://www.g2.com/products/airtable/reviews/airtable-review-3333333",
    );
  });

});

describe("isProductReviewText", (): void => {
  it("rejects job postings and ATS copy even when they mention the product", (): void => {
    expect(
      isProductReviewText(
        "We are looking for a senior engineer with 5 years of experience. Responsibilities include owning the billing platform and the API.",
      ),
    ).toBe(false);
  });

  it("rejects first-party marketing copy", (): void => {
    expect(
      isProductReviewText(
        "Our platform helps finance teams move faster. Request a demo today and see why teams switch.",
      ),
    ).toBe(false);
  });

  it("accepts a genuine negative buyer review", (): void => {
    expect(
      isProductReviewText(
        "The reconciliation feature kept failing and support took weeks to respond, so we churned.",
      ),
    ).toBe(true);
  });
});
