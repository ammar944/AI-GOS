import { afterEach, describe, expect, it, vi } from "vitest";

const getKeywordsByBulkSearch = vi.fn();

vi.mock("@/lib/ai/spyfu-client", () => ({
  getKeywordsByBulkSearch: (...args: unknown[]) =>
    getKeywordsByBulkSearch(...args),
}));

import {
  formatKeywordVolumeDisplay,
  KeywordVolumeOutputSchema,
  keywordVolumeAgentTool,
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
      display:
        '"airtable pricing" — 4,800 searches/mo, CPC $38.63, difficulty 27 (SpyFu-estimated)',
    });
    // $0.00 CPC stays a missing measurement: null value, n/a display.
    expect(parsed.keywords[1]).toEqual(
      expect.objectContaining({
        cpc: null,
        display:
          '"airtable vs notion" — 660 searches/mo, CPC n/a, difficulty 15 (SpyFu-estimated)',
      }),
    );
  });

  it("returns a credential gap without the key", async (): Promise<void> => {
    vi.stubEnv("SPYFU_API_KEY", "");

    const output = await executeTool(["airtable pricing"]);
    const parsed = KeywordVolumeOutputSchema.parse(output);

    expect(parsed.type).toBe("gap");
    expect(getKeywordsByBulkSearch).not.toHaveBeenCalled();
  });
});
