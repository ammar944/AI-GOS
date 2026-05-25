import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AuditStateResponse } from '@/app/api/research-v2/audit-state/route';

// Isolate the shell render from the polling hook — we only care that the
// component mounts (i.e. has its ShellProvider) for the all-queued/empty state.
const EMPTY_AUDIT_STATE: AuditStateResponse = {
  parent_audit_run_id: null,
  parent_status: null,
  children_complete: 0,
  children_total: 0,
  workerStates: [],
  sectionsByZone: {},
  eventsByZone: {},
};

vi.mock('@/lib/research-v2/use-audit-state', () => ({
  useAuditState: (): AuditStateResponse => EMPTY_AUDIT_STATE,
}));

const { BattleshipShell } = await import('../battleship-shell');

describe('<BattleshipShell>', () => {
  afterEach(() => cleanup());

  it('mounts on a queued/empty run without throwing (needs ShellProvider)', () => {
    // Before the fix, AppShell calls useShell() with no provider mounted and
    // throws "useShell must be used within ShellProvider", crashing to the
    // error boundary. This must render the run label instead.
    expect(() =>
      render(<BattleshipShell runId="aab09d58-86f6-45e1-9bd6-2534f79a9256" />),
    ).not.toThrow();

    expect(screen.getByText(/aab09d58/i)).toBeInTheDocument();
  });
});
