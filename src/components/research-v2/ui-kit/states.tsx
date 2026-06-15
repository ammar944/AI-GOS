'use client';

import { AlertTriangle, Copy, Lock, RefreshCw } from 'lucide-react';

import type { ReaderSectionStatus } from './status';

export function QueuedState(): React.ReactElement {
  return (
    <div className="border-l-2 border-dashed border-border pl-4 text-[14px] text-muted-foreground">
      Queued — your audit is already running; this section starts as soon as a lane frees up.
    </div>
  );
}

export function LockedState({ text }: { text: string }): React.ReactElement {
  return (
    <div className="flex items-center gap-2.5 border-l-2 border-border pl-4 text-[14px] text-muted-foreground">
      <Lock className="size-4 text-muted-foreground/60" />
      {text}
    </div>
  );
}

export function ErrorStateBlock({
  onRerun,
  pending,
  status,
}: {
  onRerun?: () => void;
  pending?: boolean;
  status?: ReaderSectionStatus;
}): React.ReactElement {
  const isAborted = status === 'aborted';

  return (
    <div className="border-l-2 border-red-500 pl-4">
      <div className="flex items-center gap-2 text-[14px] font-medium text-red-600">
        <AlertTriangle className="size-4" />
        {isAborted ? 'Aborted' : 'Couldn’t complete this section'}
      </div>
      <p className="mt-1.5 max-w-[60ch] text-[14px] leading-[1.55] text-muted-foreground">
        {isAborted
          ? 'This section was aborted. You can rerun it without restarting the rest of the audit.'
          : 'This section didn’t finish. You can rerun it without restarting the rest of the audit.'}
      </p>
      {onRerun ? (
        <button
          type="button"
          onClick={onRerun}
          disabled={pending}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[12px] text-foreground transition-colors hover:bg-muted disabled:opacity-40"
        >
          <RefreshCw className="size-3.5" />
          Rerun section
        </button>
      ) : null}
    </div>
  );
}

export function SectionActions({
  onCopy,
  onRerun,
  copied,
  copyError,
  rerunPending,
  disabled,
}: {
  onCopy?: () => void;
  onRerun?: () => void;
  copied?: boolean;
  copyError?: boolean;
  rerunPending?: boolean;
  disabled?: boolean;
}): React.ReactElement {
  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={onCopy}
        disabled={disabled || !onCopy}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
      >
        <Copy className="size-3.5" />
        {copyError ? 'Copy failed' : copied ? 'Copied' : 'Copy'}
      </button>
      <button
        type="button"
        onClick={onRerun}
        disabled={disabled || rerunPending || !onRerun}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
      >
        <RefreshCw className="size-3.5" />
        Rerun
      </button>
    </div>
  );
}
