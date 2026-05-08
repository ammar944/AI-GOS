"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Globe2,
  Play,
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
  ShadcnToolEvent,
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
import { Reasoning } from "@/components/ai-elements/reasoning";
import { ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { ReasoningContent } from "@/components/ai-elements/reasoning";
import { Sources } from "@/components/ai-elements/sources";
import { SourcesTrigger } from "@/components/ai-elements/sources";
import { SourcesContent } from "@/components/ai-elements/sources";
import { Source } from "@/components/ai-elements/sources";
import { Tool } from "@/components/ai-elements/tool";
import { ToolContent } from "@/components/ai-elements/tool";
import { ToolHeader } from "@/components/ai-elements/tool";
import type { ResearchSectionResult } from "@/lib/journey/research-realtime";
import type { ResearchJobActivity } from "@/lib/journey/research-job-activity-core";
import { parseJourneyResearchInput } from "@/lib/journey/research-command";
import {
  buildDeepResearchAgentStreamState,
} from "@/lib/journey/research-stream-buffer";
import type { JourneyArtifactState } from "@/lib/journey/research-artifact-state";

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
        className="flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
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

// --- Reasoning Steps (using registry Reasoning components) ---

const TOOL_EVENT_PHASE_LABELS: Record<ShadcnToolEvent["phase"], string> = {
  runner: "runner",
  tool: "research",
  analysis: "analysis",
  artifact: "artifact",
  output: "output",
  error: "error",
};

function getToolEventLabel(event: ShadcnToolEvent): string {
  if (event.toolName === "web_search") return "source";
  if (event.toolName === "code_execution") return "analysis";
  return event.toolName ?? TOOL_EVENT_PHASE_LABELS[event.phase];
}

function AgentActivityFeed({
  events,
  isRunning,
}: {
  events: ShadcnToolEvent[];
  isRunning: boolean;
}): React.JSX.Element | null {
  if (events.length === 0 && !isRunning) {
    return null;
  }

  const state = isRunning ? "input-available" : "output-available";

  return (
    <Tool defaultOpen={isRunning} className="mt-3 mb-0 bg-background/80">
      <ToolHeader
        type="dynamic-tool"
        toolName="research-activity"
        title="Live research activity"
        state={state}
      />
      <ToolContent className="space-y-2">
        {events.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            Waiting for research updates.
          </p>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className="flex min-w-0 items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs"
            >
              <Badge variant="outline" className="shrink-0 text-[10px]">
                {getToolEventLabel(event)}
              </Badge>
              <div className="min-w-0 flex-1">
                <p className="text-foreground">{event.message}</p>
                {event.url ? (
                  <a
                    href={event.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block truncate text-muted-foreground underline-offset-4 hover:underline"
                  >
                    {event.pageTitle ?? event.url}
                  </a>
                ) : null}
              </div>
            </div>
          ))
        )}
      </ToolContent>
    </Tool>
  );
}

function ReasoningSteps({ steps }: { steps: ShadcnReasoningStep[] }): React.JSX.Element | null {
  if (steps.length === 0) return null;

  return (
    <div className="mx-auto w-full max-w-[780px] px-4 py-3">
      {steps.map((step) => {
        const isRunning = step.status === "running";
        const isError = step.status === "error";
        const verdict = step.verdict ?? step.description;

        return (
          <Reasoning
            key={step.id}
            defaultOpen={isRunning}
            isStreaming={isRunning}
          >
            <ReasoningTrigger
              getThinkingMessage={(streaming) => {
                if (streaming) {
                  return (
                    <span className="flex items-center gap-2">
                      <span className="font-medium text-foreground text-xs">
                        {step.name}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {step.skill}
                      </Badge>
                    </span>
                  );
                }
                if (isError) {
                  return <span className="text-red-400 text-xs">{step.name} — failed</span>;
                }
                return <span className="text-xs">{step.name} — complete</span>;
              }}
            />
            <ReasoningContent>
              <div className="space-y-2">
                <p>{verdict ?? step.description}</p>
                <AgentActivityFeed
                  events={step.toolEvents}
                  isRunning={isRunning}
                />
              </div>
            </ReasoningContent>
          </Reasoning>
        );
      })}
    </div>
  );
}

// --- Source List (using registry Sources components) ---

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

// --- Artifact Panel (using registry Artifact components) ---

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

