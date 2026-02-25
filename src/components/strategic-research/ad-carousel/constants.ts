import type { AdPlatform, AdFormat, AdRelevanceCategory } from "@/lib/ad-library";

export const ALL_PLATFORMS: AdPlatform[] = ["linkedin", "meta", "google"];
export const ALL_FORMATS: AdFormat[] = ["video", "image", "carousel", "text", "message"];

export type RelevanceFilter = 'all' | 'high' | 'medium' | 'low';
export type SourceFilter = 'all' | 'enriched' | 'foreplay-sourced';

export const FORMAT_LABELS: Record<AdFormat, string> = {
  video: "Video",
  image: "Image",
  carousel: "Carousel",
  text: "Text Ad",
  message: "Message Ad",
  unknown: "Other",
};

export const RELEVANCE_COLORS: Record<AdRelevanceCategory, { bg: string; text: string; label: string }> = {
  direct: { bg: "bg-green-500/20", text: "text-green-400", label: "Direct" },
  lead_magnet: { bg: "bg-amber-500/20", text: "text-amber-400", label: "Lead Magnet" },
  brand_awareness: { bg: "bg-primary/20", text: "text-primary", label: "Brand" },
  subsidiary: { bg: "bg-purple-500/20", text: "text-purple-400", label: "Related Brand" },
  unclear: { bg: "bg-gray-500/20", text: "text-gray-400", label: "Unclear" },
};

export const PLATFORM_COLORS: Record<AdPlatform, { bg: string; text: string; solid: string }> = {
  linkedin: { bg: "bg-[#0A66C2]/10", text: "text-[#0A66C2]", solid: "bg-[#0A66C2]" },
  meta: { bg: "bg-[#1877F2]/10", text: "text-[#1877F2]", solid: "bg-[#1877F2]" },
  google: { bg: "bg-[#4285F4]/10", text: "text-[#4285F4]", solid: "bg-[#4285F4]" },
};

export const PLATFORM_LABELS: Record<AdPlatform, string> = {
  linkedin: "LinkedIn",
  meta: "Meta",
  google: "Google",
};

export function getRelevanceLevel(score: number): RelevanceFilter {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

export function getSmartButtonLabel(detailsUrl: string | undefined, source: string | undefined): string {
  if (!detailsUrl) return 'View Ad';

  if (source === 'foreplay') {
    if (detailsUrl.includes('facebook.com/ads/library')) return 'Meta Library';
    if (detailsUrl.includes('ads.tiktok.com')) return 'TikTok Ads';
    return 'Landing Page';
  }

  if (detailsUrl.includes('facebook.com') || detailsUrl.includes('meta.com')) return 'Meta Library';
  if (detailsUrl.includes('linkedin.com')) return 'LinkedIn Ads';
  if (detailsUrl.includes('google.com') || detailsUrl.includes('adstransparency')) return 'Google Ads';

  return 'View Ad';
}

export function formatDate(isoString: string): string {
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
