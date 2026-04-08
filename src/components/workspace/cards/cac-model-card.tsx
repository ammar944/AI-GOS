'use client';

import { StatGrid } from './stat-grid';

interface CacModelCardProps {
  targetCAC?: number | null;
  expectedCPL?: number | null;
  leadToSqlRate?: number | null;
  sqlToCustomerRate?: number | null;
  expectedLeadsPerMonth?: number | null;
  expectedSQLsPerMonth?: number | null;
  expectedCustomersPerMonth?: number | null;
  ltv?: number | null;
  /**
   * LTV:CAC ratio as a pre-formatted display string (e.g. "5.2:1 — Healthy").
   * The schema source field is `ltvToCacRatio: z.string().nullable()` —
   * the worker computes the ratio AND its qualitative band, so we just
   * display the string verbatim.
   */
  ltvCacRatio?: string | null;
  /**
   * List of cac-model fields that were null because the required baseline
   * metric was not provided. Drives the "Insufficient data" empty-state
   * panel and CTA copy. Each entry has the form
   * "estimatedLTV: no avgCustomerLtv provided".
   */
  insufficientData?: string[];
}

function pct(value: number) {
  return `${(value * 100).toFixed(0)}%`;
}

function usd(value: number) {
  return `$${value.toLocaleString()}`;
}

const INSUFFICIENT_DATA_COPY: Record<string, string> = {
  estimatedLTV: 'Add your Avg Customer LTV to unlock lifetime-value math.',
  ltvToCacRatio: 'Add LTV and Current CAC to see the ratio.',
  targetCAC: 'Add your Current CAC to anchor acquisition cost.',
  expectedMonthlyCustomers: 'Add your Lead → Customer % to project customer volume.',
  expectedMonthlyLeads: 'Add a target CPL to project lead volume.',
  expectedMonthlySQLs: 'Add your Lead → Customer % to project the SQL cascade.',
  leadToSqlRate: 'Add your Lead → Customer % to derive funnel rates.',
  sqlToCustomerRate: 'Add your Lead → Customer % to derive funnel rates.',
};

function humanizeInsufficientData(entry: string): string {
  const [field] = entry.split(':');
  const trimmed = field?.trim() ?? '';
  return INSUFFICIENT_DATA_COPY[trimmed] ?? entry;
}

export function CacModelCard({
  targetCAC,
  expectedCPL,
  leadToSqlRate,
  sqlToCustomerRate,
  expectedLeadsPerMonth,
  expectedSQLsPerMonth,
  expectedCustomersPerMonth,
  ltv,
  ltvCacRatio,
  insufficientData,
}: CacModelCardProps) {
  const topStats = [
    ...(expectedCPL != null ? [{ label: 'Cost Per Lead', value: usd(expectedCPL) }] : []),
    ...(expectedLeadsPerMonth != null
      ? [{ label: 'Leads / Mo', value: String(expectedLeadsPerMonth) }]
      : []),
  ];

  const midStats = [
    ...(leadToSqlRate != null
      ? [{ label: 'Lead → SQL Rate', value: pct(leadToSqlRate) }]
      : []),
    ...(expectedSQLsPerMonth != null
      ? [{ label: 'SQLs / Mo', value: String(expectedSQLsPerMonth) }]
      : []),
  ];

  const bottomStats = [
    ...(sqlToCustomerRate != null
      ? [{ label: 'SQL → Customer Rate', value: pct(sqlToCustomerRate) }]
      : []),
    ...(expectedCustomersPerMonth != null
      ? [{ label: 'Customers / Mo', value: String(expectedCustomersPerMonth) }]
      : []),
  ];

  const summaryStats = [
    ...(targetCAC != null ? [{ label: 'Target CAC', value: usd(targetCAC) }] : []),
    ...(ltv != null ? [{ label: 'LTV', value: usd(ltv) }] : []),
    ...(ltvCacRatio != null && ltvCacRatio !== ''
      ? [{ label: 'LTV : CAC', value: ltvCacRatio }]
      : []),
  ];

  const hasInsufficient = Array.isArray(insufficientData) && insufficientData.length > 0;
  // Deduplicate insufficient-data messages keyed by the human copy so the
  // same field doesn't render twice (e.g., expectedMonthlySQLs and
  // expectedMonthlyCustomers both map to "Add your Lead → Customer %").
  const insufficientLines = hasInsufficient
    ? Array.from(new Set(insufficientData.map(humanizeInsufficientData)))
    : [];

  return (
    <div className="space-y-3">
      {topStats.length > 0 && <StatGrid stats={topStats} columns={2} />}
      {midStats.length > 0 && <StatGrid stats={midStats} columns={2} />}
      {bottomStats.length > 0 && <StatGrid stats={bottomStats} columns={2} />}
      {summaryStats.length > 0 && (
        <>
          <div className="border-t border-[var(--border-default)]" />
          <StatGrid stats={summaryStats} columns={3} />
        </>
      )}
      {hasInsufficient && (
        <div className="mt-4 rounded-md border border-dashed border-[var(--border-default)] bg-[var(--bg-elevated)] p-4">
          <div className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>
            Insufficient data
          </div>
          <ul className="mt-2 space-y-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {insufficientLines.map((line) => (
              <li key={line}>• {line}</li>
            ))}
          </ul>
          <a
            href="/profiles#current-performance"
            className="mt-3 inline-block text-xs font-medium underline-offset-4 hover:underline"
            style={{ color: 'var(--accent-blue)' }}
          >
            Add baseline metrics →
          </a>
        </div>
      )}
    </div>
  );
}
