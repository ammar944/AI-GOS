'use client';

interface CheckListProps {
  title: string;
  items: string[];
  accent?: string;
}

export function CheckList({ title, items, accent = 'var(--accent-green)' }: CheckListProps) {
  if (items.length === 0) return null;

  return (
    <div>
      <h4 className="text-xs font-mono text-[var(--text-tertiary)] uppercase tracking-widest mb-3">
        {title}
      </h4>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm text-[var(--text-secondary)] leading-relaxed">
            <span className="mt-1.5 shrink-0" style={{ color: accent }}>&#x2713;</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
