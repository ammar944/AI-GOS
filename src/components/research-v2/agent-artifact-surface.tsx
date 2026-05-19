// Centered artifact document driven by a centered chat composer. This is
// the only research-v2 sections view post-Phase 7; the prior six-card grid
// is gone.
//
// Layout (matches the goal-plan §3.2):
//   - Initial: centered composer only, narrow max-width, calm bg.
//   - Running: artifact document centered, six compact worker chips
//     above it, composer pinned bottom-center.
//   - Ready: same shape — artifact reads as one premium positioning audit
//     document with anchors per section, toolbar in the top right.

'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  BookOpen,
  Download,
  ExternalLink,
  Play,
  RefreshCw,
  Send,
  X,
} from 'lucide-react';

import { POSITIONING_SECTION_IDS, POSITIONING_SECTION_LABELS } from '@/lib/ai/prompts/positioning-skills';
import type { PositioningSectionId } from '@/lib/ai/prompts/positioning-skills';
import {
  isBuyerICPArtifact,
  isCompetitorLandscapeArtifact,
} from '@/lib/research-v2/audit-artifact-view';
import { CompetitorLandscapeRenderer } from './section-renderers';
import { useAuditState } from '@/lib/research-v2/use-audit-state';
import { cn } from '@/lib/utils';
import {
  isRecord,
  pickPositioningTypedArtifact,
  type PositioningArtifactSource,
  type PositioningTypedArtifact,
} from '@/types/positioning-artifact';
import { BuyerICPArtifactRenderer } from './buyer-icp';
import { SectionNarrativeRenderer } from './section-narrative-renderer';

export type WorkerChipStatus = 'queued' | 'running' | 'complete' | 'error' | 'aborted';

export interface SectionRuntimeTimings {
  sectionStartedAt?: string;
  firstPartialAt?: string;
  finalObjectAt?: string;
  validationCompleteAt?: string;
  timeoutFiredAt?: string;
  abortSignalObservedAt?: string;
  commitStartedAt?: string;
  commitCompleteAt?: string;
  terminalStatusWrittenAt?: string;
}

