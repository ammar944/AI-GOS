// One-shot, bounded VoC permalink probe (Ramp).
// THE BIG UNKNOWN: when Firecrawl scrapes a Trustpilot/TrustRadius LISTING page,
// does the returned markdown actually contain per-review anchor hrefs the
// resolver could attach? If yes, the VoC fix (extend buildReviewPermalinkResolver)
// is viable. If no, the honest fallback is a directional lane. Bounded: 2 scrapes.
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
const FC = process.env.FIRECRAWL_API_KEY;

const TARGETS = [
  { platform: 'trustpilot', url: 'https://www.trustpilot.com/review/ramp.com' },
  { platform: 'trustradius', url: 'https://www.trustradius.com/products/ramp/reviews' },
  { platform: 'g2', url: 'https://www.g2.com/products/ramp/reviews' },
];

async function fcScrape(url) {
  const r = await fetch('https://api.firecrawl.dev/v2/scrape', {
    method: 'POST', headers: { Authorization: `Bearer ${FC}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, formats: ['markdown', 'links'], onlyMainContent: false }),
  });
  if (!r.ok) return { error: `${r.status} ${(await r.text()).slice(0, 300)}` };
  const j = await r.json();
  return { markdown: j.data?.markdown ?? j.markdown ?? '', links: j.data?.links ?? j.links ?? [] };
}

// per-review anchor shapes the resolver knows / would need
const PATTERNS = {
  g2_survey: /g2\.com\/survey_responses\/[\w-]+/gi,
  g2_review: /g2\.com\/products\/[\w-]+\/reviews\/[\w-]*review-\d+/gi,
  trustpilot_review: /trustpilot\.com\/reviews\/[a-f0-9]{16,}/gi,
  capterra_review: /capterra\.com\/p\/\d+\/[\w-]+\/reviews\/\d+/gi,
  trustradius_review: /trustradius\.com\/reviews\/[\w-]+-\d+/gi,
  trustradius_anchor: /#review-\d+|\/reviews?#?[\w-]*\d{4,}/gi,
};

const report = { keys: { firecrawl: !!FC }, targets: {} };
console.log(`\n=== VoC PERMALINK PROBE (Ramp) === firecrawl:${!!FC}\n`);
if (!FC) { console.log('SKIP (no firecrawl key)'); process.exit(0); }

for (const t of TARGETS) {
  process.stdout.write(`[scrape] ${t.platform} ${t.url} ... `);
  const s = await fcScrape(t.url);
  if (s.error) { console.log(`ERR ${s.error}`); report.targets[t.platform] = { error: s.error }; continue; }
  const md = s.markdown || '';
  const links = (s.links || []).map((l) => (typeof l === 'string' ? l : l.url || l.href || ''));
  // count per-review anchors in markdown AND in links array
  const anchorHits = {};
  for (const [name, re] of Object.entries(PATTERNS)) {
    const mdHits = [...md.matchAll(re)].map((m) => m[0]);
    const linkHits = links.filter((l) => re.test(l));
    re.lastIndex = 0;
    if (mdHits.length || linkHits.length) anchorHits[name] = { md: mdHits.length, links: linkHits.length, sample: [...new Set([...mdHits, ...linkHits])].slice(0, 4) };
  }
  // does the page contain review-body-like first-person text?
  const firstPerson = (md.match(/\b(I |we |our |my )/gi) || []).length;
  const reviewMarkers = (md.match(/Rated \d|out of 5|What do you (?:like|dislike)|Pros|Cons/gi) || []).length;
  console.log(`md=${md.length}b links=${links.length} firstPerson=${firstPerson} reviewMarkers=${reviewMarkers} anchorTypes=${Object.keys(anchorHits).join(',')||'NONE'}`);
  Object.entries(anchorHits).forEach(([k, v]) => console.log(`     ${k}: md=${v.md} links=${v.links}  e.g. ${v.sample[0] || ''}`));
  report.targets[t.platform] = { url: t.url, mdLen: md.length, linkCount: links.length, firstPerson, reviewMarkers, anchorHits, sampleLinks: links.filter((l)=>/review/i.test(l)).slice(0, 8) };
}

import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('tmp/probe', { recursive: true });
writeFileSync('tmp/probe/voc-permalinks-ramp.json', JSON.stringify(report, null, 2));
console.log('\nwrote tmp/probe/voc-permalinks-ramp.json');
