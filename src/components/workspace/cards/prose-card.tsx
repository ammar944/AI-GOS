'use client';

interface ProseCardProps {
  title: string;
  text: string;
}

export function ProseCard({ title, text }: ProseCardProps) {
  if (!text) return null;

  return (
    <div className="glass-surface rounded-[var(--radius-md)] p-4">
      <h4 className="text-xs font-mono text-[var(--text-tertiary)] uppercase tracking-widest mb-2">
        {title}
      </h4>
      <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{text}</p>
    </div>
  );
}
