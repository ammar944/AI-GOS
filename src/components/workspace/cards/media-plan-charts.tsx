'use client';

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import type { PieLabelRenderProps } from 'recharts';

// ---------------------------------------------------------------------------
// Shared palette & helpers
// ---------------------------------------------------------------------------

const PALETTE = ['#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#ef4444'];

const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(0,0,0,0.75)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '6px',
  color: 'var(--text-primary)',
  fontSize: 12,
};

const AXIS_STYLE = {
  fill: 'var(--text-secondary)',
  fontSize: 11,
};

const GRID_STROKE = 'rgba(255,255,255,0.06)';

const CURSOR_STYLE = { fill: 'rgba(255,255,255,0.04)' };

function ChartShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-surface rounded-[var(--radius-md)] p-4 space-y-3">
      <h4 className="text-sm font-medium text-[var(--text-primary)]">{title}</h4>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1. PlatformBudgetPieChart
// ---------------------------------------------------------------------------

interface PlatformBudgetPieChartProps {
  platforms: Array<{ name: string; percentage: number }>;
}

function PieLabel(props: PieLabelRenderProps) {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
  if (typeof percent !== 'number' || percent < 0.05) return null;
  if (typeof cx !== 'number' || typeof cy !== 'number') return null;
  if (typeof midAngle !== 'number') return null;
  if (typeof innerRadius !== 'number' || typeof outerRadius !== 'number') return null;

  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export function PlatformBudgetPieChart({ platforms }: PlatformBudgetPieChartProps) {
  const data = platforms.map((p) => ({ name: p.name, value: p.percentage }));

  return (
    <ChartShell title="Platform Budget Allocation">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius={100}
            dataKey="value"
            labelLine={false}
            label={PieLabel}
          >
            {data.map((_, index) => (
              <Cell key={index} fill={PALETTE[index % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value) => [`${value}%`, 'Budget'] as [string, string]}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => (
              <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

// ---------------------------------------------------------------------------
// 2. FunnelSplitBarChart
// ---------------------------------------------------------------------------

interface FunnelSplitBarChartProps {
  funnelSplit: {
    awareness: number;
    consideration: number;
    conversion: number;
  };
}

export function FunnelSplitBarChart({ funnelSplit }: FunnelSplitBarChartProps) {
  const data = [
    { stage: 'Awareness', value: funnelSplit.awareness },
    { stage: 'Consideration', value: funnelSplit.consideration },
    { stage: 'Conversion', value: funnelSplit.conversion },
  ];

  return (
    <ChartShell title="Budget by Funnel Stage">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 20, right: 16, left: -8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID_STROKE} />
          <XAxis dataKey="stage" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
          <YAxis
            tick={AXIS_STYLE}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value) => [`${value}%`, 'Budget'] as [string, string]}
            cursor={CURSOR_STYLE}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} label={{ position: 'top', fill: 'var(--text-secondary)', fontSize: 11, formatter: (v: unknown) => `${v}%` }}>
            {data.map((_, index) => (
              <Cell key={index} fill={PALETTE[index % PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

// ---------------------------------------------------------------------------
// 3. CACFunnelChart
// ---------------------------------------------------------------------------

interface CACFunnelChartProps {
  cacModel: {
    expectedLeadsPerMonth: number;
    expectedSQLsPerMonth: number;
    expectedCustomersPerMonth: number;
  };
}

export function CACFunnelChart({ cacModel }: CACFunnelChartProps) {
  const data = [
    { stage: 'Leads/mo', value: cacModel.expectedLeadsPerMonth },
    { stage: 'SQLs/mo', value: cacModel.expectedSQLsPerMonth },
    { stage: 'Customers/mo', value: cacModel.expectedCustomersPerMonth },
  ];

  // Gradient colors from lighter to darker to emphasize funnel narrowing
  const colors = ['#6366f1', '#4338ca', '#1e1b4b'];

  return (
    <ChartShell title="CAC Conversion Funnel">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID_STROKE} />
          <XAxis dataKey="stage" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={CURSOR_STYLE} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((_, index) => (
              <Cell key={index} fill={colors[index % colors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

// ---------------------------------------------------------------------------
// 4. KPIBenchmarkChart
// ---------------------------------------------------------------------------

interface KPIBenchmarkChartProps {
  kpis: Array<{
    metric: string;
    target: number;
    industryBenchmark: number;
  }>;
}

export function KPIBenchmarkChart({ kpis }: KPIBenchmarkChartProps) {
  // Truncate long metric names for readability
  const data = kpis.map((k) => ({
    ...k,
    metric: k.metric.length > 18 ? `${k.metric.slice(0, 16)}\u2026` : k.metric,
  }));

  return (
    <ChartShell title="KPI Targets vs Benchmarks">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 16, right: 16, left: -8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID_STROKE} />
          <XAxis dataKey="metric" tick={{ ...AXIS_STYLE, fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={CURSOR_STYLE} />
          <Legend
            iconType="square"
            iconSize={8}
            formatter={(value) => (
              <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{value}</span>
            )}
          />
          <Bar dataKey="target" name="Target" fill="#6366f1" radius={[4, 4, 0, 0]} />
          <Bar dataKey="industryBenchmark" name="Industry Benchmark" fill="#22d3ee" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

// ---------------------------------------------------------------------------
// 5. PhaseBudgetChart
// ---------------------------------------------------------------------------

interface PhaseBudgetChartProps {
  phases: Array<{ name: string; budgetAllocation: number }>;
}

function formatDollar(value: unknown): string {
  const num = Number(value);
  if (isNaN(num)) return String(value);
  if (num >= 1000) return `$${(num / 1000).toFixed(0)}k`;
  return `$${num}`;
}

export function PhaseBudgetChart({ phases }: PhaseBudgetChartProps) {
  return (
    <ChartShell title="Phase Budget Timeline">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={phases} margin={{ top: 20, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID_STROKE} />
          <XAxis dataKey="name" tick={{ ...AXIS_STYLE, fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} tickFormatter={formatDollar} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value) => [formatDollar(value), 'Budget'] as [string, string]}
            cursor={CURSOR_STYLE}
          />
          <Bar
            dataKey="budgetAllocation"
            radius={[4, 4, 0, 0]}
            label={{ position: 'top', fill: 'var(--text-secondary)', fontSize: 11, formatter: formatDollar }}
          >
            {phases.map((_, index) => (
              <Cell key={index} fill={PALETTE[index % PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}
