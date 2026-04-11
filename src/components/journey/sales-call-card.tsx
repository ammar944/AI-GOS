'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SalesCallInsightGrid } from './sales-call-insight-grid';
import type { FathomCallMeta, SalesCallInsights } from '@/lib/fathom/types';

interface SalesCallCardProps {
  call: FathomCallMeta;
  extractedInsights?: SalesCallInsights | null;
}

function StatusBadge({ status }: { status: FathomCallMeta['status'] }) {
  switch (status) {
    case 'fetching':
      return (
        <span className="flex items-center gap-1 text-[11px] text-blue-400">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading...
        </span>
      );
    case 'extracting':
      return (
        <span className="flex items-center gap-1 text-[11px] text-yellow-400">
          <Loader2 className="h-3 w-3 animate-spin" /> Extracting...
        </span>
      );
    case 'ready':
      return (
        <span className="flex items-center gap-1 text-[11px] text-green-400">
          <CheckCircle2 className="h-3 w-3" /> Ready
        </span>
      );
    case 'error':
      return (
        <span className="flex items-center gap-1 text-[11px] text-destructive">
          <AlertCircle className="h-3 w-3" /> Error
        </span>
      );
  }
}

export function SalesCallCard({ call, extractedInsights }: SalesCallCardProps) {
  const [expanded, setExpanded] = useState(call.status === 'ready');

  const duration = call.durationSeconds > 0
    ? `${Math.round(call.durationSeconds / 60)} min`
    : '';

  const date = new Date(call.date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const attendeeCount = call.attendees.length;

  return (
    <div className="overflow-hidden rounded-xl border border-border/50 bg-card">
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'flex w-full items-center justify-between px-4 py-3 text-left',
          'hover:bg-muted/30 transition-colors',
          expanded && 'border-b border-border/50',
        )}
      >
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground truncate">{call.title}</div>
          <div className="text-[11px] text-muted-foreground">
            {[date, duration, `${attendeeCount} attendee${attendeeCount !== 1 ? 's' : ''}`]
              .filter(Boolean)
              .join(' \u00B7 ')}
          </div>
        </div>
        <div className="flex items-center gap-3 ml-3">
          <StatusBadge status={call.status} />
          {call.status === 'ready' ? (
            expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : null}
        </div>
      </button>

      {expanded && (
        <div className="p-4 space-y-3">
          {call.status === 'extracting' && call.summary && (
            <div className="rounded-lg bg-muted/20 p-3">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Fathom Summary (AI insights loading...)
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{call.summary}</p>
            </div>
          )}

          {call.status === 'extracting' && call.actionItems.length > 0 && (
            <div className="rounded-lg bg-muted/20 p-3">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Action Items
              </div>
              <ul className="space-y-1">
                {call.actionItems.map((item, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className={item.completed ? 'line-through opacity-50' : ''}>
                      {item.description}
                      {item.assignee && <span className="text-muted-foreground/60"> ({item.assignee})</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {call.status === 'ready' && extractedInsights && (
            <SalesCallInsightGrid insights={extractedInsights} />
          )}

          {call.status === 'error' && (
            <div className="rounded-lg bg-destructive/10 p-3">
              <p className="text-xs text-destructive">
                {call.error ?? 'Failed to extract insights. The transcript is still available for research.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
