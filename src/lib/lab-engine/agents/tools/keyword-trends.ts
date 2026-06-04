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

const searchApiBaseUrl = "https://www.searchapi.io/api/v1/search";
const maxTrendKeywords = 5;

const KeywordTrendPointSchema = z
  .object({
    date: z.string().min(1),
    value: z.number().finite().nonnegative(),
  })
  .strict();

const KeywordTrendSchema = z
  .object({
    keyword: z.string().min(1),
    averageInterest: z.number().finite().nonnegative(),
    peakInterest: z.number().finite().nonnegative(),
    trendDirection: z.enum(["rising", "stable", "declining", "no_data"]),
    sourceTitle: z.literal("SearchAPI Google Trends"),
    sourceUrl: z.string().url(),
    dateObserved: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
    timeline: z.array(KeywordTrendPointSchema),
  })
  .strict();

export const KeywordTrendsOutputSchema = z.union([
  z
    .object({
      type: z.literal("result"),
      source: z.literal("SearchAPI Google Trends"),
      keywords: z.array(KeywordTrendSchema),
    })
    .strict(),
  ToolGapSchema,
]);

interface SearchApiTrendValue {
  query?: unknown;
  value?: unknown;
  extracted_value?: unknown;
}

interface SearchApiTrendPoint {
  date?: unknown;
  timestamp?: unknown;
  values?: unknown;
}

interface SearchApiTrendAverage {
  query?: unknown;
  value?: unknown;
  extracted_value?: unknown;
}

interface SearchApiTrendsResponse {
  interest_over_time?: {
    averages?: unknown;
    timeline_data?: unknown;
  };
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeKeyword(value: string): string {
  return value.trim().toLowerCase();
}

function getNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getTrendValue(value: SearchApiTrendValue): number | null {
  return getNumber(value.extracted_value) ?? getNumber(value.value);
}

function getPointDate(point: SearchApiTrendPoint): string {
  if (typeof point.date === "string" && point.date.trim().length > 0) {
    return point.date;
  }

  if (typeof point.timestamp === "string" && point.timestamp.trim().length > 0) {
    return point.timestamp;
  }

  return "unknown";
}

function asTrendValues(value: unknown): SearchApiTrendValue[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is SearchApiTrendValue => {
    return typeof item === "object" && item !== null && !Array.isArray(item);
  });
}

function asTrendPoints(value: unknown): SearchApiTrendPoint[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is SearchApiTrendPoint => {
    return typeof item === "object" && item !== null && !Array.isArray(item);
  });
}

function asTrendAverages(value: unknown): SearchApiTrendAverage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is SearchApiTrendAverage => {
    return typeof item === "object" && item !== null && !Array.isArray(item);
  });
}

