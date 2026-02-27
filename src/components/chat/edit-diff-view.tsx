'use client';

import { motion } from 'framer-motion';
import { springs } from '@/lib/motion';

interface EditDiffViewProps {
  oldValue: unknown;
  newValue: unknown;
  fieldPath?: string;
  section?: string;
}

// LCS-based word diff for strings
function computeWordDiff(
  oldStr: string,
  newStr: string
): Array<{ word: string; type: 'removed' | 'added' | 'unchanged' }> {
  const oldWords = oldStr.split(/\s+/).filter(Boolean);
  const newWords = newStr.split(/\s+/).filter(Boolean);

  // Build LCS table
  const m = oldWords.length;
  const n = newWords.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to get diff
  const result: Array<{ word: string; type: 'removed' | 'added' | 'unchanged' }> = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      result.unshift({ word: oldWords[i - 1], type: 'unchanged' });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ word: newWords[j - 1], type: 'added' });
      j--;
    } else {
      result.unshift({ word: oldWords[i - 1], type: 'removed' });
      i--;
    }
  }

  return result;
}

function StringDiff({ oldValue, newValue }: { oldValue: string; newValue: string }) {
  const words = computeWordDiff(oldValue, newValue);

  return (
    <p className="text-xs leading-relaxed" style={{ color: 'var(--text-primary)' }}>
      {words.map((entry, idx) => {
        if (entry.type === 'removed') {
          return (
            <span
              key={idx}
              style={{
                color: '#ef4444',
                background: 'rgba(239, 68, 68, 0.1)',
                borderRadius: '2px',
                padding: '0 2px',
                marginRight: '2px',
                textDecoration: 'line-through',
              }}
            >
              {entry.word}
            </span>
          );
        }
        if (entry.type === 'added') {
          return (
            <span
              key={idx}
              style={{
                color: '#22c55e',
                background: 'rgba(34, 197, 94, 0.1)',
                borderRadius: '2px',
                padding: '0 2px',
                marginRight: '2px',
              }}
            >
              {entry.word}
            </span>
          );
        }
        return (
          <span key={idx} style={{ marginRight: '2px' }}>
            {entry.word}
          </span>
        );
      })}
    </p>
  );
}

function ArrayDiff({ oldValue, newValue }: { oldValue: unknown[]; newValue: unknown[] }) {
  const oldSet = new Set(oldValue.map((v) => String(v)));
  const newSet = new Set(newValue.map((v) => String(v)));

  const removed = oldValue.filter((v) => !newSet.has(String(v)));
  const added = newValue.filter((v) => !oldSet.has(String(v)));
  const unchangedCount = oldValue.filter((v) => newSet.has(String(v))).length;

  return (
    <div className="space-y-1">
      {removed.map((item, idx) => (
        <div
          key={`r-${idx}`}
          className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded min-w-0"
          style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)' }}
        >
          <span className="font-bold shrink-0">-</span>
          <span className="break-all">{String(item)}</span>
        </div>
      ))}
      {added.map((item, idx) => (
        <div
          key={`a-${idx}`}
          className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded min-w-0"
          style={{ color: '#22c55e', background: 'rgba(34, 197, 94, 0.1)' }}
        >
          <span className="font-bold shrink-0">+</span>
          <span className="break-all">{String(item)}</span>
        </div>
      ))}
      {unchangedCount > 0 && (
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {unchangedCount} item{unchangedCount !== 1 ? 's' : ''} unchanged
        </p>
      )}
    </div>
  );
}

function ObjectDiff({
  oldValue,
  newValue,
}: {
  oldValue: Record<string, unknown>;
  newValue: Record<string, unknown>;
}) {
  const allKeys = new Set([...Object.keys(oldValue), ...Object.keys(newValue)]);
  const changedKeys = Array.from(allKeys).filter(
    (k) => JSON.stringify(oldValue[k]) !== JSON.stringify(newValue[k])
  );

  if (changedKeys.length === 0) {
    return (
      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
        No changes detected
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {changedKeys.map((key) => (
        <div key={key} className="text-xs space-y-0.5">
          <span className="font-mono font-medium" style={{ color: 'var(--text-secondary)' }}>
            {key}:
          </span>
          <div className="flex items-center gap-1.5 flex-wrap pl-2 min-w-0">
            <span
              className="break-all"
              style={{
                color: '#ef4444',
                background: 'rgba(239, 68, 68, 0.1)',
                borderRadius: '2px',
                padding: '0 4px',
                textDecoration: 'line-through',
              }}
            >
              {String(oldValue[key] ?? 'empty')}
            </span>
            <span style={{ color: 'var(--text-tertiary)' }}>{'\u2192'}</span>
            <span
              className="break-all"
              style={{
                color: '#22c55e',
                background: 'rgba(34, 197, 94, 0.1)',
                borderRadius: '2px',
                padding: '0 4px',
              }}
            >
              {String(newValue[key] ?? 'empty')}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function PrimitiveDiff({ oldValue, newValue }: { oldValue: unknown; newValue: unknown }) {
  return (
    <div className="flex items-center gap-2 text-xs flex-wrap min-w-0">
      <span
        className="break-all"
        style={{
          color: '#ef4444',
          background: 'rgba(239, 68, 68, 0.1)',
          borderRadius: '2px',
          padding: '1px 6px',
          textDecoration: 'line-through',
        }}
      >
        {String(oldValue ?? 'empty')}
      </span>
      <span style={{ color: 'var(--text-tertiary)' }}>{'\u2192'}</span>
      <span
        className="break-all"
        style={{
          color: '#22c55e',
          background: 'rgba(34, 197, 94, 0.1)',
          borderRadius: '2px',
          padding: '1px 6px',
        }}
      >
        {String(newValue ?? 'empty')}
      </span>
    </div>
  );
}

export function EditDiffView({ oldValue, newValue, fieldPath, section: _section }: EditDiffViewProps) {
  const breadcrumbs = fieldPath ? fieldPath.split('.') : [];

  const renderDiff = () => {
    if (typeof oldValue === 'string' && typeof newValue === 'string') {
      return <StringDiff oldValue={oldValue} newValue={newValue} />;
    }
    if (Array.isArray(oldValue) && Array.isArray(newValue)) {
      return <ArrayDiff oldValue={oldValue} newValue={newValue} />;
    }
    if (
      oldValue !== null &&
      newValue !== null &&
      typeof oldValue === 'object' &&
      typeof newValue === 'object' &&
      !Array.isArray(oldValue) &&
      !Array.isArray(newValue)
    ) {
      return (
        <ObjectDiff
          oldValue={oldValue as Record<string, unknown>}
          newValue={newValue as Record<string, unknown>}
        />
      );
    }
    return <PrimitiveDiff oldValue={oldValue} newValue={newValue} />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springs.smooth}
      className="rounded-md p-2 space-y-2 overflow-hidden"
      style={{ background: 'var(--bg-surface)' }}
    >
      {breadcrumbs.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {breadcrumbs.map((crumb, idx) => (
            <span key={idx} className="flex items-center gap-1">
              <span
                className="text-xs font-mono"
                style={{ color: idx === breadcrumbs.length - 1 ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}
              >
                {crumb}
              </span>
              {idx < breadcrumbs.length - 1 && (
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {'>'}
                </span>
              )}
            </span>
          ))}
        </div>
      )}
      {renderDiff()}
    </motion.div>
  );
}
