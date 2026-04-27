import type { KeywordMetric, ResearchKeywordsOutput } from "../schemas/output.ts";

export function normalizeKeyword(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function dedupeKeywordMetrics(
  metrics: KeywordMetric[],
  seen: Set<string> = new Set<string>(),
): KeywordMetric[] {
  const deduped: KeywordMetric[] = [];

  for (const metric of metrics) {
    const normalized = normalizeKeyword(metric.keyword);
    if (normalized.length === 0 || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    deduped.push({
      ...metric,
      keyword: metric.keyword.trim().replace(/\s+/g, " "),
    });
  }

  return deduped;
}

function normalizeTermEntry<T extends { keyword: string }>(entries: T[]): T[] {
  const seen = new Set<string>();
  const deduped: T[] = [];

  for (const entry of entries) {
    const normalized = normalizeKeyword(entry.keyword);
    if (normalized.length === 0 || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    deduped.push({
      ...entry,
      keyword: entry.keyword.trim().replace(/\s+/g, " "),
    });
  }

  return deduped;
}

export function normalizeResearchKeywordsOutput(
  output: ResearchKeywordsOutput,
): ResearchKeywordsOutput {
  const seenMetrics = new Set<string>();
  const intent_clusters = output.intent_clusters.map((cluster) => ({
    ...cluster,
    queries: dedupeKeywordMetrics(cluster.queries, seenMetrics),
  }));

  return {
    ...output,
    intent_clusters,
    paid_keyword_opportunities: dedupeKeywordMetrics(
      output.paid_keyword_opportunities,
      seenMetrics,
    ),
    negative_keywords: normalizeTermEntry(output.negative_keywords),
    excluded_terms: normalizeTermEntry(output.excluded_terms),
  };
}
