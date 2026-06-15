#!/usr/bin/env node
// zz-judge-run.mjs — the quality bar: an LLM value-read over a persisted run.
//
// Reads a run's INPUTS (subject URL, GTM brief, corpus evidence) and OUTPUTS
// (the 6 positioning sections + paid-media plan + strategy brief) straight from
// Supabase, then has a strong model render the holistic verdict a $500 GTM buyer
// would: "from these inputs, is this genuinely sharp, trustworthy, valuable
// research I would pay for and act on?" That verdict — not job status, not the
// pile of deterministic gates — is the definition of done.
//
// $0 of browser: reads the persisted DB; only the judge call costs tokens.
// The gather step (DB -> bundle) is deterministic and always writes the bundle
// first, so --bundle-only lets a Claude/Codex subagent render the verdict with
// no API key at all ("a subagent or codex or Claude reading it").
//
// Usage:
//   node scripts/zz-judge-run.mjs <run_id> [--bundle-only]
//        [--provider anthropic|deepseek] [--model <id>] [--threshold <n>] [--json]
// Exit 0 = bundle-only success, OR score >= threshold (default 9) with no fabrication.
// Exit 2 = below bar / fabrication found. Exit 1 = setup/DB/model error.
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { generateText, Output } from 'ai';
import { z } from 'zod';

const argv = process.argv.slice(2);
const positional = argv.filter((a) => !a.startsWith('--'));
const RUN_ID = positional[0];
const WRITE_JSON = argv.includes('--json');
const BUNDLE_ONLY = argv.includes('--bundle-only');
const PROVIDER = flagValue('--provider') ?? 'anthropic';
const THRESHOLD = Number(flagValue('--threshold') ?? '9');
const DEFAULT_MODEL = PROVIDER === 'deepseek' ? 'deepseek-v4-flash' : 'claude-opus-4-5';
const MODEL_ID = flagValue('--model') ?? process.env.JUDGE_MODEL ?? DEFAULT_MODEL;

function flagValue(name) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined;
}

if (!RUN_ID) {
  console.error(
    'Usage: node scripts/zz-judge-run.mjs <run_id> [--bundle-only] [--provider anthropic|deepseek] [--model <id>] [--threshold <n>] [--json]',
  );
  process.exit(1);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`[judge] ${name} is required but was not configured in .env.local`);
    process.exit(1);
  }
  return value;
}

const SUPABASE_URL = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const SERVICE_ROLE = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

// Char budgets keep the judge prompt bounded while preserving substance.
const SECTION_BUDGET = 6000;
const CORPUS_BUDGET = 10000;
const BRIEF_BUDGET = 4000;

const POSITIONING_ORDER = [
  'positioningMarketCategory',
  'positioningBuyerICP',
  'positioningCompetitorLandscape',
  'positioningVoiceOfCustomer',
  'positioningDemandIntent',
  'positioningOfferDiagnostic',
  'positioningPaidMediaPlan',
  'strategyBrief',
];

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function bodyOf(section) {
  const data = section?.data ?? {};
  if (isRecord(data.body)) return data.body;
  const candidates = [
    data.data,
    data.typedArtifact,
    data.artifact,
    data.positioningArtifact,
    data.paidMediaPlanArtifact,
  ];
  for (const candidate of candidates) {
    if (isRecord(candidate?.body)) return candidate.body;
  }
  return isRecord(data) ? data : {};
}

function truncate(text, max) {
  const s = typeof text === 'string' ? text : JSON.stringify(text, null, 2);
  if (!s) return '';
  return s.length <= max ? s : `${s.slice(0, max)}\n…[truncated ${s.length - max} chars]`;
}

const verdictSchema = z.object({
  overallScore: z
    .number()
    .describe('Holistic value score 1-10. 9+ = a buyer would pay and act on it.'),
  wouldPay: z
    .enum(['yes', 'no', 'with-caveats'])
    .describe('Would a serious $500 GTM buyer pay for this as-is?'),
  oneLineVerdict: z.string().describe('One sentence the buyer would say out loud.'),
  perSection: z
    .array(
      z.object({
        zone: z.string(),
        score: z.number().describe('1-10 for this section given the evidence it had'),
        read: z.string().describe('What is genuinely good or weak here, with specifics'),
      }),
    )
    .describe('One entry per output zone present'),
  strengths: z.array(z.string()).describe('What is genuinely sharp and trustworthy'),
  problems: z.array(z.string()).describe('What blocks this from being acted on'),
  topFixes: z.array(z.string()).describe('The 3 changes that would most raise the score'),
  fabricationFindings: z
    .array(z.string())
    .describe(
      'Concrete invented/uncontained/contradictory claims a buyer would catch and lose trust over. Empty if none.',
    ),
});

