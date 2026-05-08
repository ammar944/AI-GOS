'use client';

import { Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SECTION_LABELS } from '@/lib/ai/chat-tools/utils';
import { EditDiffView } from './edit-diff-view';

interface EditApprovalCardProps {
  section: string;
  fieldPath: string;
  oldValue: unknown;
  newValue: unknown;
  explanation: string;
  diffPreview: string;
  isApproving?: boolean;
  onApprove: () => void;
  onReject: () => void;
}

export function EditApprovalCard({
  section,
  fieldPath,
  oldValue,
  newValue,
  explanation,
  // diffPreview reserved for future inline diff preview
  diffPreview: _diffPreview, // eslint-disable-line @typescript-eslint/no-unused-vars
  isApproving,
  onApprove,
  onReject,
}: EditApprovalCardProps) {
  return (
    <div className="my-2 rounded-md border border-border bg-card p-4 space-y-3 overflow-hidden">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
        <span className="text-sm font-medium text-amber-500">Proposed Edit</span>
      </div>

      <div className="rounded-md border border-amber-500/20 bg-background/40 p-3 space-y-2 overflow-hidden">
        <div className="text-xs text-muted-foreground">
          <span className="font-medium">{SECTION_LABELS[section] || section}</span>
          {' / '}
          <span className="font-mono break-all">{fieldPath}</span>
        </div>
        <p className="text-xs text-muted-foreground/80">{explanation}</p>
        <EditDiffView oldValue={oldValue} newValue={newValue} fieldPath={fieldPath} />
      </div>

      <div className="flex gap-2">
        <Button
          onClick={onApprove}
          disabled={isApproving}
          className="flex-1"
        >
          {isApproving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          Approve
        </Button>
        <Button
          onClick={onReject}
          disabled={isApproving}
          variant="outline"
          className="flex-1"
        >
          <X className="w-4 h-4" />
          Reject
        </Button>
      </div>
    </div>
  );
}
