'use client';

import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AwarenessTabs } from './awareness-tabs';
import { ScriptItem } from './script-item';
import type { AwarenessLevel } from './awareness-tabs';
import type { AdScript, GenerationContext } from '@/lib/scripts/schemas';

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

const LEVEL_ORDER = ['unaware', 'problem', 'solution', 'product', 'mostAware'];

function buildAwarenessCounts(scripts: AdScript[]): Partial<Record<AwarenessLevel, number>> {
  const counts: Partial<Record<AwarenessLevel, number>> = {};
  for (const s of scripts) {
    const level = s.awarenessLevel as AwarenessLevel;
    counts[level] = (counts[level] ?? 0) + 1;
  }
  return counts;
}

export interface ScriptPackViewerProps {
  scripts: AdScript[];
  generationContext?: GenerationContext | null;
  diversityFlags?: string[];
  diversityScore?: number | null;
  isGenerating?: boolean;
  generatingProgress?: { completedLevels: number; totalScripts: number };
  onScriptUpdate?: (scriptId: string, updates: Partial<AdScript>) => void;
  packId: string;
}

export function ScriptPackViewer({
  scripts,
  diversityFlags = [],
  diversityScore = null,
  isGenerating = false,
  generatingProgress,
  onScriptUpdate,
  packId,
}: ScriptPackViewerProps) {
  const [awarenessFilter, setAwarenessFilter] = useState<AwarenessLevel>('all');
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const [localScripts, setLocalScripts] = useState<AdScript[]>(scripts);

  // Sync local scripts when prop changes (new pack selected)
  // Use a derived value so we don't need a useEffect
  const activeScripts: AdScript[] = scripts.length > 0 ? scripts : localScripts;

  // Derive generation progress from script count when not explicitly provided
  const completedLevels =
    generatingProgress?.completedLevels ?? Math.floor(activeScripts.length / SCRIPTS_PER_LEVEL_COUNT);
  const currentLevelIndex = Math.min(completedLevels, 4);
  const currentLevelLabel = AWARENESS_LABELS[LEVEL_ORDER[currentLevelIndex]] ?? '';

  function handleScriptUpdate(scriptId: string, updates: Partial<AdScript>) {
    setLocalScripts((prev) =>
      prev.map((s) => (s.id === scriptId ? { ...s, ...updates } : s)),
    );
    onScriptUpdate?.(scriptId, updates);
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
      {/* Stats bar */}
      <div className="flex items-center gap-6 flex-wrap">
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
              packId={packId}
              onUpdate={handleScriptUpdate}
            />
          ))}
        </div>
      ) : activeScripts.length > 0 ? (
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] px-6 py-8 text-center">
          <p className="text-sm text-[var(--text-tertiary)]">No scripts match the current filters.</p>
        </div>
      ) : null}

      {/* Empty state (no scripts yet) */}
      {activeScripts.length === 0 && !isGenerating && (
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] px-6 py-12 text-center">
          <Sparkles className="size-6 text-[var(--text-quaternary)] mx-auto mb-3" />
          <p className="text-sm text-[var(--text-secondary)] mb-1">No scripts yet</p>
          <p className="text-xs text-[var(--text-tertiary)] max-w-sm mx-auto">
            Generate a batch of ad scripts grounded in your research data.
          </p>
        </div>
      )}

      {/* Generation progress */}
      {isGenerating && (
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
                    width: i < completedLevels ? '100%' : i === completedLevels ? '50%' : '0%',
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

          {activeScripts.length > 0 && (
            <p className="text-[11px] text-[var(--text-tertiary)] mt-2">
              {activeScripts.length} scripts ready — more incoming...
            </p>
          )}
        </div>
      )}
    </div>
  );
}
