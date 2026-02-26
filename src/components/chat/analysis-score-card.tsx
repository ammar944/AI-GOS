'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';
import { scaleIn, springs } from '@/lib/motion';
import { SECTION_LABELS } from '@/lib/ai/chat-tools/utils';

interface AnalysisScoreCardProps {
  data: {
    section: string;
    overallScore: number;
    dimensions: { name: string; score: number }[];
    recommendations: string[];
    summary?: string;
  };
}

// Colors cycling through accent palette by dimension index
const DIMENSION_COLORS = [
  'var(--accent-blue)',
  'var(--accent-cyan)',
  'var(--accent-green)',
  'var(--accent-amber)',
  'var(--accent-purple)',
];

function scoreColor(score: number): string {
  if (score >= 8) return 'var(--accent-green)';
  if (score >= 5) return 'var(--accent-amber)';
  return '#ef4444';
}

interface ScoreBarProps {
  name: string;
  score: number;
  color: string;
  index: number;
  animated: boolean;
}

function ScoreBar({ name, score, color, index, animated }: ScoreBarProps) {
  const widthPct = `${(score / 10) * 100}%`;

  return (
    <div className="flex items-center gap-3">
      {/* Label */}
      <span
        className="flex-shrink-0"
        style={{
          fontSize: '12px',
          color: 'var(--text-secondary)',
          width: '75px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={name}
      >
        {name}
      </span>

      {/* Track */}
      <div
        className="flex-1 rounded-full overflow-hidden"
        style={{
          height: '6px',
          background: 'var(--bg-hover)',
        }}
      >
        {/* Fill bar — CSS transition for smooth reveal */}
        <div
          className="h-full rounded-full"
          style={{
            width: animated ? widthPct : '0%',
            background: color,
            transition: `width 1s ease ${index * 300}ms`,
          }}
        />
      </div>

      {/* Score value */}
      <span
        className="font-mono font-medium w-8 text-right flex-shrink-0"
        style={{ fontSize: '11px', color: 'var(--text-secondary)' }}
      >
        {score.toFixed(1)}
      </span>
    </div>
  );
}

export function AnalysisScoreCard({ data }: AnalysisScoreCardProps) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(t);
  }, []);

  const sectionLabel = SECTION_LABELS[data.section] || data.section;
  const mainColor = scoreColor(data.overallScore);

  return (
    <motion.div
      variants={scaleIn}
      initial="initial"
      animate="animate"
      transition={springs.smooth}
      className="rounded-xl overflow-hidden my-2"
      style={{
        border: '1px solid var(--border-default)',
      }}
    >
      {/* Header */}
      <div
        className="px-4 pt-3 pb-4"
        style={{ background: 'rgba(80,248,228,0.03)' }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--accent-cyan)' }} />
              <span
                className="font-semibold uppercase tracking-wider"
                style={{ fontSize: '11px', letterSpacing: '0.05em', color: 'var(--accent-cyan)' }}
              >
                Section Analysis
              </span>
            </div>
            <p
              className="font-medium truncate"
              style={{ fontSize: '13px', color: 'var(--text-primary)' }}
            >
              {sectionLabel}
            </p>
          </div>

          {/* Big score */}
          <div className="flex items-baseline gap-1 flex-shrink-0">
            <span
              className="font-mono font-bold"
              style={{ fontSize: '28px', lineHeight: 1, color: mainColor }}
            >
              {data.overallScore.toFixed(1)}
            </span>
            <span
              className="font-mono"
              style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}
            >
              /10
            </span>
          </div>
        </div>
      </div>

      <div
        className="px-4 pt-3 pb-4 space-y-3"
        style={{ borderTop: '1px solid var(--border-subtle)' }}
      >
        {/* Score bars */}
        {data.dimensions.length > 0 && (
          <div className="space-y-2.5">
            {data.dimensions.map((dim, i) => (
              <ScoreBar
                key={i}
                name={dim.name}
                score={dim.score}
                color={DIMENSION_COLORS[i % DIMENSION_COLORS.length]}
                index={i}
                animated={animated}
              />
            ))}
          </div>
        )}

        {/* Summary */}
        {data.summary && (
          <p
            className="leading-relaxed pt-1"
            style={{ fontSize: '12px', color: 'var(--text-secondary)' }}
          >
            {data.summary}
          </p>
        )}

        {/* Recommendations */}
        {data.recommendations.length > 0 && (
          <div
            className="space-y-1.5 pt-1"
            style={{ borderTop: data.summary ? '1px solid var(--border-subtle)' : 'none' }}
          >
            {data.recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-2">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
                  style={{ background: 'var(--accent-cyan)' }}
                />
                <p
                  className="leading-relaxed"
                  style={{ fontSize: '12px', color: 'var(--text-secondary)' }}
                >
                  {rec}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
