/**
 * Standalone ads collector. Pulls live ads from:
 *   - Meta Ad Library         (meta_ad_library_page_search → meta_ad_library)
 *   - LinkedIn Ad Library     (linkedin_ad_library with advertiser=)
 *   - Google Ads Transparency (advertiser_search → google_ads_transparency_center)
 *
 * Mirrors research-worker/src/tools/adlibrary.ts for call shape, but
 * uses a local identity resolver (scripts/name-matcher.ts) and a 24h disk cache
 * (scripts/cache.ts) so repeat runs don't burn SearchAPI credits.
 *
 * Output: array of per-competitor-per-platform inventory fragments shaped for
 * the schemas in schemas/output.ts. When a platform yields 0 ads, the
 * corresponding library URL is still preserved as source_url — nothing is
 * fabricated.
 *
 * Usage:
 *   SEARCHAPI_KEY=... npx tsx scripts/fetch-ads.ts <competitor_name> [domain]
 *   SEARCHAPI_KEY=... npx tsx scripts/fetch-ads.ts --batch competitors.json [--platforms meta,linkedin,google]
 */
import * as fs from "fs";
import { cachedFetch } from "./cache.ts";
import { resolveBestCandidate, type Candidate } from "./name-matcher.ts";

const SEARCH_API_BASE = "https://www.searchapi.io/api/v1/search";
const REQUEST_TIMEOUT_MS = 12_000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type Platform = "meta" | "linkedin" | "google";
const DEFAULT_PLATFORMS: Platform[] = ["meta", "linkedin", "google"];

// ── SearchAPI raw shape ─────────────────────────────────────────────────

interface MetaPage {
  name?: string;
  page_id?: string;
  likes?: number;
}

interface MetaAd {
  ad_archive_id?: string;
  page_name?: string;
  start_date?: string | number;
  end_date?: string | number;
  publisher_platform?: string[];
  targeted_or_reached_countries?: string[];
  snapshot?: {
    title?: string;
    caption?: string;
    body?: { text?: string } | string;
    cta_text?: string;
    display_format?: string;
    images?: unknown[];
    videos?: unknown[];
    cards?: unknown[];
  };
}

interface LinkedInAd {
  headline?: string;
  content?: { headline?: string; body?: string };
  advertiser?: { name?: string };
  body?: string;
  text?: string;
  first_shown?: string;
  last_shown?: string;
  ad_type?: string;
  link?: string;
}

interface GoogleAd {
  advertiser?: string;
  advertiser_id?: string;
  format?: string;
  first_shown?: string;
  last_shown?: string;
  headline?: string;
  body?: string;
  description?: string;
  destination_url?: string;
  image_url?: string;
  video_url?: string;
  target_regions?: string[];
}

// ── output shape ────────────────────────────────────────────────────────

interface AdInventoryFragment {
  name: string;
  active_ad_count: number;
  run_duration_range: string;
  formats: Array<"image" | "video" | "carousel" | "collection" | "other">;
  hook_strings_verbatim: string[];
  cta_patterns: string[];
  ad_library_url: string;
  source_url: string;
  retrieved_at: string;
}

interface AdSignalFragment {
  name: string;
  always_on_vs_burst: "always_on" | "burst" | "mixed" | "unknown";
  refresh_cadence_days: number;
  geo_targeting_visible: string[];
  source_url?: string;
  retrieved_at?: string;
}

interface PlatformResult {
  platform: Platform;
  paid_social_ad_inventory: AdInventoryFragment;
  ad_activity_signals: AdSignalFragment;
}

// ── helpers ─────────────────────────────────────────────────────────────

function normalizeDomain(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0] ?? value;
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} for ${url.replace(/api_key=[^&]*/, "api_key=REDACTED")}`);
    (err as Error & { status: number }).status = res.status;
    throw err;
  }
  return res.json();
}

async function cachedSearchApi(url: string): Promise<unknown> {
  const { value, fromCache } = await cachedFetch(url, () => fetchJson(url), {
    ttlMs: CACHE_TTL_MS,
  });
  if (fromCache && process.env.DEBUG_FETCH_ADS) {
    process.stderr.write(`[fetch-ads] cache hit: ${url.replace(/api_key=[^&]*/, "api_key=REDACTED")}\n`);
  }
  return value;
}

function metaLibraryUrl(query: string): string {
  return `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&q=${encodeURIComponent(query)}`;
}
function linkedinLibraryUrl(name: string): string {
  return `https://www.linkedin.com/ad-library/search?companyName=${encodeURIComponent(name)}`;
}
function googleLibraryUrl(domain: string | undefined, name: string): string {
  if (domain) return `https://adstransparency.google.com/?domain=${encodeURIComponent(normalizeDomain(domain))}&region=US`;
  return `https://adstransparency.google.com/?query=${encodeURIComponent(name)}&region=US`;
}

