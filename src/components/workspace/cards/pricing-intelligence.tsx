'use client';

/**
 * Pricing Intelligence — renders elasticity assessment from the offer analysis pipeline.
 * Follows DESIGN.md: callout blocks with left accent, inline stats, no cards for scores.
 */

// Strips citation markers like [1], [2], [[citation]], [[source]], [source] from text.
function stripCitations(text: string): string {
  return text
    .replace(/\[\[^\]]*?\]\]/g, '') // [[double bracket citations]]
    .replace(/\[\d+\]/g, '')        // [1], [2], numeric citations
    .replace(/\[[^\]]{1,40}\]/g, '') // [short label citations] up to 40 chars
    .trim();
}

interface ElasticitySignal {
  signal: string;
  source: string;
  direction: 'inelastic' | 'elastic' | string;
}

interface ElasticityAssessmentProps {
  verdict: string;
  signals: ElasticitySignal[];
  reasoning: string;
}

export interface PricingIntelligenceProps {
  elasticityAssessment?: ElasticityAssessmentProps;
}

function verdictColor(verdict: string): string {
  if (verdict.includes('inelastic')) return 'var(--green, #22c55e)';
  if (verdict.includes('elastic')) return 'var(--amber, #eab308)';
  return 'var(--text-tertiary)';
}

function verdictLabel(verdict: string): string {
  if (verdict.includes('inelastic')) return 'Likely Inelastic';
  if (verdict.includes('elastic')) return 'Likely Elastic';
  return 'Insufficient Data';
}

export function PricingIntelligence({
  elasticityAssessment,
}: PricingIntelligenceProps) {
  if (!elasticityAssessment) return null;

  const { verdict, signals, reasoning } = elasticityAssessment;
  const safeSignals = Array.isArray(signals) ? signals : [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-mono text-[var(--text-tertiary)] uppercase tracking-widest">
          Elasticity Assessment
        </h4>
        <span
          className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full"
          style={{
            color: verdictColor(verdict),
            background: `color-mix(in srgb, ${verdictColor(verdict)} 10%, transparent)`,
          }}
        >
          {verdictLabel(verdict)}
        </span>
      </div>

      {safeSignals.length > 0 && (
        <div className="space-y-1.5">
          {safeSignals.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span
                className="mt-0.5 shrink-0 text-[10px] font-mono uppercase"
                style={{
                  color: s.direction === 'inelastic'
                    ? 'var(--green, #22c55e)'
                    : 'var(--amber, #eab308)',
                }}
              >
                {s.direction === 'inelastic' ? '▲' : '▼'}
              </span>
              <span className="text-[var(--text-secondary)] leading-relaxed">
                {stripCitations(s.signal)}
              </span>
              <span className="ml-auto shrink-0 text-[10px] font-mono text-[var(--text-tertiary)]">
                {s.source}
              </span>
            </div>
          ))}
        </div>
      )}

      {reasoning && (
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed border-l-2 pl-3"
          style={{ borderColor: verdictColor(verdict) }}
        >
          {stripCitations(reasoning)}
        </p>
      )}
    </div>
  );
}
