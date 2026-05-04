import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type GtmRunStatus =
  | "queued"
  | "running"
  | "awaiting_user"
  | "completed"
  | "partial"
  | "failed";

interface RunStatusBadgeProps {
  status: GtmRunStatus;
  className?: string;
}

const RUN_STATUS_STYLES: Record<
  GtmRunStatus,
  {
    label: string;
    variant: "default" | "destructive" | "outline" | "success";
    className?: string;
  }
> = {
  queued: { label: "Queued", variant: "outline" },
  running: { label: "Running", variant: "default" },
  awaiting_user: {
    label: "Awaiting user",
    variant: "outline",
    className: "border-yellow-500/40 text-yellow-700 dark:text-yellow-400",
  },
  completed: { label: "Completed", variant: "success" },
  partial: {
    label: "Partial",
    variant: "outline",
    className: "border-yellow-500/40 text-yellow-700 dark:text-yellow-400",
  },
  failed: { label: "Failed", variant: "destructive" },
};

export function RunStatusBadge({
  status,
  className,
}: RunStatusBadgeProps): ReactElement {
  const style = RUN_STATUS_STYLES[status];

  return (
    <Badge
      data-status={status}
      variant={style.variant}
      className={cn(style.className, className)}
    >
      {style.label}
    </Badge>
  );
}
