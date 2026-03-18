'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ListChecks,
} from 'lucide-react';
import {
  buildJourneyResearchSandboxSmokeChecklist,
  type JourneyResearchSandboxSmokeStatus,
} from '@/lib/journey/research-sandbox-smoke-checklist';
import type { ResearchJobActivity } from '@/lib/journey/research-job-activity';
import type { ResearchSectionResult } from '@/lib/journey/research-realtime';
import type {
  JourneyResearchSandboxBackendStatus,
  JourneyResearchSandboxSection,
} from '@/lib/journey/research-sandbox';
import { cn } from '@/lib/utils';

export interface JourneyResearchSandboxChecklistProps {
  section: JourneyResearchSandboxSection;
  missingPrerequisites: JourneyResearchSandboxSection[];
  backendStatus: JourneyResearchSandboxBackendStatus | null;
  selectedResult: ResearchSectionResult | null;
  selectedActivity?: ResearchJobActivity;
}

function getStatusClasses(status: JourneyResearchSandboxSmokeStatus): string {
  if (status === 'verified') {
    return 'border-[rgba(30,170,95,0.24)] bg-[rgba(30,170,95,0.08)] text-[rgb(170,255,203)]';
  }

  if (status === 'ready') {
    return 'border-[rgba(48,126,255,0.24)] bg-[rgba(48,126,255,0.08)] text-[rgb(183,216,255)]';
  }

  if (status === 'blocked') {
    return 'border-[rgba(255,120,120,0.24)] bg-[rgba(255,120,120,0.08)] text-[rgb(255,198,198)]';
  }

  return 'border-white/10 bg-[var(--bg-hover)] text-text-secondary';
}

function getStatusLabel(status: JourneyResearchSandboxSmokeStatus): string {
  if (status === 'verified') {
    return 'Verified';
  }

  if (status === 'ready') {
    return 'Ready';
  }

  if (status === 'blocked') {
    return 'Blocked';
  }

  return 'Pending';
}

function StatusIcon({ status }: { status: JourneyResearchSandboxSmokeStatus }) {
  if (status === 'verified') {
    return <CheckCircle2 className="h-4 w-4" />;
  }

  if (status === 'ready') {
    return <ListChecks className="h-4 w-4" />;
  }

  if (status === 'blocked') {
    return <AlertTriangle className="h-4 w-4" />;
  }

  return <Clock3 className="h-4 w-4" />;
}

export function JourneyResearchSandboxChecklist({
  section,
  missingPrerequisites,
  backendStatus,
  selectedResult,
  selectedActivity,
}: JourneyResearchSandboxChecklistProps) {
  const checklist = buildJourneyResearchSandboxSmokeChecklist({
    section,
    missingPrerequisites,
    backendStatus,
    selectedResult,
    selectedActivity,
  });

  return (
    <div className="rounded-[24px] border border-white/10 bg-[rgba(8,12,20,0.82)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent-cyan)]">
            Smoke checklist
          </h3>
          <p className="mt-1 text-xs leading-5 text-text-tertiary">
            Canonical QA pass for {checklist.sectionLabel}. Auto signals summarize backend state;
            manual checks lock what to inspect before trusting the run.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-text-tertiary">
            Auto signals
          </div>
          <div className="mt-3 space-y-3">
            {checklist.autoChecks.map((check) => (
              <div
                key={check.key}
                className={cn(
                  'rounded-2xl border px-4 py-3',
                  getStatusClasses(check.status),
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <StatusIcon status={check.status} />
                    {check.title}
                  </div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                    {getStatusLabel(check.status)}
                  </div>
                </div>
                <p className="mt-2 text-xs leading-5">{check.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-text-tertiary">
            Manual pass
          </div>
          <div className="mt-3 space-y-3">
            {checklist.manualChecks.map((check) => (
              <div
                key={check.key}
                className="rounded-2xl border border-white/10 bg-[var(--bg-surface)] px-4 py-3"
              >
                <div className="text-sm font-medium text-text-primary">{check.title}</div>
                <p className="mt-2 text-xs leading-5 text-text-secondary">{check.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
