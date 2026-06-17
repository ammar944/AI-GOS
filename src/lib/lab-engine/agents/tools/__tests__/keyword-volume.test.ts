import { afterEach, describe, expect, it, vi } from "vitest";

const getKeywordsByBulkSearch = vi.fn();

vi.mock("@/lib/ai/spyfu-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/spyfu-client")>();
  return {
    ...actual,
    getKeywordsByBulkSearch: (...args: unknown[]) =>
      getKeywordsByBulkSearch(...args),
  };
});

import { SpyFuRateLimitError } from "@/lib/ai/spyfu-client";
import {
  formatKeywordVolumeDisplay,
  KeywordVolumeOutputSchema,
  keywordVolumeAgentTool,
  spyfuKeywordUrl,
  SPYFU_SOURCE_URL,
} from "../keyword-volume";

type ToolExecute = (
  input: { keywords: string[] },
  options: { toolCallId: string; messages: [] },
) => Promise<unknown>;

async function executeTool(keywords: string[]): Promise<unknown> {
  const execute = keywordVolumeAgentTool.execute as unknown as ToolExecute;
  return execute({ keywords }, { toolCallId: "test", messages: [] });
}

afterEach((): void => {
  vi.unstubAllEnvs();
  getKeywordsByBulkSearch.mockReset();
});

describe("formatKeywordVolumeDisplay", (): void => {
  it("formats volume with thousands commas and CPC as currency", (): void => {
    expect(
      formatKeywordVolumeDisplay({
        cpc: 38.63,
        difficulty: 27,
        keyword: "airtable pricing",
        searchVolume: 4800,
      }),
    ).toBe(
      '"airtable pricing" — 4,800 searches/mo, CPC $38.63, difficulty 27 (SpyFu-estimated)',
    );
  });

  it("renders null CPC as n/a, never $0", (): void => {
    expect(
      formatKeywordVolumeDisplay({
        cpc: null,
        difficulty: 15,
        keyword: "airtable vs notion",
        searchVolume: 660,
      }),
    ).toBe(
      '"airtable vs notion" — 660 searches/mo, CPC n/a, difficulty 15 (SpyFu-estimated)',
    );
  });
});