function cleanHook(raw: string | undefined): string | null {
  if (!raw) return null;
  let s = raw.trim();
  if (!s) return null;
  if (/^\s*\{\{[^}]+\}\}\s*$/.test(s)) return null;
  s = s.replace(/\{\{[^}]+\}\}/g, "").trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s) || /^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/\S*)?$/i.test(s)) return null;
  const first = s.split(/(?<=[.!?])\s+/)[0] ?? s;
  return first.length > 200 ? first.slice(0, 197) + "..." : first;
}

function parseAdTimestamp(v: string | number | undefined): number {
  if (v == null) return NaN;
  if (typeof v === "number") return v < 1e12 ? v * 1000 : v;
  return Date.parse(v);
}

function summarizeDateRange(starts: number[], ends: number[]): string {
  if (!starts.length) return "unavailable";
  const first = new Date(Math.min(...starts)).toISOString().slice(0, 10);
  const last = ends.length ? new Date(Math.max(...ends)).toISOString().slice(0, 10) : "present";
  return `${first} to ${last}`;
}

function classifyCadence(starts: number[]): {
  always_on_vs_burst: AdSignalFragment["always_on_vs_burst"];
  refresh_cadence_days: number;
} {
  if (starts.length < 2) return { always_on_vs_burst: "unknown", refresh_cadence_days: 0 };
  const sorted = [...starts].sort((a, b) => a - b);
  const span = (sorted[sorted.length - 1] - sorted[0]) / 86_400_000;
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) gaps.push((sorted[i] - sorted[i - 1]) / 86_400_000);
  const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const verdict: AdSignalFragment["always_on_vs_burst"] =
    span >= 90 && avg <= 14 ? "always_on" : span < 60 ? "burst" : "mixed";
  return { always_on_vs_burst: verdict, refresh_cadence_days: Math.round(avg) };
}

function dedup<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function blankInventory(name: string, libraryUrl: string, platform: Platform): AdInventoryFragment {
  return {
    name: `${name} · ${platformLabel(platform)}`,
    active_ad_count: 0,
    run_duration_range: "unavailable",
    formats: [],
    hook_strings_verbatim: [],
    cta_patterns: [],
    ad_library_url: libraryUrl,
    source_url: libraryUrl,
    retrieved_at: new Date().toISOString(),
  };
}
function blankSignal(name: string, libraryUrl: string, platform: Platform): AdSignalFragment {
  return {
    name: `${name} · ${platformLabel(platform)}`,
    always_on_vs_burst: "unknown",
    refresh_cadence_days: 0,
    geo_targeting_visible: [],
    source_url: libraryUrl,
    retrieved_at: new Date().toISOString(),
  };
}
function platformLabel(p: Platform): string {
  return p === "meta" ? "Meta" : p === "linkedin" ? "LinkedIn" : "Google";
}

// ── Meta ────────────────────────────────────────────────────────────────

