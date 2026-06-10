import { tool } from "ai";
import { z } from "zod";

import {
  apiErrorGap,
  credentialGap,
  errorToGap,
  timedFetch,
  type ToolGap,
} from "./_shared";
import {
  BraveSearchOutputSchema,
  BraveSearchResultSchema,
  WebSearchInputSchema,
  braveSearchAgentTool,
  clampResultCount,
  isValidUrl,
} from "./brave-search";

const firecrawlSearchUrl = "https://api.firecrawl.dev/v2/search";

// Brave freshness codes mapped to the Google-style tbs values Firecrawl accepts.
const FRESHNESS_TO_TBS: Record<"pd" | "pw" | "pm" | "py", string> = {
  pd: "qdr:d",
  pw: "qdr:w",
  pm: "qdr:m",
  py: "qdr:y",
};

interface FirecrawlSearchApiItem {
  url?: unknown;
  title?: unknown;
  description?: unknown;
  markdown?: unknown;
}

interface FirecrawlSearchApiResponse {
  success?: unknown;
  data?: {
    web?: unknown;
  };
}

function toWebSearchResult(
  item: FirecrawlSearchApiItem,
): z.infer<typeof BraveSearchResultSchema> | null {
  if (
    // Scraped Document entries (search with scrapeOptions) carry markdown;
    // web_search only forwards plain organic results.
    item.markdown !== undefined ||
    typeof item.title !== "string" ||
    item.title.length === 0 ||
    typeof item.url !== "string" ||
    !isValidUrl(item.url)
  ) {
    return null;
  }

  return {
    title: item.title,
    url: item.url,
    description:
      typeof item.description === "string" ? item.description : undefined,
    // Firecrawl search results carry no extra snippets.
    extra_snippets: [],
  };
}

async function runFirecrawlSearch(
  { q, count, freshness, country }: z.infer<typeof WebSearchInputSchema>,
  abortSignal: AbortSignal | undefined,
): Promise<z.infer<typeof BraveSearchOutputSchema>> {
  const apiKey = process.env.FIRECRAWL_API_KEY;

  if (apiKey === undefined || apiKey.trim() === "") {
    return credentialGap("FIRECRAWL_API_KEY") as ToolGap;
  }

  try {
    const response = await timedFetch(firecrawlSearchUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: q,
        limit: clampResultCount(count),
        location: country,
        ...(freshness !== undefined && { tbs: FRESHNESS_TO_TBS[freshness] }),
      }),
      abortSignal,
      timeoutMs: 15_000,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return apiErrorGap(
        `Firecrawl Search ${response.status}: ${body.slice(0, 200)}`,
      ) as ToolGap;
    }

    const data = (await response.json()) as FirecrawlSearchApiResponse;
    const webResults = data.data?.web;

    if (data.success !== true || !Array.isArray(webResults)) {
      return apiErrorGap(
        "Firecrawl Search returned an unexpected response shape (missing data.web results).",
      ) as ToolGap;
    }

    const results = (webResults as FirecrawlSearchApiItem[]).flatMap((item) => {
      const parsedResult = toWebSearchResult(item);
      return parsedResult === null ? [] : [parsedResult];
    });

    return {
      type: "result" as const,
      query: q,
      results,
    };
  } catch (error) {
    return errorToGap(error, "Firecrawl Search request failed");
  }
}

export const firecrawlSearchAgentTool = tool({
  description:
    "Search the public web with Firecrawl Search and return cited organic result snippets.",
  inputSchema: WebSearchInputSchema,
  outputSchema: BraveSearchOutputSchema,
  execute: async (input, options) => {
    const primary = await runFirecrawlSearch(input, options.abortSignal);

    if (primary.type !== "gap") {
      return primary;
    }

    // A Firecrawl outage degrades to the retained Brave path instead of
    // gapping every section's primary search tool.
    const braveExecute = braveSearchAgentTool.execute;

    if (braveExecute === undefined) {
      return primary;
    }

    return braveExecute(input, options);
  },
});
