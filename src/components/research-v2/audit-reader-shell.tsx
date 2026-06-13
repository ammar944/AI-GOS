// Audit Reader shell — minimal "OpenAI developer platform"-style layout.
//   - thin top bar (Positioning Audit / company + Copy / Rerun)
//   - LEFT white reading column (one section at a time)
//   - RIGHT Codex-style "SECTIONS" progress panel (per-section status + sub-line)
//
// Poll-based, commit-on-complete: state comes entirely from useAuditState
// (no token streaming here). A section reads one of four ways:
//   complete  → header + Verdict card + TypedArtifactRenderer body + sources
//   running   → skeleton + live agent-activity feed (eventsByZone)
//   queued    → placeholder
//   error     → needs-review notice + rerun
//
// shadcn semantic tokens only (theme-aware): the reader inherits the active
// app theme. Verdict / header / sources are owned by the shell; the section
// renderers render body subsections only (no double-render).

'use client';

import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactElement,
  type ReactNode,
} from 'react';

import { AlertTriangle, Check, Loader2, Share2 } from 'lucide-react';

import { Shimmer } from '@/components/ai-elements/shimmer';
import { AuditChatPanel } from '@/components/research-v2/chat/audit-chat-panel';
import {
  ActivityRail,
  CompletedActivitySummary,
} from '@/components/research-v2/activity-rail';
import {
  ReaderSourcesProvider,
  SourcesFooter,
  toReaderSources,
} from '@/components/research-v2/reader-sources';
import {
  ErrorStateBlock,
  Eyebrow,
  hostname,
  LockedState,
  QueuedState,
  SectionActions,
  SectionTitle,
  StatusIcon,
  type ReaderSectionStatus,
} from '@/components/research-v2/ui-kit';
import {
  POSITIONING_SECTION_IDS,
  type AllPositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';
import { ExecutiveBriefCard } from '@/components/research-v2/executive-brief-card';
import { useAuditState } from '@/lib/research-v2/use-audit-state';
import { hasSixPositioningSectionsComplete } from '@/lib/research-v2/six-sections-complete';
import { useSectionPartials } from '@/lib/research-v2/use-section-partials';
import type {
  AuditStateResponse,
  SectionEvent,
  WorkerStatus,
} from '@/app/api/research-v2/audit-state/route';
import {
  PAID_MEDIA_PLAN_SECTION_ID,
  READER_SECTION_IDS,
  READER_SECTION_LABELS,
  type ReaderSectionId,
} from '@/components/research-v3/reader-sections';
import { StrategyBriefCard } from '@/components/research-v2/strategy-brief-card';
import {
  buildSectionActivityFeed,
  sectionFeedToSteps,
} from '@/lib/research-v2/section-activity';
import {
  pickPositioningTypedArtifact,
  isRecord,
  type PositioningTypedArtifact,
} from '@/types/positioning-artifact';
import { useSessionShare } from '@/hooks/use-session-share';
import { cn } from '@/lib/utils';

import { TypedArtifactRenderer } from './typed-artifact-renderer';
import { PaidMediaPlanDeck } from './section-renderers/paid-media-plan-deck';
import { scrubReaderText } from './primitives';

// ---------------------------------------------------------------------------
// Labels + small helpers
// ---------------------------------------------------------------------------

const SECTION_SHORT_LABEL: Record<ReaderSectionId, string> = {
  positioningMarketCategory: 'Market & Category',
  positioningBuyerICP: 'Buyer / ICP',
  positioningCompetitorLandscape: 'Competitors',
  positioningVoiceOfCustomer: 'Voice of Customer',
  positioningDemandIntent: 'Demand / Intent',
  positioningOfferDiagnostic: 'Offer Diagnostic',
  positioningPaidMediaPlan: 'Paid Media Plan',
};

type AuditWorkerState = AuditStateResponse['workerStates'][number];

const TERMINAL_ERROR_STATUSES: ReadonlySet<WorkerStatus> = new Set([
  'error',
  'aborted',
]);
const TERMINAL_READER_STATUSES: ReadonlySet<ReaderSectionStatus> = new Set([
  'complete',
  'error',
  'aborted',
]);
const COPY_META_KEYS: ReadonlySet<string> = new Set([
  'sectionTitle',
  'verdict',
  'statusSummary',
  'confidence',
  'sources',
  'verification',
  'review',
]);
const DRAFT_META_KEYS: ReadonlySet<string> = new Set([
  ...COPY_META_KEYS,
  'id',
  'runId',
  'sectionId',
  'createdAt',
  'body',
  'data',
  'typedArtifact',
  'artifact',
  'positioningArtifact',
]);
const kickedOffRunIds = new Set<string>();

// The auto-kickoff exists only for the legitimate reload-mid-flow case (the
// page's own kickoff finished but no parent landed). It must NOT race the
// page's in-flight fire-and-forget orchestrate POST. We require the parentless
// state to persist for at least one full audit-state poll cycle before firing,
// giving an in-flight page kickoff time to seed the parent. useAuditState polls
// every 2500ms; one full cycle is the floor.
const AUTO_KICKOFF_MIN_PARENTLESS_AGE_MS = 3000;

function cleanTitle(sectionTitle: string): string {
  return sectionTitle.split('—')[0].split(' - ')[0].trim();
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function readResponseError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as {
    error?: unknown;
    message?: unknown;
  } | null;
  if (typeof body?.error === 'string' && body.error.trim()) return body.error.trim();
  if (typeof body?.message === 'string' && body.message.trim()) {
    return body.message.trim();
  }
  return res.statusText || 'Request failed';
}

interface JourneyMetadata {
  companyName?: string;
  websiteUrl?: string;
}

function extractMetadata(raw: Record<string, unknown> | null): JourneyMetadata {
  if (!raw) return {};
  const name = typeof raw.companyName === 'string' ? raw.companyName : undefined;
  const url =
    typeof raw.websiteUrl === 'string'
      ? raw.websiteUrl
      : typeof raw.Website === 'string'
        ? (raw.Website as string)
        : undefined;
  return { companyName: name, websiteUrl: url };
}

function scrollElementToTop(element: HTMLElement | null): void {
  if (!element || typeof element.scrollTo !== 'function') return;
  element.scrollTo({ top: 0 });
}

function humanizeCopyKey(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function hasCopyValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number' || typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.some(hasCopyValue);
  if (isRecord(value)) return Object.values(value).some(hasCopyValue);
  return false;
}

function primitiveCopyValue(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

function recordTitle(value: Record<string, unknown>): string | null {
  for (const key of ['name', 'title', 'label', 'metric', 'competitor', 'phaseName']) {
    const candidate = value[key];
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate;
    }
  }

  return null;
}

function appendMarkdownValue(
  lines: string[],
  value: unknown,
  depth: number,
): void {
  const primitive = primitiveCopyValue(value);
  if (primitive !== null) {
    lines.push(primitive);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value.filter(hasCopyValue)) {
      const itemPrimitive = primitiveCopyValue(item);
      if (itemPrimitive !== null) {
        lines.push(`- ${itemPrimitive}`);
        continue;
      }

      if (!isRecord(item)) {
        continue;
      }

      const title = recordTitle(item);
      lines.push(title === null ? '-' : `- ${title}`);
      for (const [key, itemValue] of Object.entries(item)) {
        if (!hasCopyValue(itemValue) || itemValue === title) continue;
        const nestedPrimitive = primitiveCopyValue(itemValue);
        if (nestedPrimitive !== null) {
          lines.push(`  - ${humanizeCopyKey(key)}: ${nestedPrimitive}`);
        } else {
          lines.push(`  - ${humanizeCopyKey(key)}:`);
          appendMarkdownValue(lines, itemValue, depth + 1);
        }
      }
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  const prose = value.prose;
  if (typeof prose === 'string' && prose.trim().length > 0) {
    lines.push(prose);
    lines.push('');
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (key === 'prose' || !hasCopyValue(nestedValue)) continue;
    const headingLevel = depth >= 1 ? '###' : '##';
    lines.push(`${headingLevel} ${humanizeCopyKey(key)}`);
    appendMarkdownValue(lines, nestedValue, depth + 1);
    lines.push('');
  }
}

function artifactToMarkdown(artifact: PositioningTypedArtifact): string {
  const lines: string[] = [
    `# ${cleanTitle(artifact.sectionTitle)}`,
    '',
    '## Verdict',
    artifact.verdict,
    '',
    '## Status',
    artifact.statusSummary,
    '',
  ];
  const bodyEntries = Object.entries(artifact).filter(
    ([key, value]) => !COPY_META_KEYS.has(key) && hasCopyValue(value),
  );

  for (const [key, value] of bodyEntries) {
    lines.push(`## ${humanizeCopyKey(key)}`);
    appendMarkdownValue(lines, value, 0);
    lines.push('');
  }

  if (artifact.sources.length > 0) {
    lines.push('## Sources');
    for (const source of artifact.sources) {
      lines.push(`- [${source.title}](${source.url})`);
    }
    lines.push('');
  }

  return `${lines.join('\n').trim()}\n`;
}

// Verifier metric chrome (tier rationale, removed-items list) is intentionally
// not rendered — only the client-facing questions surface (user decision
// 2026-06-11; verification data still persists in DB/API).
function ReviewMetadataPanel({
  review,
}: {
  review: NonNullable<PositioningTypedArtifact['review']>;
}): ReactElement | null {
  if (review.clientQuestions.length === 0) return null;

  return (
    <div className="space-y-4 rounded-md border border-border bg-background p-4">
      <div className="space-y-2">
        <Eyebrow>Open questions for you ({review.clientQuestions.length})</Eyebrow>
        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
          {review.clientQuestions.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// `needsReview` is the verification tier delivered in the audit-state payload
// (needs_review / insufficient). A committed section that the verifier flagged
// reads honestly as 'Complete — needs review' instead of plain 'Complete'.
// This reverses the 2026-06-11 "done is done" decision per the 2026-06-12 bar
// (success chrome may not overclaim needs_review content).
function sectionStatusSubline(
  status: ReaderSectionStatus,
  needsReview = false,
): string {
  if (status === 'complete') {
    return needsReview ? 'Complete — needs review' : 'Complete';
  }
  if (status === 'error') return 'Failed';
  if (status === 'aborted') return 'Aborted';
  if (status === 'ready') return 'Ready after 6/6';
  if (status === 'locked') return 'Locked until 6/6';
  if (status === 'running') return 'Running';
  if (status === 'queued') return 'Queued';
  return status;
}

function eventMetadata(
  event: SectionEvent,
): Record<string, unknown> | null {
  const payload = event.payload;
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const metadata = (payload as Record<string, unknown>).metadata;
    if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
      return metadata as Record<string, unknown>;
    }
    return payload as Record<string, unknown>;
  }
  return null;
}

function formatSectionDurationLabel(events: readonly SectionEvent[]): string | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.event_type !== 'section-completed') continue;
    const durationMs = eventMetadata(event)?.durationMs;
    if (typeof durationMs !== 'number' || !Number.isFinite(durationMs)) {
      continue;
    }
    const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  }
  return null;
}

