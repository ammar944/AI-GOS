import type { GtmRunStatus } from '@/lib/gtm/schemas/gtm-run';

export const TERMINAL_STATUSES = ['completed', 'failed'] as const satisfies readonly GtmRunStatus[];

const ALLOWED_TRANSITIONS: Record<GtmRunStatus, ReadonlyArray<GtmRunStatus>> = {
  draft: ['running', 'failed'],
  running: ['needs_review', 'completed', 'failed'],
  needs_review: ['running', 'failed'],
  completed: [],
  failed: [],
};

export function canTransition(from: GtmRunStatus, to: GtmRunStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
