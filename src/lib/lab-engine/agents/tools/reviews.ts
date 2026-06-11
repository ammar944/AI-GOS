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

const reviewAcquisitionModes = [
  "serp_snippet",
  "review_body",
  "forum_comment",
  "support_thread",
] as const;

const reviewAcquisitionGapReasons = [
  "api_error",
  "blocked_js_challenge",
  "empty_markdown",
  "parser_no_match",
  "not_independent",
  "not_product_review",
] as const;

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
            acquisitionMode: z.enum(reviewAcquisitionModes).optional(),
            title: z.string().min(1).optional(),
            reviewText: z.string().min(1).optional(),
            rating: z.number().nullable().optional(),
            date: z.string().min(1).optional(),
            reviewer: z.string().min(1).optional(),
            role: z.string().min(1).optional(),
            sourceInstanceId: z.string().min(1).optional(),
          })
          .strict(),
      ),
      attempts: z
        .array(
          z
            .object({
              url: z.string().min(1),
              domain: z.string().min(1),
              source: z.string().min(1),
              acquisitionMode: z.enum(reviewAcquisitionModes),
              status: z.enum(["succeeded", "failed"]),
              gapReason: z.enum(reviewAcquisitionGapReasons).optional(),
              message: z.string().min(1).optional(),
              title: z.string().min(1).optional(),
            })
            .strict(),
        )
        .optional(),
    })
    .strict(),
  ToolGapSchema,
]);

export const ReviewsInputSchema = z
  .object({
    brand: z.string().min(1),
    max_results: z.number().int().positive().default(8),
    max_body_pages: z.number().int().positive().default(3),
    mode: z.enum(["snippets", "bodies"]).default("snippets"),
  })
  .strict();

type ReviewsInput = z.infer<typeof ReviewsInputSchema>;
type ReviewsOutput = z.infer<typeof ReviewsOutputSchema>;

interface SearchApiOrganicResult {
  title?: string;
  link?: string;
  snippet?: string;
}

type ReviewAcquisitionMode = (typeof reviewAcquisitionModes)[number];
type ReviewAcquisitionGapReason =
  (typeof reviewAcquisitionGapReasons)[number];

interface ReviewSearchResult {
  acquisitionMode?: ReviewAcquisitionMode;
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
  sourceInstanceId?: string;
}

interface ReviewAcquisitionAttempt {
  acquisitionMode: ReviewAcquisitionMode;
  domain: string;
  gapReason?: ReviewAcquisitionGapReason;
  message?: string;
  source: string;
  status: "succeeded" | "failed";
  title?: string;
  url: string;
}

interface ScrapeReviewBodiesResult {
  attempts: ReviewAcquisitionAttempt[];
  excerpts: ReviewBodyExcerpt[];
}

