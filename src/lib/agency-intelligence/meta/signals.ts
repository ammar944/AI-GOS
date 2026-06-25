// Pure benchmark/threshold signals for Meta ad-account metrics.
//
// Thresholds are frozen in docs/reference/meta-ads-benchmarks.md (benai ads-meta
// skill, 2026-02; WordStream/Triple Whale 2025). This module is deterministic:
// NO LLM, NO network, NO fabricated overall health score (see MetaSignalsSummary).
//
// Inputs are only the numbers we pull. Every metric Meta returns as "Not
// available" arrives here as null and yields an 'unknown' signal (rendered "—"),
// never an invented value.

export type SignalStatus = 'good' | 'watch' | 'poor' | 'unknown';

export type SignalKey = 'frequency' | 'ctr' | 'cpc' | 'cpm' | 'creative_fatigue';

export interface MetaSignal {
  key: SignalKey;
  label: string;
  status: SignalStatus;
  value: number | null;
  benchmark: string;
  note: string;
}

const unknown = (key: SignalKey, label: string, benchmark: string): MetaSignal => ({
  key,
  label,
  status: 'unknown',
  value: null,
  benchmark,
  note: 'No data — not tracked at this level.',
});

// ---------------------------------------------------------------------------
// Frequency — meta-audit M-CR2 (prospecting) / M-CR3 (retargeting)
// ---------------------------------------------------------------------------
export function frequencySignal(
  frequency: number | null,
  audience: 'prospecting' | 'retargeting' = 'prospecting'
): MetaSignal {
  const benchmark =
    audience === 'retargeting'
      ? 'Retargeting: <8 healthy · 8–12 watch · >12 exhausted'
      : 'Prospecting: <3 healthy · 3–5 watch · >5 exhausted';
  if (frequency == null || !Number.isFinite(frequency)) {
    return unknown('frequency', 'Frequency', benchmark);
  }
  const [watchHi, poorHi] = audience === 'retargeting' ? [12, 8] : [5, 3];
  let status: SignalStatus;
  let note: string;
  if (frequency > watchHi) {
    status = 'poor';
    note = 'Audience likely exhausted — refresh creative or widen targeting.';
  } else if (frequency >= poorHi) {
    status = 'watch';
    note = 'Approaching saturation — watch for CTR decay.';
  } else {
    status = 'good';
    note = 'Healthy exposure per account.';
  }
  return { key: 'frequency', label: 'Frequency', status, value: frequency, benchmark, note };
}

// ---------------------------------------------------------------------------
// CTR — meta-audit M-CR4 absolute bands (≥1.0% good · 0.5–1.0% watch · <0.5% poor)
// with objective-specific benchmark context.
// ---------------------------------------------------------------------------
function ctrBenchmarkFor(objective: string | null | undefined): string {
  const o = (objective ?? '').toUpperCase();
  if (o.includes('TRAFFIC') || o.includes('LINK_CLICKS')) return 'Meta Traffic avg 1.71%';
  if (o.includes('LEAD')) return 'Meta Leads avg 2.59%';
  return 'Meta avg (Traffic 1.71% / Leads 2.59%)';
}

export function ctrSignal(ctrPercent: number | null, objective?: string | null): MetaSignal {
  const benchmark = `≥1.0% good · 0.5–1.0% watch · <0.5% poor — ${ctrBenchmarkFor(objective)}`;
  if (ctrPercent == null || !Number.isFinite(ctrPercent)) {
    return unknown('ctr', 'CTR (all)', benchmark);
  }
  let status: SignalStatus;
  let note: string;
  if (ctrPercent >= 1.0) {
    status = 'good';
    note = 'CTR at or above the healthy floor.';
  } else if (ctrPercent >= 0.5) {
    status = 'watch';
    note = 'Below the 1% floor — creative or targeting may be soft.';
  } else {
    status = 'poor';
    note = 'Weak CTR — likely creative/relevance problem.';
  }
  return { key: 'ctr', label: 'CTR (all)', status, value: ctrPercent, benchmark, note };
}

// ---------------------------------------------------------------------------
// CPC vs objective benchmark (≤benchmark good · ≤2× watch · >2× poor)
// ---------------------------------------------------------------------------
function cpcBenchmarkFor(objective: string | null | undefined): { value: number; label: string } {
  const o = (objective ?? '').toUpperCase();
  if (o.includes('TRAFFIC') || o.includes('LINK_CLICKS')) return { value: 0.7, label: 'Meta Traffic avg $0.70' };
  if (o.includes('LEAD')) return { value: 1.92, label: 'Meta Leads avg $1.92' };
  return { value: 0.85, label: 'Meta avg $0.85 (Jan 2026)' };
}

export function cpcSignal(cpc: number | null, objective?: string | null): MetaSignal {
  const bm = cpcBenchmarkFor(objective);
  const benchmark = bm.label;
  if (cpc == null || !Number.isFinite(cpc)) {
    return unknown('cpc', 'CPC', benchmark);
  }
  let status: SignalStatus;
  let note: string;
  if (cpc <= bm.value) {
    status = 'good';
    note = 'At or below the objective benchmark.';
  } else if (cpc <= bm.value * 2) {
    status = 'watch';
    note = 'Above benchmark — within tolerance.';
  } else {
    status = 'poor';
    note = `Over 2× the ${bm.label} benchmark.`;
  }
  return { key: 'cpc', label: 'CPC', status, value: cpc, benchmark, note };
}

