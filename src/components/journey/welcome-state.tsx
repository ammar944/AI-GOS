'use client';

import { JourneyChatInput } from '@/components/journey/chat-input';

interface WelcomeStateProps {
  onSubmit: (content: string) => void;
  isLoading: boolean;
}

export function WelcomeState({ onSubmit, isLoading }: WelcomeStateProps) {
  return (
    <div className="flex flex-col h-full relative">
      {/* Hero message — exact mockup markup */}
      <div className="flex-1 flex flex-col items-center justify-center px-12 space-y-12">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <h2 className="text-3xl font-light text-[var(--text-primary)]">
            Initialize a performance-driven market analysis for{' '}
            <span className="text-brand-accent">SaaS Infrastructure</span>.
          </h2>
          <p className="text-[var(--text-tertiary)] text-sm">
            Targeting Series A startups in North America.
          </p>
        </div>
      </div>

      {/* Floating Input Bar */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center px-12 pointer-events-none">
        <JourneyChatInput
          onSubmit={onSubmit}
          isLoading={isLoading}
          placeholder="Company name and website to begin..."
        />
      </div>
    </div>
  );
}
