import type { SectionEvent } from '@/app/api/research-v2/audit-state/route';
import type { ActivityStep } from '@/components/research-v2/activity-rail';

export type SectionActivityTone =
  | 'active'
  | 'neutral'
  | 'success'
  | 'warning'
  | 'error';

export type SectionActivityKind =
  | 'artifact'
  | 'output'
  | 'repair'
  | 'section'
  | 'skill'
  | 'tool'
  | 'validation';

export type ProductPhase =
  | 'preparing'
  | 'searching'
  | 'drafting'
  | 'checking'
  | 'refining'
  | 'committing'
  | 'done';

export interface SectionActivityItem {
  id: string;
  eventType: string;
  phase: ProductPhase;
  title: string;
  detail: string | null;
  chip: string | null;
  createdAt: string;
  kind: SectionActivityKind;
  tone: SectionActivityTone;
}

export interface CollapsedSectionActivityItem extends SectionActivityItem {
  count: number;
  chips: string[];
}

export interface SectionActivityCounts {
  toolsStarted: number;
  toolsFinished: number;
  subSectionsCommitted: number;
  validationFailures: number;
  repairsStarted: number;
}

export interface SectionActivityFeed {
  currentLabel: string;
  items: CollapsedSectionActivityItem[];
  counts: SectionActivityCounts;
}

export interface BuildSectionActivityFeedInput {
  events: SectionEvent[];
  phaseLabel: string;
  latestActivity: string | null;
  maxItems?: number;
}

const DEFAULT_MAX_ITEMS = 8;

// Any field that looks like raw structured-output payload (Zod issue arrays,
// schema paths, JSON blobs) is rejected before it can reach a customer-facing
// field. Mirrors the JSON_HINT guard from the proven prototype.
const JSON_HINT = /[{}\[\]]|"code"|body\./;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function readRecordField(
  record: Record<string, unknown> | null,
  key: string,
): Record<string, unknown> | null {
  if (!record) return null;
  const value = record[key];
  return isRecord(value) ? value : null;
}

function readStringField(
  record: Record<string, unknown> | null,
  key: string,
): string | null {
  if (!record) return null;
  return readString(record[key]);
}

function eventPayload(event: SectionEvent): Record<string, unknown> | null {
  return isRecord(event.payload) ? event.payload : null;
}

function eventMetadata(event: SectionEvent): Record<string, unknown> | null {
  return readRecordField(eventPayload(event), 'metadata');
}

function eventMessage(event: SectionEvent): string | null {
  return (
    readString(event.message) ?? readStringField(eventPayload(event), 'message')
  );
}

function subSectionKey(event: SectionEvent): string | null {
  return readStringField(eventMetadata(event), 'subSectionKey');
}

// Allowlist: only these event types are ever shown in the customer feed. Each
// maps to a product phase that drives icon + grouping. Anything not listed is
// dropped (see buildActivityItem returning null).
const EVENT_PHASE: Record<string, ProductPhase> = {
  'section-started': 'preparing',
  'skill-loaded': 'preparing',
  'reading-sources-started': 'searching',
  'tool-started': 'searching',
  'tool-finished': 'searching',
  'structured-output-started': 'drafting',
  'validation-failed': 'checking',
  'repair-started': 'refining',
  'sub-section-committed': 'committing',
  'artifact-saved': 'committing',
  'section-completed': 'done',
  'section-failed': 'done',
};

export function phaseForEvent(eventType: string): ProductPhase | null {
  return EVENT_PHASE[eventType] ?? null;
}

