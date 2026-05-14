// Centered artifact document driven by a centered chat composer. This is
// the only research-v2 sections view post-Phase 7; the prior six-card grid
// is gone.
//
// Layout (matches the goal-plan §3.2):
//   - Initial: centered composer only, narrow max-width, calm bg.
//   - Generating: artifact document centered, six compact worker chips
//     above it, composer pinned bottom-center.
//   - Ready: same shape — artifact reads as one premium positioning audit
//     document with anchors per section, toolbar in the top right.

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { POSITIONING_SECTION_IDS, POSITIONING_SECTION_LABELS } from '@/lib/ai/prompts/positioning-skills';
import type { PositioningSectionId } from '@/lib/ai/prompts/positioning-skills';
import { isBuyerICPArtifact } from '@/lib/research-v2/audit-artifact-view';
import { useAuditState } from '@/lib/research-v2/use-audit-state';
import { cn } from '@/lib/utils';
import { BuyerICPArtifactRenderer } from './buyer-icp';

export type WorkerChipStatus = 'queued' | 'running' | 'complete' | 'error' | 'aborted';

export interface WorkerChipState {
  section_id: PositioningSectionId;
  status: WorkerChipStatus;
}

export interface AgentArtifactSurfaceProps {
  runId: string;
  /** Per-section status powering the worker chips. Defaults to all queued. */
  workerStates?: WorkerChipState[];
  /** When false, the centered composer sits alone — no chips, no artifact. */
  showArtifact?: boolean;
  /**
   * Submit handler for the centered chat composer. When omitted, the
   * composer POSTs the prompt to /api/research-v2/chat — the artifact's
   * command line by default.
   */
  onSubmit?: (text: string) => void;
}

async function defaultChatSubmit(
  runId: string,
  text: string,
  focusedZone: string | null,
): Promise<void> {
  try {
    // Codex review fix (2026-05-13): chatRequestSchema requires each
    // message to be { role, parts: [{ type: 'text', text }] } — the
    // AI SDK v6 UIMessage shape. Sending `{ role, content }` 400's
    // before reaching the orchestrator, which kills every chat/edit
    // command typed into the artifact composer.
    await fetch('/api/research-v2/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        runId,
        messages: [
          { role: 'user', parts: [{ type: 'text', text }] },
        ],
        ...(focusedZone ? { focusedZone } : {}),
      }),
    });
  } catch (err) {
    console.warn('[artifact-surface] chat submit failed:', err);
  }
}

const STATUS_CLASS: Record<WorkerChipStatus, string> = {
  queued: 'border-[var(--border)] text-[color:var(--text-3)]',
  running: 'border-[var(--accent)] text-[color:var(--accent)] animate-pulse',
  complete: 'border-[color:var(--green)] text-[color:var(--green)]',
  error: 'border-[color:var(--red)] text-[color:var(--red)]',
  aborted: 'border-[color:var(--amber)] text-[color:var(--amber)]',
};

function defaultStates(): WorkerChipState[] {
  return POSITIONING_SECTION_IDS.map((section_id) => ({
    section_id,
    status: 'queued' as WorkerChipStatus,
  }));
}