async function collectMeta(
  name: string,
  domain: string | undefined,
  apiKey: string,
): Promise<PlatformResult> {
  const libraryUrl = metaLibraryUrl(domain ?? name);
  const empty: PlatformResult = {
    platform: "meta",
    paid_social_ad_inventory: blankInventory(name, libraryUrl, "meta"),
    ad_activity_signals: blankSignal(name, libraryUrl, "meta"),
  };

  // Step 1: resolve page_id. Try domain first (stronger signal), then name.
  const candidates: Candidate[] = [];
  const queries = [domain ? normalizeDomain(domain) : null, name].filter((q): q is string => Boolean(q));
  for (const q of queries) {
    const params = new URLSearchParams({
      engine: "meta_ad_library_page_search",
      q,
      api_key: apiKey,
    });
    try {
      const payload = (await cachedSearchApi(`${SEARCH_API_BASE}?${params.toString()}`)) as {
        page_results?: MetaPage[];
      };
      for (const p of payload.page_results ?? []) {
        if (p.page_id && p.name) candidates.push({ name: p.name, id: p.page_id });
      }
      if (candidates.length) break;
    } catch (err) {
      process.stderr.write(
        `[fetch-ads][meta] page search "${q}" failed: ${(err as Error).message}\n`,
      );
    }
  }

  if (!candidates.length) return empty;

  const result = resolveBestCandidate(candidates, name, domain, Boolean(domain));
  process.stderr.write(`[fetch-ads][meta] "${name}": ${result.verdict} — ${result.reason}\n`);
  if (result.verdict === "rejected" || !result.candidate) return empty;

  // Step 2: fetch ads by page_id
  const adParams = new URLSearchParams({
    engine: "meta_ad_library",
    page_id: result.candidate.id,
    active_status: "all",
    api_key: apiKey,
  });
  const adPayload = (await cachedSearchApi(`${SEARCH_API_BASE}?${adParams.toString()}`)) as {
    ads?: MetaAd[];
  };
  const ads = Array.isArray(adPayload.ads) ? adPayload.ads : [];
  if (!ads.length) return empty;

  const hooks = dedup(
    ads.map((a) => {
      const snap = a.snapshot;
      const body = typeof snap?.body === "object" && snap?.body ? snap.body.text : (snap?.body as string | undefined);
      return [snap?.title, snap?.caption, body]
        .map(cleanHook)
        .find((x): x is string => Boolean(x));
    }).filter((x): x is string => Boolean(x)),
  ).slice(0, 8);
  const ctas = dedup(
    ads.map((a) => a.snapshot?.cta_text).filter((c): c is string => Boolean(c && c.trim())),
  ).slice(0, 6);
  const formats = dedup(
    ads.map((a): AdInventoryFragment["formats"][number] => {
      const snap = a.snapshot;
      if (Array.isArray(snap?.cards) && snap.cards.length > 1) return "carousel";
      if (Array.isArray(snap?.videos) && snap.videos.length) return "video";
      if (Array.isArray(snap?.images) && snap.images.length) return "image";
      const df = (snap?.display_format ?? "").toLowerCase();
      if (df.includes("video")) return "video";
      if (df.includes("carousel")) return "carousel";
      if (df.includes("image")) return "image";
      return "other";
    }),
  );
  const starts = ads.map((a) => parseAdTimestamp(a.start_date)).filter((n) => !Number.isNaN(n));
  const ends = ads.map((a) => parseAdTimestamp(a.end_date)).filter((n) => !Number.isNaN(n));
  const cadence = classifyCadence(starts);
  const geos = dedup(ads.flatMap((a) => a.targeted_or_reached_countries ?? a.publisher_platform ?? []));

  const retrievedAt = new Date().toISOString();
  return {
    platform: "meta",
    paid_social_ad_inventory: {
      name: `${name} · Meta`,
      active_ad_count: ads.length,
      run_duration_range: summarizeDateRange(starts, ends),
      formats,
      hook_strings_verbatim: hooks,
      cta_patterns: ctas,
      ad_library_url: libraryUrl,
      source_url: libraryUrl,
      retrieved_at: retrievedAt,
    },
    ad_activity_signals: {
      name: `${name} · Meta`,
      always_on_vs_burst: cadence.always_on_vs_burst,
      refresh_cadence_days: cadence.refresh_cadence_days,
      geo_targeting_visible: geos,
      source_url: libraryUrl,
      retrieved_at: retrievedAt,
    },
  };
}

// ── LinkedIn ────────────────────────────────────────────────────────────

async function collectLinkedIn(name: string, apiKey: string): Promise<PlatformResult> {
  const libraryUrl = linkedinLibraryUrl(name);
  const empty: PlatformResult = {
    platform: "linkedin",
    paid_social_ad_inventory: blankInventory(name, libraryUrl, "linkedin"),
    ad_activity_signals: blankSignal(name, libraryUrl, "linkedin"),
  };

  const params = new URLSearchParams({
    engine: "linkedin_ad_library",
    advertiser: name,
    api_key: apiKey,
  });
  try {
    const payload = (await cachedSearchApi(`${SEARCH_API_BASE}?${params.toString()}`)) as {
      ads?: LinkedInAd[];
    };
    const ads = Array.isArray(payload.ads) ? payload.ads : [];
    if (!ads.length) return empty;

    const hooks = dedup(
      ads.map((a) => cleanHook(a.headline ?? a.content?.headline ?? a.text ?? a.body))
        .filter((x): x is string => Boolean(x)),
    ).slice(0, 8);
    const starts = ads.map((a) => parseAdTimestamp(a.first_shown)).filter((n) => !Number.isNaN(n));
    const ends = ads.map((a) => parseAdTimestamp(a.last_shown)).filter((n) => !Number.isNaN(n));
    const cadence = classifyCadence(starts);
    const formats = dedup(
      ads.map((a): AdInventoryFragment["formats"][number] => {
        const t = (a.ad_type ?? "").toLowerCase();
        if (t.includes("video")) return "video";
        if (t.includes("carousel")) return "carousel";
        if (t.includes("image") || t.includes("single")) return "image";
        return "other";
      }),
    );

    const retrievedAt = new Date().toISOString();
    return {
      platform: "linkedin",
      paid_social_ad_inventory: {
        name: `${name} · LinkedIn`,
        active_ad_count: ads.length,
        run_duration_range: summarizeDateRange(starts, ends),
        formats,
        hook_strings_verbatim: hooks,
        cta_patterns: [], // LinkedIn SearchAPI rarely exposes CTA text as a discrete field
        ad_library_url: libraryUrl,
        source_url: libraryUrl,
        retrieved_at: retrievedAt,
      },
      ad_activity_signals: {
        name: `${name} · LinkedIn`,
        always_on_vs_burst: cadence.always_on_vs_burst,
        refresh_cadence_days: cadence.refresh_cadence_days,
        geo_targeting_visible: [],
        source_url: libraryUrl,
        retrieved_at: retrievedAt,
      },
    };
  } catch (err) {
    process.stderr.write(`[fetch-ads][linkedin] "${name}": ${(err as Error).message}\n`);
    return empty;
  }
}

