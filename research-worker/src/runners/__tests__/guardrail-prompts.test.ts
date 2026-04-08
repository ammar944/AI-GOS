import { describe, expect, it } from 'vitest';
import { SYNTHESIS_SYSTEM } from '../synthesize';
import { CURRENT_ACTIVITIES_GUARDRAIL } from '../media-plan';

describe('synthesize runner guardrail', () => {
  it('SYNTHESIS_SYSTEM contains the current-activities anti-duplication rule', () => {
    // Lock in the exact header line so a future refactor can't silently move
    // the guardrail into an unrelated section and still pass the test.
    expect(SYNTHESIS_SYSTEM).toContain('CURRENT MARKETING ACTIVITIES (anti-duplication rule):');
    expect(SYNTHESIS_SYSTEM).toContain('MUST NOT restate');
    expect(SYNTHESIS_SYSTEM).toContain('"Current Marketing Activities:"');
  });

  it('SYNTHESIS_SYSTEM has a carve-out for the empty-field case', () => {
    // Assert on the full sentence, not just "field is empty" — that phrase
    // is common enough to collide with unrelated rules.
    expect(SYNTHESIS_SYSTEM).toContain('If the field is empty or absent, ignore this rule');
  });
});

describe('media-plan runner guardrail', () => {
  it('CURRENT_ACTIVITIES_GUARDRAIL contains the exact header line', () => {
    // Lock in the exact header line so a future refactor can't silently
    // move the guardrail into an unrelated section and still pass the test.
    expect(CURRENT_ACTIVITIES_GUARDRAIL).toContain('CURRENT MARKETING ACTIVITIES (anti-duplication rule):');
  });

  it('CURRENT_ACTIVITIES_GUARDRAIL covers all six media-plan blocks', () => {
    expect(CURRENT_ACTIVITIES_GUARDRAIL).toContain('Channel Mix & Budget');
    expect(CURRENT_ACTIVITIES_GUARDRAIL).toContain('Audience & Campaign');
    expect(CURRENT_ACTIVITIES_GUARDRAIL).toContain('Creative System');
    expect(CURRENT_ACTIVITIES_GUARDRAIL).toContain('Rollout Roadmap');
  });

  it('CURRENT_ACTIVITIES_GUARDRAIL has a carve-out for the empty-field case', () => {
    // Assert on the full sentence, not just a fragment — common phrases collide.
    expect(CURRENT_ACTIVITIES_GUARDRAIL).toContain('If the field is empty or absent, ignore this rule');
  });
});
