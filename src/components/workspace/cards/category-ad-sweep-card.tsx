'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { shouldUseProxy, getProxyUrl } from '@/lib/image-proxy';
import { ExternalLink, ImageOff } from 'lucide-react';

interface CategoryAd {
  source: 'meta' | 'google';
  keyword: string;
  advertiser: string;
  headline: string;
  body: string;
  landingPage?: string | null;
  imageUrl?: string | null;
  detailsUrl?: string | null;
}

interface CategoryAdSweepCardProps {
  ads: CategoryAd[];
  keywordsProbed: string[];
  sources: { meta: number; google: number };
}

const SOURCE_LABEL: Record<string, string> = {
  meta: 'Meta',
  google: 'Google',
};

function proxy(url: string | null | undefined): string | null {
  if (!url) return null;
  return shouldUseProxy(url) ? getProxyUrl(url) : url;
}

export function CategoryAdSweepCard({ ads, keywordsProbed, sources }: CategoryAdSweepCardProps) {
  const keywords = useMemo(() => {
    const seen = new Set<string>();
    for (const ad of ads) {
      if (ad.keyword && !seen.has(ad.keyword)) seen.add(ad.keyword);
    }
    return ['__all__', ...Array.from(seen)];
  }, [ads]);

  const [activeKw, setActiveKw] = useState<string>('__all__');

  const filtered = useMemo(
    () => (activeKw === '__all__' ? ads : ads.filter((a) => a.keyword === activeKw)),
    [ads, activeKw],
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-[var(--text-primary)]">Category Ads</h3>
        <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
          Ads surfaced across the whole market by category keywords — not scoped to the five
          selected competitors. Useful for spotting adjacent advertisers (e.g. Lovable, Aura)
          running on the same terms.
        </p>
        <div className="mt-2 flex items-center gap-3 text-[11px] font-mono text-[var(--text-tertiary)] uppercase tracking-[0.06em]">
          <span>{ads.length} ads</span>
          <span>·</span>
          <span>{keywordsProbed.length} keywords probed</span>
          <span>·</span>
          <span>Meta {sources.meta}</span>
          <span>·</span>
          <span>Google {sources.google}</span>
        </div>
      </div>

      {/* Keyword filter chips */}
      {keywords.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {keywords.map((kw) => (
            <button
              key={kw}
              type="button"
              onClick={() => setActiveKw(kw)}
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] font-mono transition-colors cursor-pointer',
                activeKw === kw
                  ? 'text-[var(--text-primary)]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]',
              )}
              style={
                activeKw === kw
                  ? {
                      background: 'var(--bg-hover)',
                      border: '1px solid var(--border-default)',
                    }
                  : { border: '1px solid var(--border-subtle)' }
              }
            >
              {kw === '__all__' ? `All (${ads.length})` : kw}
            </button>
          ))}
        </div>
      )}

      {/* Ads grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {filtered.map((ad, idx) => (
          <AdTile key={`${ad.advertiser}-${idx}`} ad={ad} />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-[var(--text-tertiary)]">
          No ads surfaced for this keyword.
        </p>
      )}
    </div>
  );
}

function AdTile({ ad }: { ad: CategoryAd }) {
  const [imgError, setImgError] = useState(false);
  const image = proxy(ad.imageUrl);
  const detailLink = ad.detailsUrl ?? ad.landingPage ?? undefined;

  return (
    <div className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium text-[var(--text-primary)]">
          {ad.advertiser}
        </span>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-mono font-medium uppercase tracking-[0.06em]"
          style={{
            background: 'var(--bg-hover)',
            color: 'var(--text-secondary)',
          }}
        >
          {SOURCE_LABEL[ad.source] ?? ad.source}
        </span>
      </div>

      {image && !imgError && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt={ad.headline || ad.advertiser}
          className="mb-2 h-28 w-full rounded-[var(--radius-md)] object-cover"
          onError={() => setImgError(true)}
        />
      )}
      {image && imgError && (
        <div className="mb-2 flex h-28 w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--bg-hover)] text-[var(--text-quaternary)]">
          <ImageOff className="h-4 w-4" />
        </div>
      )}

      {ad.headline && (
        <p className="mb-1 text-sm font-medium leading-snug text-[var(--text-primary)]">
          {ad.headline}
        </p>
      )}
      {ad.body && (
        <p className="mb-2 line-clamp-3 text-xs leading-relaxed text-[var(--text-secondary)]">
          {ad.body}
        </p>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 pt-2">
        <span
          className="truncate text-[10px] font-mono uppercase tracking-[0.06em]"
          style={{ color: 'var(--text-quaternary)' }}
        >
          {ad.keyword}
        </span>
        {detailLink && (
          <a
            href={detailLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1 text-[10px] font-mono hover:underline"
            style={{ color: 'var(--text-secondary)' }}
          >
            View
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </div>
    </div>
  );
}
