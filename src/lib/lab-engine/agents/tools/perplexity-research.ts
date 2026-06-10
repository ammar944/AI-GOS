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

// Perplexity chat-completions endpoint. sonar-pro reads sources server-side,
// so it reaches review surfaces that block our scrapers (G2, Capterra,
// Reddit) and returns the citation list those claims trace to. This is the
// evidence-acquisition path for the sections the checkle/anura runs proved
// starved: VoC quotes, named Buyer ICP personas, sourced market sizing.
const perplexityBaseUrl = "https://api.perplexity.ai/chat/completions";
const perplexityModel = "sonar-pro";
const perplexityTimeoutMs = 50_000;
const maxAnswerTokens = 1_600;
const maxDomainFilters = 10;

const PerplexityCitationSchema = z
  .object({
    url: z.string().min(1),
    title: z.string().min(1).optional(),
    date: z.string().min(1).optional(),
  })
  .strict();

export const PerplexityResearchOutputSchema = z.union([
  z
    .object({
      type: z.literal("result"),
      source: z.literal("Perplexity sonar-pro"),
      answer: z.string().min(1),
      citations: z.array(PerplexityCitationSchema),
    })
    .strict(),
  ToolGapSchema,
]);

interface PerplexitySearchResult {
  title?: unknown;
  url?: unknown;
  date?: unknown;
}

interface PerplexityResponse {
  choices?: { message?: { content?: unknown } }[];
  citations?: unknown;
  search_results?: unknown;
}

function asCitations(
  data: PerplexityResponse,
): z.infer<typeof PerplexityCitationSchema>[] {
  const fromSearchResults = Array.isArray(data.search_results)
    ? (data.search_results as PerplexitySearchResult[]).flatMap((result) => {
        if (typeof result?.url !== "string" || result.url.trim() === "") {
          return [];
        }
        return [
          {
            url: result.url,
            ...(typeof result.title === "string" && result.title.trim() !== ""
              ? { title: result.title }
              : {}),
            ...(typeof result.date === "string" && result.date.trim() !== ""
              ? { date: result.date }
              : {}),
          },
        ];
      })
    : [];

  if (fromSearchResults.length > 0) {
    return fromSearchResults;
  }

  return Array.isArray(data.citations)
    ? data.citations.flatMap((url) =>
        typeof url === "string" && url.trim() !== "" ? [{ url }] : [],
      )
    : [];
}

const systemPrompt = [
  "You are a research assistant feeding a marketing-evidence pipeline.",
  "Answer ONLY from what your web search actually finds, and make every claim traceable:",
  "- When quoting buyer/customer language, quote VERBATIM, name the source site, and keep each quote next to the URL it came from.",
  "- When naming people, give full name + title + company exactly as the source states them, with the source URL.",
  "- When giving market figures (market size, CAGR, funding), name the publisher of each figure.",
  "- If the search finds nothing reliable, say so explicitly instead of generalizing.",
].join("\n");

export const perplexityResearchAgentTool = tool({
  description:
    "Perplexity citation-grounded web research (sonar-pro). Ask one specific research question; get a synthesized answer plus the source citations it traces to. Reads review sites that block direct scraping (G2, Capterra, Reddit), so use it for: verbatim buyer pain/success quotes with their URLs, named buyer personas (case-study champions, webinar speakers, named reviewers with title + company), and sourced market figures (market size, CAGR, competitor funding) with publishers. ALWAYS disambiguate the subject in the question with its domain and category (e.g. 'Anura.io, the ad-fraud detection platform' — never a bare brand name). Use the returned citation URLs as sourceUrl values; cite the underlying source, never Perplexity itself.",
  inputSchema: z
    .object({
      question: z
        .string()
        .min(12)
        .describe(
          "One specific research question, with the subject disambiguated by domain + category. Ask for verbatim quotes / named people / sourced figures explicitly.",
        ),
      domains: z
        .array(z.string().min(3))
        .max(maxDomainFilters)
        .optional()
        .describe(
          "Optional search domain allowlist (e.g. ['g2.com','capterra.com','reddit.com']) when the evidence must come from specific surfaces.",
        ),
      recency: z
        .enum(["month", "year", "any"])
        .default("any")
        .describe("Restrict search recency when freshness matters."),
    })
    .strict(),
  outputSchema: PerplexityResearchOutputSchema,
  execute: async ({ question, domains, recency }, { abortSignal }) => {
    const apiKey = process.env.PERPLEXITY_API_KEY;

    if (apiKey === undefined || apiKey.trim() === "") {
      return credentialGap("PERPLEXITY_API_KEY") as ToolGap;
    }

    try {
      const response = await timedFetch(perplexityBaseUrl, {
        method: "POST",
        abortSignal,
        timeoutMs: perplexityTimeoutMs,
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: perplexityModel,
          max_tokens: maxAnswerTokens,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: question },
          ],
          ...(domains !== undefined && domains.length > 0
            ? { search_domain_filter: domains.slice(0, maxDomainFilters) }
            : {}),
          ...(recency === "any"
            ? {}
            : { search_recency_filter: recency }),
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        return apiErrorGap(
          `Perplexity ${response.status}: ${body.slice(0, 200)}`,
        ) as ToolGap;
      }

      const data = (await response.json()) as PerplexityResponse;
      const content = data.choices?.[0]?.message?.content;

      if (typeof content !== "string" || content.trim() === "") {
        return apiErrorGap("Perplexity returned an empty answer") as ToolGap;
      }

      return {
        type: "result" as const,
        source: "Perplexity sonar-pro" as const,
        answer: content.trim(),
        citations: asCitations(data),
      };
    } catch (error) {
      return errorToGap(error, "Perplexity research failed");
    }
  },
});
