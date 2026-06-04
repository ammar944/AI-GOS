'use client';

import { useMemo, useState, type ReactElement } from 'react';
import { Share2, ExternalLink, FileText, BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  BodyProse,
  Eyebrow,
  SectionTitle,
  VerdictCallout,
} from '@/components/research-v2/ui-kit';
import { TypedArtifactRenderer } from '@/components/research-v2/typed-artifact-renderer';
import { VerificationTierBadge } from '@/components/research-v2/verification-tier-badge';
import { ShaderMeshBackground, BackgroundPattern } from '@/components/ui/sl-background';
import { CardContentSwitch } from '@/components/research/card-renderer';
import { SectionHeader } from '@/components/workspace/section-header';
import { CardGrid } from '@/components/workspace/card-grid';
import { ReadOnlyCard } from './read-only-card';
import { READER_SECTION_LABELS } from '@/components/research-v3/reader-sections';
import { SECTION_META } from '@/lib/journey/section-meta';
import {
  isV3ShareResearchSnapshot,
  type V3ShareResearchSnapshot,
} from '@/lib/research-v2/share-snapshot';
import { RESEARCH_SECTIONS } from '@/lib/workspace/pipeline';
import { cn } from '@/lib/utils';
import {
  pickPositioningTypedArtifact,
  type PositioningTypedArtifact,
} from '@/types/positioning-artifact';
import type { CardState, SectionKey } from '@/lib/workspace/types';

type TabKey = 'research' | 'mediaPlan';

interface SharedSessionViewProps {
  title: string;
  createdAt: string;
  researchSnapshot: unknown;
  mediaPlanSnapshot: unknown;
}

