import { describe, expect, it, vi } from 'vitest';

import { POSITIONING_SECTION_IDS } from '@/lib/ai/prompts/positioning-skills';
import {
  OrchestrateClientError,
  OrchestrateRequestSchema,
  OrchestrateResponseSchema,
  postOrchestrate,
} from '../orchestrate-client';

const VALID_SESSION_ID = '00000000-0000-4000-8000-000000000001';
const VALID_RUN_ID = '00000000-0000-4000-8000-0000000000aa';

function fullResponse() {
  return {
    parent_audit_run_id: '11111111-1111-4111-8111-111111111111',
    section_run_ids: POSITIONING_SECTION_IDS.map((id, i) => ({
      section_id: id,
      section_run_id: `22222222-2222-4222-8222-${(i + 1).toString().padStart(12, '0')}`,
      ordinal: i + 1,
      reused: false,
    })),
  };
}

describe('orchestrate-client', () => {
  describe('OrchestrateRequestSchema', () => {
    it('accepts well-formed UUID input', () => {
      const parsed = OrchestrateRequestSchema.parse({
        journey_session_id: VALID_SESSION_ID,
        run_id: VALID_RUN_ID,
      });
      expect(parsed.journey_session_id).toBe(VALID_SESSION_ID);
      expect(parsed.run_id).toBe(VALID_RUN_ID);
    });

    it('rejects non-UUID values', () => {
      expect(() =>
        OrchestrateRequestSchema.parse({
          journey_session_id: 'not-a-uuid',
          run_id: VALID_RUN_ID,
        }),
      ).toThrow();
    });
  });

  describe('OrchestrateResponseSchema', () => {
    it('accepts a 6-section response', () => {
      const parsed = OrchestrateResponseSchema.parse(fullResponse());
      expect(parsed.section_run_ids).toHaveLength(6);
    });

    it('rejects a response with fewer than 6 sections', () => {
      const r = fullResponse();
      r.section_run_ids = r.section_run_ids.slice(0, 5);
      expect(() => OrchestrateResponseSchema.parse(r)).toThrow();
    });
  });

  describe('postOrchestrate', () => {
    it('parses a successful 200 response', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(fullResponse()), { status: 200 }),
      );
      const result = await postOrchestrate(
        { journey_session_id: VALID_SESSION_ID, run_id: VALID_RUN_ID },
        { fetchImpl },
      );
      expect(result.parent_audit_run_id).toBeDefined();
      expect(result.section_run_ids).toHaveLength(6);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('throws OrchestrateClientError on a 409', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'corpus_not_ready' }), {
          status: 409,
        }),
      );
      await expect(
        postOrchestrate(
          { journey_session_id: VALID_SESSION_ID, run_id: VALID_RUN_ID },
          { fetchImpl },
        ),
      ).rejects.toBeInstanceOf(OrchestrateClientError);
    });

    it('serializes the body as JSON with the expected keys', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(fullResponse()), { status: 200 }),
      );
      await postOrchestrate(
        { journey_session_id: VALID_SESSION_ID, run_id: VALID_RUN_ID },
        { fetchImpl },
      );
      const [, init] = fetchImpl.mock.calls[0];
      const body = JSON.parse((init as { body: string }).body);
      expect(body).toEqual({
        journey_session_id: VALID_SESSION_ID,
        run_id: VALID_RUN_ID,
      });
    });

    it('propagates AbortSignal to fetch', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(fullResponse()), { status: 200 }),
      );
      const controller = new AbortController();
      await postOrchestrate(
        { journey_session_id: VALID_SESSION_ID, run_id: VALID_RUN_ID },
        { fetchImpl, signal: controller.signal },
      );
      const [, init] = fetchImpl.mock.calls[0];
      expect((init as { signal?: AbortSignal }).signal).toBe(controller.signal);
    });
  });
});
