export function normalizeConfidenceToTen(confidence: number): number {
  const scaled = confidence <= 1 ? confidence * 10 : confidence;
  return Math.max(0, Math.min(10, scaled));
}

export function formatConfidenceToTen(confidence: number): string {
  const rounded = Math.round(normalizeConfidenceToTen(confidence) * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function getConfidenceToneClass(confidence: number): string {
  const normalized = normalizeConfidenceToTen(confidence);
  if (normalized >= 8) {
    return 'border-[color:var(--green)] text-[color:var(--green)]';
  }
  if (normalized >= 5) {
    return 'border-[color:var(--amber)] text-[color:var(--amber)]';
  }
  return 'border-[color:var(--red)] text-[color:var(--red)]';
}
