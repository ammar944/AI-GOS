// Baseline metrics extraction for the research fabrication fix.
//
// The journey does not store field values in a Zod-typed snapshot; instead,
// the chat agent's `askUser` tool outputs land in `JourneyStateSnapshot.collectedFields`
// as a loose Record<string, unknown>. Values are typically strings entered by the
// user (e.g., "$450", "5", "25").
//
// This module extracts and parses the four "Current Performance" baseline metrics
// that the fabrication fix relies on, returning null for any field the user did
// not provide. Consumers use the presence/absence of each field to decide between
// deterministic computation and an explicit "insufficient data" state — there is
// no fallback heuristic.

/** Keys of the four optional baseline metrics as they appear in the field catalog. */
export const BASELINE_METRIC_KEYS = [
  'currentCac',
  'avgCustomerLtv',
  'leadToCustomerRate',
  'last3to6MoGrowthTrend',
] as const;

export type BaselineMetricKey = (typeof BASELINE_METRIC_KEYS)[number];

/** Parsed baseline metrics. Any field the user did not provide is null. */
export interface BaselineMetrics {
  /** Current customer acquisition cost in USD. */
  currentCac: number | null;
  /** Average customer lifetime value in USD. */
  avgCustomerLtv: number | null;
  /** Lead-to-customer conversion rate, expressed as a percentage (0-100). */
  leadToCustomerRate: number | null;
  /** Trailing 3-6 month revenue growth rate, expressed as a percentage (may be negative). */
  last3to6MoGrowthTrend: number | null;
}

/**
 * Parse a raw field value into a finite number, stripping currency/percent decoration.
 * Returns null for empty strings, null, undefined, or values that cannot be parsed
 * as a finite number.
 */
function parseMetricNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;

  const cleaned = raw.replace(/[$,\s%]/g, '').trim();
  if (cleaned === '') return null;

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Extract the four baseline metrics from a collectedFields bag.
 *
 * The input is a loose Record<string, unknown> as produced by the chat agent's
 * askUser tool outputs. Missing, empty, or unparseable values become null so
 * downstream consumers can emit explicit insufficient-data states.
 */
export function extractBaselineMetrics(
  collectedFields: Record<string, unknown> | null | undefined,
): BaselineMetrics {
  const fields = collectedFields ?? {};
  return {
    currentCac: parseMetricNumber(fields.currentCac),
    avgCustomerLtv: parseMetricNumber(fields.avgCustomerLtv),
    leadToCustomerRate: parseMetricNumber(fields.leadToCustomerRate),
    last3to6MoGrowthTrend: parseMetricNumber(fields.last3to6MoGrowthTrend),
  };
}

/** True when at least one of the four metrics was successfully parsed. */
export function hasAnyBaselineMetrics(metrics: BaselineMetrics): boolean {
  return (
    metrics.currentCac !== null ||
    metrics.avgCustomerLtv !== null ||
    metrics.leadToCustomerRate !== null ||
    metrics.last3to6MoGrowthTrend !== null
  );
}
