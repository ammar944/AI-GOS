// Baseline metrics helper for the research worker.
//
// The production journey dispatch forwards the user's baseline metrics into
// the worker context so runners can decide between deterministic computation
// and explicit "insufficient data" states. This module defines the shared
// shape and renders the prompt block that gets injected into runner system
// prompts to constrain LTV/CAC/growth-rate generation.

export interface BaselineMetrics {
  /** Current customer acquisition cost in USD. Null when not provided. */
  currentCac: number | null;
  /** Average customer lifetime value in USD. Null when not provided. */
  avgCustomerLtv: number | null;
  /** Lead-to-customer conversion rate, percent 0-100. Null when not provided. */
  leadToCustomerRate: number | null;
  /** Trailing 12-month revenue growth, percent (may be negative). Null when not provided. */
  last12MoGrowthRate: number | null;
}

function formatUsd(value: number | null): string {
  return value !== null ? `$${value}` : 'NOT PROVIDED';
}

function formatPct(value: number | null): string {
  return value !== null ? `${value}%` : 'NOT PROVIDED';
}

/**
 * Render the BASELINE METRICS DATA INTEGRITY block for injection into a
 * runner's system prompt. When `metrics` is undefined (no baselineMetrics in
 * worker context), every field renders as NOT PROVIDED — the runner must
 * then fall back to insufficient-data for any LTV/CAC/growth-rate output.
 */
export function renderBaselineMetricsBlock(
  metrics: BaselineMetrics | undefined,
): string {
  const m: BaselineMetrics = metrics ?? {
    currentCac: null,
    avgCustomerLtv: null,
    leadToCustomerRate: null,
    last12MoGrowthRate: null,
  };

  return `BASELINE METRICS DATA INTEGRITY (CRITICAL):
- The user has provided the following baseline metrics (may contain "NOT PROVIDED"):
  currentCac: ${formatUsd(m.currentCac)}
  avgCustomerLtv: ${formatUsd(m.avgCustomerLtv)}
  leadToCustomerRate: ${formatPct(m.leadToCustomerRate)}
  last12MoGrowthRate: ${formatPct(m.last12MoGrowthRate)}
- NEVER invent LTV, CAC, retention, customer count, or growth-rate numbers.
- For any computation that would require a NOT PROVIDED metric, output null
  for that field and add a string to insufficientData explaining which metric
  was missing. Example: "estimatedLTV: no avgCustomerLtv provided"
- You MAY state industry benchmarks (e.g., "B2B SaaS CAC typically $300-600")
  but must attribute them to a named source and must NOT frame them as
  projections for this client.
- NEVER state a YoY growth rate, ARR scaling target, or "reach $X in Y months"
  claim unless last12MoGrowthRate is PROVIDED AND you cite it directly.
  If last12MoGrowthRate is NOT PROVIDED, say "growth rate not tracked" and
  move on — do not replace it with a benchmark.`;
}

/** Extract baseline metrics from an unknown context object returned by dispatch. */
export function readBaselineMetricsFromContext(
  context: unknown,
): BaselineMetrics | undefined {
  if (!context || typeof context !== 'object') return undefined;
  const obj = context as Record<string, unknown>;
  const raw = obj.baselineMetrics;
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;

  const parseNum = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null;

  return {
    currentCac: parseNum(r.currentCac),
    avgCustomerLtv: parseNum(r.avgCustomerLtv),
    leadToCustomerRate: parseNum(r.leadToCustomerRate),
    last12MoGrowthRate: parseNum(r.last12MoGrowthRate),
  };
}
