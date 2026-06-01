import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import {
  claimSectionRun,
  parseSectionRunClaimResult,
  type SectionRunClaimResult,
} from '../section-run-claim';

const RUN_ID = '00000000-0000-4000-8000-0000000000aa';
const USER_ID = 'user_1';
const SECTION_ID = 'positioningBuyerICP';
const SECTION_RUN_ID = '22222222-2222-4222-8222-000000000002';

function supabaseClient(
  rpc: ReturnType<typeof vi.fn>,
): SupabaseClient {
  return { rpc } as unknown as SupabaseClient;
}

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

describe('claimSectionRun', () => {
  it('calls the tenant-scoped claim_section_run RPC arguments', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          status: 'claimed',
          run_id: RUN_ID,
          section_id: SECTION_ID,
          section_run_id: SECTION_RUN_ID,
          previous_status: 'queued',
        },
      ],
      error: null,
    });

    const result = await claimSectionRun({
      supabase: supabaseClient(rpc),
      userId: USER_ID,
      runId: RUN_ID,
      sectionId: SECTION_ID,
    });

    expect(result.status).toBe('claimed');
    expect(rpc).toHaveBeenCalledWith('claim_section_run', {
      p_user_id: USER_ID,
      p_run_id: RUN_ID,
      p_section_id: SECTION_ID,
    });
  });

  it('includes tenant and section context when the RPC fails', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'schema cache miss' },
    });

    await expect(
      claimSectionRun({
        supabase: supabaseClient(rpc),
        userId: USER_ID,
        runId: RUN_ID,
        sectionId: SECTION_ID,
      }),
    ).rejects.toThrow(
      `claim_section_run RPC failed for userId=${USER_ID} runId=${RUN_ID} sectionId=${SECTION_ID}: schema cache miss`,
    );
  });
});
