import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function SourceLink({
  url,
  label,
}: {
  url?: string;
  label?: string;
}): React.ReactElement | null {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-tertiary)] no-underline hover:text-[color:var(--accent-blue)] hover:underline"
    >
      {label ?? hostnameOf(url)} →
    </a>
  );
}

export function MonoMeta({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <span
      className={cn(
        'font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-tertiary)]',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SubsectionBlock({
  title,
  prose,
  children,
  className,
}: {
  title: string;
  prose: string;
  children?: ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <section
      className={cn(
        'flex flex-col gap-7 border-t border-[var(--border-subtle)] pt-12 first:border-t-0 first:pt-0',
        className,
      )}
    >
      <div className="flex flex-col gap-5">
        <h3 className="font-serif text-[24px] font-normal leading-[1.22] tracking-[0] text-[color:var(--text-primary)]">
          {title}
        </h3>
        <div className="flex max-w-[70ch] flex-col gap-4 text-[15px] leading-[1.8] text-[color:var(--text-secondary)]">
          {prose
            .split(/\n{2,}/)
            .map((paragraph) => paragraph.trim())
            .filter((paragraph) => paragraph.length > 0)
            .map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
        </div>
      </div>
      {children ? <div className="flex flex-col gap-5">{children}</div> : null}
    </section>
  );
}

export function countBy<T>(
  items: ReadonlyArray<T>,
  keyForItem: (item: T) => string,
): Array<{ label: string; value: number }> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = keyForItem(item).trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([label, value]) => ({ label, value }));
}

export function formatEnumLabel(value: string): string {
  return value
    .split(/[-_]/)
    .map((part) => (part ? `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}` : part))
    .join(' ');
}

export function joinList(values: ReadonlyArray<string>): string {
  return values.filter((value) => value.trim().length > 0).join(', ');
}
