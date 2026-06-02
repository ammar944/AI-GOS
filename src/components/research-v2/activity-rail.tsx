'use client';

import { useState } from 'react';
import {
  Check,
  ChevronRight,
  Loader2,
  Search,
  type LucideIcon,
} from 'lucide-react';

import {
  ChainOfThoughtStep,
  ChainOfThoughtSearchResults,
  ChainOfThoughtSearchResult,
} from '@/components/ai-elements/chain-of-thought';
import { Shimmer } from '@/components/ai-elements/shimmer';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ACTIVITY_TONE_CLASS,
  PHASE_ICON,
} from '@/components/research-v2/ui-kit';
import { cn } from '@/lib/utils';

/** Product phases shown in the activity rail (excludes terminal `done`). */
export type ActivityPhase =
  | 'preparing'
  | 'searching'
  | 'drafting'
  | 'checking'
  | 'refining'
  | 'committing';

export const ALL_ACTIVITY_PHASES: readonly ActivityPhase[] = [
  'preparing',
  'searching',
  'drafting',
  'checking',
  'refining',
  'committing',
] as const;

export interface ActivityStep {
  phase: ActivityPhase;
  label: string;
  detail?: string | null;
  status: 'complete' | 'active' | 'pending';
  tone?: keyof typeof ACTIVITY_TONE_CLASS;
  chips?: string[];
}

export function phaseLabel(phase: ActivityPhase): string {
  switch (phase) {
    case 'preparing':
      return 'Preparing';
    case 'searching':
      return 'Researching live sources';
    case 'drafting':
      return 'Writing section';
    case 'checking':
      return 'Verifying claims';
    case 'refining':
      return 'Refining';
    case 'committing':
      return 'Committing';
  }
}

function stepIconToneClass(
  tone: keyof typeof ACTIVITY_TONE_CLASS | undefined,
): string {
  if (!tone) return 'text-muted-foreground';
  return ACTIVITY_TONE_CLASS[tone];
}

export function ActivityRail({
  steps,
  currentLabel,
  live,
}: {
  steps: ActivityStep[];
  currentLabel: string;
  live: boolean;
}): React.ReactElement {
  return (
    <div className="space-y-5">
      {live ? (
        <div className="flex items-center gap-2.5">
          <Loader2
            className="size-4 animate-spin text-primary motion-reduce:animate-none"
            strokeWidth={2.5}
          />
          <Shimmer className="text-[14px] font-medium" duration={2.2}>
            {currentLabel}
          </Shimmer>
        </div>
      ) : null}

      {live && steps.length === 0 ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-3/4 rounded-md" />
          <Skeleton className="h-4 w-1/2 rounded-md" />
          <Skeleton className="h-4 w-2/3 rounded-md" />
        </div>
      ) : (
        <div className="max-h-[340px] space-y-3 overflow-y-auto pr-1">
          {steps.map((step, index) => {
            const Icon: LucideIcon = PHASE_ICON[step.phase];
            return (
              <ChainOfThoughtStep
                key={`${step.phase}-${index}`}
                icon={Icon}
                status={step.status}
                label={<span className="text-[14px]">{step.label}</span>}
                description={step.detail ?? undefined}
                className={cn(stepIconToneClass(step.tone))}
              >
                {step.chips && step.chips.length > 0 ? (
                  <ChainOfThoughtSearchResults>
                    {step.chips.map((chip, chipIndex) => (
                      <ChainOfThoughtSearchResult
                        key={chipIndex}
                        className="font-mono text-[11px]"
                      >
                        <Search className="size-3 opacity-60" />
                        {chip}
                      </ChainOfThoughtSearchResult>
                    ))}
                  </ChainOfThoughtSearchResults>
                ) : null}
              </ChainOfThoughtStep>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function CompletedActivitySummary({
  sourceCount,
  toolCount,
  durationLabel,
}: {
  sourceCount?: number;
  toolCount?: number;
  durationLabel?: string;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const parts = [
    sourceCount != null ? `${sourceCount} sources` : null,
    toolCount != null ? `${toolCount} tools` : null,
    durationLabel ?? null,
  ].filter(Boolean);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="group flex items-center gap-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground">
        <Check className="size-3.5 text-emerald-600" strokeWidth={2.5} />
        <span>Researched {parts.join(' · ')}</span>
        <ChevronRight className="size-3.5 transition-transform group-data-[state=open]:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3">
        <div className="border-l border-border pl-4 text-[13px] text-muted-foreground">
          Activity trace is collapsed after commit — expand to review the research
          steps.
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