export function AgentArtifactSurface({
  runId,
  workerStates,
  showArtifact = true,
  onSubmit,
}: AgentArtifactSurfaceProps) {
  // When the parent doesn't pass workerStates explicitly (the default
  // research-v2 page mount), poll the audit-state endpoint so chips reflect
  // live worker progress. Polling auto-stops once every chip is terminal.
  const live = useAuditState(runId);
  const states = useMemo(
    () =>
      workerStates ??
      (live.workerStates.length > 0 ? live.workerStates : defaultStates()),
    [workerStates, live.workerStates],
  );
  const statusByZone = useMemo(() => {
    const out: Record<string, WorkerChipStatus> = {};
    for (const w of states) out[w.section_id] = w.status;
    return out;
  }, [states]);
  const [draft, setDraft] = useState('');
  const [sourcesOpen, setSourcesOpen] = useState(false);
  // P2b — track which section is in the viewport so chat commands like
  // "tighten this claim" can resolve "this" without forcing the user to
  // name the zone explicitly. Updated by IntersectionObserver below.
  const [focusedZone, setFocusedZone] = useState<string | null>(null);

  // Auto-kickoff: if the polled state reports no parent run yet (older runs
  // that pre-date the Phase 7.5 ONBOARDING_COMPLETE wire, or any resume
  // where the kickoff fetch was interrupted), fire orchestrate once. The
  // route is idempotent on (user_id, run_id) so a duplicate call is safe.
  const kickoffFired = useRef(false);
  useEffect(() => {
    if (workerStates) return; // explicit override, skip auto-kickoff
    if (kickoffFired.current) return;
    if (live.parent_audit_run_id !== null) return;
    if (live.workerStates.length === 0) return; // still loading
    kickoffFired.current = true;
    void fetch('/api/research-v2/orchestrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ run_id: runId }),
    }).catch((err) => {
      console.warn('[artifact-surface] auto-kickoff failed:', err);
      kickoffFired.current = false;
    });
  }, [workerStates, live.parent_audit_run_id, live.workerStates.length, runId]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    if (onSubmit) {
      onSubmit(text);
    } else {
      void defaultChatSubmit(runId, text, focusedZone);
    }
  };

  // P2b — IntersectionObserver tracks which `[data-testid^="artifact-section-"]`
  // is most-visible. We pick the entry with the largest intersection ratio so
  // the focused zone always reflects what the user is actually reading.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>('[data-testid^="artifact-section-"]'),
    );
    if (sections.length === 0) return;

    let bestZone: string | null = focusedZone;
    let bestRatio = 0;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const zone = (entry.target as HTMLElement).id?.replace(/^section-/, '') ?? null;
          if (!zone) continue;
          if (entry.isIntersecting && entry.intersectionRatio > bestRatio) {
            bestRatio = entry.intersectionRatio;
            bestZone = zone;
          }
        }
        if (bestZone && bestZone !== focusedZone) {
          setFocusedZone(bestZone);
        }
        // Reset for next observer fire so the highest-ratio winner is fresh each pass.
        bestRatio = 0;
      },
      { threshold: [0.25, 0.5, 0.75] },
    );

    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  // Re-bind when the set of sections rendered changes (zones complete/error).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.sectionsByZone, live.workerStates]);

  const [dispatchState, setDispatchState] = useState<'idle' | 'firing' | 'fired' | 'error'>('idle');
  const handleDispatch = async () => {
    setDispatchState('firing');
    try {
      const res = await fetch('/api/research-v2/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ run_id: runId }),
      });
      setDispatchState(res.ok ? 'fired' : 'error');
      // Reset to idle after a beat so the button can be re-fired.
      setTimeout(() => setDispatchState('idle'), 2500);
    } catch (err) {
      console.warn('[artifact-surface] manual dispatch failed:', err);
      setDispatchState('error');
      setTimeout(() => setDispatchState('idle'), 2500);
    }
  };

  return (
    <div
      data-testid="agent-artifact-surface"
      className="min-h-[calc(100vh-64px)] w-full bg-[var(--bg-0)] text-[color:var(--text-1)]"
    >
      <div className="mx-auto flex max-w-3xl flex-col items-stretch gap-8 px-6 py-10">
        {showArtifact && (
          <>
            <header className="flex items-center justify-between gap-4">
              <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-[color:var(--text-3)]">
                Positioning Audit · {runId.slice(0, 8)}
              </div>
              <ArtifactToolbar
                onOpenSources={() => setSourcesOpen(true)}
                onRerun={() => onSubmit?.('rerun')}
                onExport={() => onSubmit?.('export markdown')}
                onDispatch={handleDispatch}
                dispatchState={dispatchState}
              />
            </header>

            <WorkerChipsRow states={states} />

            <main
              data-testid="artifact-document"
              className="rounded-md border border-[var(--border)] bg-[var(--bg-1)] p-8"
            >
              <SectionContentList
                statusByZone={statusByZone}
                sectionsByZone={live.sectionsByZone}
                eventsByZone={live.eventsByZone}
              />
            </main>
          </>
        )}

        <form
          onSubmit={handleSubmit}
          data-testid="composer"
          className={cn(
            'sticky bottom-6 mx-auto w-full rounded-md border border-[var(--border)] bg-[var(--bg-2)]',
            'shadow-[0_8px_24px_-12px_rgba(0,0,0,0.4)] focus-within:border-[color:var(--accent)]',
          )}
        >
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Tighten a claim, redo a section, ask for sources..."
            rows={2}
            className="w-full resize-none bg-transparent px-4 py-3 text-[14px] leading-[1.5] text-[color:var(--text-1)] placeholder:text-[color:var(--text-3)] focus:outline-none"
            aria-label="Artifact command line"
          />
          <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-3 py-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--text-3)]">
              ⏎ to send
            </span>
            <button
              type="submit"
              disabled={!draft.trim()}
              className="rounded-md bg-[var(--accent)] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.06em] text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </form>
      </div>

      <SourcesDrawer
        open={sourcesOpen}
        onClose={() => setSourcesOpen(false)}
      />
    </div>
  );
}

interface ArtifactToolbarProps {
  onOpenSources: () => void;
  onRerun: () => void;
  onExport: () => void;
  onDispatch?: () => void;
  dispatchState?: 'idle' | 'firing' | 'fired' | 'error';
}

