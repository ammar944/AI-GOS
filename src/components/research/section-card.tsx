'use client';

import type { ReactElement } from 'react';
import { useState } from 'react';
import { Copy, Loader2, RefreshCw } from 'lucide-react';
import type { ResearchJobActivity } from '@/lib/journey/research-job-activity';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type {
  PipelineSectionId,
  SectionStatus,
} from '@/lib/research/pipeline-types';

export interface SectionCardProps {
  sectionId: PipelineSectionId;
  displayName: string;
  status: SectionStatus;
  data?: Record<string, unknown>;
  activity?: ResearchJobActivity;
  error?: string;
  isGated: boolean;
  isActive?: boolean;
  isBusy?: boolean;
  onOpenChat: () => void;
  onApprove: () => void;
  onRetry?: () => void;
}

function getStatusLabel(status: SectionStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'queued':
      return 'Queued';
    case 'running':
      return 'Running';
    case 'complete':
      return 'Ready for review';
    case 'approved':
      return 'Approved';
    case 'editing':
      return 'Editing';
    case 'stale':
      return 'Stale';
    case 'error':
      return 'Error';
    default:
      return status;
  }
}

function getPreview(data: Record<string, unknown> | undefined): string | null {
  if (!data) {
    return null;
  }

  return JSON.stringify(data, null, 2).slice(0, 700);
}

export function SectionCard({
  sectionId,
  displayName,
  status,
  data,
  activity,
  error,
  isGated,
  isActive = false,
  isBusy = false,
  onOpenChat,
  onApprove,
  onRetry,
}: SectionCardProps): ReactElement {
  const [isCopying, setIsCopying] = useState(false);
  const latestActivityMessage =
    activity?.updates?.at(-1)?.message ?? 'Research worker is warming up.';
  const preview = getPreview(data);

  const handleCopy = async (): Promise<void> => {
    if (!data || typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }

    try {
      setIsCopying(true);
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    } finally {
      window.setTimeout(() => {
        setIsCopying(false);
      }, 800);
    }
  };

  return (
    <section
      className={cn(
        'rounded-3xl border p-5 transition-all',
        status === 'pending' && 'border-zinc-800 opacity-40',
        (status === 'queued' || status === 'running') &&
          'border-blue-500/50 bg-blue-500/5',
        status === 'complete' && 'border-zinc-600',
        status === 'approved' && 'border-green-500/30 bg-green-500/5',
        status === 'editing' && 'border-purple-500/50 bg-purple-500/5',
        status === 'stale' && 'border-amber-500/50 bg-amber-500/5',
        status === 'error' && 'border-red-500/50 bg-red-500/5',
        isActive && 'ring-1 ring-zinc-500/60',
        isGated && 'ring-2 ring-blue-500/40',
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              {sectionId}
            </p>
            <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-zinc-400">
              {getStatusLabel(status)}
            </span>
            {status === 'stale' ? (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-amber-300">
                Needs rerun
              </span>
            ) : null}
          </div>
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-zinc-50">
              {displayName}
            </h3>
            <p className="mt-1 text-sm text-zinc-400">
              {status === 'running' || status === 'queued'
                ? latestActivityMessage
                : status === 'error'
                  ? error ?? 'Research failed before the artifact was finalized.'
                  : 'Review the current artifact state and decide whether to advance.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {data ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void handleCopy();
              }}
              className="border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-50"
            >
              <Copy className="h-4 w-4" />
              {isCopying ? 'Copied' : 'Copy'}
            </Button>
          ) : null}

          {status === 'error' && onRetry ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="border-red-500/40 bg-red-500/5 text-red-200 hover:bg-red-500/10 hover:text-red-50"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          ) : null}
        </div>
      </div>

      {status === 'queued' || status === 'running' ? (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-blue-500/20 bg-zinc-950/70 px-4 py-3 text-sm text-zinc-300">
          <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
          <span>{latestActivityMessage}</span>
        </div>
      ) : null}

      {preview ? (
        <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
          <pre className="overflow-hidden whitespace-pre-wrap break-words text-xs leading-6 text-zinc-300">
            {preview}
          </pre>
        </div>
      ) : null}

      {isGated && status === 'complete' ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            onClick={onApprove}
            disabled={isBusy}
            className="bg-green-600 text-white hover:bg-green-500"
          >
            Looks good
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onOpenChat}
            disabled={isBusy}
            className="border-zinc-700 bg-zinc-950 text-zinc-200 hover:border-zinc-600 hover:bg-zinc-900 hover:text-zinc-50"
          >
            Refine
          </Button>
        </div>
      ) : null}
    </section>
  );
}
