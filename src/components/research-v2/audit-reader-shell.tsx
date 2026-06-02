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

import { AlertTriangle, Check, Loader2 } from 'lucide-react';

import { Shimmer } from '@/components/ai-elements/shimmer';
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
  BodyProse,
  ErrorStateBlock,
  Eyebrow,
  hostname,
  LockedState,
  QueuedState,
  SectionActions,
  SectionTitle,
  StatusIcon,
  VerdictCallout,
  type ReaderSectionStatus,
} from '@/components/research-v2/ui-kit';
import {
  POSITIONING_SECTION_IDS,
  type AllPositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';
import { useAuditState } from '@/lib/research-v2/use-audit-state';
import { useSectionPartials } from '@/lib/research-v2/use-section-partials';
import type {
  AuditStateResponse,
  SectionEvent,
  WorkerStatus,
} from '@/app/api/research-v2/audit-state/route';
import {
  PAID_MEDIA_PLAN_SECTION_ID,
  POSITIONING_SYNTHESIS_SECTION_ID,
  READER_SECTION_IDS,
  READER_SECTION_LABELS,
  type ReaderSectionId,
} from '@/components/research-v3/reader-sections';
import {
  buildSectionActivityFeed,
  sectionFeedToSteps,
} from '@/lib/research-v2/section-activity';
import { getSectionSubSections } from '@/lib/lab-engine/sections/sub-sections';
import {
  pickPositioningTypedArtifact,
  isRecord,
  type PositioningTypedArtifact,
} from '@/types/positioning-artifact';
import { cn } from '@/lib/utils';

import {
  GenericTypedArtifactRenderer,
  TypedArtifactRenderer,
} from './typed-artifact-renderer';

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
  positioningSynthesis: 'Synthesis',
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

  if (artifact.verification !== undefined) {
    lines.push('## Verification');
    lines.push(`Verified: ${artifact.verification.verifiedCount}`);
    lines.push(`Unsupported: ${artifact.verification.unsupportedCount}`);
    lines.push('');
  }

  return `${lines.join('\n').trim()}\n`;
}

function VerificationBadge({
  verification,
}: {
  verification: PositioningTypedArtifact['verification'];
}): ReactElement | null {
  if (verification === undefined) {
    return null;
  }

  return (
    <span className="inline-flex items-center rounded-full border border-border bg-background px-2 py-1 text-[12px] font-medium text-muted-foreground">
      Verified {verification.verifiedCount} / Unsupported {verification.unsupportedCount}
    </span>
  );
}

function sectionStatusSubline(status: ReaderSectionStatus): string {
  if (status === 'complete') return 'Complete';
  if (status === 'error') return 'Needs review';
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
  sectionId: ReaderSectionId;
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
  // GenericTypedArtifactRenderer collapses every sub-section under one "Body" group.
  // Fall back to the raw snapshot for the legacy bare-body shape / pre-body partials.
  const body = snapshot.body;
  const bodyRecord =
    typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : snapshot;
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
}: {
  artifact: PositioningTypedArtifact;
  zoneId: ReaderSectionId;
}): ReactElement {
  return (
    <div className="mt-8 space-y-6">
      <div className="flex items-center gap-2.5 text-[13px] text-foreground">
        <Loader2
          className="size-4 animate-spin text-primary motion-reduce:animate-none"
          strokeWidth={2.5}
          aria-hidden="true"
        />
        <span className="font-medium">Drafting...</span>
      </div>
      <TypedArtifactErrorBoundary sectionId={zoneId}>
        <GenericTypedArtifactRenderer
          artifact={artifact}
          zoneId={zoneId}
          showSectionTitle={false}
        />
      </TypedArtifactErrorBoundary>
    </div>
  );
}

function isSixSectionComplete(live: AuditStateResponse): boolean {
  if (live.children_complete >= POSITIONING_SECTION_IDS.length) return true;
  return POSITIONING_SECTION_IDS.every((sectionId) => {
    const worker = live.workerStates.find((state) => state.section_id === sectionId);
    return (
      worker?.status === 'complete' || live.sectionsByZone[sectionId] !== undefined
    );
  });
}

