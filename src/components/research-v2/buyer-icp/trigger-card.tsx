import { ExternalLink } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { TriggerCard as TriggerCardData } from '@/types/buyer-icp-artifact';

export interface TriggerCardProps {
  trigger: TriggerCardData;
}

export function TriggerCard({ trigger }: TriggerCardProps): React.ReactElement {
  return (
    <Card role="listitem" className="h-full rounded-md">
      <CardContent className="flex h-full flex-col gap-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <h4 className="text-sm font-semibold leading-snug text-foreground">
            {trigger.name}
          </h4>
          <Badge variant="secondary" className="shrink-0">
            {trigger.window}
          </Badge>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {trigger.detectionSignal}
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {trigger.evidence}
        </p>
        {trigger.sourceUrl ? (
          <a
            href={trigger.sourceUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open source for ${trigger.name}`}
            className="mt-auto inline-flex w-fit items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Example source <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        ) : null}
      </CardContent>
    </Card>
  );
}