// ---------------------------------------------------------------------------
// CPM vs industry benchmark (≤benchmark good · ≤1.5× watch · >1.5× poor)
// ---------------------------------------------------------------------------
const CPM_BENCHMARKS: Record<string, number> = {
  general: 8,
  ecommerce: 12.5,
  local_services: 18,
  healthcare: 28,
  b2b_saas: 35,
  legal: 45,
  finance: 50,
};

export function cpmSignal(cpm: number | null, industry?: string | null): MetaSignal {
  const key = (industry ?? 'general').toLowerCase().replace(/[\s-]+/g, '_');
  const value = CPM_BENCHMARKS[key] ?? CPM_BENCHMARKS.general;
  const benchmark =
    key === 'general'
      ? 'Most industries $6–8'
      : `${industry} ~$${value.toFixed(2)}`;
  if (cpm == null || !Number.isFinite(cpm)) {
    return unknown('cpm', 'CPM', benchmark);
  }
  let status: SignalStatus;
  let note: string;
  if (cpm <= value) {
    status = 'good';
    note = 'At or below the industry CPM benchmark.';
  } else if (cpm <= value * 1.5) {
    status = 'watch';
    note = 'Above benchmark — acceptable for tight targeting.';
  } else {
    status = 'poor';
    note = 'High CPM — narrow audience or low relevance.';
  }
  return { key: 'cpm', label: 'CPM', status, value: cpm, benchmark, note };
}

// ---------------------------------------------------------------------------
// Creative fatigue — CTR drop over ~14 days (meta-audit M28: >20% = fatigue).
// Compares the recent half vs the baseline half of the most recent ≤14 points.
// ---------------------------------------------------------------------------
export interface DailyCtrPoint {
  date: string;
  ctr: number | null;
}

export function creativeFatigueSignal(series: DailyCtrPoint[]): MetaSignal {
  const benchmark = 'CTR drop >20% over ~14 days = fatigue';
  const clean = (series ?? [])
    .filter((p) => p && typeof p.date === 'string' && p.ctr != null && Number.isFinite(p.ctr))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14);
  if (clean.length < 4) {
    return unknown('creative_fatigue', 'Creative fatigue', benchmark);
  }
  const mid = Math.floor(clean.length / 2);
  const baseline = clean.slice(0, mid);
  const recent = clean.slice(mid);
  const avg = (xs: DailyCtrPoint[]) => xs.reduce((n, p) => n + (p.ctr as number), 0) / xs.length;
  const base = avg(baseline);
  const rec = avg(recent);
  if (base <= 0) {
    return unknown('creative_fatigue', 'Creative fatigue', benchmark);
  }
  const dropPct = ((base - rec) / base) * 100;
  let status: SignalStatus;
  let note: string;
  if (dropPct > 20) {
    status = 'poor';
    note = `CTR fell ${dropPct.toFixed(0)}% — creative fatigue; refresh assets.`;
  } else if (dropPct >= 10) {
    status = 'watch';
    note = `CTR softening (${dropPct.toFixed(0)}% down) — queue new creative.`;
  } else {
    status = 'good';
    note = 'CTR stable over the window.';
  }
  return { key: 'creative_fatigue', label: 'Creative fatigue', status, value: Number(dropPct.toFixed(1)), benchmark, note };
}

// ---------------------------------------------------------------------------
// Aggregate — never returns an overall numeric health score.
// ---------------------------------------------------------------------------
export interface MetaSignalsInput {
  frequency?: number | null;
  ctr?: number | null;
  cpc?: number | null;
  cpm?: number | null;
  objective?: string | null;
  industry?: string | null;
  audience?: 'prospecting' | 'retargeting';
  ctrSeries?: DailyCtrPoint[];
}

export interface MetaSignalsSummary {
  signals: MetaSignal[];
  computable: number;
  total: number;
  /** True when >50% of signals are N/A (benai scoring-system "Insufficient Data" rule). */
  insufficientData: boolean;
  /** Always null — the dashboard never fabricates a 0–100 health score. */
  healthScore: null;
  objective: string | null;
}

export function computeMetaSignals(input: MetaSignalsInput): MetaSignalsSummary {
  const signals: MetaSignal[] = [
    frequencySignal(input.frequency ?? null, input.audience ?? 'prospecting'),
    ctrSignal(input.ctr ?? null, input.objective),
    cpcSignal(input.cpc ?? null, input.objective),
    cpmSignal(input.cpm ?? null, input.industry),
    creativeFatigueSignal(input.ctrSeries ?? []),
  ];
  const total = signals.length;
  const computable = signals.filter((s) => s.status !== 'unknown').length;
  return {
    signals,
    computable,
    total,
    insufficientData: computable / total < 0.5,
    healthScore: null,
    objective: input.objective ?? null,
  };
}
