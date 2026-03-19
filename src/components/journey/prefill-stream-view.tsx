'use client';

import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import type { UseJourneyPrefillReturn } from '@/hooks/use-journey-prefill';
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
  onRetry: () => void;
  onComplete: (editedFields: Record<string, string>) => void;
}

function resolveVisibleFields(
  partialResult: PrefillStreamViewProps['partialResult'],
): PrefillStreamField[] {
  const record = partialResult as Record<string, unknown> | null | undefined;
  const fields: PrefillStreamField[] = [];

  for (const { key, label } of JOURNEY_PREFILL_REVIEW_FIELDS) {
    const value = readJourneyPrefillFieldValue(record, key);
    if (!value) {
      continue;
    }

    fields.push({ key, label, value });
  }

  return fields;
}

export function PrefillStreamView({
  partialResult,
  fieldsFound,
  isPrefilling,
  error,
  websiteUrl,
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
  const progressPct = fieldsFound > 0 ? Math.min(100, Math.round((fieldsFound / 20) * 100)) : 0;
  const isComplete = !isPrefilling && fieldsFound > 0 && !error;
  const isFailed = !isPrefilling && fieldsFound === 0 && !error;
  const visibleFields = resolveVisibleFields(partialResult);
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
                : isFailed || error
                  ? 'border border-red-500/25 bg-red-500/[0.08]'
                  : 'border border-[var(--accent-blue)]/20 bg-[var(--accent-blue)]/[0.06]',
            )}
          >
            <motion.div
              className={cn(
                'w-1.5 h-1.5 rounded-full',
                isComplete
                  ? 'bg-emerald-400'
                  : isFailed || error
                    ? 'bg-red-400'
                    : 'bg-[var(--accent-blue)]',
              )}
              animate={isPrefilling ? { opacity: [1, 0.3, 1] } : { opacity: 1 }}
              transition={{
                duration: 1.6,
                repeat: isPrefilling ? Infinity : 0,
                ease: 'easeInOut',
              }}
            />
            <span
              className={cn(
                'text-[11px] font-mono uppercase tracking-[0.16em]',
                isComplete
                  ? 'text-emerald-400'
                  : isFailed || error
                    ? 'text-red-400'
                    : 'text-[var(--accent-blue)]',
              )}
            >
              {isComplete ? 'Extraction Complete' : isFailed || error ? 'Extraction Failed' : 'Extracting Context'}
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
                isComplete ? 'text-emerald-400' : 'text-[var(--accent-blue)]',
              )}
            >
              {fieldsFound} {fieldsFound === 1 ? 'field' : 'fields'} found
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
                : 'linear-gradient(90deg, var(--accent-blue) 0%, rgb(0, 111, 255) 100%)',
              boxShadow: isComplete
                ? '0 0 8px rgba(34, 197, 94, 0.3)'
                : '0 0 8px rgba(54, 94, 255, 0.3)',
            }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>

        {/* Content card */}
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] backdrop-blur-sm overflow-hidden">
          {/* Error state */}
          {error && (
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
          {isPrefilling && fieldsFound === 0 && !error && (
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
                  <div className="w-2 h-2 rounded-full shrink-0 mt-1.5 bg-emerald-400 shadow-[0_0_6px_rgba(34,197,94,0.3)]" />
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
        {isComplete && (
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
              Review extracted fields
            </button>
          </motion.div>
        )}

        {/* Early continue */}
        {isPrefilling && fieldsFound >= 5 && (
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
              Continue with {fieldsFound} fields
            </button>
            <span className="text-[11px] text-[var(--text-quaternary)]">
              Still extracting — you can review now and fill the rest manually
            </span>
          </motion.div>
        )}
      </div>
    </section>
  );
}
