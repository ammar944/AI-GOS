'use client';

import { BulletList } from './bullet-list';

interface CacFrameworkCardProps {
  drivers?: string[];
  improvementLevers?: string[];
  benchmarkRange?: {
    low?: number;
    high?: number;
    source?: string;
  };
}

/**
 * CAC Framework card — replaces the numeric CacModelCard (2026-04-19).
 *
 * Renders qualitative guidance only: what drives CAC + how the client can
 * improve it + an optional industry benchmark range for context. No
 * client-specific target numbers are published (per Mahdy feedback — paid
 * media alone cannot guarantee CAC; it depends on sales process, offer,
 * creative, and retention).
 */
export function CacFrameworkCard({
  drivers,
  improvementLevers,
  benchmarkRange,
}: CacFrameworkCardProps) {
  const hasContent =
    (drivers && drivers.length > 0) ||
    (improvementLevers && improvementLevers.length > 0) ||
    benchmarkRange?.low != null ||
    benchmarkRange?.high != null;

  if (!hasContent) {
    return (
      <p className="text-sm text-[var(--text-secondary)]">
        CAC framework could not be rendered.
      </p>
    );
  }

  const showBenchmark =
    benchmarkRange?.low != null &&
    benchmarkRange?.high != null &&
    Number.isFinite(benchmarkRange.low) &&
    Number.isFinite(benchmarkRange.high);

  return (
    <div className="space-y-4">
      {drivers && drivers.length > 0 && (
        <BulletList title="What drives CAC" items={drivers} />
      )}
      {improvementLevers && improvementLevers.length > 0 && (
        <BulletList title="How to improve CAC" items={improvementLevers} />
      )}
      {showBenchmark && (
        <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-3 py-2 text-xs text-[var(--text-secondary)]">
          Industry benchmark range:{' '}
          <span className="font-semibold text-[var(--text-primary)]">
            ${benchmarkRange!.low!.toLocaleString()}–${benchmarkRange!.high!.toLocaleString()}
          </span>
          {benchmarkRange?.source && (
            <span className="ml-1 text-[var(--text-tertiary)]">({benchmarkRange.source})</span>
          )}
        </div>
      )}
    </div>
  );
}
