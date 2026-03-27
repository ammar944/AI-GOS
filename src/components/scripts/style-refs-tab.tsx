'use client';

import { useState } from 'react';
import { Plus, Trash2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { StyleReference } from '@/lib/profiles/business-profiles';

interface StyleRefsTabProps {
  profileId: string;
  initialRefs: StyleReference[] | null;
}

interface CopiedState {
  [index: number]: boolean;
}

export function StyleRefsTab({ profileId, initialRefs }: StyleRefsTabProps) {
  const [refs, setRefs] = useState<StyleReference[]>(initialRefs ?? []);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copied, setCopied] = useState<CopiedState>({});
  const [adding, setAdding] = useState(false);
  const [newRef, setNewRef] = useState<StyleReference>({ name: '', content: '', source: '' });

  async function persist(updated: StyleReference[]) {
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

  function handleDelete(index: number) {
    const updated = refs.filter((_, i) => i !== index);
    persist(updated);
  }

  function handleCopy(index: number, content: string) {
    navigator.clipboard.writeText(content).then(() => {
      setCopied((prev) => ({ ...prev, [index]: true }));
      setTimeout(() => {
        setCopied((prev) => ({ ...prev, [index]: false }));
      }, 2000);
    });
  }

  function handleAddSubmit() {
    if (!newRef.name.trim() || !newRef.content.trim()) return;
    const updated = [...refs, { ...newRef }];
    persist(updated);
    setNewRef({ name: '', content: '', source: '' });
    setAdding(false);
  }

  function handleAddCancel() {
    setNewRef({ name: '', content: '', source: '' });
    setAdding(false);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.06em] font-[family-name:var(--font-mono)] font-medium text-[var(--text-3)]">
            Style References
          </p>
          <p className="text-sm text-[var(--text-2)] mt-1">
            Paste winning ads or copy examples to guide script generation.
          </p>
        </div>
        {!adding && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAdding(true)}
            className="gap-1.5 text-xs px-3 py-1.5 rounded-[5px] border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text-1)] hover:border-[var(--border-hover)]"
          >
            <Plus className="size-3.5" />
            Add Reference
          </Button>
        )}
      </div>

      {/* Error */}
      {saveError && (
        <p className="text-xs text-red-400 font-[family-name:var(--font-mono)]">{saveError}</p>
      )}

      {/* Add form */}
      {adding && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-2)] p-4 space-y-3">
          <p className="text-[11px] uppercase tracking-[0.06em] font-[family-name:var(--font-mono)] font-medium text-[var(--text-3)]">
            New Reference
          </p>
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Name (e.g. Winning VSL — Feb 2024)"
              value={newRef.name}
              onChange={(e) => setNewRef((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--bg-1)] px-3 py-2 text-sm text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--accent)] transition-colors"
            />
            <input
              type="text"
              placeholder="Source URL or platform (optional)"
              value={newRef.source}
              onChange={(e) => setNewRef((prev) => ({ ...prev, source: e.target.value }))}
              className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--bg-1)] px-3 py-2 text-sm text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--accent)] transition-colors"
            />
            <textarea
              placeholder="Paste the ad copy, script, or hook here..."
              value={newRef.content}
              onChange={(e) => setNewRef((prev) => ({ ...prev, content: e.target.value }))}
              rows={6}
              className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--bg-1)] px-3 py-2 text-sm text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--accent)] transition-colors resize-none"
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              onClick={handleAddSubmit}
              disabled={!newRef.name.trim() || !newRef.content.trim() || saving}
              className="text-xs px-3 py-1.5 rounded-[5px] bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Reference'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleAddCancel}
              className="text-xs px-3 py-1.5 rounded-[5px] text-[var(--text-3)] hover:text-[var(--text-2)]"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Refs list */}
      {refs.length === 0 && !adding ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-6 py-10 text-center">
          <p className="text-sm text-[var(--text-3)]">No style references yet.</p>
          <p className="text-xs text-[var(--text-4)] mt-1">
            Add winning ads to guide the AI when generating scripts.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {refs.map((ref, i) => (
            <div
              key={i}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-2)] p-4 group"
            >
              {/* Ref header */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--text-1)] truncate">{ref.name}</p>
                  {ref.source && (
                    <p className="text-[11px] font-[family-name:var(--font-mono)] text-[var(--text-3)] mt-0.5 truncate">
                      {ref.source}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleCopy(i, ref.content)}
                    className={cn(
                      'p-1.5 rounded-[5px] transition-colors',
                      'text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--bg-3)]',
                    )}
                    title="Copy content"
                  >
                    {copied[i] ? (
                      <Check className="size-3.5 text-[var(--green)]" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(i)}
                    disabled={saving}
                    className="p-1.5 rounded-[5px] text-[var(--text-3)] hover:text-red-400 hover:bg-[var(--bg-3)] transition-colors disabled:opacity-50"
                    title="Delete reference"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* Content preview */}
              <p className="text-xs text-[var(--text-2)] line-clamp-4 whitespace-pre-wrap leading-relaxed">
                {ref.content}
              </p>
            </div>
          ))}
        </div>
      )}

      {saving && (
        <p className="text-[11px] font-[family-name:var(--font-mono)] text-[var(--text-3)]">
          Saving...
        </p>
      )}
    </div>
  );
}
