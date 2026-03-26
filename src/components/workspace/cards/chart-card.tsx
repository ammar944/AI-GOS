'use client';

interface ChartCardProps {
  title: string;
  description?: string;
  imageUrl?: string;
}

export function ChartCard({ title, description, imageUrl }: ChartCardProps) {
  return (
    <div className="py-1 space-y-3">
      <div>
        <h4 className="text-[14px] leading-[1.55] font-medium text-[var(--text-primary)]">{title}</h4>
        {description && (
          <p className="mt-1 text-[13px] leading-snug text-[var(--text-secondary)]">{description}</p>
        )}
      </div>
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={title}
          className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] object-cover"
        />
      )}
    </div>
  );
}
