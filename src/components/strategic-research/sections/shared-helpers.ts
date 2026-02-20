import type { PricingTier } from "@/lib/strategic-blueprint/output-types";

// =============================================================================
// Helper Functions
// =============================================================================

export function safeRender(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(safeRender).join(", ");
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const values = Object.values(obj).filter((v) => v !== null && v !== undefined);
    if (values.length === 0) return "";
    return values.map(safeRender).join(", ");
  }
  return String(value);
}

export function safeArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(safeRender);
  // Handle JSON string arrays (e.g. from chat edit tool)
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map(safeRender);
      } catch { /* not valid JSON, fall through */ }
    }
    return [value];
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of ["items", "values", "list"]) {
      if (Array.isArray(obj[key])) return (obj[key] as unknown[]).map(safeRender);
    }
    return Object.values(obj)
      .filter((v) => v !== null && v !== undefined)
      .map(safeRender);
  }
  return [safeRender(value)];
}

/** Check if an array-like value has renderable content */
export function hasItems(value: unknown): boolean {
  if (!value) return false;
  if (Array.isArray(value)) return value.length > 0;
  return false;
}

/** Format a PricingTier to a string for editing */
export function formatPricingTier(tier: PricingTier): string {
  return `${tier.tier}: ${tier.price}`;
}

/** Parse pricing tier strings back to PricingTier objects */
export function parsePricingTierStrings(strings: string[]): PricingTier[] {
  return strings.map(s => {
    const [tier, ...priceParts] = s.split(':');
    return {
      tier: tier.trim(),
      price: priceParts.join(':').trim() || 'Custom',
    };
  });
}

/** Convert markdown-ish review text into readable plain text. */
export function cleanReviewText(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function excerpt(text: string, max = 240): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}...`;
}

export interface PlatformSearchLink {
  platform: "meta_manager" | "meta_library" | "linkedin" | "google";
  label: string;
  url: string;
}

function extractDomainFromWebsite(website: string | undefined): string | undefined {
  if (!website?.trim()) return undefined;
  const value = website.trim();
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const parsed = new URL(withProtocol);
    return parsed.hostname.replace(/^www\./i, "");
  } catch {
    return undefined;
  }
}

function getGoogleAdvertiserUrlFromAds(
  adCreatives: Array<{ detailsUrl?: string; platform?: string }> | undefined
): string | undefined {
  if (!adCreatives || adCreatives.length === 0) return undefined;

  for (const ad of adCreatives) {
    if (ad.platform !== "google" || !ad.detailsUrl) continue;
    const match = ad.detailsUrl.match(/adstransparency\.google\.com\/advertiser\/(AR[0-9A-Z]+)/i);
    if (match?.[1]) {
      return `https://adstransparency.google.com/advertiser/${match[1]}?region=US`;
    }
  }

  return undefined;
}

export function buildCompetitorPlatformSearchLinks(comp: {
  name?: string;
  website?: string;
  adCreatives?: Array<{ detailsUrl?: string; platform?: string }>;
}): PlatformSearchLink[] {
  const competitorName = (comp.name || "").trim();
  const encodedName = encodeURIComponent(competitorName);
  const domain = extractDomainFromWebsite(comp.website);

  const metaUrl =
    `https://www.facebook.com/adsmanager/`;

  const metaLibraryUrl =
    `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL` +
    `&q=${encodedName}&search_type=keyword_unordered&media_type=all`;

  const linkedInUrl = `https://www.linkedin.com/ad-library/search?keyword=${encodedName}`;

  const advertiserUrl = getGoogleAdvertiserUrlFromAds(comp.adCreatives);
  const googleUrl = advertiserUrl
    ? advertiserUrl
    : domain
      ? `https://adstransparency.google.com/?region=US&domain=${encodeURIComponent(domain)}`
      : `https://adstransparency.google.com/?region=US`;

  return [
    { platform: "meta_manager", label: "Meta Ad Manager", url: metaUrl },
    { platform: "meta_library", label: "Meta Ad Library", url: metaLibraryUrl },
    { platform: "linkedin", label: "LinkedIn Ads", url: linkedInUrl },
    { platform: "google", label: "Google Ads", url: googleUrl },
  ];
}

