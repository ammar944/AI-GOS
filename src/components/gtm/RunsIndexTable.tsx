"use client";

import Link from "next/link";
import type { ReactElement, ReactNode } from "react";
import {
  RunStatusBadge,
  type GtmRunStatus,
} from "@/components/gtm/RunStatusBadge";
import { Button } from "@/components/ui/button";

export interface GtmRunListItem {
  run_id: string;
  input_url: string;
  status: GtmRunStatus;
  created_at: string;
  updated_at: string;
}

interface RunsIndexTableProps {
  runs: GtmRunListItem[];
}

export function RunsIndexTable({ runs }: RunsIndexTableProps): ReactElement {
  const sortedRuns = [...runs].sort((left, right) =>
    right.created_at.localeCompare(left.created_at)
  );

  if (sortedRuns.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-5 py-8 text-center">
        <p className="text-sm text-muted-foreground">No GTM runs yet.</p>
        <Button asChild className="mt-4" size="sm">
          <Link href="/gtm/new">New run</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-border bg-muted/40">
          <tr>
            <TableHead>Run</TableHead>
            <TableHead>Input URL</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Updated</TableHead>
          </tr>
        </thead>
        <tbody>
          {sortedRuns.map((run) => (
            <tr
              key={run.run_id}
              className="border-b border-border/50 transition-colors last:border-b-0 hover:bg-muted/30"
            >
              <TableCell>
                <Link
                  href={`/gtm/${run.run_id}`}
                  className="font-mono text-xs text-foreground underline-offset-4 hover:underline"
                >
                  {run.run_id}
                </Link>
              </TableCell>
              <TableCell>
                <Link
                  href={`/gtm/${run.run_id}`}
                  className="block max-w-[320px] truncate text-foreground underline-offset-4 hover:underline"
                >
                  {run.input_url}
                </Link>
              </TableCell>
              <TableCell>
                <RunStatusBadge status={run.status} />
              </TableCell>
              <TableCell>{formatRelativeTime(run.created_at)}</TableCell>
              <TableCell>{formatRelativeTime(run.updated_at)}</TableCell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableHead({ children }: { children: string }): ReactElement {
  return (
    <th className="px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
      {children}
    </th>
  );
}

function TableCell({ children }: { children: ReactNode }): ReactElement {
  return (
    <td className="px-4 py-3 align-middle text-muted-foreground">
      {children}
    </td>
  );
}

function formatRelativeTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "unknown";
  }

  const elapsedMs = Date.now() - date.getTime();
  const elapsedMinutes = Math.max(0, Math.floor(elapsedMs / 60_000));

  if (elapsedMinutes < 1) {
    return "now";
  }

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);

  if (elapsedHours < 24) {
    return `${elapsedHours}h ago`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);
  return `${elapsedDays}d ago`;
}
