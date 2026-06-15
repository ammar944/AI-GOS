#!/usr/bin/env node
// zz-judge-run.mjs — the quality bar: an LLM value-read over a persisted run.
//
// CANONICAL JUDGE = a LOCAL agent (Codex or Claude Code), never an API model.
// Judging is done by the agent that is already running locally — strongest
// reasoning available, no API key, never billed. This script is just the
// deterministic ($0) plumbing around that agent:
//
//   1. GATHER (default)  : DB -> tmp/judge/<slug>/{bundle.json,prompt.txt}
//   2. JUDGE             : a local Codex/Claude Code agent reads prompt.txt and
//                          writes its verdict to tmp/judge/<slug>/verdict.json
//   3. GATE  (--gate)    : read verdict.json, exit 0 (>= threshold, no fab) / 2
//
// The verdict the agent must emit is verdictSchema below (printed by --print-schema).
//
// Usage:
//   node scripts/zz-judge-run.mjs <run_id>            # 1. GATHER (default, $0, no key)
//   node scripts/zz-judge-run.mjs <run_id> --gate     # 3. GATE on the agent's verdict.json
//   node scripts/zz-judge-run.mjs --print-schema       # the verdict shape the agent must write
//   node scripts/zz-judge-run.mjs <run_id> --provider deepseek   # ESCAPE HATCH (non-canonical
//        API judge for headless CI without an agent; owner rule: judging is normally local)
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { generateText, Output } from 'ai';
import { z } from 'zod';

const argv = process.argv.slice(2);
const positional = argv.filter((a) => !a.startsWith('--'));
const RUN_ID = positional[0];
const GATE = argv.includes('--gate');
const PRINT_SCHEMA = argv.includes('--print-schema');
const PROVIDER = flagValue('--provider'); // unset => canonical local-agent path (no API call)
const WRITE_JSON = argv.includes('--json');
const THRESHOLD = Number(flagValue('--threshold') ?? '9');
const DEFAULT_MODEL = PROVIDER === 'deepseek' ? 'deepseek-v4-flash' : 'claude-opus-4-5';
const MODEL_ID = flagValue('--model') ?? process.env.JUDGE_MODEL ?? DEFAULT_MODEL;

function flagValue(name) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined;
}

const verdictSchema = z.object({
  overallScore: z.number().describe('Holistic value score 1-10. 9+ = a buyer would pay and act on it.'),
  wouldPay: z.enum(['yes', 'no', 'with-caveats']).describe('Would a serious $500 GTM buyer pay for this as-is?'),
  oneLineVerdict: z.string().describe('One sentence the buyer would say out loud.'),
  perSection: z
    .array(z.object({
      zone: z.string(),
      score: z.number().describe('1-10 for this section given the evidence it had'),
      read: z.string().describe('What is genuinely good or weak here, with specifics'),
    }))
    .describe('One entry per output zone present'),
  strengths: z.array(z.string()).describe('What is genuinely sharp and trustworthy'),
  problems: z.array(z.string()).describe('What blocks this from being acted on'),
  topFixes: z.array(z.string()).describe('The 3 changes that would most raise the score'),
  fabricationFindings: z
    .array(z.string())
    .describe('Concrete invented/uncontained/contradictory claims a buyer would catch. Empty if none.'),
});

if (PRINT_SCHEMA) {
  console.log(JSON.stringify(z.toJSONSchema(verdictSchema), null, 2));
  process.exit(0);
}

if (!RUN_ID) {
  console.error('Usage: node scripts/zz-judge-run.mjs <run_id> [--gate] [--provider deepseek] [--threshold n] | --print-schema');
  process.exit(1);
}

const slug = RUN_ID.slice(0, 8);
const outDir = join(process.cwd(), 'tmp', 'judge', slug);