export interface WorkerChipState {
  section_id: PositioningSectionId;
  status: WorkerChipStatus;
  phase?: string;
  phaseLabel?: string;
  phaseStartedAt?: string | null;
  latestTool?: string | null;
  latestSource?: string | null;
  latestActivity?: string | null;
  nextStep?: string | null;
  wave?: number | null;
  totalWaves?: number | null;
  concurrency?: number | null;
  elapsedMs?: number | null;
  capabilityGaps?: Array<Record<string, unknown>>;
  executionMode?: 'draft' | 'deep' | null;
  runtimeTimings?: SectionRuntimeTimings;
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

const ARTIFACT_UI_V2 =
  process.env.NEXT_PUBLIC_ARTIFACT_UI_V2 === 'true';

const STATUS_CLASS: Record<WorkerChipStatus, string> = {
  queued: 'border-[var(--border-subtle)] text-[color:var(--text-tertiary)]',
  running: 'border-[var(--accent-blue)] text-[color:var(--accent-blue)]',
  complete: 'border-[var(--accent-green)] text-[color:var(--accent-green)]',
  error: 'border-[var(--accent-red)] text-[color:var(--accent-red)]',
  aborted: 'border-[var(--accent-amber)] text-[color:var(--accent-amber)]',
};

const STATUS_DOT_CLASS: Record<WorkerChipStatus, string> = {
  queued: 'bg-[var(--text-quaternary)]',
  running: 'bg-[var(--accent-blue)] animate-pulse',
  complete: 'bg-[var(--accent-green)]',
  error: 'bg-[var(--accent-red)]',
  aborted: 'bg-[var(--accent-amber)]',
};

const SECTION_SHORT_LABELS: Record<PositioningSectionId, string> = {
  positioningMarketCategory: 'Market',
  positioningBuyerICP: 'ICP',
  positioningCompetitorLandscape: 'Competitors',
  positioningVoiceOfCustomer: 'VoC',
  positioningDemandIntent: 'Demand',
  positioningOfferDiagnostic: 'Offer',
};

interface AuditSourceItem extends PositioningArtifactSource {
  zoneId: PositioningSectionId;
  sectionTitle: string;
}

function defaultStates(): WorkerChipState[] {
  return POSITIONING_SECTION_IDS.map((section_id) => ({
    section_id,
    status: 'queued' as WorkerChipStatus,
  }));
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function getTypedArtifactForZone(
  sectionsByZone: Record<string, SectionArtifactBody>,
  zoneId: PositioningSectionId,
): PositioningTypedArtifact | null {
  const body = sectionsByZone[zoneId];
  return body ? pickPositioningTypedArtifact(body, zoneId) : null;
}

const ITEM_SOURCE_URL_KEYS = ['sourceUrl', 'url', 'evidenceUrl'] as const;
const ITEM_SOURCE_TITLE_KEYS = ['sourceTitle', 'source'] as const;
const ITEM_SOURCE_REASON_KEYS = ['whyItMatters', 'evidence'] as const;

function readNonEmptyString(
  obj: Record<string, unknown>,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function walkArtifactItemSources(
  value: unknown,
  visit: (entry: { url: string; title: string; whyItMatters?: string }) => void,
): void {
  if (Array.isArray(value)) {
    for (const item of value) walkArtifactItemSources(item, visit);
    return;
  }
  if (!isRecord(value)) return;
  const url = readNonEmptyString(value, ITEM_SOURCE_URL_KEYS);
  if (url && /^https?:\/\/\S+\.\S+/.test(url)) {
    const title =
      readNonEmptyString(value, ITEM_SOURCE_TITLE_KEYS) ?? hostnameOf(url);
    const whyItMatters =
      readNonEmptyString(value, ITEM_SOURCE_REASON_KEYS) ?? undefined;
    visit({ url, title, whyItMatters });
  }
  for (const inner of Object.values(value)) {
    if (Array.isArray(inner) || isRecord(inner)) {
      walkArtifactItemSources(inner, visit);
    }
  }
}

function collectAuditSources(
  sectionsByZone: Record<string, SectionArtifactBody>,
): AuditSourceItem[] {
  const seen = new Set<string>();
  const sources: AuditSourceItem[] = [];

  for (const zoneId of POSITIONING_SECTION_IDS) {
    const artifact = getTypedArtifactForZone(sectionsByZone, zoneId);
    if (!artifact) continue;

    for (const source of artifact.sources) {
      const key = `${zoneId}:${source.url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      sources.push({
        ...source,
        zoneId,
        sectionTitle: POSITIONING_SECTION_LABELS[zoneId],
      });
    }

    walkArtifactItemSources(artifact, (entry) => {
      const key = `${zoneId}:${entry.url}`;
      if (seen.has(key)) return;
      seen.add(key);
      sources.push({
        title: entry.title,
        url: entry.url,
        whyItMatters: entry.whyItMatters,
        zoneId,
        sectionTitle: POSITIONING_SECTION_LABELS[zoneId],
      });
    });
  }

  return sources;
}

function getProgressPercent(complete: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((complete / total) * 100);
}

function getAuditStatusLabel(stats: {
  complete: number;
  running: number;
  blocked: number;
  total: number;
  activePhase?: string | null;
}): string {
  if (stats.complete === stats.total) return 'Audit ready';
  if (stats.blocked > 0) return 'Needs review';
  if (stats.running > 0) return stats.activePhase ?? 'In progress';
  return 'Queued';
}

function formatElapsed(elapsedMs: number | null | undefined): string | null {
  if (typeof elapsedMs !== 'number' || !Number.isFinite(elapsedMs)) return null;
  if (elapsedMs < 60_000) return `${Math.max(1, Math.round(elapsedMs / 1000))}s`;
  return `${Math.round(elapsedMs / 60_000)}m`;
}

function msBetween(start: string | undefined, end: string | undefined): number | null {
  if (!start || !end) return null;
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  return Math.max(0, endMs - startMs);
}

function formatRuntimeTiming(state: WorkerChipState | undefined): string | null {
  const timings = state?.runtimeTimings;
  if (!timings) return formatElapsed(state?.elapsedMs);
  const firstPartialMs = msBetween(timings.sectionStartedAt, timings.firstPartialAt);
  if (firstPartialMs !== null) return `First partial ${formatElapsed(firstPartialMs)}`;
  const finalObjectMs = msBetween(timings.sectionStartedAt, timings.finalObjectAt);
  if (finalObjectMs !== null) return `Draft ${formatElapsed(finalObjectMs)}`;
  return formatElapsed(state?.elapsedMs);
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function draftArtifactMeta(body: SectionArtifactBody | undefined): {
  artifactLayer: 'draft' | 'deep' | null;
  confidence: number | null;
  evidenceGapCount: number;
} {
  const data = asObject(body?.data);
  const artifactLayer = data?.artifactLayer === 'draft' ? 'draft' : null;
  const confidence =
    typeof data?.confidence === 'number' && Number.isFinite(data.confidence)
      ? data.confidence
      : null;
  const evidenceGapCount = Array.isArray(data?.evidenceGaps)
    ? data.evidenceGaps.length
    : 0;
  return { artifactLayer, confidence, evidenceGapCount };
}

function displayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function getWaveSummary(states: WorkerChipState[]): string | null {
  const active = states.find((state) => state.wave && state.totalWaves);
  if (!active?.wave || !active.totalWaves) return null;
  const running = states.filter((state) => state.status === 'running').length;
  const queued = states.filter((state) => state.status === 'queued').length;
  return `Wave ${active.wave} of ${active.totalWaves} - ${running} running, ${queued} queued`;
}

export function AgentArtifactSurface({
  runId,
  workerStates,
  showArtifact = true,
  onSubmit,
}: AgentArtifactSurfaceProps): ReactElement {
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
  const stateByZone = useMemo(() => {
    const out: Partial<Record<PositioningSectionId, WorkerChipState>> = {};
    for (const state of states) out[state.section_id] = state;
    return out;
  }, [states]);
  const auditSources = useMemo(
    () => collectAuditSources(live.sectionsByZone),
    [live.sectionsByZone],
  );
  const auditStats = useMemo(() => {
    const total = POSITIONING_SECTION_IDS.length;
    const complete = states.filter((state) => state.status === 'complete').length;
    const running = states.filter((state) => state.status === 'running').length;
    const blocked = states.filter(
      (state) => state.status === 'error' || state.status === 'aborted',
    ).length;
    const activePhase =
      states.find((state) => state.status === 'running')?.phaseLabel ??
      states.find((state) => state.status === 'running')?.phase ??
      null;

    return {
      total,
      complete,
      running,
      blocked,
      activePhase,
      sourceCount: auditSources.length,
      progressPercent: getProgressPercent(complete, total),
    };
  }, [states, auditSources.length]);
  const [draft, setDraft] = useState('');
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [highlightSourceUrl, setHighlightSourceUrl] = useState<string | null>(null);
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

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
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

  const sendCommand = (text: string): void => {
    if (onSubmit) {
      onSubmit(text);
      return;
    }
    void defaultChatSubmit(runId, text, focusedZone);
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
      className="min-h-[calc(100vh-64px)] w-full bg-[var(--bg-base)] text-[color:var(--text-primary)]"
    >
      <div className="mx-auto flex max-w-5xl flex-col items-stretch gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {showArtifact && (
          <>
            <header className="sticky top-0 z-20 -mx-4 border-b border-[var(--border-subtle)] bg-[var(--bg-base)]/95 px-4 pb-5 pt-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
              <div className="mx-auto flex max-w-5xl flex-col gap-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-[color:var(--text-tertiary)]">
                      Pre-Pitch Positioning Audit · {runId.slice(0, 8)}
                    </div>
                    <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
                      <h1 className="text-[26px] font-semibold leading-tight tracking-[0] text-[color:var(--text-primary)]">
                        Audit Reader
                      </h1>
                      <span className="pb-1 font-mono text-[11px] uppercase tracking-[0.06em] text-[color:var(--text-tertiary)]">
                        {getAuditStatusLabel(auditStats)}
                      </span>
                    </div>
                  </div>
                  <ArtifactToolbar
                    onOpenSources={() => setSourcesOpen(true)}
                    onRerun={() => sendCommand(focusedZone ? 'rerun this section' : 'rerun audit')}
                    onExport={() => sendCommand('export markdown')}
                    onDispatch={handleDispatch}
                    dispatchState={dispatchState}
                  />
                </div>

                <AuditProgressSummary stats={auditStats} waveSummary={getWaveSummary(states)} />
                <WorkerChipsRow states={states} sectionsByZone={live.sectionsByZone} />
              </div>
            </header>

            <main
              data-testid="artifact-document"
              className="mx-auto w-full max-w-3xl rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-card)] sm:p-8"
            >
              <div className="mb-8 border-b border-[var(--border-subtle)] pb-6">
                <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-tertiary)]">
                  Six-section Audit
                </div>
                <p className="mt-3 max-w-[66ch] text-[15px] leading-[1.7] text-[color:var(--text-secondary)]">
                  The document below is built from six typed Section Artifacts.
                  Each Section keeps its own evidence, status, confidence, and
                  sources so the final Audit remains inspectable instead of a
                  flattened research blob.
                </p>
              </div>

              <SectionContentList
                statusByZone={statusByZone}
                stateByZone={stateByZone}
                sectionsByZone={live.sectionsByZone}
                eventsByZone={live.eventsByZone}
                onCiteClick={(url) => {
                  setSourcesOpen(true);
                  setHighlightSourceUrl(url);
                }}
              />
            </main>
          </>
        )}

        <form
          onSubmit={handleSubmit}
          data-testid="composer"
          className={cn(
            'sticky bottom-5 z-10 mx-auto w-full max-w-3xl rounded-md border border-[var(--border-default)] bg-[var(--bg-card)]',
            'shadow-[var(--shadow-elevated)] focus-within:border-[color:var(--accent-blue)]',
          )}
        >
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Tighten a claim, redo a section, ask for sources..."
            rows={2}
            className="w-full resize-none bg-transparent px-4 py-3 text-[14px] leading-[1.5] text-[color:var(--text-primary)] placeholder:text-[color:var(--text-tertiary)] focus:outline-none"
            aria-label="Artifact command line"
          />
          <div className="flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] px-3 py-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--text-tertiary)]">
              Focus: {focusedZone && focusedZone in SECTION_SHORT_LABELS
                ? SECTION_SHORT_LABELS[focusedZone as PositioningSectionId]
                : 'Audit'}
            </span>
            <button
              type="submit"
              disabled={!draft.trim()}
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent-blue)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="size-3" aria-hidden="true" />
              Send
            </button>
          </div>
        </form>
      </div>

      <SourcesDrawer
        open={sourcesOpen}
        sources={auditSources}
        highlightUrl={highlightSourceUrl}
        onClose={() => {
          setSourcesOpen(false);
          setHighlightSourceUrl(null);
        }}
      />
    </div>
  );
}

interface AuditProgressSummaryProps {
  stats: {
    complete: number;
    running: number;
    blocked: number;
    activePhase?: string | null;
    total: number;
    sourceCount: number;
    progressPercent: number;
  };
  waveSummary: string | null;
}

function AuditProgressSummary({ stats, waveSummary }: AuditProgressSummaryProps): ReactElement {
  return (
    <div
      data-testid="audit-progress-summary"
      className="grid gap-3 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 md:grid-cols-[1fr_auto]"
    >
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-tertiary)]">
            Audit progress
          </span>
          <span className="font-mono text-[11px] text-[color:var(--text-secondary)]">
            {stats.complete}/{stats.total}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--bg-hover)]">
          <div
            className="h-full rounded-full bg-[var(--accent-blue)] transition-[width] duration-300"
            style={{ width: `${stats.progressPercent}%` }}
          />
        </div>
        {waveSummary ? (
          <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--text-secondary)]">
            {waveSummary}
          </div>
        ) : null}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center md:w-[270px]">
        <AuditMetric label="Running" value={stats.running} />
        <AuditMetric label="Blocked" value={stats.blocked} />
        <AuditMetric label="Sources" value={stats.sourceCount} />
      </div>
    </div>
  );
}

function AuditMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}): ReactElement {
  return (
    <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-2">
      <div className="font-mono text-[15px] font-semibold tabular-nums text-[color:var(--text-primary)]">
        {value}
      </div>
      <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.06em] text-[color:var(--text-tertiary)]">
        {label}
      </div>
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
}: ArtifactToolbarProps): ReactElement {
  return (
    <div className="flex items-center gap-2" data-testid="artifact-toolbar">
      {onDispatch && (
        <button
          type="button"
          onClick={onDispatch}
          disabled={dispatchState === 'firing'}
          data-testid="dispatch-button"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.06em]',
            dispatchState === 'firing' &&
              'border-[var(--accent-blue)] text-[color:var(--accent-blue)] animate-pulse',
            dispatchState === 'fired' &&
              'border-[var(--accent-green)] text-[color:var(--accent-green)]',
            dispatchState === 'error' &&
              'border-[var(--accent-red)] text-[color:var(--accent-red)]',
            dispatchState === 'idle' &&
              'border-[var(--accent-blue)] text-[color:var(--accent-blue)] hover:bg-[var(--accent-blue-subtle)]',
          )}
        >
          <Play className="size-3" aria-hidden="true" />
          {dispatchState === 'firing'
            ? 'Dispatching'
            : dispatchState === 'fired'
              ? 'Dispatched'
              : dispatchState === 'error'
                ? 'Failed'
                : 'Dispatch'}
        </button>
      )}
      <ToolbarButton onClick={onOpenSources} label="Sources" icon={<BookOpen className="size-3" />} />
      <ToolbarButton onClick={onRerun} label="Rerun" icon={<RefreshCw className="size-3" />} />
      <ToolbarButton onClick={onExport} label="Export" icon={<Download className="size-3" />} />
    </div>
  );
}

function ToolbarButton({
  onClick,
  label,
  icon,
}: {
  onClick: () => void;
  label: string;
  icon: ReactNode;
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[color:var(--text-primary)]"
    >
      {icon}
      {label}
    </button>
  );
}

function WorkerChipsRow({
  states,
  sectionsByZone,
}: {
  states: WorkerChipState[];
  sectionsByZone?: Record<string, { markdown?: string; title?: string; data?: unknown } | undefined>;
}): ReactElement {
  return (
    <div
      data-testid="worker-chips"
      className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"
    >
      {states.map((state) => {
        const body = sectionsByZone?.[state.section_id];
        const typed = body ? pickPositioningTypedArtifact(body, state.section_id) : null;
        const fullVerdict = typeof typed?.verdict === 'string' && typed.verdict.trim().length > 0
          ? typed.verdict.trim()
          : null;
        const verdictSnippet = fullVerdict
          ? fullVerdict.length > 64
            ? `${fullVerdict.slice(0, 63).trimEnd()}…`
            : fullVerdict
          : null;
        const statusText = state.phaseLabel ?? state.phase ?? state.status;
        return (
          <a
            key={state.section_id}
            href={`#section-${state.section_id}`}
            data-testid={`worker-chip-${state.section_id}`}
            data-status={state.status}
            title={fullVerdict ?? undefined}
            className={cn(
              'group flex min-h-12 items-start gap-2 rounded-md border bg-[var(--bg-card)] px-2.5 py-2 text-left transition-colors hover:border-[var(--border-hover)]',
              STATUS_CLASS[state.status],
            )}
          >
            <span
              className={cn(
                'mt-1 size-2 shrink-0 rounded-full',
                STATUS_DOT_CLASS[state.status],
              )}
              aria-hidden="true"
            />
            <span className="min-w-0">
              <span className="block truncate text-[12px] font-medium normal-case tracking-[0] text-[color:var(--text-primary)]">
                {SECTION_SHORT_LABELS[state.section_id]}
              </span>
              {verdictSnippet ? (
                <span
                  data-testid={`worker-chip-verdict-${state.section_id}`}
                  className="mt-0.5 block text-[10px] leading-snug text-[color:var(--text-secondary)] line-clamp-2"
                >
                  {verdictSnippet}
                </span>
              ) : (
                <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.06em]">
                  {statusText}
                </span>
              )}
            </span>
          </a>
        );
      })}
    </div>
  );
}

