import { describe, expect, it } from 'vitest';

import {
  parseSectionRunClaimResult,
  type SectionRunClaimResult,
} from '../section-run-claim';

const RUN_ID = '00000000-0000-4000-8000-0000000000aa';
const SECTION_ID = 'positioningBuyerICP';
const SECTION_RUN_ID = '22222222-2222-4222-8222-000000000002';

describe('parseSectionRunClaimResult', () => {
  it('parses a claimed RPC row into the local claim result shape', () => {
    const result = parseSectionRunClaimResult([
      {
        status: 'claimed',
        run_id: RUN_ID,
        section_id: SECTION_ID,
        section_run_id: SECTION_RUN_ID,
        previous_status: 'queued',
      },
    ]);

    expect(result).toEqual<SectionRunClaimResult>({
      status: 'claimed',
      runId: RUN_ID,
      sectionId: SECTION_ID,
      sectionRunId: SECTION_RUN_ID,
      previousStatus: 'queued',
    });
  });

  it('rejects malformed RPC rows with a contextual parser error', () => {
    expect(() =>
      parseSectionRunClaimResult([
        {
          status: 'duplicate',
          run_id: RUN_ID,
          section_id: SECTION_ID,
          section_run_id: SECTION_RUN_ID,
          previous_status: 'queued',
        },
      ]),
    ).toThrow(/claim_section_run/i);
  });
});
