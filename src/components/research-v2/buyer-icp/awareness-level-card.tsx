import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type {
  AwarenessLevelCard as AwarenessLevelCardData,
  BuyerICPAwarenessLevel,
} from '@/types/buyer-icp-artifact';

const LEVEL_CHIP_CLASS: Record<BuyerICPAwarenessLevel, string> = {
  unaware: 'border-muted-foreground text-muted-foreground',
  'problem-aware': 'border-secondary text-secondary-foreground',
  'solution-aware': 'border-primary text-primary',
  'product-aware': 'border-primary text-primary',
  'most-aware': 'border-destructive text-destructive',
};

export interface AwarenessLevelCardProps {
  level: AwarenessLevelCardData;
}

export function AwarenessLevelCard({
  level,
}: AwarenessLevelCardProps): React.ReactElement {
  return (
    <Card role="listitem" className="h-full rounded-md">
      <CardContent className="flex h-full flex-col gap-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge
            variant="outline"
            className={cn('border', LEVEL_CHIP_CLASS[level.level])}
          >
            {level.level}
          </Badge>
          <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground">
            {level.share}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {level.evidence}
        </p>
        {level.sampleQuery ? (
          <div className="mt-auto rounded-md border border-border bg-muted p-2 text-xs text-muted-foreground">
            <div className="mb-1 font-medium text-foreground">
              Source query
            </div>
            {level.sampleQuery}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
