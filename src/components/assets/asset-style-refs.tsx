'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { StyleReference } from '@/lib/profiles/business-profiles';

interface AssetStyleRefsProps {
  refs: StyleReference[];
  onChange: (refs: StyleReference[]) => void;
  disabled?: boolean;
}

const MAX_CONTENT_LENGTH = 5000;

export function AssetStyleRefs({ refs, onChange, disabled }: AssetStyleRefsProps) {
  const [adding, setAdding] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [form, setForm] = useState<StyleReference>({ name: '', content: '', source: '' });

  const handleSave = useCallback(() => {
    const trimmed: StyleReference = {
      name: form.name.trim(),
      content: form.content.trim().slice(0, MAX_CONTENT_LENGTH),
      source: form.source.trim(),
    };
    if (!trimmed.name || !trimmed.content) return;

    if (editingIdx !== null) {
      const updated = [...refs];
      updated[editingIdx] = trimmed;
      onChange(updated);
      setEditingIdx(null);
    } else {
      onChange([...refs, trimmed]);
    }
    setForm({ name: '', content: '', source: '' });
    setAdding(false);
  }, [form, refs, onChange, editingIdx]);

  const handleEdit = useCallback((idx: number) => {
    setForm(refs[idx]);
    setEditingIdx(idx);
    setAdding(true);
  }, [refs]);

  const handleDelete = useCallback((idx: number) => {
    onChange(refs.filter((_, i) => i !== idx));
  }, [refs, onChange]);

  const handleCancel = useCallback(() => {
    setForm({ name: '', content: '', source: '' });
    setAdding(false);
    setEditingIdx(null);
  }, []);

  return (
    <div>
      {/* Guidance */}
      <div className="flex gap-3 items-start rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 mb-6">
        <span className="text-lg flex-shrink-0">💡</span>
        <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
          Paste your winning ads, VSLs, or competitor copy here. The AI studies their{' '}
          <strong className="text-[var(--text-primary)]">voice, cadence, and structure</strong> —
          then generates scripts that match that register. It mirrors the pattern, not the words.
        </p>
      </div>

      {/* Add/Edit form */}
      {adding && (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 mb-4">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Name (e.g. Winning VSL — Feb 2024)"
            className={cn(
              'w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 mb-3',
              'text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
              'focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]',
            )}
          />
          <input
            value={form.source}
            onChange={(e) => setForm({ ...form, source: e.target.value })}
            placeholder="Source URL (optional)"
            className={cn(
              'w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 mb-3',
              'text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
              'focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]',
            )}
          />
          <textarea
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value.slice(0, MAX_CONTENT_LENGTH) })}
            placeholder="Paste the ad copy, script, or hook text here"
            rows={6}
            className={cn(
              'w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2',
              'text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
              'resize-none focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]',
            )}
          />
          <div className="flex justify-between items-center mt-3">
            <span className="text-[11px] text-[var(--text-muted)]">{form.content.length}/{MAX_CONTENT_LENGTH}</span>
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                className="px-3 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!form.name.trim() || !form.content.trim()}
                className={cn(
                  'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                  'bg-[var(--accent-blue)] text-white',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                )}
              >
                {editingIdx !== null ? 'Save Changes' : 'Add Reference'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Add new card */}
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            disabled={disabled}
            className={cn(
              'border-2 border-dashed border-[var(--border-subtle)] rounded-xl p-8',
              'flex flex-col items-center justify-center cursor-pointer min-h-[180px]',
              'hover:border-[var(--accent-blue)] transition-colors',
              'disabled:opacity-40 disabled:cursor-not-allowed',
            )}
          >
            <div className="w-10 h-10 rounded-full bg-[var(--bg-surface)] flex items-center justify-center mb-3">
              <span className="text-[var(--accent-blue)] text-xl">+</span>
            </div>
            <span className="text-sm font-medium text-[var(--text-muted)]">Add Reference Ad</span>
            <span className="text-xs text-[var(--text-muted)] mt-1">Paste winning copy or ad scripts</span>
          </button>
        )}

        {/* Existing cards */}
        {refs.map((ref, idx) => (
          <div
            key={`${ref.name}-${idx}`}
            className="border border-[var(--border-subtle)] rounded-xl p-5 bg-[var(--bg-surface)] min-h-[180px] relative"
          >
            <div className="flex justify-between items-start mb-2.5">
              <div>
                <div className="text-sm font-medium text-[var(--text-primary)]">{ref.name}</div>
                {ref.source && (
                  <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{ref.source}</div>
                )}
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => handleEdit(idx)}
                  className="w-7 h-7 rounded-md bg-[var(--bg-card)] flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleDelete(idx)}
                  className="w-7 h-7 rounded-md bg-[var(--bg-card)] flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-red-400 transition-colors"
                >
                  🗑
                </button>
              </div>
            </div>
            <p className="text-[13px] leading-relaxed text-[var(--text-secondary)] line-clamp-5">
              {ref.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
