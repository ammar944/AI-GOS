// Audit Reader one-pager shell. Replaces the dashboard-style
// AgentArtifactSurface chrome with a document-style layout:
//   - DocumentHeader (eyebrow + serif title + italic lede + mono meta row)
//   - Optional thin progress strip (hidden when status === 'complete')
//   - Six chapter sections (ChapterDivider + TypedArtifactRenderer)
//   - Footer action strip (dispatch + rerun as text links)
//
// All "wave" indicators, dispatch buttons, and audit-canvas dashboard
// chrome live in the legacy AgentArtifactSurface; that component is no
// longer mounted from research-v2/page.tsx.

'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from 'react';

import {
  POSITIONING_SECTION_IDS,
  POSITIONING_SECTION_LABELS,
  isPositioningSectionId,
  type PositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';
import { useAuditState } from '@/lib/research-v2/use-audit-state';
import {
  isRecord,
  pickPositioningTypedArtifact,
  type PositioningArtifactSource,
  type PositioningTypedArtifact,
} from '@/types/positioning-artifact';
import { cn } from '@/lib/utils';

import { DocumentHeader } from './document-header';
import { ChapterDivider } from './chapter-divider';
import { TypedArtifactRenderer } from './typed-artifact-renderer';

// ---------------------------------------------------------------------------
// Chapter eyebrows + fallback titles (pinned to mockup labels).
// ---------------------------------------------------------------------------

const CHAPTER_EYEBROWS: Record<PositioningSectionId, string> = {
  positioningMarketCategory: 'Market Category',
  positioningBuyerICP: 'Buyer ICP',
  positioningCompetitorLandscape: 'Competitor Landscape',
  positioningVoiceOfCustomer: 'Voice of Customer',
  positioningDemandIntent: 'Demand & Intent',
  positioningOfferDiagnostic: 'Offer Diagnostic',
};

const CHAPTER_FALLBACK_TITLES: Record<PositioningSectionId, string> =
  POSITIONING_SECTION_LABELS;

// ---------------------------------------------------------------------------
// Source collation (mirrors AgentArtifactSurface's walker — minus the drawer).
// ---------------------------------------------------------------------------

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

interface CollatedSource {
  title: string;
  url: string;
  whyItMatters?: string;
}

function collateAuditSources(
  sectionsByZone: Record<
    string,
    { markdown?: string; title?: string; data?: unknown } | undefined
  >,
): CollatedSource[] {
  // Deduped by URL across all zones; preserves first-seen title for each URL.
  const byUrl = new Map<string, CollatedSource>();
  for (const zoneId of POSITIONING_SECTION_IDS) {
    const body = sectionsByZone[zoneId];
    if (!body) continue;
    const artifact = pickPositioningTypedArtifact(body, zoneId);
    if (!artifact) continue;
    for (const source of artifact.sources as PositioningArtifactSource[]) {
      if (source.url && !byUrl.has(source.url)) {
        byUrl.set(source.url, {
          title: source.title || source.url,
          url: source.url,
          whyItMatters: source.whyItMatters,
        });
      }
    }
    walkArtifactItemSources(artifact, (entry) => {
      if (byUrl.has(entry.url)) return;
      byUrl.set(entry.url, entry);
    });
  }
  return Array.from(byUrl.values());
}

// ---------------------------------------------------------------------------
// Audit metadata (company name + URL come from /api/journey/session).
// useAuditState only carries section/chip data, not company identity.
// ---------------------------------------------------------------------------

interface JourneyMetadata {
  companyName?: string;
  websiteUrl?: string;
  generatedAt?: string;
  thesisStatement?: string;
}

function extractMetadata(raw: Record<string, unknown> | null): JourneyMetadata {
  if (!raw) return {};
  const name =
    typeof raw.companyName === 'string' ? raw.companyName : undefined;
  const url =
    typeof raw.websiteUrl === 'string'
      ? raw.websiteUrl
      : typeof raw.Website === 'string'
        ? (raw.Website as string)
        : undefined;
  return { companyName: name, websiteUrl: url };
}

function hostnameOf(url: string | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function readResponseError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as {
    error?: unknown;
    message?: unknown;
  } | null;
  if (typeof body?.error === 'string' && body.error.trim()) {
    return body.error.trim();
  }
  if (typeof body?.message === 'string' && body.message.trim()) {
    return body.message.trim();
  }
  return res.statusText || 'Request failed';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface AuditReaderShellProps {
  runId: string;
}

export function AuditReaderShell({ runId }: AuditReaderShellProps): ReactElement {
  const live = useAuditState(runId);
  const [meta, setMeta] = useState<JourneyMetadata>({});
  const [dispatchPending, setDispatchPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const kickoffFired = useRef(false);

  // ---- Hydrate company identity from the journey session ---------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/journey/session?runId=${runId}`, {
          cache: 'no-store',
          credentials: 'same-origin',
        });
        if (!res.ok) {
          console.warn('[audit-reader-shell] session metadata fetch failed', {
            runId,
            status: res.status,
          });
          return;
        }
        const data = (await res.json()) as {
          metadata?: Record<string, unknown> | null;
          updatedAt?: string | null;
          researchResults?: Record<string, unknown> | null;
        };
        if (cancelled) return;
        const m = extractMetadata(data.metadata ?? null);
        if (data.updatedAt) m.generatedAt = data.updatedAt;
        const corpus = data.researchResults?.deepResearchProgram;
        if (isRecord(corpus) && isRecord(corpus.data)) {
          const t = corpus.data['positioningThesis'];
          if (isRecord(t) && typeof t.statement === 'string') {
            m.thesisStatement = t.statement;
          }
        }
        setMeta(m);
      } catch (error) {
        console.warn('[audit-reader-shell] session metadata fetch failed', {
          runId,
          error: describeError(error),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  // ---- Auto-kickoff fan-out if state shows no parent yet ---------------
  useEffect(() => {
    if (kickoffFired.current) return;
    if (live.parent_audit_run_id !== null) return;
    if (live.workerStates.length === 0) return;
    kickoffFired.current = true;
    void (async () => {
      try {
        const res = await fetch('/api/research-v2/orchestrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ run_id: runId }),
        });
        if (!res.ok) {
          kickoffFired.current = false;
          console.warn('[audit-reader-shell] auto-kickoff failed', {
            runId,
            status: res.status,
            error: await readResponseError(res),
          });
        }
      } catch (error) {
        kickoffFired.current = false;
        console.warn('[audit-reader-shell] auto-kickoff failed', {
          runId,
          error: describeError(error),
        });
      }
    })();
  }, [live.parent_audit_run_id, live.workerStates.length, runId]);

  // ---- Derived state ----------------------------------------------------
  const statusByZone = useMemo(() => {
    const out: Partial<Record<PositioningSectionId, string>> = {};
    for (const w of live.workerStates) {
      if (isPositioningSectionId(w.section_id)) {
        out[w.section_id] = w.status;
      }
    }
    return out;
  }, [live.workerStates]);

  const totalSections = POSITIONING_SECTION_IDS.length;
  const completedCount = useMemo(
    () =>
      live.workerStates.filter(
        (state) =>
          isPositioningSectionId(state.section_id) &&
          state.status === 'complete',
      ).length,
    [live.workerStates],
  );
  const auditSources = useMemo(
    () => collateAuditSources(live.sectionsByZone),
    [live.sectionsByZone],
  );
  const sourcesCount = auditSources.length;

  const overallStatus: 'complete' | 'in-flight' =
    completedCount === totalSections && live.workerStates.length > 0
      ? 'complete'
      : 'in-flight';

  // ---- Header props -----------------------------------------------------
  const companyName = meta.companyName ?? hostnameOf(meta.websiteUrl) ?? '';
  const companyUrl = hostnameOf(meta.websiteUrl) || meta.websiteUrl || '';
  const lede =
    meta.thesisStatement?.trim() ||
    'Six positioning sections, each grounded in evidence and source-cited.';
  const generatedAt = meta.generatedAt
    ? new Date(meta.generatedAt)
    : new Date();

  // ---- Dispatch + rerun actions ----------------------------------------
  const handleDispatchAll = useCallback(async () => {
    setActionError(null);
    setDispatchPending(true);
    try {
      const res = await fetch('/api/research-v2/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ run_id: runId }),
      });
      if (!res.ok) {
        const message = await readResponseError(res);
        setActionError(`Dispatch failed (${res.status}): ${message}`);
        console.warn('[audit-reader-shell] manual dispatch failed', {
          runId,
          status: res.status,
          error: message,
        });
      }
    } catch (error) {
      const message = describeError(error);
      setActionError(`Dispatch failed: ${message}`);
      console.warn('[audit-reader-shell] manual dispatch failed', {
        runId,
        error: message,
      });
    } finally {
      setDispatchPending(false);
    }
  }, [runId]);

  const handleRerunBlocked = useCallback(async () => {
    setActionError(null);
    const blocked = live.workerStates.filter(
      (w) => w.status === 'error' || w.status === 'aborted',
    );
    setDispatchPending(true);
    try {
      const failures = (
        await Promise.all(
          blocked.map(async (w) => {
            const res = await fetch('/api/research-v2/rerun-section', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify({ runId, sectionId: w.section_id }),
            });
            if (res.ok) return null;
            return {
              sectionId: w.section_id,
              status: res.status,
              error: await readResponseError(res),
            };
          }),
        )
      ).filter(
        (
          failure,
        ): failure is { sectionId: PositioningSectionId; status: number; error: string } =>
          failure !== null,
      );
      if (failures.length > 0) {
        const summary = failures
          .map((failure) => `${failure.sectionId} (${failure.status})`)
          .join(', ');
        setActionError(`Rerun failed for ${summary}`);
        console.warn('[audit-reader-shell] rerun blocked sections failed', {
          runId,
          failures,
        });
      }
    } catch (error) {
      const message = describeError(error);
      setActionError(`Rerun failed: ${message}`);
      console.warn('[audit-reader-shell] rerun blocked sections failed', {
        runId,
        error: message,
      });
    } finally {
      setDispatchPending(false);
    }
  }, [live.workerStates, runId]);

  // ---- Render -----------------------------------------------------------
  return (
    <div
      data-testid="audit-reader-shell"
      className="min-h-[calc(100vh-64px)] w-full bg-[var(--bg-base)] text-[color:var(--text-primary)]"
    >
      <div className="mx-auto w-full max-w-3xl px-6 py-16 sm:px-8 lg:px-10">
        <DocumentHeader
          companyName={companyName || 'Audit'}
          companyUrl={companyUrl}
          lede={lede}
          generatedAt={generatedAt}
          sectionsComplete={completedCount}
          sectionsTotal={totalSections}
          sourcesCount={sourcesCount}
          modelLabel="Managed Agents · Claude Sonnet 4.5"
        />

        {overallStatus !== 'complete' && (
          <ProgressStrip
            complete={completedCount}
            total={totalSections}
            statusByZone={statusByZone}
          />
        )}

        {POSITIONING_SECTION_IDS.map((zoneId, index) => {
          const body = live.sectionsByZone[zoneId];
          const typed: PositioningTypedArtifact | null = body
            ? pickPositioningTypedArtifact(body, zoneId)
            : null;
          const title =
            typed?.sectionTitle ??
            body?.title ??
            CHAPTER_FALLBACK_TITLES[zoneId];
          const status = statusByZone[zoneId] ?? 'queued';
          return (
            <section
              key={zoneId}
              id={`section-${zoneId}`}
              data-testid={`audit-chapter-${zoneId}`}
              data-status={status}
              className="scroll-mt-16"
            >
              <ChapterDivider
                chapterNumber={index + 1}
                eyebrow={CHAPTER_EYEBROWS[zoneId]}
                title={title}
              />
              {typed ? (
                <TypedArtifactRenderer
                  artifact={typed}
                  zoneId={zoneId}
                  showSectionTitle={false}
                />
              ) : (
                <ChapterPlaceholder status={status} />
              )}
            </section>
          );
        })}

        <footer
          data-testid="audit-reader-footer"
          className="mt-24 border-t border-[color:var(--border-subtle)] pt-8"
        >
          {auditSources.length > 0 && (
            <ol
              data-testid="audit-reader-sources"
              className="mb-7 list-none space-y-1 p-0 font-mono text-[11px] leading-[1.9] text-[color:var(--text-tertiary)]"
            >
              {auditSources.map((source, i) => (
                <li key={source.url} data-testid="source-item">
                  <span className="mr-2.5 text-[color:var(--accent-blue)]">
                    [{i + 1}]
                  </span>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-[color:var(--text-primary)]"
                  >
                    {source.title}
                  </a>
                </li>
              ))}
            </ol>
          )}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] tracking-[0.04em] text-[color:var(--text-tertiary)]">
            <button
              type="button"
              onClick={handleDispatchAll}
              disabled={dispatchPending}
              className={cn(
                'underline underline-offset-4 transition-colors hover:text-[color:var(--text-primary)]',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              {dispatchPending ? 'dispatching…' : 'dispatch full audit'}
            </button>
            <span className="text-[color:var(--text-quaternary)]">·</span>
            <button
              type="button"
              onClick={handleRerunBlocked}
              disabled={dispatchPending}
              className={cn(
                'underline underline-offset-4 transition-colors hover:text-[color:var(--text-primary)]',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              rerun blocked sections
            </button>
            <span className="text-[color:var(--text-quaternary)]">·</span>
            <span>run {runId.slice(0, 8)}</span>
          </div>
          {actionError ? (
            <p
              role="status"
              className="mt-3 font-mono text-[11px] leading-[1.5] text-[color:var(--accent-red)]"
            >
              {actionError}
            </p>
          ) : null}
        </footer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProgressStrip — single-row mono-styled status indicator. Hidden when the
// audit is complete (see overallStatus check above).
// ---------------------------------------------------------------------------

interface ProgressStripProps {
  complete: number;
  total: number;
  statusByZone: Partial<Record<PositioningSectionId, string>>;
}

function ProgressStrip({
  complete,
  total,
  statusByZone,
}: ProgressStripProps): ReactElement {
  const running = POSITIONING_SECTION_IDS.filter(
    (id) => statusByZone[id] === 'running',
  ).length;
  const queued = POSITIONING_SECTION_IDS.filter(
    (id) => (statusByZone[id] ?? 'queued') === 'queued',
  ).length;
  const blocked = POSITIONING_SECTION_IDS.filter(
    (id) =>
      statusByZone[id] === 'error' || statusByZone[id] === 'aborted',
  ).length;
  return (
    <div
      data-testid="audit-progress-strip"
      className="mb-12 flex flex-wrap items-center gap-x-4 gap-y-1 border-y border-[color:var(--border-subtle)] py-3 font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-tertiary)]"
    >
      <span>
        drafting · {complete}/{total} sections committed
      </span>
      <span className="text-[color:var(--text-quaternary)]">·</span>
      <span>{running} running</span>
      <span className="text-[color:var(--text-quaternary)]">·</span>
      <span>{queued} queued</span>
      {blocked > 0 && (
        <>
          <span className="text-[color:var(--text-quaternary)]">·</span>
          <span className="text-[color:var(--accent-red)]">
            {blocked} blocked
          </span>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChapterPlaceholder — shown when a section has no artifact yet.
// ---------------------------------------------------------------------------

interface ChapterPlaceholderProps {
  status: string;
}

function ChapterPlaceholder({ status }: ChapterPlaceholderProps): ReactElement {
  const label =
    status === 'running'
      ? 'drafting…'
      : status === 'error' || status === 'aborted'
        ? 'needs rerun'
        : 'queued';
  return (
    <p
      data-testid="audit-chapter-placeholder"
      className="my-6 max-w-[60ch] font-mono text-[11px] uppercase tracking-[0.08em] text-[color:var(--text-quaternary)]"
    >
      {label}
    </p>
  );
}
