'use client';

import { useState, useCallback, useEffect } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useScriptPackRealtime } from '@/lib/scripts/use-script-pack-realtime';
import { AwarenessTabs } from './awareness-tabs';
import { ScriptItem } from './script-item';
import type { AwarenessLevel } from './awareness-tabs';
import type { AdScript } from '@/lib/scripts/schemas';

const AWARENESS_LEVELS_COUNT = 5;
const SCRIPTS_PER_LEVEL_COUNT = 3;

const PLATFORM_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'meta', label: 'Meta' },
  { id: 'google', label: 'Google' },
  { id: 'linkedin', label: 'LinkedIn' },
] as const;

type PlatformFilter = 'all' | 'meta' | 'google' | 'linkedin';

const AWARENESS_LABELS: Record<string, string> = {
  unaware: 'Unaware',
  problem: 'Problem Aware',
  solution: 'Solution Aware',
  product: 'Product Aware',
  mostAware: 'Most Aware',
};

interface ScriptPackViewerProps {
  profileId: string;
  sessionId: string;
  initialScripts?: AdScript[];
  initialPackId?: string;
}

function isAdScript(s: unknown): s is AdScript {
  return (
    typeof s === 'object' &&
    s !== null &&
    'id' in s &&
    'type' in s &&
    'platform' in s &&
    'awarenessLevel' in s
  );
}

function buildAwarenessCounts(scripts: AdScript[]): Partial<Record<AwarenessLevel, number>> {
  const counts: Partial<Record<AwarenessLevel, number>> = {};
  for (const s of scripts) {
    const level = s.awarenessLevel as AwarenessLevel;
    counts[level] = (counts[level] ?? 0) + 1;
  }
  return counts;
}

