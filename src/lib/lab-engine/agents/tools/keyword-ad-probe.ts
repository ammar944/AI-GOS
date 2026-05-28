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

export const KeywordAdProbeOutputSchema = z.union([
  z
    .object({
      type: z.literal("result"),
      keyword: z.string().min(1),
      organic_count: z.number(),
      ad_count: z.number(),
      top_organic: z.array(
        z
          .object({
            url: z.string().min(1),
            title: z.string().min(1).optional(),
            snippet: z.string().min(1).optional(),
          })
          .strict(),
      ),
    })
    .strict(),
  ToolGapSchema,
]);

export const keywordAdProbeAgentTool = tool({
  description:
    "SearchAPI Google SERP organic and ad result counts with top organic URLs; not search-volume or ad-spend metrics.",
  inputSchema: z
    .object({
      keyword: z.string().min(1),
      location: z.string().min(1).default("United States"),
    })
    .strict(),
  outputSchema: KeywordAdProbeOutputSchema,
  execute: async ({ keyword, location }, { abortSignal }) => {
    const apiKey = process.env.SEARCHAPI_KEY;

    if (apiKey === undefined || apiKey.trim() === "") {
      return credentialGap("SEARCHAPI_KEY") as ToolGap;
    }

    try {
      const url = `https://www.searchapi.io/api/v1/search?engine=google&q=${encodeURIComponent(
        keyword,
      )}&location=${encodeURIComponent(location)}&api_key=${apiKey}`;
      const response = await timedFetch(url, { abortSignal, timeoutMs: 15_000 });

      if (!response.ok) {
        return apiErrorGap(`SearchAPI ${response.status}`) as ToolGap;
      }

      const data = (await response.json()) as {
        ads?: unknown[];
        organic_results?: Array<{
          link?: string;
          snippet?: string;
          title?: string;
        }>;
      };
      const organicResults = data.organic_results ?? [];

      return {
        type: "result" as const,
        keyword,
        organic_count: organicResults.length,
        ad_count: Array.isArray(data.ads) ? data.ads.length : 0,
        top_organic: organicResults
          .filter((result) => result.link !== undefined && result.link.length > 0)
          .slice(0, 5)
          .map((result) => ({
            url: result.link ?? "",
            title: result.title,
            snippet: result.snippet,
          })),
      };
    } catch (error) {
      return errorToGap(error, "Keyword probe failed");
    }
  },
});
