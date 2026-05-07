'use client';

import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import type { UseJourneyPrefillReturn } from '@/hooks/use-journey-prefill';
import type { ResearchJobActivity } from '@/lib/journey/research-job-activity';
import { JOURNEY_PREFILL_REVIEW_FIELDS } from '@/lib/journey/field-catalog';
import { formatJourneyErrorMessage } from '@/lib/journey/http';
import { readJourneyPrefillFieldValue } from '@/lib/journey/prefill-fields';
import { cn } from '@/lib/utils';

interface PrefillStreamField {
  key: string;
  label: string;
  value: string;
}

export interface PrefillStreamViewProps {
  partialResult: UseJourneyPrefillReturn['partialResult'];
  fieldsFound: number;
  isPrefilling: boolean;
  error: Error | undefined;
  websiteUrl: string;
  deepResearchFields?: Record<string, string>;
  deepResearchStatus?: 'idle' | 'starting' | 'queued' | 'complete' | 'error';
  deepResearchError?: string | null;
  deepResearchActivity?: ResearchJobActivity;
  onRetry: () => void;
  onComplete: (editedFields: Record<string, string>) => void;
}

interface DeepResearchAgentStep {
  label: string;
  detail: string;
}

type DeepResearchStepState = 'complete' | 'active' | 'queued' | 'error';

const DEEP_RESEARCH_AGENT_STEPS: DeepResearchAgentStep[] = [
  {
    label: 'Inspect source',
    detail: 'Read the submitted website and source context.',
  },
  {
    label: 'Build corpus',
    detail: 'Collect category, audience, offer, competitor, and evidence signals.',
  },
  {
    label: 'Extract fields',
    detail: 'Materialize onboarding context from the corpus.',
  },
  {
    label: 'Prepare sections',
    detail: 'Stage the workspace for section-by-section synthesis.',
  },
];

function getDeepResearchStepState(
  status: PrefillStreamViewProps['deepResearchStatus'],
  stepIndex: number,
): DeepResearchStepState {
  if (status === 'complete') {
    return 'complete';
  }

  if (status === 'error') {
    return stepIndex === 0 ? 'error' : 'queued';
  }

  if (status === 'queued') {
    return stepIndex <= 1 ? 'active' : 'queued';
  }

  if (status === 'starting') {
    return stepIndex === 0 ? 'active' : 'queued';
  }

  return 'queued';
}

function formatActivityPhase(
  phase: NonNullable<ResearchJobActivity['updates']>[number]['phase'],
): string {
  return phase;
}

function getDeepResearchActivityUpdates(
  activity: ResearchJobActivity | undefined,
): NonNullable<ResearchJobActivity['updates']> {
  return [...(activity?.updates ?? [])]
    .sort((left, right) => left.at.localeCompare(right.at))
    .slice(-5);
}

function getDeepResearchActivityStatus(
  status: PrefillStreamViewProps['deepResearchStatus'],
  activity: ResearchJobActivity | undefined,
): string {
  if (activity?.status === 'running') {
    return 'running';
  }

  if (activity?.status === 'complete' || status === 'complete') {
    return 'complete';
  }

  if (activity?.status === 'error' || status === 'error') {
    return 'error';
  }

  if (status === 'queued') {
    return 'queued';
  }

  return 'starting';
}

function resolveVisibleFields(
  partialResult: PrefillStreamViewProps['partialResult'],
  deepResearchFields: Record<string, string>,
): PrefillStreamField[] {
  const record = partialResult as Record<string, unknown> | null | undefined;
  const fieldValues: Record<string, string> = {};
  const fields: PrefillStreamField[] = [];

  for (const { key } of JOURNEY_PREFILL_REVIEW_FIELDS) {
    const value = readJourneyPrefillFieldValue(record, key);
    if (!value) {
      continue;
    }

    fieldValues[key] = value;
  }

  for (const [key, value] of Object.entries(deepResearchFields)) {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      fieldValues[key] = trimmed;
    }
  }

  for (const { key, label } of JOURNEY_PREFILL_REVIEW_FIELDS) {
    const value = fieldValues[key];
    if (value) {
      fields.push({ key, label, value });
    }
  }

  return fields;
}

