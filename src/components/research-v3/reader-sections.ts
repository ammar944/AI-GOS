import {
  CROSS_SECTION_REASONING_SECTION_ID,
  isPositioningSectionId,
  PAID_MEDIA_PLAN_SECTION_ID,
  POSITIONING_SECTION_IDS,
  POSITIONING_SYNTHESIS_SECTION_ID,
  ALL_POSITIONING_SECTION_LABELS,
  type CrossSectionReasoningSectionId,
  type PositioningSectionId,
  type PaidMediaPlanSectionId,
  type PositioningSynthesisSectionId,
} from '@/lib/ai/prompts/positioning-skills';

export type ReaderSectionId =
  | PositioningSectionId
  | CrossSectionReasoningSectionId
  | PositioningSynthesisSectionId
  | PaidMediaPlanSectionId;

// Cross-section reasoning finds the post-six insight threads; synthesis turns
// them into the wedge; the paid-media plan operationalizes the wedge.
export const READER_SECTION_IDS = [
  ...POSITIONING_SECTION_IDS,
  CROSS_SECTION_REASONING_SECTION_ID,
  POSITIONING_SYNTHESIS_SECTION_ID,
  PAID_MEDIA_PLAN_SECTION_ID,
] as const satisfies readonly ReaderSectionId[];

export const FIRST_READER_SECTION_ID: ReaderSectionId = POSITIONING_SECTION_IDS[0];

export const READER_SECTION_LABELS: Record<ReaderSectionId, string> = {
  ...ALL_POSITIONING_SECTION_LABELS,
};

export function isReaderSectionId(value: unknown): value is ReaderSectionId {
  return (
    isPositioningSectionId(value) ||
    value === CROSS_SECTION_REASONING_SECTION_ID ||
    value === POSITIONING_SYNTHESIS_SECTION_ID ||
    value === PAID_MEDIA_PLAN_SECTION_ID
  );
}

export function getReaderSectionIndex(sectionId: ReaderSectionId): number {
  return READER_SECTION_IDS.indexOf(sectionId);
}

export function getReaderSectionFromParam(value: string | null): ReaderSectionId {
  return isReaderSectionId(value) ? value : FIRST_READER_SECTION_ID;
}

export {
  CROSS_SECTION_REASONING_SECTION_ID,
  PAID_MEDIA_PLAN_SECTION_ID,
  POSITIONING_SYNTHESIS_SECTION_ID,
};