function deriveCompletedActivitySummary(
  events: readonly SectionEvent[],
  artifact: PositioningTypedArtifact | null,
): {
  sourceCount: number;
  toolCount: number;
  durationLabel: string | null;
} {
  const feed = buildSectionActivityFeed({
    events: [...events],
    latestActivity: null,
    phaseLabel: 'Committed',
  });

  return {
    sourceCount: artifact?.sources.length ?? 0,
    toolCount: feed.counts.toolsFinished,
    durationLabel: formatSectionDurationLabel(events),
  };
}

function RunningActivityView({
  phaseLabel,
  latestActivity,
  events,
}: {
  phaseLabel: string;
  latestActivity: string | null;
  events: SectionEvent[];
}): ReactElement {
  const activity = buildSectionActivityFeed({
    events,
    latestActivity,
    phaseLabel,
  });

  return (
    <ActivityRail
      steps={sectionFeedToSteps(activity)}
      currentLabel={activity.currentLabel}
      live
    />
  );
}

interface TypedArtifactErrorBoundaryProps {
  children: ReactNode;
  sectionId: string;
}

interface TypedArtifactErrorBoundaryState {
  failed: boolean;
}

class TypedArtifactErrorBoundary extends Component<
  TypedArtifactErrorBoundaryProps,
  TypedArtifactErrorBoundaryState