export function PrefillStreamView({
  partialResult,
  isPrefilling,
  error,
  websiteUrl,
  deepResearchFields = {},
  deepResearchStatus = 'idle',
  deepResearchError,
  deepResearchActivity,
  onRetry,
  onComplete,
}: PrefillStreamViewProps) {
  const confidenceNotes =
    partialResult && typeof partialResult.confidenceNotes === 'string'
      ? partialResult.confidenceNotes
      : null;
  const renderedError = useMemo(
    () => formatJourneyErrorMessage(error),
    [error],
  );
  const visibleFields = resolveVisibleFields(partialResult, deepResearchFields);
  const visibleFieldCount = visibleFields.length;
  const requiresDeepResearch = deepResearchStatus !== 'idle';
  const isDeepResearchComplete = !requiresDeepResearch || deepResearchStatus === 'complete';
  const isDeepResearchFailed = deepResearchStatus === 'error';
  const deepResearchFieldCount = Object.values(deepResearchFields).filter(
    (value) => value.trim().length > 0,
  ).length;
  const hasAuthoritativeDeepFields =
    requiresDeepResearch && isDeepResearchComplete && deepResearchFieldCount > 0;
  const isCollectingFields = isPrefilling && !hasAuthoritativeDeepFields;
  const effectiveError = hasAuthoritativeDeepFields ? undefined : error;
  const progressPct =
    visibleFieldCount > 0
      ? Math.min(100, Math.round((visibleFieldCount / 20) * 100))
      : 0;
  const isComplete = !isCollectingFields && visibleFieldCount > 0 && !effectiveError;
  const isFailed = !isCollectingFields && visibleFieldCount === 0 && !effectiveError;
  const hasRequiredDeepFields = !requiresDeepResearch || deepResearchFieldCount > 0;
  const canReviewOnboarding =
    isComplete && isDeepResearchComplete && hasRequiredDeepFields;
  const deepResearchActivityUpdates =
    getDeepResearchActivityUpdates(deepResearchActivity);
  const deepResearchActivityStatus = getDeepResearchActivityStatus(
    deepResearchStatus,
    deepResearchActivity,
  );
  const getFieldPayload = (): Record<string, string> =>
    Object.fromEntries(
      visibleFields.map((field) => [field.key, field.value]),
    );

  return (
    <section className="flex-1 overflow-y-auto custom-scrollbar px-6 sm:px-8 pb-16">
      <div className="max-w-xl mx-auto flex flex-col pt-10 sm:pt-14 gap-8">
        {/* Header */}
        <motion.div
          className="flex flex-col gap-4"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.21, 0.45, 0.27, 0.9] }}
        >
          {/* Status badge */}
          <div
            className={cn(
              'inline-flex self-start items-center gap-2 rounded-full px-3.5 py-1.5',
              isComplete
                ? 'border border-emerald-500/25 bg-emerald-500/[0.08]'
                : isFailed || effectiveError
                  ? 'border border-red-500/25 bg-red-500/[0.08]'
                  : 'border border-[var(--accent-amber)]/30 bg-[var(--accent-amber)]/[0.06]',
            )}
          >
            <motion.div
              className={cn(
                'w-1.5 h-1.5 rounded-full',
                isComplete
                  ? 'bg-emerald-400'
                  : isFailed || effectiveError
                    ? 'bg-red-400'
                    : 'bg-[var(--accent-amber)]',
              )}
              animate={isCollectingFields ? { opacity: [1, 0.3, 1] } : { opacity: 1 }}
              transition={{
                duration: 1.6,
                repeat: isCollectingFields ? Infinity : 0,
                ease: 'easeInOut',
              }}
            />
            <span
              className={cn(
                'text-[11px] font-mono uppercase tracking-[0.16em]',
                isComplete
                  ? 'text-emerald-400'
                  : isFailed || effectiveError
                    ? 'text-red-400'
                    : 'text-[var(--accent-amber)]',
              )}
            >
              {isComplete ? 'Extraction Complete' : isFailed || effectiveError ? 'Extraction Failed' : 'Extracting Context'}
            </span>
          </div>

          {/* Headline */}
          <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-[-0.03em] text-foreground">
            {isComplete ? 'Context extracted' : isFailed ? 'No data found' : 'Analyzing your footprint'}
          </h2>

          {/* URL + counter */}
          <div className="flex items-baseline gap-3 flex-wrap">
            <p className="text-[12px] font-mono text-[var(--text-tertiary)] break-all">
              {websiteUrl}
            </p>
            <span
              className={cn(
                'text-[12px] font-mono tabular-nums',
                isComplete ? 'text-[var(--accent-green)]' : 'text-[var(--accent-amber)]',
              )}
            >
              {visibleFieldCount} {visibleFieldCount === 1 ? 'field' : 'fields'} found
            </span>
          </div>
        </motion.div>

        {/* Progress bar */}
        <div className="w-full rounded-full overflow-hidden h-[2px] bg-[var(--bg-hover)]">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: isComplete
                ? 'rgb(34, 197, 94)'
                : 'var(--accent-amber)',
              boxShadow: isComplete
                ? '0 0 8px rgba(34, 197, 94, 0.3)'
                : '0 0 8px rgba(54, 94, 255, 0.3)',
            }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>

        {requiresDeepResearch && (
          <div
            className={cn(
              'rounded-[8px] border px-5 py-4',
              isDeepResearchFailed
                ? 'border-red-500/25 bg-red-500/[0.07]'
                : isDeepResearchComplete
                  ? 'border-emerald-500/25 bg-emerald-500/[0.07]'
                  : 'border-[var(--accent-amber)]/25 bg-[var(--accent-amber)]/[0.06]',
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                  isDeepResearchFailed
                    ? 'bg-red-400'
                    : isDeepResearchComplete
                      ? 'bg-emerald-400'
                      : 'bg-[var(--accent-amber)]',
                )}
              />
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-quaternary)]">
                  Company deep research
                </p>
                <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                  {isDeepResearchFailed
                    ? `Deep research failed before workspace launch: ${deepResearchError ?? 'Unknown error'}`
                    : isDeepResearchComplete
                      ? deepResearchFieldCount > 0
                        ? `Company corpus is ready with ${deepResearchFieldCount} deep-research fields. Opening workspace next.`
                        : 'Company corpus finished without onboardingFields. Fix the deep research result before workspace launch.'
                      : 'Building the company corpus before workspace opens.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {requiresDeepResearch && (
          <div
            data-testid="deep-research-agent-view"
            className="overflow-hidden rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-surface)]"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-4">
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-quaternary)]">
                  Deep research agent
                </p>
                <h3 className="mt-1 truncate text-sm font-semibold text-[var(--text-primary)]">
                  Company corpus run
                </h3>
              </div>
              <span
                className={cn(
                  'shrink-0 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em]',
                  deepResearchActivityStatus === 'complete'
                    ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                    : deepResearchActivityStatus === 'error'
                      ? 'border-red-500/25 bg-red-500/10 text-red-300'
                      : 'border-[#365eff]/25 bg-[#365eff]/10 text-[#8faaff]',
                )}
              >
                {deepResearchActivityStatus}
              </span>
            </div>

            <div className="grid gap-2 px-5 py-4">
              {DEEP_RESEARCH_AGENT_STEPS.map((step, index) => {
                const state = getDeepResearchStepState(deepResearchStatus, index);

                return (
                  <div
                    key={step.label}
                    className="grid grid-cols-[16px_1fr] gap-3"
                  >
                    <span
                      className={cn(
                        'mt-1.5 h-2.5 w-2.5 rounded-full',
                        state === 'complete'
                          ? 'bg-emerald-400'
                          : state === 'error'
                            ? 'bg-red-400'
                            : state === 'active'
                              ? 'bg-[#365eff]'
                              : 'bg-white/18',
                      )}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-[var(--text-primary)]">
                        {step.label}
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-[var(--text-tertiary)]">
                        {step.detail}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-[var(--border-subtle)] bg-black/20 px-5 py-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-quaternary)]">
                  Activity stream
                </p>
                {deepResearchActivity?.jobId && (
                  <span className="truncate font-mono text-[10px] text-[var(--text-quaternary)]">
                    {deepResearchActivity.jobId}
                  </span>
                )}
              </div>

              {deepResearchActivityUpdates.length > 0 ? (
                <ol className="space-y-2">
                  {deepResearchActivityUpdates.map((update) => (
                    <li
                      key={update.id}
                      className="grid grid-cols-[68px_1fr] gap-3 font-mono text-[11px] leading-5"
                    >
                      <span className="uppercase text-[var(--text-quaternary)]">
                        {formatActivityPhase(update.phase)}
                      </span>
                      <span className="min-w-0 break-words text-[var(--text-secondary)]">
                        {update.message}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="font-mono text-[11px] leading-5 text-[var(--text-quaternary)]">
                  Waiting for the worker heartbeat. The deep research job will stream tool and analysis updates here as soon as the worker writes them.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Content card */}
        <div className="rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-surface)] backdrop-blur-sm overflow-hidden">
          {/* Error state */}
          {effectiveError && (
            <div className="px-6 py-6 flex flex-col items-center gap-3 text-center">
              <AlertCircle className="size-5 text-red-400" />
              <p className="text-sm text-red-400/90">{renderedError}</p>
            </div>
          )}

          {/* Empty/failed state */}
          {isFailed && (
            <div className="px-6 py-8 flex flex-col items-center gap-4 text-center">
              <div className="w-10 h-10 rounded-xl bg-[var(--bg-hover)] flex items-center justify-center">
                <AlertCircle className="size-5 text-[var(--text-quaternary)]" />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-sm">
                  We couldn&apos;t find usable public details for{' '}
                  <span className="text-[var(--text-primary)] font-medium">{websiteUrl}</span>.
                  Double-check the URL and TLD, then try again.
                </p>
                {confidenceNotes && (
                  <p className="text-[12px] text-[var(--text-quaternary)] leading-relaxed max-w-sm">
                    {confidenceNotes}
                  </p>
                )}
              </div>
              <button
                onClick={onRetry}
                className="cursor-pointer inline-flex items-center gap-2 rounded-full bg-foreground text-background text-[13px] font-semibold px-5 h-9 transition-all hover:bg-foreground/90 mt-2"
              >
                <RotateCcw className="size-3.5" />
                Try another URL
              </button>
            </div>
          )}

          {/* Loading skeleton */}
          {isCollectingFields && visibleFieldCount === 0 && !effectiveError && (
            <div className="p-4 space-y-1">
              {[1, 2, 3, 4].map((index) => (
                <div
                  key={index}
                  className="rounded-xl px-4 py-3.5 animate-pulse"
                  style={{ animationDelay: `${index * 200}ms` }}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full shrink-0 mt-1 bg-[var(--bg-hover)]" />
                    <div className="flex-1 space-y-2.5">
                      <div className="h-2.5 w-24 rounded bg-[var(--bg-hover)]" />
                      <div
                        className="h-4 rounded bg-[var(--bg-hover)]"
                        style={{ width: `${45 + index * 12}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Extracted fields */}
          {visibleFields.length > 0 && (
            <div className="p-3 space-y-1">
              {visibleFields.map((field) => (
                <div
                  key={field.key}
                  data-testid={`prefill-field-${field.key}`}
                  data-field-key={field.key}
                  className="flex items-start gap-3 rounded-xl px-4 py-3 border border-[var(--border-glass)] bg-[var(--bg-surface)]"
                >
                  <div className="w-2 h-2 rounded-full shrink-0 mt-1.5 bg-emerald-400" />
                  <div className="min-w-0 flex-1">
                    <span className="block text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--text-quaternary)]">
                      {field.label}
                    </span>
                    <p className="text-sm mt-0.5 break-words whitespace-pre-wrap leading-relaxed text-[var(--text-secondary)]">
                      {field.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Complete CTA */}
        {canReviewOnboarding && (
          <motion.div
            className="flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <button
              type="button"
              data-testid="prefill-review-button"
              onClick={() => onComplete(getFieldPayload())}
              className="cursor-pointer h-11 rounded-full bg-foreground text-background font-semibold text-[14px] px-7 transition-all duration-200 hover:bg-foreground/90 hover:shadow-lg"
            >
              Review onboarding fields
            </button>
          </motion.div>
        )}

        {isComplete && requiresDeepResearch && !isDeepResearchComplete && !isDeepResearchFailed && (
          <motion.div
            className="flex flex-col items-center gap-2 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <p className="text-sm text-[var(--text-secondary)]">
              Onboarding fields are extracted. Waiting for company deep research before workspace opens.
            </p>
            <span className="text-[11px] text-[var(--text-quaternary)]">
              The report sections stay locked until the corpus and profile are ready.
            </span>
          </motion.div>
        )}

        {isComplete && isDeepResearchFailed && (
          <motion.div
            className="flex flex-col items-center gap-3 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <p className="max-w-sm text-sm leading-6 text-red-400/90">
              Fix the deep research run before workspace synthesis so sections do not start from shallow context.
            </p>
            <button
              onClick={onRetry}
              className="cursor-pointer inline-flex h-9 items-center gap-2 rounded-full bg-foreground px-5 text-[13px] font-semibold text-background transition-all hover:bg-foreground/90"
            >
              <RotateCcw className="size-3.5" />
              Try another URL
            </button>
          </motion.div>
        )}

        {/* Early continue */}
        {isCollectingFields && visibleFieldCount >= 5 && isDeepResearchComplete && hasRequiredDeepFields && (
          <motion.div
            className="flex flex-col items-center gap-3"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <button
              type="button"
              data-testid="prefill-continue-early-button"
              onClick={() => onComplete(getFieldPayload())}
              className="cursor-pointer h-11 rounded-full bg-foreground text-background font-semibold text-[14px] px-7 transition-all duration-200 hover:bg-foreground/90 hover:shadow-lg"
            >
              Continue with {visibleFieldCount} fields
            </button>
            <span className="text-[11px] text-[var(--text-quaternary)]">
              Continue to complete the onboarding profile before section synthesis starts
            </span>
          </motion.div>
        )}
      </div>
    </section>
  );
}
