'use client';

import { ExternalLink } from 'lucide-react';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface CitationSource {
  title?: string;
  domain: string;
  url: string;
  snippet?: string;
}

interface CitationHoverCardProps {
  source: CitationSource;
  citationNumber: number;
  children: React.ReactNode;
}

export function CitationHoverCard({
  source,
  citationNumber,
  children,
}: CitationHoverCardProps) {
  const displayTitle = source.title && source.title.trim()
    ? source.title
    : source.domain;

  const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(source.domain)}&sz=16`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side="top"
        align="center"
        sideOffset={6}
        className={cn(
          // Reset shadcn defaults, apply custom card styling
          '!bg-[var(--bg-elevated)] !text-[var(--text-primary)]',
          '!border !border-[var(--border-default)]',
          '!rounded-[10px] !p-3',
          '!shadow-[0_4px_16px_rgba(0,0,0,0.4)]',
          // Override width constraint
          '!max-w-[280px] !w-[280px]',
          // Kill the default arrow bg
          '[&>svg]:!fill-[var(--bg-elevated)]',
        )}
      >
        {/* Title */}
        <p
          className="font-semibold leading-tight mb-1.5 truncate"
          style={{ fontSize: '13px', color: 'var(--text-primary)' }}
          title={displayTitle}
        >
          {displayTitle}
        </p>

        {/* Domain row with favicon */}
        <div className="flex items-center gap-1.5 mb-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={faviconUrl}
            alt=""
            width={12}
            height={12}
            className="rounded-sm flex-shrink-0"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
          <span
            className="truncate"
            style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}
          >
            {source.domain}
          </span>
          <span
            className="ml-auto flex-shrink-0 font-mono"
            style={{ fontSize: '10px', color: 'var(--text-tertiary)', opacity: 0.6 }}
          >
            [{citationNumber}]
          </span>
        </div>

        {/* Snippet preview */}
        {source.snippet && (
          <p
            className="leading-relaxed line-clamp-2 mb-2"
            style={{ fontSize: '12px', color: 'var(--text-secondary)' }}
          >
            {source.snippet}
          </p>
        )}

        {/* Open source link */}
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 hover:opacity-70 transition-opacity"
          style={{ fontSize: '11px', color: 'var(--accent-blue)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="w-3 h-3 flex-shrink-0" />
          Open source
        </a>
      </TooltipContent>
    </Tooltip>
  );
}
