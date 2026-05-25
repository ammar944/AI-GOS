'use client';

import { type ReactElement } from 'react';

import { useAuditState } from '@/lib/research-v2/use-audit-state';
import { AppShell } from '@/components/shell/app-shell';
import { ShellProvider } from '@/components/shell/shell-provider';
import {
  POSITIONING_SECTION_IDS,
  type PositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';

import { SectionCard } from './section-card';
import { ActivityFeed } from './activity-feed';
import { BattleshipSidebar } from './battleship-sidebar';

// ---------------------------------------------------------------------------

interface BattleshipShellProps {
  runId: string;
}

export function BattleshipShell({ runId }: BattleshipShellProps): ReactElement {
  const live = useAuditState(runId);

  // Build worker lookup by section_id for O(1) access in SectionCard
  const workerByZone = Object.fromEntries(
    live.workerStates.map((w) => [w.section_id, w]),
  ) as Partial<
    Record<PositioningSectionId, (typeof live.workerStates)[number]>
  >;

  return (
    <ShellProvider>
      <AppShell
        wide
        sidebar={<BattleshipSidebar live={live} />}
        rightPanel={<ActivityFeed live={live} />}
      >
        <div className="flex-1 overflow-y-auto px-6 py-8">
          <div className="mx-auto max-w-2xl space-y-0">
            {/* Run id mono label */}
            <p
              className="mb-6 font-mono text-[10px] uppercase tracking-[0.08em]"
              style={{ color: 'var(--text-quaternary)' }}
            >
              run {runId.slice(0, 8)} · {live.children_complete}/
              {live.children_total || POSITIONING_SECTION_IDS.length} complete
            </p>

            {POSITIONING_SECTION_IDS.map((zoneId) => (
              <SectionCard
                key={zoneId}
                zoneId={zoneId}
                body={live.sectionsByZone[zoneId]}
                workerState={workerByZone[zoneId]}
              />
            ))}
          </div>
        </div>
      </AppShell>
    </ShellProvider>
  );
}