// Translate an internal repair/validation reason into a calm, customer-safe
// line. Only the two reason shapes the engine emits that are genuinely
// customer-meaningful (grounding coverage, source coverage) are surfaced;
// everything else collapses to a generic phrase. The engine also emits short,
// non-JSON jargon reasons ("No answer-tool step within 90000ms on attempt 2",
// "Agent did not call answer tool within maxSteps") that would slip past a
// length/JSON guard, so there is NO verbatim passthrough — any unmatched reason
// returns the calm fallback. Originally ported from phase-narration.ts; the
// verbatim branch was dropped to close the jargon leak.
export function translateReason(reason: unknown): string | undefined {
  if (typeof reason !== 'string' || !reason.trim()) return undefined;
  const grounding = reason.match(/grounding (\d+) unsupported claim/i);
  if (grounding) {
    return `Strengthening ${grounding[1]} claim${
      grounding[1] === '1' ? '' : 's'
    } with sources`;
  }
  const sources = reason.match(/sources:\s*have (\d+),\s*need >?=?\s*(\d+)/i);
  if (sources) return `Gathering more sources (${sources[1]} of ${sources[2]})`;
  return 'Refining section structure';
}

// A web_search query is safe to show as a chip (Perplexity-style). Drop
// anything suspiciously long or JSON-shaped. Ported from phase-narration.ts.
export function searchChip(event: SectionEvent): string | null {
  const query = eventMetadata(event)?.query;
  if (
    typeof query === 'string' &&
    query.trim().length > 0 &&
    query.length <= 96 &&
    !JSON_HINT.test(query)
  ) {
    return query.trim();
  }
  return null;
}

// Humanize a camelCase subSectionKey ("personaReality" -> "Persona reality")
// as a last-resort detail when no clean message is present.
function humanizeSubSectionKey(key: string | null): string | null {
  if (!key) return null;
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  if (!spaced) return null;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// A clean engine `message` is safe to show, but never if it carries a JSON hint
// (defense-in-depth: an upstream message should never embed a Zod blob).
function safeMessage(event: SectionEvent): string | null {
  const message = eventMessage(event);
  if (!message) return null;
  if (JSON_HINT.test(message)) return null;
  return message;
}

// Map a raw lab event to a customer-safe activity item, or null to drop it from
// the feed. NO raw payload (outputSummary, raw Zod issues, raw repair reason,
// schemaName, raw error) ever reaches title / detail / chip.
function buildActivityItem(event: SectionEvent): SectionActivityItem | null {
  const phase = EVENT_PHASE[event.event_type];
  if (!phase) return null;

  const base = {
    id: event.id,
    eventType: event.event_type,
    phase,
    createdAt: event.created_at,
    chip: null as string | null,
  };

  switch (event.event_type) {
    case 'section-started':
      return {
        ...base,
        title: 'Preparing context',
        detail: null,
        kind: 'section',
        tone: 'neutral',
      };
    case 'skill-loaded':
      return {
        ...base,
        title: 'Preparing context',
        detail: null,
        kind: 'skill',
        tone: 'neutral',
      };
    case 'reading-sources-started':
      return {
        ...base,
        title: 'Searching source evidence',
        detail: null,
        kind: 'tool',
        tone: 'active',
      };
    case 'tool-started':
      return {
        ...base,
        title: 'Searching source evidence',
        detail: null,
        kind: 'tool',
        tone: 'active',
      };
    case 'tool-finished':
      return {
        ...base,
        title: 'Searching source evidence',
        detail: null,
        chip: searchChip(event),
        kind: 'tool',
        tone: 'active',
      };
    case 'structured-output-started':
      return {
        ...base,
        title: 'Drafting section',
        detail: null,
        kind: 'output',
        tone: 'active',
      };
    case 'validation-failed':
      return {
        ...base,
        title: 'Checking source support',
        detail: 'Verifying claims against sources',
        kind: 'validation',
        tone: 'active',
      };
    case 'repair-started':
      return {
        ...base,
        title: 'Strengthening claims with sources',
        detail: translateReason(eventMetadata(event)?.reason) ?? null,
        kind: 'repair',
        tone: 'warning',
      };
    case 'sub-section-committed':
      return {
        ...base,
        title: 'Sub-section ready',
        detail: safeMessage(event) ?? humanizeSubSectionKey(subSectionKey(event)),
        kind: 'artifact',
        tone: 'success',
      };
    case 'artifact-saved':
      return {
        ...base,
        title: 'Section verified & committed',
        detail: null,
        kind: 'artifact',
        tone: 'success',
      };
    case 'section-completed':
      return {
        ...base,
        title: 'Section verified & committed',
        detail: durationDetail(event),
        kind: 'section',
        tone: 'success',
      };
    case 'section-failed':
      return {
        ...base,
        title: 'Section needs review',
        detail: 'This section needs another pass',
        kind: 'section',
        tone: 'error',
      };
    default:
      return null;
  }
}

// Optional duration on section-completed ("1m 7s"). Derived purely from a
// numeric durationMs — no raw payload text.
function durationDetail(event: SectionEvent): string | null {
  const durationMs = eventMetadata(event)?.durationMs;
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs)) {
    return null;
  }
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

