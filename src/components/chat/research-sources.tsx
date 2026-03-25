'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Source {
  index: number;
  url: string;
  title: string;
  snippet?: string;
  favicon?: string;
}

interface ResearchSourcesProps {
  sources: Source[];
  className?: string;
}

/**
 * Parse citation markers [1][2] from text and extract source URLs.
 * Perplexity returns sources in a specific format — this parses them
 * from the response text.
 */
export function parseCitations(text: string): {
  citationIndices: number[];
  cleanText: string;
} {
  const indices = new Set<number>();
  const regex = /\[(\d+)\]/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    indices.add(parseInt(match[1], 10));
  }
  return {
    citationIndices: Array.from(indices).sort((a, b) => a - b),
    cleanText: text, // Keep citations in text — they're rendered as superscript
  };
}

/**
 * Render inline citation as a blue superscript number.
 * On hover, shows the source preview card.
 */
export function CitationMarker({
  index,
  source,
}: {
  index: number;
  source?: Source;
}) {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <span className="relative inline-block">
      <sup
        className="cursor-pointer text-blue-400 hover:text-blue-300 text-xs font-medium ml-0.5 transition-colors"
        onMouseEnter={() => setShowPreview(true)}
        onMouseLeave={() => setShowPreview(false)}
        aria-describedby={source ? `source-${index}` : undefined}
      >
        [{index}]
      </sup>
      {showPreview && source && (
        <div
          id={`source-${index}`}
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-[280px] bg-zinc-800 border border-zinc-700 rounded-lg p-3 shadow-lg z-50"
        >
          <div className="flex items-start gap-2">
            {source.favicon ? (
              <img
                src={source.favicon}
                alt=""
                className="w-4 h-4 rounded-sm mt-0.5 flex-shrink-0"
              />
            ) : (
              <div className="w-4 h-4 rounded-sm bg-zinc-600 mt-0.5 flex-shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-zinc-100 line-clamp-1 font-[family-name:var(--font-dm-sans)]">
                {source.title}
              </p>
              <p className="text-xs text-zinc-500 font-mono truncate mt-0.5">
                {new URL(source.url).hostname}
              </p>
            </div>
          </div>
          {source.snippet && (
            <p className="text-xs text-zinc-400 mt-2 line-clamp-2">
              {source.snippet}
            </p>
          )}
        </div>
      )}
    </span>
  );
}

/**
 * Collapsible sources section at the bottom of research responses.
 * Shows all cited sources as compact chips with favicon + domain.
 */
export function ResearchSources({ sources, className }: ResearchSourcesProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (sources.length === 0) return null;

  return (
    <div className={cn('mt-3', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
      >
        {isOpen ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        <span>
          {sources.length} source{sources.length !== 1 ? 's' : ''}
        </span>
      </button>
      {isOpen && (
        <div className="flex flex-wrap gap-2 mt-2">
          {sources.map((source) => (
            <a
              key={source.index}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2 py-1 bg-zinc-800/50 border border-zinc-700/50 rounded-md text-xs text-zinc-400 hover:text-zinc-300 hover:border-zinc-600 transition-colors"
            >
              {source.favicon ? (
                <img
                  src={source.favicon}
                  alt=""
                  className="w-3 h-3 rounded-sm"
                />
              ) : (
                <div className="w-3 h-3 rounded-sm bg-zinc-600" />
              )}
              <span className="truncate max-w-[120px]">
                {new URL(source.url).hostname.replace('www.', '')}
              </span>
              <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
