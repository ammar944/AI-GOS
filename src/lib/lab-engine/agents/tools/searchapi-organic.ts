import { fetchWithRetry } from "./_shared";

const searchApiBaseUrl = "https://www.searchapi.io/api/v1/search";
const searchApiOrganicTimeoutMs = 15_000;

export interface SearchApiOrganicResult {
  url: string;
  title?: string;
  snippet?: string;
}

function buildSearchApiUrl(
  apiKey: string,
  params: Record<string, string>,
): string {
  const urlParams = new URLSearchParams({ ...params, api_key: apiKey });
  return `${searchApiBaseUrl}?${urlParams.toString()}`;
}

function asSearchApiOrganicResults(value: unknown): SearchApiOrganicResult[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item): SearchApiOrganicResult[] => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      return [];
    }

    const record = item as Record<string, unknown>;
    const link = record.link;

    if (typeof link !== "string" || link.trim().length === 0) {
      return [];
    }

    const title = record.title;
    const snippet = record.snippet;

    return [
      {
        url: link.trim(),
        ...(typeof title === "string" && title.trim().length > 0
          ? { title: title.trim() }
          : {}),
        ...(typeof snippet === "string" && snippet.trim().length > 0
          ? { snippet: snippet.trim() }
          : {}),
      },
    ];
  });
}

export async function fetchSearchApiOrganicResults({
  abortSignal,
  apiKey,
  maxResults,
  query,
}: {
  abortSignal?: AbortSignal;
  apiKey: string;
  maxResults: number;
  query: string;
}): Promise<SearchApiOrganicResult[]> {
  const response = await fetchWithRetry(
    buildSearchApiUrl(apiKey, {
      engine: "google",
      num: String(maxResults),
      q: query,
    }),
    { abortSignal, timeoutMs: searchApiOrganicTimeoutMs },
    { retries: 0 },
  );

  if (!response.ok) {
    throw new Error(`SearchAPI organic search failed with ${response.status}.`);
  }

  const payload = (await response.json()) as { organic_results?: unknown };
  return asSearchApiOrganicResults(payload.organic_results).slice(0, maxResults);
}
