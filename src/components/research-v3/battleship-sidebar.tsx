'use client';

import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { AuditStateResponse } from '@/app/api/research-v2/audit-state/route';
import {
  POSITIONING_SECTION_IDS,
  POSITIONING_SECTION_LABELS,
  type PositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';

import { SECTION_ACCENT } from './section-card';

// ---------------------------------------------------------------------------

interface BattleshipSidebarProps {
  live: AuditStateResponse;
}

const STATUS_BADGE: Record<
  AuditStateResponse['workerStates'][number]['status'],
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  queued: { label: 'Queued', variant: 'secondary' },
  running: { label: 'Running', variant: 'default' },
  complete: { label: 'Done', variant: 'outline' },
  error: { label: 'Error', variant: 'destructive' },
  aborted: { label: 'Aborted', variant: 'destructive' },
};

export function BattleshipSidebar({ live }: BattleshipSidebarProps) {
  const workerByZone = Object.fromEntries(
    live.workerStates.map((w) => [w.section_id, w]),
  ) as Partial<Record<PositioningSectionId, AuditStateResponse['workerStates'][number]>>;

  return (
    <ScrollArea className="h-full w-full">
      <nav className="flex flex-col gap-1 px-2 py-4">
        <p
          className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-[0.1em]"
          style={{ color: 'var(--text-tertiary)' }}
        >
          Sections
        </p>

        {POSITIONING_SECTION_IDS.map((zoneId) => {
          const worker = workerByZone[zoneId];
          const accentColor = SECTION_ACCENT[zoneId];
          const badge = worker ? STATUS_BADGE[worker.status] : null;

          return (
            <a
              key={zoneId}
              href={`#section-${zoneId}`}
              className="flex items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-[var(--bg-hover,rgba(255,255,255,0.04))]"
            >
              {/* Accent dot */}
              <span
                className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                style={{ background: accentColor }}
              />

              {/* Label */}
              <span
                className="min-w-0 flex-1 truncate text-xs font-medium leading-snug"
                style={{ color: 'var(--text-secondary)' }}
              >
                {POSITIONING_SECTION_LABELS[zoneId]}
              </span>

              {/* Status badge */}
              {badge && (
                <Badge
                  variant={badge.variant}
                  className="ml-auto shrink-0 text-[9px] py-0 px-1.5 h-4"
                >
                  {badge.label}
                </Badge>
              )}
            </a>
          );
        })}
      </nav>
    </ScrollArea>
  );
}
