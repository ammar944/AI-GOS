import { tool } from "ai";
import { z } from "zod";

import { getKeywordsByBulkSearch } from "@/lib/ai/spyfu-client";

import {
  ToolGapSchema,
  credentialGap,
  errorToGap,
  type ToolGap,
} from "./_shared";

export const KeywordVolumeOutputSchema = z.union([
  z
    .object({
      type: z.literal("result"),
      source: z.literal("SpyFu"),
      keywords: z.array(
        z
          .object({
            keyword: z.string().min(1),
            searchVolume: z.number(),
            // SpyFu reports $0.00 when it has NO auction data for a keyword —
            // that is a missing measurement, not a cheap click. Normalized to
            // null here so no downstream surface can cite $0 CPC as cheap.
            cpc: z.number().nullable(),
            difficulty: z.number(),
          })
          .strict(),
      ),
    })
    .strict(),
  ToolGapSchema,
]);

export const keywordVolumeAgentTool = tool({
  description:
    "SpyFu-estimated monthly search volume, top-of-page CPC, and ranking difficulty for a list of keywords (bulk: up to 100 keywords in one call). Use this to put a falsifiable demand signal on every keyword row. Values are SpyFu estimates (label them as such), not exact auction data. A null cpc means SpyFu has no auction data for that keyword: render it as `n/a` and never describe it as a cheap or $0 CPC opportunity.",
  inputSchema: z
    .object({
      keywords: z
        .array(z.string().min(1))
        .describe(
          "Category-relevant keywords to enrich with SpyFu volume/CPC/difficulty. Send up to 100 in one call.",
        ),
    })
    .strict(),
  outputSchema: KeywordVolumeOutputSchema,
  execute: async ({ keywords }) => {
    const apiKey = process.env.SPYFU_API_KEY;

    if (apiKey === undefined || apiKey.trim() === "") {
      return credentialGap("SPYFU_API_KEY") as ToolGap;
    }

    try {
      const results = await getKeywordsByBulkSearch(keywords);

      return {
        type: "result" as const,
        source: "SpyFu" as const,
        keywords: results.map((result) => ({
          keyword: result.keyword,
          searchVolume: result.searchVolume,
          cpc: result.cpc > 0 ? result.cpc : null,
          difficulty: result.difficulty,
        })),
      };
    } catch (error) {
      return errorToGap(error, "SpyFu keyword volume failed");
    }
  },
});
