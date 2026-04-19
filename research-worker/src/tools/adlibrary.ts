import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import type {
  WorkerAdCreative,
  WorkerAdInsight,
  WorkerAdPlatform,
  WorkerLibraryLinks,
} from './adlibrary-types';
import {
  calculateSimilarity,
  extractCompanyFromDomain,
} from '../utils/name-matcher';

interface SearchApiAdRecord {
  // Flat fields (some platforms)
  platform?: string;
  headline?: string;
  title?: string;
  description?: string;
  body?: string | { text?: string };
  text?: string;
  advertiser_id?: string;
  advertiser_name?: string;
  ad_id?: string;
  id?: string;
  format?: string;
  image_url?: string;
  video_url?: string;
  details_url?: string;
  first_shown?: string;
  last_shown?: string;
  is_active?: boolean;

  // Meta nested structure (SearchAPI returns raw Meta Ad Library format)
  page_name?: string;
  ad_archive_id?: string;
  ad_library_url?: string;
  publisher_platform?: string[];
  start_date?: number;
  end_date?: number;
  start_date_formatted?: string;
  end_date_formatted?: string;
  snapshot?: {
    title?: string;
    caption?: string;
    body?: { text?: string } | string;
    cta_text?: string;
    display_format?: string;
    link_url?: string;
    images?: Array<string | { url?: string }>;
    videos?: Array<{ video_hd_url?: string; video_preview_image_url?: string }>;
    cards?: Array<{ title?: string; body?: string; original_image_url?: string }>;
    page_name?: string;
  };

  // LinkedIn nested structure
  content?: {
    headline?: string;
    body?: string;
    image?: string;
  };
  advertiser?: {
    name?: string;
    promotor?: string;
    thumbnail?: string;
  };
  ad_type?: string;
  link?: string;
  position?: number;
}

interface ForeplayBrand {
  id?: string;
  brand_id?: string;
  name?: string;
}

interface ForeplayAdRecord {
  headline?: string;
  title?: string;
  description?: string;
  body?: string;
  primary_text?: string;
  platform?: string;
  source?: string;
}

const SEARCH_API_TIMEOUT_MS = 12_000;
const FOREPLAY_TIMEOUT_MS = 8_000;

function normalizeDomain(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0] ?? value;
}

function extractMessage(record: Record<string, unknown>): string | null {
  // Check nested structures first (Meta snapshot, LinkedIn content)
  const snapshot = record.snapshot as SearchApiAdRecord['snapshot'] | undefined;
  const content = record.content as SearchApiAdRecord['content'] | undefined;

  const candidates = [
    // Flat fields
    record.headline,
    record.title,
    record.description,
    typeof record.body === 'string' ? record.body : null,
    record.text,
    record.primary_text,
    // Meta nested (snapshot)
    snapshot?.title,
    snapshot?.caption,
    typeof snapshot?.body === 'object' && snapshot?.body ? (snapshot.body as { text?: string }).text : snapshot?.body,
    snapshot?.cards?.[0]?.title,
    // LinkedIn nested (content)
    content?.headline,
    content?.body,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return null;
}

function guessTheme(message: string): string {
  const n = message.toLowerCase();
  // Universal offer / CTA patterns
  if (n.includes('free') || n.includes('trial') || n.includes('sample')) return 'Free offer / trial';
  if (n.includes('discount') || n.includes('% off') || n.includes('sale') || n.includes('deal')) return 'Discount / promotion';
  if (n.includes('limited') || n.includes('hurry') || n.includes('expires') || n.includes('last chance')) return 'Urgency / scarcity';
  if (n.includes('shop') || n.includes('buy now') || n.includes('order') || n.includes('add to cart')) return 'Direct purchase CTA';
  if (n.includes('shipping') || n.includes('delivery') || n.includes('fast delivery')) return 'Shipping / fulfillment';
  // B2B / service patterns
  if (n.includes('demo') || n.includes('book') || n.includes('schedule') || n.includes('appointment')) return 'Booking / demo CTA';
  if (n.includes('quote') || n.includes('estimate') || n.includes('consultation')) return 'Quote / consultation';
  if (n.includes('pipeline') || n.includes('revenue') || n.includes('roi')) return 'Revenue / ROI';
  if (n.includes('faster') || n.includes('speed') || n.includes('quick') || n.includes('instant')) return 'Speed to value';
  if (n.includes('cost') || n.includes('reduce') || n.includes('save') || n.includes('affordable')) return 'Savings / value';
  // Trust / social proof
  if (n.includes('testimonial') || n.includes('review') || n.includes('rated') || n.includes('trusted')) return 'Social proof';
  if (n.includes('webinar') || n.includes('learn') || n.includes('guide') || n.includes('download')) return 'Education / content';
  if (n.includes('guarantee') || n.includes('warranty') || n.includes('risk-free') || n.includes('money back')) return 'Trust / guarantee';
  // Local service patterns
  if (n.includes('near') || n.includes('local') || n.includes('serving') || n.includes('area')) return 'Local targeting';
  if (n.includes('licensed') || n.includes('certified') || n.includes('insured') || n.includes('accredited')) return 'Credentials / trust';
  if (n.includes('call') || n.includes('contact') || n.includes('reach')) return 'Contact CTA';

  return message.length > 90 ? `${message.slice(0, 87)}...` : message;
}

/** Thrown by fetchJson when SearchAPI responds with 429 or 503. */
export class RateLimitError extends Error {
  readonly status: number;
  constructor(status: number, url: string) {
    super(`HTTP ${status} for ${url}`);
    this.name = 'RateLimitError';
    this.status = status;
  }
}

export async function fetchJson(
  url: string,
  init?: RequestInit,
  timeoutMs = SEARCH_API_TIMEOUT_MS,
): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    if (response.status === 429 || response.status === 503) {
      // Extract platform and company context from URL for clearer logging
      const urlObj = new URL(url);
      const engine = urlObj.searchParams.get('engine') ?? 'unknown';
      const q = urlObj.searchParams.get('q') ?? urlObj.searchParams.get('advertiser') ?? urlObj.searchParams.get('advertiser_id') ?? '';
      console.warn(`[adlibrary] SearchAPI rate limited (${response.status}) for engine=${engine} q="${q}"`);
      throw new RateLimitError(response.status, url);
    } else {
      console.warn(`[adlibrary] HTTP ${response.status} for ${url}`);
    }
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response.json();
}

// --- Advertiser name matching for false-positive protection ---

/**
 * Check if an advertiser name matches the searched company.
 * Uses multi-layer validation:
 * 1. Exact match (normalized)
 * 2. Full containment (one name contains the other)
 * 3. First-word match + Jaro-Winkler (the advertiser's FIRST word must match)
 * 4. Domain-based fallback (advertiser starts with the domain base)
 *
 * Rejects: "Direct Metals" vs "Directive" (different first words, JW=0.82)
 * Rejects: "TEPLOBAK Buffer Tanks" vs "Buffer" (buffer is not the first word)
 * Passes:  "Buffer Inc" vs "Buffer" (first word matches exactly)
 *
 * Wave 6e Hole 3 fix: when `adUrl` is provided AND the company name is short
 * (≤6 chars) AND a domain is provided, REQUIRE the ad URL to contain the domain.
 * This catches the multi-company-same-name leak: e.g. an ad whose advertiser is
 * literally "Fathom" but whose clickthrough goes to fathomdem.com instead of
 * fathom.video. Without this guard, Layer 1 (exact match) would accept it
 * because the names are byte-identical.
 *
 * Behavior matrix (short name + verified domain + adUrl):
 *   url contains domain → fall through to existing layers
 *   url present but doesn't contain domain → REJECT (domain mismatch)
 *   url missing/empty → fall through (permissive, name-only match still allowed)
 *
 * For long names or when adUrl is undefined, this guard does nothing — backward
 * compatible with existing callers (eval scripts, tests, normalizeSearchApi*).
 */
