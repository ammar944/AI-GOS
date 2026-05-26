import type { SectionEvent } from '@/app/api/research-v2/audit-state/route';

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

export interface SectionActivityItem {
  id: string;
  eventType: string;
  title: string;
  detail: string | null;
  createdAt: string;
  kind: SectionActivityKind;
  tone: SectionActivityTone;
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
  items: SectionActivityItem[];
  counts: SectionActivityCounts;
}

export interface BuildSectionActivityFeedInput {
  events: SectionEvent[];
  phaseLabel: string;
  latestActivity: string | null;
  maxItems?: number;
}

const DEFAULT_MAX_ITEMS = 8;

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

function readNumberField(
  record: Record<string, unknown> | null,
  key: string,
): number | null {
  if (!record) return null;
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
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

function toolName(event: SectionEvent): string | null {
  return readStringField(eventMetadata(event), 'toolName');
}

function skillSlug(event: SectionEvent): string | null {
  return readStringField(eventMetadata(event), 'skillSlug');
}

function subSectionKey(event: SectionEvent): string | null {
  return readStringField(eventMetadata(event), 'subSectionKey');
}

function schemaName(event: SectionEvent): string | null {
  return readStringField(eventMetadata(event), 'schemaName');
}

function attemptLabel(event: SectionEvent): string | null {
  const attempt = readNumberField(eventMetadata(event), 'attempt');
  return attempt === null ? null : `attempt ${attempt}`;
}

function outputSummary(event: SectionEvent): string | null {
  return readStringField(eventMetadata(event), 'outputSummary');
}

function gapMessage(event: SectionEvent): string | null {
  const gap = readRecordField(eventMetadata(event), 'gap');
  const reason = readStringField(gap, 'reason');
  const message = readStringField(gap, 'message');
  return [reason, message].filter(Boolean).join(': ') || null;
}

function validationIssueSummary(event: SectionEvent): string | null {
  const issues = eventMetadata(event)?.issues;
  if (!Array.isArray(issues)) return null;

  const readableIssues = issues
    .map((issue) => readString(issue))
    .filter((issue): issue is string => Boolean(issue));
  if (readableIssues.length === 0) return null;
  if (readableIssues.length === 1) return readableIssues[0];
  return `${readableIssues[0]} (+${readableIssues.length - 1} more)`;
}

function durationDetail(event: SectionEvent): string | null {
  const durationMs = readNumberField(eventMetadata(event), 'durationMs');
  if (durationMs === null) return null;
  const seconds = Math.round(durationMs / 100) / 10;
  return `${seconds}s`;
}

function artifactId(event: SectionEvent): string | null {
  return readStringField(eventMetadata(event), 'artifactId');
}

function buildActivityItem(event: SectionEvent): SectionActivityItem {
  const message = eventMessage(event);

  switch (event.event_type) {
    case 'section-started':
      return {
        id: event.id,
        eventType: event.event_type,
        title: 'Section started',
        detail: message,
        createdAt: event.created_at,
        kind: 'section',
        tone: 'active',
      };
    case 'skill-loaded':
      return {
        id: event.id,
        eventType: event.event_type,
        title: 'Skill loaded',
        detail: skillSlug(event) ?? message,
        createdAt: event.created_at,
        kind: 'skill',
        tone: 'neutral',
      };
    case 'tool-started': {
      const name = toolName(event);
      return {
        id: event.id,
        eventType: event.event_type,
        title: name ? `Using ${name}` : 'Tool started',
        detail: message,
        createdAt: event.created_at,
        kind: 'tool',
        tone: 'active',
      };
    }
    case 'tool-finished': {
      const name = toolName(event);
      const gap = gapMessage(event);
      return {
        id: event.id,
        eventType: event.event_type,
        title: name ? `${name} finished` : 'Tool finished',
        detail: outputSummary(event) ?? gap ?? message,
        createdAt: event.created_at,
        kind: 'tool',
        tone: gap ? 'warning' : 'success',
      };
    }
    case 'structured-output-started':
      return {
        id: event.id,
        eventType: event.event_type,
        title: 'Structuring Artifact',
        detail:
          [schemaName(event), attemptLabel(event)].filter(Boolean).join(' - ') ||
          message,
        createdAt: event.created_at,
        kind: 'output',
        tone: 'active',
      };
    case 'validation-failed':
      return {
        id: event.id,
        eventType: event.event_type,
        title: 'Validation failed',
        detail: validationIssueSummary(event) ?? message,
        createdAt: event.created_at,
        kind: 'validation',
        tone: 'warning',
      };
    case 'repair-started':
      return {
        id: event.id,
        eventType: event.event_type,
        title: 'Repairing Artifact',
        detail: readStringField(eventMetadata(event), 'reason') ?? message,
        createdAt: event.created_at,
        kind: 'repair',
        tone: 'warning',
      };
    case 'sub-section-committed':
      return {
        id: event.id,
        eventType: event.event_type,
        title: 'Sub-section committed',
        detail: subSectionKey(event) ?? message,
        createdAt: event.created_at,
        kind: 'artifact',
        tone: 'success',
      };
    case 'artifact-saved':
      return {
        id: event.id,
        eventType: event.event_type,
        title: 'Artifact saved',
        detail: artifactId(event) ?? message,
        createdAt: event.created_at,
        kind: 'artifact',
        tone: 'success',
      };
    case 'section-completed':
      return {
        id: event.id,
        eventType: event.event_type,
        title: 'Section completed',
        detail: durationDetail(event) ?? message,
        createdAt: event.created_at,
        kind: 'section',
        tone: 'success',
      };
    case 'section-failed':
      return {
        id: event.id,
        eventType: event.event_type,
        title: 'Section failed',
        detail: readStringField(eventMetadata(event), 'error') ?? message,
        createdAt: event.created_at,
        kind: 'section',
        tone: 'error',
      };
    default:
      return {
        id: event.id,
        eventType: event.event_type,
        title: message ?? event.event_type,
        detail: message === null ? null : event.event_type,
        createdAt: event.created_at,
        kind: 'section',
        tone: 'neutral',
      };
  }
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
  items: SectionActivityItem[];
}): string {
  const latestActivity = readString(input.latestActivity);
  if (latestActivity) return latestActivity;

  const lastItem = input.items.at(-1);
  if (lastItem) return lastItem.title;

  return input.phaseLabel;
}

export function buildSectionActivityFeed(
  input: BuildSectionActivityFeedInput,
): SectionActivityFeed {
  const maxItems = input.maxItems ?? DEFAULT_MAX_ITEMS;
  const orderedItems = input.events.map(buildActivityItem);
  const items = maxItems > 0 ? orderedItems.slice(-maxItems) : [];

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