interface SectionContentListProps {
  statusByZone: Record<string, WorkerChipStatus>;
  stateByZone: Partial<Record<PositioningSectionId, WorkerChipState>>;
  sectionsByZone: Record<string, SectionArtifactBody>;
  eventsByZone: Record<string, SectionActivityEvent[]>;
  onCiteClick?: (url: string) => void;
}

interface SectionArtifactBody {
  markdown?: string | null;
  title?: string | null;
  data?: unknown;
  typedArtifact?: unknown;
  artifact?: unknown;
}

export interface SectionActivityEvent {
  id: string;
  event_type: string;
  message: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

function RawZoneActivity({
  zone,
  events,
}: {
  zone: PositioningSectionId;
  events: SectionActivityEvent[];
}): ReactElement | null {
  if (events.length === 0) return null;
  return (
    <details
      data-testid={`raw-events-details-${zone}`}
      className="mt-2 rounded-md border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3"
    >
      <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--text-tertiary)]">
        Raw activity
      </summary>
      <ol className="flex flex-col gap-1.5 text-[12px] leading-[1.5] text-[color:var(--text-secondary)]">
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
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--text-tertiary)]">
                <span>{new Date(ev.created_at).toLocaleTimeString()}</span>
                <span className="text-[color:var(--accent-blue)]">{ev.event_type}</span>
                {tools.length > 0 && (
                  <span className="text-[color:var(--text-secondary)]">{tools.join(', ')}</span>
                )}
              </div>
              {(ev.message || wrapperMessage || text) && (
                <div className="line-clamp-2 text-[color:var(--text-secondary)]">
                  {ev.message ?? wrapperMessage ?? text}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </details>
  );
}

