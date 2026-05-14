import { ExternalLink } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { ClusterVenue } from '@/types/buyer-icp-artifact';

export interface ClusterVenueCardProps {
  venue: ClusterVenue;
}

export function ClusterVenueCard({
  venue,
}: ClusterVenueCardProps): React.ReactElement {
  return (
    <Card role="listitem" className="h-full rounded-md">
      <CardContent className="flex h-full flex-col gap-4 p-4">
        <Badge variant="outline" className="w-fit border-[var(--border)]">
          {venue.bucketType}
        </Badge>
        <div className="space-y-2">
          <h4 className="text-sm font-semibold leading-snug text-[color:var(--text-1)]">
            {venue.name}
          </h4>
          <div className="rounded-md bg-[var(--bg-2)] px-3 py-2 text-sm font-semibold text-[color:var(--text-1)]">
            {venue.audienceSize}
          </div>
        </div>
        <p className="text-xs leading-relaxed text-[color:var(--text-2)]">
          {venue.whyItMatters}
        </p>
        <a
          href={venue.sourceUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open source for ${venue.name}`}
          className="mt-auto inline-flex w-fit items-center gap-1 text-xs font-medium text-[color:var(--accent)] hover:underline"
        >
          Source <ExternalLink className="size-3" aria-hidden="true" />
        </a>
      </CardContent>
    </Card>
  );
}