const RUBRIC = [
  'You are TWO readers at once judging a paid GTM research deliverable:',
  '  (1) a serious $500-buyer (SaaS founder / growth lead / media buyer) deciding if this is sharp, trustworthy, and act-on-able;',
  '  (2) a skeptical fabrication auditor hunting invented numbers, dead/uncontained citations, fake quotes, and cross-section contradictions.',
  '',
  'The bar (9/10) is met only when a serious buyer reads it and says: "sharp, trustworthy, easy to digest, strategically useful, I can ACT on it." Score against:',
  '  - Research trust: load-bearing claims are evidenced or an honest gap; no invented numbers; no dead/uncontained URLs.',
  '  - Source quality: VoC quotes are real human-voice permalinks (not nav menus / marketing prose); evidence sits with the claim.',
  '  - Strategic usefulness: ONE thesis argued in order; cross-section facts reconcile (one price, one CAC, one keyword total); insights earned, not padded.',
  '  - Media-plan actionability: budgets are physically buyable — budget→CPC→clicks→CVR→conversions→CAC closes and reconciles with measured demand; budget sub-totals SUM to the stated totals.',
  '  - Structure & readability: decision memo first; no pipeline chrome / internal jargon leaking to the client surface.',
  '',
  'BE FAIR ABOUT EVIDENCE: if the subject was genuinely evidence-poor, an HONEST gap stated plainly is GOOD, not a failure — do not punish honesty. Punish FABRICATION and INCOHERENCE; reward earned insight and honest limits.',
  'BE SKEPTICAL: a fluent paragraph is not evidence. A number with no provenance is a red flag. Contradictions between sections are disqualifying for the contradicted claim.',
  'Score the OUTPUT given the INPUTS it had to work with. Then answer: would the buyer pay, and what 3 fixes raise it most.',
].join('\n');

function buildPrompt({ subjectUrl, briefInput, corpusBody, outputsText }) {
  return [
    RUBRIC,
    '',
    '=== INPUTS the pipeline was given ===',
    `SUBJECT: ${subjectUrl}`,
    '',
    '<gtm-brief>',
    truncate(briefInput, BRIEF_BUDGET),
    '</gtm-brief>',
    '',
    '<corpus-evidence note="what deepResearchProgram gathered — the raw material">',
    corpusBody ? truncate(corpusBody, CORPUS_BUDGET) : '(no corpus body persisted)',
    '</corpus-evidence>',
    '',
    '=== OUTPUTS to judge ===',
    outputsText,
    '',
    'Render your verdict now. Score the value HONESTLY against the bar.',
  ].join('\n');
}

