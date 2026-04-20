import { Globe, Users, Target, Package, Layers, Key } from 'lucide-react';

const SECTION_META: Record<string, { icon: typeof Globe; color: string }> = {
  industryMarket: { icon: Globe,    color: 'var(--text-secondary)' },
  competitors:    { icon: Users,    color: 'var(--text-secondary)' },
  icpValidation:  { icon: Target,   color: 'var(--text-secondary)' },
  offerAnalysis:  { icon: Package,  color: 'var(--text-secondary)' },
  crossAnalysis:  { icon: Layers,   color: 'var(--text-secondary)' },
  keywordIntel:   { icon: Key,      color: 'var(--text-secondary)' },
};

export function IntelCardHeader({ sectionKey, label }: { sectionKey: string; label: string }) {
  const meta = SECTION_META[sectionKey] ?? { icon: Globe, color: 'var(--text-secondary)' };
  const Icon = meta.icon;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
      <Icon style={{ width: 11, height: 11, color: meta.color }} />
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: meta.color }}>
        {label}
      </span>
    </div>
  );
}

export { SECTION_META };
