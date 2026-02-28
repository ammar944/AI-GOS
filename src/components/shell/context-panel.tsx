'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import type { UIMessage } from 'ai';
import type { JourneyProgress } from '@/lib/journey/journey-progress-state';
import type { OnboardingState } from '@/lib/journey/session-state';
import { springs } from '@/lib/motion';
import { ProgressTracker } from './progress-tracker';
import { ResearchSections } from './research-sections';
import { OnboardingContext } from './onboarding-context';
import { CapabilitiesBar } from './capabilities-bar';

// ── PanelSection ──────────────────────────────────────────────────────────────

interface PanelSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function PanelSection({ title, defaultOpen = true, children }: PanelSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      style={{
        borderBottom: '1px solid var(--border-default)',
      }}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full text-left"
        style={{
          padding: '14px 16px 10px',
          cursor: 'pointer',
          background: 'transparent',
          border: 'none',
        }}
      >
        <span
          style={{
            fontSize: 10.5,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontWeight: 600,
            color: 'var(--text-tertiary)',
          }}
        >
          {title}
        </span>
        <motion.span
          animate={{ rotate: open ? 0 : -90 }}
          transition={springs.snappy}
          style={{ display: 'flex', alignItems: 'center' }}
        >
          <ChevronDown
            style={{
              width: 14,
              height: 14,
              color: 'var(--text-quaternary)',
            }}
          />
        </motion.span>
      </button>

      {/* Body — animated collapse */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ ...springs.smooth, opacity: { duration: 0.15 } }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '0 16px 14px' }}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── ContextPanel ──────────────────────────────────────────────────────────────

interface ContextPanelProps {
  onboardingState: Partial<OnboardingState> | null;
  messages: UIMessage[];
  journeyProgress: JourneyProgress;
}

export function ContextPanel({
  onboardingState,
  messages,
  journeyProgress,
}: ContextPanelProps) {
  return (
    <div
      className="flex flex-col h-full overflow-y-auto"
      style={{
        // Custom thin scrollbar
        scrollbarWidth: 'thin',
        scrollbarColor: 'var(--border-default) transparent',
      }}
    >
      {/* Webkit scrollbar override via inline styles won't work — handled in CSS above */}
      <PanelSection title="PROGRESS" defaultOpen={true}>
        <ProgressTracker journeyProgress={journeyProgress} />
      </PanelSection>

      <PanelSection title="RESEARCH" defaultOpen={true}>
        <ResearchSections messages={messages} />
      </PanelSection>

      <PanelSection title="CONTEXT" defaultOpen={true}>
        <OnboardingContext onboardingState={onboardingState} />
      </PanelSection>

      <PanelSection title="CAPABILITIES" defaultOpen={true}>
        <CapabilitiesBar />
      </PanelSection>
    </div>
  );
}
