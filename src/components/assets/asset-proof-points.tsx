'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { ProofPoint } from '@/lib/profiles/business-profiles';

interface AssetProofPointsProps {
  points: ProofPoint[];
  onChange: (points: ProofPoint[]) => void;
  disabled?: boolean;
}

const PROOF_TYPES = ['case_study', 'testimonial', 'metric', 'credential'] as const;

const TYPE_LABELS: Record<string, string> = {
  case_study: 'Case Study',
  testimonial: 'Testimonial',
  metric: 'Metric',
  credential: 'Credential',
};

const TYPE_COLORS: Record<string, string> = {
  case_study: 'bg-blue-950/30 text-blue-400 border-blue-900/30',
  testimonial: 'bg-purple-950/30 text-purple-400 border-purple-900/30',
  metric: 'bg-green-950/30 text-green-400 border-green-900/30',
  credential: 'bg-amber-950/30 text-amber-400 border-amber-900/30',
};

type ProofForm = Omit<ProofPoint, 'id'>;

const DEFAULT_FORM: ProofForm = {
  type: 'metric',
  headline: '',
  detail: '',
  clientName: undefined,
  verified: false,
};

export function AssetProofPoints({ points, onChange, disabled }: AssetProofPointsProps) {
  const [adding, setAdding] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [form, setForm] = useState<ProofForm>(DEFAULT_FORM);

  const handleSave = useCallback(() => {
    if (!form.headline.trim() || !form.detail.trim()) return;

    const entry: ProofPoint = {
      ...form,
      id: editingIdx !== null ? points[editingIdx].id : crypto.randomUUID(),
      headline: form.headline.trim(),
      detail: form.detail.trim(),
      clientName: form.clientName?.trim() || undefined,
    };

    if (editingIdx !== null) {
      const updated = [...points];
      updated[editingIdx] = entry;
      onChange(updated);
      setEditingIdx(null);
    } else {
      onChange([...points, entry]);
    }
    setForm(DEFAULT_FORM);
    setAdding(false);
  }, [form, points, onChange, editingIdx]);

  const handleEdit = useCallback((idx: number) => {
    const p = points[idx];
    setForm({ type: p.type, headline: p.headline, detail: p.detail, clientName: p.clientName, verified: p.verified });
    setEditingIdx(idx);
    setAdding(true);
  }, [points]);

  const handleDelete = useCallback((idx: number) => {
    onChange(points.filter((_, i) => i !== idx));
  }, [points, onChange]);

  const toggleVerified = useCallback((idx: number) => {
    const updated = [...points];
    updated[idx] = { ...updated[idx], verified: !updated[idx].verified };
    onChange(updated);
  }, [points, onChange]);

  const handleCancel = useCallback(() => {
    setForm(DEFAULT_FORM);
    setAdding(false);
    setEditingIdx(null);
  }, []);

  return (
    <div>
      {/* Guidance */}
      <div className="flex gap-3 items-start rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 mb-6">
        <span className="text-lg flex-shrink-0">🛡️</span>
        <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
          Add real case studies, testimonials, and metrics. The AI{' '}
          <strong className="text-[var(--text-primary)]">cites these instead of fabricating claims</strong>.
          Proof points rotate across awareness levels so scripts don&apos;t repeat the same evidence.
        </p>
      </div>

      {/* Add/Edit form */}
      {adding && (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 mb-4">
          <div className="flex gap-3 mb-3">
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as ProofPoint['type'] })}
              className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)]"
            >
              {PROOF_TYPES.map((t) => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer">
              <input
                type="checkbox"
                checked={form.verified}
                onChange={(e) => setForm({ ...form, verified: e.target.checked })}
                className="rounded"
              />
              Verified
            </label>
          </div>
          <input
            value={form.headline}
            onChange={(e) => setForm({ ...form, headline: e.target.value })}
            placeholder="Headline (e.g. 3 demos to 22 in 90 days)"
            className={cn(
              'w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 mb-3',
              'text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
              'focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]',
            )}
          />
          <input
            value={form.clientName ?? ''}
            onChange={(e) => setForm({ ...form, clientName: e.target.value })}
            placeholder="Client name (optional)"
            className={cn(
              'w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 mb-3',
              'text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
              'focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]',
            )}
          />
          <textarea
            value={form.detail}
            onChange={(e) => setForm({ ...form, detail: e.target.value })}
            placeholder="Full details — the AI uses this as source material"
            rows={4}
            className={cn(
              'w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2',
              'text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
              'resize-none focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]',
            )}
          />
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={handleCancel} className="px-3 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]">Cancel</button>
            <button
              onClick={handleSave}
              disabled={!form.headline.trim() || !form.detail.trim()}
              className="px-4 py-1.5 rounded-md text-sm font-medium bg-[var(--accent-blue)] text-white disabled:opacity-40"
            >
              {editingIdx !== null ? 'Save Changes' : 'Add Proof Point'}
            </button>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-2 gap-4">
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            disabled={disabled}
            className={cn(
              'border-2 border-dashed border-[var(--border-subtle)] rounded-xl p-8',
              'flex flex-col items-center justify-center cursor-pointer min-h-[160px]',
              'hover:border-[var(--accent-blue)] transition-colors',
              'disabled:opacity-40 disabled:cursor-not-allowed',
            )}
          >
            <div className="w-10 h-10 rounded-full bg-[var(--bg-surface)] flex items-center justify-center mb-3">
              <span className="text-[var(--accent-blue)] text-xl">+</span>
            </div>
            <span className="text-sm font-medium text-[var(--text-muted)]">Add Proof Point</span>
            <span className="text-xs text-[var(--text-muted)] mt-1">Case study, testimonial, metric, or credential</span>
          </button>
        )}

        {points.map((p, idx) => (
          <div key={p.id} className="border border-[var(--border-subtle)] rounded-xl p-5 bg-[var(--bg-surface)] min-h-[160px]">
            <div className="flex justify-between items-start mb-2">
              <div className="flex gap-2 items-center">
                <span className={cn('text-[11px] px-2 py-0.5 rounded border', TYPE_COLORS[p.type] ?? TYPE_COLORS.metric)}>
                  {TYPE_LABELS[p.type] ?? p.type}
                </span>
                {p.verified && <span className="text-green-400 text-[13px]">✓ verified</span>}
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => toggleVerified(idx)} className="w-7 h-7 rounded-md bg-[var(--bg-card)] flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-green-400">🛡️</button>
                <button onClick={() => handleEdit(idx)} className="w-7 h-7 rounded-md bg-[var(--bg-card)] flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]">✏️</button>
                <button onClick={() => handleDelete(idx)} className="w-7 h-7 rounded-md bg-[var(--bg-card)] flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-red-400">🗑</button>
              </div>
            </div>
            <div className="text-sm font-medium text-[var(--text-primary)] mb-1">{p.headline}</div>
            {p.clientName && <div className="text-xs text-[var(--text-muted)] mb-2">{p.clientName}</div>}
            <p className="text-[13px] leading-relaxed text-[var(--text-secondary)] line-clamp-3">{p.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
