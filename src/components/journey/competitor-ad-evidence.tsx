'use client';

import { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { shouldUseProxy, getProxyUrl as proxyUrlFn } from '@/lib/image-proxy';
import { ExternalLink, Play, ImageOff } from 'lucide-react';

interface AdCreative {
  platform: 'linkedin' | 'meta' | 'google';
  id: string;
  advertiser: string;
  headline?: string;
  body?: string;
  imageUrl?: string;
  videoUrl?: string;
  format: 'video' | 'image' | 'carousel' | 'text' | 'message' | 'unknown';
  isActive: boolean;
  detailsUrl?: string;
  firstSeen?: string;
  lastSeen?: string;
}

function proxyUrl(url: string): string {
  if (shouldUseProxy(url)) {
    return proxyUrlFn(url);
  }
  return url;
}

interface LibraryLinks {
  metaLibraryUrl?: string;
  linkedInLibraryUrl?: string;
  googleAdvertiserUrl?: string;
}

export interface CompetitorAdEvidenceProps {
  adActivity?: {
    activeAdCount: number;
    platforms: string[];
    themes: string[];
    evidence: string;
    sourceConfidence: 'high' | 'medium' | 'low';
  };
  adCreatives?: AdCreative[];
  libraryLinks?: LibraryLinks;
}

// Platform brand colours
const PLATFORM_COLORS: Record<string, string> = {
  meta: '#1877F2',
  linkedin: '#0A66C2',
  google: '#4285F4',
};

const PLATFORM_LABELS: Record<string, string> = {
  meta: 'Meta',
  linkedin: 'LinkedIn',
  google: 'Google',
};

const CONFIDENCE_STYLES: Record<string, string> = {
  high: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  low: 'bg-red-500/10 text-red-400 border border-red-500/20',
};

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// ─── AdMedia ────────────────────────────────────────────────────────────────

/**
 * Placeholder shown when an ad has no usable preview (video failed to load
 * AND no poster image, OR no media at all). Always provides a click-through
 * to detailsUrl so the user can view the original ad in the platform's library.
 */
function AdMediaPlaceholder({ creative, reason }: { creative: AdCreative; reason: 'no-media' | 'video-failed' }) {
  const platformLabel = PLATFORM_LABELS[creative.platform] ?? creative.platform;
  const platformColor = PLATFORM_COLORS[creative.platform] ?? 'rgba(255,255,255,0.4)';
  const message = reason === 'video-failed'
    ? `${platformLabel} video preview unavailable`
    : `${platformLabel} ad preview unavailable`;

  // If we have a detailsUrl, render the placeholder as a clickable link.
  if (creative.detailsUrl) {
    return (
      <a
        href={creative.detailsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group/media flex aspect-[4/3] w-full cursor-pointer flex-col items-center justify-center gap-2 transition-colors"
        style={{ background: 'rgba(255,255,255,0.025)', borderBottom: `1px solid ${platformColor}20` }}
        aria-label={`Open ${platformLabel} ad in library`}
      >
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full transition-transform group-hover/media:scale-110"
          style={{ background: `${platformColor}20`, color: platformColor }}
        >
          <ExternalLink className="h-4 w-4" />
        </div>
        <p className="px-4 text-center text-[11px] leading-snug" style={{ color: 'rgba(255,255,255,0.5)' }}>
          {message}
          <br />
          <span className="text-[10px]" style={{ color: platformColor }}>Click to open original</span>
        </p>
      </a>
    );
  }

  // No detailsUrl either — minimal placeholder
  return (
    <div
      className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2"
      style={{ background: 'rgba(255,255,255,0.02)' }}
    >
      <ImageOff className="h-6 w-6" style={{ color: 'rgba(255,255,255,0.15)' }} />
      <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>{message}</p>
    </div>
  );
}

function AdMedia({ creative }: { creative: AdCreative }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [useProxy, setUseProxy] = useState(false);

  const hasVideo = !!creative.videoUrl && !videoError;
  const hasImage = !!creative.imageUrl && !imgError;

  // Video failed AND no poster image → clickable placeholder pointing at the source
  if (creative.videoUrl && videoError && !hasImage) {
    return <AdMediaPlaceholder creative={creative} reason="video-failed" />;
  }

  // No media at all → clickable placeholder pointing at the source
  if (!hasVideo && !hasImage) {
    return <AdMediaPlaceholder creative={creative} reason="no-media" />;
  }

  // Video with play overlay (and clickable fallback to detailsUrl when play fails)
  if (hasVideo) {
    const handlePlayClick = () => {
      const videoEl = videoRef.current;
      if (!videoEl) return;
      const playPromise = videoEl.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.catch(() => {
          // Play was rejected (CORS, codec, autoplay block, etc.)
          // Fall back to opening the source library if available.
          if (creative.detailsUrl) {
            window.open(creative.detailsUrl, '_blank', 'noopener,noreferrer');
          } else {
            setVideoError(true);
          }
        });
      }
    };

    return (
      <div className="relative aspect-[4/3] w-full bg-black">
        <video
          ref={videoRef}
          src={creative.videoUrl}
          poster={creative.imageUrl ? proxyUrl(creative.imageUrl) : undefined}
          preload="metadata"
          controls={isPlaying}
          playsInline
          className="h-full w-full object-contain"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          onError={() => setVideoError(true)}
        />
        {/* Show a placeholder pattern behind the video when no poster is set,
            so the user sees something instead of a black void while loading. */}
        {!creative.imageUrl && !isPlaying && (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            style={{
              background:
                'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
            }}
          >
            <div className="text-[10px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {PLATFORM_LABELS[creative.platform] ?? creative.platform} video
            </div>
          </div>
        )}
        {!isPlaying && (
          <button
            onClick={handlePlayClick}
            className="absolute inset-0 flex cursor-pointer items-center justify-center transition-all duration-200"
            style={{ background: 'rgba(0,0,0,0.35)' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.20)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.35)';
            }}
            aria-label="Play video"
          >
            <div
              className="flex h-11 w-11 items-center justify-center rounded-full transition-all duration-200"
              style={{ background: 'rgba(255,255,255,0.92)' }}
            >
              <Play className="ml-0.5 h-4 w-4 text-black" fill="black" />
            </div>
          </button>
        )}
      </div>
    );
  }

  // Image with proxy fallback on error.
  // Wave 6e Meta UX fix: wrap in a clickable link to detailsUrl when present,
  // so users can always click through to the source.
  const imgSrc = useProxy ? proxyUrl(creative.imageUrl!) : creative.imageUrl!;
  const imgEl = (
    <div
      className="relative aspect-[4/3] w-full overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.02)' }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imgSrc}
        alt={creative.headline ?? `${creative.advertiser} ad`}
        referrerPolicy="no-referrer"
        className="h-full w-full object-contain"
        onError={() => {
          if (!useProxy && shouldUseProxy(creative.imageUrl!)) {
            setUseProxy(true);
          } else {
            setImgError(true);
          }
        }}
      />
    </div>
  );

  if (creative.detailsUrl) {
    return (
      <a
        href={creative.detailsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group/media block transition-opacity hover:opacity-90"
        aria-label={`Open ${PLATFORM_LABELS[creative.platform] ?? creative.platform} ad in library`}
      >
        {imgEl}
      </a>
    );
  }
  return imgEl;
}

