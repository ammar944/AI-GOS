'use client';

import { useState, useEffect } from 'react';
import { STORAGE_KEYS } from '@/lib/storage/local-storage';

export type SelectedModel = 'opus' | 'sonnet';

const MODEL_OPTIONS: { value: SelectedModel; label: string; desc: string }[] = [
  { value: 'opus', label: 'Opus', desc: 'Best quality' },
  { value: 'sonnet', label: 'Sonnet', desc: 'Balanced' },
];

function getStoredModel(): SelectedModel {
  if (typeof window === 'undefined') return 'opus';
  const stored = localStorage.getItem(STORAGE_KEYS.SELECTED_MODEL);
  return stored === 'sonnet' ? 'sonnet' : 'opus';
}

interface ModelSelectorProps {
  onChange?: (model: SelectedModel) => void;
}

export function ModelSelector({ onChange }: ModelSelectorProps) {
  const [model, setModel] = useState<SelectedModel>('opus');

  useEffect(() => {
    setModel(getStoredModel());
  }, []);

  const handleChange = (value: SelectedModel) => {
    setModel(value);
    localStorage.setItem(STORAGE_KEYS.SELECTED_MODEL, value);
    onChange?.(value);
  };

  return (
    <div className="inline-flex items-center gap-1 rounded-[5px] p-0.5" style={{ background: 'var(--bg-surface, #0e1018)' }}>
      {MODEL_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => handleChange(opt.value)}
          className="cursor-pointer rounded-[3px] px-2.5 py-1 text-[11px] font-medium transition-colors"
          style={{
            background: model === opt.value ? 'var(--bg-card, #12141c)' : 'transparent',
            color: model === opt.value ? 'var(--text-primary)' : 'var(--text-tertiary)',
          }}
          title={opt.desc}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function getSelectedModelId(): string {
  const model = getStoredModel();
  return model === 'sonnet' ? 'claude-sonnet-4-20250514' : 'claude-opus-4-6';
}
