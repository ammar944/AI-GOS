'use client';

import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Zap, Target, BarChart3, Globe } from 'lucide-react';
import { staggerContainer, staggerItem, springs } from '@/lib/motion';
import { JourneyChatInput } from '@/components/journey/chat-input';

interface WelcomeStateProps {
  onSubmit: (content: string) => void;
  isLoading: boolean;
}

const CAPABILITIES = [
  { icon: Target, label: 'ICP Analysis', description: 'Deep audience profiling' },
  { icon: BarChart3, label: 'Market Intel', description: 'Industry research & sizing' },
  { icon: Globe, label: 'Competitor Audit', description: 'Ad library & keyword intel' },
  { icon: Zap, label: 'Media Plan', description: '16-section strategic blueprint' },
] as const;

export function WelcomeState({ onSubmit, isLoading }: WelcomeStateProps) {
  return (
    <div className="flex flex-col h-full items-center justify-center px-6">
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="w-full max-w-[540px]"
      >
        {/* Icon badge */}
        <motion.div
          variants={staggerItem}
          transition={springs.gentle}
          className="mb-6 flex items-center gap-3"
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, var(--brand-accent, #3c83f6), var(--brand-success, #10B981))',
              boxShadow: '0 0 24px rgba(60, 131, 246, 0.2)',
            }}
          >
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div
            className="px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider"
            style={{
              background: 'rgba(60, 131, 246, 0.08)',
              color: 'var(--brand-accent, #3c83f6)',
              border: '1px solid rgba(60, 131, 246, 0.15)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            Strategic Engine
          </div>
        </motion.div>

        {/* Heading */}
        <motion.h1
          variants={staggerItem}
          transition={springs.gentle}
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: '-0.03em',
            lineHeight: 1.15,
            margin: 0,
            background: 'linear-gradient(135deg, var(--text-primary, #fcfcfa) 0%, var(--text-secondary, #cdd0d5) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Your go-to-market strategy starts here.
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          variants={staggerItem}
          transition={springs.gentle}
          className="mt-3"
          style={{
            fontSize: 14,
            color: 'var(--text-quaternary, #555)',
            marginBottom: 0,
            lineHeight: 1.6,
            fontFamily: 'var(--font-body, Inter)',
            maxWidth: 420,
          }}
        >
          Tell AIGOS about your business. Our 8 specialist agents will research your market,
          analyze competitors, and build a comprehensive media plan.
        </motion.p>

        {/* Capability chips */}
        <motion.div
          variants={staggerItem}
          transition={springs.gentle}
          className="mt-6 flex flex-wrap gap-2"
        >
          {CAPABILITIES.map((cap) => {
            const Icon = cap.icon;
            return (
              <div
                key={cap.label}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors duration-150"
                style={{
                  background: 'var(--bg-glass-card, rgba(255,255,255,0.03))',
                  border: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
                  cursor: 'default',
                }}
              >
                <Icon
                  className="w-3 h-3"
                  style={{ color: 'var(--brand-accent, #3c83f6)', opacity: 0.7 }}
                />
                <span
                  className="text-[11px] font-medium"
                  style={{ color: 'var(--text-secondary, #cdd0d5)' }}
                >
                  {cap.label}
                </span>
              </div>
            );
          })}
        </motion.div>

        {/* Input */}
        <motion.div
          variants={staggerItem}
          transition={springs.gentle}
          className="mt-8"
        >
          <JourneyChatInput
            onSubmit={onSubmit}
            isLoading={isLoading}
            placeholder="Tell me about your business and website..."
          />
        </motion.div>

        {/* Hint */}
        <motion.p
          variants={staggerItem}
          transition={springs.gentle}
          className="mt-3 flex items-center gap-1.5"
          style={{
            fontSize: 11,
            color: 'var(--text-quaternary, #555)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <ArrowRight className="w-3 h-3" style={{ opacity: 0.4 }} />
          <span style={{ opacity: 0.5 }}>
            e.g. &quot;We&apos;re a B2B SaaS helping teams automate workflows — techflow.io&quot;
          </span>
        </motion.p>
      </motion.div>
    </div>
  );
}
