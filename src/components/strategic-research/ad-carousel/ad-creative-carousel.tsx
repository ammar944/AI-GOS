"use client";

import * as React from "react";
import { ImageOff } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import type { AdPlatform, AdFormat } from "@/lib/ad-library";
import type { EnrichedAdCreative } from "@/lib/foreplay/types";
import {
  ALL_PLATFORMS,
  ALL_FORMATS,
  getRelevanceLevel,
  PLATFORM_COLORS,
  PLATFORM_LABELS,
  FORMAT_LABELS,
  type RelevanceFilter,
  type SourceFilter,
} from "./constants";
import { CarouselNavigation } from "./carousel-navigation";
import { AdCreativeCard } from "./ad-creative-card";

interface AdCreativeCarouselProps {
  ads: EnrichedAdCreative[];
  className?: string;
}

export function AdCreativeCarousel({ ads, className }: AdCreativeCarouselProps) {
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const [enabledPlatforms, setEnabledPlatforms] = React.useState<Set<AdPlatform>>(
    new Set(ALL_PLATFORMS)
  );
  const [enabledFormats, setEnabledFormats] = React.useState<Set<AdFormat>>(
    new Set([...ALL_FORMATS, "unknown"])
  );
  const [relevanceFilter, setRelevanceFilter] = React.useState<RelevanceFilter>('all');
  const [sourceFilter, setSourceFilter] = React.useState<SourceFilter>('all');

  // Stop pointerdown from bubbling to the parent SwipeableCompetitorCard's
  // Framer Motion pan handler. FM uses a native pointerdown listener on the
  // motion.div — if we prevent the event from reaching it, FM won't create
  // a PanSession and Embla can handle the drag. Embla uses mousedown/touchstart
  // (not pointerdown), so it's unaffected by this.
  React.useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const stopPointerDown = (e: PointerEvent) => e.stopPropagation();
    el.addEventListener("pointerdown", stopPointerDown);
    return () => el.removeEventListener("pointerdown", stopPointerDown);
  }, []);

  // Get available platforms
  const availablePlatforms = React.useMemo(() => {
    if (!ads || ads.length === 0) return [];
    const platforms = new Set(ads.map(ad => ad.platform));
    return ALL_PLATFORMS.filter(p => platforms.has(p));
  }, [ads]);

  // Get available formats
  const availableFormats = React.useMemo(() => {
    if (!ads || ads.length === 0) return [];
    const formats = new Set(ads.map(ad => ad.format));
    return ALL_FORMATS.filter(f => formats.has(f));
  }, [ads]);

  // Count ads by relevance level
  const relevanceCounts = React.useMemo(() => {
    if (!ads || ads.length === 0) return { high: 0, medium: 0, low: 0 };
    return ads.reduce((acc, ad) => {
      const level = getRelevanceLevel(ad.relevance?.score ?? 50);
      if (level === 'high') acc.high++;
      else if (level === 'medium') acc.medium++;
      else if (level === 'low') acc.low++;
      return acc;
    }, { high: 0, medium: 0, low: 0 });
  }, [ads]);

  // Check if any ads have relevance scoring
  const hasRelevanceData = React.useMemo(() => {
    return ads?.some(ad => ad.relevance !== undefined) ?? false;
  }, [ads]);

  // Count enriched and foreplay-sourced ads
  const enrichedCount = React.useMemo(() => {
    return ads?.filter(ad => ad.foreplay !== undefined).length ?? 0;
  }, [ads]);

  const foreplaySourcedCount = React.useMemo(() => {
    return ads?.filter(ad => ad.source === 'foreplay').length ?? 0;
  }, [ads]);

  const hasSourceFilters = enrichedCount > 0 || foreplaySourcedCount > 0;

  // Filter ads
  const filteredAds = React.useMemo(() => {
    if (!ads || ads.length === 0) return [];
    return ads.filter(ad => {
      const matchesPlatform = enabledPlatforms.has(ad.platform);
      const matchesFormat = enabledFormats.has(ad.format);
      const adRelevance = getRelevanceLevel(ad.relevance?.score ?? 50);
      const matchesRelevance = relevanceFilter === 'all' || adRelevance === relevanceFilter;
      const matchesSource = sourceFilter === 'all'
        || (sourceFilter === 'enriched' && ad.foreplay !== undefined)
        || (sourceFilter === 'foreplay-sourced' && ad.source === 'foreplay');
      return matchesPlatform && matchesFormat && matchesRelevance && matchesSource;
    });
  }, [ads, enabledPlatforms, enabledFormats, relevanceFilter, sourceFilter]);

  if (!ads || ads.length === 0) {
    return null;
  }

  const togglePlatform = (platform: AdPlatform) => {
    setEnabledPlatforms(prev => {
      const next = new Set(prev);
      if (next.has(platform)) {
        if (next.size > 1) {
          next.delete(platform);
        }
      } else {
        next.add(platform);
      }
      return next;
    });
  };

  const toggleFormat = (format: AdFormat) => {
    setEnabledFormats(prev => {
      const next = new Set(prev);
      if (next.has(format)) {
        if (next.size > 1) {
          next.delete(format);
        }
      } else {
        next.add(format);
      }
      return next;
    });
  };

  const showPlatformFilters = availablePlatforms.length > 1;
  const showFormatFilters = availableFormats.length > 1;
  const showRelevanceFilters = hasRelevanceData && (relevanceCounts.high > 0 || relevanceCounts.low > 0);

  return (
    <div ref={wrapperRef} data-ad-carousel className={cn("w-full max-w-2xl mx-auto space-y-4", className)} style={{ overscrollBehaviorX: 'contain' }}>
      {/* Filters Section */}
      <div
        className="rounded-2xl p-4"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-default)',
          borderWidth: '1px'
        }}
      >
        <div className="flex flex-wrap items-center gap-2">
          {/* Platform Filters */}
          {showPlatformFilters && (
            <>
              {availablePlatforms.map(platform => {
                const isActive = enabledPlatforms.has(platform);
                const platformColor = PLATFORM_COLORS[platform];
                return (
                  <button
                    key={platform}
                    onClick={() => togglePlatform(platform)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                      isActive
                        ? cn(platformColor.solid, "text-white shadow-sm")
                        : "bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                    )}
                  >
                    {PLATFORM_LABELS[platform]}
                  </button>
                );
              })}
              <div className="h-5 w-px mx-1" style={{ backgroundColor: 'var(--border-default)' }} />
            </>
          )}

          {/* Format Filters */}
          {showFormatFilters && (
            <>
              {availableFormats.map(format => {
                const isActive = enabledFormats.has(format);
                return (
                  <button
                    key={format}
                    onClick={() => toggleFormat(format)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                      isActive
                        ? "bg-[var(--accent-blue)] text-white shadow-sm"
                        : "bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                    )}
                  >
                    {FORMAT_LABELS[format]}
                  </button>
                );
              })}
              <div className="h-5 w-px mx-1" style={{ backgroundColor: 'var(--border-default)' }} />
            </>
          )}

          {/* Relevance Filters */}
          {showRelevanceFilters && (
            <>
              {(['all', 'high', 'medium', 'low'] as const).map(level => {
                const isActive = relevanceFilter === level;
                const count = level === 'all' ? ads.length : relevanceCounts[level];
                const colorClass = level === 'high' ? 'bg-green-600' :
                                  level === 'medium' ? 'bg-amber-600' :
                                  level === 'low' ? 'bg-red-600' : 'bg-[var(--accent-blue)]';
                return (
                  <button
                    key={level}
                    onClick={() => setRelevanceFilter(level)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                      isActive
                        ? cn(colorClass, "text-white shadow-sm")
                        : "bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                    )}
                  >
                    {level === 'all' ? 'All' : level.charAt(0).toUpperCase() + level.slice(1)} ({count})
                  </button>
                );
              })}
              <div className="h-5 w-px mx-1" style={{ backgroundColor: 'var(--border-default)' }} />
            </>
          )}

          {/* Source Filters */}
          {hasSourceFilters && (
            <>
              {([
                { key: 'all' as const, label: 'All Sources', count: ads.length },
                { key: 'enriched' as const, label: 'Enriched', count: enrichedCount },
                { key: 'foreplay-sourced' as const, label: 'Foreplay', count: foreplaySourcedCount },
              ]).filter(item => item.key === 'all' || item.count > 0).map(({ key, label, count }) => {
                const isActive = sourceFilter === key;
                const colorClass = key === 'foreplay-sourced' ? 'bg-cyan-600' : 'bg-primary';
                return (
                  <button
                    key={key}
                    onClick={() => setSourceFilter(key)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                      isActive
                        ? cn(key === 'all' ? 'bg-[var(--accent-blue)]' : colorClass, "text-white shadow-sm")
                        : "bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                    )}
                  >
                    {label} ({count})
                  </button>
                );
              })}
            </>
          )}

          {/* Results count - pushed to end */}
          <div className="ml-auto text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
            {filteredAds.length} of {ads.length}
          </div>
        </div>
      </div>

      {/* Carousel */}
      {filteredAds.length === 0 ? (
        <div
          className="text-center py-16 rounded-2xl"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-default)',
            borderWidth: '1px'
          }}
        >
          <ImageOff className="h-12 w-12 mx-auto mb-3" style={{ color: 'var(--text-quaternary)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            No ads match the selected filters
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
            Try adjusting your filter criteria
          </p>
        </div>
      ) : (
        <Carousel
          opts={{
            align: "center",
            loop: filteredAds.length > 1,
            containScroll: "trimSnaps",
          }}
          className="w-full"
        >
          <CarouselContent className="-ml-4">
            {filteredAds.map((ad, index) => (
              <CarouselItem key={ad.id || index} className="pl-4">
                <AdCreativeCard ad={ad} />
              </CarouselItem>
            ))}
          </CarouselContent>

          {/* Navigation - only show if more than one ad */}
          {filteredAds.length > 1 && (
            <CarouselNavigation total={filteredAds.length} />
          )}
        </Carousel>
      )}
    </div>
  );
}

export default AdCreativeCarousel;