// ── Google Ads Transparency ────────────────────────────────────────────

async function collectGoogle(
  name: string,
  domain: string | undefined,
  apiKey: string,
): Promise<PlatformResult> {
  const libraryUrl = googleLibraryUrl(domain, name);
  const empty: PlatformResult = {
    platform: "google",
    paid_social_ad_inventory: blankInventory(name, libraryUrl, "google"),
    ad_activity_signals: blankSignal(name, libraryUrl, "google"),
  };

  let ads: GoogleAd[] = [];

  // Path 1: domain-direct (cheapest + most accurate when verified)
  if (domain) {
    const params = new URLSearchParams({
      engine: "google_ads_transparency_center",
      domain: normalizeDomain(domain),
      api_key: apiKey,
    });
    try {
      const payload = (await cachedSearchApi(`${SEARCH_API_BASE}?${params.toString()}`)) as {
        ad_creatives?: GoogleAd[];
      };
      ads = Array.isArray(payload.ad_creatives) ? payload.ad_creatives : [];
    } catch (err) {
      process.stderr.write(
        `[fetch-ads][google] domain "${domain}": ${(err as Error).message}\n`,
      );
    }
  }

  // Path 2: advertiser_search fallback + resolver
  if (!ads.length) {
    const searchParams = new URLSearchParams({
      engine: "google_ads_transparency_center_advertiser_search",
      q: name,
      api_key: apiKey,
    });
    try {
      const payload = (await cachedSearchApi(`${SEARCH_API_BASE}?${searchParams.toString()}`)) as {
        advertisers?: Array<{ name?: string; id?: string }>;
        error?: string;
      };
      if (payload.error) {
        process.stderr.write(`[fetch-ads][google] search error: ${payload.error}\n`);
        return empty;
      }
      const candidates: Candidate[] = (payload.advertisers ?? [])
        .filter((a) => a.id && a.name)
        .map((a) => ({ name: a.name as string, id: a.id as string }));
      if (!candidates.length) return empty;
      const result = resolveBestCandidate(candidates, name, domain, Boolean(domain));
      process.stderr.write(`[fetch-ads][google] "${name}": ${result.verdict} — ${result.reason}\n`);
      if (result.verdict === "rejected" || !result.candidate) return empty;

      const adParams = new URLSearchParams({
        engine: "google_ads_transparency_center",
        advertiser_id: result.candidate.id,
        api_key: apiKey,
      });
      const adPayload = (await cachedSearchApi(`${SEARCH_API_BASE}?${adParams.toString()}`)) as {
        ad_creatives?: GoogleAd[];
      };
      ads = Array.isArray(adPayload.ad_creatives) ? adPayload.ad_creatives : [];
    } catch (err) {
      process.stderr.write(
        `[fetch-ads][google] advertiser fallback for "${name}": ${(err as Error).message}\n`,
      );
      return empty;
    }
  }

  if (!ads.length) return empty;

  const hooks = dedup(
    ads.map((a) => cleanHook(a.headline ?? a.description ?? a.body))
      .filter((x): x is string => Boolean(x)),
  ).slice(0, 8);
  const starts = ads.map((a) => parseAdTimestamp(a.first_shown)).filter((n) => !Number.isNaN(n));
  const ends = ads.map((a) => parseAdTimestamp(a.last_shown)).filter((n) => !Number.isNaN(n));
  const cadence = classifyCadence(starts);
  const formats = dedup(
    ads.map((a): AdInventoryFragment["formats"][number] => {
      const f = (a.format ?? "").toLowerCase();
      if (f.includes("video")) return "video";
      if (f.includes("image")) return "image";
      if (f.includes("text")) return "other";
      return "other";
    }),
  );
  const geos = dedup(ads.flatMap((a) => a.target_regions ?? []));

  const retrievedAt = new Date().toISOString();
  return {
    platform: "google",
    paid_social_ad_inventory: {
      name: `${name} · Google`,
      active_ad_count: ads.length,
      run_duration_range: summarizeDateRange(starts, ends),
      formats,
      hook_strings_verbatim: hooks,
      cta_patterns: [],
      ad_library_url: libraryUrl,
      source_url: libraryUrl,
      retrieved_at: retrievedAt,
    },
    ad_activity_signals: {
      name: `${name} · Google`,
      always_on_vs_burst: cadence.always_on_vs_burst,
      refresh_cadence_days: cadence.refresh_cadence_days,
      geo_targeting_visible: geos,
      source_url: libraryUrl,
      retrieved_at: retrievedAt,
    },
  };
}

