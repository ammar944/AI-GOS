'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { AssetStyleRefs } from '@/components/assets/asset-style-refs';
import { AssetProofPoints } from '@/components/assets/asset-proof-points';
import { AssetBrandVoice } from '@/components/assets/asset-brand-voice';
import type { StyleReference, ProofPoint, BrandVoiceNotes } from '@/lib/profiles/business-profiles';

interface StyleRefsTabProps {
  profileId: string;
  initialRefs: StyleReference[] | null;
  initialProofPoints?: ProofPoint[];
  initialBrandVoice?: BrandVoiceNotes | null;
}

type Tab = 'style-refs' | 'proof-points' | 'voice';

const TABS: { id: Tab; label: string }[] = [
  { id: 'style-refs', label: 'Style References' },
  { id: 'proof-points', label: 'Proof Points' },
  { id: 'voice', label: 'Brand Voice' },
];

export function StyleRefsTab({ profileId, initialRefs, initialProofPoints, initialBrandVoice }: StyleRefsTabProps) {
  const [activeTab, setActiveTab] = useState<Tab>('style-refs');
  const [styleRefs, setStyleRefs] = useState<StyleReference[]>(initialRefs ?? []);
  const [proofPoints, setProofPoints] = useState<ProofPoint[]>(initialProofPoints ?? []);
  const [brandVoice, setBrandVoice] = useState<BrandVoiceNotes | null>(initialBrandVoice ?? null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const persist = useCallback(async (
    refs: StyleReference[],
    points: ProofPoint[],
    voice: BrandVoiceNotes | null,
  ) => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/profiles/${profileId}/style-references`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          styleReferences: refs,
          proofPoints: points,
          brandVoiceNotes: voice,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Save failed' }));
        setSaveError(err.error ?? 'Save failed');
      }
    } catch {
      setSaveError('Network error');
    } finally {
      setSaving(false);
    }
  }, [profileId]);

  const handleStyleRefsChange = useCallback((refs: StyleReference[]) => {
    setStyleRefs(refs);
    void persist(refs, proofPoints, brandVoice);
  }, [proofPoints, brandVoice, persist]);

  const handleProofPointsChange = useCallback((points: ProofPoint[]) => {
    setProofPoints(points);
    void persist(styleRefs, points, brandVoice);
  }, [styleRefs, brandVoice, persist]);

  const handleBrandVoiceChange = useCallback((voice: BrandVoiceNotes) => {
    setBrandVoice(voice);
    void persist(styleRefs, proofPoints, voice);
  }, [styleRefs, proofPoints, persist]);

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-0 border-b border-[var(--border-subtle)] mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-5 py-2.5 text-[13px] font-medium transition-colors border-b-2',
              activeTab === tab.id
                ? 'text-[var(--text-primary)] border-[var(--text-primary)]'
                : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)]',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'style-refs' && (
        <AssetStyleRefs refs={styleRefs} onChange={handleStyleRefsChange} />
      )}
      {activeTab === 'proof-points' && (
        <AssetProofPoints points={proofPoints} onChange={handleProofPointsChange} />
      )}
      {activeTab === 'voice' && (
        <AssetBrandVoice value={brandVoice} onChange={handleBrandVoiceChange} />
      )}

      {/* Save status */}
      <div className="mt-4 text-xs">
        {saving && <span className="text-[var(--text-muted)]">Saving...</span>}
        {saveError && <span className="text-red-400">{saveError}</span>}
      </div>
    </div>
  );
}
