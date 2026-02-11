// SEO Audit Module
// Crawls client website with Firecrawl (HTML), parses with cheerio,
// fetches PageSpeed Insights (free API), and scores deterministically.
// No AI involved — all real data + deterministic scoring.

import * as cheerio from 'cheerio';
import { createFirecrawlClient } from '@/lib/firecrawl';
import type { ScrapeResult } from '@/lib/firecrawl/types';
import type {
  SEOPageCheck,
  SEOTechnicalAudit,
  SEOPerformanceAudit,
  SEOAuditData,
  PageSpeedMetrics,
} from '@/lib/strategic-blueprint/output-types';

// =============================================================================
// Types
// =============================================================================

export interface SEOAuditResult {
  seoAudit: SEOAuditData;
  cost: number;
}

// Common paths to crawl (after homepage)
const CRAWL_PATHS = ['/about', '/pricing', '/blog', '/contact', '/features'] as const;
const PAGESPEED_API_URL = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

// =============================================================================
// HTML Parsing — Deterministic SEO checks from raw HTML
// =============================================================================

export function parseSEOChecks(
  html: string,
  url: string,
  metadata?: ScrapeResult['metadata'],
): SEOPageCheck {
  const $ = cheerio.load(html);

  // Title check (50-60 chars ideal)
  const titleText = $('title').first().text().trim() || metadata?.title || null;
  const titleLength = titleText?.length ?? 0;
  const titlePass = titleLength >= 30 && titleLength <= 70;

  // Meta description (150-160 chars ideal)
  const metaDesc = $('meta[name="description"]').attr('content')?.trim()
    || metadata?.description || null;
  const metaDescLength = metaDesc?.length ?? 0;
  const metaDescPass = metaDescLength >= 70 && metaDescLength <= 170;

  // H1 check (exactly 1 H1)
  const h1Elements = $('h1');
  const h1Values = h1Elements.map((_, el) => $(el).text().trim()).get();
  const h1Pass = h1Values.length === 1;

  // Canonical tag
  const canonical = $('link[rel="canonical"]').attr('href') || null;
  const canonicalPass = canonical !== null;

  // Robots meta
  const robotsMeta = $('meta[name="robots"]').attr('content')?.trim()
    || metadata?.robots || null;
  const indexable = !robotsMeta || !robotsMeta.includes('noindex');

  // Image alt coverage
  const images = $('img');
  const totalImages = images.length;
  let withAlt = 0;
  images.each((_, el) => {
    const alt = $(el).attr('alt');
    if (alt && alt.trim().length > 0) withAlt++;
  });
  const coveragePercent = totalImages > 0 ? Math.round((withAlt / totalImages) * 100) : 100;

  // Internal links count
  let internalLinks = 0;
  try {
    const urlObj = new URL(url);
    const host = urlObj.host;
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (href.startsWith('/') || href.includes(host)) {
        internalLinks++;
      }
    });
  } catch {
    // If URL parsing fails, count relative links only
    $('a[href^="/"]').each(() => { internalLinks++; });
  }

  // Schema markup (JSON-LD)
  const schemaTypes: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || '');
      const types = Array.isArray(json) ? json : [json];
      for (const item of types) {
        if (item['@type']) {
          const t = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
          schemaTypes.push(...t);
        }
      }
    } catch { /* ignore invalid JSON-LD */ }
  });

  // Viewport meta
  const hasViewport = $('meta[name="viewport"]').length > 0;

  // HTTPS
  const isHttps = url.startsWith('https://');

  return {
    url,
    title: { value: titleText, length: titleLength, pass: titlePass },
    metaDescription: { value: metaDesc, length: metaDescLength, pass: metaDescPass },
    h1: { values: h1Values, pass: h1Pass },
    canonical: { value: canonical, pass: canonicalPass },
    robots: { value: robotsMeta, indexable },
    images: { total: totalImages, withAlt, coveragePercent },
    internalLinks,
    schemaTypes,
    hasViewport,
    isHttps,
  };
}

// =============================================================================
// Sitemap + Robots.txt checks
// =============================================================================