export function isAdvertiserMatch(
  advertiserName: string | undefined,
  companyName: string,
  domain?: string,
  adUrl?: string,
): boolean {
  if (!advertiserName) return false;

  const advNorm = advertiserName.toLowerCase().trim().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
  const compNorm = companyName.toLowerCase().trim().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');

  // Wave 6e Hole 3: short-name URL guard.
  // When the company name is short and we have a verified domain, an ad URL
  // that points to a different domain is a hard reject — even if the name
  // matches exactly, the URL is the strongest disambiguator we have.
  //
  // Exception (2026-04-17 fix): when the URL is an ad-library/transparency-
  // portal URL (linkedin.com/ad-library/..., facebook.com/ads/library/...,
  // adstransparency.google.com/...), it's a pointer from the platform back
  // to the ad record itself, NOT a redirect to the advertiser. Those URLs
  // never contain the advertiser's domain, so the guard previously rejected
  // 100% of LinkedIn ads for short-named advertisers (e.g. Fathom, Gong,
  // Avoma). Skip the guard for those hosts and let name matching handle it.
  // Detect ad-library / transparency-portal URLs by PATH (not host alone) so
  // we still enforce the guard on redirect URLs like
  // "linkedin.com/redirect?url=https%3A%2F%2Fcompetitor.io". Those have the
  // same linkedin.com host but an embedded redirect target we MUST check.
  const AD_LIBRARY_PATH_PATTERNS = /\/ad[-_]library\/|\/ads\/library\/|\/advertiser\//i;
  const compLenForGuard = compNorm.replace(/\s+/g, '').length;
  if (compLenForGuard <= 6 && domain && adUrl) {
    const url = adUrl.toLowerCase();
    const dom = normalizeDomain(domain).toLowerCase();
    let decodedUrl: string;
    try { decodedUrl = decodeURIComponent(url); } catch { decodedUrl = url; }
    const isAdLibraryUrl = AD_LIBRARY_PATH_PATTERNS.test(decodedUrl);
    if (url.length > 0 && !isAdLibraryUrl && !decodedUrl.includes(dom)) {
      // URL is non-empty, NOT an ad-library/transparency URL, AND doesn't
      // contain our verified domain — reject. This still catches LinkedIn
      // redirect URLs (linkedin.com/redirect?url=competitor.io) whose encoded
      // target is wrong, but allows ad-library pointer URLs
      // (linkedin.com/ad-library/detail/123) which never contain the
      // advertiser's domain by design.
      return false;
    }
    // URL is empty, an ad-library URL, or contains our domain — fall through
    // to name checks.
  }

  // Layer 1: Exact match after normalization
  if (advNorm === compNorm) return true;

  // Layer 2: Full containment with short-name guard.
  // For short names (≤6 chars), only allow containment if the extra words are
  // corporate suffixes (Inc, LLC, Corp, etc.) — NOT meaningful words.
  // "Atlas" must NOT match "Atlas VPN". "Buffer" must NOT match "Buffer Zone".
  // "Atlas" DOES match "Atlas" and "Atlas Inc".
  const isShortName = compNorm.replace(/\s+/g, '').length <= 6;
  const corporateSuffixes = new Set(['inc', 'llc', 'corp', 'ltd', 'limited', 'co', 'company', 'group', 'international', 'intl', 'technologies', 'software', 'solutions', 'platform', 'hq']);

  if (advNorm.startsWith(compNorm + ' ') || (advNorm.startsWith(compNorm) && advNorm.length === compNorm.length)) {
    if (isShortName && advNorm !== compNorm) {
      // Short name + extra words: only pass if all extra words are corporate suffixes
      const extra = advNorm.substring(compNorm.length).trim();
      const extraWords = extra.split(/\s+/).filter(w => w.length > 0);
      if (extraWords.length > 0 && !extraWords.every(w => corporateSuffixes.has(w))) {
        // Extra words are NOT suffixes — different entity (e.g. "Atlas VPN")
        // Fall through to other layers
      } else {
        return true;
      }
    } else {
      return true;
    }
  }
  if (compNorm.startsWith(advNorm + ' ') || (compNorm.startsWith(advNorm) && compNorm.length === advNorm.length)) {
    if (isShortName && compNorm !== advNorm) {
      const extra = compNorm.substring(advNorm.length).trim();
      const extraWords = extra.split(/\s+/).filter(w => w.length > 0);
      if (extraWords.length > 0 && !extraWords.every(w => corporateSuffixes.has(w))) {
        // Fall through
      } else {
        return true;
      }
    } else {
      return true;
    }
  }

  // Layer 3: First-word agreement + Jaro-Winkler
  // The advertiser's first meaningful word must exactly match the company's first word.
  // This prevents "Direct Metals" from matching "Directive" (direct ≠ directive)
  // and "TEPLOBAK Buffer" from matching "Buffer" (teplobak ≠ buffer).
  const advWords = advNorm.split(' ').filter(w => w.length > 1);
  const compWords = compNorm.split(' ').filter(w => w.length > 1);
  const advFirst = advWords[0] ?? '';
  const compFirst = compWords[0] ?? '';

  if (advFirst === compFirst && advFirst.length > 0 && !isShortName) {
    // First words match — use Jaro-Winkler at standard threshold.
    // SHORT NAMES ARE EXCLUDED: for ≤6-char companies (Fathom, Gong, Drift,
    // Atlas…) the Jaro-Winkler prefix bonus makes "Fathom Digital
    // Manufacturing" match "Fathom" at ~0.85 — same first word, tons of
    // prefix overlap. Layer 2 already accepts the legitimate short-name
    // variants ("Fathom", "Fathom Inc") via the corporate-suffix guard.
    // Falling through to Layer 4 domain fallback here is the right call —
    // it matches only if the advertiser's first word IS the domain base
    // and all extra words are corporate suffixes, which rejects
    // multi-company-same-name leaks (Fathom Digital Manufacturing vs
    // fathom.ai). Source: 2026-04-18 live run showed wrong Fathom ads.
    if (calculateSimilarity(advertiserName, companyName) >= 0.8) return true;
  }

  // Layer 4: Domain-based fallback — advertiser name starts with the domain base
  if (domain) {
    const domainBase = normalizeDomain(domain).split('.')[0] ?? '';
    if (domainBase.length >= 3) {
      if (isShortName) {
        // Short names: domain base must be an EXACT word match (not just prefix)
        // "drift" matches "drift" and "Drift Inc" but NOT "DRIFTKLART" or "Driftscape"
        const advWords = advNorm.split(' ');
        if (advWords[0] === domainBase && (advWords.length === 1 || advWords.slice(1).every(w => corporateSuffixes.has(w)))) return true;
      } else {
        // Long names: startsWith is fine (more distinctive names)
        if (advNorm.startsWith(domainBase)) return true;
      }
    }
  }

  return false;
}

