/**
 * CLI smoke test for identity-card-based competitor discovery.
 *
 * Mahdy 2026-04-03 #14: niche products (Instapation BNPL, etc.) surface the
 * wrong competitors because the AI doesn't lean on the identity card's
 * coreKeywords. This test feeds a niche identity card directly into the
 * discovery function and prints what comes back.
 *
 * Run:
 *   npx tsx src/eval/test-competitor-discovery.ts
 *
 * Cost: 1 Perplexity Sonar call per case (~$0.01 each).
 */

import 'dotenv/config';
import { discoverCompetitorsFromIdentity } from '../competitors/sonar-research';
import type { IdentityCard } from '../competitors/parse-context';

interface Case {
  name: string;
  clientName: string;
  identityCard: IdentityCard;
  expectAny: string[]; // lowercase fragments; at least one match required
  rejectAny: string[]; // lowercase fragments; zero matches required
}

const CASES: Case[] = [
  {
    name: 'Instapation — BNPL for medspas',
    clientName: 'Instapation',
    identityCard: {
      category: 'Buy-Now-Pay-Later (BNPL) / Point-of-Sale Financing',
      subcategory: 'Vertical-Specific BNPL for Aesthetic & Medical Services',
      businessModel: 'Transaction fees on BNPL loans',
      coreProduct:
        'A checkout financing widget that splits aesthetic treatments into interest-free installments.',
      coreKeywords: [
        'BNPL for medspas',
        'aesthetic financing',
        'point-of-sale financing',
        'patient payment plans',
        'medspa payment widget',
      ],
      negativeKeywords: [
        'practice management software',
        'medspa scheduling',
        'booking software',
        'appointment management',
      ],
      buyer: 'Medspa owner / practice manager',
      confidence: 92,
      ambiguityFlags: [],
      evidence: {
        websiteSignals: [],
        onboardingSignals: [],
        conflicts: [],
      },
    },
    expectAny: ['cherry', 'patientfi', 'affirm', 'walnut', 'klarna', 'afterpay', 'alphaeon'],
    rejectAny: ['acuity', 'vagaro', 'boulevard', 'mindbody', 'aesthetic record'],
  },
  {
    name: 'Fellow.ai — AI meeting notetaker (control case)',
    clientName: 'Fellow.ai',
    identityCard: {
      category: 'AI Meeting Intelligence',
      subcategory: 'AI Meeting Notetaker / Transcription Platform',
      businessModel: 'SaaS subscription',
      coreProduct:
        'AI assistant that joins video calls, transcribes, extracts action items.',
      coreKeywords: [
        'AI meeting notetaker',
        'meeting transcription software',
        'AI meeting assistant',
      ],
      negativeKeywords: ['project management software', 'calendar scheduling'],
      buyer: 'Sales managers, team leads',
      confidence: 92,
      ambiguityFlags: [],
      evidence: {
        websiteSignals: [],
        onboardingSignals: [],
        conflicts: [],
      },
    },
    expectAny: ['fireflies', 'otter', 'gong', 'avoma', 'fathom'],
    rejectAny: ['asana', 'notion', 'calendly'],
  },
];

function containsAny(haystack: string[], needles: string[]): string[] {
  const lowered = haystack.map((s) => s.toLowerCase());
  return needles.filter((n) => lowered.some((h) => h.includes(n.toLowerCase())));
}

async function runCase(c: Case): Promise<boolean> {
  console.log(`\n─────────────────────────────────────────────────────`);
  console.log(`CASE: ${c.name}`);
  console.log(`Category:  ${c.identityCard.category}`);
  console.log(`Keywords:  ${c.identityCard.coreKeywords.join(', ')}`);
  console.log(`─────────────────────────────────────────────────────`);

  const t0 = Date.now();
  const competitors = await discoverCompetitorsFromIdentity(c.identityCard, c.clientName);
  const elapsed = Date.now() - t0;

  console.log(`\nDiscovered ${competitors.length} competitor(s) in ${elapsed}ms:`);
  for (const comp of competitors) {
    console.log(`  • ${comp.name}${comp.domain ? ` (${comp.domain})` : ' (no domain)'}`);
  }

  const allNames = competitors.map((c) => `${c.name} ${c.domain ?? ''}`);
  const hitExpected = containsAny(allNames, c.expectAny);
  const leaked = containsAny(allNames, c.rejectAny);

  let pass = true;
  if (hitExpected.length === 0) {
    console.log(`\n❌ FAIL — no expected niche competitor in list. Wanted ANY of: ${c.expectAny.join(', ')}`);
    pass = false;
  } else {
    console.log(`\n✓  niche competitors present: ${hitExpected.join(', ')}`);
  }
  if (leaked.length > 0) {
    console.log(`❌ FAIL — rejected (wrong-category) names leaked: ${leaked.join(', ')}`);
    pass = false;
  } else if (c.rejectAny.length > 0) {
    console.log(`✓  no wrong-category names leaked`);
  }

  return pass;
}

async function main(): Promise<void> {
  if (!process.env.PERPLEXITY_API_KEY) {
    console.error('PERPLEXITY_API_KEY missing — cannot run live discovery test');
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
  console.error('[test-competitor-discovery] fatal:', err);
  process.exit(1);
});
