'use client';

import { motion } from 'framer-motion';
import type { OnboardingState } from '@/lib/journey/session-state';

interface ResumePromptProps {
  session: OnboardingState;
  onContinue: () => void;
  onStartFresh: () => void;
}

export function ResumePrompt({
  session,
  onContinue,
  onStartFresh,
}: ResumePromptProps) {
  const { requiredFieldsCompleted, completionPercent } = session;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="flex gap-3 items-start"
    >
      {/* Agent avatar — matches ChatMessage assistant style */}
      <div
        className="flex-shrink-0 rounded-[7px] flex items-center justify-center"
        style={{
          width: '24px',
          height: '24px',
          background: 'linear-gradient(135deg, var(--accent-blue), #006fff)',
          marginTop: '1px',
        }}
        aria-hidden="true"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3l1.88 5.76a2 2 0 001.27 1.27L21 12l-5.85 1.97a2 2 0 00-1.27 1.27L12 21l-1.88-5.76a2 2 0 00-1.27-1.27L3 12l5.85-1.97a2 2 0 001.27-1.27L12 3z" />
        </svg>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className="leading-relaxed mb-4"
          style={{
            fontSize: '13.5px',
            lineHeight: '1.65',
            color: 'var(--text-secondary)',
          }}
        >
          Welcome back. Looks like you were in the middle of your onboarding
          last time &mdash; you&apos;ve completed{' '}
          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
            {requiredFieldsCompleted} of 8
          </span>{' '}
          required fields ({completionPercent}%).
        </p>

        <div className="flex flex-col gap-2 max-w-xs">
          <button
            onClick={onContinue}
            className="px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
            style={{
              background: 'var(--accent-blue, rgb(54, 94, 255))',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            Continue where you left off
          </button>

          <button
            onClick={onStartFresh}
            className="px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
            style={{
              background: 'transparent',
              color: 'var(--text-tertiary)',
              border: '1px solid var(--border-default)',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-hover, var(--border-default))';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-default)';
              e.currentTarget.style.color = 'var(--text-tertiary)';
            }}
          >
            Start fresh
          </button>
        </div>
      </div>
    </motion.div>
  );
}
