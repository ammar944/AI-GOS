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
import { ResearchCanvas } from './research-canvas';
import { OnboardingContext } from './onboarding-context';
import { CapabilitiesBar } from './capabilities-bar';
import { useResearchData } from '@/hooks/use-research-data';
import type { ResearchSectionKey } from '@/hooks/use-research-data';

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
        className="flex items-center justify-between w-full text-left focus-ring"
        style={{
          padding: '14px 16px 10px',
          cursor: 'pointer',
          background: 'transparent',
          border: 'none',
        }}
      >
        <span
          style={{
            fontSize: 12,
            letterSpacing: '0.01em',
            fontWeight: 500,
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
  activeSectionKey?: string | null;
}

export function ContextPanel({
  onboardingState,
  messages,
  journeyProgress,
  activeSectionKey,
}: ContextPanelProps) {
  const { sections, completedSections, anyRunning } = useResearchData(messages);
  const [activeCanvasSection, setActiveCanvasSection] = useState<string | null>(null);

  // External prop takes priority
  const effectiveActiveSection = activeSectionKey ?? activeCanvasSection;

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
      <PanelSection title="Progress" defaultOpen={true}>
        <ProgressTracker journeyProgress={journeyProgress} />
      </PanelSection>

      <PanelSection title="Research" defaultOpen={true}>
        {(anyRunning || completedSections.length > 0) ? (
          <div style={{ margin: '0 -16px', height: 320 }}>
            <ResearchCanvas
              sections={sections}
              activeSection={effectiveActiveSection as ResearchSectionKey | null}
              onTabChange={(key) => setActiveCanvasSection(key)}
            />
          </div>
        ) : (
          <ResearchSections messages={messages} />
        )}
      </PanelSection>

      <PanelSection title="Context" defaultOpen={true}>
        <OnboardingContext onboardingState={onboardingState} />
      </PanelSection>

      <PanelSection title="Capabilities" defaultOpen={true}>
        <CapabilitiesBar />
      </PanelSection>
    </div>
  );
}
