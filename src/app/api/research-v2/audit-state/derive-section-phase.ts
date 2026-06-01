import type { AuditSectionPhase, WorkerStatus } from './route';
import type { ActivityEventType } from '@/lib/lab-engine/events/activity-event';

export interface DeriveSectionPhaseInput {
  status: WorkerStatus | 'needs-review' | null | undefined;
  latestEventType: string | null | undefined;
}

const PHASE_BY_EVENT_TYPE: Partial<Record<ActivityEventType, AuditSectionPhase>> = {
  'section-started': 'Compiling context',
  'skill-loaded': 'Compiling context',
  'reading-sources-started': 'Reading sources',
  'tool-started': 'Reading sources',
  'tool-finished': 'Reading sources',
  'structured-output-started': 'Drafting',
  'validation-failed': 'Validating',
  'repair-started': 'Validating',
  'artifact-saved': 'Draft ready',
  'sub-section-committed': 'Committed',
  'section-completed': 'Committed',
  'section-failed': 'Needs review',
} satisfies Partial<Record<ActivityEventType, AuditSectionPhase>>;

function terminalPhaseForStatus(
  status: DeriveSectionPhaseInput['status'],
): AuditSectionPhase | null {
  if (status === 'complete') return 'Committed';
  if (status === 'error' || status === 'aborted' || status === 'needs-review') {
    return 'Needs review';
  }
  if (status === 'queued') return 'Queued';
  return null;
}

export function deriveSectionPhase(
  input: DeriveSectionPhaseInput,
): AuditSectionPhase {
  const terminalPhase = terminalPhaseForStatus(input.status);
  if (terminalPhase) return terminalPhase;
  // A genuinely 'queued' worker already returned 'Queued' above. Past this point
  // the worker is in-flight ('running'), so a section that has not emitted its
  // first event yet is starting up — not idle in a queue. Labelling it 'Queued'
  // made an actively-running section read as waiting (2026-06-01 live audit).
  // Only a section with no worker status at all is still queued.
  if (!input.latestEventType) {
    return input.status ? 'Compiling context' : 'Queued';
  }
  return (
    PHASE_BY_EVENT_TYPE[input.latestEventType as ActivityEventType] ??
    'Compiling context'
  );
}
