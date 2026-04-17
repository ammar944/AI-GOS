/**
 * CLI smoke test for identity resolver — specifically verifies niche-product
 * classification quality (Mahdy 2026-04-03 #14).
 *
 * The resolver is supposed to emit `coreKeywords` that downstream competitor
 * discovery uses to find the RIGHT competitors in a narrow market space.
 * Example: Instapation (BNPL for medspas) should produce keywords like
 * "buy now pay later", "medspa financing", "aesthetic financing" — NOT
 * generic scheduling/appointment keywords.
 *
 * Run:
 *   npx tsx src/eval/test-identity-resolver.ts
 *
 * Cost: ~$0.005 per case (Haiku).
 */

import 'dotenv/config';
import { resolveProductIdentity } from '../identity/resolve-identity';

interface IdentityCard {
  category?: string;
  subcategory?: string;
  coreProduct?: string;
  coreKeywords?: string[];
  negativeKeywords?: string[];
  buyer?: string;
  confidence?: number;
  ambiguityFlags?: string[];
}

interface Case {
  name: string;
  description: string;
  context: string;
  expectKeywords: string[]; // substrings that SHOULD appear in coreKeywords (lowercased)
  rejectKeywords: string[]; // substrings that should NOT dominate (generic terms)
}

const CASES: Case[] = [
  {
    name: 'Instapation (BNPL for medspas)',
    description: 'Niche product: buy-now-pay-later checkout for aesthetic/medical spa bookings',
    context: [
      'Company Name: Instapation',
      'Product: Buy-now-pay-later checkout for medspas',
      '',
      '## Website Scrape',
      'Instapation lets medspas offer buy-now-pay-later financing at checkout.',
      'Patients can split aesthetic treatments across 4 interest-free payments.',
      'Features: BNPL checkout widget, medspa portal, patient financing, treatment installment plans.',
      'Integrates with medspa booking software. Does NOT do scheduling or bookings itself.',
      'Headline on homepage: "Buy Now, Pay Later for Medspas".',
      '',
      '## Perplexity Intel',
      'Instapation operates in the buy-now-pay-later (BNPL) space focused on the aesthetic/medspa vertical.',
      'Direct competitors: Affirm, Cherry, PatientFi, Walnut — all financing / BNPL providers.',
      'NOT a scheduling software. NOT a practice management tool.',
    ].join('\n'),
    expectKeywords: ['buy now pay later', 'bnpl', 'medspa', 'financing'],
    rejectKeywords: ['scheduling', 'booking', 'appointment'],
  },
  {
    name: 'Fellow.ai (AI meeting notetaker)',
    description: 'Control case: well-known category',
    context: [
      'Company Name: Fellow.ai',
      'Product: AI meeting notetaker',
      '',
      '## Website Scrape',
      'Fellow is an AI meeting notetaker that joins Zoom/Meet/Teams calls and writes action items.',
      'Features: auto-transcription, meeting summaries, action item extraction, CRM sync.',
      '',
      '## Perplexity Intel',
      'Fellow competes with Fireflies, Otter, Gong, Avoma, Fathom in AI notetaker space.',
    ].join('\n'),
    expectKeywords: ['meeting', 'notetak'],
    rejectKeywords: [],
  },
];

function containsAny(haystack: string[], needles: string[]): string[] {
  const lowered = haystack.map((s) => s.toLowerCase());
  return needles.filter((n) => lowered.some((h) => h.includes(n.toLowerCase())));
}

async function runCase(c: Case): Promise<boolean> {
  console.log(`\n─────────────────────────────────────────────────────`);
  console.log(`CASE: ${c.name}`);
  console.log(`      ${c.description}`);
  console.log(`─────────────────────────────────────────────────────`);

  const t0 = Date.now();
  const result = await resolveProductIdentity(c.context);
  const elapsed = Date.now() - t0;

  if (result.status !== 'complete') {
    console.log(`❌ Resolver returned status=${result.status} in ${elapsed}ms`);
    if (result.error) console.log(`   Error: ${result.error}`);
    return false;
  }

  const card = result.data as IdentityCard;
  console.log(`\nCategory:      ${card.category}`);
  console.log(`Subcategory:   ${card.subcategory}`);
  console.log(`Core product:  ${card.coreProduct}`);
  console.log(`Buyer:         ${card.buyer}`);
  console.log(`Confidence:    ${card.confidence}%`);
  console.log(`Core keywords: ${(card.coreKeywords ?? []).map((k) => `"${k}"`).join(', ') || '(none)'}`);
  console.log(`Negative kws:  ${(card.negativeKeywords ?? []).map((k) => `"${k}"`).join(', ') || '(none)'}`);
  console.log(`Elapsed:       ${elapsed}ms\n`);

  const coreKws = card.coreKeywords ?? [];
  const matchedExpected = containsAny(coreKws, c.expectKeywords);
  const leakedGeneric = containsAny(coreKws, c.rejectKeywords);

  let pass = true;
  if (matchedExpected.length < Math.min(2, c.expectKeywords.length)) {
    console.log(`❌ FAIL — core keywords don't cover the niche. Expected terms like: ${c.expectKeywords.join(', ')}`);
    console.log(`   Matched: ${matchedExpected.join(', ') || 'NONE'}`);
    pass = false;
  } else {
    console.log(`✓  coreKeywords hit niche terms: ${matchedExpected.join(', ')}`);
  }

  if (leakedGeneric.length > 0) {
    console.log(`❌ FAIL — coreKeywords include REJECTED generic terms: ${leakedGeneric.join(', ')}`);
    pass = false;
  } else if (c.rejectKeywords.length > 0) {
    console.log(`✓  no rejected generic terms leaked`);
  }

  return pass;
}

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY missing');
    process.exit(2);
  }

  const results: boolean[] = [];
  for (const c of CASES) {
    results.push(await runCase(c));
  }

  const passed = results.filter(Boolean).length;
  console.log(`\n═════════════════════════════════════════════════════`);
  console.log(`  ${passed} / ${results.length} cases passed`);
  console.log(`═════════════════════════════════════════════════════`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error('[test-identity-resolver] fatal:', err);
  process.exit(1);
});
