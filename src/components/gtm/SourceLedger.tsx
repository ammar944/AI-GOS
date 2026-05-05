"use client";

import { useState } from "react";
import type { ReactElement } from "react";
import {
  AlertTriangle,
  ChevronRight,
  ExternalLink,
  FileText,
  Globe2,
  MessageSquareText,
  User,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  GtmRunSourceGapRef,
  GtmRunSourceLedger,
  GtmRunSourceLedgerGroup,
  GtmRunSourceLedgerSource,
} from "@/lib/gtm/source-ledger";

interface SourceLedgerProps {
  ledger: GtmRunSourceLedger;
  className?: string;
}

export function SourceLedger({
  ledger,
  className,
}: SourceLedgerProps): ReactElement {
  const hasSources = ledger.source_count > 0;
  const hasGaps = ledger.source_gap_count > 0;

  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-card/70 shadow-sm",
        className,
      )}
    >
      <div className="border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-mono text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground">
              Source Ledger
            </h2>
            <p className="mt-1 text-base font-semibold tracking-normal text-foreground">
              {hasSources
                ? formatSourceCount(ledger.source_count)
                : "0 sources attached"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <LedgerSummaryBadge tone={hasSources ? "source" : "muted"}>
              {formatEvidenceCount(ledger.evidence_count)}
            </LedgerSummaryBadge>
            <LedgerSummaryBadge tone={hasGaps ? "gap" : "clear"}>
              {hasGaps ? formatSourceGapCount(ledger.source_gap_count) : "0 source gaps"}
            </LedgerSummaryBadge>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 px-4 py-3">
        {!hasSources ? <SourceLedgerEmptyState /> : null}

        {ledger.groups.map((group) => (
          <SourceLedgerGroupView key={group.source_type} group={group} />
        ))}

        {hasGaps ? <SourceGapLedgerSection sourceGaps={ledger.source_gaps} /> : null}
      </div>
    </section>
  );
}