// --- Verdict-based candidate resolution ---
//
// Decision tree:
//   resolveBestCandidate(candidates, name, domain, isDomainVerified)
//     ├─ No candidates above 0.8 → REJECTED
//     ├─ isDomainVerified + short name (≤6) + no domain corroboration → REJECTED
//          (domain-first lookups already ran; a name-search result that doesn't
//           corroborate the verified domain is the wrong entity)
//     ├─ Exact normalized match → ACCEPTED
//     ├─ isDomainVerified + candidate corroborates domain → ACCEPTED
//     ├─ Single candidate ≥0.95 with ≥0.15 margin → ACCEPTED
//     ├─ Short name (≤6) + no exact match + no domain corroboration → AMBIGUOUS
//     └─ Multiple candidates, no corroboration → AMBIGUOUS

interface Candidate {
  name: string;
  id: string;
  entity: Record<string, unknown>;
}

interface ResolverResult {
  verdict: 'accepted' | 'ambiguous' | 'rejected';
  candidate?: Candidate;
  reason: string;
  candidates?: Array<{ name: string; score: number; domainMatch: boolean }>;
}

/**
 * Resolve the best candidate from a list using identity verification.
 * Returns a verdict (accepted/ambiguous/rejected) with the matched candidate.
 *
 * isDomainVerified = true when the domain came from Sonar validation (not inferred).
 * When false (inferred domain like "atlas.com"), triggers exact-match-only mode
 * for short names.
 */
export function resolveBestCandidate(
  candidates: Candidate[],
  companyName: string,
  domain?: string,
  isDomainVerified?: boolean,
): ResolverResult {
  if (candidates.length === 0) {
    return { verdict: 'rejected', reason: 'No candidates returned by API' };
  }

  const compNorm = companyName.toLowerCase().trim().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
  const domainBase = domain ? extractCompanyFromDomain(domain) : undefined;
  const isShortName = compNorm.replace(/\s+/g, '').length <= 6;

  const scored = candidates.map(c => {
    const score = calculateSimilarity(c.name, companyName);
    // Use score of 1.0 as the exact match signal — this accounts for suffix stripping
    // (e.g. "Atlas Corp" normalizes to "atlas" = 1.0 match with "Atlas")
    const exactMatch = score >= 1.0;
    // domainMatch: candidate name contains the domain base word.
    // For short names we use whole-word matching to avoid "fathom" matching "Fathom Analytics"
    // when the actual entity is "Fathom Video" — we need the domain base to appear as a
    // standalone word (possibly with corporate suffixes) in the candidate name.
    let domainMatch = false;
    if (domainBase && isDomainVerified) {
      const candidateNorm = c.name.toLowerCase();
      const base = domainBase.toLowerCase();
      if (isShortName) {
        // Whole-word check: base must be a word boundary match, not just a substring
        const hasBase = new RegExp(`\\b${base}\\b`).test(candidateNorm);
        if (hasBase) {
          // Extra disambiguation: if company name has a qualifier (e.g., "Fathom AI"),
          // the candidate must ALSO contain that qualifier. "Fathom" alone doesn't match
          // "Fathom AI" — it could be any Fathom. But "Fathom AI" or "Fathom - AI Meeting"
          // would match. This prevents terrain company "Fathom" from matching "Fathom AI".
          const companyWords = compNorm.split(/\s+/);
          const qualifiers = companyWords.filter(w => w.toLowerCase() !== base && w.length > 1);
          if (qualifiers.length === 0) {
            // No qualifier (just "Fathom") — any candidate with the base word matches
            domainMatch = true;
          } else {
            // Has qualifier (e.g., "AI", "Video") — candidate must contain at least one qualifier
            // OR be a very high name-similarity match (≥0.85) which catches "Fathom.ai" page names
            domainMatch = qualifiers.some(q => candidateNorm.includes(q.toLowerCase()))
              || score >= 0.85;
          }
        }
      } else {
        domainMatch = candidateNorm.includes(base);
      }
    }
    return { candidate: c, name: c.name, score, exactMatch, domainMatch };
  });

  // Sort: exact matches first, then by score, then domain match
  scored.sort((a, b) => {
    if (a.exactMatch !== b.exactMatch) return a.exactMatch ? -1 : 1;
    if (b.score !== a.score) return b.score - a.score;
    if (a.domainMatch !== b.domainMatch) return a.domainMatch ? -1 : 1;
    return 0;
  });

  const candidateLog = scored.map(s => ({
    name: s.name, score: s.score, domainMatch: s.domainMatch,
  }));

  const top = scored[0];
  const runnerUp = scored[1];

  // Early rejection for short names with a verified domain when NO candidate corroborates it.
  // When isDomainVerified=true, the platform-specific fetchers already ran a domain-first
  // lookup (google_ads_advertiser_info / meta page search by domain). If those succeeded,
  // we never reach resolveBestCandidate with mismatched candidates. If they failed and we
  // fell back to name search, a name-search result that doesn't corroborate the verified
  // domain is very likely the wrong entity (e.g. "Fathom.com" vs "Fathom AI").
  // Reject hard rather than returning ambiguous — callers treat ambiguous as "try anyway".
  if (isShortName && isDomainVerified && domainBase) {
    const hasDomainCorroboration = scored.some(s => s.domainMatch);
    if (!hasDomainCorroboration) {
      // Previously a hard reject. That was too aggressive: when domain-first
      // search doesn't return any page and the fallback name search returns
      // plausible candidates with no domain corroboration, we dropped 100% of
      // ads (e.g. all of Fathom's Meta ads). Downgrade to `ambiguous` with the
      // top candidate so callers can still try it — callers treat `ambiguous`
      // as "try anyway" and downstream `isAdvertiserMatch` plus the short-name
      // URL guard act as a second filter pass.
      return {
        verdict: 'ambiguous',
        candidate: top.candidate,
        reason: `Short name "${companyName}" (≤6 chars) with verified domain "${domain}": no candidate corroborates domain base "${domainBase}". Accepting top candidate "${top.name}" (${top.score.toFixed(2)}) provisionally — downstream guards will re-check.`,
        candidates: candidateLog,
      };
    }
  }

  // Exact normalized match
  if (top.exactMatch) {
    // For short names with a verified domain: we require domain corroboration because
    // multiple companies share the same short name (e.g. "Atlas VPN" vs "Atlas CRM").
    // The domain-first lookup above should have found the right page; if we're here via
    // name-search fallback and the exact match corroborates the domain, accept it.
    if (isShortName && !top.domainMatch && isDomainVerified) {
      // Exact match exists but doesn't corroborate the verified domain.
      // This branch is only reached when hasDomainCorroboration=true (early rejection
      // above didn't fire), meaning some OTHER candidate corroborates the domain.
      // Sort puts domainMatch candidates higher — if top is exact but not domain-matched
      // and another candidate IS domain-matched, we should trust the domain match instead.
      const domainMatchedCandidate = scored.find(s => s.domainMatch);
      if (domainMatchedCandidate) {
        return {
          verdict: 'accepted',
          candidate: domainMatchedCandidate.candidate,
          reason: `Short name "${companyName}": domain corroboration preferred over exact name match "${top.name}". Domain match: "${domainMatchedCandidate.name}" (verified domain: "${domain}")`,
          candidates: candidateLog,
        };
      }
      return {
        verdict: 'ambiguous',
        candidate: top.candidate,
        reason: `Short name "${companyName}" has exact match "${top.name}" but no domain corroboration with "${domain}". Could be wrong entity.`,
        candidates: candidateLog,
      };
    }
    if (isShortName && !isDomainVerified) {
      // Inferred domain, can't verify. Multiple pages with same short name exist. Ambiguous.
      return {
        verdict: 'ambiguous',
        candidate: top.candidate,
        reason: `Short name "${companyName}" has exact match "${top.name}" but domain is unverified. Cannot confirm identity.`,
        candidates: candidateLog,
      };
    }
    return {
      verdict: 'accepted',
      candidate: top.candidate,
      reason: `Exact match: "${top.name}"`,
      candidates: candidateLog,
    };
  }

  // Verified domain corroboration → accept
  if (top.domainMatch && isDomainVerified) {
    return {
      verdict: 'accepted',
      candidate: top.candidate,
      reason: `Domain corroboration: "${top.name}" matches verified domain "${domain}"`,
      candidates: candidateLog,
    };
  }

  // Single dominant candidate (≥0.95, margin ≥0.15 over runner-up)
  const margin = runnerUp ? top.score - runnerUp.score : 1.0;
  if (top.score >= 0.95 && margin >= 0.15) {
    return {
      verdict: 'accepted',
      candidate: top.candidate,
      reason: `Dominant candidate: "${top.name}" (score=${top.score.toFixed(2)}, margin=${margin.toFixed(2)})`,
      candidates: candidateLog,
    };
  }

  // Below 0.8 → rejected
  if (top.score < 0.8) {
    return {
      verdict: 'rejected',
      reason: `Best candidate "${top.name}" scored ${top.score.toFixed(2)} (below 0.8 threshold)`,
      candidates: candidateLog,
    };
  }

  // Short name with unverified domain → ambiguous (exact-match-only mode)
  if (isShortName && !isDomainVerified) {
    return {
      verdict: 'ambiguous',
      reason: `Short name "${companyName}" (≤6 chars) with unverified domain, no exact match. Top: "${top.name}" (${top.score.toFixed(2)})`,
      candidates: candidateLog,
    };
  }

  // Short name with verified domain but no corroboration → ambiguous
  if (isShortName && isDomainVerified && !top.domainMatch) {
    return {
      verdict: 'ambiguous',
      reason: `Short name "${companyName}" with verified domain "${domain}" but no corroboration. Top: "${top.name}" (${top.score.toFixed(2)})`,
      candidates: candidateLog,
    };
  }

  // Multiple candidates above 0.8 with insufficient margin → ambiguous
  if (runnerUp && runnerUp.score >= 0.8 && margin < 0.15) {
    return {
      verdict: 'ambiguous',
      reason: `Multiple candidates: "${top.name}" (${top.score.toFixed(2)}) vs "${runnerUp.name}" (${runnerUp.score.toFixed(2)}), margin=${margin.toFixed(2)}`,
      candidates: candidateLog,
    };
  }

  // Default: accept the top candidate (long name, clear winner, no red flags)
  return {
    verdict: 'accepted',
    candidate: top.candidate,
    reason: `Best match: "${top.name}" (score=${top.score.toFixed(2)})`,
    candidates: candidateLog,
  };
}

