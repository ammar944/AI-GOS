'use client';

import { useId, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface ReviewSourceData {
  rating?: number | null;
  reviewCount?: number | null;
  themes?: string[];
  url?: string | null;
}

interface NegativeReview {
  text: string;
  rating: number;
  date?: string;
  source: 'g2' | 'capterra' | 'trustpilot';
}

interface ExploitAngle {
  gap: string;
  whyItMatters: string;
  positioningAngle: string;
  adHook: string;
  confidence: 'high' | 'medium' | 'low';
  evidenceQuotes: string[];
}

interface GapIntelligence {
  recurringComplaints: string[];
  exploitAngles: ExploitAngle[];
}

interface ReviewCardProps {
  competitorName: string;
  trustpilot?: ReviewSourceData | null;
  g2?: ReviewSourceData | null;
  capterra?: ReviewSourceData | null;
  negativeReviews?: NegativeReview[] | null;
  gapIntelligence?: GapIntelligence | null;
}

function Stars({ rating, idPrefix }: { rating: number; idPrefix: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const fill = Math.min(1, Math.max(0, rating - star + 1));
        return (
          <svg key={star} className="w-3.5 h-3.5" viewBox="0 0 20 20">
            <defs>
              <linearGradient id={`${idPrefix}-star-${star}`}>
                <stop offset={`${fill * 100}%`} stopColor="var(--accent-amber)" />
                <stop
                  offset={`${fill * 100}%`}
                  stopColor="currentColor"
                  stopOpacity="0.15"
                />
              </linearGradient>
            </defs>
            <path
              d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
              fill={`url(#${idPrefix}-star-${star})`}
            />
          </svg>
        );
      })}
    </div>
  );
}

function ReviewSource({
  platform,
  source,
  idPrefix,
}: {
  platform: string;
  source: ReviewSourceData;
  idPrefix: string;
}) {
  const hasRating = source.rating != null;
  const hasCount = source.reviewCount != null;
  const themes = source.themes ?? [];

  return (
    <div className="space-y-2">
      <span className="text-xs font-mono text-[var(--text-tertiary)] uppercase tracking-widest">
        {platform}
      </span>

      {hasRating && (
        <div className="flex items-center gap-2">
          <Stars rating={source.rating!} idPrefix={`${idPrefix}-${platform}`} />
          <span className="text-base font-semibold text-[var(--text-primary)]">
            {source.rating!.toFixed(1)}/5
          </span>
        </div>
      )}

      {hasCount && (
        <p className="text-xs text-[var(--text-tertiary)]">
          {source.reviewCount!.toLocaleString()} reviews
        </p>
      )}

      {themes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {themes.map((theme) => (
            <span
              key={theme}
              className="bg-[var(--bg-hover)] rounded-full px-2 py-0.5 text-xs text-[var(--text-secondary)]"
            >
              {theme}
            </span>
          ))}
        </div>
      )}

      {source.url && (
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-[var(--accent-blue)] hover:underline"
        >
          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none">
            <path
              d="M6.5 3.5H3.5C2.948 3.5 2.5 3.948 2.5 4.5v8c0 .552.448 1 1 1h8c.552 0 1-.448 1-1V9.5M9.5 2.5h4v4M13.5 2.5l-7 7"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          View source
        </a>
      )}
    </div>
  );
}

const SOURCE_LABEL: Record<'g2' | 'capterra' | 'trustpilot', string> = {
  g2: 'G2',
  capterra: 'Capterra',
  trustpilot: 'Trustpilot',
};

const CONFIDENCE_STYLES: Record<'high' | 'medium' | 'low', string> = {
  high: 'text-[var(--green)] bg-[rgba(34,197,94,0.1)]',
  medium: 'text-[var(--amber)] bg-[rgba(234,179,8,0.1)]',
  low: 'text-[var(--text-tertiary)] bg-[var(--bg-hover)]',
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback for non-secure contexts
    }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center justify-center w-6 h-6 min-w-[44px] min-h-[44px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
      aria-label="Copy ad hook to clipboard"
    >
      {copied ? (
        <svg className="w-3.5 h-3.5 text-[var(--green)]" viewBox="0 0 16 16" fill="none">
          <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">
          <rect x="5.5" y="5.5" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" />
          <path d="M10.5 5.5V3.5a1 1 0 00-1-1h-6a1 1 0 00-1 1v6a1 1 0 001 1h2" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      )}
    </button>
  );
}

