'use client';

import { useEffect, useRef, useState } from 'react';

interface CheckListProps {
  title: string;
  items: string[];
  accent?: string;
  isEditing?: boolean;
  onItemsChange?: (items: string[]) => void;
}

export function CheckList({
  title,
  items,
  accent = 'var(--accent-green)',
  isEditing = false,
  onItemsChange,
}: CheckListProps) {
  const [editedItems, setEditedItems] = useState<string[]>(items);
  const itemRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    setEditedItems(items);
  }, [items]);

  if (items.length === 0) return null;

  const handleBlur = (index: number) => {
    const el = itemRefs.current[index];
    if (!el) return;
    const updated = editedItems.map((item, i) =>
      i === index ? (el.textContent ?? item) : item
    );
    setEditedItems(updated);
    onItemsChange?.(updated);
  };

  return (
    <div>
      <h4 className="text-xs font-mono text-[var(--text-tertiary)] uppercase tracking-widest mb-3">
        {title}
      </h4>
      <ul className="space-y-2">
        {editedItems.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm text-[var(--text-secondary)] leading-relaxed">
            <span className="mt-1.5 shrink-0" style={{ color: accent }}>&#x2713;</span>
            {isEditing ? (
              <span
                ref={(el) => { itemRefs.current[i] = el; }}
                contentEditable
                suppressContentEditableWarning
                onBlur={() => handleBlur(i)}
                className="outline-none border-b border-dashed border-[var(--border-subtle)] text-sm text-[var(--text-secondary)] leading-relaxed min-w-0 flex-1"
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
