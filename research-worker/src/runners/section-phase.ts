import type { SectionCapabilityGap } from './section-context-pack';
import type { PositioningExecutionMode } from './positioning-execution-mode';

export const SECTION_PHASES = [
  'Queued',
  'Compiling context',
  'Reading sources',
  'Drafting',
  'Validating',
  'Committed',
  'Needs review',
] as const;

export type SectionPhase = (typeof SECTION_PHASES)[number];

export interface SectionRuntimeTimings {
  sectionStartedAt?: string;
  firstPartialAt?: string;
  finalObjectAt?: string;
  validationCompleteAt?: string;
  timeoutFiredAt?: string;
  abortSignalObservedAt?: string;
  commitStartedAt?: string;
  commitCompleteAt?: string;
  terminalStatusWrittenAt?: string;
}

export interface SectionPhaseUpdate {
  phase: SectionPhase;
  phaseStartedAt?: string;
  latestTool?: string | null;
  latestSource?: string | null;
  latestActivity?: string | null;
  nextStep?: string | null;
  wave?: number | null;
  totalWaves?: number | null;
  concurrency?: number | null;
  elapsedMs?: number | null;
  capabilityGaps?: SectionCapabilityGap[];
  executionMode?: PositioningExecutionMode;
  runtimeTimings?: SectionRuntimeTimings;
}
