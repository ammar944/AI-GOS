'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Printer, Copy, Check, Share2, Loader2, Link2 } from 'lucide-react';
import Link from 'next/link';
import { SectionTabs } from '@/components/workspace/section-tabs';
import { SectionHeader } from '@/components/workspace/section-header';
import { CardRenderer } from '@/components/research/card-renderer';
import { parseResearchToCards } from '@/lib/workspace/card-taxonomy';
import { CardGrid } from '@/components/workspace/card-grid';
import { CompetitorTabs } from '@/components/workspace/competitor-tabs';
import type { CardState, SectionKey } from '@/lib/workspace/types';
import { SECTION_META } from '@/lib/journey/section-meta';
import { MediaPlanButton } from '@/components/research/media-plan-button';
import { ScriptsPhaseContent } from '@/components/workspace/scripts-phase';
import { useSessionShare } from '@/hooks/use-session-share';

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
  const [scriptsTabActive, setScriptsTabActive] = useState(false);
  const [mediaPlanGenerating, setMediaPlanGenerating] = useState(false);
  const [mediaPlanCards, setMediaPlanCards] = useState<CardState[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll for media plan results after dispatch
  useEffect(() => {
    if (!mediaPlanGenerating || !runId) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/journey/session?runId=${runId}`, { credentials: 'same-origin' });
        if (!res.ok) return;
        const json = await res.json();
        const mp = json?.researchResults?.mediaPlan as { status?: string; data?: Record<string, unknown> } | undefined;
        if (mp?.status === 'complete' && mp.data) {
          const cards = parseResearchToCards('mediaPlan', mp.data);
          setMediaPlanCards(cards);
          setMediaPlanGenerating(false);
        }
      } catch { /* retry next interval */ }
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [mediaPlanGenerating, runId]);

  // Merge dynamic media plan cards into cardsBySection
  const allCards = useMemo(() => {
    if (mediaPlanCards.length === 0) return cardsBySection;
    return { ...cardsBySection, mediaPlan: mediaPlanCards };
  }, [cardsBySection, mediaPlanCards]);

  // Add dynamic tabs to visible sections
  const visibleSections = useMemo(() => {
    const sections = [...availableSections];
    if ((mediaPlanGenerating || mediaPlanCards.length > 0) && !sections.includes('mediaPlan')) {
      sections.push('mediaPlan');
    }
    if (scriptsTabActive && !sections.includes('scripts')) {
      sections.push('scripts');
    }
    return sections;
  }, [availableSections, mediaPlanGenerating, mediaPlanCards, scriptsTabActive]);

  const sectionCards = useMemo(
    () => allCards[currentSection] ?? [],
    [allCards, currentSection],
  );

  const totalCards = useMemo(
    () => Object.values(allCards).reduce((sum, cards) => sum + cards.length, 0),
    [allCards],
  );

  const [copied, setCopied] = useState(false);
  const { isSharing, shareUrl, copied: shareCopied, error: shareError, handleShare, handleCopyLink } = useSessionShare();

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
        lines.push(...cardToMarkdown(card));
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
            sections={visibleSections}
            currentSection={currentSection}
            onNavigate={setCurrentSection}
            mode="document"
          />
        </div>
        <div className="flex items-center gap-1 px-3 shrink-0 border-l border-[var(--border-subtle)]">
          {runId && (
            shareUrl ? (
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                title="Copy share link"
              >
                {shareCopied ? <Check className="size-3.5" /> : <Link2 className="size-3.5" />}
                <span className="hidden sm:inline">{shareCopied ? 'Copied!' : 'Copy Link'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleShare(runId, title)}
                disabled={isSharing}
                title={shareError ?? 'Share research with a public link'}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/10 transition-colors disabled:opacity-50"
              >
                {isSharing ? <Loader2 className="size-3.5 animate-spin" /> : <Share2 className="size-3.5" />}
                <span className="hidden sm:inline">Share</span>
              </button>
            )
          )}
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
            {sessionId && (
              <div className="mt-4 flex items-center gap-3">
                <MediaPlanButton
                  sessionId={sessionId}
                  hasMediaPlan={hasMediaPlan ?? false}
                  onDispatched={() => {
                    setMediaPlanGenerating(true);
                    setCurrentSection('mediaPlan');
                  }}
                />
                {(hasMediaPlan || mediaPlanCards.length > 0) && runId && !scriptsTabActive && (
                  <button
                    type="button"
                    onClick={() => {
                      setScriptsTabActive(true);
                      setCurrentSection('scripts');
                    }}
                    className="cursor-pointer inline-flex items-center gap-2 rounded-full text-[13px] font-semibold px-5 h-9 transition-all bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple,#8b5cf6)] text-white hover:opacity-90"
                  >
                    Generate Scripts
                  </button>
                )}
              </div>
            )}
            <div className="h-px bg-gradient-to-r from-[var(--accent-blue)]/20 to-transparent mt-4" />
          </div>

          {/* Interactive section content (screen only) */}
          <div className="no-print">
            {currentSection === 'scripts' && runId ? (
              <ScriptsPhaseContent activeRunId={runId} autoGenerate />
            ) : currentSection === 'mediaPlan' && mediaPlanGenerating && sectionCards.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-[var(--accent-blue)]" />
                <p className="text-sm text-[var(--text-tertiary)] font-mono">
                  Generating media plan...
                </p>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentSection}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <SectionHeader section={currentSection} mode="document" />

                  {sectionCards.length > 0 && currentSection === 'competitors' ? (
                    <CompetitorTabs cards={sectionCards} />
                  ) : sectionCards.length > 0 ? (
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
            )}
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
 * Extracts card content as markdown lines for clipboard copy.
 * Handles all card types produced by card-taxonomy.ts.
 */
export function cardToMarkdown(card: CardState): string[] {
  const lines: string[] = [];
  const c = card.content;

  switch (card.cardType) {
    // -- Shared card types (used across multiple sections) --
    case 'stat-grid': {
      const stats = (c.stats ?? []) as { label: string; value: string }[];
      for (const s of stats) lines.push(`- ${s.label}: ${s.value}`);
      break;
    }
    case 'bullet-list':
    case 'check-list': {
      for (const item of (c.items ?? []) as string[]) lines.push(`- ${item}`);
      const groups = (c.groups ?? []) as Array<{ group?: string; items?: string[] }>;
      for (const g of groups) {
        if (g.group) lines.push(`**${g.group}**`);
        for (const item of g.items ?? []) lines.push(`- ${item}`);
      }
      break;
    }
    case 'prose-card': {
      if (typeof c.text === 'string') lines.push(c.text);
      break;
    }

    // -- Industry Market --
    case 'opportunity-card': {
      const opps = (c.opportunities ?? []) as Array<{ opportunity: string; size?: string; timing?: string; difficulty?: string; evidence?: string }>;
      for (const o of opps) {
        lines.push(`- **${o.opportunity}** (Size: ${o.size ?? 'N/A'}, Timing: ${o.timing ?? 'N/A'}, Difficulty: ${o.difficulty ?? 'N/A'})`);
        if (o.evidence) lines.push(`  ${o.evidence}`);
      }
      break;
    }
    case 'trend-card': {
      const trends = (c.trends ?? []) as Array<{ trend?: string; direction?: string; evidence?: string }>;
      for (const t of trends) {
        if (!t.trend) continue;
        lines.push(`- **${t.trend}**${t.direction ? ` (${t.direction})` : ''}`);
        if (t.evidence) lines.push(`  ${t.evidence}`);
      }
      break;
    }

    // -- Competitors --
    case 'competitor-card': {
      lines.push(`**${c.name as string}**`);
      if (c.positioning) lines.push(`Positioning: ${c.positioning as string}`);
      if (c.price) lines.push(`Pricing: ${c.price as string}`);
      if (Array.isArray(c.strengths) && c.strengths.length > 0) lines.push(`Strengths: ${(c.strengths as string[]).join(', ')}`);
      if (Array.isArray(c.weaknesses) && c.weaknesses.length > 0) lines.push(`Weaknesses: ${(c.weaknesses as string[]).join(', ')}`);
      if (Array.isArray(c.opportunities) && c.opportunities.length > 0) lines.push(`Opportunities: ${(c.opportunities as string[]).join(', ')}`);
      if (c.ourAdvantage) lines.push(`Our Advantage: ${c.ourAdvantage as string}`);
      if (c.counterPositioning) lines.push(`Counter-Positioning: ${c.counterPositioning as string}`);
      if (Array.isArray(c.topAdHooks) && c.topAdHooks.length > 0) lines.push(`Top Ad Hooks: ${(c.topAdHooks as string[]).join(', ')}`);
      const adActivity = c.adActivity as Record<string, unknown> | undefined;
      if (adActivity) {
        const parts: string[] = [];
        if (typeof adActivity.activeAdCount === 'number') parts.push(`${adActivity.activeAdCount} active ads`);
        if (Array.isArray(adActivity.platforms) && adActivity.platforms.length > 0) parts.push(`Platforms: ${(adActivity.platforms as string[]).join(', ')}`);
        if (Array.isArray(adActivity.themes) && adActivity.themes.length > 0) parts.push(`Themes: ${(adActivity.themes as string[]).join(', ')}`);
        if (typeof adActivity.evidence === 'string' && adActivity.evidence) parts.push(adActivity.evidence);
        if (parts.length > 0) lines.push(`Ad Activity: ${parts.join(' | ')}`);
      }
      const adCreatives = c.adCreatives as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(adCreatives) && adCreatives.length > 0) {
        lines.push(`Ad Creatives (${adCreatives.length}):`);
        for (const ad of adCreatives.slice(0, 10)) {
          const adParts: string[] = [];
          if (ad.platform) adParts.push(`[${ad.platform as string}]`);
          if (ad.headline) adParts.push(ad.headline as string);
          if (ad.body) adParts.push(ad.body as string);
          if (adParts.length > 0) lines.push(`  - ${adParts.join(' — ')}`);
        }
      }
      break;
    }
    case 'positioning-move-card': {
      const moves = (c.moves ?? []) as Array<{ move: string; targetCompetitor?: string; risk?: string; reward?: string; playbook?: string }>;
      for (const m of moves) {
        lines.push(`- **${m.move}** → ${m.targetCompetitor ?? 'N/A'} (Risk: ${m.risk ?? 'N/A'}, Reward: ${m.reward ?? 'N/A'})`);
        if (m.playbook) lines.push(`  Playbook: ${m.playbook}`);
      }
      break;
    }
    case 'review-card': {
      if (c.competitorName) lines.push(`**${c.competitorName as string}**`);
      const tp = c.trustpilot as Record<string, unknown> | null;
      if (tp) {
        const parts: string[] = ['Trustpilot'];
        if (tp.rating != null) parts.push(`${tp.rating}/5`);
        if (tp.reviewCount != null) parts.push(`${tp.reviewCount} reviews`);
        lines.push(`- ${parts.join(' — ')}`);
        if (Array.isArray(tp.themes) && tp.themes.length > 0) lines.push(`  Themes: ${(tp.themes as string[]).join(', ')}`);
      }
      const g2 = c.g2 as Record<string, unknown> | null;
      if (g2) {
        const parts: string[] = ['G2'];
        if (g2.rating != null) parts.push(`${g2.rating}/5`);
        if (g2.reviewCount != null) parts.push(`${g2.reviewCount} reviews`);
        lines.push(`- ${parts.join(' — ')}`);
        if (Array.isArray(g2.themes) && g2.themes.length > 0) lines.push(`  Categories: ${(g2.themes as string[]).join(', ')}`);
      }
      const cap = c.capterra as Record<string, unknown> | null;
      if (cap) {
        const parts: string[] = ['Capterra'];
        if (cap.rating != null) parts.push(`${cap.rating}/5`);
        if (cap.reviewCount != null) parts.push(`${cap.reviewCount} reviews`);
        lines.push(`- ${parts.join(' — ')}`);
        if (Array.isArray(cap.themes) && cap.themes.length > 0) lines.push(`  Categories: ${(cap.themes as string[]).join(', ')}`);
      }
      const negReviews = Array.isArray(c.negativeReviews) ? c.negativeReviews as Array<Record<string, unknown>> : [];
      if (negReviews.length > 0) {
        lines.push(`- Negative Reviews (${negReviews.length}):`);
        for (const nr of negReviews) {
          const stars = nr.rating != null ? `${'★'.repeat(nr.rating as number)}` : '';
          const src = nr.source ? ` [${(nr.source as string).toUpperCase()}]` : '';
          lines.push(`  ${stars}${src} "${nr.text as string}"`);
        }
      }
      const gapIntel = c.gapIntelligence as Record<string, unknown> | null;
      if (gapIntel) {
        const angles = Array.isArray(gapIntel.exploitAngles) ? gapIntel.exploitAngles as Array<Record<string, unknown>> : [];
        if (angles.length > 0) {
          lines.push(`- Exploit Angles:`);
          for (const angle of angles) {
            const conf = angle.confidence ? ` [${(angle.confidence as string).toUpperCase()}]` : '';
            lines.push(`  ${angle.gap as string}${conf}`);
            lines.push(`    Position: ${angle.positioningAngle as string}`);
            lines.push(`    Ad hook: "${angle.adHook as string}"`);
          }
        }
      }
      break;
    }
    case 'gap-card': {
      const gaps = (c.gaps ?? []) as Array<{ gap?: string; type?: string; evidence?: string; recommendedAction?: string; impact?: string; exploitability?: string }>;
      for (const g of gaps) {
        if (!g.gap) continue;
        lines.push(`- **${g.gap}**${g.type ? ` (${g.type})` : ''}`);
        if (g.evidence) lines.push(`  Evidence: ${g.evidence}`);
        if (g.recommendedAction) lines.push(`  Action: ${g.recommendedAction}`);
      }
      break;
    }
    case 'review-cross-analysis-card': {
      const weaknesses = (c.commonWeaknesses ?? []) as Array<{ theme?: string; affectedCompetitors?: string[]; frequency?: number; exampleQuote?: string; leverageAngle?: string }>;
      for (const w of weaknesses) {
        if (!w.theme) continue;
        const affected = (w.affectedCompetitors ?? []).join(', ');
        lines.push(`- **${w.theme}**${affected ? ` — affects ${affected}` : ''}${w.frequency ? ` (${w.frequency}× frequency)` : ''}`);
        if (w.exampleQuote) lines.push(`  "${w.exampleQuote}"`);
        if (w.leverageAngle) lines.push(`  Leverage: ${w.leverageAngle}`);
      }
      break;
    }

    // -- ICP Validation --
    case 'refinement-card': {
      const refs = (c.refinements ?? []) as Array<{ refinement: string; segment?: string; expectedLift?: string; testMethod?: string }>;
      for (const r of refs) {
        lines.push(`- **${r.refinement}** (Segment: ${r.segment ?? 'N/A'}, Expected Lift: ${r.expectedLift ?? 'N/A'})`);
        if (r.testMethod) lines.push(`  Test: ${r.testMethod}`);
      }
      break;
    }
    case 'verdict-card': {
      if (c.status) lines.push(`Status: ${c.status as string}`);
      if (c.reasoning) lines.push(c.reasoning as string);
      break;
    }

    // -- Offer Analysis --
    case 'pricing-card': {
      if (c.currentPricing) lines.push(`Current Pricing: ${c.currentPricing as string}`);
      if (c.marketBenchmark) lines.push(`Market Benchmark: ${c.marketBenchmark as string}`);
      if (c.pricingPosition) lines.push(`Position: ${c.pricingPosition as string}`);
      if (c.coldTrafficViability) lines.push(`Cold Traffic Viability: ${c.coldTrafficViability as string}`);
      break;
    }
    case 'flag-card': {
      const flags = (c.flags ?? []) as Array<{ issue?: string; severity?: string; priority?: number; evidence?: string; recommendedAction?: string }>;
      for (const f of flags) {
        if (!f.issue) continue;
        const suffix = [f.severity, typeof f.priority === 'number' ? `P${f.priority}` : null].filter(Boolean).join(', ');
        lines.push(`- **${f.issue}**${suffix ? ` (${suffix})` : ''}`);
        if (f.evidence) lines.push(`  Evidence: ${f.evidence}`);
        if (f.recommendedAction) lines.push(`  Action: ${f.recommendedAction}`);
      }
      break;
    }
    case 'offer-statement-list': {
      const statements = (c.statements ?? []) as Array<{ type?: string; statement?: string; rationale?: string; targetEmotion?: string }>;
      for (const s of statements) {
        if (s.statement) {
          lines.push(`- [${s.type ?? 'headline'}] ${s.statement}`);
          if (s.rationale) lines.push(`  Rationale: ${s.rationale}`);
          if (s.targetEmotion) lines.push(`  Target Emotion: ${s.targetEmotion}`);
        }
      }
      break;
    }
    case 'ice-table': {
      const fixes = (c.fixes ?? []) as Array<{ issue?: string; fix?: string; iceScore?: number }>;
      for (const f of fixes) {
        const score = f.iceScore != null ? ` (ICE: ${f.iceScore})` : '';
        lines.push(`- ${f.issue ?? 'Issue'}${score}`);
        if (f.fix) lines.push(`  Fix: ${f.fix}`);
      }
      break;
    }

    // -- Keyword Intel --
    case 'keyword-gap-card': {
      const gaps = (c.gaps ?? []) as Array<{ gapCluster: string; estimatedVolume?: number; competition?: string; suggestedKeywords?: string[]; priority?: string }>;
      for (const g of gaps) {
        lines.push(`- **${g.gapCluster}** (Volume: ${g.estimatedVolume ?? 'N/A'}, Competition: ${g.competition ?? 'N/A'}, Priority: ${g.priority ?? 'N/A'})`);
        if (Array.isArray(g.suggestedKeywords) && g.suggestedKeywords.length > 0) {
          lines.push(`  Keywords: ${g.suggestedKeywords.join(', ')}`);
        }
      }
      break;
    }
    case 'keyword-grid': {
      const raw = c.rawData as Record<string, unknown> | undefined;
      if (raw) {
        const topOpps = raw.topOpportunities as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(topOpps) && topOpps.length > 0) {
          lines.push('Top Opportunities:');
          for (const k of topOpps.slice(0, 15)) {
            const parts: string[] = [k.keyword as string ?? ''];
            if (typeof k.searchVolume === 'number') parts.push(`Vol: ${k.searchVolume}`);
            if (k.difficulty) parts.push(`Difficulty: ${k.difficulty as string}`);
            if (k.intent) parts.push(`Intent: ${k.intent as string}`);
            lines.push(`- ${parts.join(' | ')}`);
          }
        }
        const compGaps = raw.competitorGaps as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(compGaps) && compGaps.length > 0) {
          lines.push('Competitor Gaps:');
          for (const g of compGaps.slice(0, 10)) {
            const parts: string[] = [g.keyword as string ?? ''];
            if (g.competitorName) parts.push(`Competitor: ${g.competitorName as string}`);
            if (typeof g.searchVolume === 'number') parts.push(`Vol: ${g.searchVolume}`);
            lines.push(`- ${parts.join(' | ')}`);
          }
        }
        const longTail = raw.longTailKeywords as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(longTail) && longTail.length > 0) {
          lines.push('Long-Tail Keywords:');
          for (const k of longTail.slice(0, 10)) {
            const parts: string[] = [k.keyword as string ?? ''];
            if (typeof k.searchVolume === 'number') parts.push(`Vol: ${k.searchVolume}`);
            lines.push(`- ${parts.join(' | ')}`);
          }
        }
        const strategy = raw.keywordStrategy as Record<string, unknown> | undefined;
        if (strategy) {
          if (typeof strategy.summary === 'string') lines.push(`Strategy: ${strategy.summary}`);
          if (Array.isArray(strategy.focusAreas) && strategy.focusAreas.length > 0) {
            lines.push(`Focus Areas: ${(strategy.focusAreas as string[]).join(', ')}`);
          }
        }
        break;
      }
      const keywords = c.keywords as
        | Array<{ keyword: string; volume: number; difficulty: string; priority: number }>
        | undefined;
      if (keywords && keywords.length > 0) {
        lines.push('Top Keywords by Priority:');
        for (const kw of keywords) {
          lines.push(
            `  ${kw.keyword} — Vol: ${kw.volume?.toLocaleString() ?? '?'}, Difficulty: ${kw.difficulty ?? '?'}, Priority: ${kw.priority ?? '?'}`
          );
        }
      }
      break;
    }

    // -- Cross Analysis --
    case 'readiness-scorecard': {
      if (c.overallScore != null) lines.push(`Overall Score: ${c.overallScore}/10`);
      if (c.verdictLabel) lines.push(`Verdict: ${c.verdictLabel as string}`);
      const dims = (c.dimensions ?? []) as Array<{ name: string; score: number; summary: string }>;
      for (const d of dims) {
        lines.push(`- ${d.name}: ${d.score}/10 — ${d.summary}`);
      }
      break;
    }
    case 'priority-actions': {
      const actions = (c.actions ?? []) as Array<{ action: string; source?: string; priority?: string }>;
      for (const a of actions) {
        lines.push(`- [${a.priority ?? 'medium'}] ${a.action} (Source: ${a.source ?? 'N/A'})`);
      }
      break;
    }
    case 'strategy-card': {
      if (c.recommendedAngle) lines.push(c.recommendedAngle as string);
      if (c.leadRecommendation) lines.push(c.leadRecommendation as string);
      if (c.keyDifferentiator) lines.push(`Differentiator: ${c.keyDifferentiator as string}`);
      break;
    }
    case 'insight-card': {
      const insights = (c.insights ?? []) as Array<{ insight?: string; source?: string; implication?: string }>;
      for (const ins of insights) {
        if (!ins.insight) continue;
        lines.push(`- ${ins.insight}${ins.source ? ` *(${ins.source})*` : ''}`);
        if (ins.implication) lines.push(`  Implication: ${ins.implication}`);
      }
      break;
    }
    case 'chart-card': {
      if (c.title) lines.push(c.title as string);
      if (c.description) lines.push(c.description as string);
      break;
    }
    case 'angle-card': {
      const angles = (c.angles ?? []) as Array<{ angle?: string; exampleHook?: string; evidence?: string }>;
      for (const a of angles) {
        if (!a.angle) continue;
        lines.push(`- **${a.angle}**`);
        if (a.exampleHook) lines.push(`  Hook: ${a.exampleHook}`);
        if (a.evidence) lines.push(`  Evidence: ${a.evidence}`);
      }
      break;
    }

    // -- Media Plan --
    case 'strategy-snapshot': {
      if (c.headline) lines.push(`**${c.headline as string}**`);
      const priorities = (c.topPriorities ?? []) as Array<Record<string, unknown>>;
      if (priorities.length > 0) {
        lines.push('Top Priorities:');
        for (const p of priorities) {
          const label = (p.label ?? p.priority ?? '') as string;
          if (label) lines.push(`- ${label}`);
        }
      }
      const budget = c.budgetOverview as Record<string, unknown> | undefined;
      if (budget) {
        const parts: string[] = [];
        if (budget.total != null) parts.push(`Total: $${budget.total}`);
        if (budget.topPlatform) parts.push(`Top Platform: ${budget.topPlatform as string}`);
        if (budget.timeToFirstResults) parts.push(`Time to Results: ${budget.timeToFirstResults as string}`);
        if (parts.length > 0) lines.push(`Budget: ${parts.join(' | ')}`);
      }
      const outcomes = c.expectedOutcomes as Record<string, unknown> | undefined;
      if (outcomes) {
        const parts: string[] = [];
        if (outcomes.leadsPerMonth != null) parts.push(`Leads/mo: ${outcomes.leadsPerMonth}`);
        if (outcomes.estimatedCAC != null) parts.push(`CAC: $${outcomes.estimatedCAC}`);
        if (outcomes.expectedROAS != null) parts.push(`ROAS: ${outcomes.expectedROAS}x`);
        if (parts.length > 0) lines.push(`Expected Outcomes: ${parts.join(' | ')}`);
      }
      break;
    }
    case 'platform-card': {
      const name = (c.name ?? c.platform) as string;
      if (name) lines.push(`**${name}**`);
      if (c.role) lines.push(`Role: ${c.role as string}`);
      if (typeof c.monthlySpend === 'number') lines.push(`Monthly Spend: $${c.monthlySpend}`);
      if (typeof c.percentage === 'number') lines.push(`Budget Share: ${c.percentage}%`);
      const cpl = c.expectedCPL as Record<string, unknown> | undefined;
      if (cpl && cpl.low != null && cpl.high != null) lines.push(`Expected CPL: $${cpl.low}–$${cpl.high}`);
      if (typeof c.budgetAllocation === 'string') lines.push(`Budget Allocation: ${c.budgetAllocation}`);
      if (c.rationale) lines.push(`Rationale: ${c.rationale as string}`);
      break;
    }
    case 'budget-summary': {
      if (typeof c.totalMonthly === 'number') lines.push(`Total Monthly: $${c.totalMonthly}`);
      const funnel = c.funnelSplit as Record<string, unknown> | undefined;
      if (funnel) {
        lines.push(`Funnel Split: Awareness ${funnel.awareness}% | Consideration ${funnel.consideration}% | Conversion ${funnel.conversion}%`);
      }
      if (typeof c.rampUpWeeks === 'number') lines.push(`Ramp-Up: ${c.rampUpWeeks} weeks`);
      break;
    }
    case 'segment-card': {
      if (c.name) lines.push(`**${c.name as string}**`);
      if (c.description) lines.push(c.description as string);
      if (c.estimatedReach) lines.push(`Reach: ${c.estimatedReach as string}`);
      if (c.funnelPosition) lines.push(`Funnel: ${c.funnelPosition as string}`);
      if (typeof c.priority === 'number') lines.push(`Priority: ${c.priority}`);
      break;
    }
    case 'campaign-card': {
      if (c.name) lines.push(`**${c.name as string}**`);
      if (c.platform) lines.push(`Platform: ${c.platform as string}`);
      if (c.objective) lines.push(`Objective: ${c.objective as string}`);
      if (c.namingConvention) lines.push(`Naming: ${c.namingConvention as string}`);
      const adSets = (c.adSets ?? []) as Array<Record<string, unknown>>;
      if (adSets.length > 0) {
        lines.push('Ad Sets:');
        for (const set of adSets) {
          const setName = (set.name as string) ?? 'Ad Set';
          lines.push(`  - ${setName}`);
          if (set.targeting) lines.push(`    Targeting: ${set.targeting as string}`);
          if (typeof set.budget === 'number') lines.push(`    Budget: $${set.budget}`);
        }
      }
      break;
    }
    case 'creative-angle': {
      if (c.theme) lines.push(`**${c.theme as string}**`);
      if (c.hook) lines.push(`Hook: ${c.hook as string}`);
      if (c.messagingApproach) lines.push(`Approach: ${c.messagingApproach as string}`);
      if (c.targetSegment) lines.push(`Target: ${c.targetSegment as string}`);
      break;
    }
    case 'format-spec': {
      const specs = (c.specs ?? []) as Array<Record<string, unknown>>;
      for (const spec of specs) {
        const format = (spec.format ?? spec.name ?? 'Format') as string;
        lines.push(`- ${format}`);
        for (const [key, val] of Object.entries(spec)) {
          if (key !== 'format' && key !== 'name' && val != null) {
            lines.push(`  ${key}: ${val}`);
          }
        }
      }
      break;
    }
    case 'testing-plan': {
      if (c.methodology) lines.push(`Methodology: ${c.methodology as string}`);
      if (typeof c.minBudgetPerTest === 'number') lines.push(`Min Budget/Test: $${c.minBudgetPerTest}`);
      const firstTests = (c.firstTests ?? []) as string[];
      if (firstTests.length > 0) {
        lines.push('First Tests:');
        for (const t of firstTests) lines.push(`- ${t}`);
      }
      break;
    }
    case 'kpi-grid': {
      const kpis = (c.kpis ?? []) as Array<Record<string, unknown>>;
      for (const k of kpis) {
        const parts: string[] = [(k.metric as string) ?? ''];
        if (k.target != null) parts.push(`Target: ${k.target}`);
        if (k.industryBenchmark != null) parts.push(`Benchmark: ${k.industryBenchmark}`);
        lines.push(`- ${parts.join(' | ')}`);
      }
      break;
    }
    case 'cac-model': {
      // Wave 6: ltvCacRatio is a pre-formatted string from the worker
      // (e.g. "5.2:1 — Healthy"), not a number — render it verbatim
      // and skip the unit suffix.
      const fields: [string, string, string][] = [
        ['targetCAC', 'Target CAC', '$'],
        ['expectedCPL', 'Expected CPL', '$'],
        ['leadToSqlRate', 'Lead→SQL Rate', '%'],
        ['sqlToCustomerRate', 'SQL→Customer Rate', '%'],
        ['expectedLeadsPerMonth', 'Leads/Month', ''],
        ['expectedSQLsPerMonth', 'SQLs/Month', ''],
        ['expectedCustomersPerMonth', 'Customers/Month', ''],
        ['ltv', 'LTV', '$'],
        ['ltvCacRatio', 'LTV:CAC Ratio', ''],
      ];
      for (const [key, label, unit] of fields) {
        if (c[key] != null && c[key] !== '') {
          const val = c[key] as number | string;
          const formatted = unit === '$' ? `$${val}` : unit ? `${val}${unit}` : `${val}`;
          lines.push(`- ${label}: ${formatted}`);
        }
      }
      break;
    }
    case 'risk-card': {
      if (c.risk) lines.push(c.risk as string);
      if (c.category) lines.push(`Category: ${c.category as string}`);
      if (c.severity) lines.push(`Severity: ${c.severity as string}`);
      if (c.likelihood) lines.push(`Likelihood: ${c.likelihood as string}`);
      if (c.mitigation) lines.push(`Mitigation: ${c.mitigation as string}`);
      if (c.earlyWarning) lines.push(`Early Warning: ${c.earlyWarning as string}`);
      break;
    }
    case 'phase-card': {
      if (c.name) lines.push(`**${c.name as string}**`);
      if (c.duration) lines.push(`Duration: ${c.duration as string}`);
      if (typeof c.budgetAllocation === 'number') lines.push(`Budget: $${c.budgetAllocation}`);
      if (c.goNoGo) lines.push(`Go/No-Go: ${c.goNoGo as string}`);
      const objectives = (c.objectives ?? []) as string[];
      if (objectives.length > 0) for (const o of objectives) lines.push(`- Objective: ${o}`);
      const activities = (c.activities ?? []) as string[];
      if (activities.length > 0) for (const a of activities) lines.push(`- Activity: ${a}`);
      const criteria = (c.successCriteria ?? []) as string[];
      if (criteria.length > 0) for (const s of criteria) lines.push(`- Success: ${s}`);
      break;
    }

    // Chart cards — data is duplicated from structural cards above, skip for copy
    case 'pie-chart':
    case 'funnel-split-chart':
    case 'cac-funnel-chart':
    case 'kpi-benchmark-chart':
    case 'phase-budget-chart':
      break;

    // Fallback: capture strings, numbers, and string arrays
    default: {
      for (const [key, val] of Object.entries(c)) {
        if (typeof val === 'string' && val.trim()) {
          lines.push(`${key}: ${val}`);
        } else if (typeof val === 'number') {
          lines.push(`${key}: ${val}`);
        } else if (Array.isArray(val)) {
          const strs = val.filter((v): v is string => typeof v === 'string');
          if (strs.length > 0) lines.push(`${key}: ${strs.join(', ')}`);
        }
      }
    }
  }

  return lines;
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
