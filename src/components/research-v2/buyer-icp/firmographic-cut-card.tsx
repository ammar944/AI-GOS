import { ExternalLink } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { FirmographicCut } from '@/types/buyer-icp-artifact';

export interface FirmographicCutCardProps {
  cut: FirmographicCut;
}

export function FirmographicCutCard({
  cut,
}: FirmographicCutCardProps): React.ReactElement {
  return (
    <Card role="listitem" className="h-full rounded-md">
      <CardContent className="flex h-full flex-col gap-4 p-4">
        <Badge variant="outline" className="w-fit border-[var(--border)]">
          {cut.cutType}
        </Badge>
        <div className="space-y-2">
          <h4 className="text-sm font-semibold leading-snug text-[color:var(--text-1)]">
            {cut.value}
          </h4>
          {cut.accountCount ? (
            <div className="rounded-md border border-[var(--border)] bg-[var(--bg-2)] p-3">
              <div className="text-xs text-[color:var(--text-3)]">Account count</div>
              <div className="text-lg font-semibold text-[color:var(--text-1)]">
                {cut.accountCount}
              </div>
            </div>
          ) : null}
        </div>
        <Separator className="mt-auto" />
        <div className="flex flex-col gap-2 text-xs text-[color:var(--text-3)]">
          <span>{cut.source}</span>
          <span>{cut.dateObserved}</span>
          <a
            href={cut.sourceUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open source for ${cut.value}`}
            className="inline-flex w-fit items-center gap-1 font-medium text-[color:var(--accent)] hover:underline"
          >
            Source <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
