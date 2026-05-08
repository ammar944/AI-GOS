'use client';

import { FormEvent, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  Code2,
  Globe2,
  Loader2,
  Search,
  Sparkles,
} from 'lucide-react';
import type { ResearchSectionResult } from '@/lib/journey/research-realtime';
import type { ResearchJobActivity, ResearchJobUpdate } from '@/lib/journey/research-job-activity-core';
import { parseJourneyResearchInput } from '@/lib/journey/research-command';
import {
  buildDeepResearchAgentStreamState,
  type DeepResearchAgentStepView,
} from '@/lib/journey/research-stream-buffer';
import type {
  JourneyArtifactSection,
  JourneyArtifactState,
} from '@/lib/journey/research-artifact-state';

interface JourneyAgentChatProps {
  websiteUrl: string;
  onWebsiteUrlChange: (value: string) => void;
  onSubmitWebsite: () => void;
  activeRunId: string | null;
  companyName: string | null;
  phase: 'welcome' | 'prefilling' | 'resume' | 'workspace';
  deepResearchStatus: 'idle' | 'starting' | 'queued' | 'complete' | 'error';
  deepResearchError: string | null;
  deepResearchFields: Record<string, string>;
  researchActivity: Record<string, ResearchJobActivity | undefined>;
  researchResults: Record<string, ResearchSectionResult | null>;
  activeResearchSections?: ReadonlySet<string>;
  messages: ReadonlyArray<unknown>;
  onRetryDeepResearch?: () => void;
  onStartFresh?: () => void;
}

type RowStatus = 'idle' | 'running' | 'complete' | 'partial' | 'error';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readTextParts(message: unknown): string {
  if (!isRecord(message)) return '';
  const content = message.content;
  if (typeof content === 'string') return content;
  const parts = Array.isArray(message.parts) ? message.parts : [];
  return parts
    .map((part) => {
      if (!isRecord(part)) return '';
      return typeof part.text === 'string' ? part.text : '';
    })
    .join('')
    .trim();
}

function getMessageRole(message: unknown): string | null {
  return isRecord(message) && typeof message.role === 'string' ? message.role : null;
}

