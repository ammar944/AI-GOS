import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  CircleDot,
  Loader2,
  Lock,
  PencilLine,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
  type LucideIcon,
} from 'lucide-react';

import type { WorkerStatus } from '@/app/api/research-v2/audit-state/route';
import {
  type ProductPhase,
  type SectionActivityTone,
} from '@/lib/research-v2/section-activity';
import { cn } from '@/lib/utils';

/** Reader section status union — mirrors audit-reader-shell.tsx. */
export type ReaderSectionStatus = WorkerStatus | 'locked' | 'ready';

export const ALL_READER_SECTION_STATUSES: readonly ReaderSectionStatus[] = [
  'queued',
  'running',
  'complete',
  'error',
  'aborted',
  'ready',
  'locked',
] as const;

export const STATUS_META: Record<
  ReaderSectionStatus,
  { icon: LucideIcon; cls: string; label: string; spin?: boolean }
> = {
  running: { icon: Loader2, cls: 'text-primary', label: 'Running', spin: true },
  complete: { icon: Check, cls: 'text-emerald-600', label: 'Complete' },
  error: { icon: AlertTriangle, cls: 'text-red-600', label: 'Needs review' },
  aborted: { icon: X, cls: 'text-red-600', label: 'Aborted' },
  queued: { icon: CircleDot, cls: 'text-muted-foreground/60', label: 'Queued' },
  locked: { icon: Lock, cls: 'text-muted-foreground/50', label: 'Locked' },
  ready: { icon: ArrowUpRight, cls: 'text-primary', label: 'Ready after 6/6' },
};

export const ALL_PRODUCT_PHASES: readonly ProductPhase[] = [
  'preparing',
  'searching',
  'drafting',
  'checking',
  'refining',
  'committing',
  'done',
] as const;

export const PHASE_ICON: Record<ProductPhase, LucideIcon> = {
  preparing: CircleDot,
  searching: Search,
  drafting: PencilLine,
  checking: ShieldCheck,
  refining: SlidersHorizontal,
  committing: CheckCircle2,
  done: CheckCircle2,
};

export const ACTIVITY_TONE_CLASS: Record<SectionActivityTone, string> = {
  active: 'text-primary',
  success: 'text-emerald-600',
  neutral: 'text-muted-foreground',
  warning: 'text-amber-600',
  error: 'text-red-600',
};

export function StatusIcon({
  status,
  className,
}: {
  status: ReaderSectionStatus;
  className?: string;
}): React.ReactElement {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <Icon
      className={cn('size-4', meta.cls, meta.spin && 'animate-spin motion-reduce:animate-none', className)}
      strokeWidth={2.25}
    />
  );
}
