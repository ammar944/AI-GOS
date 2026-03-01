'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface TypingIndicatorProps {
  className?: string
}

export function TypingIndicator({ className }: TypingIndicatorProps) {
  return (
    <div role="status" aria-label="Loading" className={cn('flex items-center gap-1 py-2', className)}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          animate={{
            y: [0, -6, 0],
            opacity: [0.4, 1, 0.4],
          }}
          transition={{
            duration: 0.5,
            repeat: Infinity,
            delay: i * 0.12,
            ease: 'easeInOut',
          }}
          className="rounded-full"
          style={{
            width: '5px',
            height: '5px',
            background: 'var(--accent-blue)',
          }}
        />
      ))}
    </div>
  )
}
