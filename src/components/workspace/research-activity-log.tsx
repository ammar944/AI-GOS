'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { ResearchJobActivity, ResearchUpdateMeta } from '@/lib/journey/research-job-activity';
import { collapseResearchJobUpdates } from '@/lib/journey/research-job-activity';

// Fallback simulated messages (shown when worker hasn't reported yet)
const SECTION_ACTIVITIES: Record<string, string[]> = {
  industryMarket: [
    'Searching market intelligence databases',
    'Analyzing industry vertical and addressable market',
    'Extracting market growth indicators and trends',
    'Mapping market dynamics and buying behaviours',
    'Compiling market overview',
  ],
  icpValidation: [
    'Loading market research results',
    'Analyzing target audience demographics',
    'Validating ICP against market data',
    'Mapping buyer journey and trigger events',
    'Scoring ICP targeting confidence',
  ],
  offerAnalysis: [
    'Loading ICP and market context',
    'Evaluating value proposition strength',
    'Scraping competitor pricing pages via Firecrawl',
    'Scoring offer across 6 dimensions',
    'Generating improvement recommendations',
  ],
  competitors: [
    'Loading ICP, offer, and market context',
    'Identifying competitor domains via web search',
    'Scraping competitor sites via Firecrawl',
    'Querying SpyFu for keyword spend data',
    'Pulling ad creatives from ad libraries',
    'Building competitive intelligence matrix',
  ],
  keywordIntel: [
    'Loading full research context',
    'Querying SpyFu keyword databases',
    'Analyzing search volume and competition',
    'Identifying competitor keyword gaps',
    'Mapping quick-win opportunities',
    'Building keyword strategy',
  ],
  crossAnalysis: [
    'Loading all research sections',
    'Cross-referencing market, ICP, offer, and competitor data',
    'Identifying strategic patterns and gaps',
    'Scoring section confidence levels',
    'Compiling strategic recommendations',
  ],
  mediaPlan: [
    'Loading approved research and synthesis',
    'Building channel mix and budget allocation',
    'Designing audience and campaign structure',
    'Setting measurement KPIs and guardrails',
    'Planning phased rollout roadmap',
    'Generating strategy snapshot',
  ],
};

const DEFAULT_ACTIVITIES = [
  'Initializing research pipeline',
  'Gathering intelligence',
  'Processing data sources',
  'Analyzing patterns',
  'Compiling results',
];

// Phase icon mapping for visual distinction
const PHASE_COLORS: Record<string, string> = {
  runner: 'var(--accent-blue)',
  tool: 'rgb(168, 85, 247)', // purple
  analysis: 'rgb(234, 179, 8)', // amber
  output: 'rgb(52, 211, 153)', // emerald
  error: 'rgb(239, 68, 68)', // red
};

interface ResearchActivityLogProps {
  section: string;
  sectionLabel: string;
  phase: 'researching' | 'streaming';
  activity?: ResearchJobActivity;
}

interface ActivityEntry {
  id: string;
  message: string;
  phase: string;
  isLive: boolean;
  meta?: ResearchUpdateMeta;
}

// ---------------------------------------------------------------------------
// AgentBrowser — simulated browser chrome with screenshot crossfade
// ---------------------------------------------------------------------------

interface ExtractedFact {
  label: string;
  value: string;
}

interface AgentBrowserProps {
  currentUrl: string | null;
  currentScreenshot: string | null;
  currentFavicon: string | null;
  currentPageTitle: string | null;
  pagesVisited: number;
  dataPointCount: number;
  extractedFacts: ExtractedFact[];
  recentSources: string[];
}

