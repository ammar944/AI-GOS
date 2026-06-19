// One-shot, bounded acquisition-reality probe for Buyer ICP (Ramp).
// Tests two acquisition sources against the SAME bar the lab uses:
//   (1) Perplexity sonar-pro venue questions (the CURRENT prepass) — verbatim
//       venue asks copied from buyer-persona-acquisition.ts venueQuestionSpecs.
//   (2) Firecrawl scrape of the subject's own customer/case-study pages —
//       the hypothesized winning source (named champions, in fetchable text).
// Goal: learn what named EXTERNAL buyers are actually obtainable, and whether
// their names appear literally in fetchable page text (source-liveness viable).
// Bounded: 1 map + <=4 scrapes + 4 perplexity calls. NO loops.
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const SUBJECT = { name: 'Ramp', site: 'ramp.com', url: 'https://ramp.com', category: 'corporate card and spend management platform' };
const PPLX = process.env.PERPLEXITY_API_KEY;
const FC = process.env.FIRECRAWL_API_KEY;
const subjectSlug = SUBJECT.name.toLowerCase().replace(/[^a-z0-9]/g, '');

// ---- venue questions copied verbatim from venueQuestionSpecs (attempt 1) ----
const VENUES = {
  public_voices: 'Find NAMED individuals in ICP buyer roles for this category who are publicly visible — podcast guests, conference/webinar speakers, LinkedIn authors posting about this problem space, case-study champions',
  reviewer_identities: 'Find NAMED reviewer identities on G2, Capterra, TrustRadius, or similar review platforms who reviewed this product or close competitors — full reviewer name (or public reviewer handle) with their stated title and company',
  case_study_champions: 'Find NAMED customer champions quoted in customer case studies, customer-story pages, and testimonial sections for this product or its close competitors — the quoted person\'s full name, stated title, and company',
  event_speakers: 'Find NAMED speakers from recent webinars, conference sessions, summits, and meetups about this category — speaker full name, stated title, and company, from event agenda/roster pages or LinkedIn event posts',
};
function buildVenueQuestion(venue) {
  const subject = `${SUBJECT.name} (${SUBJECT.url}), the ${SUBJECT.category}`;
  return [
    `${VENUES[venue]}, for ${subject}.`,
    'Return ONLY lines in this exact format, one person per line:',
    '<full name> — <title> — <company> — <url>',
    'Name people exactly as the source states them; every line must trace to a real URL where that name appears. If the search finds nobody reliable, say so explicitly.',
  ].join('\n');
}
// ---- parser copied from parseNamedPersonaLines ----
const listMarker = /^\s*(?:[-*•]|\d+[.)])\s*/;
const trailingUrl = /(https?:\/\/\S+?)[).,;:!?]*\s*$/i;
const sep = /\s+[—–-]+\s+/;
function parseLines(answer) {
  return answer.split(/\r?\n/).flatMap((raw) => {
    const line = raw.replace(listMarker, '').trim();
    if (!line) return [];
    const m = trailingUrl.exec(line);
    const url = m?.[1];
    if (!m || !url) return [];
    const before = line.slice(0, m.index).replace(/[\s—–-]+$/, '').trim();
    const segs = before.split(sep).map((s) => s.replace(/\*\*?|__/g, '').trim()).filter(Boolean);
    if (segs.length < 3) return [];
    const [name, title, ...co] = segs;
    return [{ name, title, company: co.join(' — '), url }];
  });
}
function isOwnCompany(company, url) {
  const coSlug = (company || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const urlHasSubject = (url || '').toLowerCase().includes(subjectSlug);
  return coSlug === subjectSlug || coSlug.includes(subjectSlug) || urlHasSubject;
}

async function pplx(question) {
  const r = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${PPLX}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'sonar-pro', messages: [{ role: 'user', content: question }] }),
  });
  if (!r.ok) return { error: `${r.status} ${(await r.text()).slice(0, 200)}` };
  const j = await r.json();
  return { answer: j.choices?.[0]?.message?.content ?? '', citations: j.citations ?? [] };
}
async function fcMap(url, limit = 40) {
  const r = await fetch('https://api.firecrawl.dev/v2/map', {
    method: 'POST', headers: { Authorization: `Bearer ${FC}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, limit }),
  });
  if (!r.ok) return { error: `${r.status} ${(await r.text()).slice(0, 200)}` };
  const j = await r.json();
  return { links: (j.links ?? j.data?.links ?? []).map((l) => (typeof l === 'string' ? l : l.url)) };
}
async function fcScrape(url) {
  const r = await fetch('https://api.firecrawl.dev/v2/scrape', {
    method: 'POST', headers: { Authorization: `Bearer ${FC}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true }),
  });
  if (!r.ok) return { error: `${r.status} ${(await r.text()).slice(0, 200)}` };
  const j = await r.json();
  return { markdown: j.data?.markdown ?? j.markdown ?? '' };
}
// Extract "Name, Title" / "Name — Title, Company" / "— Name, Title at Company" from case-study prose.
function extractChampions(markdown) {
  const out = [];
  const patterns = [
    /([A-Z][a-zA-Z.'-]+(?:\s+[A-Z][a-zA-Z.'-]+){1,2}),?\s+(?:the\s+)?((?:Chief|VP|Vice President|Head|Director|Senior Director|Controller|CFO|CEO|COO|CTO|Founder|Co-founder|Manager|Lead)[^,.\n]{0,40})(?:,?\s+(?:at|of|@)\s+([A-Z][\w&.,' -]{2,40}))?/g,
  ];
  for (const re of patterns) {
    for (const m of markdown.matchAll(re)) {
      const name = m[1].trim(); const title = (m[2] || '').trim(); const company = (m[3] || '').trim();
      if (name.split(/\s+/).length < 2) continue;
      out.push({ name, title, company });
    }
  }
  // dedupe by name
  const seen = new Set(); return out.filter((p) => { const k = p.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}

const report = { subject: SUBJECT.name, keys: { perplexity: !!PPLX, firecrawl: !!FC }, perplexityVenues: {}, firecrawl: {} };

console.log(`\n=== ACQUISITION PROBE: ${SUBJECT.name} ===`);
console.log(`keys present -> perplexity:${!!PPLX} firecrawl:${!!FC}\n`);

// ---- (1) Perplexity venues ----
if (PPLX) {
  for (const venue of Object.keys(VENUES)) {
    process.stdout.write(`[pplx] ${venue} ... `);
    const res = await pplx(buildVenueQuestion(venue));
    if (res.error) { console.log(`ERR ${res.error}`); report.perplexityVenues[venue] = { error: res.error }; continue; }
    const parsed = parseLines(res.answer);
    const external = parsed.filter((p) => !isOwnCompany(p.company, p.url));
    const own = parsed.filter((p) => isOwnCompany(p.company, p.url));
    console.log(`parsed=${parsed.length} external=${external.length} ownCompany=${own.length}`);
    report.perplexityVenues[venue] = {
      parsedCount: parsed.length, externalCount: external.length, ownCount: own.length,
      external: external.slice(0, 8), own: own.slice(0, 8), answerHead: res.answer.slice(0, 300),
    };
  }
} else console.log('SKIP perplexity (no key)');

// ---- (2) Firecrawl case-study mining ----
if (FC) {
  console.log('\n[firecrawl] mapping ramp.com for customer/case-study URLs...');
  const mapped = await fcMap(SUBJECT.url, 60);
  if (mapped.error) { console.log('map ERR', mapped.error); report.firecrawl.mapError = mapped.error; }
  const links = mapped.links ?? [];
  const csLinks = links.filter((l) => /\/(customers?|case-?stud|stories|testimonial)/i.test(l));
  console.log(`  total links=${links.length} customer/case-study links=${csLinks.length}`);
  csLinks.slice(0, 12).forEach((l) => console.log('   -', l));
  report.firecrawl.totalLinks = links.length; report.firecrawl.caseStudyLinks = csLinks.slice(0, 20);
  // scrape up to 3 of them (prefer index + deep case studies)
  const toScrape = [...new Set([csLinks.find((l) => /\/customers?\/?$/i.test(l)), ...csLinks])].filter(Boolean).slice(0, 3);
  report.firecrawl.scraped = [];
  for (const url of toScrape) {
    process.stdout.write(`  scrape ${url} ... `);
    const s = await fcScrape(url);
    if (s.error) { console.log(`ERR ${s.error}`); report.firecrawl.scraped.push({ url, error: s.error }); continue; }
    const champs = extractChampions(s.markdown);
    const external = champs.filter((c) => !isOwnCompany(c.company, url));
    console.log(`md=${s.markdown.length}b champions=${champs.length} external=${external.length}`);
    champs.slice(0, 10).forEach((c) => console.log(`     • ${c.name} — ${c.title}${c.company ? ' @ ' + c.company : ''}`));
    report.firecrawl.scraped.push({ url, mdLen: s.markdown.length, championCount: champs.length, externalCount: external.length, champions: champs.slice(0, 12) });
  }
} else console.log('SKIP firecrawl (no key)');

import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('tmp/probe', { recursive: true });
writeFileSync('tmp/probe/buyer-acquisition-ramp.json', JSON.stringify(report, null, 2));
console.log('\nwrote tmp/probe/buyer-acquisition-ramp.json');
