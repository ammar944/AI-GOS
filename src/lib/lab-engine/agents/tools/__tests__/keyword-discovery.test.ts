import { afterEach, describe, expect, it, vi } from "vitest";

const getMostValuableKeywords = vi.fn();
const getRelatedKeywords = vi.fn();
const getCompetingSeoKeywords = vi.fn();
const getCompetingPpcKeywords = vi.fn();

// The REAL kombat implementations are captured so the live-path 429 test can
// drive the tool through the actual spyfu-client wrapper (which calls fetch)
// instead of the unit mock — the mock-the-wrapper variant gave false 429
// confidence while the real wrapper silently swallowed per-call 429s. The
// holder is hoisted with the vi.mock factory so the factory can write to it.
const realImpl = vi.hoisted(() => ({
  getCompetingSeoKeywords:
    undefined as
      | typeof import("@/lib/ai/spyfu-client").getCompetingSeoKeywords
      | undefined,
}));

vi.mock("@/lib/ai/spyfu-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/spyfu-client")>();
  realImpl.getCompetingSeoKeywords = actual.getCompetingSeoKeywords;
  return {
    ...actual,
    getMostValuableKeywords: (...args: unknown[]) =>
      getMostValuableKeywords(...args),
    getRelatedKeywords: (...args: unknown[]) => getRelatedKeywords(...args),
    getCompetingSeoKeywords: (...args: unknown[]) =>
      getCompetingSeoKeywords(...args),
    getCompetingPpcKeywords: (...args: unknown[]) =>
      getCompetingPpcKeywords(...args),
  };
});

import { SpyFuRateLimitError } from "@/lib/ai/spyfu-client";
import {
  KeywordDiscoveryOutputSchema,
  keywordDiscoveryAgentTool,
} from "../keyword-discovery";

interface ToolInput {
  domain?: string;
  seed?: string;
  maxResults?: number;
  competitorDomains?: string[];
  minSearchVolume?: number;
}

type ToolExecute = (
  input: ToolInput,
  options: { toolCallId: string; messages: [] },
) => Promise<unknown>;

async function executeTool(input: ToolInput): Promise<unknown> {
  const execute = keywordDiscoveryAgentTool.execute as unknown as ToolExecute;
  return execute(input, { toolCallId: "test", messages: [] });
}

afterEach((): void => {
  vi.unstubAllEnvs();
  getMostValuableKeywords.mockReset();
  getRelatedKeywords.mockReset();
  getCompetingSeoKeywords.mockReset();
  getCompetingPpcKeywords.mockReset();
});

