'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { AssetStyleRefs } from '@/components/assets/asset-style-refs';
import { AssetProofPoints } from '@/components/assets/asset-proof-points';
import { AssetBrandVoice } from '@/components/assets/asset-brand-voice';
import type { StyleReference, ProofPoint, BrandVoiceNotes } from '@/lib/profiles/business-profiles';

interface AssetCollectionPhaseProps {
  runId: string;
  onGenerateScripts: () => void;
  onSkip: () => void;
}

type Tab = 'style-refs' | 'proof-points' | 'voice';

const TABS: { id: Tab; label: string }[] = [
  { id: 'style-refs', label: 'Style References' },
  { id: 'proof-points', label: 'Proof Points' },
  { id: 'voice', label: 'Brand Voice' },
];

export function AssetCollectionPhase({ runId, onGenerateScripts, onSkip }: AssetCollectionPhaseProps) {
  const [loading, setLoading] = useState(true);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('style-refs');
  const [styleRefs, setStyleRefs] = useState<StyleReference[]>([]);
  const [proofPoints, setProofPoints] = useState<ProofPoint[]>([]);
  const [brandVoice, setBrandVoice] = useState<BrandVoiceNotes | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchedRef = useRef(false);
  // Track latest values for flush-save (avoids stale closure)
  const latestRef = useRef({ styleRefs, proofPoints, brandVoice });
  latestRef.current = { styleRefs, proofPoints, brandVoice };

  // Fetch profile data on mount — same pattern as ScriptsPhaseContent
  useEffect(() => {
    if (!runId || fetchedRef.current) return;
    fetchedRef.current = true;

    (async () => {
      try {
        const res = await fetch(`/api/journey/session?runId=${runId}`, {
          cache: 'no-store',
          credentials: 'same-origin',
        });
        if (!res.ok) { setLoading(false); return; }
        const data = await res.json();
        const pid: string | null = data.profileId ?? null;
        setProfileId(pid);

        if (pid) {
          const profileRes = await fetch(`/api/profiles/${pid}`, { credentials: 'same-origin' });
          if (profileRes.ok) {
            const profile = await profileRes.json();
            setStyleRefs(profile.styleReferences ?? []);
            setProofPoints(profile.proofPoints ?? []);
            setBrandVoice(profile.brandVoiceNotes ?? null);
          }
        }
      } catch {
        // Fall through — empty state is fine
      } finally {
        setLoading(false);
      }
    })();
  }, [runId]);

  // Persist to Supabase via API
  const persistAssets = useCallback(async (
    refs: StyleReference[],
    points: ProofPoint[],
    voice: BrandVoiceNotes | null,
  ): Promise<boolean> => {
    if (!profileId) return false;
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
        return false;
      }
      return true;
    } catch {
      setSaveError('Network error — changes not saved');
      return false;
    } finally {
      setSaving(false);
    }
  }, [profileId]);

  // Debounced auto-save
  const scheduleAutoSave = useCallback((
    refs: StyleReference[],
    points: ProofPoint[],
    voice: BrandVoiceNotes | null,
  ) => {
    if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void persistAssets(refs, points, voice); }, 500);
  }, [persistAssets]);

  // Handlers that update state + trigger auto-save
  const handleStyleRefsChange = useCallback((refs: StyleReference[]) => {
    setStyleRefs(refs);
    scheduleAutoSave(refs, proofPoints, brandVoice);
  }, [proofPoints, brandVoice, scheduleAutoSave]);

  const handleProofPointsChange = useCallback((points: ProofPoint[]) => {
    setProofPoints(points);
    scheduleAutoSave(styleRefs, points, brandVoice);
  }, [styleRefs, brandVoice, scheduleAutoSave]);

  const handleBrandVoiceChange = useCallback((voice: BrandVoiceNotes) => {
    setBrandVoice(voice);
    scheduleAutoSave(styleRefs, proofPoints, voice);
  }, [styleRefs, proofPoints, scheduleAutoSave]);

  // Flush-save then generate (Fix 2: race condition prevention)
  const handleGenerateScripts = useCallback(async () => {
    // Cancel pending debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setGenerating(true);
    // Use latest ref values to avoid stale closure
    const { styleRefs: sr, proofPoints: pp, brandVoice: bv } = latestRef.current;
    const ok = await persistAssets(sr, pp, bv);
    if (!ok) {
      setGenerating(false);
      return; // Don't navigate if save failed
    }
    onGenerateScripts();
  }, [persistAssets, onGenerateScripts]);

  const totalAssets = styleRefs.length + proofPoints.length + (brandVoice && (brandVoice.tone || brandVoice.constraints) ? 1 : 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-[var(--accent-blue)] animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 rounded-full bg-[var(--accent-blue)] animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 rounded-full bg-[var(--accent-blue)] animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Header */}
      <div className="border-b border-[var(--border-subtle)] px-8 pt-8 pb-0 flex-shrink-0">
        <div className="flex justify-between items-start mb-5">
          <div>
            <div className="text-[11px] uppercase tracking-[1.5px] text-[var(--accent-blue)] font-mono mb-2">Optional Step</div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-1.5">Enhance Your Ad Scripts</h2>
            <p className="text-sm text-[var(--text-secondary)] max-w-[500px]">
              Add reference materials, proof points, and voice guidelines to make your scripts match your brand.
              You can always add these later from your profile.
            </p>
          </div>
          <div className="flex gap-2.5 items-center pt-1">
            <button
              onClick={onSkip}
              className="px-4 py-2 text-sm text-[var(--text-muted)] border border-[var(--border-subtle)] rounded-md hover:text-[var(--text-primary)] transition-colors"
            >
              Skip to Scripts
            </button>
            <button
              onClick={handleGenerateScripts}
              disabled={generating}
              className={cn(
                'px-5 py-2 rounded-md text-sm font-medium transition-colors',
                'bg-[var(--accent-blue)] text-white',
                'disabled:opacity-60 disabled:cursor-not-allowed',
              )}
            >
              {generating ? 'Saving...' : 'Generate Scripts →'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-5 py-2.5 text-[13px] font-medium transition-colors border-b-2',
                activeTab === tab.id
                  ? 'text-[var(--text-primary)] border-[var(--accent-blue)]'
                  : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)]',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-8 py-6 flex-1 overflow-y-auto custom-scrollbar">
        {activeTab === 'style-refs' && (
          <AssetStyleRefs refs={styleRefs} onChange={handleStyleRefsChange} />
        )}
        {activeTab === 'proof-points' && (
          <AssetProofPoints points={proofPoints} onChange={handleProofPointsChange} />
        )}
        {activeTab === 'voice' && (
          <AssetBrandVoice value={brandVoice} onChange={handleBrandVoiceChange} />
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-[var(--border-subtle)] px-8 py-4 flex justify-between items-center flex-shrink-0">
        <div className="flex gap-4">
          <span className="text-xs text-[var(--text-muted)]">
            <span className={cn('font-semibold', styleRefs.length > 0 ? 'text-[var(--accent-blue)]' : '')}>{styleRefs.length}</span> style refs
          </span>
          <span className="text-xs text-[var(--text-muted)]">
            <span className={cn('font-semibold', proofPoints.length > 0 ? 'text-[var(--accent-blue)]' : '')}>{proofPoints.length}</span> proof points
          </span>
          <span className="text-xs text-[var(--text-muted)]">
            <span className={cn('font-semibold', brandVoice?.tone ? 'text-[var(--accent-blue)]' : '')}>{brandVoice?.tone ? '1' : '0'}</span> voice notes
          </span>
        </div>
        <div className="flex items-center gap-2">
          {saveError && <span className="text-xs text-red-400">{saveError}</span>}
          {saving && <span className="text-xs text-[var(--text-muted)]">Saving...</span>}
          {!saving && !saveError && totalAssets > 0 && <span className="text-xs text-[var(--text-muted)]">Auto-saved to profile</span>}
        </div>
      </div>
    </div>
  );
}
