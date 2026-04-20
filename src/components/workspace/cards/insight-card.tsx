'use client';

export interface InsightRow {
  insight: string;
  source?: string;
  implication?: string;
}

export interface InsightCardProps {
  insights?: InsightRow[];
  /** @deprecated single-item shape; use `insights` */
  insight?: string;
  source?: string;
  implication?: string;
}

function normalizeInsights(props: InsightCardProps): InsightRow[] {
  if (props.insights && props.insights.length > 0) {
    return props.insights;
  }
  if (props.insight != null && props.insight !== '') {
    return [{ insight: props.insight, source: props.source, implication: props.implication }];
  }
  return [];
}

function InsightBlock({ row }: { row: InsightRow }) {
  return (
    <div className="border-l border-l-[var(--border-default)] py-3 pl-4 pr-2">
      {row.source ? (
        <p className="mb-1 font-mono text-[10px] font-medium uppercase tracking-wider text-[var(--text-quaternary)]">
          Key Insight — {row.source}
        </p>
      ) : null}
      <p className="text-sm leading-relaxed text-[var(--text-primary)]">{row.insight}</p>
      {row.implication ? (
        <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-secondary)]">{row.implication}</p>
      ) : null}
    </div>
  );
}

export function InsightCard(props: InsightCardProps) {
  const rows = normalizeInsights(props);
  if (rows.length === 0) return null;

  if (rows.length === 1) {
    return <InsightBlock row={rows[0]} />;
  }

  return (
    <div className="divide-y divide-[var(--border-subtle)]">
      {rows.map((row, i) => (
        <InsightBlock key={i} row={row} />
      ))}
    </div>
  );
}
