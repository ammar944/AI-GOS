'use client';

import { StatGrid } from './stat-grid';

interface SegmentCardProps {
  name: string;
  description?: string;
  estimatedReach?: string;
  funnelPosition?: string;
  priority?: number;
}

export function SegmentCard({ name, description, estimatedReach, funnelPosition, priority }: SegmentCardProps) {
  const stats = [
    ...(estimatedReach ? [{ label: 'Est. Reach', value: estimatedReach }] : []),
    ...(funnelPosition ? [{ label: 'Funnel', value: funnelPosition }] : []),
    ...(priority !== undefined ? [{ label: 'Priority', value: String(priority) }] : []),
  ];

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-[var(--text-primary)]">{name}</p>
      {description && (
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{description}</p>
      )}
      {stats.length > 0 && <StatGrid stats={stats} columns={3} />}
    </div>
  );
}