function EvidenceQuotes({ quotes }: { quotes: string[] }) {
  const [expanded, setExpanded] = useState(false);

  if (quotes.length === 0) return null;

  return (
    <div className="mt-1">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="inline-flex items-center gap-1 text-[10px] font-mono text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors min-h-[44px] min-w-[44px]"
        aria-expanded={expanded}
      >
        <svg
          className={cn('w-2.5 h-2.5 transition-transform', expanded && 'rotate-90')}
          viewBox="0 0 16 16"
          fill="none"
        >
          <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {quotes.length} source{quotes.length !== 1 ? 's' : ''}
      </button>
      {expanded && (
        <div className="mt-1 space-y-1">
          {quotes.slice(0, 3).map((quote, idx) => (
            <p key={idx} className="text-[11px] text-[var(--text-tertiary)] leading-relaxed pl-3 border-l border-[var(--border-subtle)]">
              &ldquo;{quote.length > 150 ? `${quote.slice(0, 150)}...` : quote}&rdquo;
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function ExploitAnglesSection({ intelligence }: { intelligence: GapIntelligence }) {
  const angles = intelligence.exploitAngles;
  if (angles.length === 0) return null;

  return (
    <div className="space-y-3">
      <span className="text-[11px] font-mono font-medium text-[var(--text-tertiary)] uppercase tracking-[0.06em]">
        Exploit Angles
      </span>
      <div className="space-y-2">
        {angles.map((angle, idx) => (
          <div
            key={idx}
            className="border-l-2 border-[var(--accent-blue)] pl-3 space-y-1"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-[var(--text-primary)]">
                {angle.gap}
              </span>
              <span className={cn(
                'shrink-0 rounded-full px-[7px] py-[1px] text-[10px] font-mono font-medium uppercase',
                CONFIDENCE_STYLES[angle.confidence],
              )}>
                {angle.confidence}
              </span>
            </div>
            <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
              {angle.positioningAngle}
            </p>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] italic text-[var(--text-secondary)]">
                &ldquo;{angle.adHook}&rdquo;
              </p>
              <CopyButton text={angle.adHook} />
            </div>
            <EvidenceQuotes quotes={angle.evidenceQuotes} />
          </div>
        ))}
      </div>
    </div>
  );
}

function NegativeReviewsSection({ reviews }: { reviews: NegativeReview[] }) {
  const [expanded, setExpanded] = useState(false);

  if (reviews.length === 0) return null;

  return (
    <div className="border-t border-[var(--border-subtle)] pt-3 space-y-2">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors w-full text-left min-h-[44px]"
        aria-expanded={expanded}
      >
        <svg
          className={cn('w-3 h-3 transition-transform', expanded && 'rotate-90')}
          viewBox="0 0 16 16"
          fill="none"
        >
          <path
            d="M6 4l4 4-4 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>
          {reviews.length} negative review{reviews.length !== 1 ? 's' : ''}
        </span>
      </button>

      {expanded && (
        <div className="space-y-2">
          {reviews.map((review, idx) => (
            <div
              key={idx}
              className="bg-[var(--bg-hover)] rounded-[var(--radius-sm)] p-2.5 space-y-1"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  {[1, 2, 3].map((star) => (
                    <svg
                      key={star}
                      className={cn(
                        'w-3 h-3',
                        star <= review.rating
                          ? 'text-[var(--accent-amber)]'
                          : 'text-[var(--text-tertiary)] opacity-30',
                      )}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-mono text-[var(--text-tertiary)] uppercase tracking-wide">
                    {SOURCE_LABEL[review.source]}
                  </span>
                  {review.date && (
                    <span className="text-xs text-[var(--text-tertiary)]">{review.date}</span>
                  )}
                </div>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-3">
                &ldquo;{review.text}&rdquo;
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ReviewCard({
  competitorName,
  trustpilot,
  g2,
  capterra,
  negativeReviews,
  gapIntelligence,
}: ReviewCardProps) {
  const uniqueId = useId();
  const hasTrustpilot = Boolean(trustpilot);
  const hasG2 = Boolean(g2);
  const hasCapterra = Boolean(capterra);
  const activeSourceCount = [hasTrustpilot, hasG2, hasCapterra].filter(Boolean).length;
  const hasNegativeReviews = (negativeReviews ?? []).length > 0;
  const hasGapIntelligence = Boolean(gapIntelligence?.exploitAngles?.length);

  if (!hasTrustpilot && !hasG2 && !hasCapterra && !hasNegativeReviews && !hasGapIntelligence) return null;

  const gridCols =
    activeSourceCount === 3
      ? 'grid-cols-3'
      : activeSourceCount === 2
        ? 'grid-cols-2'
        : 'grid-cols-1';

  return (
    <div className="glass-surface rounded-[var(--radius-md)] p-3 space-y-3">
      {hasGapIntelligence && (
        <ExploitAnglesSection intelligence={gapIntelligence!} />
      )}

      {activeSourceCount > 0 && (
        <div className={cn(
          'grid gap-4',
          gridCols,
          hasGapIntelligence && 'border-t border-[var(--border-subtle)] pt-3',
        )}>
          {trustpilot && (
            <ReviewSource
              platform="Trustpilot"
              source={trustpilot}
              idPrefix={`${uniqueId}-tp`}
            />
          )}
          {g2 && (
            <ReviewSource
              platform="G2"
              source={g2}
              idPrefix={`${uniqueId}-g2`}
            />
          )}
          {capterra && (
            <ReviewSource
              platform="Capterra"
              source={capterra}
              idPrefix={`${uniqueId}-cap`}
            />
          )}
        </div>
      )}

      {hasNegativeReviews && (
        <NegativeReviewsSection reviews={negativeReviews!} />
      )}
    </div>
  );
}
