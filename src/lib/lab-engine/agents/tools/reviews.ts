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

export const ReviewsOutputSchema = z.union([
  z
    .object({
      type: z.literal("result"),
      brand: z.string().min(1),
      excerpts: z.array(
        z
          .object({
            source: z.string().min(1),
            url: z.string().min(1),
            snippet: z.string().min(1),
          })
          .strict(),
      ),
    })
    .strict(),
  ToolGapSchema,
]);

function deriveReviewSource(url: string): string {
  if (url.includes("g2.com")) {
    return "G2";
  }

  if (url.includes("capterra")) {
    return "Capterra";
  }

  if (url.includes("trustpilot")) {
    return "Trustpilot";
  }

  return "Web";
}

export const reviewsAgentTool = tool({
  description:
    "Find customer reviews for a brand across G2, Capterra, and Trustpilot via SearchAPI.",
  inputSchema: z
    .object({
      brand: z.string().min(1),
      max_results: z.number().int().positive().default(8),
    })
    .strict(),
  outputSchema: ReviewsOutputSchema,
  execute: async ({ brand, max_results }, { abortSignal }) => {
    const apiKey = process.env.SEARCHAPI_KEY;

    if (apiKey === undefined || apiKey.trim() === "") {
      return credentialGap("SEARCHAPI_KEY") as ToolGap;
    }

    try {
      const query = `${brand} reviews (site:g2.com OR site:capterra.com OR site:trustpilot.com)`;
      const url = `https://www.searchapi.io/api/v1/search?engine=google&q=${encodeURIComponent(
        query,
      )}&num=${max_results}&api_key=${apiKey}`;
      const response = await timedFetch(url, { abortSignal, timeoutMs: 15_000 });

      if (!response.ok) {
        return apiErrorGap(`SearchAPI ${response.status}`) as ToolGap;
      }

      const data = (await response.json()) as {
        organic_results?: Array<{
          link?: string;
          snippet?: string;
        }>;
      };
      const excerpts = (data.organic_results ?? [])
        .filter(
          (result) =>
            result.link !== undefined &&
            result.link.length > 0 &&
            result.snippet !== undefined &&
            result.snippet.length > 0,
        )
        .map((result) => ({
          source: deriveReviewSource(result.link ?? ""),
          url: result.link ?? "",
          snippet: result.snippet ?? "",
        }));

      return { type: "result" as const, brand, excerpts };
    } catch (error) {
      return errorToGap(error, "Reviews fetch failed");
    }
  },
});