> {
  public state: TypedArtifactErrorBoundaryState = { failed: false };

  public static getDerivedStateFromError(): TypedArtifactErrorBoundaryState {
    return { failed: true };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    console.warn('[audit-reader-shell] typed artifact render failed', {
      error: describeError(error),
      componentStack: info.componentStack,
      sectionId: this.props.sectionId,
    });
  }

  public render(): ReactNode {
    if (this.state.failed) {
      return (
        <div className="border-l-2 border-red-500 pl-4 text-[14px] text-muted-foreground">
          Section body could not render.
        </div>
      );
    }

    return this.props.children;
  }
}

export function buildDraftArtifact({
  active,
  snapshot,
}: {
  active: ReaderSectionId;
  snapshot: Record<string, unknown>;
}): PositioningTypedArtifact {
  // The streamed partial snapshot is shaped { verdict, statusSummary, sources, body }
  // (buildStructuredSectionDraftSchema). We only read body here (top-level verdict/
  // statusSummary/sources are ignored on the draft view). The committed artifact renders the body's
  // sub-section keys at the top level, so unwrap body here too — otherwise
  // The committed artifact renders the body's sub-section keys at the top level.
  // Fall back to the raw snapshot for the legacy bare-body shape / pre-body partials.
  const body = snapshot.body;
  const bodyRecord =
    typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : Object.fromEntries(
          Object.entries(snapshot).filter(([key]) => !DRAFT_META_KEYS.has(key)),
        );
  return {
    sectionTitle: READER_SECTION_LABELS[active],
    verdict: 'Partial draft',
    statusSummary: 'Streaming section body...',
    confidence: 0,
    sources: [],
    ...bodyRecord,
  } as PositioningTypedArtifact;
}

