import { tool } from "ai";
import { z } from "zod";

import {
  ToolGapSchema,
  apiErrorGap,
  errorToGap,
  timedFetch,
} from "./_shared";

const pagespeedBaseUrl =
  "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

export const PageSpeedOutputSchema = z.union([
  z
    .object({
      type: z.literal("result"),
      url: z.string().url(),
      score: z.number().nullable(),
      audits: z.unknown(),
    })
    .strict(),
  ToolGapSchema,
]);

export const pagespeedAgentTool = tool({
  description:
    "Run Google PageSpeed Insights for a public URL. No API key is required for low-volume lab use.",
  inputSchema: z
    .object({
      url: z.string().url(),
    })
    .strict(),
  outputSchema: PageSpeedOutputSchema,
  execute: async ({ url }, { abortSignal }) => {
    try {
      const apiUrl = `${pagespeedBaseUrl}?url=${encodeURIComponent(
        url,
      )}&strategy=desktop`;
      const response = await timedFetch(apiUrl, {
        abortSignal,
        timeoutMs: 25_000,
      });

      if (!response.ok) {
        return apiErrorGap(`PageSpeed API ${response.status}`);
      }

      const data = (await response.json()) as {
        lighthouseResult?: {
          audits?: Record<string, unknown>;
          categories?: { performance?: { score?: number } };
        };
      };
      const rawScore = data.lighthouseResult?.categories?.performance?.score;

      return {
        type: "result" as const,
        url,
        score: typeof rawScore === "number" ? Math.round(rawScore * 100) : null,
        audits: data.lighthouseResult?.audits ?? null,
      };
    } catch (error) {
      return errorToGap(error, "PageSpeed request failed");
    }
  },
});
