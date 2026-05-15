import type { SectionCapabilityGap } from './section-context-pack';

export const SECTION_PHASES = [
  'Queued',
  'Compiling context',
  'Reading sources',
  'Drafting',
  'Validating',
  'Complete',
  'Needs review',
] as const;

export type SectionPhase = (typeof SECTION_PHASES)[number];

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
}