function SourceLedgerGroupView({
  group,
}: {
  group: GtmRunSourceLedgerGroup;
}): ReactElement {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <SourceTypeIcon sourceType={group.source_type} />
        <h3 className="font-mono text-sm font-medium text-foreground">
          {group.label}
        </h3>
        <Badge variant="outline" className="font-mono text-xs">
          {formatSourceCount(group.source_count)}
        </Badge>
      </div>

      <ol className="flex flex-col gap-2">
        {group.sources.map((source) => (
          <li key={source.key}>
            <SourceLedgerCard source={source} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function SourceLedgerCard({
  source,
}: {
  source: GtmRunSourceLedgerSource;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const hasDetails =
    source.quote_snippets.length > 0 || source.evidence_ids.length > 0;

  return (
    <div
      className={cn(
        "rounded-md border bg-background/55 px-3 py-3",
        source.trust_level === "user_provided"
          ? "border-yellow-500/30"
          : "border-border",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusDot trustLevel={source.trust_level} />
            <p className="min-w-0 font-mono text-sm font-medium text-foreground">
              <span className="truncate">{source.label}</span>
            </p>
            <Badge
              variant="outline"
              className={cn("text-xs", getTrustBadgeClassName(source))}
            >
              {source.trust_label}
            </Badge>
            <Badge variant="outline" className="font-mono text-xs">
              {source.confidence}
            </Badge>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <SourceOrigin source={source} />
            <span>{formatSourceTimestamp(source)}</span>
            {source.trust_level === "user_provided" ? (
              <span className="text-yellow-700 dark:text-yellow-300">
                Not external verification
              </span>
            ) : null}
          </div>
        </div>

        {hasDetails ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            aria-label={`Inspect ${source.label}`}
            onClick={() => setOpen((value) => !value)}
          >
            <ChevronRight
              className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")}
              aria-hidden="true"
            />
            Details
          </Button>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {source.claim_refs.map((claimRef) => (
          <Badge
            key={claimRef.claim_path_label}
            variant="outline"
            className="font-mono text-[11px]"
          >
            {claimRef.claim_path_label}
          </Badge>
        ))}
      </div>

      {open && hasDetails ? (
        <div className="mt-3 rounded-md border border-border bg-muted/30 px-3 py-2">
          {source.quote_snippets.length > 0 ? (
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                Snippet
              </p>
              {source.quote_snippets.map((snippet) => (
                <p key={snippet} className="mt-1 text-sm text-foreground">
                  {snippet}
                </p>
              ))}
            </div>
          ) : null}

          <div className={cn(source.quote_snippets.length > 0 && "mt-3")}>
            <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
              Evidence IDs
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {source.evidence_ids.map((evidenceId) => (
                <Badge
                  key={evidenceId}
                  variant="outline"
                  className="font-mono text-[11px]"
                >
                  {evidenceId}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SourceGapLedgerSection({
  sourceGaps,
}: {
  sourceGaps: GtmRunSourceGapRef[];
}): ReactElement {
  return (
    <section className="flex flex-col gap-2 border-t border-border pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-yellow-600" aria-hidden="true" />
        <h3 className="font-mono text-sm font-medium text-foreground">
          Source gaps
        </h3>
        <Badge variant="outline" className="font-mono text-xs">
          {formatSourceGapCount(sourceGaps.length)}
        </Badge>
      </div>

      <ol className="flex flex-col gap-2">
        {sourceGaps.map((sourceGap) => (
          <li
            key={`${sourceGap.id}-${sourceGap.claim_path_label}`}
            className="rounded-md border border-yellow-500/30 bg-yellow-500/5 px-3 py-2"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono text-[11px]">
                {sourceGap.severity}
              </Badge>
              <span className="font-mono text-xs text-foreground">
                {sourceGap.claim_path_label}
              </span>
            </div>
            <p className="mt-1 text-sm text-foreground">{sourceGap.reason}</p>
            {sourceGap.remediation ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {sourceGap.remediation}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

function SourceLedgerEmptyState(): ReactElement {
  return (
    <div className="rounded-md border border-dashed border-border bg-background/50 px-3 py-3">
      <p className="text-sm font-medium text-foreground">
        No source evidence attached yet
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Claims without explicit evidence stay as source gaps or unknowns.
      </p>
    </div>
  );
}

function LedgerSummaryBadge({
  children,
  tone,
}: {
  children: string;
  tone: "clear" | "gap" | "muted" | "source";
}): ReactElement {
  const toneClassName: Record<typeof tone, string> = {
    clear:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    gap: "border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
    muted: "border-border bg-muted/40 text-muted-foreground",
    source:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  };

  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full border px-2 font-mono text-[11px]",
        toneClassName[tone],
      )}
    >
      {children}
    </span>
  );
}

function SourceTypeIcon({
  sourceType,
}: {
  sourceType: GtmRunSourceLedgerGroup["source_type"];
}): ReactElement {
  const className = "h-4 w-4 text-muted-foreground";

  if (sourceType === "uploaded_document") {
    return <FileText className={className} aria-hidden="true" />;
  }

  if (sourceType === "transcript") {
    return <MessageSquareText className={className} aria-hidden="true" />;
  }

  if (sourceType === "tool_call") {
    return <Wrench className={className} aria-hidden="true" />;
  }

  if (sourceType === "user_input") {
    return <User className={className} aria-hidden="true" />;
  }

  return <Globe2 className={className} aria-hidden="true" />;
}

function StatusDot({
  trustLevel,
}: {
  trustLevel: GtmRunSourceLedgerSource["trust_level"];
}): ReactElement {
  const toneClassName: Record<typeof trustLevel, string> = {
    external: "bg-emerald-500",
    tool_trace: "bg-blue-500",
    user_provided: "bg-yellow-500",
  };

  return (
    <span
      className={cn("h-2 w-2 shrink-0 rounded-full", toneClassName[trustLevel])}
      aria-hidden="true"
    />
  );
}

function SourceOrigin({
  source,
}: {
  source: GtmRunSourceLedgerSource;
}): ReactElement {
  if (source.url) {
    return (
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-w-0 max-w-full items-center gap-1 font-mono underline-offset-4 hover:text-foreground hover:underline"
      >
        <span className="truncate">{source.origin_label}</span>
        <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
      </a>
    );
  }

  return <span className="font-mono">{source.origin_label}</span>;
}

function getTrustBadgeClassName(source: GtmRunSourceLedgerSource): string {
  if (source.trust_level === "user_provided") {
    return "border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300";
  }

  if (source.trust_level === "tool_trace") {
    return "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300";
  }

  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
}

function formatSourceTimestamp(source: GtmRunSourceLedgerSource): string {
  const timestamp = source.retrieved_at ?? source.observed_at;
  if (!timestamp) {
    return "No timestamp";
  }

  return formatDate(timestamp);
}

function formatDate(iso: string): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatEvidenceCount(count: number): string {
  return `${count} ${count === 1 ? "evidence item" : "evidence items"}`;
}

function formatSourceCount(count: number): string {
  return `${count} ${count === 1 ? "source" : "sources"}`;
}

function formatSourceGapCount(count: number): string {
  return `${count} ${count === 1 ? "source gap" : "source gaps"}`;
}
