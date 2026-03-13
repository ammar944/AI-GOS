'use client';

import { useEffect, useState } from 'react';

interface ProseCardProps {
  title: string;
  text: string;
  isEditing?: boolean;
  onTextChange?: (value: string) => void;
}

export function ProseCard({ title, text, isEditing = false, onTextChange }: ProseCardProps) {
  const [localText, setLocalText] = useState(text);

  useEffect(() => {
    setLocalText(text);
  }, [text]);

  if (!text) return null;

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
          onBlur={(e) => onTextChange?.(e.currentTarget.textContent ?? '')}
          className="text-sm leading-relaxed text-[var(--text-secondary)] border border-dashed border-[var(--border-subtle)] rounded-[var(--radius-sm)] px-2 py-1 outline-none min-h-[3rem]"
        >
          {localText}
        </p>
      ) : (
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{localText}</p>
      )}
    </div>
  );
}
