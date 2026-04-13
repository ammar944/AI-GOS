'use client';

import { useEffect, useState } from 'react';
import { useCardEditing } from '@/lib/workspace/card-editing-context';

interface ProseCardProps {
  title: string;
  text: string;
  isEditing?: boolean;
  onTextChange?: (value: string) => void;
}

export function ProseCard({ title, text, isEditing: isEditingProp = false, onTextChange }: ProseCardProps) {
  const { isEditing: isEditingContext, updateDraft } = useCardEditing();
  const isEditing = isEditingProp || isEditingContext;
  const [localText, setLocalText] = useState(text);

  useEffect(() => {
    setLocalText(text);
  }, [text]);

  if (!text) return null;

  const paragraphs = localText
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="glass-surface rounded-[var(--radius-md)] p-4">
      <h4 className="text-xs font-mono text-[var(--text-tertiary)] uppercase tracking-widest mb-2">
        {title}
      </h4>
      {isEditing ? (
        <p
          contentEditable
          suppressContentEditableWarning
          onInput={(e) => setLocalText(e.currentTarget.textContent ?? '')}
          onBlur={(e) => {
            const newText = e.currentTarget.textContent ?? '';
            onTextChange?.(newText);
            updateDraft({ text: newText });
          }}
          className="text-sm leading-relaxed text-[var(--text-secondary)] border border-dashed border-[var(--border-subtle)] rounded-[var(--radius-sm)] px-2 py-1 outline-none min-h-[3rem]"
        >
          {localText}
        </p>
      ) : paragraphs.length > 1 ? (
        <div className="space-y-3">
          {paragraphs.map((p, i) => (
            <p key={i} className="text-sm leading-relaxed text-[var(--text-secondary)]">
              {p}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{localText}</p>
      )}
    </div>
  );
}