function getResultData(result: ResearchSectionResult | null | undefined): Record<string, unknown> | null {
  return isRecord(result?.data) ? result.data : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function statusClasses(status: RowStatus): string {
  switch (status) {
    case 'complete':
      return 'border-emerald-500/15 bg-emerald-500/[0.035] text-emerald-300';
    case 'partial':
      return 'border-amber-400/20 bg-amber-400/[0.06] text-amber-100';
    case 'running':
      return 'border-blue-400/15 bg-blue-400/[0.045] text-blue-200';
    case 'error':
      return 'border-red-400/20 bg-red-400/[0.06] text-red-200';
    default:
      return 'border-white/[0.06] bg-white/[0.018] text-[#8f8b82]';
  }
}

function StatusIcon({ status }: { status: RowStatus }) {
  if (status === 'complete') return <CheckCircle2 className="h-4 w-4" aria-hidden="true" />;
  if (status === 'running') return <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />;
  if (status === 'error') return <AlertCircle className="h-4 w-4" aria-hidden="true" />;
  return <CircleDashed className="h-4 w-4" aria-hidden="true" />;
}

function formatUpdateMessage(update: ResearchJobUpdate): string {
  if (update.meta?.toolName === 'web_search') {
    if (update.meta.url) return update.meta.pageTitle ? `Opened ${update.meta.pageTitle}` : `Opened ${update.meta.url}`;
    if (typeof update.meta.resultCount === 'number') return `Search returned ${update.meta.resultCount} results`;
  }
  if (update.meta?.toolName === 'code_execution') return 'Ran analysis in code execution';
  return update.message;
}

function AgentActivityRows({ activity }: { activity?: ResearchJobActivity }) {
  const updates = [...(activity?.updates ?? [])]
    .filter((update) => update.phase !== 'artifact')
    .slice(-5);
  if (updates.length === 0) return null;

  return (
    <div data-testid="journey-agent-activity-log" className="mt-3 space-y-1.5 border-l border-white/[0.08] pl-4">
      {updates.map((update) => (
        <div key={`${activity?.jobId}-${update.id}`} className="flex min-w-0 items-center gap-2 text-xs text-[#8f8b82]">
          {update.meta?.toolName === 'web_search' ? <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
          {update.meta?.toolName === 'code_execution' ? <Code2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
          {!update.meta?.toolName ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-50" /> : null}
          <span className="truncate">{formatUpdateMessage(update)}</span>
        </div>
      ))}
    </div>
  );
}

function AgentStep({
  step,
}: {
  step: DeepResearchAgentStepView;
}) {
  const data = getResultData(step.result as ResearchSectionResult | null | undefined);
  const verdict = readString(data?.verdict) ?? readString(data?.statusSummary);

  return (
    <div data-testid="journey-agent-activity" className={`rounded-xl border px-3.5 py-3 ${statusClasses(step.status)}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          <StatusIcon status={step.status} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-medium text-[#f4f1e8]">{step.name}</p>
            <span className="hidden shrink-0 rounded-full border border-white/[0.06] px-2 py-0.5 text-[10px] text-[#7d796f] sm:inline">
              {step.skill}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-[#8f8b82]">
            {verdict ?? step.statusMessage}
          </p>
          <AgentActivityRows activity={step.activity as ResearchJobActivity | undefined} />
        </div>
      </div>
    </div>
  );
}

function statusLabel(status: JourneyArtifactSection['status']): string {
  if (
    status === 'drafting' ||
    status === 'researching' ||
    status === 'citing' ||
    status === 'queued'
  ) return 'streaming';
  if (status === 'partial') return 'draft';
  if (status === 'error') return 'needs review';
  return 'ready';
}

function cleanArtifactContent(content: string): string {
  const cleaned = content
    .replace(/^#\s+https?:\/\/[^\s]+\s+GTM Research\s*/i, '')
    .replace(/^#\s+https?:\/\/[^\s]+\s*/im, '')
    .replace(/^#{1,3}\s+(Deep Research|Market Category|ICP Validation|Competitor Intel|Offer Analysis|Keyword Intel|Strategic Synthesis)\s*$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return cleaned;
}

function SourceBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-blue-400/20 bg-blue-400/[0.08] px-1.5 py-0.5 text-[11px] font-medium text-blue-200 no-underline">
      <Search className="h-2.5 w-2.5" aria-hidden="true" />
      source
    </span>
  );
}

const URL_REGEX = /(https?:\/\/[^\s<>"']+?)([.,;:!?)\]]*)(?=\s|$)/i;

function parseUrl(text: string): { url: string; trailing: string } | null {
  const match = text.match(URL_REGEX);
  if (!match) return null;
  return { url: match[1], trailing: match[2] };
}

function safeHostname(rawUrl: string): string | null {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function renderArtifactContent(content: string): React.ReactNode[] {
  const paragraphs = content.split(/\n\n+/);
  return paragraphs.filter(Boolean).map((block, i) => {
    const lines = block.split('\n');
    return (
      <p key={i} className="text-sm leading-7 text-[var(--text-2,#c8c1b4)]">
        {lines.map((line, j) => (
          <span key={j}>
            {j > 0 ? <br /> : null}
            {line
              .split(/(\[source\])/gi)
              .map((part, k) => {
                if (part.toLowerCase() === '[source]') {
                  return <SourceBadge key={k} />;
                }
                const parsed = parseUrl(part);
                if (!parsed) return part;
                const hostname = safeHostname(parsed.url);
                if (hostname) {
                  return (
                    <span key={k}>
                      <a href={parsed.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 rounded-md border border-[var(--border-accent,transparent)] bg-[var(--accent-dim,rgba(54,94,255,0.08))] px-1.5 py-0.5 text-[11px] font-medium text-[var(--accent-soft,#9aa9ff)] underline-offset-2 hover:underline">
                        {hostname}
                      </a>
                      {parsed.trailing}
                    </span>
                  );
                }
                return (
                  <span key={k}>
                    <a href={parsed.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                      {parsed.url}
                    </a>
                    {parsed.trailing}
                  </span>
                );
              })}
          </span>
        ))}
      </p>
    );
  });
}

function ReportArtifact({ artifact }: { artifact: JourneyArtifactState }) {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  if (artifact.sections.length === 0) return null;

  const completedSections = artifact.sections.filter(
    (s) => s.status === 'complete' || s.status === 'partial'
  );
  const hasActiveStreaming = artifact.sections.some(
    (s) => s.status === 'drafting' || s.status === 'researching' || s.status === 'citing'
  );

  const displaySections = activeSection
    ? artifact.sections.filter((s) => s.section === activeSection)
    : artifact.sections;

  return (
    <div className="w-full px-6 py-4" data-testid="deep-research-report-artifact">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-2,#10100f)]">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-6 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--text-3,#77736a)]">Live GTM Research Artifact</p>
            <h2 className="mt-1.5 text-xl font-semibold tracking-[-0.025em] text-[var(--text-1,#f5f1e7)]">{artifact.title}</h2>
          </div>
          <div className="flex items-center gap-2">
            {hasActiveStreaming ? (
              <span className="rounded-full border border-blue-400/15 bg-blue-400/[0.06] px-2.5 py-1 text-xs text-blue-200">
                streaming
              </span>
            ) : completedSections.length === artifact.sections.length ? (
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/[0.08] px-2.5 py-1 text-xs text-emerald-200">
                complete
              </span>
            ) : null}
          </div>
        </div>

        {artifact.sections.length > 1 ? (
          <div className="flex gap-0 overflow-x-auto border-b border-[var(--border)] px-4">
            {artifact.sections.map((section) => {
              const isActive = activeSection === section.section || (!activeSection && artifact.sections.length > 1);
              return (
                <button
                  key={section.section}
                  type="button"
                  onClick={() => setActiveSection(activeSection === section.section ? null : section.section)}
                  className={`shrink-0 border-b-2 px-3 py-2.5 text-[12px] font-medium transition-colors ${
                    isActive
                      ? 'border-[var(--accent,#365eff)] text-[var(--text-1,#f4f1e8)]'
                      : 'border-transparent text-[var(--text-4,#68645c)] hover:text-[var(--text-2,#8b90a0)]'
                  }`}
                >
                  {section.title}
                  <span className={`ml-2 inline-block h-1.5 w-1.5 rounded-full ${
                    section.status === 'complete' || section.status === 'partial' ? 'bg-emerald-400' :
                    section.status === 'drafting' || section.status === 'researching' || section.status === 'citing' ? 'bg-blue-400 animate-pulse' :
                    section.status === 'error' ? 'bg-red-400' : 'bg-[var(--text-4)]'
                  }`} />
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="space-y-0 px-6 py-5">
          {displaySections.map((section, index) => {
            const isPartial = section.status === 'partial';
            const isError = section.status === 'error';
            const cleaned = cleanArtifactContent(section.content);

            return (
              <section key={section.section}>
                {index > 0 ? (
                  <div className="my-4 flex items-center gap-2 text-xs text-emerald-300/70">
                    <div className="h-px flex-1 bg-emerald-400/[0.12]" />
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>Chapter complete</span>
                    <div className="h-px flex-1 bg-emerald-400/[0.12]" />
                  </div>
                ) : null}
                <div className={index > 0 ? 'pt-2' : ''}>
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                    <Sparkles className="h-3.5 w-3.5 text-[var(--accent-soft,#9aa9ff)]" aria-hidden="true" />
                    <span className="font-medium text-[var(--text-2,#c8c1b4)]">{section.title}</span>
                    <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[var(--text-3,#8f8b82)]">
                      {statusLabel(section.status)}
                    </span>
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
                    {renderArtifactContent(cleaned || section.content)}
                  </div>
                  <p className="mt-3 text-xs leading-5 text-[var(--text-3,#77736a)]">
                    {section.sourceUrls.length > 0
                      ? `${section.sourceUrls.length} source${section.sourceUrls.length === 1 ? '' : 's'} attached`
                      : isPartial ? 'Partial draft — sources may be incomplete' :
                      section.status === 'complete' ? 'Draft inference pending source review' : 'Gathering sources...'}
                  </p>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

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
  onRetryDeepResearch,
  onStartFresh,
}: JourneyAgentChatProps): React.JSX.Element {
  const hasSubmittedUrl = activeRunId !== null || deepResearchStatus !== 'idle' || phase === 'workspace' || phase === 'prefilling';
  const researchCommand = useMemo(
    () => parseJourneyResearchInput(websiteUrl),
    [websiteUrl],
  );
  const canSubmit =
    researchCommand.websiteUrl !== null &&
    deepResearchStatus !== 'starting' &&
    deepResearchStatus !== 'queued';
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
    () => messages
      .map((message, index) => ({ id: isRecord(message) && typeof message.id === 'string' ? message.id : `message-${index}`, role: getMessageRole(message), text: readTextParts(message) }))
      .filter((message) => message.text.length > 0),
    [messages],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (canSubmit) onSubmitWebsite();
  };

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#0b0b0a] text-[#f5f1e7]">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#0b0b0a]/90 px-4 backdrop-blur-md">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[#f5f1e7]">{companyName ? `${companyName} Journey` : 'AI-GOS Journey'}</p>
          <p className="text-xs text-[#817d73]">Anthropic GTM agents · chat mode</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#8f8b82]">
          <span className="hidden rounded-full border border-white/[0.07] px-2.5 py-1 sm:inline">{activeRunId ? `run ${activeRunId.slice(-6)}` : 'new run'}</span>
          {onStartFresh ? (
            <button type="button" onClick={onStartFresh} className="rounded-full border border-white/[0.08] px-2.5 py-1 transition-colors hover:bg-white/[0.05]">
              New
            </button>
          ) : null}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden">
        {!hasSubmittedUrl && displayedMessages.length === 0 ? (
          <div className="mx-auto flex min-h-[calc(100vh-240px)] w-full max-w-[780px] flex-col justify-center px-4">
            <div className="mb-7">
              <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-[#77736a]">GTM agent chat</p>
              <h1 className="max-w-xl text-4xl font-semibold tracking-[-0.045em] text-[#f6f2e8] sm:text-5xl">
                What company should I research?
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-[#9a958b]">
                Paste a URL. Claude deep research builds the corpus, then AI-GOS runs the specialist GTM agents inline here.
              </p>
            </div>
          </div>
        ) : null}

        {hasSubmittedUrl ? (
          <div className="min-h-0 flex-1 overflow-y-auto py-6">
            <div className="space-y-2">
              <div className="mx-auto w-full max-w-[780px] px-4 py-2">
                <div
                  data-testid="journey-user-command"
                  className="ml-auto max-w-[82%] rounded-2xl rounded-tr-md bg-[#23231f] px-4 py-3 text-sm leading-6 text-[#f4f1e8]"
                >
                  {researchCommand.displayText || `research ${companyName ?? 'this company'}`}
                </div>
              </div>

              <div className="mx-auto w-full max-w-[780px] px-4 py-3">
                <div
                  data-testid="journey-assistant-output"
                  className="rounded-2xl border border-[var(--border)] bg-[var(--bg-2,#11110f)] p-4"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-300" />
                    <p className="text-sm font-medium text-[var(--text-1,#f4f1e8)]">Deep Research Agent</p>
                  </div>
                  <p className="mb-3 text-sm leading-6 text-[var(--text-2,#c8c1b4)]">{agentState.assistantOpening}</p>
                  {deepResearchError ? (
                    <div className="mt-3 rounded-xl border border-red-400/20 bg-red-400/[0.06] p-3 text-sm text-red-100">
                      {deepResearchError}
                      {onRetryDeepResearch ? (
                        <button type="button" onClick={onRetryDeepResearch} className="ml-3 underline decoration-red-200/50 underline-offset-4">
                          Retry
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  {Object.keys(deepResearchFields).length > 0 ? (
                    <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-3,#817d73)]">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
                      Company research corpus saved for section synthesis
                    </div>
                  ) : null}
                </div>
              </div>

              <ReportArtifact artifact={agentState.artifact} />

              {displayedMessages.map((message) => (
                <div key={message.id} className="mx-auto w-full max-w-[780px] px-4 py-2">
                  <div
                    data-testid={
                      message.role === 'assistant'
                        ? 'journey-chat-assistant-message'
                        : 'journey-chat-user-message'
                    }
                    className={message.role === 'user' ? 'ml-auto max-w-[82%] rounded-2xl rounded-tr-md bg-[#23231f] px-4 py-3 text-sm leading-6' : 'max-w-none text-sm leading-7 text-[var(--text-2,#c8c1b4)]'}
                  >
                    {message.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <footer className="shrink-0 border-t border-white/[0.06] bg-[#0b0b0a]/95 px-4 py-4 backdrop-blur-md">
        <form onSubmit={handleSubmit} className="mx-auto w-full max-w-[800px]">
          <div className="rounded-2xl border border-white/[0.1] bg-[#11110f] p-3 shadow-[0_18px_70px_rgba(0,0,0,0.28)] transition-colors focus-within:border-[#6d86ff]/50">
            <div className="flex items-start gap-3">
              <Globe2 className="mt-2.5 h-4 w-4 shrink-0 text-[#77736a]" aria-hidden="true" />
              <textarea
                aria-label="Research command or company URL"
                value={websiteUrl}
                onChange={(event) => onWebsiteUrlChange(event.target.value)}
                placeholder="research airtable.com or paste company URL..."
                rows={1}
                className="max-h-32 min-h-10 flex-1 resize-none bg-transparent py-2 text-sm leading-6 text-[#f5f1e7] outline-none placeholder:text-[#68645c]"
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    if (canSubmit) onSubmitWebsite();
                  }
                }}
              />
              <button
                type="submit"
                disabled={!canSubmit}
                aria-label="Start deep research"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f5f1e7] text-[#11110f] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {deepResearchStatus === 'starting' || deepResearchStatus === 'queued' ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-[#77736a]">
              <span>Claude web search + code execution + Platform Skills</span>
              <span className="flex items-center gap-1">
                <ChevronDown className="h-3 w-3" aria-hidden="true" />
                agent run
              </span>
            </div>
          </div>
        </form>
      </footer>
    </main>
  );
}