export function ScriptPackViewer({
  profileId,
  sessionId,
  initialScripts,
  initialPackId,
}: ScriptPackViewerProps) {
  const [packId, setPackId] = useState<string | null>(initialPackId ?? null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [localScripts, setLocalScripts] = useState<AdScript[]>(initialScripts ?? []);
  const [awarenessFilter, setAwarenessFilter] = useState<AwarenessLevel>('all');
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const [loadingPack, setLoadingPack] = useState(!initialPackId);
  const [diversityFlags, setDiversityFlags] = useState<string[]>([]);
  const [diversityScore, setDiversityScore] = useState<number | null>(null);

  // Self-fetch latest pack if no initial data provided (handles tab-switch reload)
  useEffect(() => {
    if (initialPackId || initialScripts?.length) return;
    let cancelled = false;
    fetch(`/api/profiles/${profileId}/script-packs`)
      .then((res) => res.json())
      .then(({ packs }) => {
        if (cancelled || !packs?.length) { setLoadingPack(false); return; }
        const p = packs[0];
        const scripts = typeof p.scripts === 'string' ? JSON.parse(p.scripts) : p.scripts;
        if ((p.status === 'complete' || p.status === 'partial') && scripts?.length > 0) {
          setPackId(p.id);
          setLocalScripts(scripts.filter(isAdScript));
          // Load diversity data if present
          if (p.diversity_flags) {
            const flags = typeof p.diversity_flags === 'string' ? JSON.parse(p.diversity_flags) : p.diversity_flags;
            if (Array.isArray(flags)) setDiversityFlags(flags);
          }
          if (typeof p.diversity_score === 'number') setDiversityScore(p.diversity_score);
        }
        setLoadingPack(false);
      })
      .catch(() => setLoadingPack(false));
    return () => { cancelled = true; };
  }, [profileId, initialPackId, initialScripts]);

  const onComplete = useCallback(
    (state: { scripts: unknown[] }) => {
      const parsed = (state.scripts ?? []).filter(isAdScript);
      setLocalScripts(parsed);
      setGenerating(false);

      // Fetch diversity data from the completed pack
      if (packId) {
        fetch(`/api/scripts/${packId}`)
          .then((res) => res.json())
          .then(({ pack }) => {
            if (pack?.diversity_flags) {
              const flags = typeof pack.diversity_flags === 'string'
                ? JSON.parse(pack.diversity_flags)
                : pack.diversity_flags;
              if (Array.isArray(flags)) setDiversityFlags(flags);
            }
            if (typeof pack?.diversity_score === 'number') {
              setDiversityScore(pack.diversity_score);
            }
          })
          .catch(() => {});
      }
    },
    [packId],
  );

  const realtimeState = useScriptPackRealtime({
    packId,
    enabled: generating || (packId !== null && localScripts.length === 0),
    onComplete,
  });

  // Use realtime scripts if available, else local
  const activeScripts: AdScript[] =
    realtimeState.scripts.length > 0
      ? realtimeState.scripts.filter(isAdScript)
      : localScripts;

  const isPolling =
    realtimeState.status === 'generating' || realtimeState.status === 'partial';

  // Derive generation progress from script count (3 scripts per level, 5 levels)
  const completedLevels = Math.floor(activeScripts.length / 3);
  const currentLevelIndex = Math.min(completedLevels, 4);
  const LEVEL_ORDER = ['unaware', 'problem', 'solution', 'product', 'mostAware'];
  const currentLevelLabel = AWARENESS_LABELS[LEVEL_ORDER[currentLevelIndex]] ?? '';

  async function handleGenerate() {
    setGenError(null);
    setGenerating(true);
    setLocalScripts([]);
    setDiversityFlags([]);
    setDiversityScore(null);
    try {
      const res = await fetch('/api/scripts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, sessionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenError(data.error ?? 'Generation failed');
        setGenerating(false);
        return;
      }
      setPackId(data.packId);
    } catch {
      setGenError('Network error — try again');
      setGenerating(false);
    }
  }

  function handleScriptUpdate(scriptId: string, updates: Partial<AdScript>) {
    setLocalScripts((prev) =>
      prev.map((s) => (s.id === scriptId ? { ...s, ...updates } : s)),
    );
  }

  if (loadingPack) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-5 animate-spin text-[var(--text-tertiary)]" />
      </div>
    );
  }

  // Compute stats
  const totalVideo = activeScripts.filter((s) => s.type === 'video').length;
  const totalStatic = activeScripts.filter((s) => s.type === 'static').length;
  const totalEmail = activeScripts.filter((s) => s.type === 'email').length;
  const awarenessCounts = buildAwarenessCounts(activeScripts);

  // Filter scripts
  const filteredScripts = activeScripts.filter((s) => {
    const matchAwareness =
      awarenessFilter === 'all' || s.awarenessLevel === awarenessFilter;
    const matchPlatform =
      platformFilter === 'all' || s.platform === platformFilter;
    return matchAwareness && matchPlatform;
  });

  return (
    <div className="space-y-6">
      {/* Stats bar + generate button */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-[11px] uppercase tracking-[0.06em] font-mono text-[var(--text-quaternary)]">
              Total
            </span>{' '}
            <span className="text-[20px] font-mono font-semibold text-[var(--text-primary)] tabular-nums">
              {activeScripts.length}
            </span>
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-[0.06em] font-mono text-[var(--text-quaternary)]">
              Video
            </span>{' '}
            <span className="text-[13px] font-mono text-[var(--text-primary)] tabular-nums">
              {totalVideo}
            </span>
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-[0.06em] font-mono text-[var(--text-quaternary)]">
              Static
            </span>{' '}
            <span className="text-[13px] font-mono text-[var(--text-primary)] tabular-nums">
              {totalStatic}
            </span>
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-[0.06em] font-mono text-[var(--text-quaternary)]">
              Email
            </span>{' '}
            <span className="text-[13px] font-mono text-[var(--text-primary)] tabular-nums">
              {totalEmail}
            </span>
          </div>
        </div>

        <Button
          size="sm"
          onClick={handleGenerate}
          disabled={generating || isPolling}
          className={cn(
            'gap-1.5 text-xs px-4 py-2 rounded-md font-medium',
            'bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue-hover)]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          {generating || isPolling ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
          {generating || isPolling ? 'Generating...' : 'Generate New Batch'}
        </Button>
      </div>

      {genError && (
        <p className="text-xs text-red-500 font-mono">{genError}</p>
      )}

      {/* Diversity flags */}
      {diversityFlags.length > 0 && (
        <div className="rounded-lg border border-[var(--accent-amber)]/20 bg-[var(--accent-amber)]/5 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] uppercase tracking-[0.06em] font-mono font-medium text-[var(--accent-amber)]">
              Batch Review Notes
            </p>
            {diversityScore !== null && (
              <span className="text-[11px] font-mono text-[var(--text-tertiary)]">
                Diversity: {diversityScore}/10
              </span>
            )}
          </div>
          {diversityFlags.map((flag, i) => (
            <p key={i} className="text-xs text-[var(--text-secondary)]">{flag}</p>
          ))}
        </div>
      )}

      {/* Awareness filter tabs */}
      {activeScripts.length > 0 && (
        <AwarenessTabs
          active={awarenessFilter}
          counts={awarenessCounts}
          total={activeScripts.length}
          onChange={setAwarenessFilter}
        />
      )}

      {/* Platform filter pills */}
      {activeScripts.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {PLATFORM_FILTERS.map((p) => {
            const isActive = platformFilter === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setPlatformFilter(p.id)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium transition-colors duration-100',
                  isActive
                    ? 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]',
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Script list */}
      {filteredScripts.length > 0 ? (
        <div className="space-y-3">
          {filteredScripts.map((script) => (
            <ScriptItem
              key={script.id}
              script={script}
              packId={packId ?? ''}
              onUpdate={handleScriptUpdate}
            />
          ))}
        </div>
      ) : activeScripts.length > 0 ? (
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] px-6 py-8 text-center">
          <p className="text-sm text-[var(--text-tertiary)]">No scripts match the current filters.</p>
        </div>
      ) : null}

      {/* Empty state (no scripts ever generated) */}
      {activeScripts.length === 0 && !generating && !isPolling && (
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] px-6 py-12 text-center">
          <Sparkles className="size-6 text-[var(--text-quaternary)] mx-auto mb-3" />
          <p className="text-sm text-[var(--text-secondary)] mb-1">No scripts yet</p>
          <p className="text-xs text-[var(--text-tertiary)] max-w-sm mx-auto">
            Generate a batch of ad scripts grounded in your research data.
          </p>
        </div>
      )}

      {/* Generation progress */}
      {(generating || isPolling) && (
        <div className="rounded-lg border border-[var(--accent-blue)]/20 bg-[var(--accent-blue)]/5 px-5 py-4">
          <div className="flex items-center gap-3 mb-3">
            <Loader2 className="size-4 animate-spin text-[var(--accent-blue)]" />
            <span className="text-sm font-medium text-[var(--text-primary)]">
              Generating scripts...
            </span>
          </div>

          {/* Level progress bar */}
          <div className="flex gap-1.5 mb-2">
            {LEVEL_ORDER.map((level, i) => (
              <div
                key={level}
                className="flex-1 h-1.5 rounded-full overflow-hidden"
                style={{ background: 'var(--border-default)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: i < completedLevels ? '100%' : i === completedLevels && isPolling ? '50%' : '0%',
                    background: 'var(--accent-blue)',
                  }}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-[var(--text-tertiary)]">
              {completedLevels < 5
                ? `${currentLevelLabel} (${completedLevels + 1}/5)`
                : 'Finalizing...'}
            </span>
            <span className="text-[11px] font-mono text-[var(--text-quaternary)] tabular-nums">
              {activeScripts.length}/{AWARENESS_LEVELS_COUNT * SCRIPTS_PER_LEVEL_COUNT} scripts
            </span>
          </div>

          {/* Show partial scripts inline */}
          {activeScripts.length > 0 && (
            <p className="text-[11px] text-[var(--text-tertiary)] mt-2">
              {activeScripts.length} scripts ready — more incoming...
            </p>
          )}
        </div>
      )}

      {/* Error state from realtime */}
      {realtimeState.status === 'error' && (
        <div className="rounded-lg border border-red-500/20 bg-red-50 dark:bg-red-500/5 px-4 py-3">
          <p className="text-xs text-red-600 dark:text-red-400">
            {realtimeState.errorMessage ?? 'Script generation failed. Please try again.'}
          </p>
        </div>
      )}
    </div>
  );
}
