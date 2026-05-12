import { describe, it, expect } from 'vitest';
import { buildContextWithRefinement } from '../runners/journey-section-synthesis';

describe('buildContextWithRefinement', () => {
  it('returns context unchanged when refinement is undefined', () => {
    const out = buildContextWithRefinement('Original context.', undefined);
    expect(out).toBe('Original context.');
  });

  it('returns context unchanged when refinement is empty string', () => {
    const out = buildContextWithRefinement('Original context.', '');
    expect(out).toBe('Original context.');
  });

  it('appends USER REFINEMENT section when refinement present', () => {
    const out = buildContextWithRefinement(
      'Original context.',
      'Focus on Cartesia',
    );
    expect(out).toContain('Original context.');
    expect(out).toContain('USER REFINEMENT');
    expect(out).toContain('Focus on Cartesia');
  });

  it('trims whitespace from refinement', () => {
    const out = buildContextWithRefinement('Ctx.', '   focus on X   ');
    expect(out).toContain('focus on X');
    expect(out).not.toContain('   focus on X   ');
  });

  it('replaces unpaired surrogates in refinement', () => {
    const lone = '\uD800abc';
    const out = buildContextWithRefinement('ctx', lone);
    expect(out).toContain('�');
    expect(out).not.toContain('\uD800');
  });
});