describe("keywordVolumeAgentTool", (): void => {
  it("returns the canonical sourceUrl and a display string per row", async (): Promise<void> => {
    vi.stubEnv("SPYFU_API_KEY", "test-key");
    getKeywordsByBulkSearch.mockResolvedValue([
      { keyword: "airtable pricing", searchVolume: 4800, cpc: 38.63, difficulty: 27 },
      { keyword: "airtable vs notion", searchVolume: 660, cpc: 0, difficulty: 15 },
    ]);

    const output = await executeTool(["airtable pricing", "airtable vs notion"]);
    const parsed = KeywordVolumeOutputSchema.parse(output);

    if (parsed.type !== "result") {
      throw new Error(`expected result, got ${parsed.type}`);
    }

    expect(parsed.sourceUrl).toBe(SPYFU_SOURCE_URL);
    expect(parsed.keywords[0]).toEqual({
      keyword: "airtable pricing",
      searchVolume: 4800,
      cpc: 38.63,
      difficulty: 27,
      sourceUrl: "https://www.spyfu.com/keyword/overview/us?query=airtable%20pricing",
      display:
        '"airtable pricing" — 4,800 searches/mo, CPC $38.63, difficulty 27 (SpyFu-estimated)',
    });
    // $0.00 CPC stays a missing measurement: null value, n/a display.
    expect(parsed.keywords[1]).toEqual(
      expect.objectContaining({
        cpc: null,
        sourceUrl:
          "https://www.spyfu.com/keyword/overview/us?query=airtable%20vs%20notion",
        display:
          '"airtable vs notion" — 660 searches/mo, CPC n/a, difficulty 15 (SpyFu-estimated)',
      }),
    );

    // Two distinct keywords must yield two distinct spyfu.com permalinks so the
    // judge never sees 15 rows citing one bare homepage root.
    expect(parsed.keywords[0].sourceUrl).not.toBe(parsed.keywords[1].sourceUrl);
  });

  it("builds a distinct encoded spyfu.com permalink per keyword the schema accepts", (): void => {
    const first = spyfuKeywordUrl("airtable pricing");
    const second = spyfuKeywordUrl("notion alternatives");

    // Two different keywords → two different permalinks, both on spyfu.com,
    // both carrying the URL-encoded query (space → %20).
    expect(first).not.toBe(second);
    expect(first).toBe(
      "https://www.spyfu.com/keyword/overview/us?query=airtable%20pricing",
    );
    expect(second).toBe(
      "https://www.spyfu.com/keyword/overview/us?query=notion%20alternatives",
    );
    for (const url of [first, second]) {
      expect(new URL(url).hostname).toBe("www.spyfu.com");
      expect(url).toContain("%20");
    }

    // The output schema accepts the per-keyword permalinks on row sourceUrl.
    const parsed = KeywordVolumeOutputSchema.parse({
      type: "result",
      source: "SpyFu",
      sourceUrl: SPYFU_SOURCE_URL,
      keywords: [
        {
          keyword: "airtable pricing",
          searchVolume: 4800,
          cpc: 38.63,
          difficulty: 27,
          sourceUrl: first,
          display: formatKeywordVolumeDisplay({
            cpc: 38.63,
            difficulty: 27,
            keyword: "airtable pricing",
            searchVolume: 4800,
          }),
        },
        {
          keyword: "notion alternatives",
          searchVolume: 1900,
          cpc: 12.5,
          difficulty: 33,
          sourceUrl: second,
          display: formatKeywordVolumeDisplay({
            cpc: 12.5,
            difficulty: 33,
            keyword: "notion alternatives",
            searchVolume: 1900,
          }),
        },
      ],
    });

    if (parsed.type !== "result") {
      throw new Error(`expected result, got ${parsed.type}`);
    }
    expect(parsed.keywords[0].sourceUrl).toBe(first);
    expect(parsed.keywords[1].sourceUrl).toBe(second);
  });

  it("returns a credential gap without the key", async (): Promise<void> => {
    vi.stubEnv("SPYFU_API_KEY", "");

    const output = await executeTool(["airtable pricing"]);
    const parsed = KeywordVolumeOutputSchema.parse(output);

    expect(parsed.type).toBe("gap");
    expect(getKeywordsByBulkSearch).not.toHaveBeenCalled();
  });

  it("maps exhausted 429s to a retryable rate_limited gap that refunds budget", async (): Promise<void> => {
    vi.stubEnv("SPYFU_API_KEY", "test-key");
    getKeywordsByBulkSearch.mockRejectedValue(
      new SpyFuRateLimitError(
        "POST /keyword_api/v2/related/getKeywordInformation",
        4,
      ),
    );

    const output = await executeTool(["airtable pricing"]);
    const parsed = KeywordVolumeOutputSchema.parse(output);

    // rate_limited (NOT api_error): the prompt contract only allows the model
    // to retry rate_limited gaps; consumesBudget false refunds the lookup.
    expect(parsed).toMatchObject({
      type: "gap",
      reason: "rate_limited",
      consumesBudget: false,
    });
  });

  it("keeps a non-429 SpyFu failure as a terminal api_error gap", async (): Promise<void> => {
    vi.stubEnv("SPYFU_API_KEY", "test-key");
    getKeywordsByBulkSearch.mockRejectedValue(
      new Error("SpyFu API error 500 on POST /keyword_api"),
    );

    const output = await executeTool(["airtable pricing"]);
    const parsed = KeywordVolumeOutputSchema.parse(output);

    expect(parsed).toMatchObject({ type: "gap", reason: "api_error" });
  });
});
