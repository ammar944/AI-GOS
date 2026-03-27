'use client';

import { useState, useCallback } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useScriptPackRealtime } from '@/lib/scripts/use-script-pack-realtime';
import { AwarenessTabs } from './awareness-tabs';
import { ScriptItem } from './script-item';
import type { AwarenessLevel } from './awareness-tabs';
import type { AdScript } from '@/lib/scripts/schemas';

const PLATFORM_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'meta', label: 'Meta' },
  { id: 'google', label: 'Google' },
  { id: 'linkedin', label: 'LinkedIn' },
] as const;

type PlatformFilter = 'all' | 'meta' | 'google' | 'linkedin';

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

  const onComplete = useCallback(
    (state: { scripts: unknown[] }) => {
      const parsed = (state.scripts ?? []).filter(isAdScript);
      setLocalScripts(parsed);
      setGenerating(false);
    },
    [],
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

  async function handleGenerate() {
    setGenError(null);
    setGenerating(true);
    setLocalScripts([]);
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
            <span className="text-[11px] uppercase tracking-[0.06em] font-[family-name:var(--font-mono)] text-[var(--text-3)]">
              Total
            </span>{' '}
            <span className="text-[20px] font-[family-name:var(--font-mono)] font-semibold text-[var(--text-1)] tabular-nums">
              {activeScripts.length}
            </span>
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-[0.06em] font-[family-name:var(--font-mono)] text-[var(--text-3)]">
              Video
            </span>{' '}
            <span className="text-[13px] font-[family-name:var(--font-mono)] text-[var(--text-1)] tabular-nums">
              {totalVideo}
            </span>
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-[0.06em] font-[family-name:var(--font-mono)] text-[var(--text-3)]">
              Static
            </span>{' '}
            <span className="text-[13px] font-[family-name:var(--font-mono)] text-[var(--text-1)] tabular-nums">
              {totalStatic}
            </span>
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-[0.06em] font-[family-name:var(--font-mono)] text-[var(--text-3)]">
              Email
            </span>{' '}
            <span className="text-[13px] font-[family-name:var(--font-mono)] text-[var(--text-1)] tabular-nums">
              {totalEmail}
            </span>
          </div>
        </div>

        <Button
          size="sm"
          onClick={handleGenerate}
          disabled={generating || isPolling}
          className={cn(
            'gap-1.5 text-xs px-3 py-1.5 rounded-[5px] bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]',
            'disabled:opacity-60 disabled:cursor-not-allowed',
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
        <p className="text-xs text-red-400 font-[family-name:var(--font-mono)]">{genError}</p>
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
                  'px-2.5 py-1 rounded-[5px] text-xs font-medium transition-colors duration-100',
                  isActive
                    ? 'bg-[var(--bg-3)] text-[var(--text-1)]'
                    : 'text-[var(--text-3)] hover:text-[var(--text-2)]',
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
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-6 py-8 text-center">
          <p className="text-sm text-[var(--text-3)]">No scripts match the current filters.</p>
        </div>
      ) : null}

      {/* Empty state (no scripts ever generated) */}
      {activeScripts.length === 0 && !generating && !isPolling && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-6 py-12 text-center">
          <Sparkles className="size-6 text-[var(--text-4)] mx-auto mb-3" />
          <p className="text-sm text-[var(--text-3)] mb-1">No scripts yet</p>
          <p className="text-xs text-[var(--text-4)] max-w-sm mx-auto">
            Generate a batch of ad scripts grounded in your research data.
          </p>
        </div>
      )}

      {/* Progressive rendering spinner */}
      {(generating || isPolling) && activeScripts.length === 0 && (
        <div className="flex items-center gap-2 py-4">
          <Loader2 className="size-4 animate-spin text-[var(--text-3)]" />
          <span className="text-sm text-[var(--text-3)]">Generating scripts...</span>
        </div>
      )}

      {/* Partial results spinner */}
      {isPolling && activeScripts.length > 0 && (
        <div className="flex items-center gap-2 py-2">
          <Loader2 className="size-3.5 animate-spin text-[var(--text-4)]" />
          <span className="text-xs font-[family-name:var(--font-mono)] text-[var(--text-4)]">
            More scripts incoming...
          </span>
        </div>
      )}

      {/* Error state from realtime */}
      {realtimeState.status === 'error' && (
        <div className="rounded-lg border border-red-400/20 bg-red-400/5 px-4 py-3">
          <p className="text-xs text-red-400">
            {realtimeState.errorMessage ?? 'Script generation failed. Please try again.'}
          </p>
        </div>
      )}
    </div>
  );
}
