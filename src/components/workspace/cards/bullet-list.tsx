'use client';

import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

export interface BulletListGroup {
  group: string;
  items: string[];
}

interface BulletListProps {
  title: string;
  items: string[];
  groups?: BulletListGroup[];
  accent?: string;
  isEditing?: boolean;
  onItemsChange?: (items: string[]) => void;
}

export function BulletList({
  title,
  items,
  groups,
  accent = 'var(--text-tertiary)',
  isEditing = false,
  onItemsChange,
}: BulletListProps) {
  const [editedItems, setEditedItems] = useState<string[]>(items ?? []);

  // Keep local edit buffer in sync when `items` from props changes (e.g. realtime refresh).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional prop → local state sync for contentEditable
    setEditedItems(items ?? []);
  }, [items]);

  const useGroups = groups != null && groups.length > 0;
  const hasFlatItems = (items?.length ?? 0) > 0;

  if (!useGroups && !hasFlatItems) return null;

  const handleBlur = (index: number, value: string) => {
    const updated = editedItems.map((item, i) => (i === index ? value : item));
    setEditedItems(updated);
    onItemsChange?.(updated);
  };

  if (useGroups) {
    return (
      <div>
        <h4 className="text-[11px] font-mono text-[var(--text-tertiary)] uppercase tracking-[0.06em] mb-3">
          {title}
        </h4>
        <div className="space-y-0">
          {groups!.map((g, gi) => (
            <div
              key={gi}
              className={cn(
                'pb-4 last:pb-0',
                gi > 0 && 'pt-4 border-t border-[var(--border-subtle)]',
              )}
            >
              <h5 className="text-[11px] font-mono font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
                {g.group}
              </h5>
              <ul className="space-y-2">
                {g.items.map((item, i) => (
                  <li
                    key={i}
                    className="flex gap-2 text-sm text-[var(--text-secondary)] leading-relaxed"
                  >
                    <span className="mt-1.5 shrink-0" style={{ color: accent }}>
                      &bull;
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h4 className="text-[11px] font-mono text-[var(--text-tertiary)] uppercase tracking-[0.06em] mb-3">
        {title}
      </h4>
      <ul className="space-y-2">
        {editedItems.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm text-[var(--text-secondary)] leading-relaxed">
            <span className="mt-1.5 shrink-0" style={{ color: accent }}>
              &bull;
            </span>
            {isEditing ? (
              <span
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => handleBlur(i, e.currentTarget.textContent ?? '')}
                className="outline-none border-b border-dashed border-[var(--border-subtle)] text-sm text-[var(--text-secondary)] leading-relaxed"
              >
                {item}
              </span>
            ) : (
              item
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
