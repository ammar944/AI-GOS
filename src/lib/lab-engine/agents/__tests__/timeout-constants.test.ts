import { describe, expect, it } from 'vitest';

import { LAB_SECTION_JOB_TIMEOUT_MS } from '@/lib/research-v2/lab-section-dispatch';

import { answerToolTimeoutMs } from '../run-section';

// The route's Vercel maxDuration (src/app/api/research-v2/run-lab-section/route.ts
// :36 and orchestrate/route.ts:34) is the platform hard cap. We mirror it as a
// literal here (rather than importing the route, which pulls in Clerk/Supabase
// server modules) so this stays a pure unit test. If the route changes its cap,
// this constant must change in lockstep.
const ROUTE_MAX_DURATION_MS = 300 * 1000;

describe('lab section timeout hierarchy', (): void => {
  it('orders answer-tool < job timeout < route maxDuration', (): void => {
    // Inner answer-tool backstop trips first.
    expect(answerToolTimeoutMs).toBeLessThan(LAB_SECTION_JOB_TIMEOUT_MS);
    // Job timeout (the controlled section-failed emitter) trips before the cap.
    expect(LAB_SECTION_JOB_TIMEOUT_MS).toBeLessThan(ROUTE_MAX_DURATION_MS);
  });

  it('pins the Cluster A / Cluster B agreed values (255s < 270s < 300s)', (): void => {
    expect(answerToolTimeoutMs).toBe(255_000);
    expect(LAB_SECTION_JOB_TIMEOUT_MS).toBe(270_000);
    expect(ROUTE_MAX_DURATION_MS).toBe(300_000);
  });

  it('leaves controlled-failure headroom under the platform cap', (): void => {
    // The job timeout must beat the platform abort by a margin large enough to
    // append the terminal section-failed event and commit.
    expect(ROUTE_MAX_DURATION_MS - LAB_SECTION_JOB_TIMEOUT_MS).toBeGreaterThanOrEqual(
      15_000,
    );
  });
});