interface V3SharedSectionViewModel {
  zone: V3ShareResearchSnapshot['sections'][number]['zone'];
  title: string;
  artifact: PositioningTypedArtifact | null;
  markdown: string | null;
  verificationTier: V3ShareResearchSnapshot['sections'][number]['verificationTier'];
  verificationFlag: V3ShareResearchSnapshot['sections'][number]['verificationFlag'];
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

function isLegacyResearchSnapshot(
  value: unknown,
): value is Record<string, CardState[]> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isLegacyMediaPlanSnapshot(value: unknown): value is CardState[] {
  return Array.isArray(value);
}

function buildV3ViewSections(
  snapshot: V3ShareResearchSnapshot,
): V3SharedSectionViewModel[] {
  return snapshot.sections.map((section) => ({
    zone: section.zone,
    title: section.title || READER_SECTION_LABELS[section.zone],
    artifact: pickPositioningTypedArtifact(section.data, section.zone),
    markdown: section.markdown,
    verificationTier: section.verificationTier,
    verificationFlag: section.verificationFlag,
  }));
}

function V3SharedSessionView({
  createdAt,
  snapshot,
  title,
}: {
  createdAt: string;
  snapshot: V3ShareResearchSnapshot;
  title: string;
}): ReactElement {
  const sections = useMemo(() => buildV3ViewSections(snapshot), [snapshot]);
  const [activeZone, setActiveZone] = useState(() => sections[0]?.zone ?? null);
  const activeSection =
    sections.find((section) => section.zone === activeZone) ?? sections[0] ?? null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <main className="relative z-10 flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-border bg-card">
          <div className="mx-auto flex h-12 w-full max-w-6xl items-center justify-between px-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <Share2 className="size-4 shrink-0 text-muted-foreground" />
              <h1 className="truncate text-sm font-semibold tracking-tight text-foreground">
                {title}
              </h1>
              <span className="hidden text-muted-foreground/40 sm:inline">/</span>
              <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                {formatDate(createdAt)}
              </span>
            </div>
            <Badge
              variant="outline"
              className="ml-3 flex shrink-0 items-center gap-1 text-[11px]"
            >
              <ExternalLink className="size-3" />
              Read-only
            </Badge>
          </div>
        </div>

        <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1">
          {sections.length > 1 ? (
            <nav className="hidden w-60 shrink-0 overflow-y-auto border-r border-border bg-card px-3 py-4 sm:block">
              <div className="space-y-1">
                {sections.map((section) => (
                  <button
                    key={section.zone}
                    type="button"
                    onClick={() => setActiveZone(section.zone)}
                    className={cn(
                      'w-full rounded-md px-3 py-2 text-left text-xs transition-colors',
                      activeSection?.zone === section.zone
                        ? 'bg-secondary text-foreground'
                        : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
                    )}
                  >
                    {READER_SECTION_LABELS[section.zone]}
                  </button>
                ))}
              </div>
            </nav>
          ) : null}

          <div className="min-w-0 flex-1 overflow-y-auto bg-card px-6 py-8 sm:px-10">
            {sections.length > 1 ? (
              <nav className="mb-6 flex gap-4 overflow-x-auto border-b border-border pb-px sm:hidden">
                {sections.map((section) => (
                  <button
                    key={section.zone}
                    type="button"
                    onClick={() => setActiveZone(section.zone)}
                    className={cn(
                      'shrink-0 border-b-[1.5px] pb-2 text-[12px] font-medium transition-colors',
                      activeSection?.zone === section.zone
                        ? 'border-primary text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {READER_SECTION_LABELS[section.zone]}
                  </button>
                ))}
              </nav>
            ) : null}

            {activeSection ? (
              <article className="mx-auto max-w-[760px]">
                <Eyebrow>Shared Audit</Eyebrow>
                <SectionTitle className="mt-2">
                  {activeSection.artifact?.sectionTitle ?? activeSection.title}
                </SectionTitle>
                <VerificationTierBadge
                  className="mt-3"
                  verification={activeSection.artifact?.verification}
                  verificationTier={activeSection.verificationTier}
                  verificationFlag={activeSection.verificationFlag}
                />
                {activeSection.artifact ? (
                  <div className="mt-6 space-y-7">
                    {activeSection.artifact.statusSummary ? (
                      <BodyProse>{activeSection.artifact.statusSummary}</BodyProse>
                    ) : null}
                    <VerdictCallout verdict={activeSection.artifact.verdict} />
                    <TypedArtifactRenderer
                      artifact={activeSection.artifact}
                      zoneId={activeSection.zone}
                      showSectionTitle={false}
                    />
                  </div>
                ) : activeSection.markdown ? (
                  <pre className="mt-6 whitespace-pre-wrap rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
                    {activeSection.markdown}
                  </pre>
                ) : (
                  <div className="mt-6 border-l-2 border-border pl-4 text-sm text-muted-foreground">
                    No data available for this section
                  </div>
                )}
              </article>
            ) : (
              <div className="flex min-h-[300px] items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  No shared sections available
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-border bg-card">
          <div className="mx-auto flex h-11 max-w-6xl items-center justify-between px-4">
            <p className="hidden text-xs text-muted-foreground sm:inline">
              Generated with AIGOS
            </p>
            <a
              href="/research-v3"
              className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Create Your Own
              <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}

export function SharedSessionView({
  title,
  createdAt,
  researchSnapshot,
  mediaPlanSnapshot,
}: SharedSessionViewProps): ReactElement {
  if (isV3ShareResearchSnapshot(researchSnapshot)) {
    return (
      <V3SharedSessionView
        title={title}
        createdAt={createdAt}
        snapshot={researchSnapshot}
      />
    );
  }

  return (
    <LegacySharedSessionView
      title={title}
      createdAt={createdAt}
      researchSnapshot={researchSnapshot}
      mediaPlanSnapshot={mediaPlanSnapshot}
    />
  );
}

function LegacySharedSessionView({
  title,
  createdAt,
  researchSnapshot,
  mediaPlanSnapshot,
}: SharedSessionViewProps): ReactElement {
  const [activeTab, setActiveTab] = useState<TabKey>('research');
  const [activeSection, setActiveSection] = useState<SectionKey>('industryMarket');
  const legacyResearchSnapshot = isLegacyResearchSnapshot(researchSnapshot)
    ? researchSnapshot
    : null;
  const legacyMediaPlanSnapshot = isLegacyMediaPlanSnapshot(mediaPlanSnapshot)
    ? mediaPlanSnapshot
    : null;

  const hasResearch =
    legacyResearchSnapshot && Object.keys(legacyResearchSnapshot).length > 0;
  const hasMediaPlan =
    legacyMediaPlanSnapshot && legacyMediaPlanSnapshot.length > 0;

  // Research section navigation — only sections with cards
  const availableSections = RESEARCH_SECTIONS.filter(
    (key) => legacyResearchSnapshot?.[key]?.length,
  );

  const currentCards =
    activeTab === 'research'
      ? legacyResearchSnapshot?.[activeSection] ?? []
      : legacyMediaPlanSnapshot ?? [];

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
                href="/research-v3"
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
