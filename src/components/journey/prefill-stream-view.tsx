'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  Loader2,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

import type { ResearchJobActivity } from '@/lib/journey/research-job-activity';
import { JOURNEY_FIELD_LABELS } from '@/lib/journey/field-catalog';
import { cn } from '@/lib/utils';

export interface PrefillStreamViewProps {
  websiteUrl: string;
  deepResearchFields?: Record<string, string>;
  deepResearchStatus?: 'idle' | 'starting' | 'queued' | 'complete' | 'error';
  deepResearchError?: string | null;
  deepResearchActivity?: ResearchJobActivity;
  onRetry: () => void;
}

interface ThinkingStep {
  id: string;
  label: string;
  status: 'complete' | 'loading' | 'pending' | 'error';
  description: string;
}

interface VisibleField {
  key: string;
  label: string;
  value: string;
}

function getActivityUpdates(
  activity: ResearchJobActivity | undefined,
): NonNullable<ResearchJobActivity['updates']> {
  return [...(activity?.updates ?? [])]
    .sort((left, right) => left.at.localeCompare(right.at))
    .slice(-5);
}

function getActivityStatus(
  status: PrefillStreamViewProps['deepResearchStatus'],
  activity: ResearchJobActivity | undefined,
): string {
  if (activity?.status === 'running') return 'running';
  if (activity?.status === 'complete' || status === 'complete') return 'complete';
  if (activity?.status === 'error' || status === 'error') return 'error';
  if (status === 'queued') return 'queued';
  return 'starting';
}

function getThinkingSteps(
  status: PrefillStreamViewProps['deepResearchStatus'],
): ThinkingStep[] {
  const isComplete = status === 'complete';
  const isError = status === 'error';
  const activeIndex = status === 'queued' ? 1 : 0;
  const steps = [
    {
      id: 'source',
      label: 'Loaded submitted source',
      description: 'Company URL is saved to the active Journey run.',
    },
    {
      id: 'corpus',
      label: 'Building company corpus',
      description: 'The worker is collecting sources, evidence, competitors, and gaps.',
    },
    {
      id: 'fields',
      label: 'Extracting profile context',
      description: 'Deep research profile fields become the source of truth.',
    },
    {
      id: 'gtm',
      label: 'Preparing GTM command view',
      description: 'Journey opens the Codex-like GTM interface after the corpus is durable.',
    },
  ];

  return steps.map((step, index) => {
    if (isComplete) {
      return { ...step, status: 'complete' };
    }

    if (isError) {
      return {
        ...step,
        status: index === activeIndex ? 'error' : index < activeIndex ? 'complete' : 'pending',
      };
    }

    if (index < activeIndex) {
      return { ...step, status: 'complete' };
    }

    if (index === activeIndex) {
      return { ...step, status: 'loading' };
    }

    return { ...step, status: 'pending' };
  });
}

function getVisibleFields(fields: Record<string, string>): VisibleField[] {
  return Object.entries(fields)
    .map(([key, rawValue]) => {
      const value = rawValue.trim();
      if (!value) return null;

      return {
        key,
        label: JOURNEY_FIELD_LABELS[key] ?? key,
        value,
      };
    })
    .filter((field): field is VisibleField => field !== null)
    .slice(0, 8);
}

function JourneyIconRail(): React.JSX.Element | null {
  return null;
}

