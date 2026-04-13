'use client';

import { useState } from 'react';
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

interface ReviewCardProps {
  competitorName: string;
  trustpilot?: ReviewSourceData | null;
  g2?: ReviewSourceData | null;
  capterra?: ReviewSourceData | null;
  negativeReviews?: NegativeReview[] | null;
  // Wave 6e: ExploitAngles section removed from rendering. Prop accepted for
  // backwards compat with callers (e.g. card-renderer pass-through) but not
  // used. Type widened to unknown so we don't need to import the gap schema.
  gapIntelligence?: unknown;
}

const SOURCE_LABEL: Record<'g2' | 'capterra' | 'trustpilot', string> = {
  g2: 'G2',
  capterra: 'Capterra',
  trustpilot: 'Trustpilot',
};

/** Semantic color for a rating: green >= 4, amber >= 3, red < 3 */
function ratingColor(rating: number): string {
  if (rating >= 4) return 'var(--accent-green)';
  if (rating >= 3) return 'var(--accent-amber)';
  return 'var(--accent-red)';
}

/** Compact inline platform rating */
function PlatformRating({
  platform,
  source,
}: {
  platform: string;
  source: ReviewSourceData;
}) {
  const hasRating = source.rating != null;
  const hasCount = source.reviewCount != null;

  return (
    <div className="flex items-center gap-2.5 py-2 px-3">
      <span className="text-[11px] font-mono text-[var(--text-tertiary)] uppercase tracking-[0.06em]">
        {platform}
      </span>
      {hasRating && (
        <span
          className="font-mono tabular-nums text-base font-semibold"
          style={{ color: ratingColor(source.rating!) }}
        >
          {source.rating!.toFixed(1)}
          <span className="text-[var(--text-tertiary)] text-xs font-normal">/5</span>
        </span>
      )}
      {hasCount && (
        <span className="text-xs text-[var(--text-tertiary)]">
          ({source.reviewCount!.toLocaleString()})
        </span>
      )}
      {source.url && (
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors duration-150 shrink-0"
          aria-label={`View ${platform} reviews`}
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
        </a>
      )}
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
        className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors duration-150 w-full text-left min-h-[44px]"
        aria-expanded={expanded}
      >
        <svg
          className={cn('w-3 h-3 transition-transform duration-150', expanded && 'rotate-90')}
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
        <span className="font-mono text-[11px] uppercase tracking-[0.06em]">
          {reviews.length} negative review{reviews.length !== 1 ? 's' : ''}
        </span>
      </button>

      {expanded && (
        <div className="space-y-0">
          {reviews.map((review, idx) => (
            <div
              key={idx}
              className={cn(
                'flex items-start gap-3 py-2.5',
                idx < reviews.length - 1 && 'border-b border-[var(--border-subtle)]',
              )}
            >
              {/* Rating as colored number */}
              <span
                className="font-mono tabular-nums text-sm font-semibold shrink-0 mt-0.5"
                style={{ color: ratingColor(review.rating) }}
              >
                {review.rating}/5
              </span>

              {/* Quote */}
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed line-clamp-3 flex-1 min-w-0">
                &ldquo;{review.text}&rdquo;
              </p>

              {/* Source + date */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-mono font-medium rounded-full px-2 py-0.5 bg-[var(--bg-hover)] text-[var(--text-secondary)]">
                  {SOURCE_LABEL[review.source]}
                </span>
                {review.date && (
                  <span className="text-[11px] font-mono text-[var(--text-tertiary)] tabular-nums">
                    {review.date}
                  </span>
                )}
              </div>
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
  const sources: Array<{ key: 'trustpilot' | 'g2' | 'capterra'; data: ReviewSourceData }> = [];
  if (trustpilot) sources.push({ key: 'trustpilot', data: trustpilot });
  if (g2) sources.push({ key: 'g2', data: g2 });
  if (capterra) sources.push({ key: 'capterra', data: capterra });

  const hasNegativeReviews = (negativeReviews ?? []).length > 0;

  // Collect all themes from all platforms, deduplicated
  const allThemes = Array.from(
    new Set(sources.flatMap((s) => s.data.themes ?? [])),
  );

  if (sources.length === 0 && !hasNegativeReviews) return null;

  return (
    <div className="space-y-3">
      {/* Platform ratings — compact horizontal row */}
      {sources.length > 0 && (
        <div className="flex items-center flex-wrap divide-x divide-[var(--border-subtle)]">
          {sources.map((s) => (
            <PlatformRating
              key={s.key}
              platform={SOURCE_LABEL[s.key]}
              source={s.data}
            />
          ))}
        </div>
      )}

      {/* Review themes — single deduped row */}
      {allThemes.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[11px] font-mono text-[var(--text-tertiary)] uppercase tracking-[0.06em]">
            Review Themes
          </span>
          <div className="flex flex-wrap gap-1.5">
            {allThemes.map((theme) => (
              <span
                key={theme}
                className="text-[10px] font-mono font-medium rounded-full px-2 py-0.5 bg-[var(--bg-hover)] text-[var(--text-secondary)]"
              >
                {theme}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Negative reviews — compact rows */}
      {hasNegativeReviews && <NegativeReviewsSection reviews={negativeReviews!} />}
    </div>
  );
}
