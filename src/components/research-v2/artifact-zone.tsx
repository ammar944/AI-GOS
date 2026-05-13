'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Loader2,
} from 'lucide-react';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Shimmer } from '@/components/ai/shimmer';
import { cn } from '@/lib/utils';
import type { ResearchJobUpdate } from '@/lib/journey/research-job-activity';
import type { ArtifactZone as ArtifactZoneData } from '@/lib/research-v2/audit-artifact-schema';
import { ZoneActivity } from './zone-activity';
import { ZoneErrorCard } from './zone-error-card';

export type ZoneRetryHandler = (opts: {
  zoneId: string;
  usePartialContext: boolean;
}) => void | Promise<void>;

export type ZoneCancelHandler = (zoneId: string) => void | Promise<void>;

interface ArtifactZoneProps {
  zone: ArtifactZoneData;
  activityUpdates: ResearchJobUpdate[] | undefined;
  onRetry?: ZoneRetryHandler;
  onCancel?: ZoneCancelHandler;
  isRetrying?: boolean;
}

function StatusBadge({ status }: { status: ArtifactZoneData['status'] }) {
  if (status === 'running') {
    return (
      <Badge variant="secondary" className="gap-1">
        <Loader2 className="size-3 animate-spin" />
        Researching
      </Badge>
    );
  }
  if (status === 'complete') {
    return (
      <Badge
        variant="default"
        className="gap-1 bg-emerald-600 hover:bg-emerald-600 text-white"
      >
        <CheckCircle2 className="size-3" />
        Complete
      </Badge>
    );
  }
  if (status === 'error') {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertCircle className="size-3" />
        Error
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <Circle className="size-3" />
      Idle
    </Badge>
  );
}

export function ArtifactZone({
  zone,
  activityUpdates,
  onRetry,
  onCancel,
  isRetrying,
}: ArtifactZoneProps) {
  const [narrativeOpen, setNarrativeOpen] = useState(true);
  const [claimsOpen, setClaimsOpen] = useState(false);

  const isError = zone.status === 'error';
  const isRunning = zone.status === 'running';
  const isComplete = zone.status === 'complete';
  const hasNarrative = zone.narrative.trim().length > 0;

  return (
    <Card
      className={cn(
        'flex flex-col h-full transition-colors',
        isError && 'border-destructive/40',
        isRunning && 'border-primary/30',
      )}
    >
      <CardHeader className="pb-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-semibold">
            {isRunning ? (
              <Shimmer className="text-sm font-semibold">{zone.title}</Shimmer>
            ) : (
              zone.title
            )}
          </CardTitle>
          <StatusBadge status={zone.status} />
        </div>
        {isError && !onRetry && zone.errorMessage ? (
          <p className="text-xs text-destructive">{zone.errorMessage}</p>
        ) : null}
      </CardHeader>
      <CardContent className="flex-1 space-y-3 text-sm">
        {isError && onRetry ? (
          <ZoneErrorCard
            zoneId={zone.zone}
            zoneTitle={zone.title}
            errorMessage={zone.errorMessage ?? null}
            partialNarrative={zone.partialNarrative ?? null}
            partialAt={zone.partialAt ?? null}
            isRetrying={isRetrying}
            onRetry={({ usePartialContext }) =>
              onRetry({ zoneId: zone.zone, usePartialContext })
            }
            onCancel={onCancel ? () => onCancel(zone.zone) : undefined}
          />
        ) : null}

        {(isRunning || (activityUpdates && activityUpdates.length > 0)) ? (
          <ZoneActivity
            updates={activityUpdates}
            isRunning={isRunning}
            isComplete={isComplete}
          />
        ) : null}

        {hasNarrative ? (
          <Collapsible open={narrativeOpen} onOpenChange={setNarrativeOpen}>
            <CollapsibleTrigger className="flex w-full items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              {narrativeOpen ? (
                <ChevronDown className="size-3" />
              ) : (
                <ChevronRight className="size-3" />
              )}
              Narrative
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{zone.narrative}</ReactMarkdown>
              </div>
            </CollapsibleContent>
          </Collapsible>
        ) : zone.status === 'idle' ? (
          <p className="text-xs text-muted-foreground">
            Not yet started. This zone will populate once research dispatches.
          </p>
        ) : null}

        {zone.claims.length > 0 ? (
          <Collapsible open={claimsOpen} onOpenChange={setClaimsOpen}>
            <CollapsibleTrigger className="flex w-full items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              {claimsOpen ? (
                <ChevronDown className="size-3" />
              ) : (
                <ChevronRight className="size-3" />
              )}
              Claims ({zone.claims.length})
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <ul className="space-y-1.5">
                {zone.claims.map((claim) => (
                  <li
                    key={claim.id}
                    className="border-l-2 border-muted pl-3 text-xs"
                  >
                    <span className="block">{claim.text}</span>
                    {claim.sourceIds.length > 0 ? (
                      <span className="text-[10px] text-muted-foreground">
                        {claim.sourceIds.length} source
                        {claim.sourceIds.length === 1 ? '' : 's'}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        ) : null}

        {zone.sources.length > 0 ? (
          <div className="text-[10px] text-muted-foreground">
            {zone.sources.length} source{zone.sources.length === 1 ? '' : 's'} cited
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