export function PrefillStreamView({
  websiteUrl,
  deepResearchFields = {},
  deepResearchStatus = 'idle',
  deepResearchError,
  deepResearchActivity,
  onRetry,
}: PrefillStreamViewProps): React.JSX.Element {
  const steps = useMemo(
    () => getThinkingSteps(deepResearchStatus),
    [deepResearchStatus],
  );
  const updates = getActivityUpdates(deepResearchActivity);
  const activityStatus = getActivityStatus(deepResearchStatus, deepResearchActivity);
  const visibleFields = getVisibleFields(deepResearchFields);
  const fieldCount = Object.values(deepResearchFields).filter(
    (value) => value.trim().length > 0,
  ).length;
  const isComplete = deepResearchStatus === 'complete';
  const isError = deepResearchStatus === 'error';

  return (
    <div className="flex min-h-screen bg-[#06080d] text-[#fcfcfa]">
      <JourneyIconRail />

      <main className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#0d1018] bg-[#0a0d14] px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-[#365eff] md:hidden">
              <Sparkles className="h-4 w-4 text-white" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-medium text-[#fcfcfa]">
                AI-GOS Journey
              </h1>
              <p className="truncate text-xs text-[#8e97a6]">
                company corpus before GTM synthesis
              </p>
            </div>
          </div>

          <span
            className={cn(
              'inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-medium',
              isError
                ? 'border-red-500/25 bg-red-500/10 text-red-300'
                : isComplete
                  ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                  : 'border-[#365eff]/20 bg-[#365eff]/10 text-[#8faaff]',
            )}
          >
            {isError ? (
              <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
            ) : isComplete ? (
              <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            )}
            {isError ? 'research failed' : isComplete ? 'corpus ready' : 'agent writing'}
          </span>
        </header>

        <section className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[860px] px-6 py-8">
            <div className="space-y-8">
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-[8px] border border-[#14171f] bg-[#0d1018] px-6 py-4">
                  <p className="break-words text-[#fcfcfa]">{websiteUrl}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#365eff]">
                    <Sparkles className="h-4 w-4 text-white" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-4">
                    <motion.div
                      data-testid="deep-research-agent-view"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25 }}
                      className="rounded-[8px] border border-[#14171f] bg-[#0d1018]"
                    >
                      <div className="flex items-center gap-2 border-b border-[#14171f] px-5 py-4 text-sm text-[#8e97a6]">
                        <ChevronDown className="h-4 w-4" aria-hidden="true" />
                        <span>Research & thinking</span>
                        <span className="ml-auto rounded-full border border-[#365eff]/20 bg-[#365eff]/10 px-2.5 py-1 text-xs text-[#8faaff]">
                          {activityStatus}
                        </span>
                      </div>

                      <div className="space-y-3 px-5 py-4">
                        {steps.map((step) => (
                          <div key={step.id} className="flex items-start gap-2">
                            {step.status === 'complete' ? (
                              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#50f8e4]" aria-hidden="true" />
                            ) : step.status === 'loading' ? (
                              <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-[#365eff]" aria-hidden="true" />
                            ) : step.status === 'error' ? (
                              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" aria-hidden="true" />
                            ) : (
                              <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-white/18" />
                            )}
                            <div className="min-w-0">
                              <p className="text-sm text-[#fcfcfa]">{step.label}</p>
                              <p className="mt-1 text-xs leading-5 text-[#8e97a6]">
                                {step.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="border-t border-[#14171f] bg-black/20 px-5 py-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-xs text-[#8e97a6]">Activity stream</p>
                          {deepResearchActivity?.jobId ? (
                            <span className="truncate text-xs text-[#8e97a6]">
                              {deepResearchActivity.jobId}
                            </span>
                          ) : null}
                        </div>
                        {updates.length > 0 ? (
                          <ol className="space-y-2">
                            {updates.map((update) => (
                              <li
                                key={update.id}
                                className="grid grid-cols-[72px_1fr] gap-3 text-xs leading-5"
                              >
                                <span className="uppercase text-[#8e97a6]">
                                  {update.phase}
                                </span>
                                <span className="min-w-0 break-words text-[#fcfcfa]/78">
                                  {update.message}
                                </span>
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <p className="text-xs leading-5 text-[#8e97a6]">
                            Waiting for the worker heartbeat. Tool and analysis
                            updates will appear here as the deep research job runs.
                          </p>
                        )}
                      </div>
                    </motion.div>

                    <div className="space-y-3">
                      <p className="text-sm leading-6 text-[#fcfcfa]">
                        {isError
                          ? `Deep research failed before workspace launch: ${deepResearchError ?? 'Unknown error'}`
                          : isComplete
                            ? `Company corpus is ready with ${fieldCount} source-backed profile fields. Opening the Journey workspace.`
                            : 'Building the company corpus before any report section starts.'}
                      </p>

                      {visibleFields.length > 0 ? (
                        <div className="rounded-[8px] border border-[#14171f] bg-[#0d1018]">
                          <div className="border-b border-[#14171f] px-5 py-3">
                            <p className="text-xs text-[#8e97a6]">
                              Deep research profile fields
                            </p>
                          </div>
                          <div className="grid gap-2 p-3">
                            {visibleFields.map((field) => (
                              <div
                                key={field.key}
                                data-testid={`prefill-field-${field.key}`}
                                data-field-key={field.key}
                                className="rounded-[8px] border border-[#14171f] bg-[#0a0d14] px-4 py-3"
                              >
                                <p className="text-xs text-[#8e97a6]">{field.label}</p>
                                <p className="mt-1 break-words text-sm leading-6 text-[#fcfcfa]">
                                  {field.value}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {isError ? (
                        <button
                          type="button"
                          onClick={onRetry}
                          className="inline-flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 text-sm text-[#fcfcfa] transition-colors hover:bg-white/[0.07]"
                        >
                          <RotateCcw className="h-4 w-4" aria-hidden="true" />
                          Try another URL
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
