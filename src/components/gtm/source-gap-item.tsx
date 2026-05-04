"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import type { SourceGap } from "@/lib/types/source-gap";

export interface SourceGapItemProps {
  gap: SourceGap;
}

export function SourceGapItem({ gap }: SourceGapItemProps) {
  const [open, setOpen] = useState(false);

  if (gap.severity === "info") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="cursor-default gap-1.5">
            <InfoIcon />
            {gap.field}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p>{gap.reason}</p>
          {gap.remediation ? (
            <p className="mt-1 text-muted-foreground">{gap.remediation}</p>
          ) : null}
        </TooltipContent>
      </Tooltip>
    );
  }

  if (gap.severity === "blocker") {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
        <div className="flex items-center gap-2">
          <Badge variant="destructive">{gap.field}</Badge>
        </div>
        <p className="mt-1.5 text-sm text-foreground">{gap.reason}</p>
        {gap.remediation ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Remediation: {gap.remediation}
          </p>
        ) : null}
      </div>
    );
  }

  // severity === "warn"
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="group flex w-full items-center gap-2 text-left">
        <Badge
          className={cn(
            "border-transparent bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
            "transition-colors group-hover:bg-yellow-500/25"
          )}
        >
          incomplete: {gap.field}
        </Badge>
        <ChevronIcon open={open} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 pl-1 text-sm">
        <p className="text-foreground">{gap.reason}</p>
        {gap.remediation ? (
          <p className="mt-1 text-muted-foreground">
            Remediation: {gap.remediation}
          </p>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
}

function InfoIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      className="shrink-0"
    >
      <circle
        cx="7"
        cy="7"
        r="6"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M7 6.5V10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="7" cy="4.5" r="0.75" fill="currentColor" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      className={cn(
        "shrink-0 text-muted-foreground transition-transform",
        open && "rotate-90"
      )}
    >
      <path
        d="M5 3L9 7L5 11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