// --- Platform-specific SearchAPI fetchers ---

/**
 * Google Ads: two-step advertiser-first lookup.
 *
 * When isDomainVerified=true (domain came from Wave 1 Sonar validation):
 *   PRIMARY: google_ads_advertiser_info domain lookup → direct advertiser_id
 *   FALLBACK: name-based advertiser search
 *
 * When isDomainVerified=false (inferred domain):
 *   PRIMARY: name-based advertiser search only
 *
 * This prevents short-name confusion (e.g. "Fathom AI" vs "Fathom.com") by
 * anchoring on the verified domain when available rather than relying on name matching.
 */
export async function searchGoogleAds(
  companyName: string,
  domain?: string,
  isDomainVerified?: boolean,
): Promise<SearchApiAdRecord[]> {
  const apiKey = process.env.SEARCHAPI_KEY;
  if (!apiKey) return [];

  const BASE = 'https://www.searchapi.io/api/v1/search';

  // When we have a Wave 1 verified domain, call google_ads_transparency_center
  // directly with ?domain=X. This engine natively accepts a domain parameter
  // and returns ad_creatives — no separate advertiser lookup needed.
  // (Wave 6c's google_ads_advertiser_info path was architecturally wrong: that
  // endpoint requires an advertiser_info_token from Google Search, not a domain,
  // and returned HTTP 400 for every call.)
  if (domain && isDomainVerified) {
    try {
      const directParams = new URLSearchParams({
        engine: 'google_ads_transparency_center',
        domain: normalizeDomain(domain),
        api_key: apiKey,
      });
      const directPayload = await fetchJson(`${BASE}?${directParams.toString()}`);
      const directAds = Array.isArray((directPayload as { ad_creatives?: unknown[] }).ad_creatives)
        ? (directPayload as { ad_creatives: unknown[] }).ad_creatives
        : [];
      const filtered = directAds.filter(
        (ad): ad is SearchApiAdRecord =>
          Boolean(ad) && typeof ad === 'object' && !Array.isArray(ad),
      );
      console.log(`[adlibrary] Google domain-direct for "${companyName}" (${domain}): ${filtered.length} ad_creatives`);
      if (filtered.length > 0) return filtered;
      // Fall through to name search if domain-direct returned nothing
      console.log(`[adlibrary] Google domain-direct for "${companyName}": 0 results, falling back to name search`);
    } catch (err) {
      if (err instanceof RateLimitError) throw err;
      console.log(`[adlibrary] Google domain-direct for "${companyName}": lookup failed, falling back to name search`);
    }
  }

  try {
    // Name-based advertiser search (primary for unverified, fallback for verified)
    const searchParams = new URLSearchParams({
      engine: 'google_ads_transparency_center_advertiser_search',
      q: companyName,
      api_key: apiKey,
    });
    const searchPayload = await fetchJson(`${BASE}?${searchParams.toString()}`);

    if (searchPayload && typeof searchPayload === 'object' && 'error' in searchPayload) {
      console.warn('[adlibrary] Google advertiser search not available:', (searchPayload as { error: string }).error);
      return [];
    }

    const advertisers = Array.isArray((searchPayload as { advertisers?: unknown[] }).advertisers)
      ? (searchPayload as { advertisers: unknown[] }).advertisers as Array<{ name?: string; id?: string }>
      : [];

    // Resolve best match using verdict-based identity verification
    const result = resolveBestCandidate(
      advertisers.map(a => ({ name: a.name ?? '', id: a.id ?? '', entity: a })),
      companyName,
      domain,
      isDomainVerified,
    );

    console.log(`[adlibrary] Google verdict for "${companyName}": ${result.verdict} — ${result.reason}`);

    if (result.verdict !== 'accepted' || !result.candidate) {
      return [];
    }

    // Step 2: Fetch ads by advertiser_id
    return fetchGoogleAdsByAdvertiserId(result.candidate.id, apiKey);
  } catch (err) {
    if (err instanceof RateLimitError) {
      console.warn(`[adlibrary] SearchAPI rate limited (${err.status}) for Google "${companyName}"`);
      throw err; // propagate so fetchWithRetry can apply rate-limit backoff
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[adlibrary] Google ads fetch failed for "${companyName}": ${msg}`);
    return [];
  }
}

async function fetchGoogleAdsByAdvertiserId(
  advertiserId: string,
  apiKey: string,
): Promise<SearchApiAdRecord[]> {
  const params = new URLSearchParams({
    engine: 'google_ads_transparency_center',
    advertiser_id: advertiserId,
    api_key: apiKey,
  });

  const payload = await fetchJson(
    `https://www.searchapi.io/api/v1/search?${params.toString()}`,
  );
  // SearchAPI returns the ads array under `ad_creatives`, NOT `ads`.
  // Prior code read `payload.ads` which was always undefined → empty array,
  // silently zeroing every Google ad fetch regardless of advertiser_id validity.
  const ads = Array.isArray((payload as { ad_creatives?: unknown[] }).ad_creatives)
    ? (payload as { ad_creatives: unknown[] }).ad_creatives
    : [];

  return ads.filter(
    (ad): ad is SearchApiAdRecord =>
      Boolean(ad) && typeof ad === 'object' && !Array.isArray(ad),
  );
}

/**
 * LinkedIn Ads: advertiser-first lookup.
 * Uses the `advertiser` param (NOT `q`) to search by company name.
 *
 * Wave 6e Layer 4: when we have a verified domain, post-filter ads whose
 * clickthrough URL doesn't point to that domain. This catches the
 * multi-company-same-name problem (e.g., FathomDEM+ terrain data ads
 * showing up when searching for Fathom.video AI meeting tool).
 */
export async function searchLinkedInAds(
  companyName: string,
  domain?: string,
  isDomainVerified?: boolean,
): Promise<SearchApiAdRecord[]> {
  const apiKey = process.env.SEARCHAPI_KEY;
  if (!apiKey) return [];

  const params = new URLSearchParams({
    engine: 'linkedin_ad_library',
    advertiser: companyName,
    api_key: apiKey,
  });

  try {
    const payload = await fetchJson(
      `https://www.searchapi.io/api/v1/search?${params.toString()}`,
    );
    const ads = Array.isArray((payload as { ads?: unknown[] }).ads)
      ? (payload as { ads: unknown[] }).ads
      : [];

    const allAds = ads.filter(
      (ad): ad is SearchApiAdRecord =>
        Boolean(ad) && typeof ad === 'object' && !Array.isArray(ad),
    );

    console.log(`[adlibrary] LinkedIn raw for "${companyName}": ${allAds.length} ads`);

    // Layer 4 post-filter: when we have a verified domain, drop ads ONLY when
    // we have STRONG evidence the destination is a different external domain.
    //
    // Important behaviors (Wave 6e Hole 4 fix, revised 2026-04-17):
    //   - Missing link → KEEP (LinkedIn omits links on awareness ads).
    //   - Link is a LinkedIn-hosted URL (linkedin.com or lnkd.in) → KEEP
    //     (we can't see the ultimate redirect target, and these are almost
    //     always first-party LinkedIn post/campaign URLs).
    //   - Link contains the verified domain (either as the host or as a
    //     URL-encoded redirect target) → KEEP.
    //   - Link points to a clearly different external domain → DROP.
    //
    // Trade-off: permissive by default. The downstream `isAdvertiserMatch` +
    // Hole 3 short-name URL guard provide a second filter pass.
    //
    // Historical note: the previous condition `decodedLink.includes('linkedin.com')
    // && !decodedLink.includes('http')` was self-contradictory (every full URL
    // includes 'http' in the scheme), so it dropped every LinkedIn-hosted ad
    // and zeroed out LinkedIn ad data for all competitors.
    if (domain && isDomainVerified && allAds.length > 0) {
      const normalizedDomain = normalizeDomain(domain);
      const domainBase = normalizedDomain.split('.')[0] ?? '';
      const domainTld = normalizedDomain.split('.').slice(1).join('').toLowerCase();
      // Short-name companies (≤6 chars) require POSITIVE domain corroboration
      // to avoid wrong-company ads. "Fathom" is ambiguous — fathom.ai (meeting
      // tool) vs fathom.com (flood risk) both have LinkedIn pages named "Fathom"
      // that return ads via the advertiser= param. The permissive default
      // (keep-on-missing-link, keep-on-linkedin-host) let 24 wrong-company
      // Fathom Global Flood Risk ads slip through. Tighten for short names.
      const isShortName = companyName.trim().length <= 6;
      const filtered = allAds.filter((ad) => {
        const rawLink = ad.link ?? '';
        const link = String(rawLink).toLowerCase();
        let decodedLink: string;
        try { decodedLink = decodeURIComponent(link); } catch { decodedLink = link; }
        // Link contains our verified domain (raw or URL-decoded inside a redirect).
        // LinkedIn redirect URLs encode dots as %2E (e.g. gong%2Eio vs gong.io),
        // so we must check both the raw link AND the decoded version.
        if (decodedLink && decodedLink.includes(normalizedDomain)) return true;
        // LinkedIn-hosted URL: try to extract the company/showcase slug and
        // cross-check against our domain. Slugs like "fathom-ai" corroborate
        // fathom.ai; plain "fathom" does NOT (could be fathom.com).
        const host = (() => {
          try { return decodedLink ? new URL(decodedLink).hostname.toLowerCase() : ''; } catch { return ''; }
        })();
        if (host.endsWith('linkedin.com') || host.endsWith('lnkd.in')) {
          const slugMatch = decodedLink.match(/linkedin\.com\/(?:company|showcase|in)\/([a-z0-9-]+)/i);
          if (slugMatch) {
            const slug = slugMatch[1].toLowerCase();
            // Slug contains base AND TLD → strong match: fathom.ai → fathom-ai
            if (domainBase && slug.includes(domainBase) && domainTld && slug.includes(domainTld)) {
              return true;
            }
            // Slug equals bare base only → ambiguous. Short-name: DROP.
            if (slug === domainBase || slug.startsWith(domainBase + '-') || slug.endsWith('-' + domainBase)) {
              return !isShortName;
            }
            // Slug doesn't corroborate base → wrong company, DROP.
            return false;
          }
          // LinkedIn URL with no extractable slug (feed post, search, etc.).
          // Short-name: drop (can't verify). Long-name: keep (existing behavior).
          return !isShortName;
        }
        // Missing link: short-name can't disambiguate → DROP. Long-name → KEEP.
        if (!link) return !isShortName;
        // Link is a clearly different external URL that doesn't contain our
        // verified domain → drop.
        return false;
      });
      const dropped = allAds.length - filtered.length;
      if (dropped > 0) {
        console.log(
          `[adlibrary] LinkedIn domain post-filter for "${companyName}" (${normalizedDomain}): kept ${filtered.length}, dropped ${dropped} wrong-company ads`,
        );
      } else {
        console.log(
          `[adlibrary] LinkedIn domain post-filter for "${companyName}" (${normalizedDomain}): kept all ${filtered.length} ads (no wrong-domain matches)`,
        );
      }
      return filtered;
    }

    return allAds;
  } catch (err) {
    if (err instanceof RateLimitError) {
      console.warn(`[adlibrary] SearchAPI rate limited (${err.status}) for LinkedIn "${companyName}"`);
      throw err; // propagate so fetchWithRetry can apply rate-limit backoff
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[adlibrary] LinkedIn ads fetch failed for "${companyName}": ${msg}`);
    return [];
  }
}

/**
 * Meta Ads: two-step advertiser-first lookup.
 *
 * When isDomainVerified=true (domain came from Wave 1 Sonar validation):
 *   Step 1: Search by domain first (meta_ad_library_page_search q=domain), then by name.
 *           Domain-first prevents Fathom AI vs Fathom.com confusion — the verified
 *           domain anchors identity before falling back to name-based disambiguation.
 *   Step 2: Fetch ads from the matched page_id.
 *
 * When isDomainVerified=false (inferred domain):
 *   Step 1: Search by name only (previous behavior).
 *   Step 2: Fetch ads from the matched page_id.
 */
export async function searchMetaAds(
  companyName: string,
  domain?: string,
  isDomainVerified?: boolean,
): Promise<SearchApiAdRecord[]> {
  const apiKey = process.env.SEARCHAPI_KEY;
  if (!apiKey) return [];

  const BASE = 'https://www.searchapi.io/api/v1/search';

  try {
    let pageResults: Array<{ name?: string; page_id?: string; likes?: number }> = [];

    // When we have a Wave 1 verified domain, search by domain first.
    // Meta's page search supports domain queries and returns the canonical brand page,
    // bypassing the name-matching ambiguity that causes false positives for short names.
    if (domain && isDomainVerified) {
      try {
        const domainSearchParams = new URLSearchParams({
          engine: 'meta_ad_library_page_search',
          q: normalizeDomain(domain),
          api_key: apiKey,
        });
        const domainPagePayload = await fetchJson(`${BASE}?${domainSearchParams.toString()}`);
        const domainPageResults = Array.isArray((domainPagePayload as { page_results?: unknown[] }).page_results)
          ? (domainPagePayload as { page_results: unknown[] }).page_results as Array<{ name?: string; page_id?: string; likes?: number }>
          : [];

        if (domainPageResults.length > 0) {
          console.log(`[adlibrary] Meta domain-first for "${companyName}": found ${domainPageResults.length} page(s) via verified domain "${domain}"`);
          pageResults = domainPageResults;
        }
      } catch {
        console.log(`[adlibrary] Meta domain-first for "${companyName}": domain search failed, falling back to name search`);
      }
    }

    // Fall back to (or use as primary when unverified) name-based page search
    if (pageResults.length === 0) {
      const pageSearchParams = new URLSearchParams({
        engine: 'meta_ad_library_page_search',
        q: companyName,
        api_key: apiKey,
      });
      const pagePayload = await fetchJson(`${BASE}?${pageSearchParams.toString()}`);
      pageResults = Array.isArray((pagePayload as { page_results?: unknown[] }).page_results)
        ? (pagePayload as { page_results: unknown[] }).page_results as Array<{ name?: string; page_id?: string; likes?: number }>
        : [];
    }

    // Resolve best page match using verdict-based identity verification
    const result = resolveBestCandidate(
      pageResults.map(p => ({ name: p.name ?? '', id: p.page_id ?? '', entity: p })),
      companyName,
      domain,
      isDomainVerified,
    );

    console.log(`[adlibrary] Meta verdict for "${companyName}": ${result.verdict} — ${result.reason}`);

    if (result.verdict !== 'accepted' || !result.candidate) return [];

    // Step 2: Fetch ads from the matched page.
    // active_status=all: include both active AND inactive ads (don't rely on
    // default which may exclude what we want).
    // No country filter: country=US was over-filtering — Meta ads targeted
    // globally or to non-US regions were being excluded, producing false zeros
    // for major advertisers like Gong and Fireflies.
    const adParams = new URLSearchParams({
      engine: 'meta_ad_library',
      page_id: result.candidate.id,
      active_status: 'all',
      api_key: apiKey,
    });
    const adPayload = await fetchJson(`${BASE}?${adParams.toString()}`);
    const ads = Array.isArray((adPayload as { ads?: unknown[] }).ads)
      ? (adPayload as { ads: unknown[] }).ads
      : [];
    console.log(`[adlibrary] Meta ad fetch for "${companyName}" (page_id=${result.candidate.id}): ${ads.length} ads`);

    return ads.filter(
      (ad): ad is SearchApiAdRecord =>
        Boolean(ad) && typeof ad === 'object' && !Array.isArray(ad),
    );
  } catch (err) {
    if (err instanceof RateLimitError) {
      console.warn(`[adlibrary] SearchAPI rate limited (${err.status}) for Meta "${companyName}"`);
      throw err; // propagate so fetchWithRetry can apply rate-limit backoff
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[adlibrary] Meta ads fetch failed for "${companyName}": ${msg}`);
    return [];
  }
}

async function searchForeplayAds(domain: string): Promise<ForeplayAdRecord[]> {
  const apiKey = process.env.FOREPLAY_API_KEY;
  if (!apiKey || process.env.ENABLE_FOREPLAY !== 'true') {
    return [];
  }

  const normalizedDomain = normalizeDomain(domain);
  const brandParams = new URLSearchParams({
    domain: normalizedDomain,
    limit: '1',
    order: 'most_ranked',
  });
  const brandPayload = await fetchJson(
    `https://public.api.foreplay.co/api/brand/getBrandsByDomain?${brandParams.toString()}`,
    {
      headers: {
        Authorization: apiKey,
        Accept: 'application/json',
      },
    },
    FOREPLAY_TIMEOUT_MS,
  );

  const brands = Array.isArray((brandPayload as { data?: unknown[] }).data)
    ? (brandPayload as { data: unknown[] }).data
    : Array.isArray(brandPayload)
      ? (brandPayload as unknown[])
      : [];
  const primaryBrand = brands.find(
    (brand): brand is ForeplayBrand =>
      Boolean(brand) &&
      typeof brand === 'object' &&
      !Array.isArray(brand) &&
      Boolean((brand as ForeplayBrand).id ?? (brand as ForeplayBrand).brand_id),
  );

  const brandId = primaryBrand?.id ?? primaryBrand?.brand_id;
  if (!brandId) {
    return [];
  }

  const adParams = new URLSearchParams({
    brand_ids: brandId,
    limit: '12',
    order: 'newest',
  });
  const adPayload = await fetchJson(
    `https://public.api.foreplay.co/api/brand/getAdsByBrandId?${adParams.toString()}`,
    {
      headers: {
        Authorization: apiKey,
        Accept: 'application/json',
      },
    },
    FOREPLAY_TIMEOUT_MS,
  );

  const ads = Array.isArray((adPayload as { data?: unknown[] }).data)
    ? (adPayload as { data: unknown[] }).data
    : Array.isArray(adPayload)
      ? (adPayload as unknown[])
      : [];

  return ads.filter(
    (ad): ad is ForeplayAdRecord =>
      Boolean(ad) && typeof ad === 'object' && !Array.isArray(ad),
  );
}

// --- Normalization to WorkerAdCreative ---

function guessFormat(
  record: SearchApiAdRecord,
): WorkerAdCreative['format'] {
  if (record.format) {
    const f = record.format.toLowerCase();
    if (f.includes('video')) return 'video';
    if (f.includes('carousel')) return 'carousel';
    if (f.includes('image')) return 'image';
    if (f.includes('text')) return 'text';
  }
  if (record.video_url) return 'video';
  if (record.image_url) return 'image';
  return 'unknown';
}

function guessPlatform(
  record: SearchApiAdRecord,
  sourcePlatform: WorkerAdPlatform,
): WorkerAdPlatform {
  if (record.platform) {
    const p = record.platform.toLowerCase();
    if (p.includes('linkedin')) return 'linkedin';
    if (p.includes('meta') || p.includes('facebook') || p.includes('instagram'))
      return 'meta';
    if (p.includes('google')) return 'google';
  }
  return sourcePlatform;
}

export function normalizeSearchApiToCreatives(
  records: SearchApiAdRecord[],
  sourcePlatform: WorkerAdPlatform,
  companyName: string,
  domain?: string,
  opts?: { skipAdvertiserMatch?: boolean },
): WorkerAdCreative[] {
  return records
    .filter((record) => {
      // Keyword-sourced ads are ads from OTHER advertisers in the same
      // category — advertiser match would always reject them. Callers who
      // source ads by category-keyword opt out of the safety net here.
      if (opts?.skipAdvertiserMatch) return true;
      // With advertiser-first lookup, all platforms now return targeted results.
      // Still apply advertiser matching as a safety net.
      const advertiserName =
        record.advertiser_name ??
        record.page_name ??                          // Meta top-level
        record.snapshot?.page_name ??                // Meta snapshot
        record.advertiser?.promotor ??               // LinkedIn (sponsoring brand)
        record.advertiser?.name;                     // LinkedIn (person name)
      return isAdvertiserMatch(advertiserName, companyName, domain);
    })
    .map((record, index) => {
      const snap = record.snapshot;
      const content = record.content;

      // Extract headline from all possible locations
      const headline = firstNonEmpty([
        record.headline,
        record.title,
        snap?.title,
        snap?.caption,
        snap?.cards?.[0]?.title,
        content?.headline,
      ]);

      // Extract body from all possible locations (handle body as object or string)
      const snapBodyText = snap?.body
        ? typeof snap.body === 'string' ? snap.body : snap.body.text
        : undefined;
      const recordBodyText = record.body
        ? typeof record.body === 'string' ? record.body : record.body.text
        : undefined;
      const body = firstNonEmpty([
        record.description,
        recordBodyText,
        record.text,
        snapBodyText,
        snap?.cards?.[0]?.body,
        content?.body,
      ]);

      // Extract image URL from all possible locations
      const snapFirstImage = snap?.images?.[0];
      const snapImageUrl = typeof snapFirstImage === 'string'
        ? snapFirstImage
        : (snapFirstImage as { url?: string } | undefined)?.url;
      const imageUrl = firstNonEmpty([
        record.image_url,
        snapImageUrl,
        snap?.cards?.[0]?.original_image_url,
        snap?.videos?.[0]?.video_preview_image_url,
        content?.image,
        record.advertiser?.thumbnail,
      ]);

      // Extract video URL
      const videoUrl = firstNonEmpty([
        record.video_url,
        snap?.videos?.[0]?.video_hd_url,
      ]);

      // Extract advertiser name
      const advertiser =
        record.advertiser_name ??
        record.page_name ??
        record.advertiser?.promotor ??
        record.advertiser?.name ??
        companyName;

      // Extract format — check nested display_format too
      const displayFormat = snap?.display_format ?? record.ad_type ?? record.format;
      let format = guessFormat(record);
      if (displayFormat) {
        const df = displayFormat.toUpperCase();
        if (df === 'VIDEO' || df.includes('VIDEO')) format = 'video';
        else if (df === 'IMAGE' || df.includes('IMAGE')) format = 'image';
        else if (df === 'CAROUSEL' || df.includes('CAROUSEL')) format = 'carousel';
        else if (df === 'TEXT' || df.includes('TEXT')) format = 'text';
      }
      // Override based on actual media presence
      if (videoUrl && format === 'unknown') format = 'video';
      else if (imageUrl && format === 'unknown') format = 'image';

      // Extract dates
      const firstSeen = record.first_shown ?? record.start_date_formatted ?? undefined;
      const lastSeen = record.last_shown ?? record.end_date_formatted ?? undefined;

      // Extract details URL with platform-aware fallback construction.
      // Wave 6e Meta UX fix: when SearchAPI doesn't return a details_url for a
      // Meta ad, construct one from the ad_archive_id so the user can ALWAYS
      // click through to the original ad in the Meta Ad Library. Same idea for
      // Google (advertiser_id) and LinkedIn (when we have a known ad ID).
      let detailsUrl = firstNonEmpty([
        record.details_url,
        record.ad_library_url,
        record.link,
      ]);
      if (!detailsUrl) {
        const platform = guessPlatform(record, sourcePlatform);
        if (platform === 'meta' && record.ad_archive_id) {
          detailsUrl = `https://www.facebook.com/ads/library/?id=${record.ad_archive_id}`;
        } else if (platform === 'google' && record.advertiser_id) {
          detailsUrl = `https://adstransparency.google.com/advertiser/${record.advertiser_id}`;
        }
      }

      return {
        platform: guessPlatform(record, sourcePlatform),
        id: record.ad_id ?? record.ad_archive_id ?? record.id ?? `${sourcePlatform}-${index}`,
        advertiser,
        headline,
        body,
        imageUrl,
        videoUrl,
        format,
        isActive: record.is_active ?? true,
        firstSeen,
        lastSeen,
        detailsUrl,
      };
    })
    .filter((creative) => {
      // Quality gate: reject ads with unresolved template variables or no content.
      // Meta DCO ads contain {{product.name}}, {{product.brand}}, etc. — raw templates
      // that were never rendered. These are useless to show.
      const hasTemplate = /\{\{[^}]+\}\}/.test(creative.headline ?? '') ||
        /\{\{[^}]+\}\}/.test(creative.body ?? '') ||
        /\{\{[^}]+\}\}/.test(creative.advertiser ?? '');
      if (hasTemplate) return false;

      // Reject ads with no meaningful content — no headline AND no body AND no image
      const hasText = (creative.headline && creative.headline.trim().length > 3) ||
        (creative.body && creative.body.trim().length > 10);
      const hasMedia = !!creative.imageUrl || !!creative.videoUrl;
      if (!hasText && !hasMedia) return false;

      return true;
    });
}