async function main() {
  // ---- Load parent artifact ----
  const { data: arts, error: ae } = await sb
    .from('research_artifacts')
    .select('id, run_id, status, children_total, children_complete')
    .eq('run_id', RUN_ID);
  if (ae) {
    console.error('[judge] DB error (artifacts):', ae.message);
    process.exit(1);
  }
  if (!arts?.length) {
    console.error(`[judge] No research_artifacts row for run_id ${RUN_ID}`);
    process.exit(1);
  }
  const parent = arts[0];

  // ---- Load sections (outputs) ----
  const { data: secs, error: se } = await sb
    .from('research_artifact_sections')
    .select('zone, status, counts_toward_rollup, data')
    .eq('artifact_id', parent.id);
  if (se) {
    console.error('[judge] DB error (sections):', se.message);
    process.exit(1);
  }

  // ---- Load inputs (subject + brief) ----
  const { data: sessionRow } = await sb
    .from('journey_sessions')
    .select('metadata, onboarding_data')
    .eq('run_id', RUN_ID)
    .maybeSingle();
  const subjectUrl = sessionRow?.metadata?.websiteUrl ?? '(unknown subject URL)';
  const briefInput = sessionRow?.onboarding_data ?? {};

  const sectionByZone = new Map((secs ?? []).map((s) => [s.zone, s]));
  const corpusSection = sectionByZone.get('deepResearchProgram');
  const corpusBody = corpusSection ? bodyOf(corpusSection) : null;

  const outputZones = POSITIONING_ORDER.filter((z) => sectionByZone.has(z));
  if (outputZones.length === 0) {
    console.error(`[judge] run ${RUN_ID} has no positioning output zones to judge`);
    process.exit(1);
  }

  const outputsText = outputZones
    .map((zone) => {
      const s = sectionByZone.get(zone);
      const data = s.data ?? {};
      const sources = data.sources ?? bodyOf(s)?.sources ?? [];
      const sourceCount = Array.isArray(sources) ? sources.length : 0;
      return [
        `<output zone="${zone}" status="${s.status}" sourcesRetrieved="${sourceCount}">`,
        truncate(bodyOf(s), SECTION_BUDGET),
        `</output>`,
      ].join('\n');
    })
    .join('\n\n');

  const promptText = buildPrompt({ subjectUrl, briefInput, corpusBody, outputsText });
  const bundle = {
    runId: RUN_ID,
    subjectUrl,
    rollup: `${parent.children_complete}/${parent.children_total}`,
    briefInput,
    corpusPresent: Boolean(corpusBody),
    outputZones,
  };

  // ---- Persist the bundle FIRST (deterministic gather; survives any model failure) ----
  const slug = RUN_ID.slice(0, 8);
  const outDir = join(process.cwd(), 'tmp', 'judge', slug);
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'bundle.json'), JSON.stringify(bundle, null, 2), 'utf8');
  await writeFile(join(outDir, 'prompt.txt'), promptText, 'utf8');

  if (BUNDLE_ONLY) {
    console.log(`[judge] bundle gathered ($0, no model call): ${outDir}/{bundle.json,prompt.txt}`);
    console.log(`[judge] subject=${subjectUrl} zones=${outputZones.length} rollup=${bundle.rollup}`);
    console.log('[judge] hand prompt.txt to a Claude/Codex subagent to render the verdict.');
    process.exit(0);
  }

  // ---- Judge call ----
  const model =
    PROVIDER === 'deepseek'
      ? createDeepSeek({ apiKey: requireEnv('DEEPSEEK_API_KEY') })(MODEL_ID)
      : createAnthropic({ apiKey: requireEnv('ANTHROPIC_API_KEY') })(MODEL_ID);

  console.error(`[judge] reading run ${RUN_ID} (${subjectUrl}) with ${PROVIDER}:${MODEL_ID} …`);
  let result;
  try {
    result = await generateText({
      model,
      output: Output.object({ schema: verdictSchema }),
      prompt: promptText,
      maxOutputTokens: 6000,
      ...(PROVIDER === 'deepseek'
        ? { providerOptions: { deepseek: { thinking: { type: 'disabled' } } } }
        : {}),
    });
  } catch (err) {
    console.error('[judge] model call failed:', err instanceof Error ? err.message : String(err));
    console.error(`[judge] bundle is still on disk at ${outDir} — re-judge with --bundle-only + a subagent.`);
    process.exit(1);
  }

  let verdict;
  try {
    verdict = result.output; // throwing getter in AI SDK v6 if parse failed
  } catch {
    console.error('[judge] structured output failed to parse. Raw text head:');
    console.error((result.text ?? '').slice(0, 2000));
    process.exit(1);
  }

  await writeFile(join(outDir, 'verdict.json'), JSON.stringify(verdict, null, 2), 'utf8');

  const pass = verdict.overallScore >= THRESHOLD && verdict.fabricationFindings.length === 0;
  const line = '─'.repeat(64);
  console.log('');
  console.log(line);
  console.log(`  JUDGE VERDICT — run ${slug} — ${subjectUrl}`);
  console.log(`  model: ${PROVIDER}:${MODEL_ID}  ·  threshold: ${THRESHOLD}/10`);
  console.log(line);
  console.log(`  SCORE: ${verdict.overallScore}/10    WOULD PAY: ${verdict.wouldPay}`);
  console.log(`  "${verdict.oneLineVerdict}"`);
  console.log('');
  console.log('  Per-section:');
  for (const s of verdict.perSection) {
    console.log(`    ${String(s.zone).padEnd(32)} ${s.score}/10  ${s.read.slice(0, 90)}`);
  }
  console.log('');
  if (verdict.fabricationFindings.length) {
    console.log(`  🔴 FABRICATION (${verdict.fabricationFindings.length}):`);
    for (const f of verdict.fabricationFindings) console.log(`    - ${f}`);
    console.log('');
  }
  console.log('  Top fixes:');
  for (const f of verdict.topFixes) console.log(`    → ${f}`);
  console.log('');
  console.log(`  artifacts: ${outDir}/{bundle,verdict}.json + prompt.txt`);
  console.log(line);
  console.log(
    `  ${pass ? 'PASS' : 'BELOW BAR'} — score ${verdict.overallScore} ${pass ? '>=' : '<'} ${THRESHOLD}${verdict.fabricationFindings.length ? ` + ${verdict.fabricationFindings.length} fabrication finding(s)` : ''}`,
  );
  console.log(line);

  if (WRITE_JSON) console.log(JSON.stringify(verdict));
  process.exit(pass ? 0 : 2);
}

main().catch((e) => {
  console.error('[judge] FATAL', e);
  process.exit(1);
});
