'use client';

import { cn } from '@/lib/utils';
import { User, Bot, Pencil } from 'lucide-react';

interface Source {
  chunkId: string;
  section: string;
  fieldPath: string;
  similarity: number;
}

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  confidence?: 'high' | 'medium' | 'low';
  isLoading?: boolean;
  /** Whether this message contains an edit proposal */
  isEditProposal?: boolean;
}

const SECTION_LABELS: Record<string, string> = {
  industryMarketOverview: 'Industry & Market',
  icpAnalysisValidation: 'ICP Analysis',
  offerAnalysisViability: 'Offer Analysis',
  competitorAnalysis: 'Competitors',
  crossAnalysisSynthesis: 'Synthesis',
};

/**
 * Render content with markdown-style formatting for edit proposals
 */
function renderContent(content: string, isEditProposal?: boolean) {
  if (!isEditProposal) {
    return <div className="text-sm whitespace-pre-wrap">{content}</div>;
  }

  // Split content into parts to handle code blocks and bold text
  const parts = content.split(/(\*\*[^*]+\*\*|```diff\n[\s\S]*?```)/g);

  return (
    <div className="text-sm space-y-2">
      {parts.map((part, index) => {
        // Handle bold text
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <span key={index} className="font-semibold">
              {part.slice(2, -2)}
            </span>
          );
        }

        // Handle diff code blocks
        if (part.startsWith('```diff')) {
          const code = part.replace(/```diff\n?/, '').replace(/```$/, '').trim();
          return (
            <pre
              key={index}
              className="text-xs bg-muted p-3 rounded border overflow-auto font-mono whitespace-pre-wrap"
            >
              {code.split('\n').map((line, lineIndex) => {
                const isRemoved = line.startsWith('-');
                const isAdded = line.startsWith('+');
                return (
                  <div
                    key={lineIndex}
                    className={cn(
                      isRemoved && 'text-red-600 dark:text-red-400',
                      isAdded && 'text-green-600 dark:text-green-400'
                    )}
                  >
                    {line}
                  </div>
                );
              })}
            </pre>
          );
        }

        // Regular text
        return (
          <span key={index} className="whitespace-pre-wrap">
            {part}
          </span>
        );
      })}
    </div>
  );
}

export function ChatMessage({
  role,
  content,
  sources,
  confidence,
  isLoading,
  isEditProposal,
}: ChatMessageProps) {
  const isUser = role === 'user';

  return (
    <div
      className={cn(
        'flex gap-3 p-4 rounded-lg',
        isUser ? 'bg-muted/50' : 'bg-background',
        isEditProposal && 'border border-amber-500/30 bg-amber-50/5'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          isUser
            ? 'bg-primary text-primary-foreground'
            : isEditProposal
            ? 'bg-amber-500 text-amber-50'
            : 'bg-secondary'
        )}
      >
        {isUser ? (
          <User className="w-4 h-4" />
        ) : isEditProposal ? (
          <Pencil className="w-4 h-4" />
        ) : (
          <Bot className="w-4 h-4" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 space-y-2">
        <div className="font-medium text-sm text-muted-foreground flex items-center gap-2">
          {isUser ? 'You' : 'Blueprint Assistant'}
          {isEditProposal && (
            <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
              Edit Proposal
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:100ms]" />
            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:200ms]" />
          </div>
        ) : (
          <>
            {renderContent(content, isEditProposal)}

            {/* Sources (for assistant messages) */}
            {sources && sources.length > 0 && (
              <div className="mt-3 pt-3 border-t">
                <div className="text-xs text-muted-foreground mb-2">
                  Sources ({sources.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {sources.map((source) => (
                    <span
                      key={source.chunkId}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted rounded text-xs"
                      title={`${source.fieldPath} (${Math.round(source.similarity * 100)}% match)`}
                    >
                      {SECTION_LABELS[source.section] || source.section}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Confidence indicator */}
            {confidence && !isEditProposal && (
              <div className="mt-2">
                <span
                  className={cn(
                    'text-xs px-2 py-0.5 rounded',
                    confidence === 'high' && 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
                    confidence === 'medium' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
                    confidence === 'low' && 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                  )}
                >
                  {confidence} confidence
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
