export const JOURNEY_PREVIEW_PARAM = 'preview';
export const JOURNEY_STUDIO_PREVIEW_VALUE = 'studio';

export interface JourneyPreviewSearchParamsLike {
  get(name: string): string | null;
}

export function isJourneyStudioPreview(
  searchParams: JourneyPreviewSearchParamsLike | null | undefined,
): boolean {
  return searchParams?.get(JOURNEY_PREVIEW_PARAM) === JOURNEY_STUDIO_PREVIEW_VALUE;
}
