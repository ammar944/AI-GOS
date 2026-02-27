'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion';

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
    <div className={cn('flex h-full w-full', className)} style={{ background: 'var(--bg-base)' }}>
      {/* Chat Panel — animates width on phase change */}
      <motion.div
        className="flex flex-col h-full flex-shrink-0"
        layout
        animate={{
          width: isCentered ? '100%' : '440px',
          maxWidth: isCentered ? '720px' : '440px',
          marginLeft: isCentered ? 'auto' : '0px',
          marginRight: isCentered ? 'auto' : '0px',
        }}
        transition={springs.gentle}
      >
        {chatContent}
      </motion.div>

      {/* Blueprint Panel — slides in from right */}
      <AnimatePresence mode="wait">
        {!isCentered && blueprintContent && (
          <motion.div
            key="blueprint-panel"
            className="flex-1 h-full overflow-y-auto"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={springs.gentle}
            style={{
              borderLeft: '1px solid var(--border-default)',
              background: 'var(--bg-elevated)',
            }}
          >
            {blueprintContent}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
