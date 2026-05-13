'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { AlertCircle, ChevronDown, ChevronRight, RotateCcw, X } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

export interface ZoneErrorCardProps {
  zoneId: string;
  zoneTitle: string;
  errorMessage: string | null;
  partialNarrative: string | null;
  partialAt: number | null;
  isRetrying?: boolean;
  onRetry: (opts: { usePartialContext: boolean }) => void | Promise<void>;
  onCancel?: () => void | Promise<void>;
  className?: string;
}

export function ZoneErrorCard({
  zoneTitle,
  errorMessage,
  partialNarrative,
  partialAt,
  isRetrying = false,
  onRetry,
  onCancel,
  className,
}: ZoneErrorCardProps) {
  const [partialOpen, setPartialOpen] = useState(false);
  const hasPartial = !!partialNarrative && partialNarrative.trim().length > 0;
  const partialPct =
    typeof partialAt === 'number' && Number.isFinite(partialAt)
      ? Math.max(0, Math.min(100, Math.round(partialAt)))
      : null;

  return (
    <Alert variant="destructive" className={cn('space-y-3', className)}>
      <AlertCircle className="size-4" />
      <AlertTitle className="text-sm font-semibold">
        {zoneTitle} failed
        {partialPct !== null ? (
          <span className="ml-2 font-normal opacity-80">
            ({partialPct}% complete)
          </span>
        ) : null}
      </AlertTitle>
      <AlertDescription className="space-y-3">
        {errorMessage ? (
          <p className="text-xs leading-relaxed">{errorMessage}</p>
        ) : (
          <p className="text-xs leading-relaxed opacity-80">
            The runner did not return a complete envelope. You can retry from
            scratch or use the partial output as starting context.
          </p>
        )}

        {hasPartial ? (
          <Collapsible open={partialOpen} onOpenChange={setPartialOpen}>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium hover:underline">
              {partialOpen ? (
                <ChevronDown className="size-3" />
              ) : (
                <ChevronRight className="size-3" />
              )}
              {partialOpen ? 'Hide' : 'Show'} partial output
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className="prose prose-sm max-w-none rounded border border-destructive/30 bg-background/50 p-2 dark:prose-invert">
                <ReactMarkdown>{partialNarrative ?? ''}</ReactMarkdown>
              </div>
            </CollapsibleContent>
          </Collapsible>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            disabled={isRetrying}
            onClick={() => void onRetry({ usePartialContext: false })}
          >
            <RotateCcw className="size-3" />
            Retry this section
          </Button>
          {hasPartial ? (
            <Button
              size="sm"
              variant="outline"
              disabled={isRetrying}
              onClick={() => void onRetry({ usePartialContext: true })}
            >
              <RotateCcw className="size-3" />
              Retry with partial as context
            </Button>
          ) : null}
          {onCancel ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={isRetrying}
              onClick={() => void onCancel()}
            >
              <X className="size-3" />
              Cancel
            </Button>
          ) : null}
        </div>
      </AlertDescription>
    </Alert>
  );
}
