'use client';

import { StatGrid } from './stat-grid';

interface CacModelCardProps {
  targetCAC?: number;
  expectedCPL?: number;
  leadToSqlRate?: number;
  sqlToCustomerRate?: number;
  expectedLeadsPerMonth?: number;
  expectedSQLsPerMonth?: number;
  expectedCustomersPerMonth?: number;
  ltv?: number;
  ltvCacRatio?: number;
}

function pct(value: number) {
  return `${(value * 100).toFixed(0)}%`;
}

function usd(value: number) {
  return `$${value.toLocaleString()}`;
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
}: CacModelCardProps) {
  const topStats = [
    ...(expectedCPL !== undefined ? [{ label: 'Cost Per Lead', value: usd(expectedCPL) }] : []),
    ...(expectedLeadsPerMonth !== undefined
      ? [{ label: 'Leads / Mo', value: String(expectedLeadsPerMonth) }]
      : []),
  ];

  const midStats = [
    ...(leadToSqlRate !== undefined
      ? [{ label: 'Lead → SQL Rate', value: pct(leadToSqlRate) }]
      : []),
    ...(expectedSQLsPerMonth !== undefined
      ? [{ label: 'SQLs / Mo', value: String(expectedSQLsPerMonth) }]
      : []),
  ];

  const bottomStats = [
    ...(sqlToCustomerRate !== undefined
      ? [{ label: 'SQL → Customer Rate', value: pct(sqlToCustomerRate) }]
      : []),
    ...(expectedCustomersPerMonth !== undefined
      ? [{ label: 'Customers / Mo', value: String(expectedCustomersPerMonth) }]
      : []),
  ];

  const summaryStats = [
    ...(targetCAC !== undefined ? [{ label: 'Target CAC', value: usd(targetCAC) }] : []),
    ...(ltv !== undefined ? [{ label: 'LTV', value: usd(ltv) }] : []),
    ...(ltvCacRatio !== undefined
      ? [{ label: 'LTV : CAC', value: `${ltvCacRatio.toFixed(1)}x` }]
      : []),
  ];

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
    </div>
  );
}
