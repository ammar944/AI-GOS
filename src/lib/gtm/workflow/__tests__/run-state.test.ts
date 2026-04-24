import { describe, expect, it } from 'vitest';
import { canTransition, TERMINAL_STATUSES } from '@/lib/gtm/workflow/run-state';

describe('run-state.canTransition', () => {
  it('allows draft -> running', () => {
    expect(canTransition('draft', 'running')).toBe(true);
  });

  it('allows running -> needs_review, completed, failed', () => {
    expect(canTransition('running', 'needs_review')).toBe(true);
    expect(canTransition('running', 'completed')).toBe(true);
    expect(canTransition('running', 'failed')).toBe(true);
  });

  it('allows needs_review -> running or failed', () => {
    expect(canTransition('needs_review', 'running')).toBe(true);
    expect(canTransition('needs_review', 'failed')).toBe(true);
  });

  it('blocks transitions out of terminal statuses', () => {
    for (const terminal of TERMINAL_STATUSES) {
      expect(canTransition(terminal, 'running')).toBe(false);
    }
  });

  it('blocks draft -> completed directly', () => {
    expect(canTransition('draft', 'completed')).toBe(false);
  });
});