function buildTrendsUrl({
  geo,
  keywords,
  time,
}: {
  geo: string;
  keywords: readonly string[];
  time: string;
}): string {
  const url = new URL("https://trends.google.com/trends/explore");
  url.searchParams.set("date", time);
  url.searchParams.set("geo", geo);
  url.searchParams.set("q", keywords.join(","));

  return url.toString();
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getTrendDirection(values: readonly number[]): "rising" | "stable" | "declining" | "no_data" {
  if (values.length < 2) {
    return "no_data";
  }

  const splitIndex = Math.max(1, Math.floor(values.length / 2));
  const earlyAverage = average(values.slice(0, splitIndex));
  const lateAverage = average(values.slice(splitIndex));
  const threshold = Math.max(5, earlyAverage * 0.1);

  if (lateAverage > earlyAverage + threshold) {
    return "rising";
  }

  if (lateAverage < earlyAverage - threshold) {
    return "declining";
  }

  return "stable";
}

function getAverageByKeyword(
  averages: readonly SearchApiTrendAverage[],
  keyword: string,
  index: number,
): number | null {
  const normalizedKeyword = normalizeKeyword(keyword);
  const namedAverage = averages.find((candidate) => {
    return (
      typeof candidate.query === "string" &&
      normalizeKeyword(candidate.query) === normalizedKeyword
    );
  });

  return (
    (namedAverage === undefined ? null : getTrendValue(namedAverage)) ??
    (averages[index] === undefined ? null : getTrendValue(averages[index]))
  );
}

function getTimelineForKeyword({
  keyword,
  keywordCount,
  keywordIndex,
  timelineData,
}: {
  keyword: string;
  keywordCount: number;
  keywordIndex: number;
  timelineData: readonly SearchApiTrendPoint[];
}): z.infer<typeof KeywordTrendPointSchema>[] {
  const normalizedKeyword = normalizeKeyword(keyword);

  return timelineData.flatMap((point) => {
    const values = asTrendValues(point.values);
    const singleValue = values.length === 1 ? values[0] : undefined;
    const indexedValue = values[keywordIndex];
    const namedValue = values.find((candidate) => {
      return (
        typeof candidate.query === "string" &&
        normalizeKeyword(candidate.query) === normalizedKeyword
      );
    });
    const value =
      (namedValue === undefined ? null : getTrendValue(namedValue)) ??
      (keywordCount === 1 && singleValue !== undefined
        ? getTrendValue(singleValue)
        : indexedValue === undefined
          ? null
          : getTrendValue(indexedValue));

    if (value === null) {
      return [];
    }

    return [
      {
        date: getPointDate(point),
        value,
      },
    ];
  });
}

function parseKeywordTrends({
  data,
  geo,
  keywords,
  time,
}: {
  data: SearchApiTrendsResponse;
  geo: string;
  keywords: readonly string[];
  time: string;
}): z.infer<typeof KeywordTrendSchema>[] {
  const averages = asTrendAverages(data.interest_over_time?.averages);
  const timelineData = asTrendPoints(data.interest_over_time?.timeline_data);
  const sourceUrl = buildTrendsUrl({ geo, keywords, time });
  const observedAt = todayIsoDate();

  return keywords.flatMap((keyword, index) => {
    const timeline = getTimelineForKeyword({
      keyword,
      keywordCount: keywords.length,
      keywordIndex: index,
      timelineData,
    });
    const values = timeline.map((point) => point.value);
    const averageFromPayload = getAverageByKeyword(averages, keyword, index);

    if (averageFromPayload === null && timeline.length === 0) {
      return [];
    }

    const averageInterest = averageFromPayload ?? average(values);
    const peakInterest = values.length === 0 ? 0 : Math.max(...values);

    return [
      {
        keyword,
        averageInterest,
        peakInterest,
        trendDirection: getTrendDirection(values),
        sourceTitle: "SearchAPI Google Trends" as const,
        sourceUrl,
        dateObserved: observedAt,
        timeline,
      },
    ];
  });
}

export const keywordTrendsAgentTool = tool({
  description:
    "SearchAPI Google Trends relative-interest fallback for keyword demand. Use when keyword_volume is unavailable/rate-limited to attach a real directional trend signal. It does not provide monthly search volume or CPC.",
  inputSchema: z
    .object({
      keywords: z
        .array(z.string().min(1))
        .min(1)
        .describe("Category-relevant keywords to compare in Google Trends. Up to 5 are sent."),
      geo: z.string().length(2).default("US"),
      time: z.string().min(1).default("today 12-m"),
    })
    .strict(),
  outputSchema: KeywordTrendsOutputSchema,
  execute: async ({ keywords, geo, time }, { abortSignal }) => {
    const apiKey = process.env.SEARCHAPI_KEY;

    if (apiKey === undefined || apiKey.trim() === "") {
      return credentialGap("SEARCHAPI_KEY") as ToolGap;
    }

    const cleanKeywords = keywords
      .map((keyword) => keyword.trim())
      .filter((keyword) => keyword.length > 0)
      .slice(0, maxTrendKeywords);

    if (cleanKeywords.length === 0) {
      return apiErrorGap("keyword_trends requires at least one keyword") as ToolGap;
    }

    const url = new URL(searchApiBaseUrl);
    url.searchParams.set("engine", "google_trends");
    url.searchParams.set("q", cleanKeywords.join(","));
    url.searchParams.set("geo", geo);
    url.searchParams.set("time", time);
    url.searchParams.set("api_key", apiKey);

    try {
      const response = await timedFetch(url.toString(), {
        method: "GET",
        abortSignal,
        timeoutMs: 15_000,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        return apiErrorGap(
          `SearchAPI Google Trends ${response.status}: ${body.slice(0, 200)}`,
        ) as ToolGap;
      }

      const data = (await response.json()) as SearchApiTrendsResponse;
      const trendKeywords = parseKeywordTrends({
        data,
        geo,
        keywords: cleanKeywords,
        time,
      });

      if (trendKeywords.length === 0) {
        return apiErrorGap(
          "SearchAPI Google Trends returned no keyword interest data",
        ) as ToolGap;
      }

      return {
        type: "result" as const,
        source: "SearchAPI Google Trends" as const,
        keywords: trendKeywords,
      };
    } catch (error) {
      return errorToGap(error, "SearchAPI Google Trends failed");
    }
  },
});