function printScorecard(verdict, { subjectUrl, modelLabel }) {
  const pass = verdict.overallScore >= THRESHOLD && (verdict.fabricationFindings?.length ?? 0) === 0;
  const line = '─'.repeat(64);
  console.log('');
  console.log(line);
  console.log(`  JUDGE VERDICT — run ${slug} — ${subjectUrl ?? ''}`);
  console.log(`  judge: ${modelLabel}  ·  threshold: ${THRESHOLD}/10`);
  console.log(line);
  console.log(`  SCORE: ${verdict.overallScore}/10    WOULD PAY: ${verdict.wouldPay}`);
  console.log(`  "${verdict.oneLineVerdict}"`);
  console.log('');
  console.log('  Per-section:');
  for (const s of verdict.perSection ?? []) {
    console.log(`    ${String(s.zone).padEnd(32)} ${s.score}/10  ${String(s.read).slice(0, 88)}`);
  }
  console.log('');
  if (verdict.fabricationFindings?.length) {
    console.log(`  🔴 FABRICATION (${verdict.fabricationFindings.length}):`);
    for (const f of verdict.fabricationFindings) console.log(`    - ${f}`);
    console.log('');
  }
  console.log('  Top fixes:');
  for (const f of verdict.topFixes ?? []) console.log(`    → ${f}`);
  console.log('');
  console.log(`  artifacts: ${outDir}/{bundle,verdict}.json + prompt.txt`);
  console.log(line);
  console.log(`  ${pass ? 'PASS' : 'BELOW BAR'} — score ${verdict.overallScore} ${pass ? '>=' : '<'} ${THRESHOLD}${verdict.fabricationFindings?.length ? ` + ${verdict.fabricationFindings.length} fabrication finding(s)` : ''}`);
  console.log(line);
  return pass;
}

// ---- MODE 3: GATE on the local agent's verdict.json (no DB, no model) ----
if (GATE) {
  let verdict;
  try {
    verdict = JSON.parse(await readFile(join(outDir, 'verdict.json'), 'utf8'));
  } catch {
    console.error(`[judge] no verdict.json at ${outDir}. Gather first (node scripts/zz-judge-run.mjs ${RUN_ID}), then have a Codex/Claude Code agent write the verdict, then re-run --gate.`);
    process.exit(1);
  }
  const parsed = verdictSchema.safeParse(verdict);
  if (!parsed.success) {
    console.error('[judge] verdict.json does not match the required shape:', parsed.error.issues.slice(0, 3));
    process.exit(1);
  }
  const pass = printScorecard(parsed.data, { modelLabel: 'local agent (Codex/Claude Code)' });
  if (WRITE_JSON) console.log(JSON.stringify(parsed.data));
  process.exit(pass ? 0 : 2);
}

// ---- MODES 1 & 2 need the persisted run ----
function requireEnv(name) {
  const value = process.env[name];
  if (!value) { console.error(`[judge] ${name} is required but was not configured in .env.local`); process.exit(1); }
  return value;
}
const sb = createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false },
});

const SECTION_BUDGET = 6000;
const CORPUS_BUDGET = 10000;
const BRIEF_BUDGET = 4000;
const POSITIONING_ORDER = [
  'positioningMarketCategory', 'positioningBuyerICP', 'positioningCompetitorLandscape',
  'positioningVoiceOfCustomer', 'positioningDemandIntent', 'positioningOfferDiagnostic',
  'positioningPaidMediaPlan', 'strategyBrief',
];