interface RankedReviewSearchResult {
  index: number;
  result: ReviewSearchResult;
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

// W5 traceable-quote upgrade: a quote must point at the SPECIFIC review, not a
// 50-review index page. These patterns recognize per-review permalinks on the
// three structured platforms — used to (a) rank permalink SERP hits into the
// scrape budget first and (b) attach the owning review's permalink to each
// excerpt parsed off a scraped page.
const reviewPermalinkPatternSources = [
  String.raw`https?://(?:www\.)?g2\.com/products/[a-z0-9_-]+/reviews/[a-z0-9_-]*review-\d+[a-z0-9/_#?=&-]*`,
  String.raw`https?://(?:www\.)?g2\.com/survey_responses/[a-z0-9_-]+`,
  String.raw`https?://(?:www\.)?capterra\.com/p/\d+/[a-zA-Z0-9_-]+/reviews/\d+/?`,
  String.raw`https?://(?:www\.)?trustpilot\.com/reviews/[a-f0-9]{16,}`,
];

export function isReviewPermalinkUrl(url: string): boolean {
  return reviewPermalinkPatternSources.some((source) =>
    new RegExp(source, "i").test(url),
  );
}

// Review cards on G2/Capterra/Trustpilot open with the review-title anchor, so
// the permalink that OWNS a parsed block is the last permalink anchor before
// the block's offset. Bounded distance guards against inheriting an anchor
// from a far-away region; null falls back to the scraped page URL (current
// behavior — honest but vague), never a guessed neighbor.
const maxPermalinkAnchorDistanceChars = 6_000;

function buildReviewPermalinkResolver(
  markdown: string,
  pageUrl: string,
): (offset: number) => string | null {
  if (isReviewPermalinkUrl(pageUrl)) {
    return () => pageUrl;
  }

  const pattern = new RegExp(reviewPermalinkPatternSources.join("|"), "gi");
  const anchors = Array.from(markdown.matchAll(pattern), (match) => ({
    index: match.index ?? 0,
    url: match[0],
  }));

  return (offset: number): string | null => {
    let owner: { index: number; url: string } | null = null;

    for (const anchor of anchors) {
      if (anchor.index >= offset) {
        break;
      }

      owner = anchor;
    }

    return owner !== null &&
      offset - owner.index <= maxPermalinkAnchorDistanceChars
      ? owner.url
      : null;
  };
}

function withReviewPermalink(
  searchResult: ReviewSearchResult,
  permalink: string | null,
): ReviewSearchResult {
  return permalink === null || permalink === searchResult.url
    ? searchResult
    : { ...searchResult, url: permalink };
}

function getReviewBodyScrapePriority(result: ReviewSearchResult): number {
  if (
    result.source === "G2" ||
    result.source === "Capterra" ||
    result.source === "Trustpilot"
  ) {
    // A SERP hit that IS a review permalink yields born-traceable excerpts —
    // spend the scrape budget there before platform index pages.
    return isReviewPermalinkUrl(result.url) ? -1 : 0;
  }

  const acquisitionMode =
    result.acquisitionMode ?? getAcquisitionModeForUrl(result.url);

  if (acquisitionMode === "review_body") {
    return 1;
  }

  if (acquisitionMode === "support_thread") {
    return 2;
  }

  return 3;
}

function rankReviewSearchResultsForBodyScrape(
  searchResults: readonly ReviewSearchResult[],
): ReviewSearchResult[] {
  return searchResults
    .map(
      (result, index): RankedReviewSearchResult => ({
        index,
        result,
      }),
    )
    .sort((left, right) => {
      const priorityDelta =
        getReviewBodyScrapePriority(left.result) -
        getReviewBodyScrapePriority(right.result);

      return priorityDelta === 0 ? left.index - right.index : priorityDelta;
    })
    .map(({ result }) => result);
}

function getDomain(input: string): string {
  try {
    return new URL(input).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "unknown";
  }
}

function getAcquisitionModeForUrl(url: string): ReviewAcquisitionMode {
  const domain = getDomain(url);

  if (
    domain === "reddit.com" ||
    domain.endsWith(".reddit.com") ||
    domain === "news.ycombinator.com"
  ) {
    return "forum_comment";
  }

  if (
    domain.includes("community") ||
    domain.includes("support") ||
    domain.includes("help") ||
    /\/(?:community|forum|support|questions?|threads?)\//i.test(url)
  ) {
    return "support_thread";
  }

  return "review_body";
}

function createAttempt(input: {
  gapReason?: ReviewAcquisitionGapReason;
  message?: string;
  searchResult: ReviewSearchResult;
  status: ReviewAcquisitionAttempt["status"];
}): ReviewAcquisitionAttempt {
  return {
    acquisitionMode:
      input.searchResult.acquisitionMode ??
      getAcquisitionModeForUrl(input.searchResult.url),
    domain: getDomain(input.searchResult.url),
    ...(input.gapReason === undefined ? {} : { gapReason: input.gapReason }),
    ...(input.message === undefined ? {} : { message: input.message }),
    source: input.searchResult.source,
    status: input.status,
    ...(input.searchResult.title === undefined
      ? {}
      : { title: input.searchResult.title }),
    url: input.searchResult.url,
  };
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

function hashText(input: string): string {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
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

// Buyer-voice gate. Job postings, ATS pages, and first-party marketing copy are
// NOT buyer pain language even when they mention the product, so they are hard
// rejects (a product noun no longer rescues employment/marketing text).
export function isProductReviewText(input: string): boolean {
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
  const jobPostingSignals = [
    "responsibilities",
    "qualifications",
    "we are looking for",
    "we're looking for",
    "apply now",
    "years of experience",
    "equal opportunity employer",
    "what you'll do",
    "about the role",
  ];
  const marketingSignals = [
    "our platform",
    "sign up today",
    "request a demo",
    "book a demo",
    "get started for free",
    "trusted by",
  ];
  const nonBuyerVoiceSignals = [
    ...employmentSignals,
    ...jobPostingSignals,
    ...marketingSignals,
  ];

  return !nonBuyerVoiceSignals.some((signal) => lower.includes(signal));
}

function reviewBodyExcerpt(input: {
  acquisitionMode: ReviewAcquisitionMode;
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
    acquisitionMode: input.acquisitionMode,
    snippet: reviewText,
    reviewText,
    sourceInstanceId: `${getDomain(input.searchResult.url)}:${hashText(reviewText)}`,
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
  const resolvePermalink = buildReviewPermalinkResolver(
    markdown,
    searchResult.url,
  );
  const blockStarts = Array.from(
    markdown.matchAll(/Rated\s+\d\s+out of\s+5 stars/gi),
    (match) => match.index ?? 0,
  );
  const excerpts: ReviewBodyExcerpt[] = [];

  for (let blockIndex = 0; blockIndex < blockStarts.length; blockIndex += 1) {
    const blockStart = blockStarts[blockIndex] ?? 0;
    const block = markdown.slice(
      blockStart,
      blockStarts[blockIndex + 1] ?? markdown.length,
    );
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
      acquisitionMode: getAcquisitionModeForUrl(searchResult.url),
      date,
      rating,
      reviewText: textLines.join(" "),
      searchResult: withReviewPermalink(
        searchResult,
        resolvePermalink(blockStart),
      ),
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
  // Offset-aware section scan (same chunks the old lookahead split produced):
  // each review card's title anchor precedes its question headings, so the
  // section's start offset resolves to the owning review's permalink.
  const resolvePermalink = buildReviewPermalinkResolver(
    markdown,
    searchResult.url,
  );
  const sectionStarts = Array.from(
    markdown.matchAll(/What do you (?:dislike|like)|What problems are you solving/gi),
    (match) => match.index ?? 0,
  );
  const excerpts: ReviewBodyExcerpt[] = [];

  for (let sectionIndex = 0; sectionIndex < sectionStarts.length; sectionIndex += 1) {
    const sectionStart = sectionStarts[sectionIndex] ?? 0;
    const section = markdown.slice(
      sectionStart,
      sectionStarts[sectionIndex + 1] ?? markdown.length,
    );
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
      acquisitionMode: getAcquisitionModeForUrl(searchResult.url),
      rating: null,
      reviewText: textLines
        .join(" ")
        .replace(/\s*Review collected by and hosted on G2\.com\.?\s*/gi, ""),
      searchResult: withReviewPermalink(
        searchResult,
        resolvePermalink(sectionStart),
      ),
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

function normalizeCapterraHeading(input: string): string {
  return input
    .replace(/^#{1,6}\s*/, "")
    .replace(/[*_`>#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isCapterraNegativeHeading(input: string): boolean {
  return /^(?:Cons|Overall)\s*:|^What (?:did|do) you (?:like least|dislike)\b|^What could be (?:better|improved)\b|^What problems\b|^Reasons for Switching\b|^Why did you switch\b/i.test(
    normalizeCapterraHeading(input),
  );
}

function isCapterraSectionBoundary(input: string): boolean {
  const heading = normalizeCapterraHeading(input);

  return (
    isCapterraNegativeHeading(heading) ||
    /^(?:Pros)\s*:|^What (?:did|do) you like (?:best|most)\b|^What do you like about\b|^Recommendations?\b|^Review Source\b|^Show More\b|^Read more\b|^Vendor Response\b/i.test(
      heading,
    )
  );
}

function getCapterraInlineHeadingText(input: string): string | null {
  const heading = normalizeCapterraHeading(input);
  const inlineMatch = heading.match(/^(?:Cons|Overall)\s*:\s*(.+)$/i);

  if (inlineMatch?.[1] === undefined) {
    return null;
  }

  const inlineText = inlineMatch[1].trim();
  return inlineText.length === 0 ? null : inlineText;
}

function extractCapterraReviewBodies(
  markdown: string,
  searchResult: ReviewSearchResult,
): ReviewBodyExcerpt[] {
  const resolvePermalink = buildReviewPermalinkResolver(
    markdown,
    searchResult.url,
  );
  const lines = markdown.split("\n");
  // Char offset of each line start, so a Cons/Overall heading can resolve the
  // owning review's permalink anchor (review cards open with their anchor).
  const lineOffsets: number[] = [];
  let lineOffset = 0;

  for (const line of lines) {
    lineOffsets.push(lineOffset);
    lineOffset += line.length + 1;
  }

  const excerpts: ReviewBodyExcerpt[] = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex] ?? "";

    if (!isCapterraNegativeHeading(line)) {
      continue;
    }

    const textLines: string[] = [];
    const inlineText = getCapterraInlineHeadingText(line);
    if (inlineText !== null) {
      textLines.push(inlineText);
    }

    for (
      let bodyLineIndex = lineIndex + 1;
      bodyLineIndex < lines.length;
      bodyLineIndex += 1
    ) {
      const bodyLine = lines[bodyLineIndex] ?? "";
      const trimmed = normalizeCapterraHeading(bodyLine);

      if (trimmed.length === 0) {
        continue;
      }

      if (isCapterraSectionBoundary(trimmed)) {
        break;
      }

      textLines.push(trimmed);
    }

    const excerpt = reviewBodyExcerpt({
      acquisitionMode: "review_body",
      rating: null,
      reviewText: textLines.join(" "),
      searchResult: withReviewPermalink(
        searchResult,
        resolvePermalink(lineOffsets[lineIndex] ?? 0),
      ),
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

function extractForumCommentBodies(
  markdown: string,
  searchResult: ReviewSearchResult,
): ReviewBodyExcerpt[] {
  const comments = markdown
    .split(/\n{2,}|(?=^\s*(?:[-*]\s*)?(?:comment|reply|user|points|\d+\s+points)\b)/im)
    .map((comment) =>
      normalizeReviewText(
        comment.replace(/^\s*(?:[-*]\s*)?(?:comment|reply|user|points|\d+\s+points)[:\s-]*/i, ""),
      ),
    )
    .filter(
      (comment) =>
        comment.length >= reviewBodyMinChars &&
        comment.length <= 1_200 &&
        hasPainSignal(comment),
    );
  const seen = new Set<string>();
  const excerpts: ReviewBodyExcerpt[] = [];

  for (const comment of comments) {
    const key = comment.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const excerpt = reviewBodyExcerpt({
      acquisitionMode: "forum_comment",
      reviewText: comment,
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

function extractSupportThreadBodies(
  markdown: string,
  searchResult: ReviewSearchResult,
): ReviewBodyExcerpt[] {
  return extractGenericReviewBodies(markdown, {
    ...searchResult,
    acquisitionMode: "support_thread",
  });
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
      acquisitionMode:
        searchResult.acquisitionMode ?? getAcquisitionModeForUrl(searchResult.url),
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
  // Structured selectors are the high-precision first pass. When a review-domain
  // page scrapes successfully but its layout has drifted (parser_no_match), fall
  // through to the generic pain-signal paragraph extractor for recall rather
  // than dropping a perfectly-scraped page. The pain-signal + isProductReviewText
  // guards keep the fallback from promoting nav/marketing chrome.
  if (searchResult.source === "Trustpilot") {
    const structured = extractTrustpilotReviewBodies(markdown, searchResult);
    if (structured.length > 0) {
      return structured;
    }
    return extractGenericReviewBodies(markdown, {
      ...searchResult,
      acquisitionMode: "review_body",
    });
  }

  if (searchResult.source === "G2") {
    const structured = extractG2ReviewBodies(markdown, searchResult);
    if (structured.length > 0) {
      return structured;
    }
    return extractGenericReviewBodies(markdown, {
      ...searchResult,
      acquisitionMode: "review_body",
    });
  }

  if (searchResult.source === "Capterra") {
    const structured = extractCapterraReviewBodies(markdown, searchResult);
    if (structured.length > 0) {
      return structured;
    }
    return extractGenericReviewBodies(markdown, {
      ...searchResult,
      acquisitionMode: "review_body",
    });
  }

  const acquisitionMode =
    searchResult.acquisitionMode ?? getAcquisitionModeForUrl(searchResult.url);
  if (acquisitionMode === "forum_comment") {
    return extractForumCommentBodies(markdown, {
      ...searchResult,
      acquisitionMode,
    });
  }
  if (acquisitionMode === "support_thread") {
    return extractSupportThreadBodies(markdown, {
      ...searchResult,
      acquisitionMode,
    });
  }

  return extractGenericReviewBodies(markdown, searchResult);
}

function isBlockedPage(markdown: string): boolean {
  return /(?:captcha|cloudflare|enable javascript|just a moment|verify you are human|access denied|unusual traffic)/i.test(
    markdown,
  );
}

function isRedditUrl(url: string): boolean {
  const domain = getDomain(url);
  return domain === "reddit.com" || domain.endsWith(".reddit.com");
}

function buildRedditJsonUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    const path = url.pathname.endsWith("/")
      ? url.pathname
      : `${url.pathname}/`;
    return `https://www.reddit.com${path}.json?raw_json=1&limit=50`;
  } catch {
    return null;
  }
}

function readRedditListingChildren(listing: unknown): unknown[] {
  if (typeof listing !== "object" || listing === null) {
    return [];
  }
  const data = (listing as { data?: unknown }).data;
  if (typeof data !== "object" || data === null) {
    return [];
  }
  const children = (data as { children?: unknown }).children;
  return Array.isArray(children) ? children : [];
}

function readRedditChildText(
  child: unknown,
  field: "body" | "selftext",
): string | null {
  if (typeof child !== "object" || child === null) {
    return null;
  }
  const data = (child as { data?: unknown }).data;
  if (typeof data !== "object" || data === null) {
    return null;
  }
  const value = (data as Record<string, unknown>)[field];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function extractRedditJsonTexts(payload: unknown): string[] {
  if (!Array.isArray(payload) || payload.length < 2) {
    return [];
  }
  const texts: string[] = [];
  const postChildren = readRedditListingChildren(payload[0]);
  const postText =
    postChildren.length > 0
      ? readRedditChildText(postChildren[0], "selftext")
      : null;
  if (postText !== null) {
    texts.push(postText);
  }
  for (const child of readRedditListingChildren(payload[1])) {
    const body = readRedditChildText(child, "body");
    if (body !== null) {
      texts.push(body);
    }
  }
  return texts;
}

// Firecrawl is anti-bot blocked / 403'd on reddit.com (INFRA limitation of the
// Firecrawl plan). The code-fixable recovery is to fetch reddit bodies via
// Reddit's own public JSON API, which needs no Firecrawl. Reddit 403s a default
// User-Agent, so a custom one is required.
async function fetchRedditJsonBodies(input: {
  abortSignal?: AbortSignal;
  searchResult: ReviewSearchResult;
}): Promise<ScrapeReviewBodiesResult> {
  const baseSearchResult: ReviewSearchResult = {
    ...input.searchResult,
    acquisitionMode: "forum_comment",
  };
  const jsonUrl = buildRedditJsonUrl(input.searchResult.url);
  if (jsonUrl === null) {
    return {
      attempts: [
        createAttempt({
          gapReason: "parser_no_match",
          searchResult: baseSearchResult,
          status: "failed",
        }),
      ],
      excerpts: [],
    };
  }

  let payload: unknown;
  try {
    const response = await timedFetch(jsonUrl, {
      headers: { "User-Agent": "aigos-research/1.0" },
      abortSignal: input.abortSignal,
      timeoutMs: reviewBodyScrapeTimeoutMs,
    });
    if (!response.ok) {
      return {
        attempts: [
          createAttempt({
            gapReason: "api_error",
            message: `Reddit JSON status ${response.status}`,
            searchResult: baseSearchResult,
            status: "failed",
          }),
        ],
        excerpts: [],
      };
    }
    payload = await response.json();
  } catch (error) {
    return {
      attempts: [
        createAttempt({
          gapReason: "api_error",
          message:
            error instanceof Error ? error.message : "reddit json fetch failed",
          searchResult: baseSearchResult,
          status: "failed",
        }),
      ],
      excerpts: [],
    };
  }

  const seen = new Set<string>();
  const excerpts: ReviewBodyExcerpt[] = [];
  for (const text of extractRedditJsonTexts(payload)) {
    const excerpt = reviewBodyExcerpt({
      acquisitionMode: "forum_comment",
      reviewText: text,
      searchResult: baseSearchResult,
    });
    if (excerpt === null) {
      continue;
    }
    const key = excerpt.sourceInstanceId ?? excerpt.reviewText;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    excerpts.push(excerpt);
    if (excerpts.length >= maxReviewBodiesPerPage) {
      break;
    }
  }

  return {
    attempts: [
      createAttempt({
        gapReason: excerpts.length === 0 ? "parser_no_match" : undefined,
        searchResult: baseSearchResult,
        status: excerpts.length === 0 ? "failed" : "succeeded",
      }),
    ],
    excerpts,
  };
}

async function scrapeReviewBodies(input: {
  abortSignal?: AbortSignal;
  apiKey: string;
  searchResult: ReviewSearchResult;
}): Promise<ScrapeReviewBodiesResult> {
  const baseSearchResult = {
    ...input.searchResult,
    acquisitionMode:
      input.searchResult.acquisitionMode ??
      getAcquisitionModeForUrl(input.searchResult.url),
  };
  const response = await timedFetch(firecrawlScrapeUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      blockAds: true,
      formats: ["markdown"],
      location: {
        country: "US",
        languages: ["en-US"],
      },
      onlyMainContent: true,
      proxy: "auto",
      timeout: reviewBodyScrapeTimeoutMs,
      url: input.searchResult.url,
      waitFor: 1_000,
    }),
    abortSignal: input.abortSignal,
    timeoutMs: reviewBodyScrapeTimeoutMs,
  });

  if (!response.ok) {
    if (isRedditUrl(baseSearchResult.url)) {
      return fetchRedditJsonBodies({
        abortSignal: input.abortSignal,
        searchResult: baseSearchResult,
      });
    }
    return {
      attempts: [
        createAttempt({
          gapReason: "api_error",
          message: `Firecrawl scrape status ${response.status}`,
          searchResult: baseSearchResult,
          status: "failed",
        }),
      ],
      excerpts: [],
    };
  }

  const data = (await response.json()) as {
    data?: {
      markdown?: string;
      metadata?: { sourceURL?: string; title?: string };
    };
  };
  const markdown = data.data?.markdown ?? "";

  if (markdown.trim().length < reviewBodyMinChars) {
    if (isRedditUrl(baseSearchResult.url)) {
      return fetchRedditJsonBodies({
        abortSignal: input.abortSignal,
        searchResult: baseSearchResult,
      });
    }
    return {
      attempts: [
        createAttempt({
          gapReason: "empty_markdown",
          searchResult: baseSearchResult,
          status: "failed",
        }),
      ],
      excerpts: [],
    };
  }

  if (isBlockedPage(markdown)) {
    if (isRedditUrl(baseSearchResult.url)) {
      return fetchRedditJsonBodies({
        abortSignal: input.abortSignal,
        searchResult: baseSearchResult,
      });
    }
    return {
      attempts: [
        createAttempt({
          gapReason: "blocked_js_challenge",
          searchResult: baseSearchResult,
          status: "failed",
        }),
      ],
      excerpts: [],
    };
  }

  const sourceUrl = data.data?.metadata?.sourceURL;
  const sourceTitle = data.data?.metadata?.title;
  const searchResult = {
    ...baseSearchResult,
    ...(sourceUrl === undefined ? {} : { url: sourceUrl }),
    ...(sourceTitle === undefined ? {} : { title: sourceTitle }),
  };
  const excerpts = extractReviewBodies(markdown, searchResult);

  return {
    attempts: [
      createAttempt({
        gapReason: excerpts.length === 0 ? "parser_no_match" : undefined,
        searchResult,
        status: excerpts.length === 0 ? "failed" : "succeeded",
      }),
    ],
    excerpts,
  };
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
  firecrawlApiKey: string;
  maxBodyPages: number;
  searchResults: readonly ReviewSearchResult[];
}): Promise<ScrapeReviewBodiesResult> {
  const rankedSearchResults = rankReviewSearchResultsForBodyScrape(
    input.searchResults,
  );
  const bodyResults = await Promise.allSettled(
    rankedSearchResults.slice(0, input.maxBodyPages).map((searchResult) =>
      scrapeReviewBodies({
        abortSignal: input.abortSignal,
        apiKey: input.firecrawlApiKey,
        searchResult,
      }),
    ),
  );
  const fulfilledResults = bodyResults.flatMap((result) =>
    result.status === "fulfilled"
      ? [result.value]
      : [
          {
            attempts: [],
            excerpts: [],
          } satisfies ScrapeReviewBodiesResult,
        ],
  );
  const bodyExcerpts = fulfilledResults.flatMap((result) => result.excerpts);
  const attempts = fulfilledResults.flatMap((result) => result.attempts);

  return { attempts, excerpts: bodyExcerpts };
}

export const reviewsAgentTool = tool<ReviewsInput, ReviewsOutput>({
  description:
    "SearchAPI Google SERP snippets from review/forum domains, with optional Firecrawl review-body scraping; not direct G2, Capterra, or Trustpilot APIs.",
  inputSchema: ReviewsInputSchema,
  outputSchema: ReviewsOutputSchema,
  execute: async (
    { brand, max_body_pages = 3, max_results = 8, mode = "snippets" },
    { abortSignal },
  ): Promise<ReviewsOutput> => {
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
            (mode === "bodies" ||
              (result.snippet !== undefined && result.snippet.length > 0)),
        )
        .map((result) => ({
          acquisitionMode: getAcquisitionModeForUrl(result.link ?? ""),
          source: deriveReviewSource(result.link ?? ""),
          ...(result.title === undefined ? {} : { title: result.title }),
          url: result.link ?? "",
          snippet:
            result.snippet ??
            "SearchAPI discovered this URL without a snippet; body acquisition required before quote promotion.",
        }));
      if (mode === "bodies") {
        const bodyResult = await buildBodyExcerpts({
          abortSignal,
          firecrawlApiKey: firecrawlApiKey ?? "",
          maxBodyPages: Math.min(max_body_pages, max_results),
          searchResults,
        });

        if (bodyResult.excerpts.length === 0 && bodyResult.attempts.length === 0) {
          return nonConsumingContentGap(
            `Reviews body mode found no usable Firecrawl review bodies for brand=${brand} searchResults=${searchResults.length} maxBodyPages=${max_body_pages}.`,
          );
        }

        return {
          type: "result" as const,
          brand,
          attempts: bodyResult.attempts,
          excerpts: bodyResult.excerpts,
        };
      }

      const excerpts = buildSnippetExcerpts(searchResults);

      return { type: "result" as const, brand, excerpts };
    } catch (error) {
      return errorToGap(error, "Reviews fetch failed");
    }
  },
});
