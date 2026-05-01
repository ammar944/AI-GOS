/**
 * ArtifactCard — collapsible markdown render with version dropdown.
 *
 * PRD: gtm-conversational-canvas (T8)
 *
 * Props:
 *   - versions: ordered list (oldest → newest) of GtmArtifact rows for one
 *     (run_id, skill) tuple. Component owns selection state for "which version
 *     is shown"; default = latest.
 *   - runId: passed for the open-in-canvas link.
 *   - defaultExpanded: forwarded as the initial state of the Collapsible.
 *
 * No new color/spacing tokens. Uses shadcn/ui Card + Collapsible + Badge +
 * Button + Select primitives, matching AgentInvocationBlock's style.
 */

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { GtmArtifact } from "@/lib/types/gtm-artifact";

interface ArtifactCardProps {
  versions: GtmArtifact[];
  runId: string;
  defaultExpanded?: boolean;
  className?: string;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function ArtifactCard({
  versions,
  runId,
  defaultExpanded,
  className,
}: ArtifactCardProps): React.ReactElement | null {
  // Sort newest-first for display; pick the latest by version.
  const sorted = useMemo(
    () => [...versions].sort((a, b) => b.version - a.version),
    [versions],
  );
  const latest = sorted[0];

  const [selectedId, setSelectedId] = useState<string | undefined>(
    latest?.id,
  );
  const [open, setOpen] = useState<boolean>(defaultExpanded ?? true);

  if (!latest) return null;

  const selected = sorted.find((v) => v.id === selectedId) ?? latest;
  const isLatest = selected.version === latest.version;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-ml-2 h-7 px-2 font-mono text-[11px] uppercase tracking-[0.06em]"
                aria-label={open ? "Collapse" : "Expand"}
              >
                {open ? "▾" : "▸"} {selected.skill}
              </Button>
            </CollapsibleTrigger>
            <Badge
              variant="outline"
              className="font-mono text-[10px] tabular-nums"
            >
              v{selected.version}
            </Badge>
            <Badge
              variant={selected.source === "skill_output" ? "default" : "outline"}
              className="font-mono text-[10px]"
            >
              {selected.source === "skill_output" ? "skill" : "patched"}
            </Badge>
            <span className="text-[11px] text-muted-foreground">
              {formatDate(selected.created_at)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {sorted.length > 1 && (
              <Select
                value={selected.id}
                onValueChange={(value) => setSelectedId(value)}
              >
                <SelectTrigger
                  size="sm"
                  className="h-7 w-[120px] font-mono text-[11px]"
                  aria-label="Select version"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sorted.map((v) => (
                    <SelectItem key={v.id} value={v.id} className="font-mono text-[11px]">
                      v{v.version} · {v.source === "skill_output" ? "skill" : "patched"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-7 font-mono text-[11px]"
            >
              <Link href={`/gtm/${runId}/artifacts/${selected.id}`}>
                Open in canvas
              </Link>
            </Button>
          </div>
        </div>

        <CollapsibleContent>
          <CardContent className="prose prose-sm prose-invert max-w-none px-4 pb-4 pt-0">
            <ReactMarkdown>{selected.content_md}</ReactMarkdown>
            {!isLatest && (
              <p className="mt-3 text-[11px] text-muted-foreground">
                Showing v{selected.version} (latest is v{latest.version}).
              </p>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
