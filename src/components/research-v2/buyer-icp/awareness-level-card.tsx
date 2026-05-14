import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type {
  AwarenessLevelCard as AwarenessLevelCardData,
  BuyerICPAwarenessLevel,
} from '@/types/buyer-icp-artifact';

const LEVEL_CHIP_CLASS: Record<BuyerICPAwarenessLevel, string> = {
  unaware: 'border-[color:var(--text-3)] text-[color:var(--text-3)]',
  'problem-aware': 'border-[color:var(--amber)] text-[color:var(--amber)]',
  'solution-aware': 'border-[color:var(--accent)] text-[color:var(--accent)]',
  'product-aware': 'border-[color:var(--green)] text-[color:var(--green)]',
  'most-aware': 'border-[color:var(--red)] text-[color:var(--red)]',
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
          <span className="rounded-md bg-[var(--bg-2)] px-2 py-1 text-xs font-medium text-[color:var(--text-1)]">
            {level.share}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-[color:var(--text-2)]">
          {level.evidence}
        </p>
        {level.sampleQuery ? (
          <div className="mt-auto rounded-md border border-[var(--border)] bg-[var(--bg-2)] p-2 text-xs text-[color:var(--text-2)]">
            <div className="mb-1 font-medium text-[color:var(--text-1)]">
              Source query
            </div>
            {level.sampleQuery}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
