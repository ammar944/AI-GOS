'use client';

import { cn } from '@/lib/utils';

interface JourneyLayoutProps {
  phase: 'setup' | 'review';
  chatContent: React.ReactNode;
  blueprintContent?: React.ReactNode;
  className?: string;
}

export function JourneyLayout({
  phase,
  chatContent,
  blueprintContent,
  className,
}: JourneyLayoutProps) {
  const isCentered = phase === 'setup';

  return (
    <div
      className={cn('flex h-full w-full', className)}
      style={{
        background: 'var(--bg-base)',
        transition: 'all 0.3s ease',
      }}
    >
      {/* Chat Panel */}
      <div
        className="flex flex-col h-full"
        style={{
          width: isCentered ? '100%' : 'var(--chat-width)',
          maxWidth: isCentered ? '720px' : 'var(--chat-width)',
          margin: isCentered ? '0 auto' : '0',
          flexShrink: 0,
          transition: 'all 0.3s ease',
        }}
      >
        {chatContent}
      </div>

      {/* Blueprint Panel — only visible in review phase */}
      {!isCentered && blueprintContent && (
        <div
          className="flex-1 h-full overflow-y-auto"
          style={{
            borderLeft: '1px solid var(--border-default)',
            background: 'var(--bg-elevated)',
            transition: 'all 0.3s ease',
          }}
        >
          {blueprintContent}
        </div>
      )}
    </div>
  );
}
