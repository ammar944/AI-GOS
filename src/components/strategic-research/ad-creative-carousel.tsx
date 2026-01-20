"use client";

import * as React from "react";
import { ImageOff, ExternalLink, Info, Play, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  useCarousel,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import type { AdCreative, AdPlatform, AdFormat } from "@/lib/ad-library";

const ALL_PLATFORMS: AdPlatform[] = ["linkedin", "meta", "google"];
const ALL_FORMATS: AdFormat[] = ["video", "image", "carousel"];

const FORMAT_LABELS: Record<AdFormat, string> = {
  video: "Video",
  image: "Image",
  carousel: "Carousel",
  unknown: "Other",
};

// =============================================================================
// Creative Type (Format) Colors
// =============================================================================

const FORMAT_COLORS: Record<AdFormat, { bg: string; text: string }> = {
  video: { bg: "bg-purple-600", text: "text-white" },
  image: { bg: "bg-teal-600", text: "text-white" },
  carousel: { bg: "bg-amber-600", text: "text-white" },
  unknown: { bg: "bg-slate-500", text: "text-white" },
};

// =============================================================================
// Platform Badge Colors
// =============================================================================

const PLATFORM_COLORS: Record<AdPlatform, { bg: string; text: string }> = {
  linkedin: { bg: "bg-[#0A66C2]", text: "text-white" },
  meta: { bg: "bg-[#1877F2]", text: "text-white" },
  google: { bg: "bg-[#4285F4]", text: "text-white" },
};

const PLATFORM_LABELS: Record<AdPlatform, string> = {
  linkedin: "LinkedIn",
  meta: "Meta",
  google: "Google",
};

// =============================================================================
// Slide Counter Component (inside carousel context)
// =============================================================================

function SlideCounter({ total }: { total: number }) {
  const { selectedIndex } = useCarousel();

  return (
    <div
      className="absolute bottom-2 right-2 text-xs px-2 py-1 rounded backdrop-blur-sm"
      style={{
        backgroundColor: 'rgba(12, 14, 19, 0.8)',
        color: 'var(--text-heading)',
        borderColor: 'var(--border-default)',
        borderWidth: '1px'
      }}
    >
      {selectedIndex + 1} of {total}
    </div>
  );
}

// =============================================================================
// AdCreativeCarousel Component
// =============================================================================

interface AdCreativeCarouselProps {
  ads: AdCreative[];
  className?: string;
}

export function AdCreativeCarousel({ ads, className }: AdCreativeCarouselProps) {
  const [enabledPlatforms, setEnabledPlatforms] = React.useState<Set<AdPlatform>>(
    new Set(ALL_PLATFORMS)
  );
  const [enabledFormats, setEnabledFormats] = React.useState<Set<AdFormat>>(
    new Set([...ALL_FORMATS, "unknown"])
  );

  // Get unique platforms that have ads (must be before early return for hooks rules)
  const availablePlatforms = React.useMemo(() => {
    if (!ads || ads.length === 0) return [];
    const platforms = new Set(ads.map(ad => ad.platform));
    return ALL_PLATFORMS.filter(p => platforms.has(p));
  }, [ads]);

  // Get unique formats that have ads
  const availableFormats = React.useMemo(() => {
    if (!ads || ads.length === 0) return [];
    const formats = new Set(ads.map(ad => ad.format));
    return ALL_FORMATS.filter(f => formats.has(f));
  }, [ads]);

  // Filter ads by enabled platforms and formats
  const filteredAds = React.useMemo(() => {
    if (!ads || ads.length === 0) return [];
    return ads.filter(ad =>
      enabledPlatforms.has(ad.platform) && enabledFormats.has(ad.format)
    );
  }, [ads, enabledPlatforms, enabledFormats]);

  // Don't render anything if no ads
  if (!ads || ads.length === 0) {
    return null;
  }

  const togglePlatform = (platform: AdPlatform) => {
    setEnabledPlatforms(prev => {
      const next = new Set(prev);
      if (next.has(platform)) {
        // Don't allow deselecting all - at least one must remain
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
        // Don't allow deselecting all - at least one must remain
        if (next.size > 1) {
          next.delete(format);
        }
      } else {
        next.add(format);
      }
      return next;
    });
  };

  // Show platform filters if there are multiple platforms
  const showPlatformFilters = availablePlatforms.length > 1;
  // Show format filters if there are multiple formats
  const showFormatFilters = availableFormats.length > 1;

  return (
    <div className={cn("w-full max-w-md mx-auto space-y-2", className)}>
      {/* Filters Section - Two Rows */}
      {(showPlatformFilters || showFormatFilters) && (
        <div
          className="space-y-2 p-2 rounded-lg"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-default)',
            borderWidth: '1px'
          }}
        >
          {/* Row 1: Channel Filters */}
          {showPlatformFilters && (
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-xs font-medium min-w-[60px]"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Channels
              </span>
              {availablePlatforms.map(platform => {
                const isActive = enabledPlatforms.has(platform);
                const platformColor = PLATFORM_COLORS[platform];
                return (
                  <button
                    key={platform}
                    onClick={() => togglePlatform(platform)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                      isActive
                        ? cn(platformColor.bg, platformColor.text, "shadow-sm")
                        : "hover:opacity-80"
                    )}
                    style={!isActive ? {
                      backgroundColor: 'var(--bg-hover)',
                      color: 'var(--text-tertiary)'
                    } : undefined}
                  >
                    {PLATFORM_LABELS[platform]}
                  </button>
                );
              })}
            </div>
          )}

          {/* Row 2: Creative Type Filters */}
          {showFormatFilters && (
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-xs font-medium min-w-[60px]"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Type
              </span>
              {availableFormats.map(format => {
                const isActive = enabledFormats.has(format);
                const formatColor = FORMAT_COLORS[format];
                return (
                  <button
                    key={format}
                    onClick={() => toggleFormat(format)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                      isActive
                        ? cn(formatColor.bg, formatColor.text, "shadow-sm")
                        : "hover:opacity-80"
                    )}
                    style={!isActive ? {
                      backgroundColor: 'var(--bg-hover)',
                      color: 'var(--text-tertiary)'
                    } : undefined}
                  >
                    {FORMAT_LABELS[format]}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Carousel or empty state */}
      {filteredAds.length === 0 ? (
        <div
          className="text-center text-sm py-4"
          style={{ color: 'var(--text-tertiary)' }}
        >
          No ads match the selected filters
        </div>
      ) : (
        <Carousel
          opts={{
            align: "start",
            loop: filteredAds.length > 1,
          }}
          className="w-full"
        >
          <CarouselContent className="-ml-2">
            {filteredAds.map((ad, index) => (
              <CarouselItem key={ad.id || index} className="pl-2">
                <AdCreativeCard ad={ad} />
              </CarouselItem>
            ))}
          </CarouselContent>

          {/* Navigation - only show if more than one ad */}
          {filteredAds.length > 1 && (
            <>
              <CarouselPrevious
                className="left-1 h-7 w-7 backdrop-blur-sm transition-all"
                style={{
                  backgroundColor: 'rgba(12, 14, 19, 0.8)',
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-heading)'
                }}
              />
              <CarouselNext
                className="right-1 h-7 w-7 backdrop-blur-sm transition-all"
                style={{
                  backgroundColor: 'rgba(12, 14, 19, 0.8)',
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-heading)'
                }}
              />
              <SlideCounter total={filteredAds.length} />
            </>
          )}
        </Carousel>
      )}
    </div>
  );
}

// =============================================================================
// Individual Ad Creative Card
// =============================================================================

interface AdCreativeCardProps {
  ad: AdCreative;
}

function AdCreativeCard({ ad }: AdCreativeCardProps) {
  const platformColor = PLATFORM_COLORS[ad.platform];
  const platformLabel = PLATFORM_LABELS[ad.platform];
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [videoError, setVideoError] = React.useState(false);

  // Determine display text - prefer headline, fallback to body, then generic
  const displayText = ad.headline
    ? truncateText(ad.headline, 80)
    : ad.body
      ? truncateText(ad.body, 80)
      : "Ad Creative";

  // Handle play button click
  const handlePlayClick = () => {
    if (videoRef.current) {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  // Handle video error - fall back to image or placeholder
  const handleVideoError = () => {
    setVideoError(true);
  };

  // Determine what media to show
  const hasVideo = ad.videoUrl && !videoError;
  const hasImage = ad.imageUrl;

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-default)',
        borderWidth: '1px'
      }}
    >
      {/* Media Section */}
      <div
        className="aspect-video relative flex items-center justify-center"
        style={{ backgroundColor: 'var(--bg-hover)' }}
      >
        {hasVideo ? (
          // Video with play overlay
          <div className="relative w-full h-full">
            <video
              ref={videoRef}
              src={ad.videoUrl}
              poster={ad.imageUrl}
              preload="metadata"
              controls={isPlaying}
              className="w-full h-full object-cover"
              onError={handleVideoError}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
            />
            {/* Play button overlay - hidden when video is playing */}
            {!isPlaying && (
              <button
                onClick={handlePlayClick}
                className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors group"
                aria-label="Play video"
              >
                <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Play className="h-7 w-7 text-gray-900 ml-1" fill="currentColor" />
                </div>
              </button>
            )}
          </div>
        ) : hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ad.imageUrl}
            alt={displayText}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center gap-1.5 p-4" style={{ color: 'var(--text-tertiary)' }}>
            <ImageOff className="h-8 w-8" />
            <span className="text-xs font-medium">No image available</span>
            <span className="text-[10px] text-center opacity-70 flex items-center gap-1">
              <Info className="h-3 w-3" />
              {ad.format === "video"
                ? "Video thumbnail not provided"
                : "Text-only ad or image not available"
              }
            </span>
          </div>
        )}

        {/* Platform Badge - positioned over image */}
        <Badge
          className={cn(
            "absolute top-2 left-2 font-medium",
            platformColor.bg,
            platformColor.text
          )}
        >
          {platformLabel}
        </Badge>

        {/* Format & Active Status Badges */}
        <div className="absolute top-2 right-2 flex gap-1">
          {ad.format && ad.format !== "unknown" && (
            <Badge
              variant="outline"
              className="backdrop-blur-sm text-xs capitalize"
              style={{
                backgroundColor: 'rgba(12, 14, 19, 0.8)',
                borderColor: 'var(--border-default)',
                color: 'var(--text-secondary)'
              }}
            >
              {FORMAT_LABELS[ad.format]}
            </Badge>
          )}
          {ad.isActive && (
            <Badge
              variant="outline"
              className="bg-green-500/20 text-green-400 border-green-500/30 text-xs"
            >
              Active
            </Badge>
          )}
        </div>
      </div>

      {/* Content Section */}
      <div className="p-3 space-y-2">
        {/* Headline/Body Text */}
        <p className="text-sm font-medium line-clamp-2" style={{ color: 'var(--text-heading)' }}>
          {displayText}
        </p>

        {/* Date Info */}
        {(ad.firstSeen || ad.lastSeen) && (
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {ad.firstSeen && `First seen: ${formatDate(ad.firstSeen)}`}
            {ad.firstSeen && ad.lastSeen && " | "}
            {ad.lastSeen && `Last seen: ${formatDate(ad.lastSeen)}`}
          </p>
        )}

        {/* Action Buttons */}
        {(ad.detailsUrl || hasVideo) && (
          <div className={cn(
            "flex gap-2",
            ad.detailsUrl && hasVideo ? "flex-row" : "flex-col"
          )}>
            {/* Open Video Button */}
            {hasVideo && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className={cn(
                  "text-xs h-7 transition-all hover:opacity-90",
                  ad.detailsUrl ? "flex-1" : "w-full"
                )}
                style={{
                  backgroundColor: 'var(--accent-blue)',
                  borderColor: 'var(--accent-blue)',
                  color: 'white'
                }}
              >
                <a
                  href={ad.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1"
                >
                  <Video className="h-3 w-3" />
                  Open Video
                </a>
              </Button>
            )}
            {/* View Ad Link */}
            {ad.detailsUrl && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className={cn(
                  "text-xs h-7 transition-all hover:opacity-90",
                  hasVideo ? "flex-1" : "w-full"
                )}
                style={{
                  backgroundColor: 'var(--accent-blue)',
                  borderColor: 'var(--accent-blue)',
                  color: 'white'
                }}
              >
                <a
                  href={ad.detailsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  View Ad
                </a>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Helper Functions
// =============================================================================

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "...";
}

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return isoString;
  }
}

export default AdCreativeCarousel;
