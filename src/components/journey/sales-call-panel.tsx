'use client';

import { useState, useCallback, useEffect } from 'react';
import { SalesCallInput } from './sales-call-input';
import { SalesCallCard } from './sales-call-card';
import type { FathomCallMeta, SalesCallInsights } from '@/lib/fathom/types';

interface SalesCallPanelProps {
  runId: string;
  initialCalls?: FathomCallMeta[];
  extractedFieldsMap?: Record<string, SalesCallInsights>;
  onCallsChange?: (calls: FathomCallMeta[]) => void;
}

export function SalesCallPanel({
  runId,
  initialCalls = [],
  extractedFieldsMap = {},
  onCallsChange,
}: SalesCallPanelProps) {
  const [calls, setCalls] = useState<FathomCallMeta[]>(initialCalls);
  const [fieldsMap, setFieldsMap] = useState<Record<string, SalesCallInsights>>(extractedFieldsMap);

  useEffect(() => {
    if (initialCalls.length > 0) setCalls(initialCalls);
  }, [initialCalls]);

  useEffect(() => {
    if (Object.keys(extractedFieldsMap).length > 0) setFieldsMap(extractedFieldsMap);
  }, [extractedFieldsMap]);

  const handleAddCall = useCallback(
    async (shareUrl: string) => {
      const res = await fetch('/api/fathom/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareUrl, runId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(data.error ?? `Failed: ${res.status}`);
      }

      const data = await res.json();
      const newCall: FathomCallMeta = {
        recordingId: data.recordingId,
        shareUrl,
        title: data.title,
        date: data.date,
        durationSeconds: data.durationSeconds,
        attendees: data.attendees,
        summary: data.summary,
        actionItems: data.actionItems,
        documentId: data.documentId,
        status: 'extracting',
      };

      const updated = [...calls, newCall];
      setCalls(updated);
      onCallsChange?.(updated);
    },
    [calls, runId, onCallsChange],
  );

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/[0.02] p-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/60 text-sm font-bold text-primary-foreground">
          F
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">Sales Call Intelligence</h3>
          <p className="text-[11px] text-muted-foreground">
            Enrich your strategy with real conversation data
          </p>
        </div>
        {calls.length > 0 && (
          <span className="text-[11px] text-primary">
            {calls.length} call{calls.length !== 1 ? 's' : ''} linked
          </span>
        )}
      </div>

      <SalesCallInput onSubmit={handleAddCall} />

      {calls.length > 0 && (
        <div className="space-y-2">
          {calls.map((call) => (
            <SalesCallCard
              key={call.recordingId}
              call={call}
              extractedInsights={fieldsMap[call.documentId] ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