// ─── AdCreativeCard ──────────────────────────────────────────────────────────

function AdCreativeCard({ creative }: { creative: AdCreative }) {
  const platformColor = PLATFORM_COLORS[creative.platform] ?? 'rgba(255,255,255,0.4)';
  const platformLabel = PLATFORM_LABELS[creative.platform] ?? creative.platform;

  const hasDateInfo = creative.firstSeen || creative.lastSeen;

  return (
    <div
      className={cn(
        'flex min-w-[280px] max-w-[320px] flex-none snap-start flex-col overflow-hidden transition-all duration-200',
        'rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-white/20',
      )}
    >
      {/* Media section — always rendered */}
      <AdMedia creative={creative} />

      {/* Badge row */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 pt-3">
        {/* Platform badge */}
        <span
          className="rounded px-1.5 py-0.5 text-[11px] font-semibold"
          style={{
            background: `${platformColor}18`,
            color: platformColor,
            border: `1px solid ${platformColor}30`,
          }}
        >
          {platformLabel}
        </span>

        {/* Active badge */}
        {creative.isActive && (
          <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-medium text-emerald-400">
            Active
          </span>
        )}

        {/* Format badge */}
        {creative.format && creative.format !== 'unknown' && (
          <span
            className="rounded px-1.5 py-0.5 text-[11px] capitalize"
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.40)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {creative.format}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-1 px-3 pb-3 pt-2">
        {creative.headline && (
          <p
            className="line-clamp-2 text-sm font-medium leading-snug"
            style={{ color: 'var(--text-primary)' }}
            data-testid="creative-headline"
          >
            {creative.headline}
          </p>
        )}
        {creative.body && (
          <p
            className="line-clamp-2 text-xs leading-relaxed"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {creative.body}
          </p>
        )}

        {/* Footer: date + view link */}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          {hasDateInfo && (
            <p className="text-[11px] leading-tight" style={{ color: 'rgba(255,255,255,0.25)' }}>
              {creative.firstSeen && (
                <span>
                  {creative.lastSeen ? 'Running ' : 'Seen '}
                  {formatDate(creative.firstSeen)}
                </span>
              )}
              {creative.lastSeen && creative.firstSeen && (
                <span> – {formatDate(creative.lastSeen)}</span>
              )}
              {creative.lastSeen && !creative.firstSeen && (
                <span>Last seen {formatDate(creative.lastSeen)}</span>
              )}
            </p>
          )}

          {creative.detailsUrl && (
            <a
              href={creative.detailsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'ml-auto inline-flex cursor-pointer items-center gap-1 whitespace-nowrap text-xs transition-all duration-200',
              )}
              style={{ color: 'var(--accent-blue)' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.opacity = '0.75';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.opacity = '1';
              }}
            >
              View ad <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── LibraryLink ─────────────────────────────────────────────────────────────

function LibraryLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex cursor-pointer items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all duration-200',
        'rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-white/20 hover:bg-[var(--bg-hover)]',
      )}
      style={{ color: 'var(--text-secondary)' }}
      data-testid={`library-link-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {label} <ExternalLink className="h-3 w-3" />
    </a>
  );
}

// ─── CompetitorAdEvidence (container) ─────────────────────────────────────────

export function CompetitorAdEvidence({
  adActivity,
  adCreatives,
  libraryLinks,
}: CompetitorAdEvidenceProps) {
  // Deduplicate ads by content fingerprint (NOT by id — Meta assigns unique IDs to identical ads)
  const displayedCreatives = (() => {
    if (!adCreatives) return [];
    const seen = new Set<string>();
    return adCreatives.filter((c) => {
      const key = `${c.platform}|${(c.headline ?? '').slice(0, 80).toLowerCase()}|${(c.body ?? '').slice(0, 50).toLowerCase()}|${c.imageUrl ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 20);
  })();
  const hasCreatives = displayedCreatives.length > 0;
  const hasLinks =
    libraryLinks &&
    (libraryLinks.metaLibraryUrl ||
      libraryLinks.linkedInLibraryUrl ||
      libraryLinks.googleAdvertiserUrl);

  const [platformFilter, setPlatformFilter] = useState<string | null>(null);
  const [formatFilter, setFormatFilter] = useState<string | null>(null);

  // Derive available platforms and formats from the actual creatives
  const platforms = [...new Set(displayedCreatives.map((c) => c.platform))];
  const formats = [...new Set(displayedCreatives.map((c) => c.format).filter((f) => f && f !== 'unknown'))];

  // Apply filters
  const filteredCreatives = displayedCreatives.filter((c) => {
    if (platformFilter && c.platform !== platformFilter) return false;
    if (formatFilter && c.format !== formatFilter) return false;
    return true;
  });

  if (!hasCreatives && !hasLinks) {
    return null;
  }

  return (
    <div className="mt-3 min-w-0 space-y-3 overflow-hidden">
      {/* Summary strip */}
      {adActivity && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {adActivity.activeAdCount} ad{adActivity.activeAdCount !== 1 ? 's' : ''} observed
          </span>
          <span
            className={cn(
              'rounded px-1.5 py-0.5 text-[11px] font-medium',
              CONFIDENCE_STYLES[adActivity.sourceConfidence] ?? CONFIDENCE_STYLES.low,
            )}
          >
            {adActivity.sourceConfidence} confidence
          </span>
        </div>
      )}

      {/* Filter pills */}
      {hasCreatives && (platforms.length > 1 || formats.length > 1) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {/* "All" pill */}
          <button
            type="button"
            onClick={() => { setPlatformFilter(null); setFormatFilter(null); }}
            className={cn(
              'rounded-md px-2.5 py-1 text-[11px] font-medium transition-all duration-150 cursor-pointer border',
              !platformFilter && !formatFilter
                ? 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] border-[var(--accent-blue)]/30'
                : 'bg-transparent text-[var(--text-tertiary)] border-[var(--border-subtle)] hover:text-[var(--text-secondary)] hover:border-[var(--border-default)]',
            )}
          >
            All ({displayedCreatives.length})
          </button>

          {/* Platform pills */}
          {platforms.map((p) => {
            const color = PLATFORM_COLORS[p] ?? 'rgba(255,255,255,0.4)';
            const label = PLATFORM_LABELS[p] ?? p;
            const count = displayedCreatives.filter((c) => c.platform === p).length;
            const isActive = platformFilter === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => { setPlatformFilter(isActive ? null : p); setFormatFilter(null); }}
                className={cn(
                  'rounded-md px-2.5 py-1 text-[11px] font-medium transition-all duration-150 cursor-pointer border',
                  isActive
                    ? 'border-opacity-30'
                    : 'bg-transparent text-[var(--text-tertiary)] border-[var(--border-subtle)] hover:text-[var(--text-secondary)] hover:border-[var(--border-default)]',
                )}
                style={isActive ? { background: `${color}18`, color, borderColor: `${color}40` } : undefined}
              >
                {label} ({count})
              </button>
            );
          })}

          {/* Divider */}
          {formats.length > 1 && platforms.length > 1 && (
            <span className="h-3 w-px mx-0.5" style={{ background: 'var(--border-subtle)' }} />
          )}

          {/* Format pills */}
          {formats.length > 1 && formats.map((f) => {
            const count = displayedCreatives.filter((c) => c.format === f).length;
            const isActive = formatFilter === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => { setFormatFilter(isActive ? null : f); setPlatformFilter(null); }}
                className={cn(
                  'rounded-md px-2.5 py-1 text-[11px] font-medium capitalize transition-all duration-150 cursor-pointer border',
                  isActive
                    ? 'bg-white/10 text-[var(--text-primary)] border-white/20'
                    : 'bg-transparent text-[var(--text-tertiary)] border-[var(--border-subtle)] hover:text-[var(--text-secondary)] hover:border-[var(--border-default)]',
                )}
              >
                {f} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Horizontal scroll carousel */}
      {hasCreatives && (
        <div
          className="flex gap-3 overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch]"
          style={{
            scrollSnapType: 'x mandatory',
            scrollPaddingLeft: '0px',
          }}
        >
          {filteredCreatives.map((creative) => (
            <AdCreativeCard key={creative.id} creative={creative} />
          ))}
        </div>
      )}

      {/* Library links row */}
      {hasLinks && (
        <div className="flex flex-wrap gap-2">
          {libraryLinks.metaLibraryUrl && (
            <LibraryLink href={libraryLinks.metaLibraryUrl} label="Meta Library" />
          )}
          {libraryLinks.linkedInLibraryUrl && (
            <LibraryLink href={libraryLinks.linkedInLibraryUrl} label="LinkedIn Ads" />
          )}
          {libraryLinks.googleAdvertiserUrl && (
            <LibraryLink href={libraryLinks.googleAdvertiserUrl} label="Google Ads" />
          )}
        </div>
      )}
    </div>
  );
}
