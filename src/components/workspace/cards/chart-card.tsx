'use client';

interface ChartCardProps {
  title: string;
  description?: string;
  imageUrl?: string;
}

export function ChartCard({ title, description, imageUrl }: ChartCardProps) {
  return (
    <div className="glass-surface rounded-[var(--radius-md)] p-4 space-y-3">
      <div>
        <h4 className="text-sm font-medium text-[var(--text-primary)]">{title}</h4>
        {description && (
          <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">{description}</p>
        )}
      </div>
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={title}
          className="w-full rounded-[var(--radius-md)] border border-white/10 bg-[var(--bg-surface)] object-cover"
        />
      )}
    </div>
  );
}
