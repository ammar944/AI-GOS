'use client';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type ChatRole = 'user' | 'assistant';

export interface ChatMessageProps {
  role: ChatRole;
  content: string;
  children?: React.ReactNode;
}

export function ChatMessage({ role, content, children }: ChatMessageProps) {
  const isUser = role === 'user';

  return (
    <Card
      className={cn(
        'rounded-lg',
        isUser ? 'ml-8 bg-muted' : 'mr-8',
      )}
    >
      <CardContent className="px-4 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-xs font-medium px-1.5 py-0.5 rounded-md',
              isUser
                ? 'bg-primary/10 text-primary'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {isUser ? 'You' : 'AIGOS'}
          </span>
        </div>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
        {children}
      </CardContent>
    </Card>
  );
}