function ArtifactPanel({ artifact }: { artifact: JourneyArtifactState }) {
  const props = journeyArtifactToShadcnProps(artifact);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    if (props.activeSection) {
      setActiveSection(props.activeSection);
    }
  }, [props.activeSection]);

  if (props.sections.length === 0) return null;

  const displaySections = activeSection
    ? props.sections.filter((s) => s.id === activeSection)
    : props.sections;

  return (
    <div className="mx-auto w-full max-w-[780px] px-4 py-3" data-testid="deep-research-report-artifact">
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
              {formatArtifactGrowth(props.completedCount, props.totalCount)}
              {props.hasActiveStreaming ? " - live update active" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {props.hasActiveStreaming ? (
              <Badge variant="default">streaming</Badge>
            ) : props.completedCount === props.totalCount ? (
              <Badge className="border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-200">
                complete
              </Badge>
            ) : null}
          </div>
        </ArtifactHeader>

        {props.sections.length > 1 ? (
          <div className="flex gap-0 overflow-x-auto border-b px-4">
            {props.sections.map((section) => {
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() =>
                    setActiveSection(activeSection === section.id ? null : section.id)
                  }
                  className={`shrink-0 border-b-2 px-3 py-2.5 text-[12px] font-medium transition-colors ${
                    isActive
                      ? "border-[var(--accent,#365eff)] text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground/80"
                  }`}
                >
                  {section.title}
                  <span
                    className={`ml-2 inline-block h-1.5 w-1.5 rounded-full ${
                      section.status === "complete" || section.status === "partial"
                        ? "bg-emerald-400"
                        : section.status === "drafting" ||
                            section.status === "researching" ||
                            section.status === "citing"
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
                      <Sparkles className="h-3.5 w-3.5 text-[var(--accent-soft,#9aa9ff)]" aria-hidden="true" />
                      <span className="font-medium text-foreground/80">
                        {section.title}
                      </span>
                      <Badge variant="outline">{statusLabel(section.status)}</Badge>
                    </div>
                    {isPartial ? (
                      <div className="mb-4 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-sm text-amber-100">
                        This section is incomplete. Some content is available below.
                      </div>
                    ) : null}
                    {isError ? (
                      <div className="mb-4 rounded-lg border border-red-400/20 bg-red-400/[0.06] px-4 py-3 text-sm text-red-100">
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

  const handlePromptSubmit = (promptMessage: { text: string; files: unknown[] }) => {
    const nextInput = promptMessage.text.trim();
    onWebsiteUrlChange(nextInput);
    if (!isGenerating) {
      onSubmitWebsite(nextInput);
    }
  };

  const showWelcome = !hasSubmittedUrl && displayedMessages.length === 0;

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
                    <div key={item} className="flex items-center gap-3 rounded-lg border bg-background/70 px-3 py-2.5">
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
                  className="ml-auto max-w-[82%] rounded-2xl rounded-tr-md bg-secondary px-4 py-3 text-sm leading-6"
                >
                  {researchCommand.displayText ||
                    `research ${companyName ?? "this company"}`}
                </div>
              </div>

              <div className="mx-auto w-full max-w-[780px] px-4 py-3">
                <div
                  data-testid="journey-assistant-output"
                  className="rounded-2xl border bg-card p-4"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-300" />
                    <p className="text-sm font-medium">
                      Research Agent
                    </p>
                  </div>
                  {isGenerating ? (
                    <Shimmer className="h-4 w-3/4">Researching...</Shimmer>
                  ) : null}
                  {deepResearchError ? (
                    <div className="mt-3 rounded-xl border border-red-400/20 bg-red-400/[0.06] p-3 text-sm text-red-100">
                      {deepResearchError}
                      {onRetryDeepResearch ? (
                        <button
                          type="button"
                          onClick={onRetryDeepResearch}
                          className="ml-3 underline decoration-red-200/50 underline-offset-4"
                        >
                          Retry
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mb-3 text-sm leading-6 text-muted-foreground">
                      {agentState.assistantOpening}
                    </p>
                  )}
                  {Object.keys(deepResearchFields).length > 0 ? (
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
                      Company research corpus saved for section synthesis
                    </div>
                  ) : null}
                </div>
              </div>

              <NextSectionControl
                nextSectionLabel={nextSectionLabel}
                isNextSectionRunning={isNextSectionRunning}
                onRunNextSection={onRunNextSection}
              />

              <ReasoningSteps steps={reasoningSteps} />

              <ArtifactPanel artifact={agentState.artifact} />

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
            className="rounded-2xl shadow-[0_18px_70px_rgba(0,0,0,0.28)] transition-colors focus-within:border-primary/50"
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
