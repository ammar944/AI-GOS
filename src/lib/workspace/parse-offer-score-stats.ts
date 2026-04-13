export interface OfferScoreDimension {
  label: string;
  value: number;
}

/** Parse Offer Score stat-grid `content.stats` into overall + dimension scores (excludes non-numeric rows). */
export function parseOfferScoreFromStats(stats: unknown): {
  overall: number;
  dimensions: OfferScoreDimension[];
} | null {
  if (!Array.isArray(stats) || stats.length === 0) return null;

  const dimensions: OfferScoreDimension[] = [];
  let overall = 0;

  for (const stat of stats) {
    const s = stat as { label?: string; value?: string };
    if (!s.label || !s.value) continue;
    const num = parseFloat(String(s.value).split('/')[0]);
    if (Number.isNaN(num)) continue;
    if (s.label === 'Overall Score') {
      overall = num;
    } else {
      dimensions.push({ label: s.label, value: num });
    }
  }

  if (overall === 0) return null;
  return { overall, dimensions };
}
