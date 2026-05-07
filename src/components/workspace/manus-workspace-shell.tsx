'use client';

import type { ReactNode } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  Loader2,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { SECTION_PIPELINE, SECTION_PIPELINE_LABELS } from '@/lib/workspace/pipeline';
import type { SectionKey, SectionPhase, WorkspaceState } from '@/lib/workspace/types';

export type ManusShellWorkspaceState = Pick<WorkspaceState, 'currentSection' | 'sectionStates'>;

export interface ManusWorkspaceShellProps {
  workspaceState?: ManusShellWorkspaceState;
  sections?: readonly SectionKey[];
  onNavigateSection?: (section: SectionKey) => void;
  sectionNav?: ReactNode;
  statusSummary?: ReactNode;
  chat: ReactNode;
  artifact: ReactNode;
  runDetails?: ReactNode;
  runDetailsSummary?: ReactNode;
  className?: string;
}

interface PhaseDisplay {
  label: string;
  Icon: LucideIcon;
  className: string;
}

const PHASE_DISPLAY: Record<SectionPhase, PhaseDisplay> = {
  queued: {
    label: 'Queued',
    Icon: Clock3,
    className: 'border-[var(--border-subtle)] bg-[var(--bg-hover)] text-[var(--text-tertiary)]',
  },
  researching: {
    label: 'Running',
    Icon: Loader2,
    className: 'border-[rgba(54,94,255,0.28)] bg-[rgba(54,94,255,0.10)] text-[var(--accent-blue)]',
  },
  streaming: {
    label: 'Streaming',
    Icon: Loader2,
    className: 'border-[rgba(245,158,11,0.28)] bg-[rgba(245,158,11,0.10)] text-[var(--accent-amber)]',
  },
  review: {
    label: 'Review',
    Icon: Circle,
    className: 'border-[rgba(34,197,94,0.22)] bg-[rgba(34,197,94,0.07)] text-[var(--accent-green)]',
  },
  approved: {
    label: 'Approved',
    Icon: CheckCircle2,
    className: 'border-[rgba(34,197,94,0.28)] bg-[rgba(34,197,94,0.09)] text-[var(--accent-green)]',
  },
  error: {
    label: 'Failed',
    Icon: AlertCircle,
    className: 'border-[rgba(239,68,68,0.28)] bg-[rgba(239,68,68,0.10)] text-[var(--accent-red)]',
  },
};

function getSectionLabel(section: SectionKey): string {
  return SECTION_PIPELINE_LABELS[section] ?? section;
}

function ManusStatusSummary({
  workspaceState,
}: {
  workspaceState: ManusShellWorkspaceState;
}): React.JSX.Element {
  const section = workspaceState.currentSection;
  const phase = workspaceState.sectionStates[section];
  const phaseDisplay = PHASE_DISPLAY[phase];

  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-medium text-[var(--text-primary)]">
        {getSectionLabel(section)}
      </p>
      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
        {phaseDisplay.label}
      </p>
    </div>
  );
}