/** Return the first non-empty string from candidates */
function firstNonEmpty(candidates: (string | undefined | null)[]): string | undefined {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) return c.trim();
  }
  return undefined;
}

// --- Library link generation ---

function deriveGoogleAdvertiserUrl(
  creatives: WorkerAdCreative[],
  domain?: string,
  companyName?: string,
): string {
  const googleCreative = creatives.find(
    (c) =>
      c.platform === 'google' &&
      c.detailsUrl?.includes('adstransparency.google.com'),
  );

  if (googleCreative?.detailsUrl) {
    const url = googleCreative.detailsUrl;
    return url.includes('?') ? url : `${url}?region=US`;
  }

  if (domain) {
    const d = normalizeDomain(domain);
    return `https://adstransparency.google.com/?region=anywhere&q=${encodeURIComponent(d)}`;
  }

  return `https://adstransparency.google.com/?region=anywhere&q=${encodeURIComponent(companyName ?? '')}`;
}

export function buildLibraryLinks(
  companyName: string,
  domain?: string,
  creatives?: WorkerAdCreative[],
): WorkerLibraryLinks {
  const encodedName = encodeURIComponent(companyName.trim());
  return {
    metaLibraryUrl: `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&q=${encodedName}&search_type=keyword_unordered&media_type=all`,
    linkedInLibraryUrl: `https://www.linkedin.com/ad-library/search?keyword=${encodedName}`,
    googleAdvertiserUrl: deriveGoogleAdvertiserUrl(
      creatives ?? [],
      domain,
      companyName,
    ),
  };
}

