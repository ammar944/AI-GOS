'use client';

import { useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { SectionTabs } from '@/components/workspace/section-tabs';
import { SectionHeader } from '@/components/workspace/section-header';
import { CardRenderer } from '@/components/research/card-renderer';
import { CardGrid } from '@/components/workspace/card-grid';
import type { CardState, SectionKey } from '@/lib/workspace/types';

interface ResearchDocumentProps {
  cardsBySection: Record<string, CardState[]>;
  availableSections: SectionKey[];
  title: string;
}

export function ResearchDocument({ cardsBySection, availableSections, title }: ResearchDocumentProps) {
  const [currentSection, setCurrentSection] = useState<SectionKey>(
    availableSections[0] ?? 'industryMarket',
  );

  const sectionCards = useMemo(
    () => cardsBySection[currentSection] ?? [],
    [cardsBySection, currentSection],
  );

  return (
    <div className="flex h-full flex-col bg-[var(--bg-base)]">
      {/* Header with back button + section tabs */}
      <div className="flex items-center border-b border-[var(--border-subtle)] bg-[var(--bg-base)] sticky top-0 z-10">
        <Link
          href="/research"
          className="flex items-center gap-1.5 px-4 py-3 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors shrink-0 border-r border-[var(--border-subtle)]"
        >
          <ArrowLeft className="size-3.5" />
          Back
        </Link>
        <div className="flex-1 overflow-hidden">
          <SectionTabs
            sections={availableSections}
            currentSection={currentSection}
            onNavigate={setCurrentSection}
            mode="document"
          />
        </div>
      </div>

      {/* Content area — centered, max-width */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[800px] mx-auto px-6 py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSection}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <SectionHeader section={currentSection} />

              {sectionCards.length > 0 ? (
                <CardGrid>
                  {sectionCards.map((card, i) => (
                    <CardRenderer key={card.id} card={card} mode="document" index={i} />
                  ))}
                </CardGrid>
              ) : (
                <div className="flex items-center justify-center min-h-[300px]">
                  <p className="text-sm text-[var(--text-tertiary)] font-mono">
                    Research not completed for this section
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
