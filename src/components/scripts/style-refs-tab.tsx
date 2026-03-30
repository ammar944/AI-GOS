'use client';

import { useState } from 'react';
import { Plus, Trash2, Copy, Check, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { StyleReference, ProofPoint } from '@/lib/profiles/business-profiles';

interface StyleRefsTabProps {
  profileId: string;
  initialRefs: StyleReference[] | null;
  initialProofPoints?: ProofPoint[];
}

interface CopiedState {
  [index: number]: boolean;
}

const PROOF_TYPES = [
  { value: 'case_study', label: 'Case Study' },
  { value: 'testimonial', label: 'Testimonial' },
  { value: 'metric', label: 'Metric' },
  { value: 'credential', label: 'Credential' },
] as const;

export function StyleRefsTab({ profileId, initialRefs, initialProofPoints }: StyleRefsTabProps) {
  const [refs, setRefs] = useState<StyleReference[]>(initialRefs ?? []);
  const [proofPoints, setProofPoints] = useState<ProofPoint[]>(initialProofPoints ?? []);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copied, setCopied] = useState<CopiedState>({});
  const [adding, setAdding] = useState(false);
  const [newRef, setNewRef] = useState<StyleReference>({ name: '', content: '', source: '' });
  const [addingProof, setAddingProof] = useState(false);
  const [newProof, setNewProof] = useState<Omit<ProofPoint, 'id'>>({
    type: 'case_study',
    headline: '',
    detail: '',
    clientName: '',
    verified: false,
  });

  async function persistRefs(updated: StyleReference[]) {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/profiles/${profileId}/style-references`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ styleReferences: updated }),
      });
      if (!res.ok) {
        const data = await res.json();
        setSaveError(data.error ?? 'Failed to save');
      } else {
        setRefs(updated);
      }
    } catch {
      setSaveError('Network error — try again');
    } finally {
      setSaving(false);
    }
  }

  async function persistProofPoints(updated: ProofPoint[]) {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/profiles/${profileId}/style-references`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proofPoints: updated }),
      });
      if (!res.ok) {
        const data = await res.json();
        setSaveError(data.error ?? 'Failed to save');
      } else {
        setProofPoints(updated);
      }
    } catch {
      setSaveError('Network error — try again');
    } finally {
      setSaving(false);
    }
  }

  function handleDeleteRef(index: number) {
    persistRefs(refs.filter((_, i) => i !== index));
  }

  function handleCopy(index: number, content: string) {
    navigator.clipboard.writeText(content).then(() => {
      setCopied((prev) => ({ ...prev, [index]: true }));
      setTimeout(() => {
        setCopied((prev) => ({ ...prev, [index]: false }));
      }, 2000);
    });
  }

  function handleAddRefSubmit() {
    if (!newRef.name.trim() || !newRef.content.trim()) return;
    persistRefs([...refs, { ...newRef }]);
    setNewRef({ name: '', content: '', source: '' });
    setAdding(false);
  }

  function handleAddRefCancel() {
    setNewRef({ name: '', content: '', source: '' });
    setAdding(false);
  }

  function handleAddProofSubmit() {
    if (!newProof.headline.trim() || !newProof.detail.trim()) return;
    const proof: ProofPoint = {
      ...newProof,
      id: crypto.randomUUID(),
      clientName: newProof.clientName || undefined,
    };
    persistProofPoints([...proofPoints, proof]);
    setNewProof({ type: 'case_study', headline: '', detail: '', clientName: '', verified: false });
    setAddingProof(false);
  }

  function handleDeleteProof(id: string) {
    persistProofPoints(proofPoints.filter((p) => p.id !== id));
  }

  function handleToggleVerified(id: string) {
    const updated = proofPoints.map((p) =>
      p.id === id ? { ...p, verified: !p.verified } : p,
    );
    persistProofPoints(updated);
  }

  return (
    <div className="space-y-10">
      {/* ─── Style References Section ─── */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.06em] font-mono font-medium text-[var(--text-tertiary)]">
              Style References
            </p>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Paste winning ads or copy examples to guide script generation.
            </p>
          </div>
          {!adding && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAdding(true)}
              className="gap-1.5 text-xs px-3 py-1.5 rounded-md border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)]"
            >
              <Plus className="size-3.5" />
              Add Reference
            </Button>
          )}
        </div>

        {saveError && (
          <p className="text-xs text-red-500 font-mono">{saveError}</p>
        )}

        {adding && (
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] p-4 space-y-3">
            <p className="text-[11px] uppercase tracking-[0.06em] font-mono font-medium text-[var(--text-tertiary)]">
              New Reference
            </p>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Name (e.g. Winning VSL — Feb 2024)"
                value={newRef.name}
                onChange={(e) => setNewRef((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] outline-none focus:border-[var(--accent-blue)] transition-colors"
              />
              <input
                type="text"
                placeholder="Source URL or platform (optional)"
                value={newRef.source}
                onChange={(e) => setNewRef((prev) => ({ ...prev, source: e.target.value }))}
                className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] outline-none focus:border-[var(--accent-blue)] transition-colors"
              />
              <textarea
                placeholder="Paste the ad copy, script, or hook here..."
                value={newRef.content}
                onChange={(e) => setNewRef((prev) => ({ ...prev, content: e.target.value }))}
                rows={6}
                className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] outline-none focus:border-[var(--accent-blue)] transition-colors resize-none"
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                onClick={handleAddRefSubmit}
                disabled={!newRef.name.trim() || !newRef.content.trim() || saving}
                className="text-xs px-3 py-1.5 rounded-md bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue-hover)] disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Reference'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleAddRefCancel}
                className="text-xs px-3 py-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {refs.length === 0 && !adding ? (
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] px-6 py-10 text-center">
            <p className="text-sm text-[var(--text-tertiary)]">No style references yet.</p>
            <p className="text-xs text-[var(--text-quaternary)] mt-1">
              Add winning ads to guide the AI when generating scripts.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {refs.map((ref, i) => (
              <div
                key={i}
                className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] p-4 group"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">{ref.name}</p>
                    {ref.source && (
                      <p className="text-[11px] font-mono text-[var(--text-tertiary)] mt-0.5 truncate">
                        {ref.source}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleCopy(i, ref.content)}
                      className={cn(
                        'p-1.5 rounded-md transition-colors',
                        'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]',
                      )}
                      title="Copy content"
                    >
                      {copied[i] ? (
                        <Check className="size-3.5 text-[var(--accent-green)]" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDeleteRef(i)}
                      disabled={saving}
                      className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-red-500 hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50"
                      title="Delete reference"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-[var(--text-secondary)] line-clamp-4 whitespace-pre-wrap leading-relaxed">
                  {ref.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Proof Points Section ─── */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.06em] font-mono font-medium text-[var(--text-tertiary)]">
              Proof Points
            </p>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Case studies, testimonials, metrics, and credentials the AI can cite in scripts.
            </p>
          </div>
          {!addingProof && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAddingProof(true)}
              className="gap-1.5 text-xs px-3 py-1.5 rounded-md border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)]"
            >
              <Plus className="size-3.5" />
              Add Proof
            </Button>
          )}
        </div>

        {addingProof && (
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] p-4 space-y-3">
            <p className="text-[11px] uppercase tracking-[0.06em] font-mono font-medium text-[var(--text-tertiary)]">
              New Proof Point
            </p>
            <div className="space-y-2">
              <select
                value={newProof.type}
                onChange={(e) =>
                  setNewProof((prev) => ({
                    ...prev,
                    type: e.target.value as ProofPoint['type'],
                  }))
                }
                className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-blue)] transition-colors"
              >
                {PROOF_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder='Headline (e.g. "3 demos to 22 in 90 days")'
                value={newProof.headline}
                onChange={(e) => setNewProof((prev) => ({ ...prev, headline: e.target.value }))}
                className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] outline-none focus:border-[var(--accent-blue)] transition-colors"
              />
              <textarea
                placeholder="Full detail — the AI will use this as source material"
                value={newProof.detail}
                onChange={(e) => setNewProof((prev) => ({ ...prev, detail: e.target.value }))}
                rows={4}
                className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] outline-none focus:border-[var(--accent-blue)] transition-colors resize-none"
              />
              <input
                type="text"
                placeholder="Client name (optional)"
                value={newProof.clientName}
                onChange={(e) => setNewProof((prev) => ({ ...prev, clientName: e.target.value }))}
                className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] outline-none focus:border-[var(--accent-blue)] transition-colors"
              />
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newProof.verified}
                  onChange={(e) => setNewProof((prev) => ({ ...prev, verified: e.target.checked }))}
                  className="rounded border-[var(--border-default)] bg-[var(--bg-base)]"
                />
                <span className="text-xs text-[var(--text-secondary)]">Verified</span>
              </label>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                onClick={handleAddProofSubmit}
                disabled={!newProof.headline.trim() || !newProof.detail.trim() || saving}
                className="text-xs px-3 py-1.5 rounded-md bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue-hover)] disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Proof Point'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setNewProof({ type: 'case_study', headline: '', detail: '', clientName: '', verified: false });
                  setAddingProof(false);
                }}
                className="text-xs px-3 py-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {proofPoints.length === 0 && !addingProof ? (
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] px-6 py-10 text-center">
            <p className="text-sm text-[var(--text-tertiary)]">No proof points yet.</p>
            <p className="text-xs text-[var(--text-quaternary)] mt-1">
              Add case studies, testimonials, or metrics so scripts cite real proof instead of fabricating claims.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {proofPoints.map((proof) => (
              <div
                key={proof.id}
                className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] p-4 group"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--text-tertiary)]">
                        {PROOF_TYPES.find((t) => t.value === proof.type)?.label ?? proof.type}
                      </span>
                      {proof.verified && (
                        <ShieldCheck className="size-3.5 text-[var(--accent-green)]" />
                      )}
                    </div>
                    <p className="text-sm font-medium text-[var(--text-primary)] mt-1.5">{proof.headline}</p>
                    {proof.clientName && (
                      <p className="text-[11px] font-mono text-[var(--text-tertiary)] mt-0.5">
                        {proof.clientName}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleToggleVerified(proof.id)}
                      className={cn(
                        'p-1.5 rounded-md transition-colors',
                        proof.verified
                          ? 'text-[var(--accent-green)] hover:bg-[var(--bg-hover)]'
                          : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]',
                      )}
                      title={proof.verified ? 'Mark as unverified' : 'Mark as verified'}
                    >
                      <ShieldCheck className="size-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteProof(proof.id)}
                      disabled={saving}
                      className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-red-500 hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50"
                      title="Delete proof point"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-[var(--text-secondary)] line-clamp-3 whitespace-pre-wrap leading-relaxed">
                  {proof.detail}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {saving && (
        <p className="text-[11px] font-mono text-[var(--text-tertiary)]">
          Saving...
        </p>
      )}
    </div>
  );
}
