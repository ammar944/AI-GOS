'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Sparkles, Loader2, ArrowLeft, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ProfileSession } from '@/lib/profiles/business-profiles';
import type { PackListItem, AdScript, GenerationContext } from '@/lib/scripts/schemas';
import { PackContextCard } from './pack-context-card';
import { ScriptPackViewer } from './script-pack-viewer';

interface ScriptWorkbenchProps {
  profileId: string;
}

type RightPaneView = 'scripts' | 'generate' | 'empty';

interface SelectedPackData {
  scripts: AdScript[];
  generation_context: GenerationContext | null;
  diversity_score: number | null;
  diversity_flags: string[];
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

function parseScripts(raw: unknown): AdScript[] {
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(arr)) return [];
    return arr.filter(isAdScript);
  } catch {
    return [];
  }
}

function parseDiversityFlags(raw: unknown): string[] {
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(arr)) return [];
    return arr.filter((v): v is string => typeof v === 'string');
  } catch {
    return [];
  }
}

function StatusBadge({ status }: { status: PackListItem['status'] }) {
  const styles: Record<PackListItem['status'], { bg: string; color: string; label: string }> = {
    complete: {
      bg: 'rgba(34,197,94,0.10)',
      color: 'var(--green, #22c55e)',
      label: 'Complete',
    },
    generating: {
      bg: 'rgba(54,94,255,0.10)',
      color: 'var(--accent, #365eff)',
      label: 'Generating',
    },
    partial: {
      bg: 'rgba(54,94,255,0.10)',
      color: 'var(--accent, #365eff)',
      label: 'Partial',
    },
    error: {
      bg: 'rgba(239,68,68,0.10)',
      color: 'var(--red, #ef4444)',
      label: 'Error',
    },
  };

  const s = styles[status] ?? styles.error;
  return (
    <span
      className="inline-flex items-center px-[7px] py-[1px] rounded-full text-[10px] font-mono font-medium"
      style={{ background: s.bg, color: s.color, borderRadius: 9999 }}
    >
      <span className="sr-only">Status: </span>
      {s.label}
    </span>
  );
}

function PackListSkeleton() {
  return (
    <div className="space-y-px" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="px-4 py-3 animate-pulse"
        >
          <div
            className="h-3.5 rounded mb-2"
            style={{ background: 'var(--bg-hover)', width: '60%' }}
          />
          <div
            className="h-3 rounded"
            style={{ background: 'var(--bg-hover)', width: '40%' }}
          />
        </div>
      ))}
    </div>
  );
}

