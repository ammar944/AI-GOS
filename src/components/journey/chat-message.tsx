'use client';

import type { ComponentProps } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ThinkingBlock } from '@/components/chat/thinking-block';
import { ToolLoadingIndicator } from '@/components/chat/tool-loading-indicator';
import { DeepResearchCard } from '@/components/chat/deep-research-card';
import { EditApprovalCard } from '@/components/chat/edit-approval-card';
import { ComparisonTableCard } from '@/components/chat/comparison-table-card';
import { AnalysisScoreCard } from '@/components/chat/analysis-score-card';
import { VisualizationCard } from '@/components/chat/visualization-card';
import { AskUserCard } from '@/components/journey/ask-user-card';
import type { AskUserResult } from '@/components/journey/ask-user-card';
import {
  JourneyKeywordIntelDetail,
  getJourneyKeywordIntelDetailData,
} from '@/components/journey/journey-keyword-intel-detail';
import { ResearchInlineCard } from '@/components/journey/research-inline-card';
import { ResearchSubsectionReveal } from '@/components/journey/research-subsection-reveal';
import { ScrapeLoadingCard } from '@/components/journey/scrape-loading-card';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content?: string;
  parts?: unknown[];
  messageId?: string;
  isStreaming?: boolean;
  onToolApproval?: (approvalId: string, approved: boolean) => void;
  onToolOutput?: (toolCallId: string, result: AskUserResult) => void;
  onViewResearchSection?: (section: string) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const fadeInUp = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const },
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

type DeepResearchCardData = ComponentProps<typeof DeepResearchCard>['data'];
type ComparisonTableCardData = ComponentProps<typeof ComparisonTableCard>['data'];
type AnalysisScoreCardData = ComponentProps<typeof AnalysisScoreCard>['data'];
type VisualizationCardData = ComponentProps<typeof VisualizationCard>['data'];

function getPartType(part: unknown): string | null {
  if (!isRecord(part) || typeof part.type !== 'string') {
    return null;
  }

  return part.type;
}

function isTextPart(part: unknown): part is { type: 'text'; text?: string } {
  return getPartType(part) === 'text';
}

function parseToolOutput(output: unknown): Record<string, unknown> | undefined {
  if (typeof output === 'string') {
    try {
      const parsed = JSON.parse(output) as unknown;
      return isRecord(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }

  return isRecord(output) ? output : undefined;
}

// ---------------------------------------------------------------------------
// Markdown rendering helpers (kept from v1)
// ---------------------------------------------------------------------------

/**
 * Render inline formatting: **bold**, *italic*, `code`, [link](url)
 */
function renderInlineFormatting(text: string): React.ReactNode {
  const inlineRegex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(inlineRegex);

  return parts.map((part, index) => {
    // Bold
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-semibold" style={{ color: 'var(--text-primary)' }}>
          {part.slice(2, -2)}
        </strong>
      );
    }

    // Italic
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }

    // Inline code
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={index}
          className="px-1.5 py-0.5 rounded text-xs font-mono"
          style={{
            background: 'var(--bg-code-inline)',
            color: 'var(--accent-cyan)',
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // Links
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={index}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:opacity-80 transition-opacity"
          style={{ color: 'var(--accent-blue)' }}
        >
          {linkMatch[1]}
        </a>
      );
    }

    return <span key={index}>{part}</span>;
  });
}

/**
 * Render a fenced code block with optional diff highlighting
 */
function renderCodeBlock(code: string, language?: string): React.ReactNode {
  const isDiff = language === 'diff';
  const lines = code.trim().split('\n');

  return (
    <pre
      className="text-xs p-3 rounded overflow-auto font-mono my-2"
      style={{
        background: 'var(--bg-code-block)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {lines.map((line, lineIndex) => {
        if (isDiff) {
          const isRemoved = line.startsWith('-');
          const isAdded = line.startsWith('+');
          return (
            <div
              key={lineIndex}
              className={cn(isRemoved && 'text-red-400', isAdded && 'text-green-400')}
            >
              {line}
            </div>
          );
        }
        return <div key={lineIndex}>{line}</div>;
      })}
    </pre>
  );
}

/**
 * Render text content with markdown-style formatting:
 * headers, bullet lists, numbered lists, paragraphs
 */
