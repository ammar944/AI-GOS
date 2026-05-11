'use client';

import { useState } from 'react';
import { Share2, ExternalLink, FileText, BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ShaderMeshBackground, BackgroundPattern } from '@/components/ui/sl-background';
import { CardContentSwitch } from '@/components/research/card-renderer';
import { SectionHeader } from '@/components/workspace/section-header';
import { CardGrid } from '@/components/workspace/card-grid';
import { ReadOnlyCard } from './read-only-card';
import { SECTION_META } from '@/lib/journey/section-meta';
import { RESEARCH_SECTIONS } from '@/lib/workspace/pipeline';
import { cn } from '@/lib/utils';
import type { CardState, SectionKey } from '@/lib/workspace/types';

type TabKey = 'research' | 'mediaPlan';

interface SharedSessionViewProps {
  title: string;
  createdAt: string;
  researchSnapshot: Record<string, CardState[]> | null;
  mediaPlanSnapshot: CardState[] | null;
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Recently';
  }
}

export function SharedSessionView({
  title,
  createdAt,
  researchSnapshot,
  mediaPlanSnapshot,
}: SharedSessionViewProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('research');
  const [activeSection, setActiveSection] = useState<SectionKey>('industryMarket');

  const hasResearch = researchSnapshot && Object.keys(researchSnapshot).length > 0;
  const hasMediaPlan = mediaPlanSnapshot && mediaPlanSnapshot.length > 0;

  // Research section navigation — only sections with cards
  const availableSections = RESEARCH_SECTIONS.filter(
    (key) => researchSnapshot?.[key]?.length,
  );

  const currentCards =
    activeTab === 'research'
      ? researchSnapshot?.[activeSection] ?? []
      : mediaPlanSnapshot ?? [];

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--bg-base)]">
      <ShaderMeshBackground variant="page" />
      <BackgroundPattern opacity={0.02} />

      <main className="flex-1 min-h-0 flex flex-col relative z-10">
        {/* Header */}
        <div className="shrink-0 border-b border-[var(--border-default)] bg-[rgba(7,9,14,0.8)] backdrop-blur-xl">
          <div className="container mx-auto px-4">
            <div className="flex h-12 items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <Share2 className="h-4 w-4 text-[var(--text-secondary)] shrink-0" />
                <h1 className="text-[var(--text-primary)] text-sm font-semibold font-[family-name:var(--font-heading)] truncate">
                  {title}
                </h1>
                <span className="text-[var(--text-quaternary)] hidden sm:inline">|</span>
                <span className="text-[var(--text-tertiary)] text-xs hidden sm:inline shrink-0">
                  {formatDate(createdAt)}
                </span>
              </div>
              <Badge
                variant="outline"
                className="ml-3 shrink-0 flex items-center gap-1 bg-[var(--bg-hover)] border border-[var(--border-default)] text-[var(--text-tertiary)] text-[11px] px-2 py-0.5"
              >
                <ExternalLink className="h-3 w-3" />
                Read-only
              </Badge>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        {hasResearch && hasMediaPlan && (
          <div className="shrink-0 border-b border-[var(--border-default)] bg-[rgba(7,9,14,0.6)] backdrop-blur-xl">
            <div className="container mx-auto px-4">
              <div className="flex h-10 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('research')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                    activeTab === 'research'
                      ? 'bg-[var(--bg-hover)] text-[var(--text-secondary)] border border-[var(--border-subtle)]'
                      : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]',
                  )}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Research
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('mediaPlan')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                    activeTab === 'mediaPlan'
                      ? 'bg-[var(--bg-hover)] text-[var(--text-secondary)] border border-[var(--border-subtle)]'
                      : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]',
                  )}
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  Media Plan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Section sidebar + content */}
        <div className="flex-1 min-h-0 flex">
          {/* Section nav (research tab only) */}
          {activeTab === 'research' && availableSections.length > 1 && (
            <nav className="shrink-0 w-48 border-r border-[var(--border-default)] bg-[rgba(7,9,14,0.4)] overflow-y-auto custom-scrollbar">
              <div className="py-3 px-2 space-y-0.5">
                {availableSections.map((key) => {
                  const meta = SECTION_META[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiveSection(key)}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-md text-xs transition-colors',
                        activeSection === key
                          ? 'bg-[var(--bg-hover)] text-[var(--text-secondary)] border border-[var(--border-subtle)]'
                          : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-white/5',
                      )}
                    >
                      <span className="font-mono text-[10px] opacity-60">{meta?.moduleNumber}</span>
                      <span className="ml-1.5">{meta?.label ?? key}</span>
                    </button>
                  );
                })}
              </div>
            </nav>
          )}

          {/* Cards content */}
          <div className="flex-1 overflow-y-auto px-6 pt-6 custom-scrollbar">
            {activeTab === 'research' && (
              <SectionHeader section={activeSection} mode="document" />
            )}
            {activeTab === 'mediaPlan' && (
              <SectionHeader section="mediaPlan" mode="document" />
            )}

            {currentCards.length > 0 ? (
              <CardGrid>
                {currentCards.map((card, i) => (
                  <ReadOnlyCard key={card.id} card={card} index={i}>
                    <CardContentSwitch card={card} />
                  </ReadOnlyCard>
                ))}
              </CardGrid>
            ) : (
              <div className="flex items-center justify-center min-h-[300px]">
                <p className="text-sm text-[var(--text-quaternary)]">
                  No data available for this section
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer CTA */}
        <div className="shrink-0 border-t border-[var(--border-default)] bg-[rgba(7,9,14,0.6)] backdrop-blur-xl">
          <div className="container mx-auto px-4">
            <div className="flex h-11 items-center justify-between">
              <p className="text-[var(--text-tertiary)] text-xs hidden sm:inline">
                Generated with AIGOS
              </p>
              <a
                href="/research-v2"
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-opacity duration-200 hover:opacity-90 cursor-pointer bg-[var(--accent-green)] text-white ml-auto"
              >
                Create Your Own
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