function SectionLiveStatus({ state }: { state: WorkerChipState }): ReactElement | null {
  const elapsed = formatElapsed(state.elapsedMs);
  if (
    !state.latestActivity &&
    !state.nextStep &&
    !state.latestTool &&
    !state.latestSource &&
    !elapsed
  ) {
    return null;
  }

  return (
    <div className="mt-2 grid gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-[12px] leading-[1.5] text-[color:var(--text-secondary)] sm:grid-cols-2">
      {state.latestActivity ? (
        <div className="sm:col-span-2 text-[color:var(--text-primary)]">
          {state.latestActivity}
        </div>
      ) : null}
      {state.nextStep ? (
        <div className="font-mono text-[10px] uppercase tracking-[0.06em]">
          Next: {state.nextStep}
        </div>
      ) : null}
      {state.latestTool ? (
        <div className="font-mono text-[10px] uppercase tracking-[0.06em]">
          Tool: {state.latestTool}
        </div>
      ) : null}
      {state.latestSource ? (
        <div className="font-mono text-[10px] uppercase tracking-[0.06em]">
          Source: {displayHost(state.latestSource)}
        </div>
      ) : null}
      {elapsed ? (
        <div className="font-mono text-[10px] uppercase tracking-[0.06em]">
          Elapsed: {elapsed}
        </div>
      ) : null}
    </div>
  );
}

