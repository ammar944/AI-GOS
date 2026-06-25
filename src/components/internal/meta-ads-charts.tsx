'use client';

import {
  LineChart,
  Line,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import type { MetaTrendPoint } from '@/lib/agency-intelligence/meta/loaders';

// Tokens mirror src/components/workspace/cards/media-plan-charts.tsx.
const PALETTE = ['#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#ef4444'];

const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(0,0,0,0.75)',
  border: '1px solid var(--border-default)',
  borderRadius: '6px',
  color: 'var(--text-primary)',
  fontSize: 12,
};

const AXIS_STYLE = { fill: 'var(--text-secondary)', fontSize: 11 };
const GRID_STROKE = 'rgba(255,255,255,0.06)';
const CURSOR_STYLE = { stroke: 'rgba(255,255,255,0.12)' };

// "2026-06-24" -> "06-24" (no Date parse, no timezone shift).
const shortDate = (d: string): string => (typeof d === 'string' ? d.slice(5) : String(d));

function ChartShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-3">
      <h4 className="text-sm font-medium text-[var(--text-primary)]">{title}</h4>
      {children}
    </div>
  );
}

function LineTrend({
  title,
  data,
  dataKey,
  color,
  yFormat,
  tipFormat,
  tipLabel,
}: {
  title: string;
  data: MetaTrendPoint[];
  dataKey: 'spend' | 'ctr' | 'cpc';
  color: string;
  yFormat: (v: number) => string;
  tipFormat: (v: number) => string;
  tipLabel: string;
}) {
  return (
    <ChartShell title={title}>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID_STROKE} />
          <XAxis
            dataKey="date"
            tick={{ ...AXIS_STYLE, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={shortDate}
            minTickGap={24}
          />
          <YAxis
            tick={AXIS_STYLE}
            axisLine={false}
            tickLine={false}
            width={48}
            tickFormatter={(v) => yFormat(Number(v))}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            cursor={CURSOR_STYLE}
            labelFormatter={(label) => shortDate(String(label))}
            formatter={(value) => [tipFormat(Number(value)), tipLabel] as [string, string]}
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

const dollar = (v: number): string => (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`);
const dollar2 = (v: number): string => `$${v.toFixed(2)}`;
const pct = (v: number): string => `${v.toFixed(2)}%`;

export function MetaTrendCharts({ trend }: { trend: MetaTrendPoint[] }) {
  if (!trend || trend.length === 0) {
    return (
      <p className="text-xs text-[var(--text-quaternary)]">
        No daily series available for this account.
      </p>
    );
  }
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <LineTrend
        title="Daily spend"
        data={trend}
        dataKey="spend"
        color={PALETTE[0]}
        yFormat={dollar}
        tipFormat={dollar2}
        tipLabel="Spend"
      />
      <LineTrend
        title="Daily CTR (all)"
        data={trend}
        dataKey="ctr"
        color={PALETTE[1]}
        yFormat={pct}
        tipFormat={pct}
        tipLabel="CTR"
      />
      <LineTrend
        title="Daily CPC"
        data={trend}
        dataKey="cpc"
        color={PALETTE[2]}
        yFormat={dollar2}
        tipFormat={dollar2}
        tipLabel="CPC"
      />
    </div>
  );
}
