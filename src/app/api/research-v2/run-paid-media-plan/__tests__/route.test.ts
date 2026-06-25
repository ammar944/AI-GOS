import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PAID_MEDIA_PLAN_SECTION_ID } from '@/lib/ai/prompts/positioning-skills';
import { saaslaunchResearchInput } from '@/lib/lab-engine/fixtures/saaslaunch';
import { PAID_MEDIA_PLAN_JOB_TIMEOUT_MS } from '@/lib/research-v2/lab-section-dispatch';

const routeMocks = vi.hoisted(() => {
  const scheduleLabSectionJob = vi.fn();
  const createAdminClient = vi.fn(() => ({}));
  // `after()` callbacks captured rather than executed (the composer job is
  // scheduled via scheduleLabSectionJob's mocked `schedule`, never run here).
  const afterCallbacks: Array<() => unknown> = [];
  const after = vi.fn((cb: () => unknown) => {
    afterCallbacks.push(cb);
  });
  return { scheduleLabSectionJob, createAdminClient, after, afterCallbacks };
});

vi.mock('next/server', async () => {
  const actual =
    await vi.importActual<typeof import('next/server')>('next/server');
  return {
    ...actual,
    after: (cb: () => unknown) => routeMocks.after(cb),
  };
});

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => routeMocks.createAdminClient(),
}));

vi.mock('@/lib/research-v2/lab-section-dispatch', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/research-v2/lab-section-dispatch')
  >('@/lib/research-v2/lab-section-dispatch');
  return {
    ...actual,
    scheduleLabSectionJob: (input: unknown) =>
      routeMocks.scheduleLabSectionJob(input),
  };
});

const { POST, maxDuration, runtime } = await import('../route');

const INTERNAL_KEY = 'test-internal-key';
const RUN_ID = '00000000-0000-4000-8000-0000000000aa';

function makeRequest(headers: Record<string, string>, body: unknown): Request {
  return new Request(
    'https://app.example.com/api/research-v2/run-paid-media-plan',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    },
  );
}

function validBody(): unknown {
  return {
    user_id: 'user_1',
    run_id: RUN_ID,
    research_input: saaslaunchResearchInput,
  };
}

describe('POST /api/research-v2/run-paid-media-plan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMocks.afterCallbacks.length = 0;
    process.env.RAILWAY_API_KEY = INTERNAL_KEY;
    routeMocks.scheduleLabSectionJob.mockResolvedValue(undefined);
  });

  it('pins the dedicated composer route runtime budget', (): void => {
    expect(runtime).toBe('nodejs');
    expect(maxDuration).toBe(800);
  });

  it('schedules the paid-media composer with the dedicated 760s deadline and ACKs 202', async () => {
    const response = await POST(
      makeRequest({ 'x-internal-key': INTERNAL_KEY }, validBody()),
    );

    expect(response.status).toBe(202);
    expect(routeMocks.scheduleLabSectionJob).toHaveBeenCalledTimes(1);
    expect(routeMocks.scheduleLabSectionJob).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: RUN_ID,
        sectionId: PAID_MEDIA_PLAN_SECTION_ID,
        // The whole reason this route exists: the composer runs on a dedicated
        // 760s deadline, isolated from the six-section fan-out.
        jobTimeoutMs: PAID_MEDIA_PLAN_JOB_TIMEOUT_MS,
      }),
    );
  });

  it('rejects a request whose x-internal-key does not match', async () => {
    const response = await POST(
      makeRequest({ 'x-internal-key': 'wrong-key' }, validBody()),
    );

    expect(response.status).toBe(401);
    expect(routeMocks.scheduleLabSectionJob).not.toHaveBeenCalled();
  });

  it('returns 503 when the internal key is not configured', async () => {
    delete process.env.RAILWAY_API_KEY;

    const response = await POST(
      makeRequest({ 'x-internal-key': INTERNAL_KEY }, validBody()),
    );

    expect(response.status).toBe(503);
    expect(routeMocks.scheduleLabSectionJob).not.toHaveBeenCalled();
  });

  it('rejects a malformed body with 400 before scheduling', async () => {
    const response = await POST(
      makeRequest({ 'x-internal-key': INTERNAL_KEY }, { run_id: 'not-a-uuid' }),
    );

    expect(response.status).toBe(400);
    expect(routeMocks.scheduleLabSectionJob).not.toHaveBeenCalled();
  });
});
