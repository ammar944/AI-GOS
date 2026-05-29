import { describe, expect, it } from 'vitest';

import type { AuditSectionPhase } from '../route';
import { deriveSectionPhase } from '../derive-section-phase';

interface EventPhaseCase {
  latestEventType: string;
  expected: AuditSectionPhase;
}

const eventPhaseCases: readonly EventPhaseCase[] = [
  { latestEventType: 'section-started', expected: 'Compiling context' },
  { latestEventType: 'skill-loaded', expected: 'Compiling context' },
  { latestEventType: 'tool-started', expected: 'Reading sources' },
  { latestEventType: 'tool-finished', expected: 'Reading sources' },
  { latestEventType: 'structured-output-started', expected: 'Drafting' },
  { latestEventType: 'validation-failed', expected: 'Validating' },
  { latestEventType: 'repair-started', expected: 'Validating' },
  { latestEventType: 'artifact-saved', expected: 'Draft ready' },
  { latestEventType: 'sub-section-committed', expected: 'Committed' },
  { latestEventType: 'section-completed', expected: 'Committed' },
  { latestEventType: 'section-failed', expected: 'Needs review' },
];

describe('deriveSectionPhase', (): void => {
  it.each(eventPhaseCases)(
    'maps $latestEventType to $expected',
    ({ latestEventType, expected }): void => {
      expect(deriveSectionPhase({ status: 'running', latestEventType })).toBe(expected);
    },
  );

  it('returns Queued for queued sections even when an event exists', (): void => {
    expect(
      deriveSectionPhase({
        status: 'queued',
        latestEventType: 'section-started',
      }),
    ).toBe('Queued');
  });

  it('returns Queued when no activity event exists', (): void => {
    expect(
      deriveSectionPhase({
        status: 'running',
        latestEventType: null,
      }),
    ).toBe('Queued');
  });

  it('lets terminal status win over the latest activity event', (): void => {
    expect(
      deriveSectionPhase({
        status: 'complete',
        latestEventType: 'tool-started',
      }),
    ).toBe('Committed');
    expect(
      deriveSectionPhase({
        status: 'error',
        latestEventType: 'artifact-saved',
      }),
    ).toBe('Needs review');
    expect(
      deriveSectionPhase({
        status: 'aborted',
        latestEventType: 'artifact-saved',
      }),
    ).toBe('Needs review');
    expect(
      deriveSectionPhase({
        status: 'needs-review',
        latestEventType: 'artifact-saved',
      }),
    ).toBe('Needs review');
  });
});
