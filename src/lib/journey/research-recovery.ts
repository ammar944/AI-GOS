import type { ResearchJobActivity } from '@/lib/journey/research-job-activity';

export type JourneyDispatchFailureKind =
  | 'worker-unavailable'
  | 'dispatch-failed'
  | 'dispatch-timeout'
  | 'unknown';

export function isJourneyOrchestrationTimeout(
  errorMessage: string | undefined,
): boolean {
  if (!errorMessage) {
    return false;
  }

  const normalized = errorMessage.toLowerCase();
  return (
    normalized.includes('request timed out') ||
    normalized.includes('session context is too full')
  );
}

export function shouldIgnoreDispatchError(args: {
  errorMessage: string | undefined;
  active: boolean;
  activity?: Pick<ResearchJobActivity, 'status'> | undefined;
}): boolean {
  if (!isJourneyOrchestrationTimeout(args.errorMessage)) {
    return false;
  }

  return (
    args.active ||
    args.activity?.status === 'running' ||
    args.activity?.status === 'complete'
  );
}

export function classifyJourneyDispatchFailure(
  errorMessage: string | undefined,
): JourneyDispatchFailureKind {
  if (isJourneyOrchestrationTimeout(errorMessage)) {
    return 'dispatch-timeout';
  }

  if (!errorMessage) {
    return 'unknown';
  }

  const normalized = errorMessage.toLowerCase();
  if (
    normalized.includes('research worker not reachable') ||
    normalized.includes('railway_worker_url') ||
    normalized.includes('fetch failed') ||
    normalized.includes('econnrefused') ||
    normalized.includes('failed to reach worker') ||
    normalized.includes('network')
  ) {
    return 'worker-unavailable';
  }

  if (
    normalized.startsWith('worker error:') ||
    normalized.includes('worker rejected') ||
    normalized.includes('unauthorized')
  ) {
    return 'dispatch-failed';
  }

  return 'unknown';
}