async function checkSitemap(domain: string): Promise<boolean> {
  try {
    const response = await fetch(`${domain}/sitemap.xml`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(10000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function checkRobotsTxt(domain: string): Promise<boolean> {
  try {
    const response = await fetch(`${domain}/robots.txt`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(10000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// =============================================================================
// PageSpeed Insights API (free, no key needed)
// =============================================================================

function extractMetrics(data: any): PageSpeedMetrics | null {
  try {
    const categories = data?.lighthouseResult?.categories;
    const audits = data?.lighthouseResult?.audits;
    if (!categories || !audits) return null;

    return {
      performanceScore: Math.round((categories.performance?.score ?? 0) * 100),
      lcp: parseFloat(((audits['largest-contentful-paint']?.numericValue ?? 0) / 1000).toFixed(1)),
      fid: parseFloat((audits['max-potential-fid']?.numericValue ?? audits['total-blocking-time']?.numericValue ?? 0).toFixed(0)),
      cls: parseFloat((audits['cumulative-layout-shift']?.numericValue ?? 0).toFixed(3)),
      fcp: parseFloat(((audits['first-contentful-paint']?.numericValue ?? 0) / 1000).toFixed(1)),
      tti: parseFloat(((audits['interactive']?.numericValue ?? 0) / 1000).toFixed(1)),
      speedIndex: parseFloat(((audits['speed-index']?.numericValue ?? 0) / 1000).toFixed(1)),
    };
  } catch {
    return null;
  }
}

async function getPageSpeedMetrics(url: string): Promise<SEOPerformanceAudit> {
  const fetchStrategy = async (strategy: 'mobile' | 'desktop'): Promise<PageSpeedMetrics | null> => {
    try {
      const apiUrl = `${PAGESPEED_API_URL}?url=${encodeURIComponent(url)}&strategy=${strategy}&category=performance`;
      const response = await fetch(apiUrl, { signal: AbortSignal.timeout(60000) });
      if (!response.ok) {
        console.warn(`[SEO Audit] PageSpeed ${strategy} returned ${response.status}`);
        return null;
      }
      const data = await response.json();
      return extractMetrics(data);
    } catch (error) {
      console.warn(`[SEO Audit] PageSpeed ${strategy} failed:`, error instanceof Error ? error.message : error);
      return null;
    }
  };

  const [mobile, desktop] = await Promise.all([
    fetchStrategy('mobile'),
    fetchStrategy('desktop'),
  ]);

  return { mobile, desktop, url };
}

// =============================================================================
// Deterministic Scoring
// =============================================================================

// Weights for technical checks (total 100)
const WEIGHTS = {
  title: 15,
  metaDesc: 10,
  h1: 10,
  canonical: 10,
  images: 10,
  internalLinks: 5,
  schema: 10,
  sitemap: 10,
  robots: 10,
  https: 5,
  viewport: 5,
} as const;

function scorePageCheck(page: SEOPageCheck): number {
  let score = 0;
  if (page.title.pass) score += WEIGHTS.title;
  if (page.metaDescription.pass) score += WEIGHTS.metaDesc;
  if (page.h1.pass) score += WEIGHTS.h1;
  if (page.canonical.pass) score += WEIGHTS.canonical;
  if (page.images.coveragePercent >= 80) score += WEIGHTS.images;
  else if (page.images.coveragePercent >= 50) score += WEIGHTS.images * 0.5;
  if (page.internalLinks >= 3) score += WEIGHTS.internalLinks;
  if (page.schemaTypes.length > 0) score += WEIGHTS.schema;
  if (page.isHttps) score += WEIGHTS.https;
  if (page.hasViewport) score += WEIGHTS.viewport;
  // sitemap and robots handled at site level
  return score;
}

export function scoreTechnicalAudit(
  pages: SEOPageCheck[],
  sitemapFound: boolean,
  robotsTxtFound: boolean,
): SEOTechnicalAudit {
  if (pages.length === 0) {
    return {
      pages,
      sitemapFound,
      robotsTxtFound,
      overallScore: 0,
      issueCount: { critical: 0, warning: 0, pass: 0 },
    };
  }

  // Per-page scores (without sitemap/robots)
  const pageMaxScore = 100 - WEIGHTS.sitemap - WEIGHTS.robots;
  const pageScores = pages.map(p => scorePageCheck(p));
  const avgPageScore = pageScores.reduce((a, b) => a + b, 0) / pageScores.length;

  // Normalize page score to its proportion, then add sitemap/robots
  const normalizedPageScore = (avgPageScore / pageMaxScore) * (100 - WEIGHTS.sitemap - WEIGHTS.robots);
  const siteScore = normalizedPageScore
    + (sitemapFound ? WEIGHTS.sitemap : 0)
    + (robotsTxtFound ? WEIGHTS.robots : 0);

  const overallScore = Math.round(Math.min(100, Math.max(0, siteScore)));

  // Count issues across all pages
  let critical = 0;
  let warning = 0;
  let pass = 0;

  for (const page of pages) {
    // Critical issues (high weight checks)
    if (!page.title.pass) critical++;
    else pass++;
    if (!page.h1.pass) critical++;
    else pass++;
    if (!page.isHttps) critical++;
    else pass++;

    // Warnings (medium weight checks)
    if (!page.metaDescription.pass) warning++;
    else pass++;
    if (!page.canonical.pass) warning++;
    else pass++;
    if (page.images.coveragePercent < 80) warning++;
    else pass++;
    if (!page.hasViewport) warning++;
    else pass++;
    if (page.schemaTypes.length === 0) warning++;
    else pass++;
    if (page.internalLinks < 3) warning++;
    else pass++;
    if (!page.robots.indexable) warning++;
    else pass++;
  }

  // Site-level checks
  if (!sitemapFound) critical++;
  else pass++;
  if (!robotsTxtFound) warning++;
  else pass++;

  return {
    pages,
    sitemapFound,
    robotsTxtFound,
    overallScore,
    issueCount: { critical, warning, pass },
  };
}

// =============================================================================
// Main Entry Point
// =============================================================================

export async function runSEOAudit(
  clientUrl: string,
  onProgress?: (msg: string) => void,
): Promise<SEOAuditResult> {
  const startTime = Date.now();
  onProgress?.('Starting SEO audit...');

  // Normalize domain
  const normalizedUrl = clientUrl.startsWith('http') ? clientUrl : `https://${clientUrl}`;
  let domain: string;
  try {
    const parsed = new URL(normalizedUrl);
    domain = `${parsed.protocol}//${parsed.host}`;
  } catch {
    domain = normalizedUrl.replace(/\/+$/, '');
  }

  // Build URLs to crawl (homepage + common paths)
  const urls = [domain, ...CRAWL_PATHS.map(p => `${domain}${p}`)];

  const firecrawl = createFirecrawlClient();
  let pages: SEOPageCheck[] = [];
  let firecrawlCost = 0;

  // Step 1: Firecrawl batch scrape with HTML format
  // Step 2 (parallel): PageSpeed + sitemap + robots.txt
  onProgress?.('Crawling pages for technical SEO analysis...');

  const [batchResult, performanceResult, sitemapFound, robotsTxtFound] = await Promise.all([
    // Firecrawl HTML crawl
    firecrawl.isAvailable()
      ? firecrawl.batchScrape({
          urls,
          formats: ['html', 'markdown'],
          timeout: 45000,
        })
      : Promise.resolve(null),
    // PageSpeed Insights (homepage only)
    (async () => {
      onProgress?.('Fetching PageSpeed Insights...');
      return getPageSpeedMetrics(domain);
    })(),
    // Sitemap check
    checkSitemap(domain),
    // Robots.txt check
    checkRobotsTxt(domain),
  ]);

  // Step 3: Parse HTML pages
  if (batchResult) {
    onProgress?.(`Analyzing ${batchResult.successCount} crawled pages...`);
    firecrawlCost = batchResult.successCount * 0.005; // ~$0.005 per page

    for (const [url, result] of batchResult.results) {
      if (result.success && result.html) {
        try {
          pages.push(parseSEOChecks(result.html, url, result.metadata));
        } catch (error) {
          console.warn(`[SEO Audit] Failed to parse HTML for ${url}:`, error);
        }
      }
    }
  }

  // Step 4: Score technical audit
  onProgress?.('Calculating SEO scores...');
  const technicalAudit = scoreTechnicalAudit(pages, sitemapFound, robotsTxtFound);

  // Step 5: Compute overall score (60% technical + 40% performance)
  const performanceScore = performanceResult.mobile?.performanceScore
    ?? performanceResult.desktop?.performanceScore ?? 0;
  const overallScore = Math.round(
    technicalAudit.overallScore * 0.6 + performanceScore * 0.4,
  );

  const elapsed = Date.now() - startTime;
  onProgress?.(`SEO audit complete (${Math.round(elapsed / 1000)}s, ${pages.length} pages analyzed)`);

  return {
    seoAudit: {
      technical: technicalAudit,
      performance: performanceResult,
      overallScore,
      collectedAt: new Date().toISOString(),
    },
    cost: firecrawlCost,
  };
}