function AgentBrowser({
  currentUrl,
  currentScreenshot,
  currentFavicon,
  currentPageTitle,
  pagesVisited,
  dataPointCount,
  extractedFacts,
  recentSources,
}: AgentBrowserProps) {
  const displayHost = currentUrl
    ? (() => { try { return new URL(currentUrl).hostname.replace(/^www\./, ''); } catch { return currentUrl; } })()
    : null;

  return (
    <div className="flex flex-col h-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden">
      {/* Browser chrome — tab bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-glass)] bg-[var(--bg-glass-panel)]">
        {/* Window dots */}
        <div className="flex gap-1.5 mr-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/40" />
        </div>
        {/* Tab */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-[var(--bg-surface)] max-w-[200px]">
          {currentFavicon ? (
            <img
              src={currentFavicon}
              alt=""
              className="w-3.5 h-3.5 rounded-sm"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="w-3.5 h-3.5 rounded-sm bg-[var(--bg-hover)]" />
          )}
          <span className="text-[11px] text-[var(--text-tertiary)] truncate font-mono">
            {currentPageTitle ?? displayHost ?? 'New Tab'}
          </span>
        </div>
      </div>

      {/* URL bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--border-glass)]">
        <div className="flex gap-1 opacity-30">
          <svg className="w-3.5 h-3.5 text-[var(--text-quaternary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          <svg className="w-3.5 h-3.5 text-[var(--text-quaternary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        </div>
        <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--bg-glass-panel)] border border-[var(--border-glass)]">
          <svg className="w-3 h-3 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          <AnimatePresence mode="wait">
            <motion.span
              key={currentUrl ?? 'empty'}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.25 }}
              className="text-[11px] font-mono text-[var(--text-tertiary)] truncate"
            >
              {currentUrl ?? 'about:blank'}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>

      {/* Viewport — screenshot or simulated page preview */}
      <div className="flex-1 relative min-h-[200px] bg-[var(--bg-glass-panel)] overflow-hidden">
        <AnimatePresence mode="wait">
          {currentScreenshot ? (
            <motion.img
              key={currentScreenshot}
              src={currentScreenshot}
              alt={`Screenshot of ${displayHost ?? 'page'}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 w-full h-full object-cover object-top"
            />
          ) : currentUrl ? (
            <motion.div
              key={currentUrl}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 p-4 overflow-hidden"
            >
              {/* Simulated page — looks like a real webpage being parsed */}
              {/* Site header */}
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--border-glass)]">
                {currentFavicon ? (
                  <img
                    src={currentFavicon}
                    alt=""
                    className="w-5 h-5 rounded"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-5 h-5 rounded bg-[var(--accent-blue)]/20 flex items-center justify-center">
                    <span className="text-[9px] font-bold text-[var(--accent-blue)]">
                      {(displayHost ?? '?')[0].toUpperCase()}
                    </span>
                  </div>
                )}
                <span className="text-[11px] font-mono font-medium text-[var(--text-secondary)]">
                  {displayHost}
                </span>
                <div className="ml-auto flex gap-1 opacity-20">
                  <div className="w-6 h-1.5 rounded bg-[var(--text-quaternary)]" />
                  <div className="w-6 h-1.5 rounded bg-[var(--text-quaternary)]" />
                  <div className="w-6 h-1.5 rounded bg-[var(--text-quaternary)]" />
                </div>
              </div>

              {/* Page title */}
              <div className="mb-3">
                <div className="text-[14px] font-semibold text-[var(--text-primary)] leading-tight mb-1">
                  {currentPageTitle ?? displayHost}
                </div>
                <div className="text-[10px] font-mono text-[var(--text-quaternary)]">
                  {currentUrl}
                </div>
              </div>

              {/* Live extracted data + sources */}
              <div className="space-y-3 overflow-y-auto max-h-[calc(100%-80px)] custom-scrollbar">
                {/* Extracted facts — real data from analysis phase */}
                {extractedFacts.length > 0 && (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5">
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span className="text-[9px] font-mono uppercase tracking-wider text-emerald-400">
                        Extracted
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {extractedFacts.map((fact, i) => (
                        <motion.div
                          key={`${fact.label}-${i}`}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.25, delay: i * 0.05 }}
                          className="flex items-baseline gap-2"
                        >
                          <span className="text-[10px] font-mono text-emerald-400/70 shrink-0">
                            {fact.label}:
                          </span>
                          <span className="text-[10px] font-mono text-[var(--text-secondary)] truncate">
                            {fact.value}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sources found */}
                {recentSources.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1 h-1 rounded-full bg-purple-400" />
                      <span className="text-[9px] font-mono uppercase tracking-wider text-purple-400/70">
                        Sources
                      </span>
                    </div>
                    {recentSources.map((source, i) => (
                      <motion.div
                        key={`src-${i}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2, delay: i * 0.05 }}
                        className="text-[10px] font-mono text-[var(--text-quaternary)] truncate pl-2.5"
                      >
                        {source}
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Skeleton placeholder when no data yet */}
                {extractedFacts.length === 0 && recentSources.length === 0 && (
                  <div className="space-y-2 pt-1">
                    {[85, 70, 55, 90, 40].map((w, i) => (
                      <motion.div
                        key={i}
                        className="h-2 rounded bg-[var(--text-quaternary)]"
                        style={{ width: `${w}%` }}
                        animate={{ opacity: [0.05, 0.1, 0.05] }}
                        transition={{ duration: 2, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            /* Initial state — no URL yet */
            <motion.div
              key="connecting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-3"
            >
              <motion.div
                className="flex gap-1.5"
                animate={{ opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-[var(--accent-blue)]"
                    animate={{ scale: [0.8, 1.2, 0.8] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </motion.div>
              <span className="text-[11px] font-mono text-[var(--text-quaternary)]">
                Connecting to sources
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scanning line overlay */}
        {currentUrl && (
          <motion.div
            className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-[var(--accent-blue)]/30 to-transparent pointer-events-none z-10"
            animate={{ top: ['0%', '100%'] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          />
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-[var(--border-glass)] bg-[var(--bg-glass-panel)]">
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-mono text-[var(--text-quaternary)]">
            Sources: <span className="text-[var(--text-secondary)]">{pagesVisited}</span>
          </span>
          <span className="text-[10px] font-mono text-[var(--text-quaternary)]">
            Data points: <span className="text-[var(--text-secondary)]">{dataPointCount}</span>
          </span>
        </div>
        <motion.div
          className="w-1.5 h-1.5 rounded-full bg-emerald-400"
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActivityEntryCard — renders each activity entry with visual treatment
// based on content type (search, source, tool call, extraction, etc.)
// ---------------------------------------------------------------------------

const TOOL_ICONS: Record<string, string> = {
  web_search: '🔍',
  firecrawl: '🕷️',
  firecrawlExtract: '📊',
  firecrawl_scrape: '🕷️',
  spyfu: '🔑',
  spyfu_keyword_intel: '🔑',
  ad_library_search: '📢',
  search_ads: '📢',
  pagespeed_audit: '⚡',
  page_speed: '⚡',
  google_ads: '📈',
  meta_ads: '📱',
  ga4: '📉',
  chart: '📊',
};

function classifyEntry(entry: ActivityEntry): 'search' | 'results' | 'source' | 'tool' | 'extraction' | 'synthesis' | 'status' {
  const msg = entry.message;
  if (msg.startsWith('searching:') || msg.startsWith('reading:')) return 'search';
  if (msg.startsWith('web search returned')) return 'results';
  if (msg.startsWith('source:')) return 'source';
  if (msg.startsWith('screenshot captured:')) return 'tool';
  if (msg.startsWith('draft ') && entry.phase === 'analysis') return 'extraction';
  if (msg.toLowerCase().includes('synthesiz')) return 'synthesis';
  if (entry.meta?.toolName && entry.phase === 'tool') return 'tool';
  return 'status';
}

function ActivityEntryCard({ entry }: { entry: ActivityEntry }) {
  const type = classifyEntry(entry);

  // ── Search query — typewriter feel with scanning glow ──
  if (type === 'search') {
    const query = entry.message.replace(/^(searching|reading):\s*"?/, '').replace(/"$/, '');
    return (
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className="relative rounded-md border border-purple-500/20 bg-purple-500/5 px-2.5 py-1.5 overflow-hidden"
      >
        {/* Shimmer sweep */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-400/[0.07] to-transparent"
          initial={{ x: '-100%' }}
          animate={{ x: '200%' }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
        />
        <div className="relative flex items-center gap-1.5 mb-1">
          <motion.span
            className="text-[9px]"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.6, times: [0, 0.3, 1] }}
          >
            🔍
          </motion.span>
          <span className="text-[9px] font-mono uppercase tracking-wider text-purple-400/70">
            Search
          </span>
          <motion.div
            className="ml-auto h-px flex-1 max-w-[40px] bg-gradient-to-r from-purple-400/40 to-transparent"
            initial={{ scaleX: 0, originX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          />
        </div>
        <motion.p
          className="relative text-[10px] font-mono text-purple-300/90 leading-relaxed"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          {query}
        </motion.p>
      </motion.div>
    );
  }

  // ── Search results — burst in with count ──
  if (type === 'results') {
    const countMatch = entry.message.match(/(\d+)\s*result/);
    const count = countMatch ? countMatch[1] : '?';
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 20 }}
        className="flex items-center gap-2 px-2 py-1"
      >
        <motion.div
          className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5"
          animate={{ borderColor: ['rgba(16,185,129,0.2)', 'rgba(16,185,129,0.5)', 'rgba(16,185,129,0.2)'] }}
          transition={{ duration: 1.5, delay: 0.3 }}
        >
          <motion.span
            className="text-[9px] text-emerald-400"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 600, damping: 15, delay: 0.1 }}
          >
            ✓
          </motion.span>
          <span className="text-[9px] font-mono text-emerald-400 font-medium">
            {count} results found
          </span>
        </motion.div>
      </motion.div>
    );
  }

  // ── Source found — slide in with favicon glow ──
  if (type === 'source') {
    const sourceText = entry.message.slice(8);
    const domainMatch = sourceText.match(/\(([^)]+)\)$/);
    const domain = domainMatch ? domainMatch[1] : null;
    const title = domain ? sourceText.slice(0, sourceText.lastIndexOf('(')).trim() : sourceText;
    return (
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        className="relative flex items-start gap-2 rounded-md bg-[var(--bg-surface)]/60 border border-[var(--border-glass)] px-2.5 py-1.5 overflow-hidden"
      >
        {/* Left accent bar */}
        <motion.div
          className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-emerald-400/60 to-emerald-400/0"
          initial={{ scaleY: 0, originY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        />
        {domain && entry.meta?.favicon ? (
          <motion.img
            src={entry.meta.favicon}
            alt=""
            className="w-3.5 h-3.5 rounded-sm mt-0.5 shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.05 }}
          />
        ) : (
          <motion.span
            className="text-[9px] mt-0.5 shrink-0"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 15 }}
          >
            📄
          </motion.span>
        )}
        <div className="min-w-0">
          <p className="text-[10px] font-mono text-[var(--text-tertiary)] truncate leading-tight">
            {title}
          </p>
          {domain && (
            <p className="text-[8px] font-mono text-[var(--text-quaternary)] truncate">
              {domain}
            </p>
          )}
        </div>
      </motion.div>
    );
  }

  // ── Tool invocation — processing card with animated border ──
  if (type === 'tool') {
    const toolName = entry.meta?.toolName ?? 'tool';
    const icon = TOOL_ICONS[toolName] ?? '⚙️';
    const displayName = toolName
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/^./, (s) => s.toUpperCase());
    return (
      <motion.div
        initial={{ opacity: 0, y: 6, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 22 }}
        className="relative rounded-md border border-[var(--accent-blue)]/20 bg-[var(--accent-blue)]/5 px-2.5 py-1.5 overflow-hidden"
      >
        {/* Shimmer sweep */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-[var(--accent-blue)]/[0.06] to-transparent"
          initial={{ x: '-100%' }}
          animate={{ x: '200%' }}
          transition={{ duration: 1.5, ease: 'easeInOut' }}
        />
        <div className="relative flex items-center gap-1.5">
          <motion.span
            className="text-[9px]"
            initial={{ rotate: -180, scale: 0 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 12 }}
          >
            {icon}
          </motion.span>
          <span className="text-[9px] font-mono font-medium text-[var(--accent-blue)] uppercase tracking-wider">
            {displayName}
          </span>
          {entry.isLive && (
            <div className="ml-auto flex gap-0.5">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-0.5 rounded-full bg-[var(--accent-blue)]"
                  animate={{ height: ['3px', '8px', '3px'] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </div>
          )}
        </div>
        {entry.meta?.url && (
          <motion.p
            className="relative text-[9px] font-mono text-[var(--text-quaternary)] truncate mt-0.5"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
          >
            {entry.meta.url}
          </motion.p>
        )}
      </motion.div>
    );
  }

  // ── Data extraction — slide in with highlight flash ──
  if (type === 'extraction') {
    const colonIdx = entry.message.indexOf(': ', 6);
    const label = colonIdx > -1 ? entry.message.slice(6, colonIdx) : 'data';
    const value = colonIdx > -1 ? entry.message.slice(colonIdx + 2) : entry.message.slice(6);
    return (
      <motion.div
        initial={{ opacity: 0, x: 8, scale: 0.97 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 350, damping: 22 }}
        className="relative flex items-center gap-2 rounded-md bg-amber-500/5 border border-amber-500/15 px-2.5 py-1.5 overflow-hidden"
      >
        {/* Flash highlight on entry */}
        <motion.div
          className="absolute inset-0 bg-amber-400/10"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
        />
        <motion.span
          className="relative text-[9px]"
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.4, 1] }}
          transition={{ duration: 0.4, times: [0, 0.6, 1] }}
        >
          💡
        </motion.span>
        <div className="relative min-w-0 flex-1">
          <span className="text-[9px] font-mono text-amber-400/70 uppercase tracking-wide">{label}</span>
          <motion.p
            className="text-[10px] font-mono text-amber-200/90 truncate"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.15 }}
          >
            {value}
          </motion.p>
        </div>
      </motion.div>
    );
  }

  // ── Synthesis — pulsing with animated bars ──
  if (type === 'synthesis') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="relative rounded-md border border-amber-500/20 bg-amber-500/5 px-2.5 py-2 overflow-hidden"
      >
        {/* Continuous shimmer */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-400/[0.06] to-transparent"
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="relative flex items-center gap-2">
          <div className="flex gap-0.5">
            {[0, 1, 2, 3].map((i) => (
              <motion.div
                key={i}
                className="w-1 rounded-full bg-amber-400"
                animate={{
                  height: ['3px', '10px', '5px', '8px', '3px'],
                  opacity: [0.4, 1, 0.6, 0.9, 0.4],
                }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.12 }}
              />
            ))}
          </div>
          <span className="text-[9px] font-mono text-amber-400 uppercase tracking-wider">
            {entry.message}
          </span>
        </div>
      </motion.div>
    );
  }

  // ── Default status — subtle slide in ──
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className="flex items-start gap-2 px-1 py-0.5"
    >
      <div className="mt-1.5 shrink-0">
        {entry.isLive ? (
          <motion.div
            className="w-1 h-1 rounded-full"
            style={{ backgroundColor: PHASE_COLORS[entry.phase] ?? 'var(--accent-blue)' }}
            animate={{ opacity: [1, 0.3, 1], scale: [1, 1.5, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        ) : (
          <div className="w-1 h-1 rounded-full bg-emerald-400 opacity-60" />
        )}
      </div>
      <span className={cn(
        'text-[10px] font-mono leading-relaxed',
        entry.isLive ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-quaternary)]',
      )}>
        {entry.message}
      </span>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// LiveDataAssembly — right panel showing progressive data card building
// ---------------------------------------------------------------------------

interface DataCard {
  id: string;
  domain: string;
  favicon: string | null;
  dataPoints: Array<{ label: string; value: string }>;
  isActive: boolean;
}

interface LiveDataAssemblyProps {
  cards: DataCard[];
  latestMessage: string | null;
  entries?: ActivityEntry[];
}

function LiveDataAssembly({ cards, latestMessage, entries }: LiveDataAssemblyProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll activity feed
  useEffect(() => {
    if (scrollRef.current && cards.length === 0) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [entries?.length, cards.length]);

  // Always show the rich activity feed (whether or not data cards exist)
  if (entries && entries.length > 0) {
    return (
      <div
        ref={scrollRef}
        className="flex flex-col h-full gap-1.5 overflow-y-auto custom-scrollbar pr-1 p-1"
      >
        {entries.map((entry) => (
          <ActivityEntryCard key={entry.id} entry={entry} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-2 overflow-y-auto custom-scrollbar pr-1">
      <AnimatePresence mode="popLayout">
        {cards.map((card, i) => (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.3, delay: i * 0.05, ease: [0.21, 0.45, 0.27, 0.9] }}
            className={cn(
              'rounded-lg border p-3 transition-colors',
              card.isActive
                ? 'border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/5'
                : 'border-[var(--border-glass)] bg-[var(--bg-glass-panel)]',
            )}
          >
            {/* Card header */}
            <div className="flex items-center gap-2 mb-2">
              {card.isActive ? (
                <motion.div
                  className="w-1.5 h-1.5 rounded-full bg-[var(--accent-blue)]"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              ) : (
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              )}
              {card.favicon ? (
                <img
                  src={card.favicon}
                  alt=""
                  className="w-3.5 h-3.5 rounded-sm"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : null}
              <span className="text-[11px] font-mono font-medium text-[var(--text-secondary)] truncate">
                {card.domain}
              </span>
            </div>

            {/* Data points */}
            {card.dataPoints.length > 0 ? (
              <div className="space-y-1">
                {card.dataPoints.map((dp, j) => (
                  <motion.div
                    key={`${card.id}-${j}`}
                    initial={{ opacity: 0, x: 4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: j * 0.05 }}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="text-[10px] font-mono text-[var(--text-quaternary)] truncate">
                      {dp.label}
                    </span>
                    <span className="text-[10px] font-mono text-[var(--text-tertiary)] shrink-0">
                      {dp.value}
                    </span>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="space-y-1.5">
                <motion.div
                  className="h-1.5 rounded bg-[var(--bg-hover)]"
                  style={{ width: '60%' }}
                  animate={{ opacity: [0.3, 0.5, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <motion.div
                  className="h-1.5 rounded bg-[var(--bg-hover)]"
                  style={{ width: '40%' }}
                  animate={{ opacity: [0.3, 0.5, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
                />
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Activity ticker at bottom */}
      {latestMessage && (
        <motion.div
          key={latestMessage}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-auto pt-2 border-t border-[var(--border-glass)]"
        >
          <div className="flex items-center gap-2">
            <motion.div
              className="w-1 h-1 rounded-full bg-[var(--accent-blue)] shrink-0"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            />
            <span className="text-[10px] font-mono text-[var(--text-quaternary)] truncate">
              {latestMessage}
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component — orchestrates text-only vs hyper-agent layout
// ---------------------------------------------------------------------------

export function ResearchActivityLog({ section, sectionLabel, phase, activity }: ResearchActivityLogProps) {
  const fallbackActivities = SECTION_ACTIVITIES[section] ?? DEFAULT_ACTIVITIES;

  // Real updates from worker
  const realUpdates = activity?.updates
    ? collapseResearchJobUpdates(activity.updates)
    : [];
  const hasRealUpdates = realUpdates.length > 0;

  // Simulated fallback when no real updates
  const [simVisibleCount, setSimVisibleCount] = useState(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (hasRealUpdates) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    setSimVisibleCount(1);
    intervalRef.current = setInterval(() => {
      setSimVisibleCount((prev) => {
        if (prev >= fallbackActivities.length) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return prev;
        }
        return prev + 1;
      });
    }, 3000 + Math.random() * 2000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [section, fallbackActivities.length, hasRealUpdates]);

  // Build unified entries list
  const entries: ActivityEntry[] = hasRealUpdates
    ? realUpdates.map((u, i) => ({
        id: u.id,
        message: u.message,
        phase: u.phase,
        isLive: i === realUpdates.length - 1 && activity?.status === 'running',
        meta: u.meta,
      }))
    : fallbackActivities.slice(0, simVisibleCount).map((msg, i) => ({
        id: `sim-${section}-${i}`,
        message: msg,
        phase: 'runner',
        isLive: i === simVisibleCount - 1 && simVisibleCount <= fallbackActivities.length,
      }));

  // Always show hyper-agent layout — no text-only fallback
  return <HyperAgentLayout entries={entries} sectionLabel={sectionLabel} phase={phase} hasRealUpdates={hasRealUpdates} />;
}

// ---------------------------------------------------------------------------
// HyperAgentLayout — split-screen with browser + data assembly
// ---------------------------------------------------------------------------

function HyperAgentLayout({
  entries,
  sectionLabel,
  phase,
  hasRealUpdates,
}: {
  entries: ActivityEntry[];
  sectionLabel: string;
  phase: 'researching' | 'streaming';
  hasRealUpdates: boolean;
}) {
  // Tools that produce meaningful per-domain data (not web_search source links)
  const SCRAPE_TOOLS = new Set([
    'firecrawl', 'firecrawl_scrape', 'firecrawl_scrape_url', 'firecrawlExtract',
    'spyfu', 'spyfu_keyword_intel', 'spyfu_domain_stats',
    'ad_library_search', 'search_ads', 'pagespeed_audit', 'page_speed',
  ]);

  // Entries with URLs (for browser panel)
  const metaEntries = entries.filter((e) => e.meta?.url);
  // Entries that should create data cards (scraped, not search results)
  const scrapeEntries = useMemo(
    () => entries.filter((e) =>
      e.meta?.url && (
        (e.meta.toolName && SCRAPE_TOOLS.has(e.meta.toolName)) ||
        e.meta.screenshotUrl ||
        (e.meta.dataPoints && e.meta.dataPoints.length > 0)
      ),
    ),
    [entries],
  );

  // Latest entry with a screenshot
  const latestScreenshot = useMemo(() => {
    for (let i = metaEntries.length - 1; i >= 0; i--) {
      if (metaEntries[i].meta?.screenshotUrl) return metaEntries[i];
    }
    return null;
  }, [metaEntries]);

  // Latest entry with a URL (for the URL bar)
  const latestUrl = metaEntries.length > 0 ? metaEntries[metaEntries.length - 1] : null;

  // Count all unique source URLs
  const pagesVisited = useMemo(() => {
    const urls = new Set<string>();
    for (const e of metaEntries) {
      if (e.meta?.url) urls.add(e.meta.url);
    }
    return urls.size;
  }, [metaEntries]);

  // Aggregate data points
  const allDataPoints = useMemo(() => {
    const points: Array<{ label: string; value: string }> = [];
    for (const e of entries) {
      if (e.meta?.dataPoints) {
        points.push(...e.meta.dataPoints);
      }
    }
    return points;
  }, [entries]);

  // Build data cards from scraped domains only (not every web search result)
  const dataCards = useMemo(() => {
    const cardMap = new Map<string, DataCard>();
    for (const e of scrapeEntries) {
      const url = e.meta?.url;
      if (!url) continue;
      let domain: string;
      try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch { domain = url; }
      const existing = cardMap.get(domain);
      if (existing) {
        if (e.meta?.dataPoints) {
          existing.dataPoints.push(...e.meta.dataPoints);
        }
        existing.isActive = e.isLive;
      } else {
        cardMap.set(domain, {
          id: `card-${domain}`,
          domain,
          favicon: e.meta?.favicon ?? null,
          dataPoints: e.meta?.dataPoints ? [...e.meta.dataPoints] : [],
          isActive: e.isLive,
        });
      }
    }
    return [...cardMap.values()];
  }, [scrapeEntries]);

  const latestMessage = entries.length > 0 ? entries[entries.length - 1].message : null;

  // Detect synthesis phase — the model is writing the final JSON artifact
  const isSynthesizing = useMemo(() => {
    // Look for analysis-phase entries with "synthesizing" in the message
    return entries.some(
      (e) => e.phase === 'analysis' && e.message.toLowerCase().includes('synthesiz'),
    );
  }, [entries]);

  // Extract real facts from "draft X: Y" analysis messages
  const extractedFacts = useMemo(() => {
    const facts: ExtractedFact[] = [];
    for (const e of entries) {
      if (e.phase !== 'analysis' || !e.message.startsWith('draft ')) continue;
      const colonIdx = e.message.indexOf(': ', 6);
      if (colonIdx === -1) continue;
      const label = e.message.slice(6, colonIdx);
      const value = e.message.slice(colonIdx + 2);
      if (label && value) facts.push({ label, value });
    }
    return facts;
  }, [entries]);

  // Extract source titles from "source: Title (domain)" messages
  const recentSources = useMemo(() => {
    const sources: string[] = [];
    for (const e of entries) {
      if (e.phase !== 'tool' || !e.message.startsWith('source: ')) continue;
      sources.push(e.message.slice(8));
    }
    return sources.slice(-6); // Keep last 6
  }, [entries]);

  return (
    <div className="flex flex-1 flex-col min-h-[400px] px-2 gap-3">
      {/* Status header */}
      <div className="flex items-center gap-3 px-2">
        <motion.div
          className={cn('w-2 h-2 rounded-full', isSynthesizing ? 'bg-amber-400' : 'bg-[var(--accent-blue)]')}
          animate={isSynthesizing
            ? { opacity: [1, 0.4, 1], scale: [1, 1.3, 1] }
            : { opacity: [1, 0.3, 1] }
          }
          transition={{ duration: isSynthesizing ? 1 : 1.4, repeat: Infinity, ease: 'easeInOut' }}
        />
        <span className={cn(
          'text-[12px] font-mono uppercase tracking-[0.14em]',
          isSynthesizing ? 'text-amber-400' : 'text-[var(--accent-blue)]',
        )}>
          {isSynthesizing
            ? 'Synthesizing report'
            : phase === 'streaming'
              ? 'Processing results'
              : 'Agent researching'}
        </span>
        <span className="text-[12px] font-mono text-[var(--text-quaternary)]">
          {sectionLabel}
        </span>
        {hasRealUpdates && (
          <span className="ml-auto text-[9px] font-mono text-emerald-400/50 uppercase tracking-wider">
            live
          </span>
        )}
      </div>

      {/* Synthesis progress bar — visible during report generation */}
      <AnimatePresence>
        {isSynthesizing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-2"
          >
            <div className="flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
              {/* Animated blocks assembling */}
              <div className="flex gap-0.5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 rounded-sm bg-amber-400"
                    animate={{
                      height: ['4px', '12px', '8px', '4px'],
                      opacity: [0.4, 1, 0.7, 0.4],
                    }}
                    transition={{
                      duration: 1.2,
                      repeat: Infinity,
                      delay: i * 0.15,
                      ease: 'easeInOut',
                    }}
                  />
                ))}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-mono text-amber-400/90">
                  Building artifact blocks
                </div>
                <div className="text-[9px] font-mono text-[var(--text-quaternary)] truncate">
                  {extractedFacts.length > 0
                    ? `${extractedFacts.length} data point${extractedFacts.length === 1 ? '' : 's'} extracted`
                    : 'Assembling research into structured report'}
                </div>
              </div>
              {/* Spinning indicator */}
              <motion.svg
                className="w-4 h-4 text-amber-400/60 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </motion.svg>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Split layout: Browser (60%) + Data Assembly (40%) */}
      <div className="flex gap-3 flex-1 min-h-0">
        {/* Agent Browser — left 60% */}
        <div className="w-[60%] min-h-[320px]">
          <AgentBrowser
            currentUrl={latestUrl?.meta?.url ?? null}
            currentScreenshot={latestScreenshot?.meta?.screenshotUrl ?? null}
            currentFavicon={latestUrl?.meta?.favicon ?? null}
            currentPageTitle={latestUrl?.meta?.pageTitle ?? null}
            pagesVisited={pagesVisited}
            dataPointCount={allDataPoints.length}
            extractedFacts={extractedFacts}
            recentSources={recentSources}
          />
        </div>

        {/* Live Data Assembly — right 40% */}
        <div className="w-[40%] min-h-[320px]">
          <LiveDataAssembly
            cards={dataCards}
            latestMessage={latestMessage}
            entries={entries}
          />
        </div>
      </div>
    </div>
  );
}
