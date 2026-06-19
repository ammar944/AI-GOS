// DECISIVE one-shot probe: does a PLAIN server-side fetch (what the
// source-liveness Gate C uses) of Ramp's real case-study pages return the same
// champion-name prose that Firecrawl scraped? If yes, case-study-mined personas
// clear containment on re-fetch (Strategy 1: just add URLs to preverifiedUrls).
// If no (JS shell / bot wall), the wire must inject the scraped text into
// containment (Strategy 2: extend applySourceLivenessGate). Plain fetch only —
// no API key, no loop.
const URLS = [
  'https://ramp.com/customers/wizehire',
  'https://ramp.com/customers/new-way-landscape',
  'https://ramp.com/customers/studs',
  'https://next.ramp.com/customers/perplexity',
];

// Exact UA + HTML-strip + normalize mirror of source-liveness.ts
const USER_AGENT =
  'AI-GOS-Source-Liveness/1.0 (+https://ai-gos.local/research-verifier)';
const normalizeWhitespace = (s) => s.replace(/\s+/g, ' ').trim();
const stripToContainment = (html) =>
  normalizeWhitespace(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&'),
  ).toLowerCase();

// Miner's attribution regex (buyer-persona-case-study-mining.ts)
const attributionPattern =
  /([A-Z][a-zA-Z.'’-]+(?:\s+[A-Z][a-zA-Z.'’-]+){1,2}),\s+([^.\n]{2,80})/g;
const roleKw =
  /\b(?:chief|c[efot]o|cmo|cro|vp|vice president|head|director|controller|founder|co-?founder|president|manager|lead|officer|treasurer|finance|accounting|procurement|owner|partner)\b/i;

async function probe(url) {
  const out = { url };
  try {
    const head = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: { 'user-agent': USER_AGENT },
    });
    out.headStatus = head.status;
  } catch (e) {
    out.headStatus = `ERR ${String(e).slice(0, 80)}`;
  }
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'user-agent': USER_AGENT },
    });
    out.getStatus = res.status;
    const html = await res.text();
    out.rawBytes = html.length;
    // run attribution extraction over RAW html (the miner runs over Firecrawl
    // markdown, but names appear in raw SSR html too if server-rendered)
    const named = [];
    for (const m of html.matchAll(attributionPattern)) {
      const name = (m[1] || '').trim();
      const rest = (m[2] || '').trim();
      if (roleKw.test(rest) && name.split(/\s+/).length <= 3) {
        named.push(`${name} — ${rest.slice(0, 50)}`);
      }
    }
    out.namedAttributions = [...new Set(named)].slice(0, 8);
    // containment-text signal: does stripped+lowercased text carry role words +
    // first-person review markers?
    const text = stripToContainment(html);
    out.containmentTextBytes = text.length;
    out.roleWordHits = (text.match(/\b(cfo|controller|vp of finance|chief financial|head of finance|finance lead|founder|ceo|coo)\b/gi) || []).length;
    out.firstPerson = (text.match(/\b(we |our |i )/gi) || []).length;
    // Is the page a JS shell? (tiny stripped text but large raw html = shell)
    out.looksLikeJsShell = out.rawBytes > 5000 && text.length < 800;
  } catch (e) {
    out.getStatus = `ERR ${String(e).slice(0, 120)}`;
  }
  return out;
}

const report = { userAgent: USER_AGENT, results: [] };
console.log(`\n=== CASE-STUDY PLAIN-FETCH PROBE (Gate C simulation) ===\n`);
for (const url of URLS) {
  const r = await probe(url);
  report.results.push(r);
  console.log(`[${url}]`);
  console.log(`  HEAD=${r.headStatus} GET=${r.getStatus} rawBytes=${r.rawBytes ?? '-'} containmentText=${r.containmentTextBytes ?? '-'} roleWords=${r.roleWordHits ?? '-'} firstPerson=${r.firstPerson ?? '-'} jsShell=${r.looksLikeJsShell ?? '-'}`);
  if (r.namedAttributions?.length) {
    console.log(`  NAMED (plain-fetch): ${r.namedAttributions.join(' | ')}`);
  } else {
    console.log(`  NAMED (plain-fetch): NONE`);
  }
  console.log('');
}
import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('tmp/probe', { recursive: true });
writeFileSync('tmp/probe/casestudy-plainfetch-ramp.json', JSON.stringify(report, null, 2));
console.log('wrote tmp/probe/casestudy-plainfetch-ramp.json');
