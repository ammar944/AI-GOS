'use client';

import { useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, FileText } from 'lucide-react';
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
      {/* Guidance — Callout Block */}
      <div className="border-l-2 border-[#365eff] pl-4 py-3 mb-6">
        <div className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[#555a6a] mb-1">How it works</div>
        <p className="text-[13px] text-[#8b90a0] leading-relaxed">
          Paste your winning ads, VSLs, or competitor copy here. The AI studies their{' '}
          <strong className="text-[#e2e4ea]">voice, cadence, and structure</strong> —
          then generates scripts that match that register. It mirrors the pattern, not the words.
        </p>
      </div>

      {/* Add/Edit form */}
      {adding && (
        <div className="bg-[#0e1018] border border-[rgba(255,255,255,0.08)] rounded-[8px] p-5 mb-5">
          {/* Name + Source on same row */}
          <div className="flex gap-3 mb-3">
            <div className="flex-1">
              <label className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[#555a6a] mb-1.5 block">
                Name
              </label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Winning VSL — Feb 2024"
                className={cn(
                  'w-full rounded-[5px] border border-[rgba(255,255,255,0.08)] bg-[#07090e] px-3 py-2',
                  'text-sm text-[#e2e4ea] placeholder:text-[#555a6a]',
                  'focus:outline-none focus:border-[#365eff]',
                )}
              />
            </div>
            <div className="flex-1">
              <label className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[#555a6a] mb-1.5 block">
                Source URL
              </label>
              <input
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
                placeholder="Optional"
                className={cn(
                  'w-full rounded-[5px] border border-[rgba(255,255,255,0.08)] bg-[#07090e] px-3 py-2',
                  'text-sm text-[#e2e4ea] placeholder:text-[#555a6a]',
                  'focus:outline-none focus:border-[#365eff]',
                )}
              />
            </div>
          </div>
          <div className="mb-3">
            <label className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[#555a6a] mb-1.5 block">
              Content
            </label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value.slice(0, MAX_CONTENT_LENGTH) })}
              placeholder="Paste the ad copy, script, or hook text here"
              rows={6}
              className={cn(
                'w-full rounded-[5px] border border-[rgba(255,255,255,0.08)] bg-[#07090e] px-3 py-2',
                'text-sm text-[#e2e4ea] placeholder:text-[#555a6a]',
                'resize-none focus:outline-none focus:border-[#365eff]',
              )}
            />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-[#555a6a]">{form.content.length}/{MAX_CONTENT_LENGTH}</span>
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                className="px-3 py-1.5 text-sm text-[#555a6a] hover:text-[#e2e4ea] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!form.name.trim() || !form.content.trim()}
                className={cn(
                  'px-4 py-1.5 rounded-[5px] text-sm font-medium transition-colors',
                  'bg-[#365eff] text-white',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                )}
              >
                {editingIdx !== null ? 'Save Changes' : 'Add Reference'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add button */}
      {!adding && (
        <button
          onClick={() => setAdding(true)}
          disabled={disabled}
          className="flex items-center gap-2 px-[14px] py-[10px] bg-[#0e1018] border border-[rgba(255,255,255,0.08)] rounded-[5px] hover:bg-[#12141c] hover:border-[rgba(255,255,255,0.12)] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed mb-4 cursor-pointer"
        >
          <Plus className="w-4 h-4 text-[#365eff]" />
          <span className="text-[13px] font-medium text-[#8b90a0]">Add reference ad</span>
        </button>
      )}

      {/* Count label */}
      {refs.length > 0 && (
        <div className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[#3a3e4c] mb-3">
          {refs.length} {refs.length === 1 ? 'reference' : 'references'}
        </div>
      )}

      {/* Single-column list */}
      <div className="flex flex-col">
        {refs.map((ref, idx) => (
          <div
            key={`${ref.name}-${idx}`}
            className="flex items-start gap-3.5 px-4 py-3.5 rounded-[5px] border border-transparent hover:bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.04)] transition-all duration-150 group"
          >
            <div className="w-9 h-9 rounded-[5px] bg-[rgba(54,94,255,0.08)] flex items-center justify-center flex-shrink-0 mt-0.5">
              <FileText className="w-4 h-4 text-[#365eff]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-[14px] font-medium text-[#e2e4ea]">{ref.name}</span>
                {ref.source && (
                  <span className="font-mono text-[11px] text-[#555a6a]">{ref.source}</span>
                )}
              </div>
              <p className="text-[13px] text-[#8b90a0] leading-relaxed line-clamp-2">{ref.content}</p>
            </div>
            <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              <button
                onClick={() => handleEdit(idx)}
                className="w-7 h-7 rounded-[5px] flex items-center justify-center text-[#555a6a] hover:text-[#e2e4ea] hover:bg-[#12141c] transition-all duration-150"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(idx)}
                className="w-7 h-7 rounded-[5px] flex items-center justify-center text-[#555a6a] hover:text-[#ef4444] hover:bg-[rgba(239,68,68,0.08)] transition-all duration-150"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
