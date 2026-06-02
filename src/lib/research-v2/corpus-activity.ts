import type {
  ActivityPhase,
  ActivityStep,
} from '@/components/research-v2/activity-rail';
import { phaseLabel } from '@/components/research-v2/activity-rail';
import type {
  CollapsedResearchJobUpdate,
  ResearchJobUpdate,
} from '@/lib/journey/research-job-activity-core';

const JSON_HINT = /[{}\[\]]|"code"|body\./;

const JARGON_HINT = /\b(repair|unsupported|validation)\b/i;

const CORPUS_PHASE_MAP: Record<ResearchJobUpdate['phase'], ActivityPhase> = {
  runner: 'preparing',
  tool: 'searching',
  analysis: 'checking',
  thinking: 'drafting',
  artifact: 'committing',
  output: 'committing',
  error: 'checking',
  // heartbeat updates are filtered out before mapping (see mapCorpusUpdatesToSteps);
  // mapped here only so the Record is total and indexing is type-safe.
  heartbeat: 'preparing',
};

const DEFAULT_LABEL: Record<ActivityPhase, string> = {
  preparing: 'Preparing context',
  searching: 'Searching source evidence',
  drafting: 'Drafting section',
  checking: 'Checking source support',
  refining: 'Refining section structure',
  committing: 'Committing results',
};

function isCleanMessage(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed || trimmed.length > 120) return false;
  if (JSON_HINT.test(trimmed)) return false;
  if (JARGON_HINT.test(trimmed)) return false;
  return true;
}

function messageChip(message: string): string | null {
  const trimmed = message.trim();
  if (
    trimmed.length > 0 &&
    trimmed.length <= 96 &&
    !JSON_HINT.test(trimmed) &&
    !JARGON_HINT.test(trimmed)
  ) {
    return trimmed;
  }
  return null;
}

function labelForUpdate(update: CollapsedResearchJobUpdate): string {
  if (update.phase === 'error') {
    return isCleanMessage(update.message)
      ? update.message.trim()
      : 'Research needs review';
  }
  if (isCleanMessage(update.message)) {
    return update.message.trim();
  }
  return DEFAULT_LABEL[CORPUS_PHASE_MAP[update.phase]];
}

function stepForUpdate(
  update: CollapsedResearchJobUpdate,
  status: ActivityStep['status'],
): ActivityStep {
  const phase = CORPUS_PHASE_MAP[update.phase];
  const tone =
    update.phase === 'error'
      ? 'error'
      : status === 'active'
        ? 'active'
        : 'neutral';

  const chips =
    update.phase === 'tool' ? [messageChip(update.message)].filter(Boolean) : [];

  return {
    phase,
    label: labelForUpdate(update),
    detail: null,
    status,
    tone,
    chips: chips.length > 0 ? (chips as string[]) : undefined,
  };
}

export function mapCorpusUpdatesToSteps(
  updates: CollapsedResearchJobUpdate[],
): { steps: ActivityStep[]; currentLabel: string } {
  const visible = updates.filter((update) => update.phase !== 'heartbeat');

  if (visible.length === 0) {
    return {
      steps: [],
      currentLabel: 'Researching live sources…',
    };
  }

  const steps = visible.map((update, index) =>
    stepForUpdate(
      update,
      index === visible.length - 1 ? 'active' : 'complete',
    ),
  );

  const activeStep = steps.at(-1);
  const currentLabel = activeStep
    ? activeStep.label
    : `${phaseLabel('searching')}…`;

  return { steps, currentLabel };
}
