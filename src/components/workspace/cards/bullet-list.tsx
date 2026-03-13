'use client';

interface BulletListProps {
  title: string;
  items: string[];
  accent?: string;
}

export function BulletList({ title, items, accent = 'var(--accent-blue)' }: BulletListProps) {
  if (items.length === 0) return null;

  return (
    <div>
      <h4 className="text-xs font-mono text-[var(--text-tertiary)] uppercase tracking-widest mb-3">
        {title}
      </h4>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm text-[var(--text-secondary)] leading-relaxed">
            <span className="mt-1.5 shrink-0" style={{ color: accent }}>&bull;</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
