import { tool } from "ai";
import { z } from "zod";

import {
  ToolGapSchema,
  apiErrorGap,
  credentialGap,
  errorToGap,
  nonConsumingContentGap,
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
            acquisitionMode: z
              .enum(["serp_snippet", "review_body"])
              .optional(),
            title: z.string().min(1).optional(),
            reviewText: z.string().min(1).optional(),
            rating: z.number().nullable().optional(),
            date: z.string().min(1).optional(),
            reviewer: z.string().min(1).optional(),
            role: z.string().min(1).optional(),
          })
          .strict(),
      ),
    })
    .strict(),
  ToolGapSchema,
]);

interface SearchApiOrganicResult {
  title?: string;
  link?: string;
  snippet?: string;
}

interface ReviewSearchResult {
  acquisitionMode?: "serp_snippet" | "review_body";
  source: string;
  title?: string;
  url: string;
  snippet: string;
}

interface ReviewBodyExcerpt extends ReviewSearchResult {
  reviewText: string;
  rating?: number | null;
  date?: string;
  reviewer?: string;
  role?: string;
}

const firecrawlScrapeUrl = "https://api.firecrawl.dev/v2/scrape";
const reviewBodyScrapeTimeoutMs = 20_000;
const maxReviewBodiesPerPage = 4;
const reviewBodyMinChars = 40;

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