export function ArtifactToolbar({
  onOpenSources,
  onRerun,
  onExport,
  onDispatch,
  dispatchState = 'idle',
}: ArtifactToolbarProps) {
  return (
    <div className="flex items-center gap-2" data-testid="artifact-toolbar">
      {onDispatch && (
        <button
          type="button"
          onClick={onDispatch}
          disabled={dispatchState === 'firing'}
          data-testid="dispatch-button"
          className={cn(
            'rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.06em]',
            dispatchState === 'firing' &&
              'border-[var(--accent)] text-[color:var(--accent)] animate-pulse',
            dispatchState === 'fired' &&
              'border-[color:var(--green)] text-[color:var(--green)]',
            dispatchState === 'error' &&
              'border-[color:var(--red)] text-[color:var(--red)]',
            dispatchState === 'idle' &&
              'border-[var(--accent)] text-[color:var(--accent)] hover:bg-[color:var(--accent-dim)]',
          )}
        >
          {dispatchState === 'firing'
            ? 'Dispatching…'
            : dispatchState === 'fired'
              ? 'Dispatched ✓'
              : dispatchState === 'error'
                ? 'Failed — retry'
                : 'Dispatch'}
        </button>
      )}
      <ToolbarButton onClick={onOpenSources} label="Sources" />
      <ToolbarButton onClick={onRerun} label="Rerun" />
      <ToolbarButton onClick={onExport} label="Export" />
    </div>
  );
}

function ToolbarButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-[var(--border)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--text-2)] hover:border-[var(--border-hover)] hover:text-[color:var(--text-1)]"
    >
      {label}
    </button>
  );
}

function WorkerChipsRow({ states }: { states: WorkerChipState[] }) {
  return (
    <div
      data-testid="worker-chips"
      className="flex flex-wrap items-center gap-2"
    >
      {states.map((state) => (
        <span
          key={state.section_id}
          data-testid={`worker-chip-${state.section_id}`}
          data-status={state.status}
          className={cn(
            'rounded-md border bg-transparent px-2 py-1 font-mono text-[10px] uppercase tracking-[0.06em]',
            STATUS_CLASS[state.status],
          )}
        >
          {POSITIONING_SECTION_LABELS[state.section_id].split(' & ')[0]}
        </span>
      ))}
    </div>
  );
}

interface SectionContentListProps {
  statusByZone: Record<string, WorkerChipStatus>;
  sectionsByZone: Record<string, { markdown?: string; title?: string; data?: unknown }>;
  eventsByZone: Record<string, SectionActivityEvent[]>;
}

