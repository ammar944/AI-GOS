import { tool } from "ai";
import { z } from "zod";

import {
  ToolGapSchema,
  apiErrorGap,
  credentialGap,
  errorToGap,
  timedFetch,
  type ToolGap,
} from "./_shared";

const braveSearchUrl = "https://api.search.brave.com/res/v1/web/search";

export const BraveSearchResultSchema = z
  .object({
    title: z.string(),
    url: z.string().url(),
    description: z.string().optional(),
    extra_snippets: z.array(z.string()),
  })
  .strict();

export const BraveSearchOutputSchema = z.union([
  z
    .object({
      type: z.literal("result"),
      query: z.string(),
      results: z.array(BraveSearchResultSchema),
    })
    .strict(),
  ToolGapSchema,
]);

// Shared web_search input contract — reused by the Firecrawl-backed primary
// implementation so the tool surface stays identical across providers.
export const WebSearchInputSchema = z
  .object({
    q: z.string().min(1).describe("Search query"),
    count: z.number().int().default(10).describe("1-20, default 10"),
    freshness: z.enum(["pd", "pw", "pm", "py"]).optional(),
    country: z.string().length(2).default("US"),
  })
  .strict();

interface BraveSearchApiResult {
  title?: string;
  url?: string;
  description?: string;
  extra_snippets?: unknown;
}

interface BraveSearchApiResponse {
  web?: {
    results?: BraveSearchApiResult[];
  };
}

export function clampResultCount(count: number | undefined): number {
  const candidate = count ?? 10;
  return Math.min(20, Math.max(1, candidate));
}

export function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function getExtraSnippets(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((snippet) => {
    if (typeof snippet !== "string") {
      return [];
    }

    const trimmed = snippet.trim();
    return trimmed.length === 0 ? [] : [trimmed];
  });
}

function toBraveSearchResult(
  result: BraveSearchApiResult,
): z.infer<typeof BraveSearchResultSchema> | null {
  if (
    result.title === undefined ||
    result.title.length === 0 ||
    result.url === undefined ||
    !isValidUrl(result.url)
  ) {
    return null;
  }

  return {
    title: result.title,
    url: result.url,
    description: result.description,
    extra_snippets: getExtraSnippets(result.extra_snippets),
  };
}

export const braveSearchAgentTool = tool({
  description:
    "Search the public web with Brave Search and return cited organic result snippets.",
  inputSchema: WebSearchInputSchema,
  outputSchema: BraveSearchOutputSchema,
  execute: async ({ q, count, freshness, country }, { abortSignal }) => {
    const apiKey = process.env.BRAVE_SEARCH_API_KEY;

    if (apiKey === undefined || apiKey.trim() === "") {
      return credentialGap("BRAVE_SEARCH_API_KEY") as ToolGap;
    }

    const url = new URL(braveSearchUrl);
    url.searchParams.set("q", q);
    url.searchParams.set("count", String(clampResultCount(count)));
    url.searchParams.set("country", country);

    if (freshness !== undefined) {
      url.searchParams.set("freshness", freshness);
    }

    try {
      const response = await timedFetch(url.toString(), {
        method: "GET",
        headers: {
          "X-Subscription-Token": apiKey,
          Accept: "application/json",
        },
        abortSignal,
        timeoutMs: 15_000,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        return apiErrorGap(
          `Brave Search ${response.status}: ${body.slice(0, 200)}`,
        ) as ToolGap;
      }

      const data = (await response.json()) as BraveSearchApiResponse;
      const results = (data.web?.results ?? []).flatMap((result) => {
        const parsedResult = toBraveSearchResult(result);
        return parsedResult === null ? [] : [parsedResult];
      });

      return {
        type: "result" as const,
        query: q,
        results,
      };
    } catch (error) {
      return errorToGap(error, "Brave Search request failed");
    }
  },
});
