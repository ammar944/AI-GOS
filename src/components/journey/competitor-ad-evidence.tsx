'use client';

import { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
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

/** Domains that need proxying through /api/image-proxy for CORS */
const PROXY_DOMAINS = [
  'googlesyndication.com',
  'googleusercontent.com',
  'storage.googleapis.com',
  'firebasestorage.googleapis.com',
  'fbcdn.net',
  'licdn.com',
];

function shouldProxy(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return PROXY_DOMAINS.some((d) => hostname.includes(d));
  } catch {
    return false;
  }
}

function proxyUrl(url: string): string {
  if (shouldProxy(url)) {
    return `/api/image-proxy?url=${encodeURIComponent(url)}`;
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

function AdMedia({ creative }: { creative: AdCreative }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [useProxy, setUseProxy] = useState(false);

  const hasVideo = !!creative.videoUrl && !videoError;
  const hasImage = !!creative.imageUrl && !imgError;

  // No media at all — placeholder
  if (!hasVideo && !hasImage) {
    return (
      <div
        className="flex aspect-[4/3] w-full items-center justify-center"
        style={{ background: 'rgba(255,255,255,0.02)' }}
      >
        <ImageOff className="h-6 w-6" style={{ color: 'rgba(255,255,255,0.15)' }} />
      </div>
    );
  }

  // Video with play overlay
  if (hasVideo) {
    return (
      <div className="relative aspect-[4/3] w-full bg-black">
        <video
          ref={videoRef}
          src={creative.videoUrl}
          poster={creative.imageUrl ? proxyUrl(creative.imageUrl) : undefined}
          preload="metadata"
          controls={isPlaying}
          className="h-full w-full object-contain"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          onError={() => setVideoError(true)}
        />
        {!isPlaying && (
          <button
            onClick={() => videoRef.current?.play()}
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

  // Image with proxy fallback on error
  const imgSrc = useProxy ? proxyUrl(creative.imageUrl!) : creative.imageUrl!;
  return (
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
          if (!useProxy && shouldProxy(creative.imageUrl!)) {
            setUseProxy(true);
          } else {
            setImgError(true);
          }
        }}
      />
    </div>
  );
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
        'rounded-[var(--radius-lg)] border border-white/10 bg-[var(--bg-surface)] hover:border-white/20',
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
        'rounded-[var(--radius-md)] border border-white/10 bg-[var(--bg-surface)] hover:border-white/20 hover:bg-[var(--bg-hover)]',
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
  const displayedCreatives = adCreatives ? adCreatives.slice(0, 20) : [];
  const hasCreatives = displayedCreatives.length > 0;
  const hasLinks =
    libraryLinks &&
    (libraryLinks.metaLibraryUrl ||
      libraryLinks.linkedInLibraryUrl ||
      libraryLinks.googleAdvertiserUrl);

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

      {/* Horizontal scroll carousel */}
      {hasCreatives && (
        <div
          className="flex gap-3 overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch]"
          style={{
            scrollSnapType: 'x mandatory',
            scrollPaddingLeft: '0px',
          }}
        >
          {displayedCreatives.map((creative) => (
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
