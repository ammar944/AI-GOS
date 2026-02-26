'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { scaleIn, springs } from '@/lib/motion';
import { CitationHoverCard } from '@/components/chat/citation-hover-card';

interface DeepResearchPhase {
  name: string;
  status: 'done' | 'in-progress' | 'pending';
  duration: number;
}

interface DeepResearchFinding {
  title: string;
  content: string;
  citations: { label: string; url: string }[];
}

interface DeepResearchSource {
  domain: string;
  url: string;
}

interface DeepResearchCardProps {
  data: {
    query: string;
    phases: DeepResearchPhase[];
    findings: DeepResearchFinding[];
    sources: DeepResearchSource[];
    totalDuration: number;
  };
  isStreaming?: boolean;
}

function PhaseDot({ status }: { status: DeepResearchPhase['status'] }) {
  if (status === 'done') {
    return (
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: 'var(--accent-green)' }}
      />
    );
  }
  if (status === 'in-progress') {
    return (
      <motion.span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: 'var(--accent-blue)' }}
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
      />
    );
  }
  return (
    <span
      className="w-2 h-2 rounded-full flex-shrink-0"
      style={{ background: 'var(--text-tertiary)', opacity: 0.4 }}
    />
  );
}

function FindingBlock({ finding }: { finding: DeepResearchFinding }) {
  const [expanded, setExpanded] = useState(false);
  const CHAR_LIMIT = 320;
  const isTruncatable = finding.content.length > CHAR_LIMIT;
  const displayContent = expanded || !isTruncatable
    ? finding.content
    : finding.content.slice(0, CHAR_LIMIT) + '\u2026';

  function handleCitationClick(url: string) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  // Render inline citation chips alongside content
  function renderContent() {
    const citationMap = new Map(
      finding.citations.map((c, i) => [c.label, { index: i + 1, url: c.url, label: c.label }])
    );

    // Look for [label] patterns and replace with superscript chips
    const parts = displayContent.split(/(\[[^\]]+\])/g);
    return parts.map((part, idx) => {
      const matchLabel = part.match(/^\[([^\]]+)\]$/);
      if (matchLabel && citationMap.has(matchLabel[1])) {
        const cit = citationMap.get(matchLabel[1])!;
        const domain = extractDomain(cit.url);
        return (
          <CitationHoverCard
            key={idx}
            source={{ domain, url: cit.url, title: matchLabel[1] }}
            citationNumber={cit.index}
          >
            <button
              onClick={() => handleCitationClick(cit.url)}
              className="inline-flex items-center justify-center w-4 h-4 rounded font-mono cursor-pointer mx-0.5 align-middle"
              style={{
                fontSize: '9px',
                background: 'var(--accent-blue)',
                color: '#ffffff',
                border: 'none',
                verticalAlign: 'super',
                lineHeight: 1,
              }}
            >
              {cit.index}
            </button>
          </CitationHoverCard>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  }

  return (
    <div
      className="rounded-lg p-3 mb-2"
      style={{ background: 'var(--bg-hover)' }}
    >
      <p
        className="font-semibold mb-1"
        style={{ fontSize: '12px', color: 'var(--text-primary)' }}
      >
        {finding.title}
      </p>
      <p
        className="leading-relaxed"
        style={{ fontSize: '12px', color: 'var(--text-secondary)' }}
      >
        {renderContent()}
      </p>
      {isTruncatable && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1.5 flex items-center gap-1 cursor-pointer"
          style={{ fontSize: '11px', color: 'var(--accent-blue)', background: 'none', border: 'none', padding: 0 }}
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3 h-3" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" />
              Show more
            </>
          )}
        </button>
      )}
    </div>
  );
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function DeepResearchCard({ data, isStreaming = false }: DeepResearchCardProps) {
  const [phasesExpanded, setPhasesExpanded] = useState(false);
  const [findingsExpanded, setFindingsExpanded] = useState(true);

  const donePhasesCount = data.phases.filter(p => p.status === 'done').length;

  return (
    <motion.div
      variants={scaleIn}
      initial="initial"
      animate="animate"
      transition={springs.smooth}
      className="rounded-xl overflow-hidden my-2"
      style={{
        border: '1px solid var(--border-default)',
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3"
        style={{ background: 'rgba(54,94,255,0.04)' }}
      >
        <div className="flex items-center gap-2 mb-1">
          <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--accent-blue)' }} />
          <span
            className="font-semibold uppercase tracking-wider"
            style={{ fontSize: '11px', letterSpacing: '0.05em', color: 'var(--accent-blue)' }}
          >
            Deep Research
          </span>
          {isStreaming && (
            <motion.span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: 'var(--accent-blue)' }}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          {!isStreaming && data.totalDuration > 0 && (
            <span
              className="ml-auto font-mono"
              style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}
            >
              {(data.totalDuration / 1000).toFixed(1)}s
            </span>
          )}
        </div>
        <p
          className="font-medium"
          style={{ fontSize: '13px', color: 'var(--text-primary)' }}
        >
          {data.query}
        </p>
      </div>

      {/* Phases section */}
      {data.phases.length > 0 && (
        <div
          style={{ borderTop: '1px solid var(--border-subtle)' }}
        >
          <button
            onClick={() => setPhasesExpanded(!phasesExpanded)}
            className="w-full flex items-center gap-2 px-4 py-2 text-left cursor-pointer"
            style={{ background: 'none', border: 'none' }}
          >
            <span
              style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}
            >
              {donePhasesCount}/{data.phases.length} phases complete
            </span>
            {phasesExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 ml-auto" style={{ color: 'var(--text-tertiary)' }} />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 ml-auto" style={{ color: 'var(--text-tertiary)' }} />
            )}
          </button>

          <AnimatePresence>
            {phasesExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={springs.smooth}
                className="overflow-hidden"
              >
                <div className="px-4 pb-3 space-y-1.5">
                  {data.phases.map((phase, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <PhaseDot status={phase.status} />
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {phase.name}
                      </span>
                      {phase.duration > 0 && (
                        <span
                          className="ml-auto font-mono"
                          style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}
                        >
                          {(phase.duration / 1000).toFixed(1)}s
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Findings */}
      {data.findings.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <button
            onClick={() => setFindingsExpanded(!findingsExpanded)}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-left cursor-pointer"
            style={{ background: 'none', border: 'none' }}
          >
            <span
              className="font-medium"
              style={{ fontSize: '11px', color: 'var(--text-secondary)' }}
            >
              {data.findings.length} Finding{data.findings.length !== 1 ? 's' : ''}
            </span>
            {findingsExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 ml-auto" style={{ color: 'var(--text-tertiary)' }} />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 ml-auto" style={{ color: 'var(--text-tertiary)' }} />
            )}
          </button>

          <AnimatePresence>
            {findingsExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={springs.smooth}
                className="overflow-hidden"
              >
                <div className="px-4 pb-3">
                  {data.findings.map((finding, i) => (
                    <FindingBlock key={i} finding={finding} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Sources footer */}
      {data.sources.length > 0 && (
        <div
          className="px-4 py-2.5 flex flex-wrap gap-1.5"
          style={{ borderTop: '1px solid var(--border-subtle)' }}
        >
          {data.sources.map((source, i) => {
            const domain = extractDomain(source.url) || source.domain;
            return (
              <CitationHoverCard
                key={i}
                source={{ domain, url: source.url }}
                citationNumber={i + 1}
              >
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 cursor-pointer hover:opacity-80 transition-opacity"
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-tertiary)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <ExternalLink className="w-2.5 h-2.5" />
                  {domain}
                </a>
              </CitationHoverCard>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