function DraftingArtifactView({
  artifact,
  zoneId,
  phaseLabel,
}: {
  artifact: PositioningTypedArtifact;
  zoneId: ReaderSectionId;
  phaseLabel: string;
}): ReactElement {
  const rawFindings = artifact.keyFindings;
  const findings = Array.isArray(rawFindings)
    ? rawFindings
        .map((item) => {
          if (typeof item === 'string') return item;
          if (!isRecord(item)) return null;
          const sentence = item.sentence ?? item.finding ?? item.title;
          return typeof sentence === 'string' ? sentence : null;
        })
        .filter((item): item is string => item !== null)
        .slice(0, 3)
    : [];

  return (
    <div className="mt-8 space-y-6">
      <div className="flex items-center gap-2.5 text-[13px] text-foreground">
        <Loader2
          className="size-4 animate-spin text-primary motion-reduce:animate-none"
          strokeWidth={2.5}
          aria-hidden="true"
        />
        <span className="font-medium">{phaseLabel}</span>
      </div>
      <section
        data-testid={`drafting-section-skeleton-${zoneId}`}
        className="grid gap-5 border-l-2 border-primary/40 pl-5"
      >
        <div>
          <Eyebrow>{READER_SECTION_LABELS[zoneId]}</Eyebrow>
          <h3 className="mt-2 max-w-[18ch] font-sans text-[28px] font-semibold leading-[1.1] tracking-[0] text-foreground">
            Drafting the section verdict
          </h3>
        </div>
        {findings.length > 0 ? (
          <ol className="grid gap-3">
            {findings.map((finding, index) => (
              <li key={`${finding}-${index}`} className="grid grid-cols-[24px_1fr] gap-3">
                <span className="font-mono text-[12px] font-semibold text-foreground">
                  {index + 1}
                </span>
                <p className="text-[14px] leading-[1.55] text-muted-foreground">
                  {scrubReaderText(finding)}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <div className="grid gap-3" aria-hidden="true">
            <div className="h-4 w-11/12 animate-pulse rounded bg-muted motion-reduce:animate-none" />
            <div className="h-4 w-4/5 animate-pulse rounded bg-muted motion-reduce:animate-none" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          </div>
        )}
      </section>
    </div>
  );
}

function PaidMediaPlanTerminalPanel({
  artifact,
  events,
  statusText,
  subjectName,
}: {
  artifact: PositioningTypedArtifact | null;
  events: readonly SectionEvent[];
  statusText: string;
  subjectName?: string;
}): ReactElement {
  // The deck is the deliverable; the operator renderer stays reachable behind
  // a small 'Working view' toggle.
  const [view, setView] = useState<'deck' | 'working'>('deck');
  const readerSources = artifact ? toReaderSources(artifact.sources) : [];

  return (
    <div className="space-y-7">
      {artifact ? (
        <>
          <div className="no-print flex justify-end">
            <div
              role="group"
              aria-label="Paid media plan view"
              className="inline-flex rounded-md border border-border p-0.5"
            >
              <button
                type="button"
                onClick={() => setView('deck')}
                aria-pressed={view === 'deck'}
                className={cn(
                  'rounded px-2.5 py-1 text-[12px] font-medium transition-colors',
                  view === 'deck'
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Deck
              </button>
              <button
                type="button"
                onClick={() => setView('working')}
                aria-pressed={view === 'working'}
                className={cn(
                  'rounded px-2.5 py-1 text-[12px] font-medium transition-colors',
                  view === 'working'
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Working view
              </button>
            </div>
          </div>
          {view === 'deck' ? (
            <TypedArtifactErrorBoundary sectionId={PAID_MEDIA_PLAN_SECTION_ID}>
              <PaidMediaPlanDeck artifact={artifact} subjectName={subjectName} />
            </TypedArtifactErrorBoundary>
          ) : (
            <ReaderSourcesProvider sources={readerSources}>
              <TypedArtifactErrorBoundary sectionId={PAID_MEDIA_PLAN_SECTION_ID}>
                <TypedArtifactRenderer
                  artifact={artifact}
                  zoneId={PAID_MEDIA_PLAN_SECTION_ID}
                  showSectionTitle={false}
                />
              </TypedArtifactErrorBoundary>
            </ReaderSourcesProvider>
          )}
          <SourcesFooter sources={readerSources} />
        </>
      ) : (
        <LockedState text={statusText} />
      )}
    </div>
  );
}

function InitialAuditLoadingState(): ReactElement {
  return (
    <div
      data-testid="audit-state-initial-loading"
      aria-label="Loading audit state"
      className="mt-2 space-y-8"
    >
      <div className="space-y-3" aria-hidden="true">
        <div className="h-3 w-24 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        <div className="h-9 w-72 max-w-full animate-pulse rounded bg-muted motion-reduce:animate-none" />
      </div>
      <div className="grid gap-4 border-l-2 border-primary/30 pl-5" aria-hidden="true">
        <div className="h-4 w-11/12 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted motion-reduce:animate-none" />
      </div>
      <div className="grid gap-3" aria-hidden="true">
        <div className="h-20 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
        <div className="h-20 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
      </div>
    </div>
  );
}

function RunStatusLoadingCard(): ReactElement {
  return (
    <div
      data-testid="run-status-loading"
      aria-label="Loading run status"
      className="rounded-lg border border-border bg-card p-3 shadow-sm"
    >
      <div className="flex items-center justify-between gap-2" aria-hidden="true">
        <div className="h-4 w-16 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        <div className="h-4 w-10 animate-pulse rounded bg-muted motion-reduce:animate-none" />
      </div>
      <div className="my-3 h-px bg-border" aria-hidden="true" />
      <div className="grid gap-2" aria-hidden="true">
        {READER_SECTION_IDS.map((id) => (
          <div key={id} className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="size-[18px] animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-3 w-28 animate-pulse rounded bg-muted motion-reduce:animate-none" />
              <div className="h-2.5 w-16 animate-pulse rounded bg-muted motion-reduce:animate-none" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Run-status card (merged SectionRail + RunStatusBar) + mobile switcher
// ---------------------------------------------------------------------------

function formatElapsedClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

interface RunStatusCardProps {
  active: ReaderSectionId;
  onSelect: (id: ReaderSectionId) => void;
  statusOf: (id: ReaderSectionId) => ReaderSectionStatus;
  needsReviewOf: (id: ReaderSectionId) => boolean;
  needsReviewCount: number;
  positioningCompletedCount: number;
  activePhaseLabel: string | null;
  elapsedMs: number | null;
  runDispatched: boolean;
  allSectionsTerminal: boolean;
}

// Self-contained floating status box docked in the right gutter. Merges the
// old left SectionRail (section navigator) with the old top-right RunStatusBar
// (run rollup) into one Codex-style card: rollup header → active-phase shimmer
// → section list (clickable navigator).
function RunStatusCard({
  active,
  onSelect,
  statusOf,
  needsReviewOf,
  needsReviewCount,
  positioningCompletedCount,
  activePhaseLabel,
  elapsedMs,
  runDispatched,
  allSectionsTerminal,
}: RunStatusCardProps): ReactElement {
  const running = runDispatched && !allSectionsTerminal;
  const phase = activePhaseLabel ?? 'researching live sources';

  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
      {/* Header: rollup + elapsed clock + run state. The rollup is tier-honest:
          'Done' carries a quiet 'N of 6 need review' qualifier when the
          verifier flagged committed sections (reverses the 2026-06-11
          "done is done" decision per the 2026-06-12 bar). */}
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5">
          {running ? (
            <Loader2
              className="size-3.5 animate-spin text-primary motion-reduce:animate-none"
              strokeWidth={2.5}
              aria-hidden="true"
            />
          ) : allSectionsTerminal ? (
            <Check className="size-3.5 text-emerald-600" strokeWidth={3} aria-hidden="true" />
          ) : null}
          <span className="font-mono text-[12px] font-medium tabular-nums text-foreground">
            {positioningCompletedCount}/{POSITIONING_SECTION_IDS.length}
          </span>
          {allSectionsTerminal ? (
            <span className="text-[12px] font-medium text-muted-foreground">Done</span>
          ) : null}
          {allSectionsTerminal && needsReviewCount > 0 ? (
            <span className="text-[11px] text-muted-foreground/80">
              {needsReviewCount} of {POSITIONING_SECTION_IDS.length} need review
            </span>
          ) : null}
        </span>
        {running && elapsedMs !== null ? (
          <span className="font-mono text-[12px] font-medium tabular-nums text-muted-foreground">
            {formatElapsedClock(elapsedMs)}
          </span>
        ) : null}
      </div>

      {/* Active phase line — only while the run is live */}
      {running ? (
        <Shimmer className="mt-2 block truncate text-[12px]" duration={2.2}>
          {phase}
        </Shimmer>
      ) : null}

      <div className="my-3 h-px bg-border" aria-hidden="true" />

      {/* Section navigator */}
      <nav
        data-testid="section-progress-strip"
        className="flex flex-col gap-0.5"
        aria-label="Sections"
      >
        {READER_SECTION_IDS.map((id) => {
          const status = statusOf(id);
          const needsReview = status === 'complete' && needsReviewOf(id);
          const subLine = sectionStatusSubline(status, needsReview);
          const label = `${SECTION_SHORT_LABEL[id]}: ${subLine}`;
          const isActive = id === active;

          return (
            <button
              key={id}
              type="button"
              aria-label={label}
              title={label}
              onClick={() => onSelect(id)}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors',
                isActive ? 'bg-secondary' : 'hover:bg-secondary/50',
              )}
            >
              <StatusIcon status={status} className="mt-px size-[18px] shrink-0" />
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    'block truncate text-[13px]',
                    isActive
                      ? 'font-medium text-foreground'
                      : 'text-foreground/80',
                  )}
                >
                  {SECTION_SHORT_LABEL[id]}
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  {needsReview ? (
                    <span
                      data-testid={`section-tier-dot-${id}`}
                      aria-hidden="true"
                      className="inline-block size-1.5 shrink-0 rounded-full bg-amber-500"
                    />
                  ) : null}
                  {subLine}
                </span>
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

// Horizontal section switcher for small screens (DESIGN Section Tabs idiom:
// no background, active = foreground text + 1.5px primary bottom border).
function MobileSectionSwitcher({
  active,
  onSelect,
  statusOf,
}: {
  active: ReaderSectionId;
  onSelect: (id: ReaderSectionId) => void;
  statusOf: (id: ReaderSectionId) => ReaderSectionStatus;
}): ReactElement {
  return (
    <nav
      aria-label="Sections (mobile)"
      data-testid="mobile-section-switcher"
      className="-mx-6 mb-6 flex gap-4 overflow-x-auto border-b border-border px-6 pb-px sm:hidden"
    >
      {READER_SECTION_IDS.map((id) => {
        const status = statusOf(id);
        const isActive = id === active;
        return (
          <button
            key={id}
            type="button"
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onSelect(id)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-[1.5px] pb-2 text-[12px] font-medium transition-colors',
              isActive
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {status === 'running' ? (
              <Loader2
                className="size-3 animate-spin text-primary motion-reduce:animate-none"
                strokeWidth={2.5}
              />
            ) : status === 'complete' ? (
              <Check className="size-3 text-primary" strokeWidth={3} />
            ) : status === 'error' || status === 'aborted' ? (
              <AlertTriangle className="size-3 text-destructive" strokeWidth={2.5} />
            ) : null}
            {SECTION_SHORT_LABEL[id]}
          </button>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface AuditReaderShellProps {
  runId: string;
  activeSectionId?: ReaderSectionId;
  onSectionChange?: (sectionId: ReaderSectionId) => void;
}

export function AuditReaderShell({
  runId,
  activeSectionId,
  onSectionChange,
}: AuditReaderShellProps): ReactElement {
  const mainRef = useRef<HTMLElement>(null);
  const parentlessSinceRef = useRef<number | null>(null);
  const [meta, setMeta] = useState<JourneyMetadata>({});
  const [userActive, setUserActive] = useState<ReaderSectionId | null>(null);
  const [autoActive, setAutoActive] = useState<ReaderSectionId | null>(null);
  const [rerunPending, setRerunPending] = useState<ReaderSectionId | null>(
    null,
  );
  const [pollRefreshKey, setPollRefreshKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const {
    copied: shareCopied,
    error: shareError,
    handleShare,
    isSharing,
  } = useSessionShare();
  const live = useAuditState(runId, pollRefreshKey);
  const auditStateLoaded = live.loadState !== 'loading';

  useEffect(() => {
    setUserActive(null);
    setAutoActive(null);
  }, [runId]);
  // ---- Hydrate company identity from the journey session ---------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/journey/session?runId=${runId}`, {
          cache: 'no-store',
          credentials: 'same-origin',
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          metadata?: Record<string, unknown> | null;
        };
        if (cancelled) return;
        setMeta(extractMetadata(data.metadata ?? null));
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
  // Belt to the layer-1 (dispatch gating) + layer-2 (non-fatal CAS) suspenders.
  // Only fires for the legitimate reload-mid-flow case, and only once the
  // parentless state has persisted for a full poll cycle so it cannot race the
  // page's own in-flight orchestrate POST while the seed is still committing.
  useEffect(() => {
    if (!auditStateLoaded) return;

    const parentless =
      live.parent_audit_run_id === null && live.workerStates.length > 0;

    if (!parentless) {
      parentlessSinceRef.current = null;
      return;
    }
    if (kickedOffRunIds.has(runId)) return;

    const now = Date.now();
    if (parentlessSinceRef.current === null) {
      parentlessSinceRef.current = now;
    }

    const fireKickoff = (): void => {
      if (kickedOffRunIds.has(runId)) return;
      kickedOffRunIds.add(runId);
      void (async () => {
        try {
          const res = await fetch('/api/research-v2/orchestrate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ run_id: runId, executionMode: 'lab' }),
          });
          if (!res.ok) {
            console.warn('[audit-reader-shell] auto-kickoff failed', {
              runId,
              status: res.status,
              error: await readResponseError(res),
            });
          }
        } catch (error) {
          console.warn('[audit-reader-shell] auto-kickoff failed', {
            runId,
            error: describeError(error),
          });
        }
      })();
    };

    const elapsed = now - parentlessSinceRef.current;
    if (elapsed >= AUTO_KICKOFF_MIN_PARENTLESS_AGE_MS) {
      fireKickoff();
      return;
    }

    // Not aged in yet. Re-check after the remaining gate window in case polling
    // delivers no further state change (e.g. the run is genuinely orphaned).
    const timer = window.setTimeout(
      fireKickoff,
      AUTO_KICKOFF_MIN_PARENTLESS_AGE_MS - elapsed,
    );
    return () => window.clearTimeout(timer);
  }, [auditStateLoaded, live.parent_audit_run_id, live.workerStates.length, runId]);

  // ---- Derived state ----------------------------------------------------
  const workerById = useMemo(() => {
    const m = new Map<AllPositioningSectionId, AuditWorkerState>();
    for (const w of live.workerStates) m.set(w.section_id, w);
    return m;
  }, [live.workerStates]);

  const typedByZone = useMemo(() => {
    const m = new Map<ReaderSectionId, PositioningTypedArtifact | null>();
    for (const id of READER_SECTION_IDS) {
      const body = live.sectionsByZone[id];
      m.set(id, body ? pickPositioningTypedArtifact(body, id) : null);
    }
    return m;
  }, [live.sectionsByZone]);

  const sixSectionsComplete = hasSixPositioningSectionsComplete(live);

  // Tier honesty: the audit-state payload ships verificationTier per zone.
  // A committed section flagged needs_review/insufficient surfaces as
  // 'Complete — needs review' with a quiet amber dot in the rail.
  const needsReviewOf = useCallback(
    (id: ReaderSectionId): boolean => {
      const tier = live.sectionsByZone[id]?.verificationTier;
      return tier === 'needs_review' || tier === 'insufficient';
    },
    [live.sectionsByZone],
  );

  const statusOf = useCallback(
    (id: ReaderSectionId): ReaderSectionStatus => {
      const worker = workerById.get(id);
      if (worker?.status === 'running') return 'running';
      if (worker && TERMINAL_ERROR_STATUSES.has(worker.status)) return worker.status;
      if (worker?.status === 'queued') return 'queued';
      if (worker?.status === 'complete' || live.sectionsByZone[id]) {
        return 'complete';
      }
      if (id === PAID_MEDIA_PLAN_SECTION_ID) {
        return sixSectionsComplete ? 'ready' : 'locked';
      }
      return 'queued';
    },
    [
      live.sectionsByZone,
      sixSectionsComplete,
      workerById,
    ],
  );

  // Zones whose section has reached a terminal status. Passed to
  // useSectionPartials so a committed zone's stale draft partial is explicitly
  // cleared from the partials Record on commit, rather than only being hidden
  // by the `activeStatus === 'running'` render guard below.
  const committedZones = useMemo(() => {
    const zones = new Set<string>();
    for (const id of READER_SECTION_IDS) {
      if (TERMINAL_READER_STATUSES.has(statusOf(id))) {
        zones.add(id);
      }
    }
    return zones;
  }, [statusOf]);

  const sectionPartials = useSectionPartials(runId, committedZones);

  // Default selection: first running, else first complete, else first.
  const computedDefault = useMemo<ReaderSectionId>(() => {
    const firstRunning = READER_SECTION_IDS.find(
      (id) => statusOf(id) === 'running',
    );
    const firstComplete = READER_SECTION_IDS.find(
      (id) => statusOf(id) === 'complete',
    );
    return firstRunning ?? firstComplete ?? READER_SECTION_IDS[0];
  }, [statusOf]);

  useEffect(() => {
    if (
      activeSectionId !== undefined ||
      userActive !== null ||
      autoActive !== null
    ) {
      return;
    }

    setAutoActive(computedDefault);
  }, [activeSectionId, autoActive, computedDefault, userActive]);

  const active = activeSectionId ?? userActive ?? autoActive ?? computedDefault;
  const activeIndex = READER_SECTION_IDS.indexOf(active);
  const activeTyped = typedByZone.get(active) ?? null;
  const activeReview = activeTyped?.review ?? null;
  const activeStatus = statusOf(active);
  const activeWorker = workerById.get(active) ?? null;
  const executiveBrief = isRecord(live.executive_brief)
    ? live.executive_brief
    : null;
  const strategyBriefArtifact = isRecord(live.sectionsByZone.strategyBrief?.data)
    ? live.sectionsByZone.strategyBrief.data
    : null;
  const activeDraftArtifact = useMemo(() => {
    const partial = sectionPartials[active];

    if (activeStatus !== 'running' || partial === undefined) {
      return null;
    }

    return buildDraftArtifact({
      active,
      snapshot: partial.snapshot,
    });
  }, [active, activeStatus, sectionPartials]);

  // Positioning-only completed count for the run bar (its denominator excludes
  // the terminal paid-media section, so the numerator must too — avoids "7/6"
  // when paid-media commits while a positioning section is still non-terminal).
  const positioningCompletedCount = useMemo(
    () =>
      POSITIONING_SECTION_IDS.filter((id) => statusOf(id) === 'complete').length,
    [statusOf],
  );

  const needsReviewCount = useMemo(
    () =>
      POSITIONING_SECTION_IDS.filter(
        (id) => statusOf(id) === 'complete' && needsReviewOf(id),
      ).length,
    [needsReviewOf, statusOf],
  );


  const allSectionsTerminal = useMemo(
    () =>
      READER_SECTION_IDS.every((id) =>
        TERMINAL_READER_STATUSES.has(statusOf(id)),
      ),
    [statusOf],
  );
  const shouldRenderExecutiveBrief =
    allSectionsTerminal && executiveBrief !== null;

  // Active phase label = the running worker's human-readable phase (already
  // customer-safe, e.g. "Reading sources"). Null when nothing is running.
  const activePhaseLabel = useMemo(() => {
    for (const id of READER_SECTION_IDS) {
      if (statusOf(id) !== 'running') continue;
      const worker = workerById.get(id);
      const label = worker?.phaseLabel;
      if (label && label !== 'Queued') return label;
    }
    return null;
  }, [statusOf, workerById]);

  // Earliest worker start; anchors the elapsed clock. Falls back to the first
  // client observation so the clock is robust even without server timings.
  const runObservedAtRef = useRef<number | null>(null);
  const earliestStartMs = useMemo(() => {
    let earliest: number | null = null;
    for (const worker of live.workerStates) {
      const started = worker.runtimeTimings.sectionStartedAt;
      if (!started) continue;
      const parsed = Date.parse(started);
      if (Number.isNaN(parsed)) continue;
      if (earliest === null || parsed < earliest) earliest = parsed;
    }
    return earliest;
  }, [live.workerStates]);

  // The run is "dispatched" once a parent exists or any worker row is present.
  const runDispatched =
    auditStateLoaded &&
    (live.parent_audit_run_id !== null || live.workerStates.length > 0);

  useEffect(() => {
    if (!runDispatched) return;
    if (runObservedAtRef.current === null) {
      runObservedAtRef.current = Date.now();
    }
  }, [runDispatched]);

  // 1s ticker — only while the run is live, so a finished run stops counting.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (allSectionsTerminal || !runDispatched) return;
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [allSectionsTerminal, runDispatched]);

  const elapsedMs = useMemo(() => {
    const start = earliestStartMs ?? runObservedAtRef.current;
    if (start === null) return null;
    return Math.max(0, nowMs - start);
  }, [earliestStartMs, nowMs]);

  const company = meta.companyName || hostname(meta.websiteUrl) || 'Audit';
  const shareTitle = `${company} Positioning Audit`;

  const activeEvents = useMemo(
    () => live.eventsByZone[active] ?? [],
    [live.eventsByZone, active],
  );
  const activeReaderSources = activeTyped
    ? toReaderSources(activeTyped.sources)
    : [];
  const completedActivitySummary = useMemo(
    () => deriveCompletedActivitySummary(activeEvents, activeTyped),
    [activeEvents, activeTyped],
  );
  const sectionActionsEnabled = TERMINAL_READER_STATUSES.has(activeStatus);

  // ---- Selection + scroll reset ----------------------------------------
  const select = useCallback(
    (id: ReaderSectionId) => {
      if (!activeSectionId) {
        setUserActive(id);
      }
      onSectionChange?.(id);
      scrollElementToTop(mainRef.current);
    },
    [activeSectionId, onSectionChange],
  );

  // Keyboard arrows switch sections (ignore while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.isContentEditable)
      ) {
        return;
      }
      if (e.key === 'ArrowLeft' && activeIndex > 0) {
        select(READER_SECTION_IDS[activeIndex - 1]);
      }
      if (
        e.key === 'ArrowRight' &&
        activeIndex < READER_SECTION_IDS.length - 1
      ) {
        select(READER_SECTION_IDS[activeIndex + 1]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeIndex, select]);

  // ---- Actions ----------------------------------------------------------
  const rerunSection = useCallback(
    async (sectionId: ReaderSectionId) => {
      setRerunPending(sectionId);
      try {
        const res = await fetch('/api/research-v2/rerun-section', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ runId, zone: sectionId, executionMode: 'lab' }),
        });
        if (!res.ok) {
          console.warn('[audit-reader-shell] rerun-section failed', {
            runId,
            sectionId,
            status: res.status,
            error: await readResponseError(res),
          });
        } else {
          setPollRefreshKey((key) => key + 1);
        }
      } catch (error) {
        console.warn('[audit-reader-shell] rerun-section failed', {
          runId,
          sectionId,
          error: describeError(error),
        });
      } finally {
        setRerunPending(null);
      }
    },
    [runId],
  );

  const copyActive = useCallback(async () => {
    if (!activeTyped) return;
    const text = artifactToMarkdown(activeTyped);
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.warn('[audit-reader-shell] copy failed', {
        sectionId: active,
        error: describeError(error),
      });
      setCopyError(true);
      window.setTimeout(() => setCopyError(false), 2000);
    }
  }, [active, activeTyped]);

  const shareAudit = useCallback((): void => {
    void handleShare(runId, shareTitle);
  }, [handleShare, runId, shareTitle]);

  const refreshAuditState = useCallback((): void => {
    setPollRefreshKey((key) => key + 1);
  }, []);

  // ---- Render -----------------------------------------------------------
  return (
    <div
      data-testid="audit-reader-shell"
      className="flex h-full flex-col bg-background font-sans text-foreground"
    >
      {/* top bar */}
      <header className="no-print flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-5">
        <div className="flex items-center gap-2.5">
          <Eyebrow>Positioning Audit</Eyebrow>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-[13px] font-semibold tracking-tight text-foreground">
            {company}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {shareError ? (
            <span className="hidden text-[12px] text-destructive sm:inline">
              {shareError}
            </span>
          ) : null}
          <button
            type="button"
            aria-label="Share audit"
            title="Share audit"
            onClick={shareAudit}
            disabled={isSharing || !runDispatched}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            {isSharing ? (
              <Loader2
                className="size-3.5 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : (
              <Share2 className="size-3.5" aria-hidden="true" />
            )}
            {isSharing ? 'Sharing' : shareCopied ? 'Copied' : 'Share'}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <main ref={mainRef} className="flex-1 overflow-y-auto bg-card">
          <article className="mx-auto max-w-[860px] px-6 py-10 sm:px-10">
            {!auditStateLoaded ? (
              <InitialAuditLoadingState />
            ) : (
              <>
                <MobileSectionSwitcher
                  active={active}
                  onSelect={select}
                  statusOf={statusOf}
                />

                {strategyBriefArtifact ? (
                  <TypedArtifactErrorBoundary sectionId="strategyBrief">
                    <StrategyBriefCard artifact={strategyBriefArtifact} />
                  </TypedArtifactErrorBoundary>
                ) : null}

                {shouldRenderExecutiveBrief ? (
                  <ExecutiveBriefCard
                    brief={executiveBrief}
                    sectionLabelOf={(sectionId) =>
                      READER_SECTION_LABELS[sectionId as ReaderSectionId] ??
                      sectionId
                    }
                  />
                ) : null}

                <div className="no-print flex items-center justify-between gap-4">
                  <Eyebrow>
                    Section {activeIndex + 1} of {READER_SECTION_IDS.length}
                  </Eyebrow>
                  <div className="flex items-center gap-3">
                    <SectionActions
                      onCopy={activeTyped ? copyActive : undefined}
                      onRerun={() => rerunSection(active)}
                      copied={copied}
                      copyError={copyError}
                      rerunPending={rerunPending === active}
                      disabled={!sectionActionsEnabled}
                    />
                  </div>
                </div>

                <SectionTitle className="mt-2">
                  {activeTyped
                    ? cleanTitle(activeTyped.sectionTitle)
                    : READER_SECTION_LABELS[active]}
                </SectionTitle>

                <div className="mt-6 space-y-7">
                  {activeStatus === 'complete' && activeTyped ? (
                    <>
                      <div className="no-print">
                        <CompletedActivitySummary
                          sourceCount={completedActivitySummary.sourceCount}
                          toolCount={completedActivitySummary.toolCount}
                          durationLabel={
                            completedActivitySummary.durationLabel ?? undefined
                          }
                        />
                      </div>
                      {active === PAID_MEDIA_PLAN_SECTION_ID ? (
                        <PaidMediaPlanTerminalPanel
                          artifact={activeTyped}
                          events={activeEvents}
                          statusText="Paid media plan committed."
                          subjectName={company}
                        />
                      ) : (
                        <ReaderSourcesProvider sources={activeReaderSources}>
                          <TypedArtifactErrorBoundary
                            key={active}
                            sectionId={active}
                          >
                            <TypedArtifactRenderer
                              artifact={activeTyped}
                              zoneId={active}
                              showSectionTitle={false}
                            />
                          </TypedArtifactErrorBoundary>
                        </ReaderSourcesProvider>
                      )}
                      {activeReview ? <ReviewMetadataPanel review={activeReview} /> : null}
                      {active !== PAID_MEDIA_PLAN_SECTION_ID ? (
                        <SourcesFooter sources={activeReaderSources} />
                      ) : null}
                    </>
                  ) : activeStatus === 'error' || activeStatus === 'aborted' ? (
                    <ErrorStateBlock
                      status={activeStatus}
                      onRerun={() => rerunSection(active)}
                      pending={rerunPending === active}
                    />
                  ) : activeStatus === 'running' ? (
                    activeDraftArtifact ? (
                      <DraftingArtifactView
                        artifact={activeDraftArtifact}
                        zoneId={active}
                        phaseLabel={activeWorker?.phaseLabel ?? 'Drafting section'}
                      />
                    ) : (
                      <RunningActivityView
                        phaseLabel={activeWorker?.phaseLabel ?? 'Working'}
                        latestActivity={activeWorker?.latestActivity ?? null}
                        events={activeEvents}
                      />
                    )
                  ) : active === PAID_MEDIA_PLAN_SECTION_ID ? (
                    <PaidMediaPlanTerminalPanel
                      artifact={activeTyped}
                      events={activeEvents}
                      statusText={
                        activeStatus === 'ready'
                          ? 'Ready to run.'
                          : 'Locked - unlocks after the six positioning sections complete.'
                      }
                      subjectName={company}
                    />
                  ) : (
                    <QueuedState />
                  )}
                </div>
              </>
            )}
          </article>
        </main>

        {/* Right gutter — compact status card (desktop only; mobile uses the
            in-article MobileSectionSwitcher). */}
        <aside className="hidden w-[360px] shrink-0 overflow-y-auto px-4 py-4 lg:block">
          <div className="sticky top-4 space-y-4">
            {!auditStateLoaded ? (
              <RunStatusLoadingCard />
            ) : (
              <RunStatusCard
                active={active}
                onSelect={select}
                statusOf={statusOf}
                needsReviewOf={needsReviewOf}
                needsReviewCount={needsReviewCount}
                positioningCompletedCount={positioningCompletedCount}
                activePhaseLabel={activePhaseLabel}
                elapsedMs={elapsedMs}
                runDispatched={runDispatched}
                allSectionsTerminal={allSectionsTerminal}
              />
            )}
            {auditStateLoaded ? (
              <AuditChatPanel
                runId={runId}
                focusedZone={active}
                onResearchMutated={refreshAuditState}
              />
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
