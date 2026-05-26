'use client';

import { type ReactElement } from 'react';
import { ChevronLeft, ChevronRight, LockKeyhole } from 'lucide-react';

import { useAuditState } from '@/lib/research-v2/use-audit-state';
import { AppShell } from '@/components/shell/app-shell';
import { ShellProvider } from '@/components/shell/shell-provider';
import {
  POSITIONING_SECTION_IDS,
  type PositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';
import { cn } from '@/lib/utils';

import { SectionCard } from './section-card';
import { ActivityFeed } from './activity-feed';
import {
  FIRST_READER_SECTION_ID,
  PAID_MEDIA_PLAN_SECTION_ID,
  READER_SECTION_IDS,
  READER_SECTION_LABELS,
  getReaderSectionIndex,
  isReaderSectionId,
  type ReaderSectionId,
} from './reader-sections';

// ---------------------------------------------------------------------------

interface BattleshipShellProps {
  runId: string;
  activeSectionId?: ReaderSectionId;
  onSectionChange?: (sectionId: ReaderSectionId) => void;
}

type ReaderTabStatus = 'Queued' | 'Running' | 'Done' | 'Error' | 'Locked' | 'Ready';

const TERMINAL_ERROR_STATUSES: ReadonlySet<string> = new Set(['error', 'aborted']);

function isSixSectionComplete(live: ReturnType<typeof useAuditState>): boolean {
  if (live.children_complete >= POSITIONING_SECTION_IDS.length) return true;
  return POSITIONING_SECTION_IDS.every((sectionId) => {
    const worker = live.workerStates.find((state) => state.section_id === sectionId);
    return (
      worker?.status === 'complete' || live.sectionsByZone[sectionId] !== undefined
    );
  });
}

function getSectionTabStatus(
  sectionId: ReaderSectionId,
  live: ReturnType<typeof useAuditState>,
  workerByZone: Partial<
    Record<PositioningSectionId, ReturnType<typeof useAuditState>['workerStates'][number]>
  >,
): ReaderTabStatus {
  if (sectionId === PAID_MEDIA_PLAN_SECTION_ID) {
    return isSixSectionComplete(live) ? 'Ready' : 'Locked';
  }

  const worker = workerByZone[sectionId];
  if (worker?.status === 'complete' || live.sectionsByZone[sectionId]) {
    return 'Done';
  }
  if (worker?.status === 'running') return 'Running';
  if (worker && TERMINAL_ERROR_STATUSES.has(worker.status)) return 'Error';
  return 'Queued';
}

function getStatusClass(status: ReaderTabStatus): string {
  switch (status) {
    case 'Done':
      return 'text-[color:var(--green,var(--accent-green))]';
    case 'Running':
      return 'text-[color:var(--accent)]';
    case 'Error':
      return 'text-[color:var(--red,var(--accent-red))]';
    case 'Ready':
      return 'text-[color:var(--text-2)]';
    case 'Locked':
    case 'Queued':
    default:
      return 'text-[color:var(--text-3)]';
  }
}

function getPanelTitle(sectionId: ReaderSectionId): string {
  return READER_SECTION_LABELS[sectionId];
}

function getWaveSummary(
  workerStates: ReturnType<typeof useAuditState>['workerStates'],
): string {
  const running = workerStates.filter((worker) => worker.status === 'running');
  const queued = workerStates.filter((worker) => worker.status === 'queued');
  const complete = workerStates.filter((worker) => worker.status === 'complete');
  const waveSource =
    running.find((worker) => worker.wave !== null || worker.totalWaves !== null) ??
    workerStates.find((worker) => worker.wave !== null || worker.totalWaves !== null);
  const wave = waveSource?.wave ?? 1;
  const totalWaves = waveSource?.totalWaves ?? 1;

  return `Wave ${wave} of ${totalWaves} · ${running.length} running / ${queued.length} queued / ${complete.length} complete`;
}

export function BattleshipShell({
  runId,
  activeSectionId = FIRST_READER_SECTION_ID,
  onSectionChange,
}: BattleshipShellProps): ReactElement {
  const live = useAuditState(runId);
  const selectedSectionId = isReaderSectionId(activeSectionId)
    ? activeSectionId
    : FIRST_READER_SECTION_ID;

  // Build worker lookup by section_id for O(1) access in SectionCard
  const workerByZone = Object.fromEntries(
    live.workerStates.map((w) => [w.section_id, w]),
  ) as Partial<
    Record<PositioningSectionId, (typeof live.workerStates)[number]>
  >;
  const selectedIndex = getReaderSectionIndex(selectedSectionId);
  const previousSection = selectedIndex > 0 ? READER_SECTION_IDS[selectedIndex - 1] : null;
  const nextSection =
    selectedIndex < READER_SECTION_IDS.length - 1
      ? READER_SECTION_IDS[selectedIndex + 1]
      : null;
  const sixSectionsComplete = isSixSectionComplete(live);

  const handleSectionChange = (sectionId: ReaderSectionId): void => {
    onSectionChange?.(sectionId);
  };

  return (
    <ShellProvider>
      <AppShell
        wide
        sidebar={null}
        rightPanel={<ActivityFeed live={live} />}
      >
        <div className="flex-1 overflow-y-auto px-6 py-8">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
            {/* Run id mono label */}
            <p
              className="font-mono text-[10px] uppercase tracking-[0.08em]"
              style={{ color: 'var(--text-quaternary)' }}
            >
              run {runId.slice(0, 8)} · {live.children_complete}/
              {live.children_total || POSITIONING_SECTION_IDS.length} complete
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-3)]">
              {getWaveSummary(live.workerStates)}
            </p>

            <div
              role="tablist"
              aria-label="Sections"
              className="flex w-full gap-4 overflow-x-auto border-b border-[color:var(--border)]"
            >
              {READER_SECTION_IDS.map((sectionId, index) => {
                const status = getSectionTabStatus(sectionId, live, workerByZone);
                const selected = sectionId === selectedSectionId;
                return (
                  <button
                    key={sectionId}
                    id={`reader-tab-${sectionId}`}
                    type="button"
                    role="tab"
                    aria-controls={`reader-panel-${sectionId}`}
                    aria-selected={selected}
                    onClick={() => handleSectionChange(sectionId)}
                    className={cn(
                      'flex shrink-0 items-center gap-2 border-b-2 px-0 pb-3 pt-1 text-left font-mono text-[11px] uppercase tracking-[0.06em] transition-colors',
                      selected
                        ? 'border-[color:var(--accent)] text-[color:var(--text-1)]'
                        : 'border-transparent text-[color:var(--text-4)] hover:text-[color:var(--text-2)]',
                    )}
                  >
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <span>{READER_SECTION_LABELS[sectionId]}</span>
                    <span
                      data-testid={`reader-tab-status-${sectionId}`}
                      className={cn(
                        'normal-case tracking-normal',
                        getStatusClass(status),
                      )}
                    >
                      {status}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                aria-label="Previous section"
                disabled={!previousSection}
                onClick={() => {
                  if (previousSection) handleSectionChange(previousSection);
                }}
                className="inline-flex items-center gap-2 rounded-[5px] border border-[color:var(--border)] px-3 py-1.5 text-xs text-[color:var(--text-2)] transition-colors hover:border-[color:var(--border-hover)] hover:text-[color:var(--text-1)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="size-3.5" aria-hidden="true" />
                Previous
              </button>
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-3)]">
                {selectedIndex + 1} / {READER_SECTION_IDS.length}
              </p>
              <button
                type="button"
                aria-label="Next section"
                disabled={!nextSection}
                onClick={() => {
                  if (nextSection) handleSectionChange(nextSection);
                }}
                className="inline-flex items-center gap-2 rounded-[5px] border border-[color:var(--border)] px-3 py-1.5 text-xs text-[color:var(--text-2)] transition-colors hover:border-[color:var(--border-hover)] hover:text-[color:var(--text-1)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <ChevronRight className="size-3.5" aria-hidden="true" />
              </button>
            </div>

            <section
              id={`reader-panel-${selectedSectionId}`}
              role="tabpanel"
              aria-labelledby={`reader-tab-${selectedSectionId}`}
              className="min-h-[480px]"
            >
              {selectedSectionId === PAID_MEDIA_PLAN_SECTION_ID ? (
                <PaidMediaPlanTerminalPanel unlocked={sixSectionsComplete} />
              ) : (
                <SectionCard
                  zoneId={selectedSectionId}
                  body={live.sectionsByZone[selectedSectionId]}
                  events={live.eventsByZone[selectedSectionId] ?? []}
                  workerState={workerByZone[selectedSectionId]}
                />
              )}
            </section>
          </div>
        </div>
      </AppShell>
    </ShellProvider>
  );
}

interface PaidMediaPlanTerminalPanelProps {
  unlocked: boolean;
}

function PaidMediaPlanTerminalPanel({
  unlocked,
}: PaidMediaPlanTerminalPanelProps): ReactElement {
  return (
    <div className="rounded-[8px] border border-[color:var(--border)] px-5 py-6">
      <div className="flex items-center gap-3">
        <LockKeyhole
          className="size-4 text-[color:var(--text-3)]"
          aria-hidden="true"
        />
        <div>
          <h2 className="text-base font-semibold text-[color:var(--text-1)]">
            {getPanelTitle(PAID_MEDIA_PLAN_SECTION_ID)}
          </h2>
          <p className="mt-1 text-sm text-[color:var(--text-2)]">
            {unlocked
              ? 'Ready after 6/6 sections complete.'
              : 'Locked · unlocks after 6/6 sections complete.'}
          </p>
        </div>
      </div>
    </div>
  );
}
