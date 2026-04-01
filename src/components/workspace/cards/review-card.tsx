'use client';

import { useId, useState } from 'react';
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

function NegativeReviewsSection({ reviews }: { reviews: NegativeReview[] }) {
  const [expanded, setExpanded] = useState(false);

  if (reviews.length === 0) return null;

  return (
    <div className="border-t border-[var(--border-subtle)] pt-3 space-y-2">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors w-full text-left"
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
}: ReviewCardProps) {
  const uniqueId = useId();
  const hasTrustpilot = Boolean(trustpilot);
  const hasG2 = Boolean(g2);
  const hasCapterra = Boolean(capterra);
  const activeSourceCount = [hasTrustpilot, hasG2, hasCapterra].filter(Boolean).length;
  const hasNegativeReviews = (negativeReviews ?? []).length > 0;

  if (!hasTrustpilot && !hasG2 && !hasCapterra) return null;

  const gridCols =
    activeSourceCount === 3
      ? 'grid-cols-3'
      : activeSourceCount === 2
        ? 'grid-cols-2'
        : 'grid-cols-1';

  return (
    <div className="glass-surface rounded-[var(--radius-md)] p-3 space-y-3">
      <div className={cn('grid gap-4', gridCols)}>
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

      {hasNegativeReviews && (
        <NegativeReviewsSection reviews={negativeReviews!} />
      )}
    </div>
  );
}
