import { describe, expect, it } from 'vitest';

import { LAB_SECTION_JOB_TIMEOUT_MS } from '@/lib/research-v2/lab-section-dispatch';

import {
  answerToolTimeoutMs,
  getStructuredFallbackFloorMs,
  labSectionRepairFloorMs,
  labSectionStructuredFallbackMinFloorMs,
} from '../run-section';

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

  it('pins the agreed values (255s < 285s < 300s)', (): void => {
    expect(answerToolTimeoutMs).toBe(255_000);
    // Raised 270s -> 285s (2026-06-08 deploy-blockers E2E #2): the thinker's
    // critic tail ran past the old 270s wall. 285s keeps the >=15s commit
    // headroom invariant below (300 - 285 = 15) that the salvage-commit needs.
    expect(LAB_SECTION_JOB_TIMEOUT_MS).toBe(285_000);
    expect(ROUTE_MAX_DURATION_MS).toBe(300_000);
  });

  it('leaves controlled-failure headroom under the platform cap', (): void => {
    // The job timeout must beat the platform abort by a margin large enough to
    // append the terminal section-failed event and commit.
    expect(ROUTE_MAX_DURATION_MS - LAB_SECTION_JOB_TIMEOUT_MS).toBeGreaterThanOrEqual(
      15_000,
    );
  });

  it('keeps the structured fallback floor above the normal repair floor', (): void => {
    expect(labSectionStructuredFallbackMinFloorMs).toBeGreaterThan(
      labSectionRepairFloorMs,
    );
    expect(
      labSectionStructuredFallbackMinFloorMs + (ROUTE_MAX_DURATION_MS - LAB_SECTION_JOB_TIMEOUT_MS),
    ).toBeLessThan(LAB_SECTION_JOB_TIMEOUT_MS);
  });

  it('returns the 120s minimum fallback floor for a normal section and VoC', (): void => {
    // The fallback shares the attempt's deadline-aware timeoutSignal, so the
    // floor is the 120s minimum (not 240s+emit). A higher per-section floor made
    // the fallback unreachable inside the 300s cap once a slow first attempt had
    // burned budget. Both a normal section and the slower VoC section must clear
    // the gate whenever >=120s remain.
    expect(getStructuredFallbackFloorMs('positioningMarketCategory')).toBe(
      labSectionStructuredFallbackMinFloorMs,
    );
    expect(getStructuredFallbackFloorMs('positioningMarketCategory')).toBe(120_000);
    expect(getStructuredFallbackFloorMs('positioningVoiceOfCustomer')).toBe(
      120_000,
    );
  });

  it('keeps the fallback floor reachable after a slow deadline-aware first attempt', (): void => {
    // Regression for the "remaining section budget Xms below fallback floor
    // 260000ms" death: within the 300s cap a 240s first attempt + a fresh 260s
    // fallback can never both fit. With the floor at 120s, a fallback launched
    // with budget left (e.g. 134s after a slow attempt) still fires.
    expect(getStructuredFallbackFloorMs('positioningMarketCategory')).toBeLessThan(
      134_000,
    );
  });
});
