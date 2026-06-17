import {
  isPositioningSectionId,
  PAID_MEDIA_PLAN_SECTION_ID,
  ALL_POSITIONING_SECTION_LABELS,
  type PositioningSectionId,
  type PaidMediaPlanSectionId,
} from '@/lib/ai/prompts/positioning-skills';

export type ReaderSectionId =
  | PositioningSectionId
  | PaidMediaPlanSectionId;

export const READER_SECTION_IDS = [
  'positioningMarketCategory',
  'positioningBuyerICP',
  'positioningCompetitorLandscape',
  'positioningVoiceOfCustomer',
  'positioningDemandIntent',
  'positioningOfferDiagnostic',
  PAID_MEDIA_PLAN_SECTION_ID,
] as const satisfies readonly ReaderSectionId[];

export const FIRST_READER_SECTION_ID: ReaderSectionId = READER_SECTION_IDS[0];

export const READER_SECTION_LABELS: Record<ReaderSectionId, string> = {
  ...ALL_POSITIONING_SECTION_LABELS,
};

export function isReaderSectionId(value: unknown): value is ReaderSectionId {
  return (
    isPositioningSectionId(value) ||
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
  PAID_MEDIA_PLAN_SECTION_ID,
};
