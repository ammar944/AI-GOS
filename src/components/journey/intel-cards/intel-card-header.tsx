import { Globe, Users, Target, Package, Layers, Key } from 'lucide-react';

const SECTION_META: Record<string, { icon: typeof Globe; color: string }> = {
  industryMarket: { icon: Globe,    color: 'var(--accent-blue)' },
  competitors:    { icon: Users,    color: 'var(--accent-purple, #a855f7)' },
  icpValidation:  { icon: Target,   color: 'var(--accent-cyan, #06b6d4)' },
  offerAnalysis:  { icon: Package,  color: 'var(--accent-green, #22c55e)' },
  crossAnalysis:  { icon: Layers,   color: '#f59e0b' },
  keywordIntel:   { icon: Key,      color: '#f97316' },
};

export function IntelCardHeader({ sectionKey, label }: { sectionKey: string; label: string }) {
  const meta = SECTION_META[sectionKey] ?? { icon: Globe, color: 'var(--accent-blue)' };
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
