import { describe, expect, it } from 'vitest';

import {
  JOURNEY_PREVIEW_PARAM,
  JOURNEY_STUDIO_PREVIEW_VALUE,
  isJourneyStudioPreview,
} from '@/lib/journey/journey-preview';

describe('isJourneyStudioPreview', () => {
  it('returns true when preview=studio', () => {
    const searchParams = new URLSearchParams({
      [JOURNEY_PREVIEW_PARAM]: JOURNEY_STUDIO_PREVIEW_VALUE,
    });

    expect(isJourneyStudioPreview(searchParams)).toBe(true);
  });

  it('returns false when preview is absent', () => {
    expect(isJourneyStudioPreview(new URLSearchParams())).toBe(false);
  });

  it('returns false when preview has another value', () => {
    const searchParams = new URLSearchParams({
      [JOURNEY_PREVIEW_PARAM]: 'default',
    });

    expect(isJourneyStudioPreview(searchParams)).toBe(false);
  });
});
