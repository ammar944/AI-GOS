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
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from 'react';

import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  CircleDot,
  Copy,
  FileText,
  LockKeyhole,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  X,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  POSITIONING_SECTION_IDS,
  type AllPositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';
import { useAuditState } from '@/lib/research-v2/use-audit-state';
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
import {
  formatConfidenceToTen,
  getConfidenceToneClass,
  normalizeConfidenceToTen,
} from '@/lib/research-v2/confidence-display';
import {
  buildSectionActivityFeed,
  type CollapsedSectionActivityItem,
  type ProductPhase,
  type SectionActivityTone,
} from '@/lib/research-v2/section-activity';
import { getSectionSubSections } from '@/lib/lab-engine/sections/sub-sections';
import {
  pickPositioningTypedArtifact,
  isRecord,
  type PositioningArtifactSource,
  type PositioningTypedArtifact,
} from '@/types/positioning-artifact';
import { cn } from '@/lib/utils';

import { TypedArtifactRenderer } from './typed-artifact-renderer';

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

type ReaderSectionStatus = WorkerStatus | 'locked' | 'ready';
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
    `Confidence: ${formatConfidenceToTen(artifact.confidence)}/10`,
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

// ---------------------------------------------------------------------------
// Status indicator + confidence badge
// ---------------------------------------------------------------------------

function SectionStatusIcon({
  status,
  confidence,
}: {
  status: ReaderSectionStatus;
  confidence: number | null;
}): ReactElement {
  if (status === 'running') {
    return (
      <span className="mt-px flex size-[18px] shrink-0 items-center justify-center text-primary">
        <Loader2 className="size-[15px] animate-spin" strokeWidth={2.5} />
      </span>
    );
  }
  if (status === 'error' || status === 'aborted') {
    return (
      <span className="mt-px flex size-[18px] shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        {status === 'error' ? (
          <AlertTriangle className="size-3" strokeWidth={2.75} />
        ) : (
          <X className="size-3" strokeWidth={3} />
        )}
      </span>
    );
  }
  if (status === 'complete') {
    return (
      <span
        className={cn(
          'mt-px flex size-[18px] shrink-0 items-center justify-center rounded-full border',
          getConfidenceToneClass(confidence ?? 0),
        )}
      >
        <Check className="size-3" strokeWidth={3} />
      </span>
    );
  }
  if (status === 'ready') {
    return (
      <span className="mt-px flex size-[18px] shrink-0 items-center justify-center rounded-full border border-primary text-primary">
        <ArrowUpRight className="size-3" strokeWidth={2.5} />
      </span>
    );
  }
  if (status === 'locked') {
    return (
      <span className="mt-px flex size-[18px] shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground">
        <LockKeyhole className="size-3" strokeWidth={2.5} />
      </span>
    );
  }
  // queued — empty ring
  return (
    <span className="mt-px flex size-[18px] shrink-0 items-center justify-center rounded-full border border-border" />
  );
}

