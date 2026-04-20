'use client';

import { cn } from '@/lib/utils';
import { BulletList } from './bullet-list';
import { CompetitorAdEvidence } from '@/components/journey/competitor-ad-evidence';

interface CompetitorCardProps {
  name: string;
  website?: string;
  positioning?: string;
  price?: string;
  pricingConfidence?: string;
  pricingSourceUrl?: string;
  pricingTiers?: Array<{ name: string; price: string; description?: string }>;
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

const CONFIDENCE_COLOR: Record<string, string> = {
  high: 'var(--accent-green)',
  medium: 'var(--accent-amber)',
  low: 'var(--accent-red)',
};

export function CompetitorCard({
  name,
  website,
  positioning,
  price,
  pricingConfidence,
  pricingSourceUrl,
  pricingTiers,
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
  const hasTiers = Array.isArray(pricingTiers) && pricingTiers.length > 0;
  const hasRealPricing =
    !hasTiers &&
    !!price &&
    price !== 'null' &&
    !price.toLowerCase().includes('see pricing') &&
    /\$\d+/.test(price);
  const hasPricing = hasTiers || hasRealPricing;

  return (
    <div className="space-y-4">
      {/* Header — name, website, positioning only */}
      <div>
        <h3 className="text-base font-semibold text-[var(--text-primary)]">{name}</h3>
        {website && (
          <a
            href={website.startsWith('http') ? website : `https://${website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs font-mono hover:underline"
            style={{ color: 'var(--text-secondary)' }}
          >
            {website}
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
              />
            </svg>
          </a>
        )}
        {positioning && (
          <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
            {positioning}
          </p>
        )}
      </div>

      {/* Pricing Section — dedicated area below header */}
      {hasPricing && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-[var(--text-tertiary)] uppercase tracking-[0.06em]">
              Pricing
            </span>
            {pricingConfidence && (
              <span
                className="text-[10px] font-mono font-medium rounded-full px-2 py-0.5"
                style={{
                  color: CONFIDENCE_COLOR[pricingConfidence] ?? 'var(--text-tertiary)',
                  backgroundColor: `color-mix(in srgb, ${CONFIDENCE_COLOR[pricingConfidence] ?? 'var(--text-tertiary)'} 10%, transparent)`,
                }}
              >
                {pricingConfidence}
              </span>
            )}
          </div>

          {hasTiers ? (
            /* Pricing tiers as a clean table */
            <div className="w-full">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className="text-[10px] font-mono font-medium text-[var(--text-quaternary)] uppercase tracking-[0.06em] pb-2 pr-4">
                      Tier
                    </th>
                    <th className="text-[10px] font-mono font-medium text-[var(--text-quaternary)] uppercase tracking-[0.06em] pb-2 pr-4">
                      Price
                    </th>
                    <th className="text-[10px] font-mono font-medium text-[var(--text-quaternary)] uppercase tracking-[0.06em] pb-2">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pricingTiers!.map((tier) => (
                    <tr
                      key={tier.name}
                      className="hover:bg-[var(--bg-hover)] transition-colors duration-150"
                    >
                      <td className="py-2 pr-4 text-sm font-medium text-[var(--text-primary)]">
                        {tier.name}
                      </td>
                      <td className="py-2 pr-4 font-mono tabular-nums text-sm text-[var(--text-primary)]">
                        {tier.price}
                      </td>
                      <td className="py-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                        {tier.description ?? '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* Single price — inline stat */
            <p className="font-mono tabular-nums text-sm font-medium text-[var(--text-primary)]">
              {price}
            </p>
          )}

          {pricingSourceUrl && (
            <a
              href={
                pricingSourceUrl.startsWith('http')
                  ? pricingSourceUrl
                  : `https://${pricingSourceUrl}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-mono hover:underline"
              style={{ color: 'var(--text-secondary)' }}
            >
              View pricing source
              <svg
                className="h-2.5 w-2.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                />
              </svg>
            </a>
          )}
        </div>
      )}

      {/* Strengths / Weaknesses — 2-column grid */}
      {(strengths.length > 0 || weaknesses.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {strengths.length > 0 && (
            <BulletList title="Strengths" items={strengths} accent="var(--accent-green)" />
          )}
          {weaknesses.length > 0 && (
            <BulletList title="Weaknesses" items={weaknesses} accent="var(--accent-red)" />
          )}
        </div>
      )}

      {/* Opportunities — full width, amber accent */}
      {opportunities.length > 0 && (
        <BulletList title="Opportunities" items={opportunities} accent="var(--accent-amber)" />
      )}

      {/* Top Ad Hooks — callout block with 2px left accent */}
      {topAdHooks.length > 0 && (
        <div className="border-l border-[var(--border-default)] pl-4">
          <BulletList title="Top Ad Hooks" items={topAdHooks} accent="var(--text-secondary)" />
        </div>
      )}

      {/* Our Advantage — callout block */}
      {ourAdvantage && (
        <div className="border-l border-[var(--border-default)] pl-4">
          <h4 className="text-[11px] font-mono text-[var(--text-tertiary)] uppercase tracking-[0.06em] mb-2">
            {`Our Advantage vs ${name}`}
          </h4>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{ourAdvantage}</p>
        </div>
      )}

      {/* Ad Activity — standard card surface, no glass-surface */}
      {adActivity && (
        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] p-4 space-y-3">
          <h4 className="text-[11px] font-mono text-[var(--text-tertiary)] uppercase tracking-[0.06em]">
            Ad Activity
          </h4>

          {/* Active Ads count + platforms inline */}
          <div className="flex items-center flex-wrap gap-3">
            <span className="font-mono tabular-nums text-xl font-semibold text-[var(--text-primary)]">
              {adActivity.activeAdCount}
            </span>
            <span className="text-[11px] font-mono text-[var(--text-tertiary)] uppercase tracking-[0.06em]">
              Active Ads
            </span>
            {adActivity.platforms.length > 0 && (
              <div className="flex items-center flex-wrap gap-1.5 ml-auto">
                {adActivity.platforms.map((platform) => (
                  <span
                    key={platform}
                    className="text-[10px] font-mono font-medium rounded-full px-2 py-0.5 bg-[var(--bg-hover)] text-[var(--text-secondary)]"
                  >
                    {platform}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Themes — callout style with 2px left accent, no bg */}
          {adActivity.themes.length > 0 && (
            <div className="border-l border-[var(--border-default)] pl-3">
              <span className="text-[11px] font-mono text-[var(--text-tertiary)] uppercase tracking-[0.06em] block mb-1">
                Themes
              </span>
              <ul className="space-y-1">
                {adActivity.themes.map((theme) => (
                  <li
                    key={theme}
                    className="text-sm leading-relaxed text-[var(--text-secondary)]"
                  >
                    {theme}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Evidence */}
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

      {/* Counter Positioning — callout block */}
      {counterPositioning && (
        <div className="border-l border-[var(--border-default)] pl-4">
          <h4 className="text-[11px] font-mono text-[var(--text-tertiary)] uppercase tracking-[0.06em] mb-2">
            Counter Positioning
          </h4>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            {counterPositioning}
          </p>
        </div>
      )}
    </div>
  );
}
