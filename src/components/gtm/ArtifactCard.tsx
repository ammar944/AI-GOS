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
import {
  buildGtmRunSourceLedger,
  type GtmRunSourceGapRef,
  type GtmRunSourceLedger,
  type GtmRunSourceLedgerSource,
} from "@/lib/gtm/source-ledger";
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
  const selected = latest ? sorted.find((v) => v.id === selectedId) ?? latest : null;
  const sourceLedger = useMemo(() => {
    return buildGtmRunSourceLedger({
      values: selected ? [selected.metadata] : [],
    });
  }, [selected]);

  if (!latest || !selected) return null;

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

        <ArtifactEvidenceSummary ledger={sourceLedger} />

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

function ArtifactEvidenceSummary({
  ledger,
}: {
  ledger: GtmRunSourceLedger;
}): React.ReactElement {
  const sources = ledger.groups.flatMap((group) => group.sources);

  if (sources.length > 0) {
    return (
      <div className="border-t border-border px-4 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="border-emerald-500/30 bg-emerald-500/10 font-mono text-[11px] text-emerald-700 dark:text-emerald-300"
          >
            Citations
          </Badge>
          {sources.map((source) => (
            <ArtifactCitationChip key={source.key} source={source} />
          ))}
        </div>
        {ledger.source_gaps.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ledger.source_gaps.map((sourceGap) => (
              <ArtifactSourceGapChip
                key={`${sourceGap.id}-${sourceGap.claim_path_label}`}
                sourceGap={sourceGap}
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  if (ledger.source_gaps.length > 0) {
    return (
      <div className="border-t border-border px-4 py-2">
        <div className="flex flex-col gap-2">
          {ledger.source_gaps.map((sourceGap) => (
            <ArtifactSourceGapChip
              key={`${sourceGap.id}-${sourceGap.claim_path_label}`}
              sourceGap={sourceGap}
              showReason
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-border px-4 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className="border-yellow-500/40 bg-yellow-500/10 font-mono text-[11px] text-yellow-700 dark:text-yellow-300"
        >
          Needs evidence
        </Badge>
        <span className="text-xs text-muted-foreground">
          No source evidence attached to this artifact.
        </span>
      </div>
    </div>
  );
}

function ArtifactCitationChip({
  source,
}: {
  source: GtmRunSourceLedgerSource;
}): React.ReactElement {
  const firstClaim = source.claim_refs[0];
  const className =
    "inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 font-mono text-[11px] text-muted-foreground";
  const content = (
    <>
      <span className="truncate">{source.label}</span>
      {firstClaim ? (
        <>
          <span className="text-muted-foreground/70">·</span>
          <span className="truncate">{firstClaim.claim_path_label}</span>
        </>
      ) : null}
    </>
  );

  if (source.url) {
    return (
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(className, "underline-offset-4 hover:text-foreground hover:underline")}
      >
        {content}
      </a>
    );
  }

  return (
    <span className={className}>
      {content}
    </span>
  );
}

function ArtifactSourceGapChip({
  sourceGap,
  showReason = false,
}: {
  sourceGap: GtmRunSourceGapRef;
  showReason?: boolean;
}): React.ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/5 px-2.5 py-1.5">
      <Badge
        variant="outline"
        className="border-yellow-500/40 bg-yellow-500/10 font-mono text-[11px] text-yellow-700 dark:text-yellow-300"
      >
        Source gap
      </Badge>
      <span className="font-mono text-[11px] text-foreground">
        {sourceGap.claim_path_label}
      </span>
      {showReason ? (
        <span className="text-xs text-muted-foreground">{sourceGap.reason}</span>
      ) : null}
    </div>
  );
}