// --- Build full insight ---

export function buildAdInsight(
  googleAds: SearchApiAdRecord[],
  linkedInAds: SearchApiAdRecord[],
  metaAds: SearchApiAdRecord[],
  foreplayAds: ForeplayAdRecord[],
  companyName: string,
  domain?: string,
): WorkerAdInsight {
  // Normalize to creatives with advertiser matching
  const googleCreatives = normalizeSearchApiToCreatives(
    googleAds, 'google', companyName, domain,
  );
  const linkedInCreatives = normalizeSearchApiToCreatives(
    linkedInAds, 'linkedin', companyName, domain,
  );
  const metaCreatives = normalizeSearchApiToCreatives(
    metaAds, 'meta', companyName, domain,
  );
  // Deduplicate ads — check BOTH id AND content fingerprint
  const seenIds = new Set<string>();
  const seenFingerprints = new Set<string>();
  const adCreatives = [...googleCreatives, ...linkedInCreatives, ...metaCreatives].filter((ad) => {
    // Primary key: ad id (if non-fallback)
    if (ad.id && !ad.id.includes('-')) {
      if (seenIds.has(ad.id)) return false;
      seenIds.add(ad.id);
    }
    // Secondary key: content fingerprint — ALWAYS checked (catches same content with different IDs)
    const fingerprint = `${ad.platform}|${(ad.headline ?? '').slice(0, 80).toLowerCase().trim()}|${(ad.body ?? '').slice(0, 80).toLowerCase().trim()}|${ad.imageUrl ?? ''}`;
    if (seenFingerprints.has(fingerprint)) return false;
    seenFingerprints.add(fingerprint);
    return true;
  });

  // Build summary from all sources
  const allRawAds = [
    ...googleAds,
    ...linkedInAds,
    ...metaAds,
    ...foreplayAds,
  ];
  const platforms = [
    ...new Set(
      adCreatives
        .map((c) => c.platform)
        .filter((p): p is WorkerAdPlatform => Boolean(p)),
    ),
  ];
  const messages = allRawAds
    .map((ad) => extractMessage(ad as Record<string, unknown>))
    .filter((message): message is string => Boolean(message));
  const themes = [...new Set(messages.map(guessTheme))].slice(0, 3);
  const sampleMessages = [...new Set(messages)].slice(0, 3);

  const totalSearchApiAds = googleAds.length + linkedInAds.length + metaAds.length;
  const sourceConfidence: WorkerAdInsight['summary']['sourceConfidence'] =
    totalSearchApiAds >= 3 && foreplayAds.length > 0
      ? 'high'
      : totalSearchApiAds > 0
        ? 'medium'
        : 'low';

  const normalizedPlatforms =
    platforms.length > 0
      ? platforms
      : totalSearchApiAds > 0
        ? ['Google']
        : ['Not verified'];

  const evidence =
    totalSearchApiAds > 0 && foreplayAds.length > 0
      ? `Observed ${totalSearchApiAds} current ad-library records and ${foreplayAds.length} historical creative records. Coverage is partial across platforms.`
      : totalSearchApiAds > 0
        ? `Observed ${totalSearchApiAds} current ad-library records. Multi-platform active coverage is not fully verified.`
        : foreplayAds.length > 0
          ? `Limited coverage: ${foreplayAds.length} historical creative records only. Current active ads are not verified.`
          : 'Not verified: no ad-library sources were configured or returned results.';

  const libraryLinks = buildLibraryLinks(companyName, domain, adCreatives);

  return {
    summary: {
      // Never claim ads we can't show. If normalization drops all ads,
      // reporting the raw count inflates the number with nothing to display.
      activeAdCount: adCreatives.length,
      platforms: normalizedPlatforms,
      themes,
      evidence,
      sourceConfidence,
      sampleMessages,
    },
    adCreatives,
    libraryLinks,
    sourcesUsed: {
      linkedin: linkedInAds.length,
      meta: metaAds.length,
      google: googleAds.length,
      foreplay: foreplayAds.length,
    },
  };
}

