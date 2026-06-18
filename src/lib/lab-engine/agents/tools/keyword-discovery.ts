import { tool } from "ai";
import { z } from "zod";

import {
  getCompetingPpcKeywords,
  getCompetingSeoKeywords,
  getMostValuableKeywords,
  getRelatedKeywords,
  SpyFuRateLimitError,
  type SpyFuKeywordResult,
} from "@/lib/ai/spyfu-client";

import {
  ToolGapSchema,
  credentialGap,
  errorToGap,
  type ToolGap,
} from "./_shared";

import {
  formatKeywordVolumeDisplay,
  SPYFU_SOURCE_URL,
  spyfuKeywordUrl,
} from "./keyword-volume";

export const KeywordDiscoveryOutputSchema = z.union([
  z
    .object({
      type: z.literal("result"),
      source: z.literal("SpyFu"),
      // Canonical SpyFu domain (W5 provenance bridge anchor). Per-row sourceUrl
      // below carries the distinct deep permalink each row should be cited with.
      sourceUrl: z.string().url(),
      keywords: z.array(
        z
          .object({
            keyword: z.string().min(1),
            searchVolume: z.number(),
            // SpyFu reports $0.00 when it has NO auction data for a keyword —
            // a missing measurement, not a cheap click. Normalized to null so
            // no downstream surface can cite $0 CPC as a cheap opportunity.
            cpc: z.number().nullable(),
            difficulty: z.number(),
            // Per-keyword SpyFu overview permalink: cite THIS, not the bare
            // root, so each discovered row carries a distinct resolvable source.
            sourceUrl: z.string().url(),
            display: z.string().min(1),
          })
          .strict(),
      ),
    })
    .strict(),
  ToolGapSchema,
]);

function toRow(result: SpyFuKeywordResult): {
  keyword: string;
  searchVolume: number;
  cpc: number | null;
  difficulty: number;
  sourceUrl: string;
  display: string;
} {
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
}

export const keywordDiscoveryAgentTool = tool({
  description:
    "SpyFu keyword DISCOVERY: surface the actual keywords a domain ranks/bids on (pass `domain`) or expand a seed keyword into thematically related queries (pass `seed`), each with SpyFu-estimated monthly search volume, top-of-page CPC, and ranking difficulty. Use this to FIND the demand-side queries you don't already know, then enrich a known list with keyword_volume. Values are SpyFu estimates (label them as such). A null cpc means SpyFu has no auction data: render it as `n/a`, never as a cheap or $0 CPC opportunity. Cite each row with its OWN sourceUrl exactly as returned (a per-keyword spyfu.com/keyword/overview permalink, NOT the bare root) and copy figures in the row's display formatting.",
  inputSchema: z
    .object({
      domain: z
        .string()
        .min(1)
        .optional()
        .describe(
          "Domain to discover the most valuable ranking/bidding keywords for (e.g. `airtable.com`). Provide domain OR seed.",
        ),
      seed: z
        .string()
        .min(1)
        .optional()
        .describe(
          "Seed keyword to expand into thematically related queries. Provide domain OR seed.",
        ),
      maxResults: z
        .number()
        .int()
        .optional()
        .describe("Maximum keyword rows to return (SpyFu default 50)."),
      competitorDomains: z
        .array(z.string().min(1))
        .optional()
        .describe(
          "Competitor domains to surface keyword GAPS against — keywords competitors rank/bid for that `domain` does not. Provide with `domain`.",
        ),
      minSearchVolume: z
        .number()
        .int()
        .optional()
        .describe(
          "Minimum monthly search volume floor for returned rows; defaults to the SpyFu floor of 50.",
        ),
    })
    .strict(),
  outputSchema: KeywordDiscoveryOutputSchema,
  execute: async ({ domain, seed, maxResults, competitorDomains, minSearchVolume }) => {
    const apiKey = process.env.SPYFU_API_KEY;

    if (apiKey === undefined || apiKey.trim() === "") {
      return credentialGap("SPYFU_API_KEY") as ToolGap;
    }

    if (
      (domain === undefined || domain.trim() === "") &&
      (seed === undefined || seed.trim() === "")
    ) {
      const gap: ToolGap = {
        type: "gap",
        reason: "api_error",
        message:
          "keyword_discovery needs a `domain` or a `seed` keyword to discover from.",
        consumesBudget: false,
      };
      return gap;
    }

    // Floor for the final mapped rows. The serp/related calls also carry the
    // SpyFu server-side default of 50; this lets the tool raise that floor and
    // gives the competing (kombat) path — which has no server-side floor — one.
    const volumeFloor = minSearchVolume ?? 0;

    try {
      const useCompeting =
        Array.isArray(competitorDomains) &&
        competitorDomains.length > 0 &&
        domain !== undefined &&
        domain.trim() !== "";

      let results: SpyFuKeywordResult[];

      if (useCompeting) {
        const competitors = competitorDomains as string[];
        const cap = maxResults ?? 100;
        const [seo, ppc] = await Promise.all([
          getCompetingSeoKeywords(domain as string, competitors, cap),
          getCompetingPpcKeywords(domain as string, competitors, cap),
        ]);

        // Take only the GAP keywords (weaknesses): keywords competitors
        // rank/bid for that `domain` does not — the non-branded discovery we
        // lack. Concatenate SEO + PPC, dedupe by lowercased keyword (keep first).
        const merged = [...seo.weaknesses, ...ppc.weaknesses];
        const seen = new Set<string>();
        results = merged.filter((row) => {
          const key = row.keyword.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      } else if (domain !== undefined && domain.trim() !== "") {
        results =
          minSearchVolume === undefined
            ? maxResults === undefined
              ? await getMostValuableKeywords(domain)
              : await getMostValuableKeywords(domain, maxResults)
            : await getMostValuableKeywords(
                domain,
                maxResults ?? 50,
                minSearchVolume,
              );
      } else {
        results =
          minSearchVolume === undefined
            ? maxResults === undefined
              ? await getRelatedKeywords(seed as string)
              : await getRelatedKeywords(seed as string, maxResults)
            : await getRelatedKeywords(
                seed as string,
                maxResults ?? 50,
                minSearchVolume,
              );
      }

      return {
        type: "result" as const,
        source: "SpyFu" as const,
        sourceUrl: SPYFU_SOURCE_URL,
        keywords: results
          .filter((row) => row.searchVolume >= volumeFloor)
          .map(toRow),
      };
    } catch (error) {
      if (error instanceof SpyFuRateLimitError) {
        // 429 exhaustion is transient: surface a retryable `rate_limited` gap
        // (the prompt contract only allows retrying rate_limited gaps) and
        // refund the budget unit so the retry does not cost a second lookup.
        const gap: ToolGap = {
          type: "gap",
          reason: "rate_limited",
          message: `SpyFu keyword discovery rate-limited: ${error.message}`,
          consumesBudget: false,
        };
        return gap;
      }
      return errorToGap(error, "SpyFu keyword discovery failed");
    }
  },
});
