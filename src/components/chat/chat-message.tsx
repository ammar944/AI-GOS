'use client';

import { cn } from '@/lib/utils';
import { User, Bot } from 'lucide-react';

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
}

const SECTION_LABELS: Record<string, string> = {
  industryMarketOverview: 'Industry & Market',
  icpAnalysisValidation: 'ICP Analysis',
  offerAnalysisViability: 'Offer Analysis',
  competitorAnalysis: 'Competitors',
  crossAnalysisSynthesis: 'Synthesis',
};

export function ChatMessage({
  role,
  content,
  sources,
  confidence,
  isLoading,
}: ChatMessageProps) {
  const isUser = role === 'user';

  return (
    <div
      className={cn(
        'flex gap-3 p-4 rounded-lg',
        isUser ? 'bg-muted/50' : 'bg-background'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-secondary'
        )}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Content */}
      <div className="flex-1 space-y-2">
        <div className="font-medium text-sm text-muted-foreground">
          {isUser ? 'You' : 'Blueprint Assistant'}
        </div>

        {isLoading ? (
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:100ms]" />
            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:200ms]" />
          </div>
        ) : (
          <>
            <div className="text-sm whitespace-pre-wrap">{content}</div>

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
            {confidence && (
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
