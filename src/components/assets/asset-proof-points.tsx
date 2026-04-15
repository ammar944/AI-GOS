'use client';

import { useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Activity, MessageSquare, BookOpen, Award, ShieldCheck } from 'lucide-react';
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

const TYPE_ICONS: Record<string, React.ReactNode> = {
  metric: <Activity className="w-4 h-4 text-[#365eff]" />,
  testimonial: <MessageSquare className="w-4 h-4 text-[#365eff]" />,
  case_study: <BookOpen className="w-4 h-4 text-[#365eff]" />,
  credential: <Award className="w-4 h-4 text-[#365eff]" />,
};

const TYPE_BADGE_STYLES: Record<string, string> = {
  case_study: 'bg-[rgba(234,179,8,0.1)] text-[#eab308]',
  testimonial: 'bg-[rgba(54,94,255,0.1)] text-[#365eff]',
  metric: 'bg-[rgba(34,197,94,0.1)] text-[#22c55e]',
  credential: 'bg-[rgba(139,144,160,0.1)] text-[#8b90a0]',
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
      {/* Guidance callout */}
      <div className="border-l-2 border-[#365eff] pl-4 py-3 mb-6">
        <div className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[#555a6a] mb-1">Why this matters</div>
        <p className="text-[13px] text-[#8b90a0] leading-relaxed">
          Add real case studies, testimonials, and metrics. The AI{' '}
          <strong className="text-[#c8cad4]">cites these instead of fabricating claims</strong>.
          Proof points rotate across awareness levels so scripts don&apos;t repeat the same evidence.
        </p>
      </div>

      {/* Add/Edit form */}
      {adding && (
        <div className="rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#0e1018] p-4 mb-4">
          <div className="flex gap-3 mb-3">
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as ProofPoint['type'] })}
              className="rounded-[6px] border border-[rgba(255,255,255,0.08)] bg-[#12141c] px-3 py-2 text-[#8b90a0] font-mono text-[11px] focus:outline-none"
            >
              {PROOF_TYPES.map((t) => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 font-mono text-[11px] text-[#555a6a] cursor-pointer">
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
              'w-full rounded-[6px] border border-[rgba(255,255,255,0.06)] bg-[#12141c] px-3 py-2 mb-3',
              'text-[13px] text-[#c8cad4] placeholder:text-[#555a6a]',
              'focus:outline-none focus:ring-1 focus:ring-[#365eff]',
            )}
          />
          <input
            value={form.clientName ?? ''}
            onChange={(e) => setForm({ ...form, clientName: e.target.value })}
            placeholder="Client name (optional)"
            className={cn(
              'w-full rounded-[6px] border border-[rgba(255,255,255,0.06)] bg-[#12141c] px-3 py-2 mb-3',
              'text-[13px] text-[#c8cad4] placeholder:text-[#555a6a]',
              'focus:outline-none focus:ring-1 focus:ring-[#365eff]',
            )}
          />
          <textarea
            value={form.detail}
            onChange={(e) => setForm({ ...form, detail: e.target.value })}
            placeholder="Full details — the AI uses this as source material"
            rows={4}
            className={cn(
              'w-full rounded-[6px] border border-[rgba(255,255,255,0.06)] bg-[#12141c] px-3 py-2',
              'text-[13px] text-[#c8cad4] placeholder:text-[#555a6a]',
              'resize-none focus:outline-none focus:ring-1 focus:ring-[#365eff]',
            )}
          />
          <div className="flex justify-end gap-2 mt-3">
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 font-mono text-[11px] text-[#555a6a] hover:text-[#8b90a0] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!form.headline.trim() || !form.detail.trim()}
              className="px-4 py-1.5 rounded-[6px] font-mono text-[11px] font-medium bg-[#365eff] text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {editingIdx !== null ? 'Save Changes' : 'Add Proof Point'}
            </button>
          </div>
        </div>
      )}

      {/* Inline add button */}
      {!adding && (
        <button
          onClick={() => setAdding(true)}
          disabled={disabled}
          className={cn(
            'flex items-center gap-2 mb-4 font-mono text-[11px] font-medium text-[#365eff]',
            'hover:text-[#5577ff] transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
          )}
        >
          <Plus className="w-3.5 h-3.5" />
          Add Proof Point
        </button>
      )}

      {/* Single-column list */}
      <div className="flex flex-col gap-px">
        {points.map((p, idx) => (
          <div
            key={p.id}
            className="group flex items-start gap-3 px-3 py-3 rounded-[6px] hover:bg-[rgba(255,255,255,0.02)] transition-colors"
          >
            {/* Type icon square */}
            <div className="flex-shrink-0 w-8 h-8 rounded-[6px] bg-[rgba(54,94,255,0.08)] flex items-center justify-center mt-0.5">
              {TYPE_ICONS[p.type] ?? TYPE_ICONS.metric}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className={cn('font-mono text-[10px] font-medium px-[7px] py-[1px] rounded-full', TYPE_BADGE_STYLES[p.type] ?? TYPE_BADGE_STYLES.metric)}>
                  {TYPE_LABELS[p.type] ?? p.type}
                </span>
                {p.verified && (
                  <span className="font-mono text-[10px] font-medium text-[#22c55e] flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    VERIFIED
                  </span>
                )}
              </div>
              <div className="text-[13px] font-medium text-[#c8cad4] leading-snug">{p.headline}</div>
              {p.clientName && (
                <div className="font-mono text-[10px] text-[#555a6a] mt-0.5">{p.clientName}</div>
              )}
              <p className="text-[13px] leading-relaxed text-[#8b90a0] line-clamp-2 mt-1">{p.detail}</p>
            </div>

            {/* Hover actions */}
            <div className="flex-shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => toggleVerified(idx)}
                title={p.verified ? 'Mark unverified' : 'Mark verified'}
                className="w-7 h-7 rounded-[5px] flex items-center justify-center text-[#555a6a] hover:text-[#22c55e] hover:bg-[rgba(34,197,94,0.08)] transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleEdit(idx)}
                className="w-7 h-7 rounded-[5px] flex items-center justify-center text-[#555a6a] hover:text-[#c8cad4] hover:bg-[rgba(255,255,255,0.06)] transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(idx)}
                className="w-7 h-7 rounded-[5px] flex items-center justify-center text-[#555a6a] hover:text-red-400 hover:bg-[rgba(239,68,68,0.08)] transition-colors"
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
