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

const firecrawlScrapeUrl = "https://api.firecrawl.dev/v2/scrape";

export const FirecrawlOutputSchema = z.union([
  z
    .object({
      type: z.literal("result"),
      url: z.string().url(),
      markdown: z.string(),
      title: z.string().min(1).optional(),
      sourceUrl: z.string().min(1).optional(),
    })
    .strict(),
  ToolGapSchema,
]);

export const firecrawlAgentTool = tool({
  description:
    "Scrape a public URL and return rendered markdown content when search snippets are not enough.",
  inputSchema: z
    .object({
      url: z.string().url().describe("URL to scrape"),
      onlyMainContent: z.boolean().default(true),
    })
    .strict(),
  outputSchema: FirecrawlOutputSchema,
  execute: async ({ url, onlyMainContent }, { abortSignal }) => {
    const apiKey = process.env.FIRECRAWL_API_KEY;

    if (apiKey === undefined || apiKey.trim() === "") {
      return credentialGap("FIRECRAWL_API_KEY") as ToolGap;
    }

    try {
      const response = await timedFetch(firecrawlScrapeUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          formats: ["markdown"],
          onlyMainContent,
        }),
        abortSignal,
        timeoutMs: 60_000,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        return apiErrorGap(
          `Firecrawl ${response.status}: ${body.slice(0, 200)}`,
        ) as ToolGap;
      }

      const data = (await response.json()) as {
        data?: {
          markdown?: string;
          metadata?: { sourceURL?: string; title?: string };
        };
      };

      return {
        type: "result" as const,
        url,
        markdown: data.data?.markdown ?? "",
        title: data.data?.metadata?.title,
        sourceUrl: data.data?.metadata?.sourceURL,
      };
    } catch (error) {
      return errorToGap(error, "Firecrawl request failed");
    }
  },
});