describe("keywordDiscoveryAgentTool", (): void => {
  it("returns a credential gap without the key", async (): Promise<void> => {
    vi.stubEnv("SPYFU_API_KEY", "");

    const output = await executeTool({ domain: "airtable.com" });
    const parsed = KeywordDiscoveryOutputSchema.parse(output);

    expect(parsed.type).toBe("gap");
    if (parsed.type === "gap") {
      expect(parsed.reason).toBe("missing_credential");
      expect(parsed.envVar).toBe("SPYFU_API_KEY");
    }
    expect(getMostValuableKeywords).not.toHaveBeenCalled();
    expect(getRelatedKeywords).not.toHaveBeenCalled();
  });

  it("discovers a domain's most valuable keywords with a per-row sourceUrl and display", async (): Promise<void> => {
    vi.stubEnv("SPYFU_API_KEY", "test-key");
    getMostValuableKeywords.mockResolvedValue([
      { keyword: "airtable pricing", searchVolume: 4800, cpc: 38.63, difficulty: 27 },
      { keyword: "airtable vs notion", searchVolume: 660, cpc: 0, difficulty: 15 },
    ]);

    const output = await executeTool({ domain: "airtable.com" });
    const parsed = KeywordDiscoveryOutputSchema.parse(output);

    if (parsed.type !== "result") {
      throw new Error(`expected result, got ${parsed.type}`);
    }

    expect(getMostValuableKeywords).toHaveBeenCalledWith("airtable.com");
    expect(parsed.source).toBe("SpyFu");
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
    // Distinct keywords → distinct per-row permalinks.
    expect(parsed.keywords[0].sourceUrl).not.toBe(parsed.keywords[1].sourceUrl);
  });

  it("expands a seed keyword via getRelatedKeywords when no domain is given", async (): Promise<void> => {
    vi.stubEnv("SPYFU_API_KEY", "test-key");
    getRelatedKeywords.mockResolvedValue([
      { keyword: "notion alternatives", searchVolume: 1900, cpc: 12.5, difficulty: 33 },
    ]);

    const output = await executeTool({ seed: "notion" });
    const parsed = KeywordDiscoveryOutputSchema.parse(output);

    if (parsed.type !== "result") {
      throw new Error(`expected result, got ${parsed.type}`);
    }

    expect(getRelatedKeywords).toHaveBeenCalledWith("notion");
    expect(getMostValuableKeywords).not.toHaveBeenCalled();
    expect(parsed.keywords[0].keyword).toBe("notion alternatives");
    expect(parsed.keywords[0].sourceUrl).toBe(
      "https://www.spyfu.com/keyword/overview/us?query=notion%20alternatives",
    );
  });

  it("maps exhausted 429s to a retryable rate_limited gap that refunds budget", async (): Promise<void> => {
    vi.stubEnv("SPYFU_API_KEY", "test-key");
    getMostValuableKeywords.mockRejectedValue(
      new SpyFuRateLimitError(
        "GET /serp_api/v2/seo/getMostValuableKeywords",
        4,
      ),
    );

    const output = await executeTool({ domain: "airtable.com" });
    const parsed = KeywordDiscoveryOutputSchema.parse(output);

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
    getMostValuableKeywords.mockRejectedValue(
      new Error("SpyFu API error 500 on getMostValuableKeywords"),
    );

    const output = await executeTool({ domain: "airtable.com" });
    const parsed = KeywordDiscoveryOutputSchema.parse(output);

    expect(parsed).toMatchObject({ type: "gap", reason: "api_error" });
  });

  it("surfaces deduped competitor-gap (weaknesses) keywords from SEO + PPC kombat", async (): Promise<void> => {
    vi.stubEnv("SPYFU_API_KEY", "test-key");
    getCompetingSeoKeywords.mockResolvedValue({
      weaknesses: [
        { keyword: "expense management software", searchVolume: 5400, cpc: 22.1, difficulty: 41 },
        { keyword: "corporate cards", searchVolume: 2900, cpc: 14.0, difficulty: 36 },
      ],
      shared: [{ keyword: "ignored shared", searchVolume: 100, cpc: 1, difficulty: 1 }],
      strengths: [{ keyword: "ignored strength", searchVolume: 100, cpc: 1, difficulty: 1 }],
    });
    getCompetingPpcKeywords.mockResolvedValue({
      weaknesses: [
        // duplicate of an SEO weakness (different case) — must collapse
        { keyword: "Corporate Cards", searchVolume: 2900, cpc: 18.5, difficulty: 36 },
        { keyword: "spend management", searchVolume: 1200, cpc: 9.4, difficulty: 28 },
      ],
      shared: [],
      strengths: [],
    });

    const output = await executeTool({
      domain: "airtable.com",
      competitorDomains: ["ramp.com", "brex.com"],
    });
    const parsed = KeywordDiscoveryOutputSchema.parse(output);

    if (parsed.type !== "result") {
      throw new Error(`expected result, got ${parsed.type}`);
    }

    expect(getCompetingSeoKeywords).toHaveBeenCalledWith(
      "airtable.com",
      ["ramp.com", "brex.com"],
      100,
    );
    expect(getCompetingPpcKeywords).toHaveBeenCalledWith(
      "airtable.com",
      ["ramp.com", "brex.com"],
      100,
    );
    // domain-only / seed-only paths are NOT used when competitorDomains given
    expect(getMostValuableKeywords).not.toHaveBeenCalled();
    expect(getRelatedKeywords).not.toHaveBeenCalled();

    const keywords = parsed.keywords.map((row) => row.keyword);
    expect(keywords).toContain("expense management software");
    expect(keywords).toContain("spend management");
    // SEO + PPC weaknesses merged; case-insensitive dedupe collapses the dup
    expect(
      keywords.filter((k) => k.toLowerCase() === "corporate cards").length,
    ).toBe(1);
    // First-seen wins: the SEO weakness row is retained
    const corporateCards = parsed.keywords.find(
      (row) => row.keyword.toLowerCase() === "corporate cards",
    );
    expect(corporateCards?.keyword).toBe("corporate cards");
    // each row carries its own distinct per-keyword permalink
    expect(parsed.keywords[0].sourceUrl).not.toBe(parsed.keywords[1].sourceUrl);
  });

  it("applies a minSearchVolume floor that drops below-floor rows for the competing path", async (): Promise<void> => {
    vi.stubEnv("SPYFU_API_KEY", "test-key");
    getCompetingSeoKeywords.mockResolvedValue({
      weaknesses: [
        { keyword: "high volume gap", searchVolume: 5400, cpc: 22.1, difficulty: 41 },
        { keyword: "tiny volume gap", searchVolume: 50, cpc: 1.1, difficulty: 5 },
      ],
      shared: [],
      strengths: [],
    });
    getCompetingPpcKeywords.mockResolvedValue({
      weaknesses: [],
      shared: [],
      strengths: [],
    });

    const output = await executeTool({
      domain: "airtable.com",
      competitorDomains: ["ramp.com"],
      minSearchVolume: 100,
    });
    const parsed = KeywordDiscoveryOutputSchema.parse(output);

    if (parsed.type !== "result") {
      throw new Error(`expected result, got ${parsed.type}`);
    }

    const keywords = parsed.keywords.map((row) => row.keyword);
    expect(keywords).toContain("high volume gap");
    expect(keywords).not.toContain("tiny volume gap");
  });

  it("applies a minSearchVolume floor to the domain-only path too", async (): Promise<void> => {
    vi.stubEnv("SPYFU_API_KEY", "test-key");
    getMostValuableKeywords.mockResolvedValue([
      { keyword: "above floor", searchVolume: 4800, cpc: 38.63, difficulty: 27 },
      { keyword: "below floor", searchVolume: 50, cpc: 0, difficulty: 15 },
    ]);

    const output = await executeTool({
      domain: "airtable.com",
      minSearchVolume: 100,
    });
    const parsed = KeywordDiscoveryOutputSchema.parse(output);

    if (parsed.type !== "result") {
      throw new Error(`expected result, got ${parsed.type}`);
    }

    const keywords = parsed.keywords.map((row) => row.keyword);
    expect(keywords).toContain("above floor");
    expect(keywords).not.toContain("below floor");
  });

  it("maps a real-wrapper 429 in the competing path to a retryable rate_limited gap", async (): Promise<void> => {
    // Drive the REAL kombat wrapper (spyfu-client -> fetch) on an all-429
    // response so the test exercises the same code production runs. Mocking the
    // wrapper directly hid that the wrapper swallowed per-call 429s and never
    // surfaced rate_limited (the tool's rate_limited mapping was dead in prod).
    vi.stubEnv("SPYFU_API_KEY", "test-key");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => new Response("rate limited", { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);

    // The unit mock delegates to the real implementation so the actual
    // fetch-level 429 propagation is what the tool sees.
    getCompetingSeoKeywords.mockImplementation((...args: unknown[]) =>
      realImpl.getCompetingSeoKeywords?.(
        args[0] as string,
        args[1] as string[],
        args[2] as number | undefined,
      ),
    );
    getCompetingPpcKeywords.mockResolvedValue({
      weaknesses: [],
      shared: [],
      strengths: [],
    });

    const outputPromise = executeTool({
      domain: "airtable.com",
      competitorDomains: ["ramp.com"],
    });
    await vi.runAllTimersAsync();
    const output = await outputPromise;
    vi.useRealTimers();
    const parsed = KeywordDiscoveryOutputSchema.parse(output);

    expect(parsed).toMatchObject({
      type: "gap",
      reason: "rate_limited",
      consumesBudget: false,
    });
  });

  it("returns a credential gap for the competing path without the key", async (): Promise<void> => {
    vi.stubEnv("SPYFU_API_KEY", "");

    const output = await executeTool({
      domain: "airtable.com",
      competitorDomains: ["ramp.com"],
    });
    const parsed = KeywordDiscoveryOutputSchema.parse(output);

    expect(parsed.type).toBe("gap");
    if (parsed.type === "gap") {
      expect(parsed.reason).toBe("missing_credential");
      expect(parsed.envVar).toBe("SPYFU_API_KEY");
    }
    expect(getCompetingSeoKeywords).not.toHaveBeenCalled();
    expect(getCompetingPpcKeywords).not.toHaveBeenCalled();
  });
});
