import { tool } from "ai";
import { z } from "zod";

import { getKeywordsByBulkSearch } from "@/lib/ai/spyfu-client";

import {
  ToolGapSchema,
  credentialGap,
  errorToGap,
  type ToolGap,
} from "./_shared";

// Canonical citation URL for SpyFu-measured rows. The tool output carries it so
// the structural verifier's toolResult source holds the SAME URL the section
// body asserts on keyword rows — without it, numericAttribution claims like
// "4,800 (SpyFu-estimated)" filter to zero sources and die as no_match even
// though the number came from this tool (W5 provenance bridge).
export const SPYFU_SOURCE_URL = "https://www.spyfu.com/";

// Prose-formatted row digest: the body cites figures as "4,800" / "$7.28", but
// raw JSON serializes 4800 / 7.28, which never substring-matches. One display
// string per row puts the exact prose forms in the verifier's searchable text.
export function formatKeywordVolumeDisplay({
  cpc,
  difficulty,
  keyword,
  searchVolume,
}: {
  cpc: number | null;
  difficulty: number;
  keyword: string;
  searchVolume: number;
}): string {
  const volume = searchVolume.toLocaleString("en-US");
  const cpcText = cpc === null ? "n/a" : `$${cpc.toFixed(2)}`;

  return `"${keyword}" — ${volume} searches/mo, CPC ${cpcText}, difficulty ${difficulty} (SpyFu-estimated)`;
}

export const KeywordVolumeOutputSchema = z.union([
  z
    .object({
      type: z.literal("result"),
      source: z.literal("SpyFu"),
      sourceUrl: z.literal(SPYFU_SOURCE_URL),
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
            display: z.string().min(1),
          })
          .strict(),
      ),
    })
    .strict(),
  ToolGapSchema,
]);

export const keywordVolumeAgentTool = tool({
  description:
    "SpyFu-estimated monthly search volume, top-of-page CPC, and ranking difficulty for a list of keywords (bulk: up to 100 keywords in one call). Use this to put a falsifiable demand signal on every keyword row. Values are SpyFu estimates (label them as such), not exact auction data. A null cpc means SpyFu has no auction data for that keyword: render it as `n/a` and never describe it as a cheap or $0 CPC opportunity. Cite each row with sourceUrl exactly as returned (https://www.spyfu.com/) and copy figures in the row's display formatting.",
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
        sourceUrl: SPYFU_SOURCE_URL,
        keywords: results.map((result) => {
          const cpc = result.cpc > 0 ? result.cpc : null;

          return {
            keyword: result.keyword,
            searchVolume: result.searchVolume,
            cpc,
            difficulty: result.difficulty,
            display: formatKeywordVolumeDisplay({
              cpc,
              difficulty: result.difficulty,
              keyword: result.keyword,
              searchVolume: result.searchVolume,
            }),
          };
        }),
      };
    } catch (error) {
      return errorToGap(error, "SpyFu keyword volume failed");
    }
  },
});
