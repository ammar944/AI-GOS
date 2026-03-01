'use client';

import { motion } from 'framer-motion';
import { staggerContainer, staggerItem, springs } from '@/lib/motion';
import { JourneyChatInput } from '@/components/journey/chat-input';

interface WelcomeStateProps {
  onSubmit: (content: string) => void;
  isLoading: boolean;
}

export function WelcomeState({ onSubmit, isLoading }: WelcomeStateProps) {
  return (
    <div className="flex flex-col h-full items-center justify-center px-4">
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="w-full max-w-[480px]"
      >
        {/* Heading */}
        <motion.h1
          variants={staggerItem}
          transition={springs.gentle}
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
            lineHeight: 1.2,
            margin: 0,
          }}
        >
          AI-GOS, making growth easier.
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          variants={staggerItem}
          transition={springs.gentle}
          className="mt-2"
          style={{
            fontSize: 14,
            color: 'var(--text-tertiary)',
            marginBottom: 0,
            lineHeight: 1.5,
          }}
        >
          Your paid media strategy starts with a conversation.
        </motion.p>

        {/* Input */}
        <motion.div
          variants={staggerItem}
          transition={springs.gentle}
          className="mt-8"
        >
          <JourneyChatInput
            onSubmit={onSubmit}
            isLoading={isLoading}
            placeholder="Tell me about your business..."
          />
        </motion.div>
      </motion.div>
    </div>
  );
}