// ── top-level per-competitor collector ────────────────────────────────

export async function collectAdsForCompetitor(
  name: string,
  domain: string | undefined,
  platforms: Platform[] = DEFAULT_PLATFORMS,
): Promise<{ competitor: string; platforms: PlatformResult[] }> {
  const apiKey = process.env.SEARCHAPI_KEY;
  if (!apiKey) {
    process.stderr.write(`[fetch-ads] SEARCHAPI_KEY missing — blank fallback for "${name}"\n`);
    return {
      competitor: name,
      platforms: platforms.map((p) => ({
        platform: p,
        paid_social_ad_inventory: blankInventory(
          name,
          p === "meta" ? metaLibraryUrl(domain ?? name) : p === "linkedin" ? linkedinLibraryUrl(name) : googleLibraryUrl(domain, name),
          p,
        ),
        ad_activity_signals: blankSignal(
          name,
          p === "meta" ? metaLibraryUrl(domain ?? name) : p === "linkedin" ? linkedinLibraryUrl(name) : googleLibraryUrl(domain, name),
          p,
        ),
      })),
    };
  }

  const runs = platforms.map((p) => {
    if (p === "meta") return collectMeta(name, domain, apiKey);
    if (p === "linkedin") return collectLinkedIn(name, apiKey);
    return collectGoogle(name, domain, apiKey);
  });

  const results = await Promise.all(runs);
  return { competitor: name, platforms: results };
}

// ── CLI ────────────────────────────────────────────────────────────────

function parsePlatforms(arg: string | undefined): Platform[] {
  if (!arg) return DEFAULT_PLATFORMS;
  const parts = arg.split(",").map((s) => s.trim().toLowerCase()) as Platform[];
  return parts.filter((p): p is Platform => p === "meta" || p === "linkedin" || p === "google");
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const platformArgIdx = argv.indexOf("--platforms");
  const platforms = platformArgIdx >= 0 ? parsePlatforms(argv[platformArgIdx + 1]) : DEFAULT_PLATFORMS;

  if (argv[0] === "--batch") {
    const batchPath = argv[1];
    if (!batchPath) {
      process.stderr.write("Usage: fetch-ads.ts --batch <competitors.json> [--platforms meta,linkedin,google]\n");
      process.exit(2);
    }
    const competitors = JSON.parse(fs.readFileSync(batchPath, "utf-8")) as Array<{
      name: string;
      domain?: string;
    }>;
    const results = await Promise.all(
      competitors.map((c) => collectAdsForCompetitor(c.name, c.domain, platforms)),
    );
    process.stdout.write(JSON.stringify(results, null, 2) + "\n");
    return;
  }

  const [name, domain] = argv.filter((a) => !a.startsWith("--") && a !== platforms.join(","));
  if (!name) {
    process.stderr.write(
      "Usage: fetch-ads.ts <competitor_name> [domain] [--platforms meta,linkedin,google]\n" +
        "   or: fetch-ads.ts --batch <competitors.json>\n",
    );
    process.exit(2);
  }
  const result = await collectAdsForCompetitor(name, domain, platforms);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

const entry = process.argv[1] ?? "";
if (entry.endsWith("fetch-ads.ts") || entry.endsWith("fetch-ads.js")) {
  main().catch((err) => {
    process.stderr.write(`[fetch-ads] fatal: ${(err as Error).message}\n`);
    process.exit(1);
  });
}
