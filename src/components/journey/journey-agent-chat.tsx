"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BrainIcon,
  CheckCircle2,
  ChevronDown,
  Globe2,
  Play,
  SearchIcon,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Artifact,
  ArtifactContent,
  ArtifactHeader,
  ArtifactTitle,
} from "@/components/ai-elements/artifact";
import type {
  ShadcnReasoningStep,
} from "@/lib/journey/shadcn-adapters";
import {
  journeyArtifactToShadcnProps,
  agentStepsToReasoningProps,
  urlsToSources,
} from "@/lib/journey/shadcn-adapters";
import { Conversation } from "@/components/ai-elements/conversation";
import { ConversationContent } from "@/components/ai-elements/conversation";
import { ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message } from "@/components/ai-elements/message";
import { MessageContent } from "@/components/ai-elements/message";
import { MessageResponse } from "@/components/ai-elements/message";
import { PromptInput } from "@/components/ai-elements/prompt-input";
import { PromptInputFooter } from "@/components/ai-elements/prompt-input";
import { PromptInputTools } from "@/components/ai-elements/prompt-input";
import { PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { PromptInputSubmit } from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Sources } from "@/components/ai-elements/sources";
import { SourcesTrigger } from "@/components/ai-elements/sources";
import { SourcesContent } from "@/components/ai-elements/sources";
import { Source } from "@/components/ai-elements/sources";
import { Tool } from "@/components/ai-elements/tool";
import { ToolContent } from "@/components/ai-elements/tool";
import { ToolHeader } from "@/components/ai-elements/tool";
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtStep,
} from "@/components/ai-elements/chain-of-thought";
import {
  Queue,
  QueueItem,
  QueueItemContent,
  QueueItemIndicator,
} from "@/components/ai-elements/queue";
import {
  Terminal,
  TerminalContent,
  TerminalHeader,
  TerminalStatus,
  TerminalTitle,
} from "@/components/ai-elements/terminal";
import type { ResearchSectionResult } from "@/lib/journey/research-realtime";
import type { ResearchJobActivity } from "@/lib/journey/research-job-activity-core";
import { parseJourneyResearchInput } from "@/lib/journey/research-command";
import {
  buildDeepResearchAgentStreamState,
} from "@/lib/journey/research-stream-buffer";
import type { JourneyArtifactState } from "@/lib/journey/research-artifact-state";

export type ArtifactStage =
  | "corpus-building"
  | "onboarding-review"
  | "section-streaming";

const REPORT_SECTION_ORDER = [
  "industryMarket",
  "icpValidation",
  "competitors",
  "offerAnalysis",
  "keywordIntel",
  "crossAnalysis",
  "mediaPlan",
] as const;

const SECTION_DISPLAY_LABELS: Record<string, string> = {
  industryMarket: "Industry Research",
  icpValidation: "ICP Validation",
  competitors: "Competitor Intel",
  offerAnalysis: "Offer Analysis",
  keywordIntel: "Keyword Intelligence",
  crossAnalysis: "Strategic Synthesis",
  mediaPlan: "Media Plan",
};

const FIELD_DISPLAY_LABELS: Record<string, string> = {
  companyName: "Company name",
  websiteUrl: "Website",
  businessModel: "Business model",
  industry: "Industry",
  productCategory: "Product category",
  targetMarket: "Target market",
  primaryAudience: "Primary audience",
  valueProposition: "Value proposition",
  pricingModel: "Pricing model",
  competitors: "Competitors",
};

interface JourneyAgentChatProps {
  websiteUrl: string;
  onWebsiteUrlChange: (value: string) => void;
  onSubmitWebsite: (input: string) => void;
  activeRunId: string | null;
  companyName: string | null;
  phase: "welcome" | "prefilling" | "resume" | "workspace";
  deepResearchStatus: "idle" | "starting" | "queued" | "complete" | "error";
  deepResearchError: string | null;
  deepResearchFields: Record<string, string>;
  researchActivity: Record<string, ResearchJobActivity | undefined>;
  researchResults: Record<string, ResearchSectionResult | null>;
  activeResearchSections?: ReadonlySet<string>;
  messages: ReadonlyArray<unknown>;
  nextSectionLabel?: string | null;
  isNextSectionRunning?: boolean;
  onRunNextSection?: () => void;
  onRetryDeepResearch?: () => void;
  onStartFresh?: () => void;
  artifactStage?: ArtifactStage;
}

