export interface JourneyCompetitorLibraryLinks {
  metaLibraryUrl: string;
  linkedInLibraryUrl: string;
  googleAdvertiserUrl: string;
}

function normalizeDomain(website: string): string {
  return website
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0] ?? website;
}

function deriveGoogleAdvertiserUrl(
  adCreatives?: Array<{ platform?: string; detailsUrl?: string }>,
  website?: string,
  name?: string,
): string {
  const googleCreative = adCreatives?.find(
    (c) =>
      c.platform === 'google' &&
      c.detailsUrl?.includes('adstransparency.google.com'),
  );

  if (googleCreative?.detailsUrl) {
    const url = googleCreative.detailsUrl;
    return url.includes('?') ? url : `${url}?region=US`;
  }

  if (website) {
    const domain = normalizeDomain(website);
    return `https://adstransparency.google.com/?region=anywhere&q=${encodeURIComponent(domain)}`;
  }

  return `https://adstransparency.google.com/?region=anywhere&q=${encodeURIComponent(name ?? '')}`;
}

export function buildCompetitorLibraryLinks(input: {
  name: string;
  website?: string;
  adCreatives?: Array<{ platform?: string; detailsUrl?: string }>;
}): JourneyCompetitorLibraryLinks {
  const encodedName = encodeURIComponent(input.name.trim());

  return {
    metaLibraryUrl: `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&q=${encodedName}&search_type=keyword_unordered&media_type=all`,
    linkedInLibraryUrl: `https://www.linkedin.com/ad-library/search?keyword=${encodedName}`,
    googleAdvertiserUrl: deriveGoogleAdvertiserUrl(
      input.adCreatives,
      input.website,
      input.name,
    ),
  };
}
