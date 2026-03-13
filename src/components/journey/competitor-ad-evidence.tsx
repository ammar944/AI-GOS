'use client';

import { cn } from '@/lib/utils';
import { ExternalLink } from 'lucide-react';

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

const PLATFORM_LABELS: Record<string, string> = {
  meta: 'Meta',
  linkedin: 'LinkedIn',
  google: 'Google',
};

const CONFIDENCE_STYLES: Record<string, string> = {
  high: 'bg-emerald-500/10 text-emerald-400',
  medium: 'bg-amber-500/10 text-amber-400',
  low: 'bg-red-500/10 text-red-400',
};

function CreativeCard({ creative }: { creative: AdCreative }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div className="mb-1 flex items-center gap-2">
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] font-medium text-white/60">
          {PLATFORM_LABELS[creative.platform] ?? creative.platform}
        </span>
        {creative.isActive && (
          <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-medium text-emerald-400">
            Active
          </span>
        )}
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] text-white/40">
          {creative.format}
        </span>
      </div>
      {creative.headline && (
        <p className="mt-1 text-sm font-medium text-white/80" data-testid="creative-headline">
          {creative.headline}
        </p>
      )}
      {creative.body && (
        <p className="mt-0.5 text-xs text-white/50 line-clamp-2">{creative.body}</p>
      )}
      {creative.detailsUrl && (
        <a
          href={creative.detailsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
        >
          View ad <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

function LibraryLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white/90"
      data-testid={`library-link-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {label} <ExternalLink className="h-3 w-3" />
    </a>
  );
}

export function CompetitorAdEvidence({
  adActivity,
  adCreatives,
  libraryLinks,
}: CompetitorAdEvidenceProps) {
  const hasCreatives = adCreatives && adCreatives.length > 0;
  const hasLinks =
    libraryLinks &&
    (libraryLinks.metaLibraryUrl ||
      libraryLinks.linkedInLibraryUrl ||
      libraryLinks.googleAdvertiserUrl);

  if (!hasCreatives && !hasLinks) {
    return null;
  }

  return (
    <div className="mt-3 space-y-3">
      {adActivity && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-white/50">
          <span>
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

      {hasCreatives && (
        <div className="grid gap-2 sm:grid-cols-2">
          {adCreatives.map((creative) => (
            <CreativeCard key={creative.id} creative={creative} />
          ))}
        </div>
      )}

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
