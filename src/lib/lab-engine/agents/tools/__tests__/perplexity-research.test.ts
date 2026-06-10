import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { perplexityResearchAgentTool } from "../perplexity-research";

type ExecuteFn = NonNullable<typeof perplexityResearchAgentTool.execute>;

function execute(
  input: Parameters<ExecuteFn>[0],
): ReturnType<ExecuteFn> {
  const executeFn = perplexityResearchAgentTool.execute;
  if (executeFn === undefined) {
    throw new Error("perplexity_research tool has no execute");
  }
  return executeFn(input, {
    toolCallId: "test",
    messages: [],
    abortSignal: new AbortController().signal,
  });
}

describe("perplexity_research tool", () => {
  const originalKey = process.env.PERPLEXITY_API_KEY;

  beforeEach(() => {
    process.env.PERPLEXITY_API_KEY = "test-key";
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.PERPLEXITY_API_KEY;
    } else {
      process.env.PERPLEXITY_API_KEY = originalKey;
    }
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns a credential gap when PERPLEXITY_API_KEY is missing", async () => {
    delete process.env.PERPLEXITY_API_KEY;
    const result = await execute({
      question: "Anura.io ad fraud detection buyer complaints",
      recency: "any",
    });
    expect(result).toMatchObject({
      type: "gap",
      reason: "missing_credential",
      envVar: "PERPLEXITY_API_KEY",
    });
  });

  it("maps answer + search_results citations on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  '"ClickCease blocked real users from my site" — G2 reviewer, Head of Growth.',
              },
            },
          ],
          search_results: [
            {
              title: "G2 ClickCease reviews",
              url: "https://www.g2.com/products/clickcease/reviews",
              date: "2026-01-15",
            },
            { url: "https://www.reddit.com/r/PPC/comments/abc/" },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await execute({
      question:
        "Verbatim buyer complaints about ClickCease (click-fraud tool) from G2 and Reddit",
      domains: ["g2.com", "reddit.com"],
      recency: "year",
    });

    expect(result).toMatchObject({
      type: "result",
      source: "Perplexity sonar-pro",
      citations: [
        {
          title: "G2 ClickCease reviews",
          url: "https://www.g2.com/products/clickcease/reviews",
        },
        { url: "https://www.reddit.com/r/PPC/comments/abc/" },
      ],
    });

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(requestInit.body)) as Record<
      string,
      unknown
    >;
    expect(payload.model).toBe("sonar-pro");
    expect(payload.search_domain_filter).toEqual(["g2.com", "reddit.com"]);
    expect(payload.search_recency_filter).toBe("year");
  });

  it("falls back to bare citation URLs when search_results is absent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "Market size $5.6B (MarketsandMarkets)." } }],
            citations: ["https://www.marketsandmarkets.com/report"],
          }),
          { status: 200 },
        ),
      ),
    );

    const result = await execute({
      question: "Ad fraud detection market size with named analyst sources",
      recency: "any",
    });
    expect(result).toMatchObject({
      type: "result",
      citations: [{ url: "https://www.marketsandmarkets.com/report" }],
    });
  });

  it("returns an api_error gap on a non-200 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 })),
    );
    const result = await execute({
      question: "Anura.io ad fraud platform named case study champions",
      recency: "any",
    });
    expect(result).toMatchObject({ type: "gap", reason: "api_error" });
    expect((result as { message: string }).message).toContain("429");
  });

  it("returns an api_error gap when the answer is empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: "" } }] }), {
          status: 200,
        }),
      ),
    );
    const result = await execute({
      question: "Anura.io ad fraud platform buyer quotes from review sites",
      recency: "any",
    });
    expect(result).toMatchObject({ type: "gap", reason: "api_error" });
  });
});