export function ScriptWorkbench({ profileId }: ScriptWorkbenchProps) {
  const [packs, setPacks] = useState<PackListItem[]>([]);
  const [packsLoading, setPacksLoading] = useState(true);
  const [packsError, setPacksError] = useState(false);

  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [selectedPackData, setSelectedPackData] = useState<SelectedPackData | null>(null);
  const [packDetailLoading, setPackDetailLoading] = useState(false);
  const [packDetailError, setPackDetailError] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [generatingPackId, setGeneratingPackId] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<ProfileSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  const [rightPaneView, setRightPaneView] = useState<RightPaneView>('empty');
  const [mobileShowingPack, setMobileShowingPack] = useState(false);

  const [userNote, setUserNote] = useState('');
  const [selectedSessionRunId, setSelectedSessionRunId] = useState('');

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Fetch helpers ───────────────────────────────────────────────────────────

  const fetchPacks = useCallback(async () => {
    try {
      const res = await fetch(`/api/profiles/${profileId}/script-packs`);
      if (!res.ok) { setPacksError(true); return; }
      const data = await res.json();
      setPacks(data.packs ?? []);
      setPacksError(false);
    } catch {
      setPacksError(true);
    } finally {
      setPacksLoading(false);
    }
  }, [profileId]);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`/api/profiles/${profileId}/sessions`);
      if (res.ok) {
        const data = await res.json();
        const list: ProfileSession[] = data.sessions ?? [];
        setSessions(list);
        if (list.length > 0 && !selectedSessionRunId) {
          // Default to most complete session
          const best = [...list].sort((a, b) =>
            b.sectionCount !== a.sectionCount
              ? b.sectionCount - a.sectionCount
              : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )[0];
          setSelectedSessionRunId(best.runId);
        }
      }
    } catch {
      // silently fail
    } finally {
      setSessionsLoading(false);
    }
  }, [profileId, selectedSessionRunId]);

  const fetchPackDetail = useCallback(async (packId: string) => {
    setPackDetailLoading(true);
    setPackDetailError(false);
    try {
      const res = await fetch(`/api/scripts/${packId}`);
      if (!res.ok) { setPackDetailError(true); return; }
      const { pack } = await res.json();
      const scripts = parseScripts(pack.scripts);
      const flags = parseDiversityFlags(pack.diversity_flags);
      setSelectedPackData({
        scripts,
        generation_context: pack.generation_context ?? null,
        diversity_score: typeof pack.diversity_score === 'number' ? pack.diversity_score : null,
        diversity_flags: flags,
      });
    } catch {
      setPackDetailError(true);
    } finally {
      setPackDetailLoading(false);
    }
  }, []);

  // ─── Mount ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchPacks();
    fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  // Select most recent complete pack on first load
  useEffect(() => {
    if (packsLoading || packs.length === 0 || selectedPackId) return;
    const first = packs.find((p) => p.status === 'complete' || p.status === 'partial') ?? null;
    if (first) {
      setSelectedPackId(first.id);
      fetchPackDetail(first.id);
      setRightPaneView('scripts');
    }
  }, [packsLoading, packs, selectedPackId, fetchPackDetail]);

  // ─── Polling ─────────────────────────────────────────────────────────────────

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!generating || !generatingPackId) return;

    pollingRef.current = setInterval(async () => {
      const res = await fetch(`/api/profiles/${profileId}/script-packs`).catch(() => null);
      if (!res?.ok) return;
      const data = await res.json();
      const updatedPacks: PackListItem[] = data.packs ?? [];
      setPacks(updatedPacks);

      const target = updatedPacks.find((p) => p.id === generatingPackId);
      if (target && (target.status === 'complete' || target.status === 'error')) {
        stopPolling();
        setGenerating(false);
        if (target.status === 'complete' && selectedPackId === generatingPackId) {
          fetchPackDetail(generatingPackId);
        }
        setGeneratingPackId(null);
      }
    }, 3000);

    return () => stopPolling();
  }, [generating, generatingPackId, profileId, selectedPackId, stopPolling, fetchPackDetail]);

  // ─── Pack selection ───────────────────────────────────────────────────────────

  function handlePackClick(packId: string) {
    if (packId === selectedPackId && rightPaneView === 'scripts') return;
    setSelectedPackId(packId);
    setSelectedPackData(null);
    setRightPaneView('scripts');
    setMobileShowingPack(true);
    fetchPackDetail(packId);
  }

  // ─── Generation ───────────────────────────────────────────────────────────────

  async function handleGenerateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSessionRunId) return;
    setGenError(null);

    try {
      const res = await fetch('/api/scripts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId,
          sessionId: selectedSessionRunId,
          userNote: userNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenError(data.error ?? 'Generation failed');
        return;
      }

      const newPackId: string = data.packId;
      setGeneratingPackId(newPackId);
      setGenerating(true);

      // Optimistically add pack to list
      const optimistic: PackListItem = {
        id: newPackId,
        created_at: new Date().toISOString(),
        status: 'generating',
        generation_context: null,
        style_references_snapshot: null,
        diversity_score: null,
        diversity_flags: null,
        script_count: 0,
      };
      setPacks((prev) => [optimistic, ...prev]);

      setSelectedPackId(newPackId);
      setSelectedPackData(null);
      setRightPaneView('scripts');
      setMobileShowingPack(true);
      setUserNote('');
    } catch {
      setGenError('Network error — try again');
    }
  }

  // ─── Derived ─────────────────────────────────────────────────────────────────

  const anyGenerating = packs.some((p) => p.status === 'generating');
  const isCurrentPackGenerating = generating && generatingPackId === selectedPackId;

  // ─── Render ──────────────────────────────────────────────────────────────────

  const sidebarContent = (
    <div
      role="listbox"
      aria-label="Script batches"
      className="flex flex-col h-full overflow-y-auto"
    >
      {/* Section label */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between shrink-0">
        <span
          className="text-[11px] font-mono font-medium uppercase tracking-[0.06em]"
          style={{ color: 'var(--text-quaternary)' }}
        >
          Batches
          {packs.length > 0 && (
            <span
              className="ml-1.5 tabular-nums"
              style={{ color: 'var(--text-quaternary)' }}
            >
              ({packs.length})
            </span>
          )}
        </span>
      </div>

      {/* Pack list */}
      {packsLoading ? (
        <PackListSkeleton />
      ) : packsError ? (
        <div className="px-4 py-6 text-center">
          <p className="text-[13px] mb-2" style={{ color: 'var(--red, #ef4444)' }}>
            Couldn&apos;t load batches.
          </p>
          <button
            type="button"
            onClick={() => { setPacksLoading(true); fetchPacks(); }}
            className="text-[12px] underline cursor-pointer"
            style={{ color: 'var(--text-tertiary)' }}
          >
            Retry
          </button>
        </div>
      ) : packs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 px-4 text-center gap-2">
          <Sparkles className="size-5" style={{ color: 'var(--text-quaternary)' }} />
          <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
            No batches yet
          </p>
          <p className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
            Generate your first batch
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {packs.map((pack) => {
            const isSelected = pack.id === selectedPackId;
            const packDate = (() => {
              try {
                return new Date(pack.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                });
              } catch {
                return 'Unknown';
              }
            })();

            const note = pack.generation_context?.userNote;
            const scriptCount = pack.script_count;

            return (
              <div
                key={pack.id}
                role="option"
                aria-selected={isSelected}
                onClick={() => handlePackClick(pack.id)}
                className="px-4 py-3 cursor-pointer transition-colors duration-100 min-h-[44px]"
                style={{
                  background: isSelected ? 'var(--bg-3, var(--bg-active, #12141c))' : 'transparent',
                  borderBottom: '1px solid transparent',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }
                }}
              >
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span
                    className="text-[13px] font-medium"
                    style={{
                      fontFamily: 'var(--font-dm-sans, "DM Sans", sans-serif)',
                      color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                    }}
                  >
                    {packDate}
                  </span>
                  <StatusBadge status={pack.status} />
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-[11px] font-mono tabular-nums"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {scriptCount} script{scriptCount !== 1 ? 's' : ''}
                  </span>
                </div>
                {note && (
                  <p
                    className="text-[12px] mt-0.5 truncate"
                    style={{
                      fontFamily: 'var(--font-dm-sans, "DM Sans", sans-serif)',
                      color: 'var(--text-tertiary)',
                    }}
                  >
                    {note}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const generatePanel = (
    <div
      className="h-full p-6 rounded-lg"
      style={{ background: 'var(--bg-2, var(--bg-card, #0e1018))' }}
    >
      <h2
        className="text-[11px] font-mono font-medium uppercase tracking-[0.06em] mb-6"
        style={{ color: 'var(--text-quaternary)' }}
      >
        Generate New Batch
      </h2>

      {sessionsLoading ? (
        <div className="flex items-center gap-2 py-4">
          <Loader2 className="size-4 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
          <span className="text-[13px]" style={{ color: 'var(--text-tertiary)' }}>
            Loading sessions...
          </span>
        </div>
      ) : sessions.length === 0 ? (
        <p className="text-[13px]" style={{ color: 'var(--text-tertiary)' }}>
          Run research first to generate scripts.
        </p>
      ) : (
        <form onSubmit={handleGenerateSubmit} className="space-y-5">
          {/* Session selector */}
          <div>
            <label
              htmlFor="session-select"
              className="block text-[11px] font-mono font-medium uppercase tracking-[0.06em] mb-1.5"
              style={{ color: 'var(--text-quaternary)' }}
            >
              Research Session
            </label>
            <select
              id="session-select"
              value={selectedSessionRunId}
              onChange={(e) => setSelectedSessionRunId(e.target.value)}
              className="w-full text-[13px] px-3 py-2 rounded-md outline-none appearance-none"
              style={{
                background: 'var(--bg-1, var(--bg-elevated, #0a0c12))',
                border: '1px solid var(--border-default, rgba(255,255,255,0.04))',
                borderRadius: 5,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-dm-sans, "DM Sans", sans-serif)',
              }}
            >
              {sessions.map((s) => {
                const sessionDate = (() => {
                  try {
                    return new Date(s.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    });
                  } catch {
                    return 'Session';
                  }
                })();
                return (
                  <option key={s.runId} value={s.runId}>
                    {sessionDate} — {s.sectionCount}/{s.totalSections} sections
                  </option>
                );
              })}
            </select>
          </div>

          {/* Style refs + proof points (read-only summary) */}
          <div className="flex items-center gap-6">
            <div>
              <p
                className="text-[11px] font-mono font-medium uppercase tracking-[0.06em] mb-0.5"
                style={{ color: 'var(--text-quaternary)' }}
              >
                Style Refs
              </p>
              <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                Loaded from profile
              </p>
            </div>
            <div>
              <p
                className="text-[11px] font-mono font-medium uppercase tracking-[0.06em] mb-0.5"
                style={{ color: 'var(--text-quaternary)' }}
              >
                Proof Points
              </p>
              <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                Loaded from profile
              </p>
            </div>
          </div>

          {/* User note */}
          <div>
            <label
              htmlFor="user-note"
              className="block text-[11px] font-mono font-medium uppercase tracking-[0.06em] mb-1.5"
              style={{ color: 'var(--text-quaternary)' }}
            >
              Note (optional)
            </label>
            <textarea
              id="user-note"
              value={userNote}
              onChange={(e) => setUserNote(e.target.value)}
              placeholder="e.g. enterprise angle, focus on pain points…"
              rows={3}
              className="w-full text-[13px] px-3 py-2 rounded-md outline-none resize-none"
              style={{
                background: 'var(--bg-1, var(--bg-elevated, #0a0c12))',
                border: '1px solid var(--border-default, rgba(255,255,255,0.04))',
                borderRadius: 5,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-dm-sans, "DM Sans", sans-serif)',
              }}
            />
          </div>

          {genError && (
            <p
              className="text-[12px] font-mono"
              style={{ color: 'var(--red, #ef4444)' }}
            >
              {genError}
            </p>
          )}

          <div className="flex items-center gap-3">
            <Button
              type="submit"
              aria-label="Generate new script batch"
              disabled={anyGenerating || !selectedSessionRunId}
              className={cn(
                'text-[13px] font-medium px-[14px] py-[6px] rounded-[5px] text-white',
                'bg-[var(--accent,#365eff)] hover:bg-[var(--accent-hover,#4a6fff)]',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {anyGenerating ? (
                <>
                  <Loader2 className="size-3.5 mr-1.5 animate-spin inline-block" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="size-3.5 mr-1.5 inline-block" />
                  Generate
                </>
              )}
            </Button>
            <button
              type="button"
              onClick={() => setRightPaneView(selectedPackId ? 'scripts' : 'empty')}
              className="text-[13px] cursor-pointer transition-colors duration-100"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );

  const contentArea = (() => {
    if (rightPaneView === 'generate') {
      return generatePanel;
    }

    if (rightPaneView === 'empty') {
      return (
        <div className="flex items-center justify-center h-full min-h-[200px]">
          <p
            className="text-[14px]"
            style={{
              fontFamily: 'var(--font-dm-sans, "DM Sans", sans-serif)',
              color: 'var(--text-tertiary)',
            }}
          >
            Select or generate a batch to view scripts
          </p>
        </div>
      );
    }

    // 'scripts' view
    if (packDetailLoading) {
      return (
        <div className="flex items-center justify-center h-full min-h-[200px]">
          <Loader2 className="size-5 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
        </div>
      );
    }

    if (packDetailError) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-2">
          <p className="text-[13px]" style={{ color: 'var(--red, #ef4444)' }}>
            Couldn&apos;t load scripts.
          </p>
          <button
            type="button"
            onClick={() => selectedPackId && fetchPackDetail(selectedPackId)}
            className="text-[12px] underline cursor-pointer"
            style={{ color: 'var(--text-tertiary)' }}
          >
            Retry
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {selectedPackData?.generation_context && (
          <PackContextCard context={selectedPackData.generation_context} />
        )}
        {selectedPackId && (
          <ScriptPackViewer
            packId={selectedPackId}
            scripts={selectedPackData?.scripts ?? []}
            generationContext={selectedPackData?.generation_context}
            diversityFlags={selectedPackData?.diversity_flags}
            diversityScore={selectedPackData?.diversity_score}
            isGenerating={isCurrentPackGenerating}
          />
        )}
      </div>
    );
  })();

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: '1px solid var(--border-default, rgba(255,255,255,0.04))' }}
      >
        <span
          className="text-[11px] font-mono font-medium uppercase tracking-[0.06em]"
          style={{ color: 'var(--text-quaternary)' }}
        >
          Scripts
        </span>
        <button
          type="button"
          onClick={() => setRightPaneView('generate')}
          disabled={anyGenerating}
          className={cn(
            'inline-flex items-center gap-1.5 text-[13px] font-medium px-[14px] py-[6px] rounded-[5px] text-white cursor-pointer',
            'bg-[var(--accent,#365eff)] hover:bg-[var(--accent-hover,#4a6fff)]',
            'transition-colors duration-100',
            anyGenerating && 'opacity-50 cursor-not-allowed',
          )}
        >
          <Plus className="size-3.5" />
          Generate New Batch
        </button>
      </div>

      {/* 2-pane layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Mobile: show pack list OR pack view */}
        {/* Tablet/Desktop: always show both */}

        {/* Sidebar */}
        <div
          className={cn(
            'shrink-0 overflow-hidden flex flex-col',
            // Mobile: hidden when viewing a pack
            mobileShowingPack ? 'hidden md:flex' : 'flex w-full md:w-[220px] lg:w-[260px]',
          )}
          style={{
            borderRight: '1px solid var(--border-default, rgba(255,255,255,0.04))',
            background: 'var(--bg-1, var(--bg-elevated, #0a0c12))',
          }}
        >
          {sidebarContent}
        </div>

        {/* Content pane */}
        <div
          className={cn(
            'flex-1 overflow-y-auto p-6',
            // Mobile: show full width when a pack is selected
            mobileShowingPack ? 'block' : 'hidden md:block',
          )}
        >
          {/* Mobile back button */}
          {mobileShowingPack && (
            <button
              type="button"
              onClick={() => { setMobileShowingPack(false); }}
              className="flex md:hidden items-center gap-1.5 text-[12px] mb-4 cursor-pointer transition-colors duration-100"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <ArrowLeft className="size-3.5" />
              Back to batches
            </button>
          )}
          {contentArea}
        </div>
      </div>

      {/* Mobile fixed bottom Generate button (only when showing pack list) */}
      {!mobileShowingPack && (
        <div
          className="flex md:hidden px-4 py-3 shrink-0"
          style={{ borderTop: '1px solid var(--border-default, rgba(255,255,255,0.04))' }}
        >
          <button
            type="button"
            onClick={() => { setRightPaneView('generate'); setMobileShowingPack(true); }}
            disabled={anyGenerating}
            className={cn(
              'w-full inline-flex items-center justify-center gap-1.5 text-[13px] font-medium px-[14px] py-[10px] rounded-[5px] text-white',
              'bg-[var(--accent,#365eff)] hover:bg-[var(--accent-hover,#4a6fff)]',
              'transition-colors duration-100',
              anyGenerating && 'opacity-50 cursor-not-allowed',
            )}
          >
            <Sparkles className="size-3.5" />
            Generate New Batch
          </button>
        </div>
      )}
    </div>
  );
}