function ConfidenceBadge({ score }: { score: number }): ReactElement {
  const formatted = formatConfidenceToTen(score);
  return (
    <span
      aria-label={`Confidence ${formatted}/10`}
      className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground"
    >
      <span
        className={cn('size-1.5 rounded-full border', getConfidenceToneClass(score))}
      />
      <span className="font-medium tabular-nums text-foreground">
        {formatted}
      </span>
      <span>confidence</span>
    </span>
  );
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

// ---------------------------------------------------------------------------
// Verdict + sources (shell-owned)
// ---------------------------------------------------------------------------

function VerdictCard({ verdict }: { verdict: string }): ReactElement {
  return (
    <div className="rounded-xl border border-border bg-muted/50 p-5 sm:p-6">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Verdict
      </div>
      <p className="text-[16px] leading-[1.65] text-foreground">{verdict}</p>
    </div>
  );
}

function SourcesList({
  sources,
}: {
  sources: PositioningArtifactSource[];
}): ReactElement | null {
  if (!sources?.length) return null;
  return (
    <details className="group mt-10 border-t border-border pt-5">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-[12px] font-medium uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground">
        <ArrowUpRight className="size-3.5 transition-transform group-open:rotate-90" />
        {sources.length} sources
      </summary>
      <ol className="mt-4 grid gap-x-10 gap-y-3 sm:grid-cols-2">
        {sources.map((s, i) => (
          <li key={`${s.url}-${i}`} className="flex gap-2.5 text-[13px] leading-[1.5]">
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="min-w-0">
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline-offset-2 transition-colors hover:underline"
              >
                {s.title}
              </a>
              {s.whyItMatters ? (
                <span className="mt-0.5 block text-[12px] leading-[1.5] text-muted-foreground">
                  {s.whyItMatters}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Reading-column states: running (skeleton + live feed), queued, error
// ---------------------------------------------------------------------------

// Phase → lucide icon (customer-safe narration). Mirrors the proven
// prototype phase vocabulary.
const PHASE_ICON: Record<ProductPhase, LucideIcon> = {
  preparing: CircleDot,
  searching: Search,
  drafting: FileText,
  checking: ShieldCheck,
  refining: Sparkles,
  committing: CheckCircle2,
  done: CheckCircle2,
};

// tone → icon/text token. active/success read as primary; warning gets a
// restrained amber; error is destructive.
const ACTIVITY_TONE_ICON_CLASS: Record<SectionActivityTone, string> = {
  active: 'text-primary',
  success: 'text-primary',
  neutral: 'text-muted-foreground',
  warning: 'text-amber-500 dark:text-amber-400',
  error: 'text-destructive',
};

function ActivityCountPill({
  label,
  value,
}: {
  label: string;
  value: number;
}): ReactElement | null {
  if (value === 0) return null;

  return (
    <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      {value} {label}
    </span>
  );
}

function SearchQueryChips({ chips }: { chips: string[] }): ReactElement | null {
  if (chips.length === 0) return null;
  const shown = chips.slice(0, 8);
  const overflow = chips.length - shown.length;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {shown.map((chip, i) => (
        <span
          key={`${chip}-${i}`}
          title={chip}
          className="inline-flex max-w-[260px] items-center gap-1.5 truncate rounded-md border border-border bg-muted px-2 py-1 text-[11.5px] text-muted-foreground"
        >
          <Search className="size-3 shrink-0 text-muted-foreground/70" strokeWidth={2} />
          <span className="truncate">{chip}</span>
        </span>
      ))}
      {overflow > 0 ? (
        <span className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-1 text-[11px] tabular-nums text-muted-foreground/70">
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}

function ActivityFeedItem({
  item,
  live,
}: {
  item: CollapsedSectionActivityItem;
  live: boolean;
}): ReactElement {
  const Icon = PHASE_ICON[item.phase] ?? CircleDot;

  return (
    <li className="relative pb-3 pl-7 last:pb-0">
      <span
        className="absolute left-[1px] top-0.5 flex size-4 items-center justify-center"
        aria-hidden="true"
      >
        <Icon
          className={cn(
            'size-[14px]',
            ACTIVITY_TONE_ICON_CLASS[item.tone],
            live && 'animate-pulse motion-reduce:animate-none',
          )}
          strokeWidth={2.25}
        />
      </span>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span
          className={cn(
            'text-[13px] leading-[1.4]',
            live ? 'font-medium text-foreground' : 'text-foreground',
          )}
        >
          {item.title}
        </span>
        {item.count > 1 ? (
          <span className="text-[11px] tabular-nums text-muted-foreground/70">
            ×{item.count}
          </span>
        ) : null}
      </div>
      {item.detail ? (
        <div
          className={cn(
            'mt-0.5 text-[12.5px] leading-[1.45]',
            item.tone === 'warning'
              ? 'text-amber-500 dark:text-amber-400'
              : 'text-muted-foreground',
          )}
        >
          {item.detail}
        </div>
      ) : null}
      <SearchQueryChips chips={item.chips} />
    </li>
  );
}

function LiveActivity({
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

  const lastItemId = activity.items.at(-1)?.id ?? null;

  return (
    <div className="mt-8 space-y-6">
      <div className="flex items-center gap-2.5 text-[13.5px] text-foreground">
        <Loader2
          className="size-4 animate-spin text-primary motion-reduce:animate-none"
          strokeWidth={2.5}
        />
        <span className="font-medium">{activity.currentLabel}</span>
      </div>

      {activity.items.length > 0 ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            <ActivityCountPill
              label="tools"
              value={activity.counts.toolsFinished}
            />
            <ActivityCountPill
              label="sub-sections"
              value={activity.counts.subSectionsCommitted}
            />
            <ActivityCountPill
              label="repairs"
              value={activity.counts.repairsStarted}
            />
          </div>
          {/* internal scroll — a long run must not grow the page (variant-D) */}
          <ol className="max-h-[340px] overflow-y-auto pr-1">
            {activity.items.map((item) => (
              <ActivityFeedItem
                key={item.id}
                item={item}
                live={item.id === lastItemId}
              />
            ))}
          </ol>
        </div>
      ) : null}

      {/* skeleton — gives the column body while the section drafts */}
      <div className="space-y-3 pt-2" aria-hidden="true">
        {[92, 78, 85, 64].map((w, i) => (
          <div
            key={i}
            className="h-3 animate-pulse rounded bg-muted motion-reduce:animate-none"
            style={{ width: `${w}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function QueuedPlaceholder(): ReactElement {
  return (
    <div className="mt-10 rounded-xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
      <p className="text-[13px] text-muted-foreground">
        Queued — this section will begin once a worker is free.
      </p>
    </div>
  );
}

function ErrorState({
  status,
  onRerun,
  pending,
}: {
  status: WorkerStatus;
  onRerun: () => void;
  pending: boolean;
}): ReactElement {
  return (
    <div className="mt-10 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-8">
      <div className="mb-2 flex items-center gap-2 text-[13.5px] font-medium text-destructive">
        <AlertTriangle className="size-4" />
        {status === 'aborted' ? 'Section aborted' : 'Section needs review'}
      </div>
      <p className="mb-4 text-[13px] leading-[1.55] text-muted-foreground">
        This section didn&rsquo;t finish. You can rerun it without restarting the
        rest of the audit.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onRerun}
        disabled={pending}
        className="h-8 gap-1.5 px-2.5 text-[12.5px]"
      >
        <RefreshCw className={cn('size-3.5', pending && 'animate-spin')} />
        {pending ? 'Rerunning…' : 'Rerun section'}
      </Button>
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
    <div className="grid gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3">
      {getSectionSubSections(PAID_MEDIA_PLAN_SECTION_ID).map((subSection) => {
        const committed = committedAll || committedKeys.has(subSection.key);
        return (
          <div
            key={subSection.key}
            className="flex items-center justify-between gap-3 text-xs"
          >
            <span className="min-w-0 truncate text-muted-foreground">
              {subSection.label}
            </span>
            <span
              data-testid={`sub-section-status-${PAID_MEDIA_PLAN_SECTION_ID}-${subSection.key}`}
              className="shrink-0 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground"
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
  return (
    <div className="space-y-5">
      <PaidMediaPlanSubSectionChecklist
        committedAll={artifact !== null}
        events={events}
      />
      <div className="rounded-xl border border-border bg-muted/30 px-5 py-5">
        <div className="flex items-center gap-3">
          <LockKeyhole
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {READER_SECTION_LABELS[PAID_MEDIA_PLAN_SECTION_ID]}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {artifact?.statusSummary ?? statusText}
            </p>
          </div>
        </div>
        {artifact ? (
          <div className="mt-6">
            <TypedArtifactRenderer
              artifact={artifact}
              zoneId={PAID_MEDIA_PLAN_SECTION_ID}
              showSectionTitle={false}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface SectionProgressStripProps {
  active: ReaderSectionId;
  avgConfidence: number | null;
  completedCount: number;
  confidenceOf: (id: ReaderSectionId) => number | null;
  onSelect: (id: ReaderSectionId) => void;
  statusOf: (id: ReaderSectionId) => ReaderSectionStatus;
}

function SectionProgressStrip({
  active,
  avgConfidence,
  completedCount,
  confidenceOf,
  onSelect,
  statusOf,
}: SectionProgressStripProps): ReactElement {
  return (
    <aside
      data-testid="section-progress-strip"
      className="w-14 shrink-0 border-r border-border bg-background"
    >
      <div className="sticky top-0 flex h-full min-h-0 flex-col items-center gap-3 py-3">
        <div
          className="text-[10px] font-medium tabular-nums text-muted-foreground"
          title={`${completedCount} of ${READER_SECTION_IDS.length} sections complete`}
        >
          {completedCount}/{READER_SECTION_IDS.length}
        </div>
        <nav aria-label="Sections" className="flex flex-col gap-1.5">
          {READER_SECTION_IDS.map((id) => {
            const status = statusOf(id);
            const confidence = confidenceOf(id);
            const subLine =
              status === 'complete' && confidence !== null
                ? `${formatConfidenceToTen(confidence)} confidence`
                : status === 'error'
                  ? 'Needs review'
                  : status === 'aborted'
                    ? 'Aborted'
                    : status === 'ready'
                      ? 'Ready after 6/6'
                      : status === 'locked'
                        ? 'Locked until 6/6'
                        : status;
            const label = `${SECTION_SHORT_LABEL[id]}: ${subLine}`;

            return (
              <button
                key={id}
                type="button"
                aria-label={label}
                title={label}
                onClick={() => onSelect(id)}
                className={cn(
                  'flex size-9 items-center justify-center rounded-md transition-colors',
                  id === active ? 'bg-secondary' : 'hover:bg-secondary/50',
                )}
              >
                <SectionStatusIcon status={status} confidence={confidence} />
              </button>
            );
          })}
        </nav>
        <div className="mt-auto pb-1 text-center text-[10px] leading-tight text-muted-foreground">
          <div className="tabular-nums">
            {completedCount}/{READER_SECTION_IDS.length}
          </div>
          {avgConfidence !== null ? (
            <div className="mt-1 tabular-nums">
              {formatConfidenceToTen(avgConfidence)}
            </div>
          ) : null}
        </div>
      </div>
    </aside>
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

// DESIGN label idiom: 11px mono uppercase 0.06em tracking.
function RunStat({
  label,
  children,
  tone,
}: {
  label: string;
  children: ReactElement | string;
  tone?: 'default' | 'warning';
}): ReactElement {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      {label ? (
        <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground/70">
          {label}
        </span>
      ) : null}
      <span
        className={cn(
          'font-mono text-[12px] font-medium tabular-nums',
          tone === 'warning'
            ? 'text-amber-500 dark:text-amber-400'
            : 'text-foreground',
        )}
      >
        {children}
      </span>
    </span>
  );
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
  return (
    <div
      data-testid="run-status-bar"
      className="hidden items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-1.5 sm:flex"
    >
      <Loader2
        className="size-3.5 animate-spin text-primary motion-reduce:animate-none"
        strokeWidth={2.5}
        aria-hidden="true"
      />
      <RunStat label="Sections">
        {`${completedCount}/${READER_SECTION_IDS.length - 1}`}
      </RunStat>
      <span className="h-3 w-px bg-border" aria-hidden="true" />
      <span className="max-w-[180px] truncate text-[12px] text-muted-foreground">
        {activePhaseLabel ?? 'researching live sources'}
      </span>
      {verified > 0 || flagged > 0 ? (
        <>
          <span className="h-3 w-px bg-border" aria-hidden="true" />
          <span className="inline-flex items-center gap-2">
            <RunStat label="">
              <span className="inline-flex items-center gap-1 text-primary">
                <Check className="size-3" strokeWidth={3} />
                {String(verified)}
              </span>
            </RunStat>
            <RunStat label="" tone={flagged > 0 ? 'warning' : 'default'}>
              <span className="inline-flex items-center gap-1">
                <AlertTriangle className="size-3" strokeWidth={2.5} />
                {String(flagged)}
              </span>
            </RunStat>
          </span>
        </>
      ) : null}
      {elapsedMs !== null ? (
        <>
          <span className="h-3 w-px bg-border" aria-hidden="true" />
          <RunStat label="">{formatElapsedClock(elapsedMs)}</RunStat>
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
      if (id === PAID_MEDIA_PLAN_SECTION_ID) {
        return sixSectionsComplete ? 'ready' : 'locked';
      }
      return 'queued';
    },
    [live.sectionsByZone, sixSectionsComplete, workerById],
  );

  const confidenceOf = useCallback(
    (id: ReaderSectionId): number | null => {
      const typed = typedByZone.get(id);
      return typed && typeof typed.confidence === 'number'
        ? typed.confidence
        : null;
    },
    [typedByZone],
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

  const avgConfidence = useMemo(() => {
    const scores = READER_SECTION_IDS.map(confidenceOf).filter(
      (n): n is number => n !== null,
    );
    if (scores.length === 0) return null;
    return scores.reduce((sum, score) => sum + normalizeConfidenceToTen(score), 0) / scores.length;
  }, [confidenceOf]);

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

  const company = meta.companyName || hostnameOf(meta.websiteUrl) || 'Audit';

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
        const isPaidMediaPlan = sectionId === PAID_MEDIA_PLAN_SECTION_ID;
        const res = await fetch(
          isPaidMediaPlan
            ? '/api/research-v2/run-lab-section'
            : '/api/research-v2/rerun-section',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(
              isPaidMediaPlan
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
          <span className="text-[13px] font-medium text-muted-foreground">
            Positioning Audit
          </span>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-[13px] font-semibold tracking-tight text-foreground">
            {company}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {!allSectionsTerminal && runDispatched ? (
            <RunStatusBar
              completedCount={positioningCompletedCount}
              activePhaseLabel={activePhaseLabel}
              verified={verificationRollup.verified}
              flagged={verificationRollup.flagged}
              elapsedMs={elapsedMs}
            />
          ) : null}
          <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={copyActive}
            disabled={!activeTyped}
            className="h-8 gap-1.5 px-2.5 text-[12.5px] text-muted-foreground hover:text-foreground"
            title="Copy section"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copyError ? 'Copy failed' : copied ? 'Copied' : 'Copy'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => rerunSection(active)}
            disabled={rerunPending !== null || !TERMINAL_READER_STATUSES.has(activeStatus)}
            className="h-8 gap-1.5 px-2.5 text-[12.5px] text-muted-foreground hover:text-foreground"
            title={
              TERMINAL_READER_STATUSES.has(activeStatus)
                ? 'Re-run this section'
                : 'Rerun available once this section finishes'
            }
          >
            <RefreshCw
              className={cn('size-3.5', rerunPending === active && 'animate-spin')}
            />
            Rerun
          </Button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {!allSectionsTerminal ? (
          <SectionProgressStrip
            active={active}
            avgConfidence={avgConfidence}
            completedCount={completedCount}
            confidenceOf={confidenceOf}
            onSelect={select}
            statusOf={statusOf}
          />
        ) : null}

        {/* reading column */}
        <main ref={mainRef} className="flex-1 overflow-y-auto bg-card">
          <article
            className={cn(
              'mx-auto px-6 py-12 sm:px-10',
              allSectionsTerminal ? 'max-w-[1080px]' : 'max-w-[820px]',
            )}
          >
            <MobileSectionSwitcher
              active={active}
              onSelect={select}
              statusOf={statusOf}
            />

            <div className="flex items-center justify-between gap-4">
              <span className="text-[12px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Section {activeIndex + 1} of {READER_SECTION_IDS.length}
              </span>
              {activeStatus === 'complete' && activeTyped ? (
                <span className="flex items-center gap-2">
                  <VerificationBadge verification={activeTyped.verification} />
                  <ConfidenceBadge score={activeTyped.confidence} />
                </span>
              ) : null}
            </div>

            <h1 className="mt-3 text-[27px] font-semibold leading-tight tracking-tight text-foreground sm:text-[31px]">
              {activeTyped
                ? cleanTitle(activeTyped.sectionTitle)
                : READER_SECTION_LABELS[active]}
            </h1>

            {activeStatus === 'complete' && activeTyped ? (
              <>
                {activeTyped.statusSummary ? (
                  <p className="mt-3 max-w-[68ch] text-[15px] leading-[1.6] text-muted-foreground">
                    {activeTyped.statusSummary}
                  </p>
                ) : null}

                <div className="mt-6">
                  <VerdictCard verdict={activeTyped.verdict} />
                </div>

                <div className="mt-12">
                  {active === PAID_MEDIA_PLAN_SECTION_ID ? (
                    <PaidMediaPlanTerminalPanel
                      artifact={activeTyped}
                      events={live.eventsByZone[PAID_MEDIA_PLAN_SECTION_ID] ?? []}
                      statusText="Paid media plan committed."
                    />
                  ) : (
                    <TypedArtifactRenderer
                      artifact={activeTyped}
                      zoneId={active}
                      showSectionTitle={false}
                    />
                  )}
                </div>

                <SourcesList sources={activeTyped.sources} />
              </>
            ) : activeStatus === 'error' || activeStatus === 'aborted' ? (
              <ErrorState
                status={activeStatus}
                onRerun={() => rerunSection(active)}
                pending={rerunPending === active}
              />
            ) : activeStatus === 'running' ? (
              <LiveActivity
                phaseLabel={activeWorker?.phaseLabel ?? 'Working'}
                latestActivity={activeWorker?.latestActivity ?? null}
                events={live.eventsByZone[active] ?? []}
              />
            ) : active === PAID_MEDIA_PLAN_SECTION_ID ? (
              <PaidMediaPlanTerminalPanel
                artifact={activeTyped}
                events={live.eventsByZone[PAID_MEDIA_PLAN_SECTION_ID] ?? []}
                statusText={
                  activeStatus === 'ready'
                    ? 'Ready after 6/6 sections complete.'
                    : 'Locked - unlocks after 6/6 sections complete.'
                }
              />
            ) : (
              <QueuedPlaceholder />
            )}
          </article>
        </main>
      </div>
    </div>
  );
}
