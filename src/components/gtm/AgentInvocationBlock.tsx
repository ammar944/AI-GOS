"use client";

import { useMemo, useState } from "react";
import type { ReactElement } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SourceGapItem } from "@/components/gtm/source-gap-item";
import type {
  DiscoveredPage,
  GenericSkillOutput,
  IngestIdentityOutput,
  IngestUrlOutput,
  PrefilledField,
  ResearchCompetitorOutput,
  ResearchIcpOutput,
  ResearchMarketOutput,
  SourceGap,
  SourcedClaim,
} from "@/lib/gtm/types";

export type { IngestUrlOutput } from "@/lib/gtm/types";

export type LighthouseInvocationSkill =
  | "discover-url"
  | "ingest-identity"
  | "research-market"
  | "research-competitor"
  | "research-icp";

export type AgentInvocationSkill = LighthouseInvocationSkill | (string & {});

export type AgentInvocationStatus =
  | "running"
  | "complete"
  | "blocked"
  | "errored";

type DiscoverUrlInvocation = {
  skill: "discover-url";
  summary?: string;
  output?: IngestUrlOutput;
} & InvocationMetadata;

type IngestIdentityInvocation = {
  skill: "ingest-identity";
  summary?: string;
  output?: IngestIdentityOutput | GenericSkillOutput;
} & InvocationMetadata;

type ResearchMarketInvocation = {
  skill: "research-market";
  summary?: string;
  output?: ResearchMarketOutput | GenericSkillOutput;
} & InvocationMetadata;

type ResearchCompetitorInvocation = {
  skill: "research-competitor";
  summary?: string;
  output?: ResearchCompetitorOutput | GenericSkillOutput;
} & InvocationMetadata;

type ResearchIcpInvocation = {
  skill: "research-icp";
  summary?: string;
  output?: ResearchIcpOutput | GenericSkillOutput;
} & InvocationMetadata;

type UnknownInvocation = {
  skill: AgentInvocationSkill;
  summary?: string;
  output?: unknown;
} & InvocationMetadata;

interface InvocationMetadata {
  artifacts?: Record<string, string>;
  validation?: unknown;
  toolCalls?: unknown[];
  error?: string;
  durationMs?: number;
}

export type AgentInvocation =
  | DiscoverUrlInvocation
  | IngestIdentityInvocation
  | ResearchMarketInvocation
  | ResearchCompetitorInvocation
  | ResearchIcpInvocation
  | UnknownInvocation;

export interface AgentInvocationBlockProps<
  TInvocation extends AgentInvocation = AgentInvocation,
> {
  invocation: TInvocation;
  status: AgentInvocationStatus;
  className?: string;
}

const SKILL_LABELS: Record<LighthouseInvocationSkill, string> = {
  "discover-url": "discover-url",
  "ingest-identity": "ingest-identity",
  "research-market": "research-market",
  "research-competitor": "research-competitor",
  "research-icp": "research-icp",
};

const STATUS_STYLES: Record<
  AgentInvocationStatus,
  { label: string; variant: "default" | "destructive" | "outline" | "success"; className?: string }
> = {
  running: { label: "Running", variant: "default" },
  complete: { label: "Complete", variant: "success" },
  blocked: {
    label: "Blocked",
    variant: "outline",
    className: "border-yellow-500/40 text-yellow-700 dark:text-yellow-400",
  },
  errored: { label: "Errored", variant: "destructive" },
};

const CONFIDENCE_STYLES: Record<PrefilledField["confidence"], string> = {
  low: "border-transparent bg-zinc-500/15 text-zinc-600 dark:text-zinc-400",
  medium:
    "border-transparent bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  high: "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
};

export function AgentInvocationBlock<
  TInvocation extends AgentInvocation = AgentInvocation,