function StatusPill({
  status,
  label,
}: {
  status: WorkerChipStatus;
  label?: string | null;
}): ReactElement {
  return (
    <span
      data-status={status}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.06em]',
        STATUS_CLASS[status],
      )}
    >
      <span
        className={cn('size-1.5 rounded-full', STATUS_DOT_CLASS[status])}
        aria-hidden="true"
      />
      {label ?? status}
    </span>
  );
}

function SectionContentList({
  statusByZone,
  stateByZone,
  sectionsByZone,
  eventsByZone,
  onCiteClick,
}: SectionContentListProps): ReactElement {
  const anyComplete = Object.values(sectionsByZone).some(
    (s) => s && (s.markdown || s.title || s.data || pickPositioningTypedArtifact(s)),
  );
  const runningZones = POSITIONING_SECTION_IDS.filter(
    (zone) => (statusByZone[zone] ?? 'queued') === 'running',
  );

  return (
    <div className="flex flex-col gap-10">
      {!anyComplete ? (
        <div className="flex flex-col items-center gap-6 border-b border-dashed border-[var(--border-subtle)] pb-8 text-center">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-tertiary)]">
              Awaiting first section
            </div>
            <p className="mt-3 max-w-[48ch] text-[13px] leading-[1.6] text-[color:var(--text-tertiary)]">
              The orchestrator is fanning out six positioning subagents.
              Committed sections will appear inline as they commit.
            </p>
          </div>
          {runningZones.length > 0 && (
            <div className="w-full max-w-2xl space-y-4 text-left">
              {runningZones.map((zone) => {
                const events = eventsByZone[zone] ?? [];
                const state = stateByZone[zone];
                if (!state && events.length === 0) return null;
                return (
                  <div key={zone}>
                    <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--accent-blue)]">
                      {POSITIONING_SECTION_LABELS[zone]}
                    </div>
                    {state ? <SectionLiveStatus state={state} /> : null}
                    <RawZoneActivity zone={zone} events={events} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {POSITIONING_SECTION_IDS.map((zone, index) => {
        const status = statusByZone[zone] ?? 'queued';
        const body = sectionsByZone[zone];
        const typedArtifact = body
          ? pickPositioningTypedArtifact(body, zone)
          : null;
        const state = stateByZone[zone];
        const meta = draftArtifactMeta(body);
        const runtimeTiming = formatRuntimeTiming(state);
        const isComplete = Boolean(
          body && (body.markdown || body.title || body.data || typedArtifact),
        );
        const buyerIcpArtifact =
          zone === 'positioningBuyerICP' && isBuyerICPArtifact(typedArtifact)
            ? typedArtifact
            : null;
        const competitorLandscapeArtifact =
          ARTIFACT_UI_V2 &&
          zone === 'positioningCompetitorLandscape' &&
          isCompetitorLandscapeArtifact(typedArtifact)
            ? typedArtifact
            : null;
        if (isComplete) {
          return (
            <section
              key={zone}
              id={`section-${zone}`}
              data-testid={`artifact-section-${zone}`}
              className="scroll-mt-48 flex flex-col gap-4"
            >
              <header className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] pb-3">
                <div className="min-w-0">
                  <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-tertiary)]">
                    Section {String(index + 1).padStart(2, '0')}
                  </div>
                  <h2 className="mt-1 text-[18px] font-semibold tracking-[0] text-[color:var(--text-primary)]">
                    {typedArtifact?.sectionTitle ?? body?.title ?? POSITIONING_SECTION_LABELS[zone]}
                  </h2>
                  <div className="mt-2 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--text-tertiary)]">
                    {state?.executionMode ? <span>{state.executionMode}</span> : null}
                    {meta.artifactLayer ? <span>{meta.artifactLayer}</span> : null}
                    {meta.artifactLayer === 'draft' && meta.confidence !== null ? (
                      <span>Confidence {meta.confidence}/10</span>
                    ) : null}
                    {runtimeTiming ? <span>{runtimeTiming}</span> : null}
                    {meta.evidenceGapCount > 0 ? (
                      <span>{meta.evidenceGapCount} evidence gaps</span>
                    ) : null}
                  </div>
                </div>
                <StatusPill
                  status="complete"
                  label={state?.phaseLabel ?? state?.phase ?? 'Committed'}
                />
              </header>
              {buyerIcpArtifact ? (
                <BuyerICPArtifactRenderer artifact={buyerIcpArtifact} />
              ) : competitorLandscapeArtifact ? (
                <CompetitorLandscapeRenderer artifact={competitorLandscapeArtifact} />
              ) : typedArtifact ? (
                <SectionNarrativeRenderer
                  artifact={typedArtifact}
                  zoneId={zone}
                  onCiteClick={onCiteClick}
                />
              ) : (
                <div
                  className="whitespace-pre-wrap text-[14px] leading-[1.6] text-[color:var(--text-secondary)]"
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
            className="scroll-mt-48 flex flex-col gap-3 border-b border-dashed border-[var(--border-subtle)] pb-5"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-tertiary)]">
                  Section {String(index + 1).padStart(2, '0')}
                </div>
                <h2 className="mt-1 text-[18px] font-semibold tracking-[0] text-[color:var(--text-tertiary)]">
                  {POSITIONING_SECTION_LABELS[zone]}
                </h2>
              </div>
              <StatusPill
                status={status}
                label={state?.phaseLabel ?? state?.phase ?? status}
              />
            </div>
            {status === 'running' && state ? <SectionLiveStatus state={state} /> : null}
            <RawZoneActivity zone={zone} events={events} />
          </section>
        );
      })}
    </div>
  );
}

function SourcesDrawer({
  open,
  sources,
  highlightUrl,
  onClose,
}: {
  open: boolean;
  sources: AuditSourceItem[];
  highlightUrl?: string | null;
  onClose: () => void;
}): ReactElement | null {
  useEffect(() => {
    if (!open || !highlightUrl) return;
    const target = document.querySelector<HTMLElement>(
      `[data-source-url="${CSS.escape(highlightUrl)}"]`,
    );
    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [open, highlightUrl]);

  if (!open) return null;
  return (
    <div
      data-testid="sources-drawer"
      role="dialog"
      aria-label="Sources"
      className="fixed inset-y-0 right-0 z-30 flex w-full max-w-md flex-col border-l border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow-elevated)]"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.08em] text-[color:var(--text-secondary)]">
          Sources
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close sources drawer"
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--text-secondary)] hover:border-[var(--border-hover)]"
        >
          <X className="size-3" aria-hidden="true" />
          Close
        </button>
      </div>
      {sources.length === 0 ? (
        <p className="mt-4 text-[13px] leading-[1.6] text-[color:var(--text-tertiary)]">
          Source citations will appear here as typed Sections complete.
        </p>
      ) : (
        <ol className="mt-5 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
          {sources.map((source) => {
            const isHighlighted = highlightUrl === source.url;
            return (
              <li
                key={`${source.zoneId}-${source.url}`}
                data-source-url={source.url}
                data-highlighted={isHighlighted ? 'true' : undefined}
                className={cn(
                  'scroll-mt-4 rounded-md border bg-[var(--bg-surface)] p-3 transition-colors',
                  isHighlighted
                    ? 'border-[var(--accent-blue)] ring-1 ring-[var(--accent-blue)]'
                    : 'border-[var(--border-subtle)]',
                )}
              >
                <div className="font-mono text-[9px] uppercase tracking-[0.08em] text-[color:var(--text-tertiary)]">
                  {source.sectionTitle}
                </div>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex max-w-full items-start gap-1.5 break-words text-[13px] font-medium leading-snug text-[color:var(--text-primary)] hover:text-[color:var(--accent-blue)]"
                >
                  <span>{source.title}</span>
                  <ExternalLink className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                </a>
                <div className="mt-1 break-all font-mono text-[10px] text-[color:var(--text-tertiary)]">
                  {hostnameOf(source.url)}
                </div>
                {source.whyItMatters ? (
                  <p className="mt-2 text-[12px] leading-[1.5] text-[color:var(--text-secondary)]">
                    {source.whyItMatters}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
