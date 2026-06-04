import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { keywordTrendsAgentTool } from "../keyword-trends";

interface KeywordTrendsInput {
  keywords: string[];
  geo?: string;
  time?: string;
}

type KeywordTrendsExecute = (
  input: KeywordTrendsInput,
  context: { abortSignal?: AbortSignal },
) => Promise<unknown>;

function getExecute(): KeywordTrendsExecute {
  const execute = keywordTrendsAgentTool.execute;

  if (execute === undefined) {
    throw new Error("Expected keyword_trends tool execute function.");
  }

  return execute as unknown as KeywordTrendsExecute;
}

describe("keywordTrendsAgentTool", (): void => {
  const originalApiKey = process.env.SEARCHAPI_KEY;

  beforeEach((): void => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-04T12:00:00.000Z"));
    process.env.SEARCHAPI_KEY = "test-searchapi-key";
  });

  afterEach((): void => {
    vi.useRealTimers();
    vi.unstubAllGlobals();

    if (originalApiKey === undefined) {
      delete process.env.SEARCHAPI_KEY;
    } else {
      process.env.SEARCHAPI_KEY = originalApiKey;
    }
  });

  it("parses SearchAPI Google Trends relative-interest results", async (): Promise<void> => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({
        interest_over_time: {
          averages: [
            { query: "ai meeting notes", value: "42", extracted_value: 42 },
            { query: "meeting action items", value: "18", extracted_value: 18 },
          ],
          timeline_data: [
            {
              date: "May 2026",
              values: [
                { query: "ai meeting notes", extracted_value: 20 },
                { query: "meeting action items", extracted_value: 30 },
              ],
            },
            {
              date: "Jun 2026",
              values: [
                { query: "ai meeting notes", extracted_value: 80 },
                { query: "meeting action items", extracted_value: 20 },
              ],
            },
          ],
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const output = await getExecute()(
      {
        keywords: ["ai meeting notes", "meeting action items"],
        geo: "US",
        time: "today 12-m",
      },
      {},
    );

    expect(output).toEqual({
      type: "result",
      source: "SearchAPI Google Trends",
      keywords: [
        {
          keyword: "ai meeting notes",
          averageInterest: 42,
          peakInterest: 80,
          trendDirection: "rising",
          sourceTitle: "SearchAPI Google Trends",
          sourceUrl:
            "https://trends.google.com/trends/explore?date=today+12-m&geo=US&q=ai+meeting+notes%2Cmeeting+action+items",
          dateObserved: "2026-06-04",
          timeline: [
            { date: "May 2026", value: 20 },
            { date: "Jun 2026", value: 80 },
          ],
        },
        {
          keyword: "meeting action items",
          averageInterest: 18,
          peakInterest: 30,
          trendDirection: "declining",
          sourceTitle: "SearchAPI Google Trends",
          sourceUrl:
            "https://trends.google.com/trends/explore?date=today+12-m&geo=US&q=ai+meeting+notes%2Cmeeting+action+items",
          dateObserved: "2026-06-04",
          timeline: [
            { date: "May 2026", value: 30 },
            { date: "Jun 2026", value: 20 },
          ],
        },
      ],
    });

    const [requestUrl] = fetchMock.mock.calls[0] ?? [];
    if (typeof requestUrl !== "string") {
      throw new Error("Expected keyword_trends to call fetch with a URL.");
    }

    const url = new URL(requestUrl);
    expect(url.origin + url.pathname).toBe("https://www.searchapi.io/api/v1/search");
    expect(url.searchParams.get("engine")).toBe("google_trends");
    expect(url.searchParams.get("q")).toBe("ai meeting notes,meeting action items");
    expect(url.searchParams.get("geo")).toBe("US");
    expect(url.searchParams.get("time")).toBe("today 12-m");
    expect(url.searchParams.get("api_key")).toBe("test-searchapi-key");
  });

  it("returns a credential gap when SEARCHAPI_KEY is missing", async (): Promise<void> => {
    delete process.env.SEARCHAPI_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getExecute()({ keywords: ["ai meeting notes"], geo: "US" }, {}),
    ).resolves.toEqual({
      type: "gap",
      reason: "missing_credential",
      envVar: "SEARCHAPI_KEY",
      message:
        "SEARCHAPI_KEY not configured - set the env var to enable this tool.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns an API gap when SearchAPI responds non-ok", async (): Promise<void> => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("quota exhausted", {
            status: 429,
          }),
      ),
    );

    await expect(
      getExecute()({ keywords: ["ai meeting notes"], geo: "US" }, {}),
    ).resolves.toEqual({
      type: "gap",
      reason: "api_error",
        message: "SearchAPI Google Trends 429: quota exhausted",
      });
  });

  it("returns an API gap when SearchAPI returns no usable trend data", async (): Promise<void> => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          interest_over_time: {
            averages: [],
            timeline_data: [],
          },
        }),
      ),
    );

    await expect(
      getExecute()({ keywords: ["ai meeting notes"], geo: "US" }, {}),
    ).resolves.toEqual({
      type: "gap",
      reason: "api_error",
      message: "SearchAPI Google Trends returned no keyword interest data",
    });
  });
});
