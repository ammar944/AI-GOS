'use client';

import { useEffect, useState } from 'react';
import { useCardEditing } from '@/lib/workspace/card-editing-context';
import { InlineText } from './inline-text';

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

  return (
    <div className="py-1">
      <h4 className="text-[10px] font-mono text-[var(--text-quaternary)] uppercase tracking-[0.06em] mb-1">
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
          className="text-[14px] leading-relaxed text-[var(--text-secondary)] border border-dashed border-[var(--border-subtle)] rounded-[var(--radius-sm)] px-2 py-1 outline-none min-h-[3rem]"
        >
          {localText}
        </p>
      ) : (
        <p className="text-[14px] leading-relaxed text-[var(--text-secondary)]">
          <InlineText text={localText} />
        </p>
      )}
    </div>
  );
}