// Collapse consecutive same-phase items into one row with a count and
// accumulated query chips. Keeps the FIRST item's identity/title; folds detail
// and chips forward. Ported from collapseNarration (single-section: no zone).
function collapseActivity(
  items: SectionActivityItem[],
): CollapsedSectionActivityItem[] {
  const out: CollapsedSectionActivityItem[] = [];
  for (const item of items) {
    const last = out.at(-1);
    if (last && last.phase === item.phase) {
      last.count += 1;
      last.createdAt = item.createdAt;
      if (item.chip) last.chips.push(item.chip);
      if (item.detail) last.detail = item.detail;
      continue;
    }
    out.push({
      ...item,
      count: 1,
      chips: item.chip ? [item.chip] : [],
    });
  }
  return out;
}

function emptyCounts(): SectionActivityCounts {
  return {
    toolsStarted: 0,
    toolsFinished: 0,
    subSectionsCommitted: 0,
    validationFailures: 0,
    repairsStarted: 0,
  };
}

function countEvents(events: SectionEvent[]): SectionActivityCounts {
  return events.reduce<SectionActivityCounts>((counts, event) => {
    if (event.event_type === 'tool-started') {
      return { ...counts, toolsStarted: counts.toolsStarted + 1 };
    }
    if (event.event_type === 'tool-finished') {
      return { ...counts, toolsFinished: counts.toolsFinished + 1 };
    }
    if (event.event_type === 'sub-section-committed') {
      return {
        ...counts,
        subSectionsCommitted: counts.subSectionsCommitted + 1,
      };
    }
    if (event.event_type === 'validation-failed') {
      return { ...counts, validationFailures: counts.validationFailures + 1 };
    }
    if (event.event_type === 'repair-started') {
      return { ...counts, repairsStarted: counts.repairsStarted + 1 };
    }
    return counts;
  }, emptyCounts());
}

function currentLabelFor(input: {
  latestActivity: string | null;
  phaseLabel: string;
  items: CollapsedSectionActivityItem[];
}): string {
  const latestActivity = readString(input.latestActivity);
  if (latestActivity) return latestActivity;

  const lastItem = input.items.at(-1);
  if (lastItem) return lastItem.title;

  return input.phaseLabel;
}

export function sectionFeedToSteps(feed: SectionActivityFeed): ActivityStep[] {
  const visible = feed.items.filter((item) => item.phase !== 'done');

  return visible.map((item, index) => {
    const isLast = index === visible.length - 1;
    const status: ActivityStep['status'] =
      isLast && item.tone === 'active' ? 'active' : 'complete';

    return {
      phase: item.phase as ActivityStep['phase'],
      label: item.title,
      detail: item.detail,
      status,
      tone: item.tone,
      chips: item.chips.length > 0 ? item.chips : undefined,
    };
  });
}

export function buildSectionActivityFeed(
  input: BuildSectionActivityFeedInput,
): SectionActivityFeed {
  const maxItems = input.maxItems ?? DEFAULT_MAX_ITEMS;

  const safeItems = input.events
    .map(buildActivityItem)
    .filter((item): item is SectionActivityItem => item !== null);

  const collapsed = collapseActivity(safeItems);
  const items = maxItems > 0 ? collapsed.slice(-maxItems) : [];

  return {
    currentLabel: currentLabelFor({
      latestActivity: input.latestActivity,
      phaseLabel: input.phaseLabel,
      items,
    }),
    items,
    counts: countEvents(input.events),
  };
}