function normalizeReviewText(input: string): string {
  return input
    .replace(/\[[^\]]+\]\([^)]+\)/g, "")
    .replace(/[*_`>#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateReviewText(input: string): string {
  const normalized = normalizeReviewText(input);

  return normalized.length > 700 ? `${normalized.slice(0, 697)}...` : normalized;
}

function hasPainSignal(input: string): boolean {
  const lower = input.toLowerCase();
  const painSignals = [
    "annoy",
    "broken",
    "bug",
    "complain",
    "confusing",
    "difficult",
    "disappoint",
    "dislike",
    "doesn't",
    "expensive",
    "frustrat",
    "hard",
    "hate",
    "issue",
    "lack",
    "manual",
    "miss",
    "pain",
    "problem",
    "scattered",
    "slow",
    "support",
  ];

  return painSignals.some((signal) => lower.includes(signal));
}

function isProductReviewText(input: string): boolean {
  const lower = input.toLowerCase();
  const employmentSignals = [
    "applying for a job",
    "as an employee",
    "got fired",
    "got hired",
    "hiring process",
    "interview process",
    "job application",
    "job interview",
    "work environment",
    "working there",
  ];
  const productSignals = [
    "api",
    "app",
    "billing",
    "dashboard",
    "feature",
    "integration",
    "platform",
    "pricing",
    "product",
    "software",
    "subscription",
    "tool",
  ];
  const hasEmploymentSignal = employmentSignals.some((signal) =>
    lower.includes(signal),
  );

  return (
    !hasEmploymentSignal ||
    productSignals.some((signal) => lower.includes(signal))
  );
}

function reviewBodyExcerpt(input: {
  date?: string;
  rating?: number | null;
  reviewText: string;
  searchResult: ReviewSearchResult;
}): ReviewBodyExcerpt | null {
  const reviewText = truncateReviewText(input.reviewText);

  if (
    reviewText.length < reviewBodyMinChars ||
    !isProductReviewText(reviewText)
  ) {
    return null;
  }

  return {
    ...input.searchResult,
    acquisitionMode: "review_body",
    snippet: reviewText,
    reviewText,
    ...(input.rating === undefined ? {} : { rating: input.rating }),
    ...(input.date === undefined || input.date.length === 0
      ? {}
      : { date: input.date }),
  };
}

function extractTrustpilotReviewBodies(
  markdown: string,
  searchResult: ReviewSearchResult,
): ReviewBodyExcerpt[] {
  const blocks = markdown
    .split(/(?=Rated\s+\d\s+out of\s+5 stars)/i)
    .filter((block) => /^Rated\s+\d\s+out of\s+5 stars/i.test(block.trim()));
  const excerpts: ReviewBodyExcerpt[] = [];

  for (const block of blocks) {
    const ratingMatch = block.match(/Rated\s+(\d)\s+out of\s+5 stars/i);
    const rating = ratingMatch?.[1] ? Number(ratingMatch[1]) : null;

    if (rating !== null && rating > 3) {
      continue;
    }

    const textLines: string[] = [];
    let date = "";

    for (const line of block.split("\n").slice(1)) {
      const trimmed = line.trim();

      if (
        trimmed.length === 0 ||
        /^(Useful|Share|Flag|Reply from|Show reviews)/i.test(trimmed)
      ) {
        continue;
      }

      if (/Date of experience/i.test(trimmed)) {
        date = trimmed
          .replace(/Date of experience:?/i, "")
          .trim();
        continue;
      }

      if (trimmed.length > 15) {
        textLines.push(trimmed);
      }
    }

    const excerpt = reviewBodyExcerpt({
      date,
      rating,
      reviewText: textLines.join(" "),
      searchResult,
    });

    if (excerpt !== null) {
      excerpts.push(excerpt);
    }

    if (excerpts.length >= maxReviewBodiesPerPage) {
      break;
    }
  }

  return excerpts;
}

function extractG2ReviewBodies(
  markdown: string,
  searchResult: ReviewSearchResult,
): ReviewBodyExcerpt[] {
  const sections = markdown.split(
    /(?=What do you (?:dislike|like)|What problems are you solving)/i,
  );
  const excerpts: ReviewBodyExcerpt[] = [];

  for (const section of sections) {
    const isPainSection =
      /^What do you dislike/i.test(section) ||
      /^What problems are you solving/i.test(section);

    if (!isPainSection) {
      continue;
    }

    const textLines: string[] = [];

    for (const line of section.split("\n").slice(1)) {
      const trimmed = line.trim();

      if (
        /^(What do you|What problems|Review collected|Show More|Validated Reviewer|Response from)/i.test(
          trimmed,
        )
      ) {
        break;
      }

      if (
        trimmed.length > 10 &&
        !trimmed.startsWith("#") &&
        !trimmed.startsWith("[") &&
        !/^N\/A(?:\s|$)/i.test(trimmed)
      ) {
        textLines.push(trimmed);
      }
    }

    const excerpt = reviewBodyExcerpt({
      rating: null,
      reviewText: textLines
        .join(" ")
        .replace(/\s*Review collected by and hosted on G2\.com\.?\s*/gi, ""),
      searchResult,
    });

    if (excerpt !== null) {
      excerpts.push(excerpt);
    }

    if (excerpts.length >= maxReviewBodiesPerPage) {
      break;
    }
  }

  return excerpts;
}

function extractGenericReviewBodies(
  markdown: string,
  searchResult: ReviewSearchResult,
): ReviewBodyExcerpt[] {
  const paragraphs = markdown
    .split(/\n{2,}|(?=^#{1,4}\s+)/m)
    .map((paragraph) => normalizeReviewText(paragraph))
    .filter(
      (paragraph) =>
        paragraph.length >= reviewBodyMinChars &&
        paragraph.length <= 1_200 &&
        hasPainSignal(paragraph),
    );
  const seen = new Set<string>();
  const excerpts: ReviewBodyExcerpt[] = [];

  for (const paragraph of paragraphs) {
    const key = paragraph.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    const excerpt = reviewBodyExcerpt({
      reviewText: paragraph,
      searchResult,
    });

    if (excerpt !== null) {
      excerpts.push(excerpt);
    }

    if (excerpts.length >= maxReviewBodiesPerPage) {
      break;
    }
  }

  return excerpts;
}

function extractReviewBodies(
  markdown: string,
  searchResult: ReviewSearchResult,
): ReviewBodyExcerpt[] {
  if (searchResult.source === "Trustpilot") {
    return extractTrustpilotReviewBodies(markdown, searchResult);
  }

  if (searchResult.source === "G2") {
    return extractG2ReviewBodies(markdown, searchResult);
  }

  return extractGenericReviewBodies(markdown, searchResult);
}

async function scrapeReviewBodies(input: {
  abortSignal?: AbortSignal;
  apiKey: string;
  searchResult: ReviewSearchResult;
}): Promise<ReviewBodyExcerpt[]> {
  const response = await timedFetch(firecrawlScrapeUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      blockAds: true,
      formats: ["markdown"],
      onlyMainContent: true,
      url: input.searchResult.url,
    }),
    abortSignal: input.abortSignal,
    timeoutMs: reviewBodyScrapeTimeoutMs,
  });

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as {
    data?: {
      markdown?: string;
      metadata?: { sourceURL?: string; title?: string };
    };
  };
  const markdown = data.data?.markdown ?? "";

  if (markdown.trim().length < reviewBodyMinChars) {
    return [];
  }

  const sourceUrl = data.data?.metadata?.sourceURL;
  const sourceTitle = data.data?.metadata?.title;
  const searchResult = {
    ...input.searchResult,
    ...(sourceUrl === undefined ? {} : { url: sourceUrl }),
    ...(sourceTitle === undefined ? {} : { title: sourceTitle }),
  };

  return extractReviewBodies(markdown, searchResult);
}

function buildSnippetExcerpts(
  searchResults: readonly ReviewSearchResult[],
): ReviewSearchResult[] {
  return searchResults.map((result) => ({
    acquisitionMode: "serp_snippet",
    source: result.source,
    url: result.url,
    snippet: result.snippet,
    ...(result.title === undefined ? {} : { title: result.title }),
  }));
}

async function buildBodyExcerpts(input: {
  abortSignal?: AbortSignal;
  brand: string;
  firecrawlApiKey: string;
  maxBodyPages: number;
  searchResults: readonly ReviewSearchResult[];
}): Promise<ReviewBodyExcerpt[] | ToolGap> {
  const bodyResults = await Promise.allSettled(
    input.searchResults.slice(0, input.maxBodyPages).map((searchResult) =>
      scrapeReviewBodies({
        abortSignal: input.abortSignal,
        apiKey: input.firecrawlApiKey,
        searchResult,
      }),
    ),
  );
  const bodyExcerpts = bodyResults.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );

  if (bodyExcerpts.length > 0) {
    return bodyExcerpts;
  }

  return nonConsumingContentGap(
    `Reviews body mode found no usable Firecrawl review bodies for brand=${input.brand} searchResults=${input.searchResults.length} maxBodyPages=${input.maxBodyPages}.`,
  );
}

export const reviewsAgentTool = tool({
  description:
    "SearchAPI Google SERP snippets from review/forum domains, with optional Firecrawl review-body scraping; not direct G2, Capterra, or Trustpilot APIs.",
  inputSchema: z
    .object({
      brand: z.string().min(1),
      max_results: z.number().int().positive().default(8),
      max_body_pages: z.number().int().positive().default(3),
      mode: z.enum(["snippets", "bodies"]).default("snippets"),
    })
    .strict(),
  outputSchema: ReviewsOutputSchema,
  execute: async (
    { brand, max_body_pages = 3, max_results = 8, mode = "snippets" },
    { abortSignal },
  ) => {
    const apiKey = process.env.SEARCHAPI_KEY;

    if (apiKey === undefined || apiKey.trim() === "") {
      return credentialGap("SEARCHAPI_KEY") as ToolGap;
    }

    const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;

    if (
      mode === "bodies" &&
      (firecrawlApiKey === undefined || firecrawlApiKey.trim() === "")
    ) {
      return credentialGap("FIRECRAWL_API_KEY") as ToolGap;
    }

    try {
      const query =
        mode === "bodies"
          ? `${brand} reviews complaints pain points (site:g2.com OR site:capterra.com OR site:trustpilot.com OR site:reddit.com OR site:news.ycombinator.com)`
          : `${brand} reviews (site:g2.com OR site:capterra.com OR site:trustpilot.com)`;
      const url = `https://www.searchapi.io/api/v1/search?engine=google&q=${encodeURIComponent(
        query,
      )}&num=${max_results}&api_key=${apiKey}`;
      const response = await timedFetch(url, { abortSignal, timeoutMs: 15_000 });

      if (!response.ok) {
        return apiErrorGap(`SearchAPI ${response.status}`) as ToolGap;
      }

      const data = (await response.json()) as {
        organic_results?: SearchApiOrganicResult[];
      };
      const searchResults: ReviewSearchResult[] = (data.organic_results ?? [])
        .filter(
          (result) =>
            result.link !== undefined &&
            result.link.length > 0 &&
            result.snippet !== undefined &&
            result.snippet.length > 0,
        )
        .map((result) => ({
          source: deriveReviewSource(result.link ?? ""),
          ...(result.title === undefined ? {} : { title: result.title }),
          url: result.link ?? "",
          snippet: result.snippet ?? "",
        }));
      if (mode === "bodies") {
        const excerpts = await buildBodyExcerpts({
          abortSignal,
          brand,
          firecrawlApiKey: firecrawlApiKey ?? "",
          maxBodyPages: Math.min(max_body_pages, max_results),
          searchResults,
        });

        if (!Array.isArray(excerpts)) {
          return excerpts;
        }

        return { type: "result" as const, brand, excerpts };
      }

      const excerpts = buildSnippetExcerpts(searchResults);

      return { type: "result" as const, brand, excerpts };
    } catch (error) {
      return errorToGap(error, "Reviews fetch failed");
    }
  },
});
