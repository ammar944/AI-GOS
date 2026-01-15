"use client";

import * as React from "react";
import { ImageOff, ExternalLink, Filter, Info, Play } from "lucide-react";
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
    <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
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

  // Don't render anything if no ads
  if (!ads || ads.length === 0) {
    return null;
  }

  // Get unique platforms that have ads
  const availablePlatforms = React.useMemo(() => {
    const platforms = new Set(ads.map(ad => ad.platform));
    return ALL_PLATFORMS.filter(p => platforms.has(p));
  }, [ads]);

  // Get unique formats that have ads
  const availableFormats = React.useMemo(() => {
    const formats = new Set(ads.map(ad => ad.format));
    return ALL_FORMATS.filter(f => formats.has(f));
  }, [ads]);

  // Filter ads by enabled platforms and formats
  const filteredAds = React.useMemo(() => {
    return ads.filter(ad =>
      enabledPlatforms.has(ad.platform) && enabledFormats.has(ad.format)
    );
  }, [ads, enabledPlatforms, enabledFormats]);

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
      {/* Filters Row */}
      {(showPlatformFilters || showFormatFilters) && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />

          {/* Platform Filters */}
          {showPlatformFilters && availablePlatforms.map(platform => {
            const isActive = enabledPlatforms.has(platform);
            const platformColor = PLATFORM_COLORS[platform];
            return (
              <button
                key={platform}
                onClick={() => togglePlatform(platform)}
                className={cn(
                  "px-2 py-0.5 rounded text-xs font-medium transition-all",
                  isActive
                    ? cn(platformColor.bg, platformColor.text)
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {PLATFORM_LABELS[platform]}
              </button>
            );
          })}

          {/* Separator if both filter types shown */}
          {showPlatformFilters && showFormatFilters && (
            <span className="text-muted-foreground/50">|</span>
          )}

          {/* Format Filters */}
          {showFormatFilters && availableFormats.map(format => {
            const isActive = enabledFormats.has(format);
            return (
              <button
                key={format}
                onClick={() => toggleFormat(format)}
                className={cn(
                  "px-2 py-0.5 rounded text-xs font-medium transition-all",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {FORMAT_LABELS[format]}
              </button>
            );
          })}
        </div>
      )}

      {/* Carousel or empty state */}
      {filteredAds.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-4">
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
              <CarouselPrevious className="left-1 h-7 w-7 bg-background/80 backdrop-blur-sm hover:bg-background" />
              <CarouselNext className="right-1 h-7 w-7 bg-background/80 backdrop-blur-sm hover:bg-background" />
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
    <div className="bg-muted/50 rounded-lg border overflow-hidden">
      {/* Media Section */}
      <div className="aspect-video relative bg-muted flex items-center justify-center">
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
          <div className="flex flex-col items-center gap-1.5 text-muted-foreground p-4">
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
              className="bg-background/80 backdrop-blur-sm text-xs capitalize"
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
        <p className="text-sm font-medium line-clamp-2">
          {displayText}
        </p>

        {/* Date Info */}
        {(ad.firstSeen || ad.lastSeen) && (
          <p className="text-xs text-muted-foreground">
            {ad.firstSeen && `First seen: ${formatDate(ad.firstSeen)}`}
            {ad.firstSeen && ad.lastSeen && " | "}
            {ad.lastSeen && `Last seen: ${formatDate(ad.lastSeen)}`}
          </p>
        )}

        {/* View Ad Link */}
        {ad.detailsUrl && (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="w-full text-xs h-7"
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