interface NextSectionControlProps {
  nextSectionLabel?: string | null;
  isNextSectionRunning?: boolean;
  onRunNextSection?: () => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readTextParts(message: unknown): string {
  if (!isRecord(message)) return "";
  if (typeof message.content === "string") return message.content.trim();
  const parts = Array.isArray(message.parts) ? message.parts : [];
  return parts
    .map((part) => {
      if (!isRecord(part)) return "";
      return typeof part.text === "string" ? part.text : "";
    })
    .join("")
    .trim();
}

function getMessageRole(message: unknown): string | null {
  return isRecord(message) && typeof message.role === "string" ? message.role : null;
}

function formatArtifactGrowth(completedCount: number, totalCount: number): string {
  const sectionLabel = totalCount === 1 ? "section" : "sections";
  return `${completedCount} of ${totalCount} ${sectionLabel} saved`;
}

function formatFieldLabel(key: string): string {
  if (FIELD_DISPLAY_LABELS[key]) return FIELD_DISPLAY_LABELS[key];
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function NextSectionControl({
  nextSectionLabel,
  isNextSectionRunning,
  onRunNextSection,
}: NextSectionControlProps): React.JSX.Element | null {
  if (!nextSectionLabel || !onRunNextSection) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-[780px] px-4 py-3">
      <div
        data-testid="journey-next-section-control"
        className="flex flex-col gap-4 rounded-md border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Operator control
            </p>
            <Badge variant="outline">
              {isNextSectionRunning ? "running" : "ready"}
            </Badge>
          </div>
          <p className="mt-1 text-sm font-medium text-foreground">
            Next report section: {nextSectionLabel}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground" aria-live="polite">
            {isNextSectionRunning
              ? `${nextSectionLabel} is writing into the live artifact below.`
              : `Company research is ready. Run ${nextSectionLabel} when you want the next report section written.`}
          </p>
        </div>
        <Button
          type="button"
          onClick={onRunNextSection}
          disabled={isNextSectionRunning}
          className="w-full shrink-0 gap-2 sm:w-auto"
          aria-label={`Run next research section: ${nextSectionLabel}`}
        >
          <Play className="size-4" aria-hidden="true" />
          {isNextSectionRunning ? `Running ${nextSectionLabel}` : "Run section"}
        </Button>
      </div>
    </div>
  );
}

// --- Compact step status tools (chat side, Stage 3) ---

function stepToolState(status: string): "input-available" | "output-available" | "output-error" {
  if (status === "running") return "input-available";
  if (status === "error") return "output-error";
  return "output-available";
}

function CompactStepTools({ steps }: { steps: ShadcnReasoningStep[] }): React.JSX.Element | null {
  if (steps.length === 0) return null;

  return (
    <div className="mx-auto w-full max-w-[780px] space-y-1 px-4 py-2">
      {steps.map((step) => {
        const isRunning = step.status === "running";

        return (
          <Tool key={step.id} defaultOpen={false} className="mb-0">
            <ToolHeader
              type="dynamic-tool"
              toolName={step.id}
              title={step.name}
              state={stepToolState(step.status)}
            />
            <ToolContent className="py-2 px-3">
              <p className="text-xs text-muted-foreground">
                {step.verdict ?? step.description}
              </p>
              {isRunning ? (
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Writing report section...
                </p>
              ) : null}
            </ToolContent>
          </Tool>
        );
      })}
    </div>
  );
}

// --- Source List ---

function SourceList({ urls }: { urls: string[] }) {
  const sources = urlsToSources(urls);
  if (sources.length === 0) return null;

  return (
    <Sources>
      <SourcesTrigger count={sources.length} />
      <SourcesContent>
        {sources.map((source) => (
          <Source key={source.url} href={source.url} title={source.title ?? undefined} />
        ))}
      </SourcesContent>
    </Sources>
  );
}

// --- Stage 1: Corpus Terminal ---
// Bloomberg-terminal style streaming view of source URLs being collected.

interface CorpusTerminalProps {
  artifact: JourneyArtifactState;
  isStreaming: boolean;
  websiteHost: string | null;
}

function buildTerminalOutput(artifact: JourneyArtifactState): string {
  const corpus = artifact.sections.find(
    (s) => s.section === "deepResearchProgram",
  );
  if (!corpus) {
    return "Initializing source-backed research...";
  }

  const lines: string[] = [];
  lines.push(`> phase: ${corpus.status}`);
  lines.push(`> sources collected: ${corpus.sourceUrls.length}`);
  lines.push("");

  if (corpus.sourceUrls.length === 0) {
    lines.push("Awaiting first source. Search engine warming...");
  } else {
    for (const url of corpus.sourceUrls) {
      lines.push(`+ ${url}`);
    }
  }

  return lines.join("\n");
}

function CorpusTerminal({
  artifact,
  isStreaming,
  websiteHost,
}: CorpusTerminalProps): React.JSX.Element {
  const output = buildTerminalOutput(artifact);
  const corpus = artifact.sections.find(
    (s) => s.section === "deepResearchProgram",
  );
  const sourceCount = corpus?.sourceUrls.length ?? 0;
  const stepLabel = corpus?.status === "complete"
    ? "corpus complete"
    : isStreaming
      ? "scoring relevance"
      : "starting";
  const headerHost = websiteHost ?? "research-corpus";

  return (
    <div
      className="mx-auto w-full max-w-[780px] px-4 py-3"
      data-testid="journey-corpus-terminal"
    >
      <Terminal output={output} isStreaming={isStreaming}>
        <TerminalHeader>
          <TerminalTitle>
            <span className="font-mono uppercase tracking-wide">
              {headerHost.toUpperCase()}
            </span>
            <span className="ml-3 text-xs">
              sources: {sourceCount} | step: {stepLabel}
            </span>
          </TerminalTitle>
          <TerminalStatus />
        </TerminalHeader>
        <TerminalContent />
      </Terminal>
    </div>
  );
}

// --- Stage 1: Chain of Thought reasoning ---

function reasoningIcon(stepId: string) {
  if (stepId === "deepResearchProgram") return SearchIcon;
  return BrainIcon;
}

function chainStepStatus(
  status: ShadcnReasoningStep["status"],
): "complete" | "active" | "pending" {
  if (status === "complete" || status === "partial") return "complete";
  if (status === "running") return "active";
  return "pending";
}

interface CorpusReasoningProps {
  steps: ShadcnReasoningStep[];
}

function CorpusReasoning({ steps }: CorpusReasoningProps): React.JSX.Element | null {
  if (steps.length === 0) return null;

  return (
    <div className="mx-auto w-full max-w-[780px] px-4 py-3">
      <div
        data-testid="journey-chain-of-thought"
        className="rounded-md border bg-card p-4"
      >
        <ChainOfThought defaultOpen>
          <ChainOfThoughtHeader>Reasoning trace</ChainOfThoughtHeader>
          <ChainOfThoughtContent>
            {steps.map((step) => (
              <ChainOfThoughtStep
                key={step.id}
                icon={reasoningIcon(step.id)}
                label={step.name}
                description={step.verdict ?? step.description}
                status={chainStepStatus(step.status)}
              />
            ))}
          </ChainOfThoughtContent>
        </ChainOfThought>
      </div>
    </div>
  );
}

// --- Stage 2: Onboarding review card ---

interface OnboardingReviewCardProps {
  fields: Record<string, string>;
}

function OnboardingReviewCard({
  fields,
}: OnboardingReviewCardProps): React.JSX.Element {
  const entries = Object.entries(fields).filter(([, value]) => value.trim().length > 0);

  return (
    <div
      className="mx-auto w-full max-w-[780px] px-4 py-3"
      data-testid="journey-onboarding-review"
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Company research corpus saved
          </CardTitle>
          <CardDescription>
            Review the prefilled fields. Run the first report section when ready.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {entries.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No fields prefilled yet.
            </p>
          ) : (
            entries.map(([key, value]) => (
              <div
                key={key}
                className="flex flex-col gap-1 rounded-md border bg-muted/35 p-3"
                data-testid={`journey-onboarding-field-${key}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    {formatFieldLabel(key)}
                  </span>
                  <Badge variant="outline" className="text-[10px] font-normal">
                    AI filled
                  </Badge>
                </div>
                <p className="text-sm leading-5 text-foreground">{value}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// --- Stage 3: Section Queue ---

interface SectionQueueProps {
  researchResults: Record<string, ResearchSectionResult | null>;
  activeResearchSections?: ReadonlySet<string>;
}

function SectionQueue({
  researchResults,
  activeResearchSections,
}: SectionQueueProps): React.JSX.Element {
  return (
    <div
      className="mx-auto w-full max-w-[780px] px-4 py-3"
      data-testid="journey-section-queue"
    >
      <Queue className="rounded-md">
        <p className="px-1 pt-1 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Report queue
        </p>
        <ul className="space-y-0.5">
          {REPORT_SECTION_ORDER.map((section) => {
            const result = researchResults[section];
            const isComplete = result?.status === "complete";
            const isPartial = result?.status === "partial";
            const isError = result?.status === "error";
            const isActive = activeResearchSections?.has(section) ?? false;
            const label = SECTION_DISPLAY_LABELS[section] ?? section;
            const stateLabel = isError
              ? "error"
              : isComplete
                ? "complete"
                : isPartial
                  ? "draft"
                  : isActive
                    ? "running"
                    : "pending";

            return (
              <QueueItem
                key={section}
                data-testid={`journey-queue-item-${section}`}
                data-state={stateLabel}
                aria-current={isActive ? "step" : undefined}
                className={
                  isActive
                    ? "border border-primary/40 bg-primary/[0.06]"
                    : undefined
                }
              >
                <div className="flex w-full items-center gap-2">
                  <QueueItemIndicator completed={isComplete || isPartial} />
                  <QueueItemContent
                    completed={isComplete}
                    className={isActive ? "text-foreground" : undefined}
                  >
                    {label}
                  </QueueItemContent>
                  <Badge
                    variant="outline"
                    className="ml-auto text-[10px] font-normal"
                  >
                    {stateLabel}
                  </Badge>
                </div>
              </QueueItem>
            );
          })}
        </ul>
      </Queue>
    </div>
  );
}

// --- Stage 3: Artifact Panel ---

function statusLabel(status: string): string {
  if (status === "drafting" || status === "researching" || status === "citing" || status === "queued") {
    return "streaming";
  }
  if (status === "partial") return "draft";
  if (status === "error") return "needs review";
  return "ready";
}

function cleanArtifactContent(content: string): string {
  return content
    .replace(/^#\s+https?:\/\/[^\s]+\s+GTM Research\s*/i, "")
    .replace(/^#\s+https?:\/\/[^\s]+\s*/im, "")
    .replace(
      /^#{1,3}\s+(Deep Research|Market Category|ICP Validation|Competitor Intel|Offer Analysis|Keyword Intel|Strategic Synthesis)\s*$/gim,
      "",
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isStreamingStatus(status: string): boolean {
  return status === "drafting" || status === "researching" || status === "citing" || status === "queued";
}

function ArtifactPanel({ artifact }: { artifact: JourneyArtifactState }) {
  const props = journeyArtifactToShadcnProps(artifact);
  // Stage 3 only renders the report sections, never the corpus deepResearchProgram entry.
  const reportSections = props.sections.filter(
    (s) => s.id !== "deepResearchProgram",
  );
  const reportCompletedCount = reportSections.filter(
    (s) => s.status === "complete" || s.status === "partial",
  ).length;
  const reportTotal = reportSections.length;
  const reportHasStreaming = reportSections.some((s) => isStreamingStatus(s.status));
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    if (props.activeSection && props.activeSection !== "deepResearchProgram") {
      setActiveSection(props.activeSection);
    }
  }, [props.activeSection]);

  if (reportSections.length === 0) return null;

  const displaySections = activeSection
    ? reportSections.filter((s) => s.id === activeSection)
    : reportSections;

  return (
    <div
      className="mx-auto w-full max-w-[780px] px-4 py-3"
      data-testid="deep-research-report-artifact"
    >
      <Artifact>
        <ArtifactHeader>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Live GTM Research Artifact
            </p>
            <ArtifactTitle className="mt-1.5 text-lg">
              {props.title}
            </ArtifactTitle>
            <p
              data-testid="artifact-growth-summary"
              className="mt-2 text-xs text-muted-foreground"
              aria-live="polite"
            >
              {formatArtifactGrowth(reportCompletedCount, reportTotal)}
              {reportHasStreaming ? " - live update active" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {reportHasStreaming ? (
              <Badge variant="default">streaming</Badge>
            ) : reportCompletedCount === reportTotal ? (
              <Badge className="border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-200">
                complete
              </Badge>
            ) : null}
          </div>
        </ArtifactHeader>

        {reportSections.length > 1 ? (
          <div className="flex gap-0 overflow-x-auto border-b px-4">
            {reportSections.map((section) => {
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() =>
                    setActiveSection(activeSection === section.id ? null : section.id)
                  }
                  className={`cursor-pointer shrink-0 border-b-2 px-3 py-2.5 text-[12px] font-medium transition-colors duration-150 ${
                    isActive
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground/80"
                  }`}
                >
                  {section.title}
                  <span
                    className={`ml-2 inline-block h-1.5 w-1.5 rounded-full ${
                      section.status === "complete" || section.status === "partial"
                        ? "bg-emerald-400"
                        : isStreamingStatus(section.status)
                          ? "bg-blue-400 animate-pulse"
                          : section.status === "error"
                            ? "bg-red-400"
                            : "bg-muted-foreground"
                    }`}
                  />
                </button>
              );
            })}
          </div>
        ) : null}

        <ArtifactContent>
          <div className="space-y-0">
            {displaySections.map((section, index) => {
              const isPartial = section.status === "partial";
              const isError = section.status === "error";
              const cleaned = cleanArtifactContent(section.content);

              return (
                <section key={section.id}>
                  {index > 0 ? (
                    <div className="my-4 flex items-center gap-2 text-xs text-emerald-300/70">
                      <div className="h-px flex-1 bg-emerald-400/[0.12]" />
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>Chapter complete</span>
                      <div className="h-px flex-1 bg-emerald-400/[0.12]" />
                    </div>
                  ) : null}
                  <div className={index > 0 ? "pt-2" : ""}>
                    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                      <Sparkles className="h-3.5 w-3.5 text-primary/60" aria-hidden="true" />
                      <span className="font-medium text-foreground/80">
                        {section.title}
                      </span>
                      <Badge variant="outline">{statusLabel(section.status)}</Badge>
                    </div>
                    {isPartial ? (
                      <div className="mb-4 rounded-md border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-sm text-amber-100">
                        This section is incomplete. Some content is available below.
                      </div>
                    ) : null}
                    {isError ? (
                      <div className="mb-4 rounded-md border border-red-400/20 bg-red-400/[0.06] px-4 py-3 text-sm text-red-100">
                        This section failed to generate.
                      </div>
                    ) : null}
                    <div className="space-y-3">
                      <MessageResponse>{cleaned || section.content}</MessageResponse>
                    </div>
                    <SourceList urls={section.sourceUrls} />
                  </div>
                </section>
              );
            })}
          </div>
        </ArtifactContent>
      </Artifact>
    </div>
  );
}

// --- Stage derivation helper (default when no prop passed) ---

function deriveDefaultStage(args: {
  phase: JourneyAgentChatProps["phase"];
  deepResearchStatus: JourneyAgentChatProps["deepResearchStatus"];
  researchActivity: Record<string, ResearchJobActivity | undefined>;
  researchResults: Record<string, ResearchSectionResult | null>;
  activeResearchSections?: ReadonlySet<string>;
}): ArtifactStage {
  const reportTouched = REPORT_SECTION_ORDER.some(
    (section) =>
      args.activeResearchSections?.has(section) ||
      Boolean(args.researchResults[section]) ||
      Boolean(args.researchActivity[section]),
  );

  if (reportTouched) return "section-streaming";

  if (
    args.deepResearchStatus === "complete" &&
    args.phase === "workspace"
  ) {
    return "onboarding-review";
  }

  return "corpus-building";
}

function getWebsiteHost(websiteUrl: string): string | null {
  const trimmed = websiteUrl.trim();
  if (!trimmed) return null;
  try {
    const withProtocol = trimmed.startsWith("http")
      ? trimmed
      : `https://${trimmed}`;
    return new URL(withProtocol).hostname;
  } catch {
    return null;
  }
}

// --- Main Export ---

export function JourneyAgentChat({
  websiteUrl,
  onWebsiteUrlChange,
  onSubmitWebsite,
  activeRunId,
  companyName,
  phase,
  deepResearchStatus,
  deepResearchError,
  deepResearchFields,
  researchActivity,
  researchResults,
  activeResearchSections,
  messages,
  nextSectionLabel,
  isNextSectionRunning,
  onRunNextSection,
  onRetryDeepResearch,
  onStartFresh,
  artifactStage,
}: JourneyAgentChatProps): React.JSX.Element {
  const hasSubmittedUrl =
    activeRunId !== null ||
    deepResearchStatus !== "idle" ||
    deepResearchError !== null ||
    phase === "workspace" ||
    phase === "prefilling";
  const researchCommand = useMemo(
    () => parseJourneyResearchInput(websiteUrl),
    [websiteUrl],
  );
  const isGenerating = deepResearchStatus === "starting" || deepResearchStatus === "queued";

  const agentState = useMemo(
    () =>
      buildDeepResearchAgentStreamState({
        activeRunId,
        activeResearchSections,
        deepResearchStatus,
        phase,
        researchActivity,
        researchResults,
      }),
    [
      activeResearchSections,
      activeRunId,
      deepResearchStatus,
      phase,
      researchActivity,
      researchResults,
    ],
  );

  const displayedMessages = useMemo(
    () =>
      (messages as Array<unknown>)
        .map((message, index) => ({
          id:
            isRecord(message) && typeof message.id === "string"
              ? message.id
              : `message-${index}`,
          role: getMessageRole(message),
          text: readTextParts(message),
        }))
        .filter((m) => m.text.length > 0),
    [messages],
  );

  const reasoningSteps = useMemo(
    () => agentStepsToReasoningProps(agentState.visibleSteps),
    [agentState.visibleSteps],
  );

  const reportReasoningSteps = useMemo(
    () => reasoningSteps.filter((step) => step.id !== "deepResearchProgram"),
    [reasoningSteps],
  );

  const resolvedStage: ArtifactStage = useMemo(
    () =>
      artifactStage ??
      deriveDefaultStage({
        phase,
        deepResearchStatus,
        researchActivity,
        researchResults,
        activeResearchSections,
      }),
    [
      activeResearchSections,
      artifactStage,
      deepResearchStatus,
      phase,
      researchActivity,
      researchResults,
    ],
  );

  const websiteHost = useMemo(
    () => getWebsiteHost(websiteUrl) ?? (companyName ?? null),
    [companyName, websiteUrl],
  );

  const handlePromptSubmit = (promptMessage: { text: string; files: unknown[] }) => {
    const nextInput = promptMessage.text.trim();
    onWebsiteUrlChange(nextInput);
    if (!isGenerating) {
      onSubmitWebsite(nextInput);
    }
  };

  const showWelcome = !hasSubmittedUrl && displayedMessages.length === 0;

  // Compact assistant status — Tool component, single source of truth.
  const assistantToolState: "input-available" | "output-available" | "output-error" =
    deepResearchError
      ? "output-error"
      : isGenerating
        ? "input-available"
        : "output-available";

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background/90 px-4 backdrop-blur-md">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {companyName ? `${companyName} Journey` : "AI-GOS Journey"}
          </p>
          <p className="text-xs text-muted-foreground">GTM research workspace</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">
            {activeRunId ? `run ${activeRunId.slice(-6)}` : "new run"}
          </Badge>
          {onStartFresh ? (
            <Button
              type="button"
              onClick={onStartFresh}
              variant="outline"
              size="xs"
              className="rounded-full"
            >
              New
            </Button>
          ) : null}
        </div>
      </header>

      <div className="min-h-0 flex flex-1 flex-col overflow-hidden">
        {showWelcome ? (
          <div className="flex h-full overflow-y-auto px-4 py-8 sm:px-6 lg:py-10">
            <div className="mx-auto grid w-full max-w-5xl content-center gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <Card className="overflow-hidden">
                <CardHeader className="gap-5 p-6 sm:p-8">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="rounded-full">
                      GTM agent chat
                    </Badge>
                    <Badge variant="secondary" className="rounded-full">
                      Source-backed research
                    </Badge>
                  </div>
                  <div className="space-y-4">
                    <h1 className="max-w-2xl text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
                      What company should I research?
                    </h1>
                    <CardDescription className="max-w-2xl text-sm leading-6 sm:text-base">
                      Paste a company URL to start a source-backed GTM run.
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3 p-6 pt-0 sm:grid-cols-3 sm:p-8 sm:pt-0">
                  {[
                    ["Company research", "Source collection + analysis"],
                    ["GTM specialists", "Market, ICP, competitors, offer"],
                    ["Report artifact", "Evidence, gaps, and GTM moves"],
                  ].map(([title, description]) => (
                    <Card key={title} className="bg-muted/35">
                      <CardContent className="p-4">
                        <div className="mb-3 flex size-8 items-center justify-center rounded-md border bg-background">
                          <Sparkles className="size-4 text-primary" aria-hidden="true" />
                        </div>
                        <p className="text-sm font-medium">{title}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {description}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-muted/25">
                <CardHeader className="p-5">
                  <CardTitle className="text-sm">Run queue</CardTitle>
                  <CardDescription>Ready for a company URL.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 p-5 pt-0">
                  {["Research corpus", "Specialist sections", "Final artifact"].map((item, index) => (
                    <div key={item} className="flex items-center gap-3 rounded-md border bg-background/70 px-3 py-2.5">
                      <div className="flex size-7 items-center justify-center rounded-full border text-xs text-muted-foreground">
                        {index + 1}
                      </div>
                      <span className="text-sm">{item}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <Conversation className="h-full min-h-0 overflow-y-auto">
            <ConversationContent className="gap-3 px-0 py-6 pb-10">
              <div className="mx-auto w-full max-w-[780px] px-4 py-2">
                <div
                  data-testid="journey-user-command"
                  className="ml-auto max-w-[82%] rounded-md rounded-tr-sm bg-secondary px-4 py-3 text-sm leading-6"
                >
                  {researchCommand.displayText ||
                    `research ${companyName ?? "this company"}`}
                </div>
              </div>

              {/* Compact assistant status — single source of truth */}
              <div className="mx-auto w-full max-w-[780px] px-4 py-2">
                <Tool
                  defaultOpen
                  data-testid="journey-assistant-output"
                >
                  <ToolHeader
                    type="dynamic-tool"
                    toolName="research-agent"
                    title="Research Agent"
                    state={assistantToolState}
                  />
                  <ToolContent className="py-2 px-3">
                    {isGenerating ? (
                      <Shimmer className="h-4 w-3/4">Researching...</Shimmer>
                    ) : null}
                    {deepResearchError ? (
                      <div className="rounded-md border border-red-400/20 bg-red-400/[0.06] p-3 text-sm text-red-100">
                        {deepResearchError}
                        {onRetryDeepResearch ? (
                          <button
                            type="button"
                            onClick={onRetryDeepResearch}
                            className="ml-3 cursor-pointer underline decoration-red-200/50 underline-offset-4 transition-colors duration-150 hover:text-red-50"
                          >
                            Retry
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-xs leading-5 text-muted-foreground">
                        {agentState.assistantOpening}
                      </p>
                    )}
                  </ToolContent>
                </Tool>
              </div>

              {/* Stage 1: corpus-building — chain-of-thought + terminal, NO artifact panel */}
              {resolvedStage === "corpus-building" ? (
                <>
                  <CorpusReasoning steps={reasoningSteps} />
                  <CorpusTerminal
                    artifact={agentState.artifact}
                    isStreaming={agentState.artifact.status === "streaming" || isGenerating}
                    websiteHost={websiteHost}
                  />
                </>
              ) : null}

              {/* Stage 2: onboarding-review — review fields + run-section CTA */}
              {resolvedStage === "onboarding-review" ? (
                <>
                  <OnboardingReviewCard fields={deepResearchFields} />
                  <NextSectionControl
                    nextSectionLabel={nextSectionLabel}
                    isNextSectionRunning={isNextSectionRunning}
                    onRunNextSection={onRunNextSection}
                  />
                </>
              ) : null}

              {/* Stage 3: section-streaming — queue + artifact + compact tools + run-next */}
              {resolvedStage === "section-streaming" ? (
                <>
                  <SectionQueue
                    researchResults={researchResults}
                    activeResearchSections={activeResearchSections}
                  />
                  <ArtifactPanel artifact={agentState.artifact} />
                  <CompactStepTools steps={reportReasoningSteps} />
                  <NextSectionControl
                    nextSectionLabel={nextSectionLabel}
                    isNextSectionRunning={isNextSectionRunning}
                    onRunNextSection={onRunNextSection}
                  />
                </>
              ) : null}

              {displayedMessages.map((message) => (
                <div key={message.id} className="mx-auto w-full max-w-[780px] px-4">
                  <Message from={message.role === "user" ? "user" : "assistant"}>
                    <MessageContent>
                      <MessageResponse>{message.text}</MessageResponse>
                    </MessageContent>
                  </Message>
                </div>
              ))}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
        )}
      </div>

      <footer className="shrink-0 border-t bg-background/95 px-4 py-4 backdrop-blur-md">
        <div className="mx-auto w-full max-w-[800px]">
          <PromptInput
            onSubmit={handlePromptSubmit}
            className="rounded-md shadow-sm transition-colors duration-150 focus-within:border-primary/50"
          >
            <PromptInputTextarea
              aria-label="Research command or company URL"
              value={websiteUrl}
              onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
                onWebsiteUrlChange(event.target.value)
              }
              placeholder="research airtable.com or paste company URL..."
              className="max-h-32 min-h-20 text-sm leading-6 placeholder:text-muted-foreground"
            />
            <PromptInputFooter className="flex-wrap justify-start border-t px-3 py-2">
              <PromptInputTools className="min-w-0 text-[11px] text-muted-foreground">
                <Globe2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="truncate">Source-backed research + GTM synthesis</span>
              </PromptInputTools>
              <PromptInputTools>
                <Badge variant="outline" className="gap-1 rounded-full text-[11px] font-normal">
                  <ChevronDown className="h-3 w-3" aria-hidden="true" />
                  agent run
                </Badge>
                <PromptInputSubmit
                  aria-label="Start research"
                  disabled={isGenerating}
                  status={isGenerating ? "submitted" : "ready"}
                  className="rounded-full"
                />
              </PromptInputTools>
            </PromptInputFooter>
          </PromptInput>
        </div>
      </footer>
    </main>
  );
}
