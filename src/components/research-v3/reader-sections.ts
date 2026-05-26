import {
  isPositioningSectionId,
  POSITIONING_SECTION_IDS,
  POSITIONING_SECTION_LABELS,
  type PositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';

export const PAID_MEDIA_PLAN_SECTION_ID = 'positioningPaidMediaPlan' as const;

export type PaidMediaPlanSectionId = typeof PAID_MEDIA_PLAN_SECTION_ID;
export type ReaderSectionId = PositioningSectionId | PaidMediaPlanSectionId;

export const READER_SECTION_IDS = [
  ...POSITIONING_SECTION_IDS,
  PAID_MEDIA_PLAN_SECTION_ID,
] as const satisfies readonly ReaderSectionId[];

export const FIRST_READER_SECTION_ID: ReaderSectionId = POSITIONING_SECTION_IDS[0];

export const READER_SECTION_LABELS: Record<ReaderSectionId, string> = {
  ...POSITIONING_SECTION_LABELS,
  [PAID_MEDIA_PLAN_SECTION_ID]: 'Paid Media Plan',
};

export function isReaderSectionId(value: unknown): value is ReaderSectionId {
  return (
    isPositioningSectionId(value) || value === PAID_MEDIA_PLAN_SECTION_ID
  );
}

export function getReaderSectionIndex(sectionId: ReaderSectionId): number {
  return READER_SECTION_IDS.indexOf(sectionId);
}

export function getReaderSectionFromParam(value: string | null): ReaderSectionId {
  return isReaderSectionId(value) ? value : FIRST_READER_SECTION_ID;
}
