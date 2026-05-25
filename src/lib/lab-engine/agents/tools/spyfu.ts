import { tool } from "ai";
import { z } from "zod";

import {
  ToolGapSchema,
  credentialGap,
  errorToGap,
  timedFetch,
} from "./_shared";

const spyfuBaseUrl = "https://api.spyfu.com/apis";
const spyfuTimeoutMs = 10_000;
const spyfuKeywordPageSize = 12;

async function spyfuGet(
  path: string,
  abortSignal: AbortSignal | undefined,
): Promise<unknown> {
  const apiKey = process.env.SPYFU_API_KEY;

  if (apiKey === undefined || apiKey.trim().length === 0) {
    throw new Error("missing_credential:SPYFU_API_KEY");
  }

  const separator = path.includes("?") ? "&" : "?";
  const url = `${spyfuBaseUrl}${path}${separator}api_key=${encodeURIComponent(apiKey)}`;
  const response = await timedFetch(url, {
    timeoutMs: spyfuTimeoutMs,
    abortSignal,
    headers: {
      accept: "application/json",
      "accept-charset": "utf-8",
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`SpyFu ${response.status} for ${path}: ${body.slice(0, 200)}`);
  }

  return response.json() as Promise<unknown>;
}

export const SpyfuOutputSchema = z.union([
  z
    .object({
      type: z.literal("result"),
      domain: z.string().min(1),
      domainStats: z.unknown(),
      keywords: z.unknown(),
    })
    .strict(),
  ToolGapSchema,
]);

export const spyfuAgentTool = tool({
  description:
    "SpyFu PPC and organic keyword intelligence for a competitor domain.",
  inputSchema: z
    .object({
      domain: z.string().min(1),
      intent: z.enum(["keywords", "competitors"]).default("keywords"),
    })
    .strict(),
  outputSchema: SpyfuOutputSchema,
  execute: async ({ domain }, { abortSignal }): Promise<z.infer<typeof SpyfuOutputSchema>> => {
    try {
      const [domainStats, keywords] = await Promise.all([
        spyfuGet(
          `/domain_stats_api/v2/getAllDomainStats?domain=${encodeURIComponent(
            domain,
          )}&countryCode=US`,
          abortSignal,
        ),
        spyfuGet(
          `/serp_api/v2/ppc/getPaidSerps?query=${encodeURIComponent(
            domain,
          )}&countryCode=US&pageSize=${spyfuKeywordPageSize}&startingRow=1&excludeTerms=jobs,career,salary&sortBy=SearchVolume&sortOrder=Descending`,
          abortSignal,
        ),
      ]);

      return {
        type: "result",
        domain,
        domainStats,
        keywords,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (message.startsWith("missing_credential:")) {
        return credentialGap("SPYFU_API_KEY");
      }

      return errorToGap(error, "SpyFu request failed");
    }
  },
});