export interface SectionActivityEvent {
  id: string;
  event_type: string;
  message: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

/** P2a: live agent-activity feed below in-flight zones — Claude.ai-style. */
function ZoneActivity({ events }: { events: SectionActivityEvent[] }) {
  if (events.length === 0) return null;
  return (
    <div
      data-testid="zone-activity"
      className="mt-2 rounded-md border border-dashed border-[var(--border)] bg-[var(--bg-2)] p-3"
    >
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--text-3)]">
        Agent activity
      </div>
      <ol className="flex flex-col gap-1.5 text-[12px] leading-[1.5] text-[color:var(--text-2)]">
        {events.slice(-8).map((ev) => {
          // Codex review fix (2026-05-13): the orchestrator wraps the
          // runner's onProgress event as `payload: { event: RunnerProgressUpdate }`
          // (see research-worker/src/index.ts ~line 733). The runner-side
          // toolNames / textPreview live under `payload.event.meta`, not at
          // top level. We try both nestings so a future direct-write path
          // (no orchestrator wrapper) still renders.
          const payload = ev.payload ?? {};
          const wrapper =
            payload['event'] && typeof payload['event'] === 'object'
              ? (payload['event'] as Record<string, unknown>)
              : null;
          const meta =
            wrapper?.['meta'] && typeof wrapper['meta'] === 'object'
              ? (wrapper['meta'] as Record<string, unknown>)
              : null;
          const rawTools =
            meta?.['toolNames'] ??
            payload['toolNames'] ??
            null;
          const tools = Array.isArray(rawTools)
            ? rawTools.filter((t): t is string => typeof t === 'string')
            : [];
          const rawText =
            (meta?.['textPreview'] as unknown) ??
            (payload['textPreview'] as unknown) ??
            null;
          const text = typeof rawText === 'string' ? rawText : null;
          const wrapperMessage =
            wrapper && typeof wrapper['message'] === 'string'
              ? (wrapper['message'] as string)
              : null;
          return (
            <li key={ev.id} className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--text-3)]">
                <span>{new Date(ev.created_at).toLocaleTimeString()}</span>
                <span className="text-[color:var(--accent)]">{ev.event_type}</span>
                {tools.length > 0 && (
                  <span className="text-[color:var(--text-2)]">{tools.join(', ')}</span>
                )}
              </div>
              {(ev.message || wrapperMessage || text) && (
                <div className="line-clamp-2 text-[color:var(--text-2)]">
                  {ev.message ?? wrapperMessage ?? text}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function SectionContentList({ statusByZone, sectionsByZone, eventsByZone }: SectionContentListProps) {
  const anyComplete = Object.values(sectionsByZone).some(
    (s) => s && (s.markdown || s.title || s.data),
  );

  if (!anyComplete) {
    // Codex review fix (2026-05-13): even before the first section
    // commits, we want to show the live activity feed for whichever
    // zones are running — that's the silent-30s gap this UI is meant
    // to fill. Build a list of running zones with events.
    const runningZones = POSITIONING_SECTION_IDS.filter(
      (zone) => (statusByZone[zone] ?? 'queued') === 'running',
    );
    return (
      <div className="flex flex-col items-center gap-6 py-12 text-center">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--text-3)]">
            Awaiting first section
          </div>
          <p className="mt-3 max-w-[42ch] text-[13px] leading-[1.5] text-[color:var(--text-3)]">
            The orchestrator is fanning out six positioning subagents.
            Completed sections will appear inline as they commit.
          </p>
        </div>
        {runningZones.length > 0 && (
          <div className="w-full max-w-2xl space-y-4 text-left">
            {runningZones.map((zone) => {
              const events = eventsByZone[zone] ?? [];
              if (events.length === 0) return null;
              return (
                <div key={zone}>
                  <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--accent)]">
                    {POSITIONING_SECTION_LABELS[zone]}
                  </div>
                  <ZoneActivity events={events} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      {POSITIONING_SECTION_IDS.map((zone) => {
        const status = statusByZone[zone] ?? 'queued';
        const body = sectionsByZone[zone];
        const isComplete = Boolean(body && (body.markdown || body.title || body.data));
        const buyerIcpArtifact =
          zone === 'positioningBuyerICP' && isBuyerICPArtifact(body?.data)
            ? body.data
            : null;
        if (isComplete) {
          return (
            <section
              key={zone}
              id={`section-${zone}`}
              data-testid={`artifact-section-${zone}`}
              className="flex flex-col gap-3"
            >
              <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
                <h2 className="text-[16px] font-medium tracking-[-0.005em] text-[color:var(--text-1)]">
                  {body?.title ?? POSITIONING_SECTION_LABELS[zone]}
                </h2>
                <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--green)]">
                  complete
                </span>
              </header>
              {buyerIcpArtifact ? (
                <BuyerICPArtifactRenderer artifact={buyerIcpArtifact} />
              ) : (
                <div
                  className="whitespace-pre-wrap text-[14px] leading-[1.6] text-[color:var(--text-2)]"
                  data-testid={`artifact-section-body-${zone}`}
                >
                  {body?.markdown ?? ''}
                </div>
              )}
            </section>
          );
        }
        const events = eventsByZone[zone] ?? [];
        return (
          <section
            key={zone}
            id={`section-${zone}`}
            data-testid={`artifact-section-${zone}`}
            className="flex flex-col gap-2 border-b border-dashed border-[var(--border)] pb-3"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[16px] font-medium tracking-[-0.005em] text-[color:var(--text-3)]">
                {POSITIONING_SECTION_LABELS[zone]}
              </h2>
              <span
                data-status={status}
                className={cn(
                  'font-mono text-[10px] uppercase tracking-[0.06em]',
                  status === 'running' && 'text-[color:var(--accent)] animate-pulse',
                  status === 'queued' && 'text-[color:var(--text-3)]',
                  status === 'error' && 'text-[color:var(--red)]',
                  status === 'aborted' && 'text-[color:var(--amber)]',
                )}
              >
                {status === 'running' ? 'generating…' : status}
              </span>
            </div>
            {/* P2a: show the agent-activity feed for running zones */}
            {status === 'running' && <ZoneActivity events={events} />}
          </section>
        );
      })}
    </div>
  );
}

function SourcesDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      data-testid="sources-drawer"
      role="dialog"
      aria-label="Sources"
      className="fixed inset-y-0 right-0 w-full max-w-md border-l border-[var(--border)] bg-[var(--bg-1)] p-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.06em] text-[color:var(--text-2)]">
          Sources
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close sources drawer"
          className="rounded-md border border-[var(--border)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--text-2)] hover:border-[var(--border-hover)]"
        >
          Esc
        </button>
      </div>
      <p className="mt-4 text-[13px] text-[color:var(--text-3)]">
        Source citations will appear here once the orchestrator settles.
      </p>
    </div>
  );
}
