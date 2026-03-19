'use client';

import { useMemo } from 'react';
import { StatGrid, type StatItem } from './stat-grid';
import { BulletList } from './bullet-list';
import { AdCreativeCarousel } from '@/components/strategic-research/ad-carousel/ad-creative-carousel';
import { CompetitorAdEvidence } from '@/components/journey/competitor-ad-evidence';
import type { EnrichedAdCreative } from '@/lib/foreplay/types';

interface CompetitorCardProps {
  name: string;
  website?: string;
  positioning?: string;
  price?: string;
  pricingConfidence?: string;
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
  const priceStats: StatItem[] = [
    ...(price ? [{ label: 'Price', value: price }] : []),
    ...(pricingConfidence ? [{ label: 'Pricing Confidence', value: pricingConfidence }] : []),
  ];

  // Convert workspace ad creatives (simple type) to EnrichedAdCreative for the
  // AdCreativeCarousel which provides platform/format filter UI.
  // rawData is required by AdCreative but unused by the carousel's filter logic.
  const enrichedCreatives = useMemo<EnrichedAdCreative[]>(() => {
    if (!adCreatives || adCreatives.length === 0) return [];
    return adCreatives.map((ad) => ({
      ...ad,
      rawData: null,
    }));
  }, [adCreatives]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">{name}</h3>
          {website && (
            <p className="mt-1 text-xs font-mono text-[var(--text-tertiary)]">{website}</p>
          )}
          {positioning && (
            <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">{positioning}</p>
          )}
        </div>
        {priceStats.length > 0 && (
          <div className="shrink-0">
            <StatGrid stats={priceStats} columns={2} />
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

      {/* Ad Creatives — full carousel with platform/format filters, capped height */}
      {enrichedCreatives.length > 0 && (
        <div className="max-h-[340px] overflow-y-auto">
          <AdCreativeCarousel ads={enrichedCreatives} className="max-w-full" />
        </div>
      )}

      {/* Library Links (shown when no creatives or as supplementary links) */}
      {(libraryLinks?.metaLibraryUrl || libraryLinks?.linkedInLibraryUrl || libraryLinks?.googleAdvertiserUrl) && (
        <CompetitorAdEvidence
          adActivity={enrichedCreatives.length === 0 ? adActivity : undefined}
          adCreatives={[]}
          libraryLinks={libraryLinks}
        />
      )}

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