function ManusSectionProgressionItem({
  section,
  currentSection,
  phase,
  onNavigateSection,
}: {
  section: SectionKey;
  currentSection: SectionKey;
  phase: SectionPhase;
  onNavigateSection?: (section: SectionKey) => void;
}): React.JSX.Element {
  const label = getSectionLabel(section);
  const phaseDisplay = PHASE_DISPLAY[phase];
  const isCurrent = section === currentSection;
  const Icon = phaseDisplay.Icon;
  const content = (
    <>
      <Icon
        className={cn('h-3.5 w-3.5 shrink-0', phase === 'researching' || phase === 'streaming' ? 'animate-spin' : '')}
        aria-hidden="true"
      />
      <span className="truncate">{label}</span>
      <span className="hidden font-mono text-[10px] uppercase tracking-[0.08em] opacity-70 xl:inline">
        {phaseDisplay.label}
      </span>
    </>
  );
  const className = cn(
    'inline-flex h-8 max-w-[12rem] items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]/35',
    phaseDisplay.className,
    isCurrent && 'ring-1 ring-[var(--text-primary)]/20',
  );

  if (onNavigateSection) {
    return (
      <button
        type="button"
        aria-current={isCurrent ? 'step' : undefined}
        aria-label={`${label}: ${phase}`}
        className={cn(className, phase === 'queued' ? 'cursor-not-allowed opacity-55' : 'cursor-pointer')}
        disabled={phase === 'queued'}
        onClick={() => onNavigateSection(section)}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      aria-current={isCurrent ? 'step' : undefined}
      aria-label={`${label}: ${phase}`}
      className={className}
    >
      {content}
    </div>
  );
}

function ManusSectionProgression({
  workspaceState,
  sections,
  onNavigateSection,
}: {
  workspaceState: ManusShellWorkspaceState;
  sections: readonly SectionKey[];
  onNavigateSection?: (section: SectionKey) => void;
}): React.JSX.Element {
  return (
    <nav
      data-testid="manus-workspace-section-progress"
      aria-label="Journey section progression"
      className="min-w-0 overflow-x-auto"
    >
      <ol className="flex min-w-0 items-center gap-2">
        {sections.map((section) => (
          <li key={section} className="min-w-0 shrink-0">
            <ManusSectionProgressionItem
              section={section}
              currentSection={workspaceState.currentSection}
              phase={workspaceState.sectionStates[section]}
              onNavigateSection={onNavigateSection}
            />
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function ManusWorkspaceShell({
  workspaceState,
  sections = SECTION_PIPELINE,
  onNavigateSection,
  sectionNav,
  statusSummary,
  chat,
  artifact,
  runDetails,
  runDetailsSummary,
  className,
}: ManusWorkspaceShellProps): React.JSX.Element {
  const hasHeader = Boolean(statusSummary || sectionNav || workspaceState);

  return (
    <section
      data-testid="manus-workspace-shell"
      className={cn(
        'flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0b0b0a] text-[var(--text-primary)]',
        className,
      )}
    >
      {hasHeader ? (
        <header className="shrink-0 border-b border-white/[0.06] bg-[#0b0b0a]/95 px-4 py-3">
          <div className="mx-auto flex w-full max-w-[1220px] min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div
              data-testid="manus-workspace-status-summary"
              className="min-w-0 shrink-0"
            >
              {statusSummary ?? (workspaceState ? <ManusStatusSummary workspaceState={workspaceState} /> : null)}
            </div>
            <div
              data-testid="manus-workspace-section-nav"
              className="min-w-0 flex-1 lg:flex lg:justify-end"
            >
              {sectionNav ?? (
                workspaceState ? (
                  <ManusSectionProgression
                    workspaceState={workspaceState}
                    sections={sections}
                    onNavigateSection={onNavigateSection}
                  />
                ) : null
              )}
            </div>
          </div>
        </header>
      ) : null}

      <div className="grid w-full min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[minmax(20rem,0.72fr)_minmax(44rem,1.28fr)] xl:grid-cols-[minmax(22rem,0.68fr)_minmax(52rem,1.32fr)]">
        <main
          data-testid="manus-workspace-chat"
          aria-label="Primary chat workspace"
          className="flex min-h-[30rem] min-w-0 flex-col overflow-hidden rounded-[10px] border border-white/[0.06] bg-[#111110] shadow-[0_18px_50px_rgba(0,0,0,0.32)] lg:min-h-0"
        >
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/[0.07] px-4">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#50f8e4]" />
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/42">
                Agent console
              </span>
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/42">
              ask / edit
            </span>
          </div>
          {chat}
        </main>

        <aside
          data-testid="manus-workspace-artifact"
          aria-label="Report artifact workspace"
          className="flex min-h-[24rem] min-w-0 flex-col overflow-hidden rounded-[10px] border border-white/[0.06] bg-[#111110] shadow-[0_18px_50px_rgba(0,0,0,0.32)] lg:min-h-0"
        >
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/[0.07] px-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/42">
              Report artifact
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/42">
              live artifact
            </span>
          </div>
          {artifact}
        </aside>
      </div>

      {runDetails ? (
        <details
          data-testid="manus-workspace-run-details"
          aria-label="Run telemetry"
          className="group shrink-0 border-t border-white/[0.06] bg-[#0b0b0a]/95 text-sm text-[var(--text-secondary)]"
        >
          <summary className="mx-auto flex max-w-[1220px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-white/42 transition-colors hover:text-white/62 [&::-webkit-details-marker]:hidden">
            {runDetailsSummary ?? 'Run details'}
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="border-t border-white/10">
            <div className="mx-auto max-h-72 max-w-[1220px] overflow-auto px-4 py-3">
              {runDetails}
            </div>
          </div>
        </details>
      ) : null}
    </section>
  );
}
