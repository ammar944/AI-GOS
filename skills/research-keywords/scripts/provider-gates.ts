import type { KeywordMetric, ResearchKeywordsOutput } from "../schemas/output.ts";

type ProviderGateIssue = {
  path: string;
  message: string;
};

function hasMetricValue(metric: KeywordMetric): boolean {
  return Boolean(metric.search_volume || metric.cpc || metric.competition);
}

export function inspectMetricProvenance(
  metric: KeywordMetric,
  path: string,
): ProviderGateIssue[] {
  const issues: ProviderGateIssue[] = [];

  if (metric.metric_status === "unavailable" && hasMetricValue(metric)) {
    issues.push({
      path,
      message:
        "Unavailable keyword metrics must omit search_volume, cpc, and competition.",
    });
  }

  if (metric.metric_status === "verified" && metric.provider === "none") {
    issues.push({
      path,
      message: "Verified keyword metrics must name a concrete provider.",
    });
  }

  if (metric.metric_status === "verified" && !hasMetricValue(metric)) {
    issues.push({
      path,
      message:
        "Verified keyword metrics must include at least one sourced metric value.",
    });
  }

  return issues;
}

export function inspectProviderGates(
  output: ResearchKeywordsOutput,
): ProviderGateIssue[] {
  const issues: ProviderGateIssue[] = [];

  output.intent_clusters.forEach((cluster, clusterIndex) => {
    cluster.queries.forEach((metric, metricIndex) => {
      issues.push(
        ...inspectMetricProvenance(
          metric,
          `intent_clusters:${clusterIndex}:queries:${metricIndex}`,
        ),
      );
    });
  });

  output.paid_keyword_opportunities.forEach((metric, metricIndex) => {
    issues.push(
      ...inspectMetricProvenance(
        metric,
        `paid_keyword_opportunities:${metricIndex}`,
      ),
    );
  });

  const unavailableMetricCount = [
    ...output.intent_clusters.flatMap((cluster) => cluster.queries),
    ...output.paid_keyword_opportunities,
  ].filter((metric) => metric.metric_status === "unavailable").length;

  if (unavailableMetricCount > 0 && output.source_gaps.length === 0) {
    issues.push({
      path: "source_gaps",
      message:
        "Unavailable keyword metrics require at least one source_gaps entry.",
    });
  }

  return issues;
}

export function formatProviderGateIssues(issues: ProviderGateIssue[]): string {
  return issues.map((issue) => `${issue.path} - ${issue.message}`).join("\n");
}
