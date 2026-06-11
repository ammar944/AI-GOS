'use client';

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface KeywordVolumeDatum {
  keyword: string;
  volume: number;
}

export interface KeywordVolumeChartProps {
  data: readonly KeywordVolumeDatum[];
}

export function KeywordVolumeChart({
  data,
}: KeywordVolumeChartProps): React.ReactElement | null {
  if (data.length === 0) return null;

  return (
    <div className="h-[220px] w-full" data-testid="keyword-volume-chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={[...data]} layout="vertical" margin={{ left: 12, right: 12 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="keyword"
            width={160}
            tick={{ fill: 'currentColor', fontSize: 11 }}
          />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted))' }}
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 6,
              color: 'hsl(var(--foreground))',
            }}
          />
          <Bar dataKey="volume" fill="hsl(var(--primary))" radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
