'use client';

import { Check, X, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SECTION_LABELS } from '@/lib/ai/chat-tools/utils';

const STYLE_LABELS: Record<string, string> = {
  enhance: 'Enhance',
  simplify: 'Simplify',
  rewrite: 'Rewrite',
  expand: 'Expand',
};

interface GenerateSectionCardProps {
  section: string;
  instruction: string;
  style: string;
  oldContent: unknown;
  newContent: unknown;
  diffPreview: string;
  onApprove?: () => void;
  onReject?: () => void;
  isApproved?: boolean;
  isRejected?: boolean;
}

function DiffLine({ line }: { line: string }) {
  const isRemoval = line.startsWith('-');
  const isAddition = line.startsWith('+');

  const lineClass = isRemoval
    ? 'text-destructive line-through opacity-85'
    : isAddition
      ? 'text-emerald-500'
      : 'text-muted-foreground';

  return (
    <div className={`font-mono text-[11px] leading-[1.6] ${lineClass}`}>
      {line}
    </div>
  );
}

export function GenerateSectionCard({
  section,
  instruction,
  style,
  // oldContent/newContent reserved for future rich diff view
  oldContent: _oldContent, // eslint-disable-line @typescript-eslint/no-unused-vars
  newContent: _newContent, // eslint-disable-line @typescript-eslint/no-unused-vars
  diffPreview,
  onApprove,
  onReject,
  isApproved = false,
  isRejected = false,
}: GenerateSectionCardProps) {
  const sectionLabel = SECTION_LABELS[section] || section;
  const styleLabel = STYLE_LABELS[style] || style;
  const showActions = !isApproved && !isRejected && (onApprove || onReject);
  const diffLines = diffPreview.split('\n');

  return (
    <div className="my-2 rounded-md border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-amber-500/5">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 flex-shrink-0 text-amber-500" />
            <span className="font-semibold uppercase tracking-wider text-[11px] text-amber-500">
              Section Rewrite
            </span>
          </div>
          {/* Style badge */}
          <span className="rounded-full px-2 py-0.5 font-medium flex-shrink-0 text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/25">
            {styleLabel}
          </span>
        </div>

        {/* Section name */}
        <p className="font-medium text-[13px] text-foreground">{sectionLabel}</p>

        {/* Instruction */}
        {instruction && (
          <p className="mt-1 text-xs text-muted-foreground">{instruction}</p>
        )}
      </div>

      {/* Diff view */}
      {diffPreview && (
        <div className="mx-4 my-3 rounded-md p-3 overflow-auto max-h-[200px] bg-background/40 border border-border">
          {diffLines.map((line, i) => (
            <DiffLine key={i} line={line} />
          ))}
        </div>
      )}

      {/* Action area */}
      <div className="px-4 pb-4">
        {showActions && (
          <div className="flex gap-2">
            {onApprove && (
              <Button onClick={onApprove} className="flex-1">
                <Check className="w-3.5 h-3.5" />
                Approve (Y)
              </Button>
            )}
            {onReject && (
              <Button onClick={onReject} variant="outline" className="flex-1">
                <X className="w-3.5 h-3.5" />
                Reject (N)
              </Button>
            )}
          </div>
        )}

        {isApproved && (
          <div className="flex items-center justify-center gap-1.5 rounded-full py-1.5 px-4 bg-emerald-500/10 border border-emerald-500/25">
            <Check className="w-3.5 h-3.5 text-emerald-500" />
            <span className="font-medium text-xs text-emerald-500">Section rewritten</span>
          </div>
        )}

        {isRejected && (
          <p className="text-center text-xs text-muted-foreground">Rejected</p>
        )}
      </div>
    </div>
  );
}
