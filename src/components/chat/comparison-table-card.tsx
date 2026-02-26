'use client';

import { motion } from 'framer-motion';
import { BarChart3 } from 'lucide-react';
import { scaleIn, springs } from '@/lib/motion';

interface ComparisonTableCardProps {
  data: {
    competitors: string[];
    dimensions: string[];
    headers: string[];
    rows: Record<string, string>[];
    winnerPerColumn?: Record<string, string>;
  };
}

function truncate(text: string, max = 100): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '\u2026';
}

export function ComparisonTableCard({ data }: ComparisonTableCardProps) {
  const { competitors, dimensions, headers, rows, winnerPerColumn = {} } = data;

  const hasData = rows.length > 0 && headers.length > 0;

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
        className="px-4 py-3"
        style={{ background: 'rgba(167,139,250,0.04)' }}
      >
        <div className="flex items-center gap-2 mb-0.5">
          <BarChart3 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--accent-purple)' }} />
          <span
            className="font-semibold uppercase tracking-wider"
            style={{ fontSize: '11px', letterSpacing: '0.05em', color: 'var(--accent-purple)' }}
          >
            Competitor Comparison
          </span>
        </div>
        {(competitors.length > 0 || dimensions.length > 0) && (
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
            {competitors.length > 0 && `${competitors.length} competitor${competitors.length !== 1 ? 's' : ''}`}
            {competitors.length > 0 && dimensions.length > 0 && ' across '}
            {dimensions.length > 0 && `${dimensions.length} dimension${dimensions.length !== 1 ? 's' : ''}`}
          </p>
        )}
      </div>

      {/* Table area */}
      {hasData ? (
        <div className="overflow-x-auto" style={{ maxHeight: '360px', overflowY: 'auto' }}>
          <table
            className="w-full"
            style={{ borderCollapse: 'collapse', minWidth: '300px' }}
          >
            <thead
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 1,
                background: 'var(--bg-base)',
              }}
            >
              <tr>
                {headers.map((header, i) => (
                  <th
                    key={i}
                    style={{
                      fontSize: '10.5px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'var(--text-tertiary)',
                      fontWeight: 500,
                      padding: '8px 12px',
                      textAlign: 'left',
                      borderBottom: '1px solid var(--border-subtle)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => {
                const firstHeader = headers[0];
                const dimensionName = firstHeader ? (row[firstHeader] ?? '') : '';
                const winner = winnerPerColumn[dimensionName];

                return (
                  <tr
                    key={rowIdx}
                    style={{
                      background: rowIdx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                    }}
                  >
                    {headers.map((header, colIdx) => {
                      const cellValue = row[header] ?? '';
                      const isFirstCol = colIdx === 0;
                      const isWinner = !isFirstCol && winner === header;

                      return (
                        <td
                          key={colIdx}
                          style={{
                            fontSize: '12px',
                            padding: '10px 12px',
                            borderBottom: '1px solid var(--border-subtle)',
                            color: isWinner
                              ? 'var(--accent-green)'
                              : isFirstCol
                                ? 'var(--text-primary)'
                                : 'var(--text-secondary)',
                            fontWeight: isWinner ? 600 : isFirstCol ? 500 : 400,
                            maxWidth: '220px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={cellValue.length > 100 ? cellValue : undefined}
                        >
                          {truncate(cellValue)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          className="px-4 py-6 text-center"
          style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}
        >
          No competitor data available
        </div>
      )}
    </motion.div>
  );
}
