'use client';

import { useEffect, useRef, useState } from 'react';
import { InlineText } from './inline-text';

interface CheckListProps {
  title: string;
  items: string[];
  accent?: string;
  isEditing?: boolean;
  onItemsChange?: (items: string[]) => void;
}

function parseMessagingItem(text: string): { title: string; body: string } | null {
  const match = text.match(/^\*\*(.+?)\*\*:\s*([\s\S]+)$/);
  if (!match) return null;
  return { title: match[1], body: match[2] };
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

  // Messaging opportunity card detection — skip when editing
  if (!isEditing) {
    const parsed = editedItems.map((item) => parseMessagingItem(item));
    const messagingItems = parsed.flatMap((p, i) => (p ? [{ ...p, index: i }] : []));
    const normalItems = editedItems.filter((_, i) => parsed[i] === null);

    if (messagingItems.length >= 2) {
      return (
        <div>
          <h4 className="text-[10px] font-mono text-[var(--text-quaternary)] uppercase tracking-[0.06em] mb-1.5">
            {title}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {messagingItems.map(({ title: cardTitle, body }, i) => (
              <div key={i} className="border-l-2 border-l-[var(--border-default)] pl-3 py-1.5">
                <p className="text-[13px] font-medium text-[var(--text-primary)] leading-snug">{cardTitle}</p>
                <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed mt-0.5">{body}</p>
              </div>
            ))}
          </div>
          {normalItems.length > 0 && (
            <ul className="space-y-1.5 mt-2">
              {normalItems.map((item, i) => (
                <li key={i} className="flex gap-2 text-[13px] text-[var(--text-secondary)] leading-relaxed">
                  <span className="mt-1.5 shrink-0" style={{ color: accent }}>&#x2713;</span>
                  <InlineText text={item} />
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    }
  }

  return (
    <div>
      <h4 className="text-[10px] font-mono text-[var(--text-quaternary)] uppercase tracking-[0.06em] mb-1.5">
        {title}
      </h4>
      <ul className="space-y-1.5">
        {editedItems.map((item, i) => (
          <li key={i} className="flex gap-2 text-[13px] text-[var(--text-secondary)] leading-relaxed">
            <span className="mt-1.5 shrink-0" style={{ color: accent }}>&#x2713;</span>
            {isEditing ? (
              <span
                ref={(el) => { itemRefs.current[i] = el; }}
                contentEditable
                suppressContentEditableWarning
                onBlur={() => handleBlur(i)}
                className="outline-none border-b border-dashed border-[var(--border-subtle)] text-[13px] text-[var(--text-secondary)] leading-relaxed min-w-0 flex-1"
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
