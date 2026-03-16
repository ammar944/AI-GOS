'use client';

import { useState, useMemo, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Printer, Copy, Check } from 'lucide-react';
import Link from 'next/link';
import { SectionTabs } from '@/components/workspace/section-tabs';
import { SectionHeader } from '@/components/workspace/section-header';
import { CardRenderer } from '@/components/research/card-renderer';
import { CardGrid } from '@/components/workspace/card-grid';
import type { CardState, SectionKey } from '@/lib/workspace/types';
import { SECTION_META } from '@/lib/journey/section-meta';
import { MediaPlanButton } from '@/components/research/media-plan-button';

interface ResearchDocumentProps {
  cardsBySection: Record<string, CardState[]>;
  availableSections: SectionKey[];
  title: string;
  createdAt?: string;
  sessionId?: string;
  runId?: string;
  hasMediaPlan?: boolean;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function ResearchDocument({ cardsBySection, availableSections, title, createdAt, sessionId, runId, hasMediaPlan }: ResearchDocumentProps) {
  const [currentSection, setCurrentSection] = useState<SectionKey>(
    availableSections[0] ?? 'industryMarket',
  );

  const sectionCards = useMemo(
    () => cardsBySection[currentSection] ?? [],
    [cardsBySection, currentSection],
  );

  const totalCards = useMemo(
    () => Object.values(cardsBySection).reduce((sum, cards) => sum + cards.length, 0),
    [cardsBySection],
  );

  const [copied, setCopied] = useState(false);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleCopyAll = useCallback(() => {
    const lines: string[] = [];
    lines.push(`# ${title}`);
    if (createdAt) lines.push(`Generated: ${formatDate(createdAt)}`);
    lines.push('');

    for (const section of availableSections) {
      const meta = SECTION_META[section];
      const cards = cardsBySection[section] ?? [];
      if (cards.length === 0) continue;

      lines.push(`## ${meta?.moduleNumber ?? '00'} — ${meta?.label ?? section}`);
      if (meta?.description) lines.push(meta.description);
      lines.push('');

      for (const card of cards) {
        lines.push(`### ${card.label}`);
        const c = card.content;

        if (card.cardType === 'stat-grid' && Array.isArray(c.stats)) {
          for (const s of c.stats as { label: string; value: string }[]) {
            lines.push(`- ${s.label}: ${s.value}`);
          }
        } else if ((card.cardType === 'bullet-list' || card.cardType === 'check-list') && Array.isArray(c.items)) {
          for (const item of c.items as string[]) {
            lines.push(`- ${item}`);
          }
        } else if (card.cardType === 'prose-card' && typeof c.text === 'string') {
          lines.push(c.text);
        } else if (card.cardType === 'competitor-card') {
          lines.push(`**${c.name as string}**`);
          if (c.positioning) lines.push(`Positioning: ${c.positioning as string}`);
          if (c.price) lines.push(`Pricing: ${c.price as string}`);
          if (Array.isArray(c.strengths)) lines.push(`Strengths: ${(c.strengths as string[]).join(', ')}`);
          if (Array.isArray(c.weaknesses)) lines.push(`Weaknesses: ${(c.weaknesses as string[]).join(', ')}`);
        } else if (card.cardType === 'insight-card') {
          lines.push(c.insight as string);
          if (c.implication) lines.push(`Implication: ${c.implication as string}`);
        } else if (card.cardType === 'strategy-card') {
          if (c.recommendedAngle) lines.push(c.recommendedAngle as string);
          if (c.leadRecommendation) lines.push(c.leadRecommendation as string);
          if (c.keyDifferentiator) lines.push(`Differentiator: ${c.keyDifferentiator as string}`);
        } else if (card.cardType === 'trend-card') {
          lines.push(`${c.trend as string} (${c.direction as string})`);
          if (c.evidence) lines.push(c.evidence as string);
        } else if (card.cardType === 'gap-card') {
          lines.push(c.gap as string);
          if (c.evidence) lines.push(`Evidence: ${c.evidence as string}`);
          if (c.recommendedAction) lines.push(`Action: ${c.recommendedAction as string}`);
        } else {
          // Fallback: dump all string values
          for (const [key, val] of Object.entries(c)) {
            if (typeof val === 'string' && val.trim()) {
              lines.push(`${key}: ${val}`);
            } else if (Array.isArray(val)) {
              const strs = val.filter((v): v is string => typeof v === 'string');
              if (strs.length > 0) lines.push(`${key}: ${strs.join(', ')}`);
            }
          }
        }
        lines.push('');
      }
    }

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [title, createdAt, availableSections, cardsBySection]);

  return (
    <div className="flex h-full flex-col bg-[var(--bg-base)]">
      {/* Header bar — hidden in print */}
      <div className="no-print flex items-center border-b border-[var(--border-subtle)] bg-[var(--bg-base)] sticky top-0 z-10">
        <Link
          href="/dashboard"
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
        <div className="flex items-center gap-1 px-3 shrink-0 border-l border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={handleCopyAll}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-white/5 transition-colors"
            title="Copy all research to clipboard"
          >
            {copied ? <Check className="size-3.5 text-[var(--accent-green)]" /> : <Copy className="size-3.5" />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-white/5 transition-colors"
            title="Print / Save as PDF"
          >
            <Printer className="size-3.5" />
            <span className="hidden sm:inline">Print</span>
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-[800px] mx-auto px-6 py-8">
          {/* Document title */}
          <div className="mb-8">
            <h1 className="text-xl font-heading font-semibold text-[var(--text-primary)] truncate">
              {title}
            </h1>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-[var(--text-tertiary)] font-mono">
              {createdAt && <span>{formatDate(createdAt)}</span>}
              <span className="text-[var(--text-quaternary)]">&middot;</span>
              <span>{availableSections.length} sections</span>
              <span className="text-[var(--text-quaternary)]">&middot;</span>
              <span>{totalCards} insights</span>
            </div>
            {sessionId && runId && (
              <div className="mt-4">
                <MediaPlanButton sessionId={sessionId} runId={runId} hasMediaPlan={hasMediaPlan ?? false} />
              </div>
            )}
            <div className="h-px bg-gradient-to-r from-[var(--accent-blue)]/20 to-transparent mt-4" />
          </div>

          {/* Interactive section content (screen only) */}
          <div className="no-print">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSection}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <SectionHeader section={currentSection} mode="document" />

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

          {/* Print-only: all sections rendered sequentially */}
          <div className="hidden print-only">
            {availableSections.map((section) => {
              const cards = cardsBySection[section] ?? [];
              if (cards.length === 0) return null;
              const meta = SECTION_META[section];
              return (
                <div key={section} className="print-section mb-8">
                  <div className="mb-4 pb-2 border-b border-gray-200">
                    <span className="text-xs font-mono text-gray-500 uppercase tracking-widest">
                      Module {meta?.moduleNumber ?? '00'}
                    </span>
                    <h2 className="text-lg font-semibold text-black mt-1">
                      {meta?.label ?? section}
                    </h2>
                    {meta?.description && (
                      <p className="text-sm text-gray-500 mt-0.5">
                        {meta.description}
                      </p>
                    )}
                  </div>
                  <div className="space-y-3">
                    {cards.map((card) => (
                      <div key={card.id} className="rounded-lg border border-gray-200 p-4">
                        <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider block mb-2">
                          {card.label}
                        </span>
                        <div className="text-sm text-gray-700 print-card-content">
                          {renderPrintCardContent(card)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Simple text extraction for print mode — renders card content as readable text
 * without interactive components or animations.
 */
function renderPrintCardContent(card: CardState): React.ReactNode {
  const c = card.content;

  switch (card.cardType) {
    case 'stat-grid': {
      const stats = (c.stats ?? []) as { label: string; value: string; badge?: string }[];
      return (
        <div className="grid grid-cols-3 gap-2">
          {stats.map((s) => (
            <div key={s.label}>
              <span className="text-[10px] font-mono text-gray-400 uppercase block">{s.label}</span>
              <span className="text-sm font-medium text-gray-900">{s.value}</span>
              {s.badge && <span className="text-[10px] text-gray-500 block">{s.badge}</span>}
            </div>
          ))}
        </div>
      );
    }
    case 'bullet-list':
    case 'check-list': {
      const items = (c.items ?? []) as string[];
      return (
        <ul className="list-disc list-inside space-y-0.5">
          {items.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      );
    }
    case 'prose-card':
      return <p>{c.text as string}</p>;
    case 'competitor-card': {
      const positioning = c.positioning as string | undefined;
      const price = c.price as string | undefined;
      return (
        <div>
          <p className="font-medium">{c.name as string}</p>
          {positioning && <p className="text-gray-600 mt-1">{positioning}</p>}
          {price && <p className="text-gray-500 mt-1">Pricing: {price}</p>}
        </div>
      );
    }
    case 'trend-card':
      return <p>{c.trend as string} — {c.evidence as string}</p>;
    case 'insight-card': {
      const implication = c.implication as string | undefined;
      return (
        <div>
          <p>{c.insight as string}</p>
          {implication && <p className="text-gray-500 mt-1">{implication}</p>}
        </div>
      );
    }
    case 'strategy-card': {
      const angle = c.recommendedAngle as string | undefined;
      const lead = c.leadRecommendation as string | undefined;
      return (
        <div>
          {angle && <p>{angle}</p>}
          {lead && <p className="mt-1">{lead}</p>}
        </div>
      );
    }
    default: {
      // Fallback: render any string values
      const entries = Object.entries(c).filter(([, v]) => typeof v === 'string' && v.length > 0);
      if (entries.length === 0) return <p className="text-gray-400">No content</p>;
      return (
        <div className="space-y-1">
          {entries.map(([key, val]) => (
            <p key={key}><span className="text-gray-500">{key}:</span> {val as string}</p>
          ))}
        </div>
      );
    }
  }
}
