'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PhaseTransitionCard } from './phase-transition-card';
import { SectionHeader } from './section-header';
import { ScriptPackViewer } from '@/components/scripts/script-pack-viewer';
import { useScriptPackRealtime } from '@/lib/scripts/use-script-pack-realtime';
import type { AdScript, PackListItem } from '@/lib/scripts/schemas';

interface SessionInfo {
  sessionId: string | null; // internal UUID
  profileId: string | null;
}

interface ScriptsPhaseContentProps {
  activeRunId: string | null;
}

/**
 * Self-contained scripts phase for the workspace.
 *
 * Lifecycle:
 * 1. Fetch session info (profile_id, internal id) on mount
 * 2. Check for existing script pack for this session
 * 3. Show CTA (PhaseTransitionCard) — or guard if no profile
 * 4. On generate: POST /api/scripts/generate → poll via useScriptPackRealtime
 * 5. Show ScriptPackViewer when scripts arrive
 */
export function ScriptsPhaseContent({ activeRunId }: ScriptsPhaseContentProps) {
  const [sessionInfo, setSessionInfo] = useState<SessionInfo>({ sessionId: null, profileId: null });
  const [loading, setLoading] = useState(true);
  const [packId, setPackId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedScripts, setCompletedScripts] = useState<AdScript[]>([]);
  const fetchedRef = useRef(false);

  // Fetch session info + check for existing script pack
  useEffect(() => {
    if (!activeRunId || fetchedRef.current) return;
    fetchedRef.current = true;

    (async () => {
      try {
        const res = await fetch(`/api/journey/session?runId=${activeRunId}`, {
          cache: 'no-store',
          credentials: 'same-origin',
        });
        if (!res.ok) { setLoading(false); return; }
        const data = await res.json();
        const profileId: string | null = data.profileId ?? null;
        const sessionId: string | null = data.sessionId ?? null;
        setSessionInfo({ sessionId, profileId });

        // Check for existing script packs if profile exists
        if (profileId) {
          const packsRes = await fetch(`/api/profiles/${profileId}/script-packs`, {
            credentials: 'same-origin',
          });
          if (packsRes.ok) {
            const packsData = await packsRes.json();
            const packs = packsData.packs ?? [];
            // Find the most recent pack for this session
            const matchingPack = packs.find(
              (p: PackListItem) =>
                (p.status === 'complete' || p.status === 'generating') &&
                p.generation_context?.researchSessionRunId === activeRunId,
            );
            if (matchingPack) {
              setPackId(matchingPack.id);
              if (matchingPack.status === 'generating') {
                setGenerating(true);
              }
            }
          }
        }
      } catch {
        // Fall through — will show CTA
      } finally {
        setLoading(false);
      }
    })();
  }, [activeRunId]);

  // Poll for script pack updates when we have a packId
  const packState = useScriptPackRealtime({
    packId,
    enabled: !!packId,
    onComplete: (state) => {
      setCompletedScripts(state.scripts as AdScript[]);
      setGenerating(false);
    },
  });

  // Generate scripts
  const handleGenerate = useCallback(async () => {
    if (!activeRunId || !sessionInfo.profileId) return;
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch('/api/scripts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: sessionInfo.profileId,
          sessionId: activeRunId,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed to generate scripts' }));
        setError(data.error ?? 'Failed to generate scripts');
        setGenerating(false);
        return;
      }

      const data = await res.json();
      setPackId(data.packId);
    } catch {
      setError('Network error — check your connection and try again');
      setGenerating(false);
    }
  }, [activeRunId, sessionInfo.profileId]);

  // Loading state
  if (loading) {
    return (
      <div className="px-6 pt-6">
        <SectionHeader section="scripts" />
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-[var(--bg-hover)] animate-pulse"
                style={{ animationDelay: `${i * 200}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Resolved scripts (complete pack)
  const displayScripts = completedScripts.length > 0
    ? completedScripts
    : (packState.scripts as AdScript[] | undefined) ?? [];

  const isComplete = packState.status === 'complete' || completedScripts.length > 0;
  const isGenerating = generating || packState.status === 'generating' || packState.status === 'partial';

  return (
    <div className="px-6 pt-6 pb-12">
      <SectionHeader section="scripts" />

      {/* Complete: render ScriptPackViewer */}
      {isComplete && displayScripts.length > 0 && (
        <ScriptPackViewer
          scripts={displayScripts}
          packId={packId ?? ''}
        />
      )}

      {/* Generating: render ScriptPackViewer with progress */}
      {!isComplete && isGenerating && (
        <ScriptPackViewer
          scripts={displayScripts}
          packId={packId ?? ''}
          isGenerating
          generatingProgress={{
            completedLevels: Math.floor(displayScripts.length / 3),
            totalScripts: displayScripts.length,
          }}
        />
      )}

      {/* Error state */}
      {!isComplete && !isGenerating && (error || packState.status === 'error') && (
        <PhaseTransitionCard
          tag="Scripts"
          title="Script generation failed"
          description={error ?? packState.errorMessage ?? 'Unknown error — try again.'}
          actionLabel="Retry"
          onAction={handleGenerate}
        />
      )}

      {/* CTA: no profile linked */}
      {!isComplete && !isGenerating && !error && packState.status !== 'error' && !sessionInfo.profileId && (
        <PhaseTransitionCard
          tag="Next Phase"
          title="Generate your ad scripts"
          description="15 scripts across 5 awareness levels, grounded in your research and media plan."
          actionLabel="Generate Scripts"
          onAction={() => {}}
          disabled
          disabledReason="Scripts require a linked profile. Complete the full research pipeline to auto-link a profile."
        />
      )}

      {/* CTA: ready to generate */}
      {!isComplete && !isGenerating && !error && packState.status !== 'error' && !!sessionInfo.profileId && !packId && (
        <PhaseTransitionCard
          tag="Next Phase"
          title="Generate your ad scripts"
          description="15 scripts across 5 awareness levels, grounded in your research and media plan."
          actionLabel="Generate Scripts"
          onAction={handleGenerate}
          isLoading={generating}
        />
      )}
    </div>
  );
}
