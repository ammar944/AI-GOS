"use client";

import * as React from "react";
import { ImageOff, ExternalLink } from "lucide-react";
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
import type { AdCreative, AdPlatform } from "@/lib/ad-library";

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
  // Don't render anything if no ads
  if (!ads || ads.length === 0) {
    return null;
  }

  return (
    <div className={cn("w-full max-w-md mx-auto", className)}>
      <Carousel
        opts={{
          align: "start",
          loop: ads.length > 1,
        }}
        className="w-full"
      >
        <CarouselContent className="-ml-2">
          {ads.map((ad, index) => (
            <CarouselItem key={ad.id || index} className="pl-2">
              <AdCreativeCard ad={ad} />
            </CarouselItem>
          ))}
        </CarouselContent>

        {/* Navigation - only show if more than one ad */}
        {ads.length > 1 && (
          <>
            <CarouselPrevious className="left-1 h-7 w-7 bg-background/80 backdrop-blur-sm hover:bg-background" />
            <CarouselNext className="right-1 h-7 w-7 bg-background/80 backdrop-blur-sm hover:bg-background" />
            <SlideCounter total={ads.length} />
          </>
        )}
      </Carousel>
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

  // Determine display text - prefer headline, fallback to body, then generic
  const displayText = ad.headline
    ? truncateText(ad.headline, 80)
    : ad.body
      ? truncateText(ad.body, 80)
      : "Ad Creative";

  return (
    <div className="bg-muted/50 rounded-lg border overflow-hidden">
      {/* Image Section */}
      <div className="aspect-video relative bg-muted flex items-center justify-center">
        {ad.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ad.imageUrl}
            alt={displayText}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <ImageOff className="h-8 w-8" />
            <span className="text-xs">No image available</span>
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

        {/* Active Status Badge */}
        {ad.isActive && (
          <Badge
            variant="outline"
            className="absolute top-2 right-2 bg-green-500/20 text-green-400 border-green-500/30 text-xs"
          >
            Active
          </Badge>
        )}
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
