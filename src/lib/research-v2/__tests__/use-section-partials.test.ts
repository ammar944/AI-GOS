import { describe, expect, it } from 'vitest';

import {
  applySectionPartialPayload,
  type SectionPartialsByZone,
} from '../use-section-partials';

describe('useSectionPartials state reducer', (): void => {
  it('keeps the latest partial per zone and drops stale sequence frames', (): void => {
    let state: SectionPartialsByZone = {};

    state = applySectionPartialPayload(state, {
      zone: 'positioningMarketCategory',
      sectionId: 'positioningMarketCategory',
      seq: 2,
      snapshot: { marketSize: { prose: 'newer' } },
    });
    state = applySectionPartialPayload(state, {
      zone: 'positioningMarketCategory',
      sectionId: 'positioningMarketCategory',
      seq: 1,
      snapshot: { marketSize: { prose: 'stale' } },
    });
    state = applySectionPartialPayload(state, {
      zone: 'positioningBuyerICP',
      sectionId: 'positioningBuyerICP',
      seq: 1,
      snapshot: { personaReality: { prose: 'buyer draft' } },
    });

    expect(state.positioningMarketCategory).toEqual({
      sectionId: 'positioningMarketCategory',
      seq: 2,
      snapshot: { marketSize: { prose: 'newer' } },
      zone: 'positioningMarketCategory',
    });
    expect(state.positioningBuyerICP).toEqual({
      sectionId: 'positioningBuyerICP',
      seq: 1,
      snapshot: { personaReality: { prose: 'buyer draft' } },
      zone: 'positioningBuyerICP',
    });
  });
});
