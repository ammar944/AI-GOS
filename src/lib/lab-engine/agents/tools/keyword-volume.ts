import { tool } from "ai";
import { z } from "zod";

import {
  getKeywordsByBulkSearch,
  SpyFuRateLimitError,
} from "@/lib/ai/spyfu-client";

import {
  ToolGapSchema,
  credentialGap,
  errorToGap,
  type ToolGap,
} from "./_shared";

// Canonical SpyFu domain for the W5 provenance bridge: the top-level tool
// output still carries it so the structural verifier's toolResult source holds
// a stable SpyFu URL. Per-row citations use the deep permalink below instead of
// this bare root — 15+ rows all citing the identical homepage root read as
// uncontained self-reported sources to the judge.
export const SPYFU_SOURCE_URL = "https://www.spyfu.com/";

// Per-keyword SpyFu permalink. Each measured row cites its OWN overview page so
// citations are distinct and resolvable instead of 15 copies of the bare root.
// The verifier collects every URL in the tool output into its searchable set,
// so a body row that cites this exact permalink verifies against the row it
// came from (W5 numericAttribution bridge: match is per-URL exact-string after
// trailing-punctuation cleanup, and the encoded query has no spaces to break
// extraction).
export function spyfuKeywordUrl(keyword: string): string {
  return `https://www.spyfu.com/keyword/overview/us?query=${encodeURIComponent(keyword)}`;
}

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
      // Canonical SpyFu domain (W5 bridge anchor). Per-row sourceUrl below
      // carries the distinct deep permalink each row should be cited with.
      sourceUrl: z.string().url(),
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
            // Per-keyword SpyFu overview permalink: cite THIS, not the bare
            // root, so each measured row carries a distinct resolvable source.
            sourceUrl: z.string().url(),
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
    "SpyFu-estimated monthly search volume, top-of-page CPC, and ranking difficulty for a list of keywords (bulk: up to 100 keywords in one call). Use this to put a falsifiable demand signal on every keyword row. Values are SpyFu estimates (label them as such), not exact auction data. A null cpc means SpyFu has no auction data for that keyword: render it as `n/a` and never describe it as a cheap or $0 CPC opportunity. Cite each row with its OWN sourceUrl exactly as returned (a per-keyword spyfu.com/keyword/overview permalink, NOT the bare root) and copy figures in the row's display formatting.",
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
            sourceUrl: spyfuKeywordUrl(result.keyword),
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
      if (error instanceof SpyFuRateLimitError) {
        // 429 exhaustion is transient: surface a retryable `rate_limited` gap
        // (the prompt contract only allows retrying rate_limited gaps) and
        // refund the budget unit so the retry does not cost a second lookup.
        const gap: ToolGap = {
          type: "gap",
          reason: "rate_limited",
          message: `SpyFu keyword volume rate-limited: ${error.message}`,
          consumesBudget: false,
        };
        return gap;
      }
      return errorToGap(error, "SpyFu keyword volume failed");
    }
  },
});