function isRecord(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function bodyOf(section) {
  const data = section?.data ?? {};
  if (isRecord(data.body)) return data.body;
  for (const c of [data.data, data.typedArtifact, data.artifact, data.positioningArtifact, data.paidMediaPlanArtifact]) {
    if (isRecord(c?.body)) return c.body;
  }
  return isRecord(data) ? data : {};
}
function truncate(text, max) {
  const s = typeof text === 'string' ? text : JSON.stringify(text, null, 2);
  if (!s) return '';
  return s.length <= max ? s : `${s.slice(0, max)}\n…[truncated ${s.length - max} chars]`;
}

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

async function gather() {
  const { data: arts, error: ae } = await sb
    .from('research_artifacts')
    .select('id, run_id, status, children_total, children_complete')
    .eq('run_id', RUN_ID);
  if (ae) { console.error('[judge] DB error (artifacts):', ae.message); process.exit(1); }
  if (!arts?.length) { console.error(`[judge] No research_artifacts row for run_id ${RUN_ID}`); process.exit(1); }
  const parent = arts[0];

  const { data: secs, error: se } = await sb
    .from('research_artifact_sections')
    .select('zone, status, counts_toward_rollup, data')
    .eq('artifact_id', parent.id);
  if (se) { console.error('[judge] DB error (sections):', se.message); process.exit(1); }

  const { data: sessionRow } = await sb
    .from('journey_sessions')
    .select('metadata, onboarding_data')
    .eq('run_id', RUN_ID)
    .maybeSingle();
  const subjectUrl = sessionRow?.metadata?.websiteUrl ?? '(unknown subject URL)';
  const briefInput = sessionRow?.onboarding_data ?? {};

  const sectionByZone = new Map((secs ?? []).map((s) => [s.zone, s]));
  const corpusBody = sectionByZone.has('deepResearchProgram') ? bodyOf(sectionByZone.get('deepResearchProgram')) : null;
  const outputZones = POSITIONING_ORDER.filter((z) => sectionByZone.has(z));
  if (outputZones.length === 0) { console.error(`[judge] run ${RUN_ID} has no positioning output zones to judge`); process.exit(1); }

  const outputsText = outputZones.map((zone) => {
    const s = sectionByZone.get(zone);
    const sources = s.data?.sources ?? bodyOf(s)?.sources ?? [];
    const n = Array.isArray(sources) ? sources.length : 0;
    return `<output zone="${zone}" status="${s.status}" sourcesRetrieved="${n}">\n${truncate(bodyOf(s), SECTION_BUDGET)}\n</output>`;
  }).join('\n\n');

  const promptText = [
    RUBRIC, '',
    '=== INPUTS the pipeline was given ===',
    `SUBJECT: ${subjectUrl}`, '',
    '<gtm-brief>', truncate(briefInput, BRIEF_BUDGET), '</gtm-brief>', '',
    '<corpus-evidence note="what deepResearchProgram gathered — the raw material">',
    corpusBody ? truncate(corpusBody, CORPUS_BUDGET) : '(no corpus body persisted)',
    '</corpus-evidence>', '',
    '=== OUTPUTS to judge ===', outputsText, '',
    'Render your verdict now. Score the value HONESTLY against the bar. Emit ONLY the verdict JSON (the shape from `--print-schema`) and write it to tmp/judge/' + slug + '/verdict.json.',
  ].join('\n');

  const bundle = {
    runId: RUN_ID, subjectUrl, rollup: `${parent.children_complete}/${parent.children_total}`,
    briefInput, corpusPresent: Boolean(corpusBody), outputZones,
  };
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'bundle.json'), JSON.stringify(bundle, null, 2), 'utf8');
  await writeFile(join(outDir, 'prompt.txt'), promptText, 'utf8');
  return { subjectUrl, promptText, outputZones, rollup: bundle.rollup };
}

const g = await gather();

// ---- MODE 1: GATHER (default, canonical) — hand off to a local agent ----
if (!PROVIDER) {
  console.log(`[judge] bundle gathered ($0, no model call): ${outDir}/{bundle.json,prompt.txt}`);
  console.log(`[judge] subject=${g.subjectUrl}  zones=${g.outputZones.length}  rollup=${g.rollup}`);
  console.log('[judge] CANONICAL JUDGE = a local Codex/Claude Code agent. Next:');
  console.log(`        1. have the agent read ${outDir}/prompt.txt and judge it`);
  console.log(`        2. write its verdict (shape: --print-schema) to ${outDir}/verdict.json`);
  console.log(`        3. node scripts/zz-judge-run.mjs ${RUN_ID} --gate   # pass/fail`);
  process.exit(0);
}

// ---- MODE 2: ESCAPE HATCH — non-canonical API judge (headless CI without an agent) ----
console.error(`[judge] ⚠️ non-canonical API judge (${PROVIDER}:${MODEL_ID}). Owner rule: judging is normally a local agent.`);
const { createAnthropic } = await import('@ai-sdk/anthropic');
const { createDeepSeek } = await import('@ai-sdk/deepseek');
const model = PROVIDER === 'deepseek'
  ? createDeepSeek({ apiKey: requireEnv('DEEPSEEK_API_KEY') })(MODEL_ID)
  : createAnthropic({ apiKey: requireEnv('ANTHROPIC_API_KEY') })(MODEL_ID);

let result;
try {
  result = await generateText({
    model,
    output: Output.object({ schema: verdictSchema }),
    prompt: g.promptText,
    maxOutputTokens: 6000,
    ...(PROVIDER === 'deepseek' ? { providerOptions: { deepseek: { thinking: { type: 'disabled' } } } } : {}),
  });
} catch (err) {
  console.error('[judge] API model call failed:', err instanceof Error ? err.message : String(err));
  console.error(`[judge] bundle is on disk at ${outDir} — judge it with a local agent + --gate instead.`);
  process.exit(1);
}

let verdict;
try { verdict = result.output; } catch {
  console.error('[judge] structured output failed to parse. Raw head:', (result.text ?? '').slice(0, 1500));
  process.exit(1);
}
await writeFile(join(outDir, 'verdict.json'), JSON.stringify(verdict, null, 2), 'utf8');
const pass = printScorecard(verdict, { subjectUrl: g.subjectUrl, modelLabel: `${PROVIDER}:${MODEL_ID} (escape hatch)` });
if (WRITE_JSON) console.log(JSON.stringify(verdict));
process.exit(pass ? 0 : 2);