>({
  invocation,
  status,
  className,
}: AgentInvocationBlockProps<TInvocation>): ReactElement {
  const defaultOpen =
    status === "blocked" ||
    status === "errored" ||
    (status === "complete" && hasBlockerSourceGap(invocation.output));
  const [open, setOpen] = useState(defaultOpen);
  const summary = getInvocationSummary(invocation, status);
  const skillLabel = getSkillLabel(invocation.skill);

  return (
    <Card
      className={cn(
        "overflow-hidden rounded-lg bg-card/70",
        status === "blocked" && "border-yellow-500/30",
        status === "errored" && "border-destructive/40",
        className
      )}
    >
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-sm font-medium text-foreground">
                {skillLabel}
              </p>
              <StatusBadge status={status} />
            </div>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {summary}
            </p>
          </div>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={
                open
                  ? `Collapse ${skillLabel}`
                  : `Expand ${skillLabel}`
              }
            >
              <ChevronIcon open={open} />
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <CardContent className="border-t border-border px-4 py-4">
            <InvocationBody invocation={invocation} status={status} />
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function InvocationBody({
  invocation,
  status,
}: {
  invocation: AgentInvocation;
  status: AgentInvocationStatus;
}): ReactElement {
  let body: ReactElement;

  if (!isLighthouseInvocationSkill(invocation.skill)) {
    body = <UnknownSkillBody skill={invocation.skill} />;
  } else if (!invocation.output) {
    body = <StatusBody status={status} />;
  } else if (isGenericSkillOutput(invocation.output)) {
    body = <GenericInsightsRenderer output={invocation.output} />;
  } else if (isGenericSectionOutput(invocation.output)) {
    body = <GenericSectionRenderer output={invocation.output} />;
  } else if (invocation.skill === "discover-url" && isIngestUrlOutput(invocation.output)) {
    body = <DiscoverUrlBody output={invocation.output} />;
  } else if (
    invocation.skill === "ingest-identity" &&
    isIngestIdentityOutput(invocation.output)
  ) {
    body = <IngestIdentityBody output={invocation.output} />;
  } else if (
    invocation.skill === "research-market" &&
    isResearchMarketOutput(invocation.output)
  ) {
    body = <ResearchMarketBody output={invocation.output} />;
  } else if (
    invocation.skill === "research-competitor" &&
    isResearchCompetitorOutput(invocation.output)
  ) {
    body = <ResearchCompetitorBody output={invocation.output} />;
  } else if (
    invocation.skill === "research-icp" &&
    isResearchIcpOutput(invocation.output)
  ) {
    body = <ResearchIcpBody output={invocation.output} />;
  } else {
    body = <UnknownOutputBody output={invocation.output} />;
  }

  return (
    <div className="flex flex-col gap-5">
      {body}
      <InvocationRunDetails invocation={invocation} />
    </div>
  );
}

function DiscoverUrlBody({ output }: { output: IngestUrlOutput }): ReactElement {
  const hasPrefilledFields = output.prefilled_fields.length > 0;
  const hasDiscoveredPages = output.discovered_pages.length > 0;
  const hasSourceGaps = output.source_gaps.length > 0;

  if (!hasPrefilledFields && !hasDiscoveredPages && !hasSourceGaps) {
    return (
      <p className="text-sm text-muted-foreground">
        No discover-url output sections are available yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {hasPrefilledFields ? (
        <section className="flex flex-col gap-3">
          <SectionHeading>Prefilled Fields</SectionHeading>
          <div className="grid gap-3 sm:grid-cols-2">
            {output.prefilled_fields.map((field) => (
              <PrefilledFieldItem key={field.field_key} field={field} />
            ))}
          </div>
        </section>
      ) : null}

      {hasDiscoveredPages ? (
        <section className="flex flex-col gap-3">
          <SectionHeading>Discovered Pages</SectionHeading>
          <div className="flex flex-wrap gap-2">
            {output.discovered_pages.map((page) => (
              <DiscoveredPageLink key={page.url} page={page} />
            ))}
          </div>
        </section>
      ) : null}

      {hasSourceGaps ? (
        <section className="flex flex-col gap-3">
          <SectionHeading>Source Gaps</SectionHeading>
          <SourceGapGroups gaps={output.source_gaps} />
        </section>
      ) : null}
    </div>
  );
}

function IngestIdentityBody({
  output,
}: {
  output: IngestIdentityOutput;
}): ReactElement {
  return (
    <div className="flex flex-col gap-5">
      <section className="grid gap-3 sm:grid-cols-3">
        <MetricTile label="Company" value={output.company_name} />
        <MetricTile label="Domain" value={output.domain} />
        <MetricTile label="Category" value={output.category} />
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <KeywordGroup title="Core Keywords" keywords={output.core_keywords} />
        <KeywordGroup
          title="Negative Keywords"
          keywords={output.negative_keywords}
        />
      </section>

      {output.sources.length > 0 ? (
        <section className="flex flex-col gap-3">
          <SectionHeading>Identity Sources</SectionHeading>
          <div className="flex flex-wrap gap-1.5">
            {output.sources.map((source, index) => (
              <SourceAnchor
                key={`${source.source_url}-${source.describes}-${index}`}
                sourceUrl={source.source_url}
                retrievedAt={source.retrieved_at}
                label={source.describes}
              />
            ))}
          </div>
        </section>
      ) : null}

      <SourceGapsSection gaps={output.source_gaps} />
    </div>
  );
}

function ResearchMarketBody({
  output,
}: {
  output: ResearchMarketOutput;
}): ReactElement {
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <SectionHeading>Market Summary</SectionHeading>
        <p className="text-sm leading-6 text-foreground">{output.summary}</p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <MetricTile
          label="Category"
          value={output.category_definition.category_name}
        />
        <MetricTile
          label="Maturity"
          value={output.category_maturity.maturity}
        />
        <MetricTile
          label="Sizing Status"
          value={output.category_definition.status}
        />
        <MetricTile
          label="Intensity"
          value={output.competitive_intensity.intensity}
        />
      </section>

      {output.key_findings.length > 0 ? (
        <section className="flex flex-col gap-3">
          <SectionHeading>Key Findings</SectionHeading>
          <BulletedList items={output.key_findings} />
        </section>
      ) : null}

      {output.market_size_signals.length > 0 ? (
        <section className="flex flex-col gap-3">
          <SectionHeading>Market Size Signals</SectionHeading>
          <div className="grid gap-3">
            {output.market_size_signals.map((signal, index) => (
              <div
                key={`${signal.market_scope}-${signal.value}-${index}`}
                className="rounded-md border border-border bg-background px-3 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{signal.label}</Badge>
                  <p className="text-sm font-medium text-foreground">
                    {signal.market_scope}
                  </p>
                </div>
                <p className="mt-1 text-sm text-foreground">{signal.value}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <SourceGapsSection gaps={output.source_gaps} />
    </div>
  );
}

function ResearchCompetitorBody({
  output,
}: {
  output: ResearchCompetitorOutput;
}): ReactElement {
  const pricingByName = new Map(
    output.pricing_reality.map((pricing) => [pricing.name, pricing])
  );

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3">
        <SectionHeading>Competitor Table</SectionHeading>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Public Pricing</th>
              </tr>
            </thead>
            <tbody>
              {output.competitor_set.map((competitor) => {
                const pricing = pricingByName.get(competitor.name);
                return (
                  <tr
                    key={`${competitor.name}-${competitor.type}`}
                    className="border-t border-border"
                  >
                    <td className="px-3 py-2 font-medium text-foreground">
                      {competitor.name}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {competitor.type}
                    </td>
                    <td className="px-3 py-2 text-foreground">
                      {pricing?.public_prices.join(", ") ?? "Not captured"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {output.share_of_voice.search_terms_owned.length > 0 ? (
        <section className="flex flex-col gap-3">
          <SectionHeading>Share Of Voice</SectionHeading>
          <div className="flex flex-wrap gap-1.5">
            {output.share_of_voice.search_terms_owned.map((term) => (
              <Badge key={term} variant="outline">
                {term}
              </Badge>
            ))}
          </div>
        </section>
      ) : null}

      {output.positioning_taxonomy.length > 0 ? (
        <section className="flex flex-col gap-3">
          <SectionHeading>Positioning</SectionHeading>
          <div className="grid gap-3">
            {output.positioning_taxonomy.slice(0, 5).map((positioning) => (
              <div
                key={`${positioning.name}-${positioning.source_url}`}
                className="rounded-md border border-border bg-background px-3 py-3"
              >
                <p className="text-sm font-medium text-foreground">
                  {positioning.name}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {positioning.solution_framing_verbatim}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {output.review_mined_feedback.length > 0 ? (
        <section className="flex flex-col gap-3">
          <SectionHeading>Review Signals</SectionHeading>
          <div className="grid gap-3">
            {output.review_mined_feedback.slice(0, 6).map((review, index) => (
              <div
                key={`${review.name}-${review.source_site}-${index}`}
                className="rounded-md border border-border bg-background px-3 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {review.name}
                  </p>
                  <Badge variant="outline">{review.polarity}</Badge>
                  <Badge variant="outline">{review.source_site}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {review.verbatim_quote}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {output.paid_social_ad_inventory.length > 0 ||
      output.ad_activity_signals.length > 0 ? (
        <section className="flex flex-col gap-3">
          <SectionHeading>Ad Signals</SectionHeading>
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricTile
              label="Paid Social Captures"
              value={String(output.paid_social_ad_inventory.length)}
            />
            <MetricTile
              label="Activity Signals"
              value={String(output.ad_activity_signals.length)}
            />
          </div>
        </section>
      ) : null}

      <SourceGapsSection gaps={output.source_gaps} />
    </div>
  );
}

function ResearchIcpBody({
  output,
}: {
  output: ResearchIcpOutput;
}): ReactElement {
  return (
    <div className="flex flex-col gap-5">
      {output.persona_anchors.length > 0 ? (
        <section className="flex flex-col gap-3">
          <SectionHeading>Persona Anchors</SectionHeading>
          <div className="grid gap-3">
            {output.persona_anchors.map((persona) => (
              <div
                key={`${persona.persona_name}-${persona.role_family}`}
                className="rounded-md border border-border bg-background px-3 py-3"
              >
                <p className="text-sm font-medium text-foreground">
                  {persona.persona_name}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {persona.role_family}
                  {persona.seniority ? ` · ${persona.seniority}` : ""}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {output.job_titles.length > 0 ? (
        <section className="flex flex-col gap-3">
          <SectionHeading>Job Titles</SectionHeading>
          <div className="flex flex-wrap gap-1.5">
            {output.job_titles.map((jobTitle) => (
              <Badge
                key={`${jobTitle.title}-${jobTitle.buying_role}`}
                variant="outline"
              >
                {jobTitle.title}
              </Badge>
            ))}
          </div>
        </section>
      ) : null}

      <SourceGapsSection gaps={output.source_gaps} />
    </div>
  );
}

function GenericInsightsRenderer({
  output,
}: {
  output: GenericSkillOutput;
}): ReactElement {
  return (
    <div className="flex flex-col gap-5">
      {output.insights.length > 0 ? (
        <section className="flex flex-col gap-3">
          <SectionHeading>Insights</SectionHeading>
          <div className="grid gap-3">
            {output.insights.map((insight) => (
              <div
                key={insight.title}
                className="rounded-md border border-border bg-background px-3 py-3"
              >
                <p className="text-sm font-medium text-foreground">
                  {insight.title}
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {insight.body}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {Object.keys(output.key_facts).length > 0 ? (
        <section className="flex flex-col gap-3">
          <SectionHeading>Key Facts</SectionHeading>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(output.key_facts).map(([key, fact]) => (
              <MetricTile key={key} label={key} value={fact.value} />
            ))}
          </div>
        </section>
      ) : null}

      <SourceGapsSection gaps={output.source_gaps} />
    </div>
  );
}

interface GenericSectionOutput {
  summary: string;
  keyFindings: string[];
  evidenceIds: string[];
  assumptions: string[];
}

function GenericSectionRenderer({
  output,
}: {
  output: GenericSectionOutput;
}): ReactElement {
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <SectionHeading>Summary</SectionHeading>
        <p className="text-sm leading-6 text-foreground">{output.summary}</p>
      </section>

      {output.keyFindings.length > 0 ? (
        <section className="flex flex-col gap-3">
          <SectionHeading>Key Findings</SectionHeading>
          <BulletedList items={output.keyFindings} />
        </section>
      ) : null}

      {output.evidenceIds.length > 0 ? (
        <section className="flex flex-col gap-3">
          <SectionHeading>Evidence</SectionHeading>
          <div className="flex flex-wrap gap-1.5">
            {output.evidenceIds.map((evidenceId) => (
              <Badge key={evidenceId} variant="outline">
                {evidenceId}
              </Badge>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function UnknownSkillBody({ skill }: { skill: string }): ReactElement {
  return (
    <div className="rounded-md border border-dashed border-border bg-background px-3 py-2 text-sm text-muted-foreground">
      {skill} rendering is not wired.
    </div>
  );
}

function UnknownOutputBody({ output }: { output: unknown }): ReactElement {
  const keys = isRecord(output) ? Object.keys(output).slice(0, 8) : [];

  return (
    <div className="rounded-md border border-dashed border-border bg-background px-3 py-2 text-sm text-muted-foreground">
      Output is available but does not match the renderer contract.
      {keys.length > 0 ? ` Keys: ${keys.join(", ")}` : ""}
    </div>
  );
}

function InvocationRunDetails({
  invocation,
}: {
  invocation: AgentInvocation;
}): ReactElement | null {
  const artifacts = invocation.artifacts ?? {};
  const artifactEntries = Object.entries(artifacts);
  const toolCallCount = invocation.toolCalls?.length ?? 0;

  if (
    artifactEntries.length === 0 &&
    !invocation.validation &&
    toolCallCount === 0 &&
    !invocation.error &&
    invocation.durationMs === undefined
  ) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3 border-t border-border pt-4">
      <SectionHeading>Run Details</SectionHeading>
      <div className="grid gap-2 sm:grid-cols-2">
        {invocation.durationMs !== undefined ? (
          <MetricTile
            label="Duration"
            value={`${Math.round(invocation.durationMs / 1000)}s`}
          />
        ) : null}
        {toolCallCount > 0 ? (
          <MetricTile label="Tool Calls" value={String(toolCallCount)} />
        ) : null}
      </div>

      {artifactEntries.length > 0 ? (
        <div className="flex flex-col gap-2">
          {artifactEntries.map(([name, path]) => (
            <div
              key={`${name}-${path}`}
              className="min-w-0 rounded-md border border-border bg-background px-3 py-2"
            >
              <p className="font-mono text-xs text-muted-foreground">{name}</p>
              <p className="mt-1 break-all font-mono text-xs text-foreground">
                {path}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {invocation.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {invocation.error}
        </p>
      ) : null}
    </section>
  );
}

function PrefilledFieldItem({
  field,
}: {
  field: PrefilledField;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const hasEvidence = field.evidence.length > 0;

  return (
    <div className="rounded-md border border-border bg-background px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{field.label}</p>
          <p className="mt-1 break-words text-sm text-foreground">
            {field.value}
          </p>
        </div>
        <Badge className={CONFIDENCE_STYLES[field.confidence]}>
          {field.confidence}
        </Badge>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {field.reason}
      </p>

      {hasEvidence ? (
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2 h-7 px-0 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground"
            >
              <ChevronIcon open={open} />
              {field.evidence.length} evidence
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {field.evidence.map((evidence, index) => (
                <EvidenceChip
                  key={`${field.field_key}-${evidence.source_url}-${index}`}
                  evidence={evidence}
                  index={index}
                />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  );
}

function EvidenceChip({
  evidence,
  index,
}: {
  evidence: SourcedClaim;
  index: number;
}): ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          asChild
          variant="outline"
          className="max-w-full cursor-pointer bg-muted text-muted-foreground transition-colors hover:text-foreground"
        >
          <a href={evidence.source_url} target="_blank" rel="noopener noreferrer">
            <span className="truncate">
              source {index + 1}: {formatSourceLabel(evidence.source_url)}
            </span>
          </a>
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p>{evidence.retrieved_at}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function DiscoveredPageLink({
  page,
}: {
  page: DiscoveredPage;
}): ReactElement {
  return (
    <a
      href={page.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs transition-colors hover:bg-muted"
    >
      <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
        {page.page_type}
      </Badge>
      <span className="truncate text-foreground">{page.url}</span>
    </a>
  );
}

function MetricTile({
  label,
  value,
}: {
  label: string;
  value: string;
}): ReactElement {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-foreground">
        {value}
      </p>
    </div>
  );
}

function KeywordGroup({
  title,
  keywords,
}: {
  title: string;
  keywords: string[];
}): ReactElement {
  return (
    <section className="flex flex-col gap-3">
      <SectionHeading>{title}</SectionHeading>
      {keywords.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {keywords.map((keyword) => (
            <Badge key={keyword} variant="outline">
              {keyword}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No keywords captured.</p>
      )}
    </section>
  );
}

function BulletedList({ items }: { items: string[] }): ReactElement {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li
          key={item}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

function SourceAnchor({
  sourceUrl,
  retrievedAt,
  label,
}: {
  sourceUrl: string;
  retrievedAt: string;
  label: string;
}): ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          asChild
          variant="outline"
          className="max-w-full cursor-pointer bg-muted text-muted-foreground transition-colors hover:text-foreground"
        >
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
            <span className="truncate">
              {label}: {formatSourceLabel(sourceUrl)}
            </span>
          </a>
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p>{retrievedAt}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function SourceGapsSection({ gaps }: { gaps: SourceGap[] }): ReactElement | null {
  if (gaps.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3">
      <SectionHeading>Source Gaps</SectionHeading>
      <SourceGapGroups gaps={gaps} />
    </section>
  );
}

function SourceGapGroups({ gaps }: { gaps: SourceGap[] }): ReactElement {
  const groupedGaps = useMemo(() => groupSourceGaps(gaps), [gaps]);

  return (
    <div className="flex flex-col gap-3">
      {groupedGaps.blockers.length > 0 ? (
        <div className="flex flex-col gap-2">
          {groupedGaps.blockers.map((gap) => (
            <SourceGapItem key={`blocker-${gap.field}`} gap={gap} />
          ))}
        </div>
      ) : null}

      {groupedGaps.warns.length > 0 ? (
        <div className="flex flex-col gap-2">
          {groupedGaps.warns.map((gap) => (
            <SourceGapItem key={`warn-${gap.field}`} gap={gap} />
          ))}
        </div>
      ) : null}

      {groupedGaps.infos.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {groupedGaps.infos.map((gap) => (
            <SourceGapItem key={`info-${gap.field}`} gap={gap} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StatusBody({
  status,
}: {
  status: AgentInvocationStatus;
}): ReactElement {
  const statusCopy: Record<AgentInvocationStatus, string> = {
    running: "The skill is running. Output will appear here when the worker writes a validated result.",
    complete: "The skill completed, but no output was provided to this block.",
    blocked: "The skill is blocked. Source gaps will appear here when available.",
    errored: "The skill errored before a validated output was available.",
  };

  return (
    <p className="text-sm text-muted-foreground">{statusCopy[status]}</p>
  );
}

function StatusBadge({
  status,
}: {
  status: AgentInvocationStatus;
}): ReactElement {
  const style = STATUS_STYLES[status];

  return (
    <Badge variant={style.variant} className={style.className}>
      {style.label}
    </Badge>
  );
}

function SectionHeading({ children }: { children: string }): ReactElement {
  return (
    <h3 className="text-sm font-medium text-muted-foreground">{children}</h3>
  );
}

function ChevronIcon({ open }: { open: boolean }): ReactElement {
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
      aria-hidden="true"
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

function getInvocationSummary(
  invocation: AgentInvocation,
  status: AgentInvocationStatus
): string {
  if (invocation.summary) {
    return invocation.summary;
  }

  if (!isLighthouseInvocationSkill(invocation.skill)) {
    return `${invocation.skill} output renderer is not wired.`;
  }

  if (!invocation.output) {
    if (status === "errored") {
      return `Worker failed before ${getSkillLabel(invocation.skill)} produced validated output.`;
    }

    return status === "running"
      ? `Waiting for validated ${getSkillLabel(invocation.skill)} output.`
      : `No ${getSkillLabel(invocation.skill)} output provided.`;
  }

  if (isGenericSkillOutput(invocation.output)) {
    return `${invocation.output.insights.length} insights · ${invocation.output.source_gaps.length} gaps`;
  }

  if (isGenericSectionOutput(invocation.output)) {
    return `${invocation.output.keyFindings.length} findings · ${invocation.output.assumptions.length} assumptions`;
  }

  if (invocation.skill === "ingest-identity" && isIngestIdentityOutput(invocation.output)) {
    const output = invocation.output;
    return `${output.company_name} · ${output.category} · ${output.source_gaps.length} gaps`;
  }

  if (invocation.skill === "research-market" && isResearchMarketOutput(invocation.output)) {
    const output = invocation.output;
    return `${output.category_definition.category_name} · ${output.key_findings.length} findings · ${output.source_gaps.length} gaps`;
  }

  if (
    invocation.skill === "research-competitor" &&
    isResearchCompetitorOutput(invocation.output)
  ) {
    const output = invocation.output;
    return `${output.competitor_set.length} competitors · ${output.pricing_reality.length} pricing captures · ${output.source_gaps.length} gaps`;
  }

  if (invocation.skill === "research-icp" && isResearchIcpOutput(invocation.output)) {
    const output = invocation.output;
    return `${output.persona_anchors.length} personas · ${output.job_titles.length} titles · ${output.source_gaps.length} gaps`;
  }

  if (isIngestUrlOutput(invocation.output)) {
    const output = invocation.output;
    const fieldCount = output.prefilled_fields.length;
    const pageCount = output.discovered_pages.length;
    const gapCount = output.source_gaps.length;

    return `${output.company_name.value} · ${fieldCount} fields · ${pageCount} pages · ${gapCount} gaps`;
  }

  return `${getSkillLabel(invocation.skill)} output available`;
}

function hasBlockerSourceGap(output: unknown): boolean {
  const gaps = getSourceGaps(output);
  return gaps.some((gap) => gap.severity === "blocker");
}

function groupSourceGaps(gaps: SourceGap[]): {
  blockers: SourceGap[];
  warns: SourceGap[];
  infos: SourceGap[];
} {
  return {
    blockers: gaps.filter((gap) => gap.severity === "blocker"),
    warns: gaps.filter((gap) => gap.severity === "warn"),
    infos: gaps.filter((gap) => gap.severity === "info"),
  };
}

function formatSourceLabel(sourceUrl: string): string {
  try {
    const url = new URL(sourceUrl);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return sourceUrl;
  }
}

function getSkillLabel(skill: string): string {
  if (isLighthouseInvocationSkill(skill)) {
    return SKILL_LABELS[skill];
  }

  return skill;
}

function isLighthouseInvocationSkill(
  skill: string
): skill is LighthouseInvocationSkill {
  return skill in SKILL_LABELS;
}

function isGenericSkillOutput(output: unknown): output is GenericSkillOutput {
  return (
    isRecord(output) &&
    Array.isArray(output.insights) &&
    isRecord(output.key_facts) &&
    Array.isArray(output.source_gaps)
  );
}

function isGenericSectionOutput(output: unknown): output is GenericSectionOutput {
  return (
    isRecord(output) &&
    typeof output.summary === "string" &&
    Array.isArray(output.keyFindings) &&
    Array.isArray(output.evidenceIds) &&
    Array.isArray(output.assumptions)
  );
}

function isIngestUrlOutput(output: unknown): output is IngestUrlOutput {
  return (
    isRecord(output) &&
    Array.isArray(output.prefilled_fields) &&
    Array.isArray(output.discovered_pages) &&
    Array.isArray(output.source_gaps) &&
    isRecord(output.company_name)
  );
}

function isIngestIdentityOutput(output: unknown): output is IngestIdentityOutput {
  return (
    isRecord(output) &&
    typeof output.company_name === "string" &&
    typeof output.domain === "string" &&
    typeof output.category === "string" &&
    Array.isArray(output.core_keywords) &&
    Array.isArray(output.negative_keywords) &&
    Array.isArray(output.sources) &&
    Array.isArray(output.source_gaps)
  );
}

function isResearchMarketOutput(output: unknown): output is ResearchMarketOutput {
  return (
    isRecord(output) &&
    isRecord(output.category_definition) &&
    isRecord(output.category_maturity) &&
    isRecord(output.competitive_intensity) &&
    typeof output.summary === "string" &&
    Array.isArray(output.key_findings) &&
    Array.isArray(output.market_size_signals) &&
    Array.isArray(output.source_gaps)
  );
}

function isResearchCompetitorOutput(output: unknown): output is ResearchCompetitorOutput {
  return (
    isRecord(output) &&
    Array.isArray(output.competitor_set) &&
    Array.isArray(output.pricing_reality) &&
    isRecord(output.share_of_voice) &&
    Array.isArray(output.review_mined_feedback) &&
    Array.isArray(output.positioning_taxonomy) &&
    Array.isArray(output.paid_social_ad_inventory) &&
    Array.isArray(output.ad_activity_signals) &&
    Array.isArray(output.source_gaps)
  );
}

function isResearchIcpOutput(output: unknown): output is ResearchIcpOutput {
  return (
    isRecord(output) &&
    Array.isArray(output.persona_anchors) &&
    Array.isArray(output.job_titles) &&
    Array.isArray(output.source_gaps)
  );
}

function getSourceGaps(output: unknown): SourceGap[] {
  if (!isRecord(output) || !Array.isArray(output.source_gaps)) {
    return [];
  }

  return output.source_gaps.filter(isSourceGap);
}

function isSourceGap(value: unknown): value is SourceGap {
  return (
    isRecord(value) &&
    typeof value.field === "string" &&
    typeof value.reason === "string" &&
    typeof value.remediation === "string" &&
    (value.severity === "info" ||
      value.severity === "warn" ||
      value.severity === "blocker") &&
    typeof value.confidence === "number"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