function renderTextContent(text: string): React.ReactNode {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: { type: 'ul' | 'ol'; items: React.ReactNode[] } | null = null;

  const flushList = () => {
    if (!listItems) return;
    if (listItems.type === 'ul') {
      elements.push(
        <ul
          key={`list-${elements.length}`}
          className="list-disc list-inside space-y-1 my-2"
          style={{ color: 'inherit' }}
        >
          {listItems.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    } else {
      elements.push(
        <ol
          key={`list-${elements.length}`}
          className="list-decimal list-inside space-y-1 my-2"
          style={{ color: 'inherit' }}
        >
          {listItems.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ol>
      );
    }
    listItems = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim() === '') {
      flushList();
      continue;
    }

    // Headers
    const headerMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headerMatch) {
      flushList();
      const level = headerMatch[1].length;
      const headerText = headerMatch[2];
      const sizeClass = level === 1 ? 'text-base' : 'text-sm';
      elements.push(
        <div
          key={`header-${i}`}
          className={cn(sizeClass, 'font-semibold mt-3 mb-1')}
          style={{ color: 'var(--text-primary)' }}
          role="heading"
          aria-level={Math.min(level + 1, 6) as 1 | 2 | 3 | 4 | 5 | 6}
        >
          {renderInlineFormatting(headerText)}
        </div>
      );
      continue;
    }

    // Bullet list
    const bulletMatch = line.match(/^[\s]*[-*]\s+(.+)$/);
    if (bulletMatch) {
      if (!listItems || listItems.type !== 'ul') {
        flushList();
        listItems = { type: 'ul', items: [] };
      }
      listItems.items.push(renderInlineFormatting(bulletMatch[1]));
      continue;
    }

    // Numbered list
    const numberedMatch = line.match(/^[\s]*\d+\.\s+(.+)$/);
    if (numberedMatch) {
      if (!listItems || listItems.type !== 'ol') {
        flushList();
        listItems = { type: 'ol', items: [] };
      }
      listItems.items.push(renderInlineFormatting(numberedMatch[1]));
      continue;
    }

    // Regular paragraph
    flushList();
    elements.push(
      <p key={`para-${i}`} className="leading-relaxed">
        {renderInlineFormatting(line)}
      </p>
    );
  }

  flushList();
  return <>{elements}</>;
}

/**
 * Render markdown content, splitting out fenced code blocks first
 */
function renderMarkdown(content: string): React.ReactNode {
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  const segments: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const textBefore = content.slice(lastIndex, match.index);
      segments.push(<span key={`text-${lastIndex}`}>{renderTextContent(textBefore)}</span>);
    }
    const language = match[1] || undefined;
    const code = match[2];
    segments.push(
      <span key={`code-${match.index}`}>{renderCodeBlock(code, language)}</span>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    const remaining = content.slice(lastIndex);
    segments.push(<span key={`text-${lastIndex}`}>{renderTextContent(remaining)}</span>);
  }

  return <div className="space-y-1">{segments}</div>;
}

// ---------------------------------------------------------------------------
// Tool part rendering
// ---------------------------------------------------------------------------

