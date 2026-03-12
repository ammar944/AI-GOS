import { describe, expect, it } from 'vitest';
import {
  classifyJourneyDispatchFailure,
  isJourneyOrchestrationTimeout,
  shouldIgnoreDispatchError,
} from '../research-recovery';

describe('isJourneyOrchestrationTimeout', () => {
  it('recognizes generic request timeout errors', () => {
    expect(isJourneyOrchestrationTimeout('Request timed out.')).toBe(true);
  });

  it('recognizes oversized session context timeout errors', () => {
    expect(
      isJourneyOrchestrationTimeout(
        'Request timed out. This session context is too full.',
      ),
    ).toBe(true);
  });

  it('does not classify worker or validation failures as orchestration timeouts', () => {
    expect(isJourneyOrchestrationTimeout('Worker error: 500')).toBe(false);
  });
});

describe('shouldIgnoreDispatchError', () => {
  it('ignores orchestration timeout errors once the section is already active', () => {
    expect(
      shouldIgnoreDispatchError({
        errorMessage: 'Request timed out.',
        active: true,
      }),
    ).toBe(true);
  });

  it('ignores orchestration timeout errors when the worker is already running', () => {
    expect(
      shouldIgnoreDispatchError({
        errorMessage: 'Request timed out. This session context is too full.',
        active: false,
        activity: { status: 'running' },
      }),
    ).toBe(true);
  });

  it('keeps real dispatch failures terminal', () => {
    expect(
      shouldIgnoreDispatchError({
        errorMessage: 'Worker error: 500',
        active: true,
      }),
    ).toBe(false);
  });
});

describe('classifyJourneyDispatchFailure', () => {
  it('classifies missing worker configuration as worker unavailable', () => {
    expect(
      classifyJourneyDispatchFailure(
        'Research worker not reachable. RAILWAY_WORKER_URL is not configured.',
      ),
    ).toBe('worker-unavailable');
  });

  it('classifies worker HTTP failures as dispatch failures', () => {
    expect(classifyJourneyDispatchFailure('Worker error: 500')).toBe(
      'dispatch-failed',
    );
  });

  it('classifies chat request timeouts separately from hard worker failures', () => {
    expect(classifyJourneyDispatchFailure('Request timed out.')).toBe(
      'dispatch-timeout',
    );
  });
});
