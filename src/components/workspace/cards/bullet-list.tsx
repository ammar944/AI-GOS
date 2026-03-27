'use client';

import { useEffect, useState } from 'react';
import { InlineText } from './inline-text';

interface BulletListProps {
  title: string;
  items: string[];
  accent?: string;
  isEditing?: boolean;
  onItemsChange?: (items: string[]) => void;
}

export function BulletList({
  title,
  items,
  accent = 'var(--accent-blue)',
  isEditing = false,
  onItemsChange,
}: BulletListProps) {
  const [editedItems, setEditedItems] = useState<string[]>(items);

  useEffect(() => {
    setEditedItems(items);
  }, [items]);

  if (items.length === 0) return null;

  const handleBlur = (index: number, value: string) => {
    const updated = editedItems.map((item, i) => (i === index ? value : item));
    setEditedItems(updated);
    onItemsChange?.(updated);
  };

  return (
    <div>
      <h4 className="text-[10px] font-mono text-[var(--text-quaternary)] uppercase tracking-[0.06em] mb-1.5">
        {title}
      </h4>
      <ul className="space-y-1.5">
        {editedItems.map((item, i) => (
          <li key={i} className="flex gap-2 text-[13px] text-[var(--text-secondary)] leading-relaxed">
            <span className="mt-1.5 shrink-0 text-[6px]" style={{ color: accent }}>&bull;</span>
            {isEditing ? (
              <span
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => handleBlur(i, e.currentTarget.textContent ?? '')}
                className="outline-none border-b border-dashed border-[var(--border-subtle)] text-[13px] text-[var(--text-secondary)] leading-relaxed"
              >
                {item}
              </span>
            ) : (
              <InlineText text={item} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
