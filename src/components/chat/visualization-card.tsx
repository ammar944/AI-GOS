'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart3 } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  Cell,
} from 'recharts';
import { scaleIn, springs } from '@/lib/motion';
import type { VisualizationResult } from '@/lib/ai/chat-tools/types';

// ---------------------------------------------------------------------------
// Custom tooltip component — dark-themed to match card design
// ---------------------------------------------------------------------------

interface ChartTooltipProps {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
  label?: string;
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)',
        borderRadius: '8px',
        padding: '8px 12px',
        fontSize: '11px',
        maxWidth: '160px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      }}
    >
      {label && (
        <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '4px' }}>
          {label}
        </p>
      )}
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color || 'var(--text-secondary)', margin: 0 }}>
          {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
          <span style={{ color: 'var(--text-tertiary)', marginLeft: '4px' }}>/ 10</span>
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bar chart sub-component
// ---------------------------------------------------------------------------

interface BarVizProps {
  data: Array<Record<string, string | number>>;
  config: VisualizationResult['config'];
  animated: boolean;
}

function BarViz({ data, config, animated }: BarVizProps) {
  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart
        data={data}
        margin={{ top: 4, right: 4, left: -28, bottom: 0 }}
        barCategoryGap="28%"
      >
        <XAxis
          dataKey={config.categoryKey}
          tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
          tickLine={false}
          axisLine={false}
          interval={0}
          // Truncate long labels
          tickFormatter={(v: string) => (v.length > 8 ? `${v.slice(0, 7)}…` : v)}
        />
        <YAxis
          domain={[0, 10]}
          tick={{ fontSize: 9, fill: 'var(--text-tertiary)' }}
          tickLine={false}
          axisLine={false}
          tickCount={3}
          width={28}
        />
        <Tooltip
          content={<ChartTooltip />}
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
        />
        <Bar
          dataKey={config.dataKey}
          radius={[3, 3, 0, 0]}
          isAnimationActive={animated}
          animationDuration={800}
          animationEasing="ease-out"
        >
          {data.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={config.colors[index % config.colors.length]}
              fillOpacity={0.85}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Radar chart sub-component
// ---------------------------------------------------------------------------

interface RadarVizProps {
  data: Array<Record<string, string | number>>;
  config: VisualizationResult['config'];
  animated: boolean;
}

function RadarViz({ data, config, animated }: RadarVizProps) {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <RadarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
        <PolarGrid
          stroke="rgba(255,255,255,0.06)"
          gridType="polygon"
        />
        <PolarAngleAxis
          dataKey={config.categoryKey}
          tick={{ fontSize: 9, fill: 'var(--text-tertiary)' }}
          tickLine={false}
        />
        <Radar
          name="Score"
          dataKey={config.dataKey}
          stroke={config.colors[0]}
          fill={config.colors[0]}
          fillOpacity={0.18}
          strokeWidth={1.5}
          isAnimationActive={animated}
          animationDuration={800}
          animationEasing="ease-out"
        />
        <Tooltip
          content={<ChartTooltip />}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Timeline chart sub-component — horizontal bar chart variant
// ---------------------------------------------------------------------------

interface TimelineVizProps {
  data: Array<Record<string, string | number>>;
  config: VisualizationResult['config'];
  animated: boolean;
}

function TimelineViz({ data, config, animated }: TimelineVizProps) {
  return (
    <div className="px-1 py-1 space-y-2">
      {data.map((row, i) => {
        const phase = String(row[config.categoryKey] || row.phase || `Phase ${i + 1}`);
        const label = config.labels?.[i] || String(row.label || '');
        const val = Number(row[config.dataKey] || row.value || 1);
        const maxVal = Math.max(...data.map((d) => Number(d[config.dataKey] || d.value || 1)));
        const widthPct = maxVal > 0 ? `${(val / maxVal) * 100}%` : '20%';

        return (
          <div key={i} className="flex items-start gap-2">
            <span
              className="flex-shrink-0 font-mono font-medium"
              style={{ fontSize: '10px', color: config.colors[i % config.colors.length], width: '52px', paddingTop: '2px' }}
            >
              {phase}
            </span>
            <div className="flex-1 min-w-0">
              <div
                className="rounded-full overflow-hidden"
                style={{ height: '6px', background: 'var(--bg-hover)', marginBottom: '3px' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: animated ? widthPct : '0%',
                    background: config.colors[i % config.colors.length],
                    transition: `width 0.8s ease ${i * 120}ms`,
                  }}
                />
              </div>
              {label && (
                <p
                  className="leading-snug"
                  style={{
                    fontSize: '10px',
                    color: 'var(--text-tertiary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={label}
                >
                  {label}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main card component
// ---------------------------------------------------------------------------

interface VisualizationCardProps {
  data: VisualizationResult;
}

export function VisualizationCard({ data }: VisualizationCardProps) {
  const [animated, setAnimated] = useState(false);

  // Trigger animation after mount so bars/fills actually transition
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 80);
    return () => clearTimeout(t);
  }, []);

  if (data.error) {
    return (
      <div
        className="rounded-xl my-2 px-4 py-3"
        style={{
          border: '1px solid rgba(240,160,48,0.25)',
          background: 'rgba(240,160,48,0.05)',
        }}
      >
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#f0a030' }} />
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#f0a030' }}>
            VISUALIZATION
          </span>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{data.error}</p>
      </div>
    );
  }

  if (!data.data || data.data.length === 0) {
    return null;
  }

  const typeLabel =
    data.type === 'bar' ? 'Bar Chart' :
    data.type === 'radar' ? 'Radar Chart' :
    'Timeline';

  return (
    <motion.div
      variants={scaleIn}
      initial="initial"
      animate="animate"
      transition={springs.smooth}
      className="rounded-xl overflow-hidden my-2"
      style={{ border: '1px solid var(--border-default)' }}
    >
      {/* Header */}
      <div
        className="px-4 pt-3 pb-2.5"
        style={{ background: 'rgba(52,210,123,0.04)' }}
      >
        <div className="flex items-center gap-2 mb-1">
          <BarChart3
            className="w-3.5 h-3.5 flex-shrink-0"
            style={{ color: 'var(--accent-green)' }}
          />
          <span
            className="font-semibold uppercase tracking-wider"
            style={{ fontSize: '11px', letterSpacing: '0.05em', color: 'var(--accent-green)' }}
          >
            {typeLabel}
          </span>
        </div>
        <p
          className="font-medium leading-snug"
          style={{ fontSize: '13px', color: 'var(--text-primary)' }}
        >
          {data.title}
        </p>
      </div>

      {/* Chart area */}
      <div
        className="px-2 pt-3 pb-3"
        style={{ borderTop: '1px solid var(--border-subtle)' }}
      >
        {data.type === 'bar' && (
          <BarViz data={data.data} config={data.config} animated={animated} />
        )}
        {data.type === 'radar' && (
          <RadarViz data={data.data} config={data.config} animated={animated} />
        )}
        {data.type === 'timeline' && (
          <TimelineViz data={data.data} config={data.config} animated={animated} />
        )}
      </div>

      {/* Footer note */}
      <div
        className="px-4 py-2"
        style={{ borderTop: '1px solid var(--border-subtle)' }}
      >
        <p style={{ fontSize: '10px', color: 'var(--text-tertiary)', opacity: 0.7 }}>
          Scores from {data.title.toLowerCase().includes('offer') ? 'Offer Analysis' :
                       data.title.toLowerCase().includes('icp') ? 'ICP Analysis' :
                       data.title.toLowerCase().includes('compet') ? 'Competitor Analysis' :
                       'blueprint data'}
          {' '}&bull; 1–10 scale
        </p>
      </div>
    </motion.div>
  );
}