function getCommittedPaidMediaSubSectionKeys(
  events: readonly SectionEvent[],
): ReadonlySet<string> {
  return new Set(
    events
      .filter((event) => event.event_type === 'sub-section-committed')
      .map((event) => {
        const metadata =
          event.payload?.metadata &&
          typeof event.payload.metadata === 'object' &&
          !Array.isArray(event.payload.metadata)
            ? (event.payload.metadata as Record<string, unknown>)
            : event.payload;
        return typeof metadata?.subSectionKey === 'string' &&
          metadata.status === 'committed'
          ? metadata.subSectionKey
          : null;
      })
      .filter((key): key is string => key !== null),
  );
}

function PaidMediaPlanSubSectionChecklist({
  committedAll,
  events,
}: {
  committedAll: boolean;
  events: readonly SectionEvent[];
}): ReactElement {
  const committedKeys = getCommittedPaidMediaSubSectionKeys(events);

  return (
    <div className="grid gap-2 border-l-2 border-border pl-4">
      {getSectionSubSections(PAID_MEDIA_PLAN_SECTION_ID).map((subSection) => {
        const committed = committedAll || committedKeys.has(subSection.key);
        return (
          <div
            key={subSection.key}
            className="flex items-center justify-between gap-3 text-[13px]"
          >
            <span className="min-w-0 truncate text-muted-foreground">
              {subSection.label}
            </span>
            <span
              data-testid={`sub-section-status-${PAID_MEDIA_PLAN_SECTION_ID}-${subSection.key}`}
              className="shrink-0 font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground"
            >
              {committed ? 'Committed' : 'Queued'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function PaidMediaPlanTerminalPanel({
  artifact,
  events,
  statusText,
}: {
  artifact: PositioningTypedArtifact | null;
  events: readonly SectionEvent[];
  statusText: string;
}): ReactElement {
  const readerSources = artifact ? toReaderSources(artifact.sources) : [];

  return (
    <div className="space-y-7">
      <PaidMediaPlanSubSectionChecklist
        committedAll={artifact !== null}
        events={events}
      />
      {artifact ? (
        <>
          {artifact.statusSummary ? (
            <BodyProse>{artifact.statusSummary}</BodyProse>
          ) : null}
          {artifact.verdict ? <VerdictCallout verdict={artifact.verdict} /> : null}
          <ReaderSourcesProvider sources={readerSources}>
            <TypedArtifactErrorBoundary sectionId={PAID_MEDIA_PLAN_SECTION_ID}>
              <TypedArtifactRenderer
                artifact={artifact}
                zoneId={PAID_MEDIA_PLAN_SECTION_ID}
                showSectionTitle={false}
              />
            </TypedArtifactErrorBoundary>
          </ReaderSourcesProvider>
          <SourcesFooter sources={readerSources} />
        </>
      ) : (
        <LockedState text={statusText} />
      )}
    </div>
  );
}

interface SectionProgressStripProps {
  active: ReaderSectionId;
  completedCount: number;
  onSelect: (id: ReaderSectionId) => void;
  statusOf: (id: ReaderSectionId) => ReaderSectionStatus;
}

function SectionRail({
  active,
  completedCount,
  onSelect,
  statusOf,
}: SectionProgressStripProps): ReactElement {
  return (
    <nav
      data-testid="section-progress-strip"
      className="flex w-[208px] shrink-0 flex-col gap-1 border-r border-border bg-card px-2 py-3"
      aria-label="Sections"
    >
      <div className="mb-2 px-2">
        <Eyebrow>
          {completedCount}/{READER_SECTION_IDS.length}
        </Eyebrow>
      </div>
      {READER_SECTION_IDS.map((id) => {
        const status = statusOf(id);
        const subLine = sectionStatusSubline(status);
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
                  isActive ? 'font-medium text-foreground' : 'text-foreground/80',
                )}
              >
                {SECTION_SHORT_LABEL[id]}
              </span>
              <span className="block text-[11px] text-muted-foreground">{subLine}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Run-status bar (W3) + mobile section switcher (W4)
// ---------------------------------------------------------------------------

function formatElapsedClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// Compact top-right run bar shown while the run is non-terminal. Reads like
// the "small top-right streaming bar," not a dashboard. Always shows a
// first-5s receipt so the initial state is never empty.
function RunStatusBar({
  completedCount,
  activePhaseLabel,
  verified,
  flagged,
  elapsedMs,
}: {
  completedCount: number;
  activePhaseLabel: string | null;
  verified: number;
  flagged: number;
  elapsedMs: number | null;
}): ReactElement {
  const phase = activePhaseLabel ?? 'researching live sources';

  return (
    <div
      data-testid="run-status-bar"
      className="hidden items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-1.5 sm:flex"
    >
      <span className="font-mono text-[12px] font-medium tabular-nums text-foreground">
        {completedCount}/{POSITIONING_SECTION_IDS.length}
      </span>
      <span className="h-3 w-px bg-border" aria-hidden="true" />
      <Shimmer className="max-w-[180px] truncate text-[12px]" duration={2.2}>
        {phase}
      </Shimmer>
      {verified > 0 || flagged > 0 ? (
        <>
          <span className="h-3 w-px bg-border" aria-hidden="true" />
          <span className="inline-flex items-center gap-1 font-mono text-[12px] tabular-nums text-emerald-600">
            <Check className="size-3" strokeWidth={3} /> {verified}
          </span>
          {flagged > 0 ? (
            <span className="inline-flex items-center gap-1 font-mono text-[12px] tabular-nums text-amber-600">
              <AlertTriangle className="size-3" strokeWidth={2.5} /> {flagged}
            </span>
          ) : null}
        </>
      ) : null}
      {elapsedMs !== null ? (
        <>
          <span className="h-3 w-px bg-border" aria-hidden="true" />
          <span className="font-mono text-[12px] font-medium tabular-nums text-foreground">
            {formatElapsedClock(elapsedMs)}
          </span>
        </>
      ) : null}
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
  const live = useAuditState(runId, pollRefreshKey);
  const sectionPartials = useSectionPartials(runId);

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
  }, [live.parent_audit_run_id, live.workerStates.length, runId]);

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

  const sixSectionsComplete = isSixSectionComplete(live);

  const statusOf = useCallback(
    (id: ReaderSectionId): ReaderSectionStatus => {
      const worker = workerById.get(id);
      if (worker?.status === 'running') return 'running';
      if (worker && TERMINAL_ERROR_STATUSES.has(worker.status)) return worker.status;
      if (worker?.status === 'queued') return 'queued';
      if (worker?.status === 'complete' || live.sectionsByZone[id]) {
        return 'complete';
      }
      // Both capstones unlock only after 6/6 positioning sections commit.
      if (
        id === PAID_MEDIA_PLAN_SECTION_ID ||
        id === POSITIONING_SYNTHESIS_SECTION_ID
      ) {
        return sixSectionsComplete ? 'ready' : 'locked';
      }
      return 'queued';
    },
    [live.sectionsByZone, sixSectionsComplete, workerById],
  );


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
  const activeStatus = statusOf(active);
  const activeWorker = workerById.get(active) ?? null;
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

  const completedCount = useMemo(
    () => READER_SECTION_IDS.filter((id) => statusOf(id) === 'complete').length,
    [statusOf],
  );

  // Positioning-only completed count for the run bar (its denominator excludes
  // the terminal paid-media section, so the numerator must too — avoids "7/6"
  // when paid-media commits while a positioning section is still non-terminal).
  const positioningCompletedCount = useMemo(
    () =>
      POSITIONING_SECTION_IDS.filter((id) => statusOf(id) === 'complete').length,
    [statusOf],
  );


  const allSectionsTerminal = useMemo(
    () =>
      READER_SECTION_IDS.every((id) =>
        TERMINAL_READER_STATUSES.has(statusOf(id)),
      ),
    [statusOf],
  );

  // ---- Run-status rollups (W3) -----------------------------------------
  // Verified / flagged claims summed across committed sections.
  const verificationRollup = useMemo(() => {
    let verified = 0;
    let flagged = 0;
    for (const id of READER_SECTION_IDS) {
      const v = typedByZone.get(id)?.verification;
      if (!v) continue;
      verified += v.verifiedCount;
      flagged += v.unsupportedCount;
    }
    return { verified, flagged };
  }, [typedByZone]);

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
    live.parent_audit_run_id !== null || live.workerStates.length > 0;

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
        // The capstones (paid-media plan + synthesis) read the committed
        // positioning artifacts and dispatch via run-lab-section. The
        // rerun-section endpoint only accepts the six POSITIONING_SECTION_IDS,
        // so routing a capstone there 400s.
        const isCapstoneSection =
          sectionId === PAID_MEDIA_PLAN_SECTION_ID ||
          sectionId === POSITIONING_SYNTHESIS_SECTION_ID;
        const res = await fetch(
          isCapstoneSection
            ? '/api/research-v2/run-lab-section'
            : '/api/research-v2/rerun-section',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(
              isCapstoneSection
                ? { run_id: runId, section_id: sectionId }
                : { runId, zone: sectionId, executionMode: 'lab' },
            ),
          },
        );
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

  // ---- Render -----------------------------------------------------------
  return (
    <div
      data-testid="audit-reader-shell"
      className="flex h-[calc(100vh-64px)] flex-col bg-background font-sans text-foreground"
    >
      {/* top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-5">
        <div className="flex items-center gap-2.5">
          <Eyebrow>Positioning Audit</Eyebrow>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-[13px] font-semibold tracking-tight text-foreground">
            {company}
          </span>
        </div>
        {!allSectionsTerminal && runDispatched ? (
          <RunStatusBar
            completedCount={positioningCompletedCount}
            activePhaseLabel={activePhaseLabel}
            verified={verificationRollup.verified}
            flagged={verificationRollup.flagged}
            elapsedMs={elapsedMs}
          />
        ) : null}
      </header>

      <div className="flex min-h-0 flex-1">
        <SectionRail
          active={active}
          completedCount={completedCount}
          onSelect={select}
          statusOf={statusOf}
        />

        <main ref={mainRef} className="flex-1 overflow-y-auto bg-card">
          <article className="mx-auto max-w-[760px] px-6 py-10 sm:px-10">
            <MobileSectionSwitcher
              active={active}
              onSelect={select}
              statusOf={statusOf}
            />

            <div className="flex items-center justify-between gap-4">
              <Eyebrow>
                Section {activeIndex + 1} of {READER_SECTION_IDS.length}
              </Eyebrow>
              <div className="flex items-center gap-3">
                {activeStatus === 'complete' && activeTyped ? (
                  <VerificationBadge verification={activeTyped.verification} />
                ) : null}
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
                  <CompletedActivitySummary
                    sourceCount={completedActivitySummary.sourceCount}
                    toolCount={completedActivitySummary.toolCount}
                    durationLabel={
                      completedActivitySummary.durationLabel ?? undefined
                    }
                  />
                  {activeTyped.statusSummary ? (
                    <BodyProse>{activeTyped.statusSummary}</BodyProse>
                  ) : null}
                  <VerdictCallout verdict={activeTyped.verdict} />
                  {active === PAID_MEDIA_PLAN_SECTION_ID ? (
                    <PaidMediaPlanTerminalPanel
                      artifact={activeTyped}
                      events={activeEvents}
                      statusText="Paid media plan committed."
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
                      ? 'Ready after 6/6 sections complete.'
                      : 'Locked - unlocks after 6/6 sections complete.'
                  }
                />
              ) : (
                <QueuedState />
              )}
            </div>
          </article>
        </main>
      </div>
    </div>
  );
}
