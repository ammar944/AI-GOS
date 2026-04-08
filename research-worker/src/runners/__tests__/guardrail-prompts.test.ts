import { describe, expect, it } from 'vitest';
import { SYNTHESIS_SYSTEM } from '../synthesize';

describe('synthesize runner guardrail', () => {
  it('SYNTHESIS_SYSTEM contains the current-activities anti-duplication rule', () => {
    expect(SYNTHESIS_SYSTEM).toContain('CURRENT MARKETING ACTIVITIES');
    expect(SYNTHESIS_SYSTEM).toContain('anti-duplication');
    expect(SYNTHESIS_SYSTEM).toContain('MUST NOT restate');
    expect(SYNTHESIS_SYSTEM).toContain('"Current Marketing Activities:"');
  });

  it('SYNTHESIS_SYSTEM has a carve-out for the empty-field case', () => {
    expect(SYNTHESIS_SYSTEM).toContain('field is empty');
  });
});
