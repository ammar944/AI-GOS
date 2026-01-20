"use client";

import { useState, useMemo, type ReactNode } from "react";
import { Link2, ExternalLink, ChevronDown, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Citation } from "@/lib/strategic-blueprint/output-types";

// =============================================================================
// Subscript Reference Styling - Highlights [1], [2], etc. in text
// =============================================================================

/**
 * Parses text and wraps subscript references like [1], [2] with styled spans.
 * Returns an array of ReactNodes with styled subscripts.
 */
function parseSubscriptReferences(text: string): ReactNode[] {
  // Match [N] where N is one or more digits
  const pattern = /\[(\d+)\]/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    // Add the styled subscript
    parts.push(
      <span
        key={`sub-${match.index}`}
        className="font-medium text-[0.85em] align-super"
        style={{ color: 'var(--accent-blue)' }}
      >
        [{match[1]}]
      </span>
    );
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last match
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

/**
 * Recursively processes children to style subscript references.
 * Handles both string children and nested ReactNodes.
 * Exported for use in chat messages and other components.
 */
export function renderWithSubscripts(children: ReactNode): ReactNode {
  if (typeof children === "string") {
    const parts = parseSubscriptReferences(children);
    return parts.length === 1 && typeof parts[0] === "string"
      ? parts[0]
      : <>{parts}</>;
  }
  // For non-string children, return as-is (they may contain their own styled content)
  return children;
}

// =============================================================================
// CitationBadge
// =============================================================================

export interface CitationBadgeProps {
  /** Number of citations/sources */
  count: number;
}

/**
 * Small badge showing citation count for a section.
 * Only renders if count > 0.
 * Uses cyan accent color to highlight metrics.
 */
export function CitationBadge({ count }: CitationBadgeProps) {
  if (count <= 0) return null;

  return (
    <Badge
      variant="outline"
      className="gap-1"
      style={{
        borderColor: 'var(--accent-blue)',
        color: 'var(--accent-blue)',
        background: 'rgba(54, 94, 255, 0.1)',
      }}
    >
      <Link2 className="h-3 w-3" />
      {count} {count === 1 ? "source" : "sources"}
    </Badge>
  );
}

// =============================================================================
// SourcedText - Inline citation indicator for research-backed content
// =============================================================================

export interface SourcedTextProps {
  /** The text content to display */
  children: React.ReactNode;
  /** Optional className for styling */
  className?: string;
}

/**
 * Wraps text with a subtle indicator showing it's research-backed.
 * Shows a small globe icon on hover with tooltip.
 * Uses dotted underline to indicate sourced data.
 * Highlights subscript references like [1], [2] in cyan.
 */
export function SourcedText({ children, className }: SourcedTextProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 cursor-help",
              "decoration-dotted underline underline-offset-2",
              className
            )}
            style={{ textDecorationColor: 'rgba(54, 94, 255, 0.4)' }}
          >
            {renderWithSubscripts(children)}
            <Globe className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--accent-blue)' }} />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p>Data sourced from web research</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Wraps list item text with citation indicator.
 * More compact version for use in lists.
 * Highlights subscript references like [1], [2] in cyan.
 */
export function SourcedListItem({ children, className }: SourcedTextProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "cursor-help border-b border-dotted",
              className
            )}
            style={{ borderColor: 'rgba(54, 94, 255, 0.3)' }}
          >
            {renderWithSubscripts(children)}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p>Data sourced from web research</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// =============================================================================
// SourcesList
// =============================================================================

export interface SourcesListProps {
  /** Array of citations to display */
  citations: Citation[];
  /** Label for the section (for accessibility) */
  sectionLabel: string;
}

/**
 * Extract domain from URL for display.
 */
function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Truncate text to max length with ellipsis.
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "…";
}

/**
 * Collapsible list of citations/sources.
 * Shows citation title, domain, date, and snippet.
 */
export function SourcesList({ citations, sectionLabel }: SourcesListProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!citations || citations.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-4">
      <CollapsibleTrigger
        className={cn(
          "flex w-full items-center justify-between rounded-lg px-4 py-3 text-sm font-medium transition-colors",
          isOpen && "rounded-b-none border-b-0"
        )}
        style={{
          border: '1px solid var(--border-default)',
          background: 'var(--bg-hover)',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-sans), Inter, sans-serif',
        }}
        aria-label={`Toggle sources for ${sectionLabel}`}
      >
        <span className="flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          View {citations.length} {citations.length === 1 ? "Source" : "Sources"}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </CollapsibleTrigger>

      <CollapsibleContent
        className={cn(
          "rounded-b-lg border border-t-0"
        )}
        style={{
          background: 'var(--bg-surface)',
          borderColor: 'var(--border-default)',
        }}
      >
        <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
          {citations.map((citation, index) => (
            <div key={`${citation.url}-${index}`} className="px-4 py-3">
              {/* Title with external link */}
              <a
                href={citation.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-2 text-sm font-medium transition-colors duration-200"
                style={{
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-sans), Inter, sans-serif',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-blue)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
              >
                <span className="flex-1">
                  {citation.title
                    ? truncate(citation.title, 60)
                    : truncate(citation.url, 60)}
                </span>
                <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 opacity-50 group-hover:opacity-100" />
              </a>

              {/* Domain and date */}
              <div
                className="mt-1 flex items-center gap-2 text-xs"
                style={{
                  color: 'var(--text-tertiary)',
                  fontFamily: 'var(--font-sans), Inter, sans-serif',
                }}
              >
                <span>{extractDomain(citation.url)}</span>
                {citation.date && (
                  <>
                    <span>•</span>
                    <span>{citation.date}</span>
                  </>
                )}
              </div>

              {/* Snippet */}
              {citation.snippet && (
                <p
                  className="mt-2 text-xs leading-relaxed"
                  style={{
                    color: 'var(--text-tertiary)',
                    fontFamily: 'var(--font-sans), Inter, sans-serif',
                  }}
                >
                  {truncate(citation.snippet, 150)}
                </p>
              )}
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
