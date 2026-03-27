'use client';

interface Action {
  action: string;
  source: string;
  priority: string;
}

interface PriorityActionsProps {
  actions: Action[];
}

const PRIORITY_COLORS: Record<string, string> = {
  high: 'var(--accent-red, #ef4444)',
  medium: 'var(--accent-blue, #3b82f6)',
  low: 'var(--text-quaternary)',
};

const SOURCE_LABELS: Record<string, string> = {
  industry: 'Market',
  icp: 'Audience',
  competitors: 'Competitors',
  offer: 'Offer',
  keywords: 'Keywords',
};

export function PriorityActions({ actions }: PriorityActionsProps) {
  if (!actions.length) return null;

  const sorted = [...actions].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return (order[a.priority as keyof typeof order] ?? 1) - (order[b.priority as keyof typeof order] ?? 1);
  });

  return (
    <ol className="space-y-2">
      {sorted.map((a, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}
          >
            {i + 1}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="rounded px-1.5 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wider"
                style={{ color: PRIORITY_COLORS[a.priority] ?? 'var(--text-tertiary)', background: 'rgba(255,255,255,0.04)' }}
              >
                {a.priority}
              </span>
              <span className="rounded px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider"
                style={{ color: 'var(--text-quaternary)', background: 'rgba(255,255,255,0.03)' }}
              >
                {SOURCE_LABELS[a.source] ?? a.source}
              </span>
            </div>
            <div className="mt-1 text-[13px]" style={{ color: 'var(--text-primary)' }}>{a.action}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}
