import type { AuditSectionPhase, WorkerStatus } from './route';
import type { ActivityEventType } from '@/lib/lab-engine/events/activity-event';

export interface DeriveSectionPhaseInput {
  status: WorkerStatus | 'needs-review' | null | undefined;
  latestEventType: string | null | undefined;
}

const PHASE_BY_EVENT_TYPE: Partial<Record<ActivityEventType, AuditSectionPhase>> = {
  'section-started': 'Compiling context',
  'skill-loaded': 'Compiling context',
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
  if (!input.latestEventType) return 'Queued';
  return PHASE_BY_EVENT_TYPE[input.latestEventType as ActivityEventType] ?? 'Queued';
}
