'use client';

import { cn } from '@/lib/utils';
import { StatGrid, type StatItem } from './stat-grid';
import { BulletList } from './bullet-list';
import { CompetitorAdEvidence } from '@/components/journey/competitor-ad-evidence';

interface CompetitorCardProps {
  name: string;
  website?: string;
  positioning?: string;
  price?: string;
  pricingConfidence?: string;
  pricingSourceUrl?: string;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  ourAdvantage?: string;
  adActivity?: {
    activeAdCount: number;
    platforms: string[];
    themes: string[];
    evidence: string;
    sourceConfidence: 'high' | 'medium' | 'low';
  };
  adCreatives?: Array<{
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
  }>;
  libraryLinks?: {
    metaLibraryUrl?: string;
    linkedInLibraryUrl?: string;
    googleAdvertiserUrl?: string;
  };
  topAdHooks: string[];
  counterPositioning?: string;
}

export function CompetitorCard({
  name,
  website,
  positioning,
  price,
  pricingConfidence,
  pricingSourceUrl,
  strengths,
  weaknesses,
  opportunities,
  ourAdvantage,
  adActivity,
  adCreatives,
  libraryLinks,
  topAdHooks,
  counterPositioning,
}: CompetitorCardProps) {
  // Only show pricing if we have a real source URL (crawled data, not "See pricing page" placeholders)
  const hasCrawledPricing = !!pricingSourceUrl && !!price && !price.toLowerCase().includes('see pricing');
  const priceStats: StatItem[] = hasCrawledPricing ? [{ label: 'Price', value: price! }] : [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">{name}</h3>
          {website && (
            <a
              href={website.startsWith('http') ? website : `https://${website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs font-mono hover:underline"
              style={{ color: 'var(--accent-blue)' }}
            >
              {website}
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          )}
          {positioning && (
            <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">{positioning}</p>
          )}
        </div>
        {priceStats.length > 0 && (
          <div className="shrink-0 flex flex-col items-end gap-1">
            <StatGrid stats={priceStats} columns={2} />
            {pricingSourceUrl && (
              <a
                href={pricingSourceUrl.startsWith('http') ? pricingSourceUrl : `https://${pricingSourceUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-mono text-[10px] hover:underline"
                style={{ color: 'var(--accent-blue)' }}
              >
                View pricing source
                <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </a>
            )}
          </div>
        )}
      </div>

      {/* S/W/O Lists */}
      <BulletList title="Strengths" items={strengths} accent="var(--accent-green)" />
      <BulletList title="Weaknesses" items={weaknesses} accent="var(--accent-red)" />
      <BulletList title="Opportunities" items={opportunities} accent="var(--accent-blue)" />
      <BulletList title="Top Ad Hooks" items={topAdHooks} accent="var(--accent-cyan)" />

      {/* Our Advantage */}
      {ourAdvantage && (
        <div>
          <h4 className="text-xs font-mono text-[var(--text-tertiary)] uppercase tracking-widest mb-2">
            {`Our Advantage vs ${name}`}
          </h4>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{ourAdvantage}</p>
        </div>
      )}

      {/* Ad Activity */}
      {adActivity && (
        <div className="glass-surface rounded-[var(--radius-md)] p-3 space-y-2">
          <h4 className="text-xs font-mono text-[var(--text-tertiary)] uppercase tracking-widest">
            Ad Activity
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <StatGrid
              stats={[
                { label: 'Active Ads', value: String(adActivity.activeAdCount) },
                { label: 'Coverage', value: adActivity.sourceConfidence },
              ]}
              columns={2}
            />
          </div>
          <BulletList title="Platforms" items={adActivity.platforms} accent="var(--accent-cyan)" />
          <BulletList title="Themes" items={adActivity.themes} accent="var(--accent-blue)" />
          {adActivity.evidence && (
            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
              {adActivity.evidence}
            </p>
          )}
        </div>
      )}

      {/* Ad Creatives + Library Links */}
      <CompetitorAdEvidence
        adActivity={adActivity}
        adCreatives={adCreatives}
        libraryLinks={libraryLinks}
      />

      {/* Counter Positioning */}
      {counterPositioning && (
        <div>
          <h4 className="text-xs font-mono text-[var(--text-tertiary)] uppercase tracking-widest mb-2">
            Counter Positioning
          </h4>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{counterPositioning}</p>
        </div>
      )}
    </div>
  );
}
