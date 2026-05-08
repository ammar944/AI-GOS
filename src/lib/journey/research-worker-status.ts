import type { ResearchJobActivity } from '@/lib/journey/research-job-activity';
import type { ResearchSectionResult } from '@/lib/journey/research-realtime';
import {
  classifyJourneyDispatchFailure,
  type JourneyDispatchFailureKind,
} from '@/lib/journey/research-recovery';
import { SECTION_META } from '@/lib/journey/section-meta';

export type JourneyWorkerStatusKind =
  | 'queued'
  | 'running'
  | 'dispatch-timeout'
  | 'worker-unavailable'
  | 'dispatch-failed';

export type JourneyWorkerStatusTone = 'info' | 'warning' | 'error';

export interface JourneyWorkerStatusItem {
  detail: string;
  kind: JourneyWorkerStatusKind;
  section: string;
  title: string;
  tone: JourneyWorkerStatusTone;
}

interface BuildJourneyWorkerStatusItemsArgs {
  activeResearch: Iterable<string>;
  researchJobActivity: Record<string, ResearchJobActivity>;
  researchResults: Record<string, ResearchSectionResult | null>;
  timedOutSections: Iterable<string>;
}

function getSectionLabel(section: string): string {
  return SECTION_META[section]?.label ?? section;
}

function createFailureItem(
  section: string,
  failureKind: JourneyDispatchFailureKind,
  errorMessage: string | undefined,
): JourneyWorkerStatusItem | null {
  const label = getSectionLabel(section);
  const errorDetail = errorMessage?.trim() || 'No research detail was returned.';

  if (failureKind === 'worker-unavailable') {
    return {
      section,
      kind: 'worker-unavailable',
      tone: 'error',
      title: `${label}: Research unavailable`,
      detail:
        `${errorDetail} Start the research service on :3001 or verify ` +
        '`RAILWAY_WORKER_URL` before retrying this step.',
    };
  }

  if (failureKind === 'dispatch-timeout') {
    return {
      section,
      kind: 'dispatch-timeout',
      tone: 'warning',
      title: `${label}: Chat timed out`,
      detail:
        `${label} exceeded the chat request window before the worker returned ` +
        'a durable result. Journey will keep watching for a late write.',
    };
  }

  if (failureKind === 'dispatch-failed') {
    return {
      section,
      kind: 'dispatch-failed',
      tone: 'error',
      title: `${label}: Dispatch failed`,
      detail:
        `${errorDetail} The request did not reach a stable research run. Retry the ` +
        'section after checking the research logs.',
    };
  }

  return null;
}

function createActiveItem(
  section: string,
  activity: ResearchJobActivity | undefined,
  timedOut: boolean,
): JourneyWorkerStatusItem {
  const label = getSectionLabel(section);

  if (timedOut) {
    const isRunning = activity?.status === 'running' || Boolean(activity?.startedAt);
    return {
      section,
      kind: 'dispatch-timeout',
      tone: 'warning',
      title: `${label}: Chat timed out`,
      detail: isRunning
        ? `${label} hit the Journey timeout, but research is still running in the background. Results will appear when the write completes.`
        : `${label} has not started yet. Check that the research service is reachable on :3001 or via \`RAILWAY_WORKER_URL\`.`,
    };
  }

  if (activity?.status === 'running' || activity?.startedAt) {
    return {
      section,
      kind: 'running',
      tone: 'info',
      title: `${label}: Research running`,
      detail:
        `${label} is running now. Journey will update ` +
        'the artifact as soon as the result is written.',
    };
  }

  return {
    section,
    kind: 'queued',
    tone: 'info',
    title: `${label}: Research queued`,
    detail:
      `${label} has been dispatched and is waiting to start. If this ` +
      'state lingers, check that the research service is listening on :3001.',
  };
}

const ITEM_ORDER: Record<JourneyWorkerStatusKind, number> = {
  'worker-unavailable': 0,
  'dispatch-failed': 1,
  'dispatch-timeout': 2,
  'running': 3,
  'queued': 4,
};

export function buildJourneyWorkerStatusItems({
  activeResearch,
  researchJobActivity,
  researchResults,
  timedOutSections,
}: BuildJourneyWorkerStatusItemsArgs): JourneyWorkerStatusItem[] {
  const items: JourneyWorkerStatusItem[] = [];
  const seenSections = new Set<string>();
  const timedOutSectionSet = new Set<string>(timedOutSections);

  for (const [section, result] of Object.entries(researchResults)) {
    if (seenSections.has(section) || result?.status !== 'error') {
      continue;
    }

    const failureItem = createFailureItem(
      section,
      classifyJourneyDispatchFailure(result.error),
      result.error,
    );
    if (!failureItem) {
      continue;
    }

    items.push(failureItem);
    seenSections.add(section);
  }

  for (const section of activeResearch) {
    if (seenSections.has(section)) {
      continue;
    }

    items.push(
      createActiveItem(
        section,
        researchJobActivity[section],
        timedOutSectionSet.has(section),
      ),
    );
    seenSections.add(section);
  }

  return items.sort((left, right) => {
    const kindDelta = ITEM_ORDER[left.kind] - ITEM_ORDER[right.kind];
    if (kindDelta !== 0) {
      return kindDelta;
    }

    return left.title.localeCompare(right.title);
  });
}