function renderToolPart(
  part: Record<string, unknown>,
  key: string,
  onToolApproval?: (approvalId: string, approved: boolean) => void,
  onToolOutput?: (toolCallId: string, result: AskUserResult) => void,
  onViewResearchSection?: (section: string) => void,
): React.ReactNode {
  const partType = typeof part.type === 'string' ? part.type : '';
  if (!partType.startsWith('tool-')) {
    return null;
  }

  const toolName = partType.replace('tool-', '');
  const state = typeof part.state === 'string' ? part.state : undefined;
  const input = isRecord(part.input) ? part.input : undefined;
  const output = parseToolOutput(part.output);

  // askUser tool — render interactive chip card
  if (toolName === 'askUser') {
    const askInput = part.input as {
      question?: string;
      fieldName?: string;
      options?: Array<{ label: string; description?: string }>;
      multiSelect?: boolean;
    } | undefined;
    const toolCallId = (part.toolCallId as string) ?? key;

    if (state === 'input-streaming') {
      return (
        <ToolLoadingIndicator
          key={key}
          toolName="askUser"
          args={{ label: 'Preparing question...' }}
        />
      );
    }

    if (state === 'input-available') {
      if (!askInput) {
        return (
          <ToolLoadingIndicator key={key} toolName="askUser" args={{ label: 'Loading question...' }} />
        );
      }
      return (
        <AskUserCard
          key={key}
          toolCallId={toolCallId}
          question={askInput.question ?? ''}
          fieldName={askInput.fieldName ?? 'unknown'}
          options={askInput.options ?? []}
          multiSelect={askInput.multiSelect ?? false}
          isSubmitted={false}
          selectedIndices={[]}
          onSubmit={(result) => {
            onToolOutput?.(toolCallId, result);
          }}
        />
      );
    }

    if (state === 'output-available') {
      const parsedOutput = parseToolOutput(part.output);

      let selectedIndices: number[] = [];
      if (parsedOutput && 'selectedIndex' in parsedOutput) {
        selectedIndices = [(parsedOutput as { selectedIndex: number }).selectedIndex];
      } else if (parsedOutput && 'selectedIndices' in parsedOutput) {
        selectedIndices = (parsedOutput as { selectedIndices: number[] }).selectedIndices;
      }

      return (
        <AskUserCard
          key={key}
          toolCallId={toolCallId}
          question={askInput?.question ?? ''}
          fieldName={askInput?.fieldName ?? 'unknown'}
          options={askInput?.options ?? []}
          multiSelect={askInput?.multiSelect ?? false}
          isSubmitted={true}
          selectedIndices={selectedIndices}
          onSubmit={() => {}}
        />
      );
    }

    return null;
  }

  // scrapeClientSite — rich loading card with progressive steps
  if (toolName === 'scrapeClientSite') {
    if (state === 'input-streaming' || state === 'input-available') {
      const websiteUrl = (input as { websiteUrl?: string } | undefined)?.websiteUrl;
      return <ScrapeLoadingCard key={key} websiteUrl={websiteUrl} mode="prefill" />;
    }
    // When complete, render nothing (the agent will stream text with the results)
    if (state === 'output-available' || state === 'output-error') {
      return null;
    }
  }

  // competitorFastHits — also show a targeted loading state
  if (toolName === 'competitorFastHits') {
    if (state === 'input-streaming' || state === 'input-available') {
      const competitorUrl = (input as { competitorUrl?: string } | undefined)?.competitorUrl;
      return <ScrapeLoadingCard key={key} websiteUrl={competitorUrl} mode="competitor" />;
    }
    if (state === 'output-available' || state === 'output-error') {
      return null;
    }
  }

  // Research tools — render inline research cards
  const RESEARCH_TOOL_SECTIONS: Record<string, string> = {
    researchIndustry: 'industryMarket',
    researchCompetitors: 'competitors',
    researchICP: 'icpValidation',
    researchOffer: 'offerAnalysis',
    synthesizeResearch: 'crossAnalysis',
    researchKeywords: 'keywordIntel',
    // legacy
    runResearch: (input as { section?: string } | undefined)?.section ?? 'unknown',
  };
  if (toolName in RESEARCH_TOOL_SECTIONS) {
    const sectionName = RESEARCH_TOOL_SECTIONS[toolName];

    if (state === 'output-available') {
      const parsedOutput = parseToolOutput(part.output);
      if (!parsedOutput) {
        return (
          <ResearchInlineCard
            key={key}
            section={sectionName}
            status="error"
            error="Malformed research payload"
          />
        );
      }

      const parsedData = isRecord(parsedOutput?.data) ? parsedOutput.data : undefined;
      const keywordData =
        sectionName === 'keywordIntel'
          ? getJourneyKeywordIntelDetailData(parsedData)
          : null;

      if (parsedOutput?.status === 'error') {
        return (
          <ResearchInlineCard
            key={key}
            section={sectionName}
            status="error"
            error={parsedOutput.error as string}
          />
        );
      }

      return (
        <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <ResearchInlineCard
            section={sectionName}
            status="complete"
            data={parsedData}
            durationMs={parsedOutput?.durationMs as number}
            sourceCount={(parsedOutput?.sources as unknown[])?.length}
            onViewFull={onViewResearchSection ? () => onViewResearchSection(sectionName) : undefined}
          />
          {keywordData ? (
            <JourneyKeywordIntelDetail data={keywordData} className="mt-4" />
          ) : (
            <ResearchSubsectionReveal
              sectionKey={sectionName}
              data={parsedData ?? null}
              status="complete"
            />
          )}
        </div>
      );
    }

    if (state === 'output-error') {
      return (
        <ResearchInlineCard
          key={key}
          section={sectionName}
          status="error"
          error={(part.errorText as string) || 'Research failed'}
        />
      );
    }

    // input-streaming, input-available → loading
    return (
      <ResearchInlineCard
        key={key}
        section={sectionName}
        status="loading"
      />
    );
  }

  // Loading states
  if (state === 'input-streaming' || state === 'input-available') {
    return (
      <ToolLoadingIndicator
        key={key}
        toolName={toolName}
        args={input}
      />
    );
  }

  // Error state
  if (state === 'output-error') {
    return (
      <div
        key={key}
        className="px-3 py-2 rounded-lg text-xs my-1"
        style={{
          background: 'var(--status-error-bg)',
          border: '1px solid var(--status-error-border)',
          color: 'var(--status-error)',
        }}
      >
        {(part.errorText as string) || 'Tool execution failed'}
      </div>
    );
  }

  // Output available — render specific card
  if (state === 'output-available' && output) {
    switch (toolName) {
      case 'deepResearch':
        return <DeepResearchCard key={key} data={output as DeepResearchCardData} />;
      case 'compareCompetitors':
        return (
          <ComparisonTableCard
            key={key}
            data={output as ComparisonTableCardData}
          />
        );
      case 'analyzeMetrics':
        return (
          <AnalysisScoreCard key={key} data={output as AnalysisScoreCardData} />
        );
      case 'createVisualization':
        return (
          <VisualizationCard key={key} data={output as unknown as VisualizationCardData} />
        );
      case 'webResearch':
        return (
          <div
            key={key}
            className="px-3 py-2 rounded-lg text-xs my-1"
            style={{
              background: 'var(--bg-chip)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)',
            }}
          >
            Research complete
          </div>
        );
      case 'editBlueprint':
        return (
          <div
            key={key}
            className="px-3 py-2 rounded-lg text-xs my-1 flex items-center gap-1.5"
            style={{
              background: 'var(--status-success-bg)',
              border: '1px solid var(--status-success-border)',
              color: 'var(--status-success)',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Edit applied
          </div>
        );
      default:
        return null;
    }
  }

  // Approval requested state — render EditApprovalCard for editBlueprint
  if (state === 'approval-requested' && toolName === 'editBlueprint' && input) {
    const approvalId = (part.approval as Record<string, unknown> | undefined)?.id as string | undefined;
    const editInput = input as {
      section: string;
      fieldPath: string;
      newValue: unknown;
      explanation: string;
    };
    const fallbackId = `${key}-approval`;

    return (
      <EditApprovalCard
        key={key}
        section={editInput.section}
        fieldPath={editInput.fieldPath}
        oldValue={undefined}
        newValue={editInput.newValue}
        explanation={editInput.explanation}
        diffPreview={`Field: ${editInput.fieldPath}\nNew value: ${(() => { try { return JSON.stringify(editInput.newValue, null, 2)?.substring(0, 200); } catch { return '[complex value]'; } })()}`}
        onApprove={() => onToolApproval?.(approvalId ?? fallbackId, true)}
        onReject={() => onToolApproval?.(approvalId ?? fallbackId, false)}
      />
    );
  }

  // Approval responded — tool is executing after user approved
  if (state === 'approval-responded') {
    return (
      <div
        key={key}
        className="px-3 py-2 rounded-lg text-xs my-1"
        style={{
          background: 'var(--bg-hover)',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-tertiary)',
        }}
      >
        Applying edit...
      </div>
    );
  }

  // Output denied — user rejected the edit
  if (state === 'output-denied') {
    return (
      <div
        key={key}
        className="px-3 py-2 rounded-lg text-xs my-1"
        style={{
          background: 'var(--status-error-bg)',
          border: '1px solid var(--status-error-border)',
          color: 'var(--text-tertiary)',
        }}
      >
        Edit rejected
      </div>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Message parts rendering
// ---------------------------------------------------------------------------

function renderMessageParts(
  parts: unknown[],
  messageId: string,
  isStreaming: boolean,
  onToolApproval?: (approvalId: string, approved: boolean) => void,
  onToolOutput?: (toolCallId: string, result: AskUserResult) => void,
  onViewResearchSection?: (section: string) => void,
): React.ReactNode {
  const elements: React.ReactNode[] = [];
  let textAccumulator = '';

  const flushText = (key: string, isFinal = false) => {
    if (textAccumulator.trim()) {
      elements.push(
        <div key={key} className="space-y-1">
          {renderMarkdown(textAccumulator)}
          {isFinal && isStreaming && <span className="streaming-cursor" aria-hidden="true" />}
        </div>
      );
    } else if (isFinal && isStreaming) {
      elements.push(
        <span key={key} className="streaming-cursor" aria-hidden="true" />
      );
    }
    textAccumulator = '';
  };

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const partType = getPartType(part);

    // Text parts — accumulate
    if (isTextPart(part)) {
      textAccumulator += part.text ?? '';
      continue;
    }

    // Reasoning/thinking parts
    if (partType === 'reasoning' && isRecord(part)) {
      flushText(`${messageId}-text-before-reasoning-${i}`);
      const thinkingState = typeof part.state === 'string' ? part.state : undefined;
      const normalizedState = thinkingState === 'streaming' || thinkingState === 'done'
        ? thinkingState
        : undefined;
      elements.push(
        <ThinkingBlock
          key={`${messageId}-thinking-${i}`}
          content={typeof part.text === 'string' ? part.text : ''}
          state={normalizedState}
        />
      );
      continue;
    }

    // Tool parts
    if (partType?.startsWith('tool-') && isRecord(part)) {
      flushText(`${messageId}-text-before-tool-${i}`);
      const toolElement = renderToolPart(
        part,
        `${messageId}-tool-${i}`,
        onToolApproval,
        onToolOutput,
        onViewResearchSection,
      );
      if (toolElement) {
        elements.push(toolElement);
      }
      continue;
    }
  }

  // Flush remaining text
  flushText(`${messageId}-text-final`, true);

  return <>{elements}</>;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function UserMessage({ content, className }: { content: string; className?: string }) {
  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className={cn('max-w-3xl mx-auto text-center space-y-4 mb-8', className)}
    >
      <h2 className="text-3xl font-light text-white/90">{content}</h2>
    </motion.div>
  );
}

function AssistantMessage({
  content,
  parts,
  messageId,
  isStreaming,
  onToolApproval,
  onToolOutput,
  onViewResearchSection,
  className,
}: {
  content?: string;
  parts?: unknown[];
  messageId: string;
  isStreaming: boolean;
  onToolApproval?: (approvalId: string, approved: boolean) => void;
  onToolOutput?: (toolCallId: string, result: AskUserResult) => void;
  onViewResearchSection?: (section: string) => void;
  className?: string;
}) {
  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className={cn('mb-6', className)}
    >
      {/* V2 blockquote style — left blue border, no avatar */}
      <div
        className="pl-4"
        style={{
          borderLeft: '2px solid rgba(60, 131, 246, 0.40)',
        }}
      >
        <div
          className="flex-1 min-w-0 font-light"
          style={{
            fontSize: '15px',
            lineHeight: '1.75',
            color: 'rgba(255, 255, 255, 0.80)',
          }}
        >
          {parts
            ? renderMessageParts(parts, messageId, isStreaming, onToolApproval, onToolOutput, onViewResearchSection)
            : (
              <>
                {renderMarkdown(content || '')}
                {isStreaming && <span className="streaming-cursor" aria-hidden="true" />}
              </>
            )
          }
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function ChatMessage({
  role,
  content,
  parts,
  messageId,
  isStreaming = false,
  onToolApproval,
  onToolOutput,
  onViewResearchSection,
  className,
}: ChatMessageProps) {
  if (role === 'user') {
    const textContent = parts
      ? parts
          .filter(isTextPart)
          .map((part) => part.text ?? '')
          .join('')
      : (content || '');
    return <UserMessage content={textContent} className={className} />;
  }
  return (
    <AssistantMessage
      content={content}
      parts={parts}
      messageId={messageId ?? (content ? 'welcome' : 'msg')}
      isStreaming={isStreaming}
      onToolApproval={onToolApproval}
      onToolOutput={onToolOutput}
      onViewResearchSection={onViewResearchSection}
      className={className}
    />
  );
}