export const adLibraryTool = betaZodTool({
  name: 'adLibrary',
  description:
    'Fetch competitor ad activity and creative intelligence from public ad libraries. Returns structured platform coverage, ad creatives, library links, and source-confidence summaries.',
  inputSchema: z.object({
    companyName: z.string().describe('The company name to search for ads'),
    domain: z.string().optional().describe('The competitor domain (e.g. "salesforce.com")'),
  }),
  run: async ({ companyName, domain }) => {
    try {
      // Fetch from all platforms in parallel using advertiser-first lookup
      const [googleAds, linkedInAds, metaAds] = await Promise.all([
        searchGoogleAds(companyName, domain).catch(() => [] as SearchApiAdRecord[]),
        searchLinkedInAds(companyName, domain).catch(() => [] as SearchApiAdRecord[]),
        searchMetaAds(companyName, domain).catch(() => [] as SearchApiAdRecord[]),
      ]);

      const totalSearchApi = googleAds.length + linkedInAds.length + metaAds.length;
      const foreplayAds =
        domain && totalSearchApi < 3
          ? await searchForeplayAds(domain)
          : [];

      const insight = buildAdInsight(
        googleAds, linkedInAds, metaAds, foreplayAds, companyName, domain,
      );

      return JSON.stringify(insight);
    } catch (error) {
      const libraryLinks = buildLibraryLinks(companyName, domain);
      return JSON.stringify({
        summary: {
          activeAdCount: 0,
          platforms: [],
          themes: [],
          evidence:
            error instanceof Error
              ? error.message
              : 'Ad activity lookup failed.',
          sourceConfidence: 'low',
          sampleMessages: [],
        },
        adCreatives: [],
        libraryLinks,
        sourcesUsed: {
          linkedin: 0,
          meta: 0,
          google: 0,
          foreplay: 0,
        },
      } satisfies WorkerAdInsight);
    }
  },
});
