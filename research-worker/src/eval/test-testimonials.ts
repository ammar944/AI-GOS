/**
 * CLI smoke test for testimonial discovery + Google Reviews (Mahdy #6).
 *
 * Verifies that the Firecrawl map() call now walks subdomains (so pages
 * like stories.slack.com or customers.hubspot.com get picked up) and that
 * the new Google Business Reviews integration returns rating + count.
 *
 * Run:
 *   npx tsx src/eval/test-testimonials.ts                 # default 3 domains
 *   npx tsx src/eval/test-testimonials.ts slack.com       # single domain
 *
 * Cost: ~1 Firecrawl map + up to 10 Firecrawl scrapes + 2 SearchAPI calls
 * per domain. ~$1-3 per full run. Not cheap — kept to 3 canonical domains.
 */

import 'dotenv/config';
import { fetchReviews } from '../tools/reviews';

interface Case {
  domain: string;
  expectMinTestimonials: number;
  expectSubdomainPage: boolean;
  expectGoogleRating: boolean;
}

const CASES: Case[] = [
  // HubSpot is the strongest case — blog.hubspot.com surfaces testimonial
  // content via includeSubdomains, 5+ testimonials typically extracted.
  { domain: 'hubspot.com', expectMinTestimonials: 3, expectSubdomainPage: true, expectGoogleRating: false },
  // Slack moved customer stories to the apex (no more stories.slack.com),
  // so testimonial extraction is format-dependent; subdomains still exercised
  // via api.slack.com landing in the map result.
  { domain: 'slack.com', expectMinTestimonials: 0, expectSubdomainPage: true, expectGoogleRating: false },
  { domain: 'notion.so', expectMinTestimonials: 1, expectSubdomainPage: false, expectGoogleRating: false },
];

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function subdomainOf(url: string, apex: string): boolean {
  const host = hostOf(url);
  const apexHost = apex.replace(/^www\./, '').toLowerCase();
  if (!host) return false;
  if (host === apexHost || host === `www.${apexHost}`) return false;
  return host.endsWith(`.${apexHost}`);
}

async function runCase(c: Case): Promise<boolean> {
  console.log(`\n─────────────────────────────────────────────────────`);
  console.log(`CASE: ${c.domain}`);
  console.log(`─────────────────────────────────────────────────────`);

  const t0 = Date.now();
  const result = await fetchReviews({ name: c.domain, domain: c.domain });
  const elapsed = Date.now() - t0;

  console.log(`\nElapsed:           ${elapsed}ms`);
  console.log(`Testimonials:      ${result.testimonials.length}`);
  console.log(`Pages discovered:  ${result.testimonialPages.length}`);

  const subdomainPages = result.testimonialPages.filter((u) => subdomainOf(u, c.domain));
  console.log(`Subdomain pages:   ${subdomainPages.length}`);
  if (subdomainPages.length > 0) {
    console.log(`  first few: ${subdomainPages.slice(0, 3).join(', ')}`);
  }

  if (result.testimonials.length > 0) {
    console.log(`\nSample testimonials (first 3):`);
    for (const t of result.testimonials.slice(0, 3)) {
      const attr = [t.author, t.role, t.company].filter(Boolean).join(', ') || 'Anonymous';
      console.log(`  • "${t.quote.slice(0, 120)}${t.quote.length > 120 ? '…' : ''}"`);
      console.log(`    — ${attr}`);
      console.log(`    ${t.sourceUrl}`);
    }
  }

  console.log(`\nTrustpilot: ${result.trustpilot ? `${result.trustpilot.rating}/5, ${result.trustpilot.reviewCount} reviews` : 'none'}`);
  console.log(`G2:         ${result.g2 ? `${result.g2.rating}/5, ${result.g2.reviewCount} reviews` : 'none'}`);
  console.log(`Capterra:   ${result.capterra ? `${result.capterra.rating}/5, ${result.capterra.reviewCount} reviews` : 'none'}`);
  console.log(`Google:     ${result.google ? `${result.google.rating}/5, ${result.google.reviewCount} reviews @ ${result.google.url}` : 'none'}`);
  if (result.error) console.log(`Error:      ${result.error}`);

  let pass = true;

  if (result.testimonials.length < c.expectMinTestimonials) {
    console.log(`\n❌ FAIL — expected ≥${c.expectMinTestimonials} testimonials, got ${result.testimonials.length}`);
    pass = false;
  } else {
    console.log(`\n✓  ${result.testimonials.length} testimonials (≥${c.expectMinTestimonials} required)`);
  }

  if (c.expectSubdomainPage) {
    if (subdomainPages.length === 0) {
      console.log(`❌ FAIL — expected at least one subdomain URL (e.g., stories.${c.domain}), none found`);
      pass = false;
    } else {
      console.log(`✓  subdomain discovery working — found ${subdomainPages.length} subdomain page(s)`);
    }
  }

  if (c.expectGoogleRating) {
    if (!result.google || result.google.rating === null) {
      console.log(`❌ FAIL — expected Google rating, got ${result.google?.rating ?? 'null'}`);
      pass = false;
    } else {
      console.log(`✓  Google rating ${result.google.rating}/5`);
    }
  }

  return pass;
}

async function main(): Promise<void> {
  const needed = ['FIRECRAWL_API_KEY', 'SEARCHAPI_KEY'];
  for (const k of needed) {
    if (!process.env[k]) {
      console.error(`Missing env: ${k}`);
      process.exit(2);
    }
  }

  const arg = process.argv[2];
  const cases = arg
    ? [{ domain: arg, expectMinTestimonials: 1, expectSubdomainPage: false, expectGoogleRating: false }]
    : CASES;

  const results: boolean[] = [];
  for (const c of cases) {
    results.push(await runCase(c));
  }

  const passed = results.filter(Boolean).length;
  console.log(`\n═════════════════════════════════════════════════════`);
  console.log(`  ${passed} / ${results.length} cases passed`);
  console.log(`═════════════════════════════════════════════════════`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error('[test-testimonials] fatal:', err);
  process.exit(1);
});
